import json
import os
from pathlib import Path
from portkey_client import call_llm


OUTPUT_DIR = Path("output")

SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", "coverage", ".pytest_cache",
}

SUPPORTED_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go",
    ".rs", ".cs", ".cpp", ".c", ".rb", ".php", ".swift",
}


def _cache_file_for(repo_path: str) -> Path:
    """Returns a unique cache file path per repo."""
    safe_name = Path(repo_path).name.replace(" ", "_")
    return OUTPUT_DIR / f".stack_cache_{safe_name}.json"

STACK_EXTRACTION_PROMPT = """Analyze the following code samples from an existing project.
Extract the tech stack being used.

Return ONLY a valid JSON object in this exact format (no extra text):
{
  "language": "python",
  "framework": "fastapi",
  "database": "postgresql",
  "orm": "sqlalchemy",
  "auth": "jwt",
  "other_libraries": ["pydantic", "bcrypt"],
  "conventions": [
    "uses dependency injection for DB sessions",
    "Pydantic schemas for request/response validation",
    "services/ layer for business logic"
  ],
  "file_structure": "routers/, models/, services/, schemas/"
}

If something is not detectable, use null for that field.

Code samples:
"""


def _collect_code_samples(repo_path: str, max_files: int = 8, max_chars: int = 800) -> list[dict]:
    """Scans a real repo directory or output/ folder for source file samples."""
    base = Path(repo_path)
    if not base.exists():
        return []

    samples = []

    # if it's the local output folder, scan run subdirectories
    if base == OUTPUT_DIR:
        for run_dir in sorted(base.iterdir(), reverse=True):
            if not run_dir.is_dir() or run_dir.name.startswith("."):
                continue
            for code_file in run_dir.iterdir():
                if code_file.suffix in (".md", ".json") or code_file.name.startswith("."):
                    continue
                try:
                    content = code_file.read_text(encoding="utf-8")
                    samples.append({"filename": code_file.name, "content": content[:max_chars]})
                    if len(samples) >= max_files:
                        return samples
                except Exception:
                    continue
        return samples

    # scan a real repo
    for file in sorted(base.rglob("*")):
        if any(skip in file.parts for skip in SKIP_DIRS):
            continue
        if file.suffix not in SUPPORTED_EXTENSIONS:
            continue
        if not file.is_file():
            continue
        try:
            content = file.read_text(encoding="utf-8", errors="ignore")
            if len(content.strip()) < 50:
                continue
            samples.append({
                "filename": str(file.relative_to(base)),
                "content": content[:max_chars],
            })
            if len(samples) >= max_files:
                break
        except Exception:
            continue

    return samples


def _extract_stack_via_llm(samples: list[dict]) -> dict:
    """Sends code samples to LLM and extracts the tech stack as JSON."""
    samples_text = "\n\n---\n\n".join(
        f"File: {s['filename']}\n{s['content']}" for s in samples
    )

    raw = call_llm(
        system_prompt="You are a code analysis assistant. Always respond with valid JSON only. No markdown, no explanation.",
        user_prompt=STACK_EXTRACTION_PROMPT + samples_text,
        agent="analyst",
        metadata={"task": "stack_detection"},
    )

    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip().rstrip("```").strip()

    return json.loads(raw)


def _save_cache(stack: dict, repo_path: str) -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    _cache_file_for(repo_path).write_text(json.dumps(stack, indent=2), encoding="utf-8")


def _load_cache(repo_path: str) -> dict | None:
    cache_file = _cache_file_for(repo_path)
    if cache_file.exists():
        try:
            return json.loads(cache_file.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None


def get_project_stack(force_refresh=False, run_dir: str = None):
    """
    Detect the tech stack for a specific application folder.

    - run_dir  : path to the specific app folder being modified (e.g. "output/ASK-769-770").
                 When None (new application), returns None immediately so the LLM
                 picks the best stack freely.
    """
    if not run_dir:
        # New application — don't impose a stack from an unrelated existing app
        print(f"[context] New application — LLM will choose best stack")
        return None

    samples = _collect_code_samples(run_dir)

    if not samples:
        print(f"[context] No code samples found in {run_dir} — LLM will choose best stack")
        return None

    cached = _load_cache(run_dir)
    if cached and not force_refresh:
        print(f"[context] Using cached stack for {run_dir}: {cached.get('language')} / {cached.get('framework')}")
        return cached

    print(f"[context] Detecting stack from {run_dir} ({len(samples)} files scanned)...")
    try:
        stack = _extract_stack_via_llm(samples)
        _save_cache(stack, run_dir)
        print(f"[context] Stack detected: {stack.get('language')} / {stack.get('framework')}")
        return stack
    except Exception as e:
        print(f"[context] Stack detection failed ({e}) — LLM will choose best stack")
        return None


def format_stack_for_prompt(stack, run_dir: str = None) -> str:
    """
    Format stack + flowcharts for the Analyst prompt.

    - stack    : dict returned by get_project_stack(), or None.
    - run_dir  : the specific app folder being modified.  Only flowcharts
                 inside that folder are included.  When None (new app)
                 no flowcharts are injected.
    """
    lines = []

    if stack:
        lines.append("## Existing Project Stack (follow this for the files you are modifying)")
        if stack.get("language"):
            lines.append(f"- Language: {stack['language']}")
        if stack.get("framework"):
            lines.append(f"- Framework: {stack['framework']}")
        if stack.get("database"):
            lines.append(f"- Database: {stack['database']}")
        if stack.get("orm"):
            lines.append(f"- ORM: {stack['orm']}")
        if stack.get("auth"):
            lines.append(f"- Auth: {stack['auth']}")
        if stack.get("other_libraries"):
            lines.append(f"- Libraries: {', '.join(stack['other_libraries'])}")
        if stack.get("file_structure"):
            lines.append(f"- File structure: {stack['file_structure']}")
        if stack.get("conventions"):
            lines.append(f"- Conventions: {', '.join(stack['conventions'])}")

    # Only load flowcharts from the specific app being modified.
    # Injecting flowcharts from OTHER apps confuses the LLM into thinking
    # it should reuse or modify those unrelated components.
    if run_dir:
        flowchart_contents = []
        app_dir = Path(run_dir)
        if app_dir.exists():
            for md_file in sorted(app_dir.glob("flowchart_*.md")):
                try:
                    content = md_file.read_text(encoding="utf-8")
                    flowchart_contents.append(f"### {md_file.name}\n{content}")
                except Exception:
                    pass
        if flowchart_contents:
            lines.append("\n## Architecture of the Application You Are Modifying")
            lines.append("Use these flowcharts to understand the EXISTING structure before adding or changing anything:\n")
            lines.append("\n\n".join(flowchart_contents))

    return "\n".join(lines)