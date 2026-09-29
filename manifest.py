import json
import re
from datetime import datetime
from pathlib import Path

MANIFEST_FILE = Path("output/manifest.json")


def load_manifest():
    if not MANIFEST_FILE.exists():
        return []
    try:
        text = MANIFEST_FILE.read_text(encoding="utf-8").strip()
        if not text:
            return []
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"[manifest] WARNING: Corrupted manifest.json: {e}")
        print(f"[manifest] Resetting manifest")
        return []
    except Exception as e:
        print(f"[manifest] ERROR loading manifest: {e}")
        return []


def save_manifest(manifest):
    MANIFEST_FILE.parent.mkdir(exist_ok=True)
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def add_to_manifest(story, filename, run_dir, summary, ticket=None):
    manifest = load_manifest()

    # Match by (filename + run_dir) so same-named files from different tickets
    # are tracked as separate entries rather than overwriting each other.
    for entry in manifest:
        if entry["filename"] == filename and entry.get("run_dir") == run_dir:
            entry.update({"last_modified": datetime.now().isoformat(), "last_story": story, "summary": summary})
            if ticket:
                entry["ticket"] = ticket
            save_manifest(manifest)
            return

    manifest.append({
        "filename":      filename,
        "ticket":        ticket,
        "story":         story,
        "last_story":    story,
        "run_dir":       run_dir,
        "summary":       summary,
        "created_at":    datetime.now().isoformat(),
        "last_modified": datetime.now().isoformat(),
    })
    save_manifest(manifest)


def format_manifest_for_prompt(target_run_dir: str = None):
    """
    Returns manifest context for the Analyst prompt.

    - target_run_dir=<path>  →  show only the files belonging to that existing
                                 application (MODIFY workflow).
    - target_run_dir=None    →  this is a NEW application; only show a brief
                                 summary of existing apps so the LLM does NOT
                                 try to modify their files.
    """
    manifest = load_manifest()
    if not manifest:
        return ""

    from collections import defaultdict
    groups = defaultdict(list)
    for e in manifest:
        groups[e.get("run_dir", "unknown")].append(e)

    if target_run_dir:
        # Only show files for the app we are actually modifying
        entries = groups.get(target_run_dir, [])
        if not entries:
            return ""
        lines = [f"## Existing Files to Modify (Application: {target_run_dir})"]
        lines.append("These files already exist in this application. MODIFY them — do NOT recreate from scratch.\n")
        for e in entries:
            lines.append(f"- **{e['filename']}** — {e['summary']}")
        lines.append("\nIn your PLAN section, state MODIFY for each relevant file and why.")
        return "\n".join(lines)
    else:
        # New application — list existing apps only as a reference, NOT as files to modify
        lines = ["## Existing Applications (for reference ONLY — do NOT modify these files)"]
        lines.append("The following separate applications already exist. Your task is a BRAND NEW application.\n")
        for rdir, entries in groups.items():
            ticket_label = entries[0].get("ticket", "unknown")
            filenames = ", ".join(e["filename"] for e in entries[:5])
            extra = f" (+{len(entries)-5} more)" if len(entries) > 5 else ""
            lines.append(f"- **{rdir}** (Ticket: {ticket_label}): {filenames}{extra}")
        lines.append("\nCreate ALL files fresh for this new application. Do NOT reuse or reference any file listed above.")
        return "\n".join(lines)


# Skip these extensions when backfilling — they are not "code" files we track
_SKIP_EXTENSIONS = {".md", ".json", ".sh", ".bat", ".lock"}
_SKIP_NAMES      = {"node_modules", ".git", "__pycache__"}


def backfill_manifest() -> int:
    """
    Scan all output sub-folders and add a manifest entry for every code file
    that is not already tracked under (filename, run_dir).

    Returns the number of entries added.
    """
    output_dir = MANIFEST_FILE.parent
    manifest   = load_manifest()

    # Build a set of already-tracked (filename, run_dir) pairs
    tracked = {
        (e["filename"], e.get("run_dir", "").replace("/", "\\"))
        for e in manifest
    }

    added = 0
    for folder in sorted(output_dir.iterdir()):
        if not folder.is_dir() or folder.name.startswith("."):
            continue
        if folder.name in _SKIP_NAMES:
            continue

        run_dir_str = str(folder)  # e.g. output\ASK-771

        # Derive ticket key from folder name (first ASK-NNN pattern found)
        ticket_keys = re.findall(r"[A-Z]+-\d+", folder.name)
        ticket = ticket_keys[0] if ticket_keys else folder.name

        for code_file in sorted(folder.iterdir()):
            if not code_file.is_file():
                continue
            if code_file.suffix in _SKIP_EXTENSIONS:
                continue
            if code_file.name.startswith("."):
                continue

            key = (code_file.name, run_dir_str)
            if key in tracked:
                continue  # already in manifest

            # Read first meaningful comment line as summary
            summary = f"Generated {code_file.suffix.lstrip('.').upper()} file"
            try:
                for line in code_file.read_text(encoding="utf-8", errors="ignore").splitlines()[:10]:
                    s = line.strip()
                    if s.startswith(("//", "#", "<!--")) and "." not in s[:30]:
                        candidate = s.lstrip("/# ").replace("<!--", "").replace("-->", "").strip()
                        if candidate:
                            summary = candidate[:120]
                            break
            except Exception:
                pass

            manifest.append({
                "filename":      code_file.name,
                "ticket":        ticket,
                "story":         f"Backfilled from {run_dir_str}",
                "last_story":    f"Backfilled from {run_dir_str}",
                "run_dir":       run_dir_str,
                "summary":       summary,
                "created_at":    datetime.now().isoformat(),
                "last_modified": datetime.now().isoformat(),
            })
            tracked.add(key)
            added += 1

    if added:
        save_manifest(manifest)
        print(f"[manifest] Backfilled {added} missing entries.")
    else:
        print("[manifest] Nothing to backfill — manifest is up to date.")

    return added
