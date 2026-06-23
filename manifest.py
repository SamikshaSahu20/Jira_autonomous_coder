import json
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

    for entry in manifest:
        if entry["filename"] == filename:
            entry.update({"last_modified": datetime.now().isoformat(), "last_story": story, "run_dir": run_dir, "summary": summary})
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


def format_manifest_for_prompt():
    manifest = load_manifest()
    if not manifest:
        return ""

    lines = ["## Already Generated Files (check before creating anything new)"]
    lines.append("Decide for each: MODIFY existing or CREATE new?\n")
    for e in manifest:
        lines.append(f"- **{e['filename']}** - {e['summary']}")
        lines.append(f"  Created by: \"{e['story']}\"")
    lines.append("\nIn your PLAN section, state CREATE or MODIFY for each file and why.")
    return "\n".join(lines)
