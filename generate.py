import re
import sys
import shutil
import argparse
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from portkey_client import call_llm
from context_analyzer import get_project_stack, format_stack_for_prompt
from manifest import format_manifest_for_prompt, add_to_manifest, load_manifest, save_manifest

load_dotenv()


def refine_requirements(prompt: str, ticket: str = "custom", model: str = None, force_refresh: bool = False) -> str:
    stack = get_project_stack(force_refresh=force_refresh)
    stack_context = format_stack_for_prompt(stack)
    manifest_context = format_manifest_for_prompt()

    system_prompt = f"""You are an elite Software Architect and Business Analyst.
Your task is to take a (potentially vague) Jira ticket and the current project context, and output a highly detailed, extremely strict development prompt/specification for a Coder Agent.

{stack_context}

{manifest_context}

If no existing stack is specified above, choose the best language and framework
for the task and state your choice.

Output ONLY the detailed development prompt that exactly specifies what files to create or modify, the architecture to follow, and the logic required. Do NOT write code. Write the comprehensive specification.
Make sure to format the specification with sections like:
## ANALYSIS
## PLAN (for each file: CREATE or MODIFY, filename, reason)"""

    print(f"[generate] Existing files in manifest: {manifest_context.count('**') // 2}")
    
    return call_llm(
        system_prompt=system_prompt,
        user_prompt=f"Jira Ticket / Task:\n{prompt}",
        agent="analyst",
        model=model,
        metadata={"task": "refine_requirements", "stack_detected": bool(stack)},
    )


def generate_source_code(refined_prompt: str, model: str = None) -> str:
    system_prompt = """You are an elite Senior Full-Stack Software Engineer who writes code that RUNS PERFECTLY on first execution.

Based on the provided specification, generate the EXACT source code needed.

== ABSOLUTE RULES -- NEVER VIOLATE ==
1. ALL files must be placed in a FLAT directory (no subdirectories like ./routes/ or ./controllers/). Use require('./feedbackRoutes') not require('./routes/feedbackRoutes').
2. If the backend uses a database (MongoDB, PostgreSQL etc.), the Express server MUST start listening IMMEDIATELY regardless of DB connection status. Use this exact pattern:
   ```
   app.listen(process.env.PORT || 3000, () => console.log('Server on port ' + (process.env.PORT || 3000)));
   mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/app')
     .then(() => console.log('DB connected')).catch(e => console.warn('DB not available:', e.message));
   ```
3. NEVER use deprecated Mongoose options (no useNewUrlParser, no useUnifiedTopology).
4. The Express server MUST serve a complete, self-contained index.html at GET / using express.static or res.sendFile. The index.html must visually demonstrate the full UI with HTML/CSS/vanilla JS -- NO React build step required for preview.
5. The index.html frontend MUST make API calls to the Express backend routes using fetch().
6. Use process.env.PORT for the server port, defaulting to 3000.
7. Generate 100% accurate, bug-free code. No placeholders.

Write every file as a SEPARATE code block. Each block MUST start with a comment on the very first line containing the exact filename.

## CODE
```javascript
// server.js
<complete code here>
```

```html
<!-- index.html -->
<complete self-contained UI here>
```
"""
    return call_llm(
        system_prompt=system_prompt,
        user_prompt=f"Specification:\n{refined_prompt}",
        agent="coder",
        model=model,
    )


def validate_and_test_code(refined_prompt: str, source_code: str, ticket: str = "custom", model: str = None) -> str:
    system_prompt = f"""You are a Senior QA Engineer and Code Reviewer.
Your EXACT tasks (in order):
1. Review the generated source code for 100% accuracy. FIX all bugs.

== ABSOLUTE RULES WHEN FIXING CODE -- NEVER VIOLATE ==
- ALL files MUST be in a FLAT directory. If any require() uses a subdirectory (e.g. './routes/x'), move that file to root and fix the require to './x'.
- The Express server MUST call app.listen() IMMEDIATELY and unconditionally. DB connection (mongoose/postgres) must be fire-and-forget using .catch(). NEVER gate app.listen inside .then().
- NEVER use deprecated Mongoose options (useNewUrlParser, useUnifiedTopology).
- The app MUST include a self-contained index.html served at GET / that visually demonstrates the UI using plain HTML/CSS/vanilla JS + fetch() calls to the backend.
- Use process.env.PORT with a numeric fallback (e.g. 3000).

2. Fix any bugs, edge cases, ARIA accessibility issues, vulnerabilities, or missing logic.
3. Write comprehensive test cases to PROVE 100% accuracy.
4. **MANDATORY:** Create a Mermaid.js flowchart showing every component and function as graph nodes with click links.
   Save as `flowchart_{ticket}.md` in a markdown code block with an HTML comment header `<!-- flowchart_{ticket}.md -->`.

Output format:

## CODE
```javascript
// FileName.js
<complete fixed source code>
```

```markdown
<!-- flowchart_{ticket}.md -->
# System Architecture & Function Map
```mermaid
graph TD
    A["server.js - Main"]
    B["route(req,res)"]
    A --> B
    click A "server.js#L1" "Open server.js"
```
```

## EXPLANATION
<2-4 sentences: what was reviewed, what bugs were fixed.>

## METRICS
Bugs Found: <number>
Bugs Fixed: <number>
"""
    return call_llm(
        system_prompt=system_prompt,
        user_prompt=f"Specification:\n{refined_prompt}\n\nGenerated Source Code:\n{source_code}",
        agent="tester",
        model=model,
    )


def generate_code(prompt: str, ticket: str = "custom", model: str = None, force_refresh: bool = False) -> str:
    import time
    try:
        t0 = time.time()
        print(f"[generate] Agent 1 (Analyst) refining requirements from Jira...")
        refined_prompt = refine_requirements(prompt, ticket, model, force_refresh)
        t1 = time.time()
        
        if not refined_prompt or refined_prompt.strip() == "":
            raise Exception("Analyst agent returned empty response")
        print(f"[generate] OK Analyst complete ({len(refined_prompt)} chars) in {t1-t0:.1f}s")
        
        print(f"[generate] Agent 2 (Coder) generating source code...")
        source_code = generate_source_code(refined_prompt, model)
        t2 = time.time()
        
        if not source_code or source_code.strip() == "":
            raise Exception("Coder agent returned empty response")
        print(f"[generate] OK Coder complete ({len(source_code)} chars) in {t2-t1:.1f}s")
        
        print(f"[generate] Agent 3 (Tester/Reviewer) validating, fixing, outputting tests and flowcharts...")
        final_output = validate_and_test_code(refined_prompt, source_code, ticket, model)
        t3 = time.time()
        
        if not final_output or final_output.strip() == "":
            raise Exception("Tester agent returned empty response")
        print(f"[generate] OK Tester complete ({len(final_output)} chars) in {t3-t2:.1f}s")
        
        # Inject timings into final_output so save_output can parse it implicitly
        timings = f"\n\n```json\n// timings.json\n{{\"analyst\": {t1-t0}, \"coder\": {t2-t1}, \"tester\": {t3-t2}}}\n```\n"
        
        return final_output + timings
    except Exception as e:
        print(f"[generate] X CRITICAL ERROR: {type(e).__name__}: {e}")
        raise


CODE_BLOCK_RE = re.compile(r"```(\w+)?\n([\s\S]*?)```")


def extract_code_block(response: str) -> tuple[str, str]:
    """
    Extracts the largest code block from the response (used only for preview).
    Returns (code, language).
    """
    matches = CODE_BLOCK_RE.findall(response)
    if not matches:
        return response, "txt"
    language, code = max(matches, key=lambda m: len(m[1]))
    return code.strip(), language.strip() if language else "txt"


def extract_all_code_blocks(response: str) -> list[dict]:
    """
    Extracts ALL code blocks from the response.
    Each block is returned as { filename, language, code }.
    Filename is read from the first-line comment inside the block.
    Falls back to generated_code_N.<ext> if no filename comment found.
    """
    matches = CODE_BLOCK_RE.findall(response)
    results = []

    for i, (language, code) in enumerate(matches):
        code = code.strip()
        language = language.strip() if language else "txt"
        ext = EXTENSION_MAP.get(language.lower(), "txt")

        # try to read filename from first line comment
        first_line = code.splitlines()[0] if code else ""
        filename_match = re.search(r"[\w./\\-]+\.\w+", first_line)
        if filename_match:
            filename = Path(filename_match.group()).name
            # strip the filename comment line from the actual code
            code = "\n".join(code.splitlines()[1:]).strip()
        else:
            filename = f"generated_code_{i + 1}.{ext}" if i > 0 else f"generated_code.{ext}"

        results.append({"filename": filename, "language": language, "code": code})

    return results if results else [{"filename": "generated_code.txt", "language": "txt", "code": response}]


EXTENSION_MAP = {
    "python": "py", "py": "py",
    "javascript": "js", "js": "js",
    "typescript": "ts", "ts": "ts",
    "java": "java",
    "go": "go",
    "rust": "rs",
    "cpp": "cpp", "c++": "cpp",
    "c": "c",
    "bash": "sh", "shell": "sh",
    "sql": "sql",
    "html": "html",
    "css": "css",
    "json": "json",
    "yaml": "yaml", "yml": "yaml",
}


def _extract_summary(response: str) -> str:
    """Pulls the EXPLANATION section as a one-line summary for the manifest."""
    match = re.search(r"## EXPLANATION\s*\n(.*)", response)
    if match:
        return match.group(1).strip()[:120]
    # fallback: first non-empty line of ANALYSIS
    match = re.search(r"## ANALYSIS\s*\n(.*)", response)
    if match:
        return match.group(1).strip()[:120]
    return "No summary available"


def _extract_flowchart(response: str) -> str:
    """Extracts the flowchart from the response between ```mermaid markers."""
    match = re.search(r"```mermaid\s*\n([\s\S]*?)```", response)
    if match:
        return match.group(1).strip()
    return None



def determine_run_dir(ticket: str, prompt: str, manifest: list) -> Path:
    """Intelligently determines whether to merge into an existing folder or create a new one."""
    if not manifest or not ticket:
        return None
        
    unique_run_dirs = {}
    for entry in manifest:
        rdir = entry.get("run_dir")
        if rdir and Path(rdir).exists():
            ticket_names = re.findall(r'[A-Z]+-\d+', Path(rdir).name)
            if rdir not in unique_run_dirs:
                unique_run_dirs[rdir] = {
                    "tickets": ticket_names,
                    "files": set(),
                    "descriptions": set()
                }
            unique_run_dirs[rdir]["files"].add(entry.get("filename"))
            if entry.get("summary"):
                unique_run_dirs[rdir]["descriptions"].add(entry["summary"])

    if not unique_run_dirs:
        return None

    # Step 1: Check explicit ticket references in prompt
    prompt_upper = prompt.upper()
    for rdir, info in unique_run_dirs.items():
        for t in info["tickets"]:
            if t != ticket.upper() and t in prompt_upper:
                print(f"[generate] Found explicit reference to {t} in prompt. Merging into {rdir}.")
                return Path(rdir)

    # Step 2: Use AI to check
    dir_info_str = []
    for rdir, info in unique_run_dirs.items():
        desc = " | ".join(info["descriptions"])[:200]
        files = ", ".join(info["files"])[:200]
        dir_info_str.append(f"Folder: {rdir}\nContained Tickets: {', '.join(info['tickets'])}\nFiles: {files}\nSummary: {desc}\n")
    
    system_prompt = (
        "You are an intelligent routing assistant handling project organization. Your job is to decide whether a new incoming ticket belongs to an EXISTING app folder, or must be isolated in a NEW folder.\n"
        "RULES:\n"
        "1. If the new ticket is part of the SAME overall application, project, microservice, or system as an existing folder (e.g., adding a dashboard to an app that already has login), return the EXISTING folder path.\n"
        "2. ONLY return 'NEW' if the ticket describes a completely different, unrelated application.\n"
        "3. When in doubt about relation, ALWAYS prefer merging it into the existing folder to keep projects consolidated.\n"
        "Output ONLY the exact folder path if it's an existing folder, or 'NEW' if it must be completely isolated."
    )
    user_prompt = (
        f"New Ticket: {ticket}\n"
        f"Ticket Description or Data:\n{prompt[:2000]}\n\n"
        "Existing Folders:\n" + "\n".join(dir_info_str) +
        "\nIs this new ticket part of the same application/project as one of the existing folders, or is it a fully isolated app? "
        "Return the EXACT EXISTING FOLDER NAME (e.g., 'output/ASK-769') if it should be merged, otherwise return 'NEW'."
    )
    
    try:
        from portkey_client import call_llm
        print(f"[generate] Asking AI to route folder for {ticket}...")
        decision = call_llm(system_prompt=system_prompt, user_prompt=user_prompt, agent="analyst", temperature=0.1).strip()
        decision = decision.strip("`'\" \n")
        print(f"[generate] AI routing decision: {decision}")
        
        # We need to map back to the actual string form of the dir, in case of path separator differences
        normalized_decision = decision.replace("\\", "/")
        for rdir in unique_run_dirs:
            if rdir.replace("\\", "/") == normalized_decision or rdir == decision:
                return Path(rdir)
    except Exception as e:
        print(f"[generate] Folder routing AI check failed: {e}")
        
    return None


def save_output(prompt: str, response: str, ticket: str = None) -> Path:
    blocks = extract_all_code_blocks(response)
    manifest = load_manifest()
    
    # 1. Determine if we are updating an existing application folder using AI routing
    existing_run_dir = determine_run_dir(ticket, prompt, manifest)

    run_dir = None
    if existing_run_dir and ticket:
        old_name = existing_run_dir.name
        ticket_upper = ticket.upper()
        
        # Avoid appending the same ticket multiple times
        if ticket_upper not in old_name.upper():
            match = re.search(r'\d+', ticket_upper)
            suffix = f"-{match.group()}" if match else f"-{ticket_upper}"
            new_name = old_name + suffix
            new_dir = existing_run_dir.parent / new_name
            
            try:
                existing_run_dir.rename(new_dir)
                run_dir = new_dir
                
                # Update manifest specifically so older untouched files also point to the new folder
                for entry in manifest:
                    if entry.get("run_dir") == str(existing_run_dir):
                        entry["run_dir"] = str(new_dir)
                save_manifest(manifest)
                print(f"[generate] Renamed application folder: {old_name} -> {new_name}")
            except Exception as e:
                print(f"[generate] Error renaming folder: {e}")
                run_dir = existing_run_dir
        else:
            run_dir = existing_run_dir
    else:
        folder_name = ticket.upper() if ticket else f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        run_dir = Path("output") / folder_name
        run_dir.mkdir(parents=True, exist_ok=True)

    # 2. Skip saving full response - only generate flowchart and code files

    saved_files = []

    for block in blocks:
        filename = block["filename"]
        code = block["code"].strip()
        
        # Skip empty code blocks
        if not code:
            continue

        code_file = run_dir / filename
        code_file.write_text(code, encoding="utf-8")
        saved_files.append(filename)

        # Try to extract a file-specific summary from the first few lines of the code block
        summary = "No summary available"
        for line in code.splitlines():
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("#") or stripped.startswith("<!--"):
                potential_summary = stripped.lstrip("/# ").replace("<!--", "").replace("-->", "").strip()
                # Do not grab basic formatting/filename comments as summary
                if potential_summary and not ".js" in potential_summary and not ".py" in potential_summary and not ".md" in potential_summary and not ".jsx" in potential_summary:
                    summary = potential_summary
                    break
            elif stripped: # if we hit actual code before finding a comment, stop
                break
                
        if summary == "No summary available":
            # If still nothing, identify the file by its extension
            summary = f"Generated {Path(filename).suffix[1:].upper()} component or logic file"

        add_to_manifest(
            story=prompt,
            filename=filename,
            run_dir=str(run_dir),
            summary=summary,
            ticket=ticket,
        )
        print(f"[manifest] Recorded '{filename}' -> {summary[:60]}...")

    # 3. Extract and save flowchart if present
    flowchart = _extract_flowchart(response)
    if flowchart:
        flowchart_filename = f"flowchart_{ticket}.md" if ticket else "flowchart.md"
        flowchart_file = run_dir / flowchart_filename
        flowchart_content = f"# System Architecture & Function Map\n\n```mermaid\n{flowchart}\n```"
        flowchart_file.write_text(flowchart_content, encoding="utf-8")
        saved_files.append(flowchart_filename)
        print(f"[flowchart] Generated: {flowchart_filename}")

    # 4. Extract metrics
    import json
    metrics = {"bugs_found": 0, "bugs_fixed": 0}
    found_match = re.search(r"Bugs Found:\s*(\d+)", response)
    fixed_match = re.search(r"Bugs Fixed:\s*(\d+)", response)
    if found_match: metrics["bugs_found"] = int(found_match.group(1))
    if fixed_match: metrics["bugs_fixed"] = int(fixed_match.group(1))
    
    (run_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    # 5. Programmatically generate run scripts and README (fast, no LLM)
    _generate_run_scripts(run_dir, ticket)

    print(f"[done]     {len(saved_files)} file(s) saved: {', '.join(saved_files)}")
    return run_dir


def _generate_run_scripts(run_dir: Path, ticket: str = ""):
    """Generate run.sh, run.bat and README.md without an LLM call."""
    # Detect entry point
    entry = "server.js"
    for candidate in ["server.js", "index.js", "app.js", "main.js"]:
        if (run_dir / candidate).exists():
            entry = candidate
            break

    # Detect language (Python vs Node)
    py_files = list(run_dir.glob("*.py"))
    is_python = len(py_files) > 0 and not (run_dir / "package.json").exists()

    if is_python:
        py_entry = py_files[0].name
        run_sh  = f"#!/bin/bash\npip install -r requirements.txt 2>/dev/null || true\nPORT=${{PORT:-3000}} python {py_entry}\n"
        run_bat = f"@echo off\npip install -r requirements.txt\nset PORT=%PORT:-=3000%\npython {py_entry}\n"
    else:
        run_sh  = f"#!/bin/bash\nnpm install\nPORT=${{PORT:-3000}} node {entry}\n"
        run_bat = f"@echo off\nnpm install\nif not defined PORT set PORT=3000\nnode {entry}\n"

    (run_dir / "run.sh").write_text(run_sh, encoding="utf-8")
    (run_dir / "run.bat").write_text(run_bat, encoding="utf-8")

    # README
    files_list = "\n".join(f"- `{f.name}`" for f in sorted(run_dir.iterdir()) if f.suffix not in (".json",))
    readme = f"""# {ticket or run_dir.name}

Auto-generated by the Jira Autonomous Coder pipeline.

## Files
{files_list}

## Quick Start

**Linux / macOS:**
```bash
chmod +x run.sh && ./run.sh
```

**Windows:**
```bat
run.bat
```

Or manually:
```bash
{"pip install -r requirements.txt" if is_python else "npm install"}
{"python " + (py_files[0].name if py_files else "app.py") if is_python else "node " + entry}
```

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Port the server listens on |
{"| MONGO_URI | mongodb://localhost:27017/app | MongoDB connection string |" if (run_dir / "server.js").exists() else ""}

Open [http://localhost:3000](http://localhost:3000) in your browser.
"""
    (run_dir / "README.md").write_text(readme, encoding="utf-8")
    print(f"[generate] OK run.sh / run.bat / README.md generated")


def main():
    parser = argparse.ArgumentParser(
        description="Generate code locally from a prompt using AI"
    )
    parser.add_argument(
        "--prompt", "-p",
        type=str,
        help="The prompt / task description (wrap in quotes)"
    )
    parser.add_argument(
        "--ticket", "-t",
        type=str,
        default=None,
        help="Jira ticket key used as folder name (e.g. ASK-403)"
    )
    parser.add_argument(
        "--model", "-m",
        type=str,
        default=None,
        help="Override LLM model (default: uses AGENT_MODELS['coder'] in portkey_client.py)"
    )
    parser.add_argument(
        "--refresh", "-r",
        action="store_true",
        help="Force re-detection of project stack (ignores cache)"
    )
    args = parser.parse_args()

    if args.prompt:
        prompt = args.prompt
    else:
        print("=" * 60)
        print("  Auto Coder -- Local Code Generator")
        print("=" * 60)
        print("Describe what you want to build (press Enter twice when done):\n")
        lines = []
        while True:
            line = input()
            if line == "" and lines and lines[-1] == "":
                break
            lines.append(line)
        prompt = "\n".join(lines).strip()

    if not prompt:
        print("ERROR: No prompt provided.")
        sys.exit(1)

    response = generate_code(prompt, model=args.model, force_refresh=args.refresh)
    output_dir = save_output(prompt, response, ticket=args.ticket)

    print(f"\n[done] Output saved to: {output_dir.resolve()}")
    print(f"       Full response:   {output_dir.resolve()}\\response.md")

    code, language = extract_code_block(response)
    print(f"\n{'=' * 60}")
    print(f"  Generated Code Preview ({language})")
    print("=" * 60)
    preview_lines = code.splitlines()[:30]
    print("\n".join(preview_lines))
    if len(code.splitlines()) > 30:
        print(f"... ({len(code.splitlines()) - 30} more lines in file)")


if __name__ == "__main__":
    main()
