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
    system_prompt = """You are an elite Senior Software Engineer.
Based on the provided specification, generate the EXACT source code needed.

CRITICAL Directives:
1. GENERATE 100% ACCURATE AND BUG-FREE CODE. Do NOT produce code that will throw runtime errors, syntax errors, or warning warnings.
2. Provide perfectly functional, production-ready code with absolutely no placeholders.
3. Ensure accessibility labels (like htmlFor/id) are strictly linked.

Write every file as a SEPARATE code block. Each block MUST start with a comment on the very first line containing the filename (e.g. `# login.py`).
Only generate the implementation source code (do NOT write tests yet).

## CODE
```python
# filename.py
<complete code here>
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
1. Review the generated source code for 100% accuracy.
2. Fix any bugs, edge cases, ARIA accessibility issues (like htmlFor/id mismatches), vulnerabilities, or missing logic in the source code.
3. Write comprehensive test cases designed specifically to **PROVE 100% ACCURACY**. Ensure UI elements are selected robustly (e.g., using `getByLabelText` linking with `htmlFor/id` instead of fragile placeholders).
4. **MANDATORY - DO NOT SKIP:** Create a detailed interactive Mermaid.js flowchart showing:
   - Every React component AND EVERY FUNCTION NAME explicitly as their own graph nodes. The text inside the node MUST contain the function name (e.g., `A[functionName (FileName.js)]`)
   - Data flow and specific function calls between components
   - CRITICAL: Use Mermaid click syntax for EVERY function/component: `click functionName "FileName.js#L10" "Navigate to function"`
   Save this as a markdown file named `flowchart_{ticket}.md` inside a markdown code block with HTML comment header.

Output format MUST be:

## CODE
```javascript
// FileName.js
// complete source code here
```

```javascript
// AnotherFile.js
// more source code
```

```markdown
<!-- flowchart_{ticket}.md -->
# System Architecture & Function Map
```mermaid
graph TD
    A["App.js<br/>Main Component"]
    B["ExpenseContext.js<br/>State Management"]
    A --> B
    click A "App.js#L1" "Open App.js"
    click B "ExpenseContext.js#L1" "Open ExpenseContext.js"
    
    C["addExpense(expense)<br/>Adds new expense"]
    B --> C
    click C "ExpenseContext.js#L85" "Go to addExpense function"
    
    D["deleteExpense(id)<br/>Removes expense"]
    B --> D
    click D "ExpenseContext.js#L95" "Go to deleteExpense function"
```
```

## EXPLANATION
<2-4 sentences: What was reviewed, what bugs were fixed, and key improvements made to the code.>
"""
    return call_llm(
        system_prompt=system_prompt,
        user_prompt=f"Specification:\n{refined_prompt}\n\nGenerated Source Code:\n{source_code}",
        agent="tester",
        model=model,
    )


def generate_code(prompt: str, ticket: str = "custom", model: str = None, force_refresh: bool = False) -> str:
    try:
        print(f"[generate] Agent 1 (Analyst) refining requirements from Jira...")
        refined_prompt = refine_requirements(prompt, ticket, model, force_refresh)
        
        if not refined_prompt or refined_prompt.strip() == "":
            raise Exception("Analyst agent returned empty response")
        print(f"[generate] ✓ Analyst complete ({len(refined_prompt)} chars)")
        
        print(f"[generate] Agent 2 (Coder) generating source code...")
        source_code = generate_source_code(refined_prompt, model)
        
        if not source_code or source_code.strip() == "":
            raise Exception("Coder agent returned empty response")
        print(f"[generate] ✓ Coder complete ({len(source_code)} chars)")
        
        print(f"[generate] Agent 3 (Tester/Reviewer) validating, fixing, outputting tests and flowcharts...")
        final_output = validate_and_test_code(refined_prompt, source_code, ticket, model)
        
        if not final_output or final_output.strip() == "":
            raise Exception("Tester agent returned empty response")
        print(f"[generate] ✓ Tester complete ({len(final_output)} chars)")
        
        return final_output
    except Exception as e:
        print(f"[generate] ✗ CRITICAL ERROR: {type(e).__name__}: {e}")
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
        "You are an routing assistant. Decide if the new ticket belongs to one of the EXISTING folders, or should be isolated in a NEW folder.\n"
        "Output ONLY the exact folder path if it's an existing folder, or 'NEW' if it should be isolated."
    )
    user_prompt = (
        f"New Ticket: {ticket}\n"
        f"Ticket Description:\n{prompt[:2000]}\n\n"
        "Existing Folders:\n" + "\n".join(dir_info_str) +
        "\nIs this new ticket a direct continuation/modification of one of the existing folder's applications, or a completely different app/task? "
        "Return the EXACT EXISTING FOLDER NAME (e.g. 'output/ASK-769') if it matches and belongs to the same app, else return 'NEW'."
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
                print(f"[generate] Renamed application folder: {old_name} → {new_name}")
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
        print(f"[manifest] Recorded '{filename}' → {summary[:60]}...")

    # 3. Extract and save flowchart if present
    flowchart = _extract_flowchart(response)
    if flowchart:
        flowchart_filename = f"flowchart_{ticket}.md" if ticket else "flowchart.md"
        flowchart_file = run_dir / flowchart_filename
        flowchart_content = f"# System Architecture & Function Map\n\n```mermaid\n{flowchart}\n```"
        flowchart_file.write_text(flowchart_content, encoding="utf-8")
        saved_files.append(flowchart_filename)
        print(f"[flowchart] Generated: {flowchart_filename}")

    print(f"[done]     {len(saved_files)} file(s) saved: {', '.join(saved_files)}")
    return run_dir


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
        print("  Auto Coder — Local Code Generator")
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
