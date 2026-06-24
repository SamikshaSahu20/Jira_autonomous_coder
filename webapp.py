import json
import os
import requests
import subprocess
import socket
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from passlib.context import CryptContext

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent

JIRA_BASE_URL  = os.getenv("JIRA_BASE_URL", "").rstrip("/")
JIRA_EMAIL     = os.getenv("JIRA_EMAIL", "")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN", "")
JIRA_PROJECT   = os.getenv("JIRA_PROJECT", "ASK")
SECRET_KEY     = os.getenv("WEBAPP_SECRET", "change-this-in-production")
ALGORITHM      = "HS256"

USERS_FILE    = BASE_DIR / "users.json"
MANIFEST_FILE = BASE_DIR / "output" / "manifest.json"

def resolve_run_dir(run_dir: str) -> Path:
    """Resolve run_dir relative to BASE_DIR if it is a relative path."""
    p = Path(run_dir)
    if not p.is_absolute():
        p = BASE_DIR / p
    return p

pwd_context   = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

app = FastAPI(title="Auto Coder Dashboard")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Mount static files if dist exists
_DIST_DIR = BASE_DIR / "frontend" / "dist"
if _DIST_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_DIST_DIR / "assets")), name="assets")


def load_users():
    if not USERS_FILE.exists():
        return {}
    return json.loads(USERS_FILE.read_text(encoding="utf-8"))


def create_token(email: str):
    expire = datetime.utcnow() + timedelta(hours=8)
    return jwt.encode({"sub": email, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def jira_get(path, params=None):
    s = requests.Session()
    s.auth = (JIRA_EMAIL, JIRA_API_TOKEN)
    s.headers.update({"Accept": "application/json"})
    s.verify = False
    resp = s.get(f"{JIRA_BASE_URL}{path}", params=params)
    if not resp.ok:
        return None
    return resp.json()


def get_user_tickets(user_email: str):
    jql = f'project={JIRA_PROJECT} AND assignee="{user_email}" ORDER BY updated DESC'
    data = jira_get("/rest/api/3/search/jql", {
        "jql": jql,
        "maxResults": 100,
        "fields": "summary,status,assignee,reporter,issuetype,priority,updated",
    })
    if not data:
        return []

    tickets = []
    for issue in data.get("issues", []):
        f = issue["fields"]
        assignee = (f.get("assignee") or {}).get("emailAddress", "")
        reporter = (f.get("reporter") or {}).get("emailAddress", "")
        tickets.append({
            "ticket":     issue["key"],
            "summary":    f.get("summary", ""),
            "status":     (f.get("status") or {}).get("name", ""),
            "issue_type": (f.get("issuetype") or {}).get("name", ""),
            "priority":   (f.get("priority") or {}).get("name", ""),
            "assignee":   assignee,
            "reporter":   reporter,
            "updated":    f.get("updated", ""),
            "role":       "Assignee" if assignee.lower() == user_email.lower() else "Reporter" if reporter.lower() == user_email.lower() else "Team",
        })
    return tickets


def load_manifest():
    if not MANIFEST_FILE.exists():
        return []
    try:
        return json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


@app.post("/api/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    users = load_users()
    user = users.get(form.username.lower())
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email. Please use a valid registered email.")
    # Allow any password to work as requested
    token = create_token(form.username.lower())
    return {"access_token": token, "token_type": "bearer", "email": form.username.lower()}


@app.get("/api/me")
def me(email: str = Depends(get_current_user)):
    return {"email": email}


@app.get("/api/tickets")
def tickets(email: str = Depends(get_current_user)):
    jira_tickets = get_user_tickets(email)
    manifest = load_manifest()

    manifest_by_ticket = {}
    for entry in manifest:
        key = entry.get("ticket", "").upper()
        manifest_by_ticket.setdefault(key, []).append(entry)

    for ticket in jira_tickets:
        key = ticket["ticket"].upper()
        generated = manifest_by_ticket.get(key, [])

        # Filter to only entries whose run_dir actually exists on disk
        valid_generated = []
        for e in generated:
            rd = e.get("run_dir")
            if rd and resolve_run_dir(rd).exists():
                valid_generated.append(e)

        ticket["generated_files"] = [e["filename"] for e in valid_generated]
        ticket["code_generated"] = len(valid_generated) > 0
        ticket["last_generated"] = max(
            (e.get("last_modified", "") for e in valid_generated), default=None
        ) if valid_generated else None

        ticket["bugs_found"] = 0
        ticket["bugs_fixed"] = 0
        if valid_generated:
            run_dir = valid_generated[0].get("run_dir")
            if run_dir:
                try:
                    metrics_path = resolve_run_dir(run_dir) / "metrics.json"
                    if metrics_path.exists():
                        metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
                        ticket["bugs_found"] = metrics.get("bugs_found", 0)
                        ticket["bugs_fixed"] = metrics.get("bugs_fixed", 0)
                except:
                    pass

    return jira_tickets


@app.get("/api/tickets/{ticket_key}/files")
def ticket_files(ticket_key: str, email: str = Depends(get_current_user)):
    manifest = load_manifest()
    files = [e for e in manifest if e.get("ticket", "").upper() == ticket_key.upper()]
    
    # Improve summary if it's missing or generic
    for f in files:
        if not f.get("summary") or "No summary" in f.get("summary") or "The provided code was reviewed" in f.get("summary", ""):
            try:
                # Try to read the first comment line of the file
                p = resolve_run_dir(f["run_dir"]) / f["filename"]
                if p.exists():
                    with open(p, "r", encoding="utf-8") as file_handle:
                        for _ in range(5):
                            line = file_handle.readline().strip()
                            # We don't want to use filenames like "// Component.js" as the summary
                            if (line.startswith("//") or line.startswith("#") or line.startswith("<!--")) and not "." in line:
                                f["summary"] = line.lstrip("/# ").replace("<!--", "").replace("-->", "").strip()
                                break
                    
                    if not f.get("summary") or "No summary" in f.get("summary") or "The provided code was reviewed" in f.get("summary"):
                        ext = p.suffix.lower()
                        f["summary"] = f"Generated {ext[1:].upper()} source file" if ext else "Generated code file"
            except:
                f["summary"] = "Generated output file"

    # Get folder path from first file entry
    folder_path = None
    review_content = None
    timings_content = None
    if files:
        folder_path = files[0].get("run_dir")
        
        # Load content for flowcharts
        for f in files:
            if f["filename"].startswith("flowchart") and f["filename"].endswith(".md"):
                try:
                    p = resolve_run_dir(f["run_dir"]) / f["filename"]
                    if p.exists():
                        f["content"] = p.read_text(encoding="utf-8")
                except Exception:
                    f["content"] = None
                    
        # Check for AI_Review.md directly
        if folder_path:
            rd = resolve_run_dir(folder_path)
            p = rd / "AI_Review.md"
            if p.exists():
                review_content = p.read_text(encoding="utf-8")
            
            p_timings = rd / "timings.json"
            if p_timings.exists():
                try:
                    timings_content = json.loads(p_timings.read_text(encoding="utf-8"))
                except:
                    pass
    
    return {
        "ticket": ticket_key,
        "folder": folder_path,
        "review": review_content,
        "timings": timings_content,
        "files": files
    }

from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str

@app.post("/api/tickets/{ticket_key}/chat")
def ticket_chat(ticket_key: str, req: ChatRequest, email: str = Depends(get_current_user)):
    manifest = load_manifest()
    files = [e for e in manifest if e.get("ticket", "").upper() == ticket_key.upper()]
    if not files:
        raise HTTPException(status_code=404, detail="No files found")
    
    run_dir = resolve_run_dir(files[0].get("run_dir"))
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail="Output directory not found")

    # gather all non-markdown files
    code_context = []
    for sf in files:
        fname = sf["filename"]
        if not fname.endswith(".md") and not fname.endswith(".json"):
            try:
                content = (run_dir / fname).read_text(encoding="utf-8")
                code_context.append(f"// {fname}\n{content}")
            except:
                pass
            
    code_text = "\n\n".join(code_context)
    
    from portkey_client import call_llm
    import re
    
    sys_prompt = "You are an AI Coder handling a follow-up request. Provide updated source code strictly in markdown format based on user's new instructions. Only output the files that changed. EACH file must start with a `# filename.py` comment just inside the markdown block."
    user_prompt = f"Existing Code:\n```\n{code_text}\n```\n\nNew Instruction:\n{req.message}"
    
    print(f"[webapp] Chat agent triggered for {ticket_key}: {req.message}")
    response = call_llm(system_prompt=sys_prompt, user_prompt=user_prompt, agent="coder")
    
    from generate import extract_all_code_blocks
    blocks = extract_all_code_blocks(response)
    updated = []
    
    for b in blocks:
        if b["code"].strip():
            (run_dir / b["filename"]).write_text(b["code"].strip(), encoding="utf-8")
            updated.append(b["filename"])
            
    return {"status": "success", "updated": updated, "message": f"Updated {len(updated)} files."}

RUNNING_APPS = {}

def _stub_missing_requires(target_dir: Path, entry_file: str):
    """
    Scans a Node.js entry file for require('./...') calls that reference local files
    that don't exist, and creates stub files so the server can at least start.
    """
    import re
    entry = target_dir / entry_file
    if not entry.exists():
        return
    content = entry.read_text(encoding="utf-8", errors="ignore")
    local_requires = re.findall(r"""require\(['"](\.[^'"]+)['"]\)""", content)
    for req in local_requires:
        req_path = (target_dir / req).resolve()
        candidates = [req_path, Path(str(req_path) + ".js")]
        if not any(c.exists() for c in candidates):
            stub_path = Path(str(req_path) + ".js") if not req_path.suffix else req_path
            stub_path.parent.mkdir(parents=True, exist_ok=True)
            stub_path.write_text(
                f"// Auto-generated stub for missing module: {req}\nmodule.exports = require('express').Router();\n",
                encoding="utf-8"
            )
            print(f"[webapp] Stubbed missing module: {stub_path.relative_to(target_dir)}")


def _patch_server_js(target_dir: Path, entry_file: str, port: int):
    """
    Auto-patches common AI-generated server.js issues so the server always starts:
    1. Removes deprecated Mongoose options (useNewUrlParser, useUnifiedTopology)
    2. Replaces mongoose.connect().then(app.listen) with non-blocking version
    3. Adds cors() if cors is required
    Only patches once — skips files already patched.
    """
    import re
    entry = target_dir / entry_file
    if not entry.exists():
        return
    code = entry.read_text(encoding="utf-8", errors="ignore")
    # Guard: already patched, skip
    if "// Auto-patched:" in code:
        return
    original = code

    # Fix 1: Remove deprecated mongoose options
    code = re.sub(r",?\s*useNewUrlParser\s*:\s*true", "", code)
    code = re.sub(r",?\s*useUnifiedTopology\s*:\s*true", "", code)
    code = re.sub(r"(mongoose\.connect\([^,)]+),\s*\{\s*\}", r"\1", code)

    # Fix 2: Detect mongoose.connect block and replace it line-by-line
    # Strategy: find the line where mongoose connect starts, drop everything from there,
    # and append a non-blocking version that starts Express immediately.
    if re.search(r"mongoose[.\s]*connect", code, re.IGNORECASE) and re.search(r"app\.listen", code):
        lines = code.split("\n")
        cut_idx = None
        for i, line in enumerate(lines):
            if re.search(r"mongoose\s*$", line.strip()) or re.search(r"mongoose\.connect", line):
                cut_idx = i
                break
        if cut_idx is not None:
            header = "\n".join(lines[:cut_idx])
            code = (
                header + "\n\n"
                "// Auto-patched: Express starts immediately; DB connects in background\n"
                "app.listen(process.env.PORT || " + str(port) + ", () => console.log('[preview] Server on port ' + (process.env.PORT || " + str(port) + ")));\n"
                "mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/preview')\n"
                "  .then(() => console.log('[preview] MongoDB connected'))\n"
                "  .catch(e => console.warn('[preview] MongoDB unavailable:', e.message));\n"
            )

    # Fix 3: Add cors if required but not set up
    if "require('cors')" in code and "app.use(cors" not in code:
        code = code.replace("const app = express();", "const app = express();\napp.use(require('cors')());")

    if code != original:
        entry.write_text(code, encoding="utf-8")
        print(f"[webapp] Auto-patched {entry_file} for preview compatibility")

def get_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('', 0))
    port = s.getsockname()[1]
    s.close()
    return port

@app.post("/api/tickets/{ticket_key}/run")
def run_ticket_app(ticket_key: str, email: str = Depends(get_current_user)):
    manifest = load_manifest()
    files = [e for e in manifest if e.get("ticket", "").upper() == ticket_key.upper()]
    if not files:
        raise HTTPException(status_code=404, detail="No files found")
        
    folder_path = files[0].get("run_dir")
    if not folder_path or not resolve_run_dir(folder_path).exists():
        raise HTTPException(status_code=404, detail="Output directory not found")
        
    if ticket_key in RUNNING_APPS:
        if RUNNING_APPS[ticket_key]["process"].poll() is None:
            return {"url": f"http://localhost:{RUNNING_APPS[ticket_key]['port']}"}
        del RUNNING_APPS[ticket_key]
        
    import time
    target_dir = resolve_run_dir(folder_path)
    port = get_free_port()
    env = os.environ.copy()
    env["PORT"] = str(port)

    # ── Node.js app ────────────────────────────────────────────────
    entry_js = None
    for candidate in ["server.js", "index.js", "app.js"]:
        if (target_dir / candidate).exists():
            entry_js = candidate
            break

    if entry_js or (target_dir / "package.json").exists():
        # Ensure package.json exists
        if not (target_dir / "package.json").exists():
            (target_dir / "package.json").write_text('{"type":"commonjs"}', encoding="utf-8")

        # Skip npm install if node_modules already exists (saves 20-60s on repeated runs)
        node_modules = target_dir / "node_modules"
        if not node_modules.exists():
            print(f"[webapp] Running npm install in {target_dir}...")
            install_result = subprocess.run(
                ["npm", "install"],
                cwd=str(target_dir),
                shell=True,
                capture_output=True,
                text=True
            )
            if install_result.returncode != 0:
                print(f"[webapp] npm install stderr: {install_result.stderr[:300]}")
        else:
            print(f"[webapp] node_modules found — skipping npm install")

        # Scan server entry for missing local require() files and stub them
        if entry_js:
            _stub_missing_requires(target_dir, entry_js)
            _patch_server_js(target_dir, entry_js, port)

            print(f"[webapp] Starting Node: node {entry_js} on port {port}")
            p = subprocess.Popen(
                ["node", entry_js],
                cwd=str(target_dir), env=env,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                shell=False
            )
            RUNNING_APPS[ticket_key] = {"process": p, "port": port}
            time.sleep(2.0)
            if p.poll() is not None:
                out = p.stdout.read(1000) if p.stdout else ""
                # Fallback: if backend crashes, try serving static frontend if index.html exists
                if (target_dir / "index.html").exists():
                    print(f"[webapp] Backend crashed, falling back to static frontend")
                    port2 = get_free_port()
                    p2 = subprocess.Popen(
                        ["python", "-m", "http.server", str(port2)],
                        cwd=str(target_dir),
                        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
                    )
                    RUNNING_APPS[ticket_key] = {"process": p2, "port": port2}
                    return {"url": f"http://localhost:{port2}"}
                raise HTTPException(status_code=500, detail=f"Node server crashed.\n\nLogs:\n{out}")
            return {"url": f"http://localhost:{port}"}

        # No entry file but has package.json — try npm start
        p = subprocess.Popen(
            ["npm", "start"],
            cwd=str(target_dir), env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
            shell=True
        )
        RUNNING_APPS[ticket_key] = {"process": p, "port": port}
        time.sleep(2.5)
        if p.poll() is not None:
            out = p.stdout.read(1000) if p.stdout else ""
            raise HTTPException(status_code=500, detail=f"npm start crashed.\n\nLogs:\n{out}")
        return {"url": f"http://localhost:{port}"}

    # ── Python app ─────────────────────────────────────────────────
    for candidate in ["app.py", "main.py"]:
        if (target_dir / candidate).exists():
            print(f"[webapp] Starting Python: python {candidate} on port {port}")
            p = subprocess.Popen(
                ["python", candidate],
                cwd=str(target_dir), env=env,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
            )
            RUNNING_APPS[ticket_key] = {"process": p, "port": port}
            time.sleep(2.0)
            if p.poll() is not None:
                out = p.stdout.read(1000) if p.stdout else ""
                raise HTTPException(status_code=500, detail=f"Python app crashed.\n\nLogs:\n{out}")
            return {"url": f"http://localhost:{port}"}

    # ── Static HTML ────────────────────────────────────────────────
    if (target_dir / "index.html").exists():
        p = subprocess.Popen(
            ["python", "-m", "http.server", str(port)],
            cwd=str(target_dir),
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
        )
        RUNNING_APPS[ticket_key] = {"process": p, "port": port}
        return {"url": f"http://localhost:{port}"}

    raise HTTPException(status_code=400, detail="Could not determine how to run this app. No server.js / app.py / index.html found.")


@app.get("/")
def index():
    dist_index = _DIST_DIR / "index.html"
    if dist_index.exists():
        return FileResponse(str(dist_index))
    raise HTTPException(status_code=404, detail="React build not found. Please run 'npm run build' inside frontend folder.")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("WEBAPP_PORT", 8000))
    print(f"[webapp] Running at http://localhost:{port}")
    uvicorn.run("webapp:app", host="0.0.0.0", port=port, reload=True)
