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

JIRA_BASE_URL  = os.getenv("JIRA_BASE_URL", "").rstrip("/")
JIRA_EMAIL     = os.getenv("JIRA_EMAIL", "")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN", "")
JIRA_PROJECT   = os.getenv("JIRA_PROJECT", "ASK")
SECRET_KEY     = os.getenv("WEBAPP_SECRET", "change-this-in-production")
ALGORITHM      = "HS256"

USERS_FILE    = Path("users.json")
MANIFEST_FILE = Path("output/manifest.json")

pwd_context   = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

app = FastAPI(title="Auto Coder Dashboard")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Mount static files if dist exists
if os.path.isdir("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")


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
        ticket["generated_files"] = [e["filename"] for e in generated]
        ticket["code_generated"] = len(generated) > 0
        ticket["last_generated"] = max(
            (e.get("last_modified", "") for e in generated), default=None
        ) if generated else None

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
                p = Path(f["run_dir"]) / f["filename"]
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
    if files:
        folder_path = files[0].get("run_dir")
        
        # Load content for flowcharts
        for f in files:
            if f["filename"].startswith("flowchart") and f["filename"].endswith(".md"):
                try:
                    p = Path(f["run_dir"]) / f["filename"]
                    if p.exists():
                        f["content"] = p.read_text(encoding="utf-8")
                except Exception:
                    f["content"] = None
    
    return {
        "ticket": ticket_key,
        "folder": folder_path,
        "files": files
    }

RUNNING_APPS = {}

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
    if not folder_path or not Path(folder_path).exists():
        raise HTTPException(status_code=404, detail="Output directory not found")
        
    if ticket_key in RUNNING_APPS:
        # Check if process is still alive
        if RUNNING_APPS[ticket_key]["process"].poll() is None:
            return {"url": f"http://localhost:{RUNNING_APPS[ticket_key]['port']}"}
        
    run_cmd = None
    target_dir = Path(folder_path)
    
    # Auto-detect CommonJS vs Module issue by creating a local package.json
    if not (target_dir / "package.json").exists() and list(target_dir.glob("*.js")):
        (target_dir / "package.json").write_text('{"type": "commonjs"}')
        # Simple auto-install of common dependencies to prevent crashes
        print("[webapp] Auto-installing dependencies for preview...")
        subprocess.run(["npm", "install", "express", "cors", "dotenv", "mongoose"], cwd=str(target_dir), shell=True)
    
    if (target_dir / "package.json").exists() and not (target_dir / "server.js").exists() and not (target_dir / "index.js").exists():
        run_cmd = ["npm", "start"]
    elif (target_dir / "server.js").exists() or (target_dir / "index.js").exists():
        script = "server.js" if (target_dir / "server.js").exists() else "index.js"
        run_cmd = ["node", script]
    elif (target_dir / "app.py").exists() or (target_dir / "main.py").exists():
        script = "app.py" if (target_dir / "app.py").exists() else "main.py"
        run_cmd = ["python", script]
    elif (target_dir / "index.html").exists():
        port = get_free_port()
        run_cmd = ["python", "-m", "http.server", str(port)]
        p = subprocess.Popen(run_cmd, cwd=str(target_dir))
        RUNNING_APPS[ticket_key] = {"process": p, "port": port}
        return {"url": f"http://localhost:{port}"}
        
    if not run_cmd:
        raise HTTPException(status_code=400, detail="Could not determine how to run this app (no server.js, app.py, or index.html)")
        
    port = get_free_port()
    env = os.environ.copy()
    env["PORT"] = str(port)
    
    print(f"[webapp] Starting preview on port {port} with command: {' '.join(run_cmd)}")
    p = subprocess.Popen(run_cmd, cwd=str(target_dir), env=env)
    RUNNING_APPS[ticket_key] = {"process": p, "port": port}
    
    # Wait a tiny bit to check if it crashed instantly
    import time
    time.sleep(1.5)
    if p.poll() is not None:
        raise HTTPException(status_code=500, detail=f"App crashed immediately upon starting (exit code {p.returncode}). Please check code constraints.")
    
    return {"url": f"http://localhost:{port}"}


@app.get("/")
def index():
    if os.path.exists("frontend/dist/index.html"):
        return FileResponse("frontend/dist/index.html")
    raise HTTPException(status_code=404, detail="React build not found. Please run 'npm run build' inside frontend folder.")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("WEBAPP_PORT", 8000))
    print(f"[webapp] Running at http://localhost:{port}")
    uvicorn.run("webapp:app", host="0.0.0.0", port=port, reload=True)
