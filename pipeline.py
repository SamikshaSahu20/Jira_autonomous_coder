"""
pipeline.py — Run the code generator across all stories in a sprint.

Usage:
    python pipeline.py --sprint <sprint_id>
    python pipeline.py --board  <board_id>       # uses active sprint
    python pipeline.py --sprint <id> --dry-run   # print stories, don't generate
"""

import argparse
import json
import os
import sys
import re
from pathlib import Path
from datetime import datetime

from jira_reader import (
    get_sprint_stories, get_sprint_by_board, build_prompt_from_story,
    add_jira_comment, transition_jira_issue
)
from generate  import generate_code, save_output


# ── Helpers ───────────────────────────────────────────────────────────────────

HISTORY_FILE = Path("output/pipeline_history.json")


def load_history() -> list:
    if HISTORY_FILE.exists():
        text = HISTORY_FILE.read_text().strip()
        if not text:
            return []
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return []
    return []


def save_history(history: list):
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    HISTORY_FILE.write_text(json.dumps(history, indent=2))


def record_run(sprint_id, sprint_name, story, files_saved):
    # History tracking is now in manifest.json - no separate pipeline history needed
    pass


def get_full_explanation(response: str) -> str:
    """Use AI to generate a dynamic, ticket-specific summary for Jira comments."""
    from portkey_client import call_llm
    system_prompt = (
        "You are an assistant that writes concise, professional Jira comments summarizing code generation results. "
        "Keep it to 2-3 bullet points of what was actually changed or generated. "
        "Do NOT output markdown code blocks. Keep it simple and clear."
    )
    user_prompt = (
        "Based on the following AI code generation response, write a short summary of the key improvements and files changed.\n\n"
        f"Response:\n{response[:3000]}\n\n" # Truncate to first 3000 chars to save tokens
        "Summary format:\n"
        "✅ **Code Generation Complete**\n\n"
        "**Key Changes:**\n"
        "- [bullet 1]\n"
        "- [bullet 2]\n\n"
        "**Next Steps:**\n"
        "1. Review the generated code\n"
        "2. Run tests locally\n"
        "3. Raise a Pull Request for validation"
    )
    
    try:
        comment = call_llm(system_prompt=system_prompt, user_prompt=user_prompt, agent="analyst", temperature=0.3)
        return comment.strip()
    except Exception as e:
        print(f"[pipeline] Failed to generate AI comment, falling back to regex: {e}")
        # Fallback logic
        match = re.search(r"## EXPLANATION\s*\n(.*?)(?=##|$)", response, re.DOTALL)
        if match:
            raw_text = match.group(1).strip()
            clean_text = re.sub(r"```.*?```", "", raw_text, flags=re.DOTALL).strip()
            clean_text = re.sub(r"\*\*.*?\*\*", "", clean_text).strip()
            return clean_text.splitlines()[0].strip() if clean_text else "Code generation completed successfully"
        return "Code generation completed successfully"


# ── Core pipeline ─────────────────────────────────────────────────────────────

def run_pipeline(sprint_id: int, sprint_name: str = "", dry_run: bool = False, model: str = None):
    print(f"\n{'='*60}")
    print(f"  Sprint: {sprint_name or sprint_id}")
    print(f"{'='*60}\n")

    try:
        stories = get_sprint_stories(sprint_id)
    except Exception as e:
        print(f"[pipeline] ✗ ERROR fetching stories: {e}")
        return

    if not stories:
        print("[pipeline] No stories found in sprint.")
        return

    print(f"[pipeline] Found {len(stories)} stories\n")

    for i, story in enumerate(stories, 1):
        ticket  = story["ticket"]
        summary = story["summary"]
        status  = story["status"]
        print(f"[{i}/{len(stories)}] {ticket} (Status: {status}): {summary}")

        if status.lower() != "in progress":
            print(f"  → Skipping (Ticket is not 'In Progress')\n")
            continue

        if dry_run:
            print(f"  [dry-run] Would generate code for: {ticket}")
            continue

        try:
            print(f"  → Building prompt...")
            prompt   = build_prompt_from_story(story)
            
            print(f"  → Generating code...")
            response = generate_code(prompt, ticket=ticket, model=model)
            
            # Validate response
            if not response or not isinstance(response, str):
                raise Exception(f"Invalid response from AI: {type(response)} (expected string)")
            
            if response.strip() == "":
                raise Exception("LLM returned empty response")
            
            # Additional check: If response from LLM implies an error and doesn't contain a CODE block, throw exception
            if "## CODE" not in response and "```" not in response:
                 raise Exception("LLM returned an invalid or completely empty code response")

            print(f"  → Saving output...")
            run_dir  = save_output(prompt, response, ticket=ticket)
            files    = [f.name for f in run_dir.iterdir() if f.suffix != ".md"]
            print(f"  ✓ Saved {len(files)} file(s): {', '.join(files)}")
            
            # Post Jira Comment & Update Status
            print(f"  → Extracting summary...")
            comment_text = get_full_explanation(response)
            
            print(f"  → Updating Jira...")
            add_jira_comment(ticket, comment_text)
            transition_jira_issue(ticket, "In Review")
            
            record_run(sprint_id, sprint_name, story, files)
            print(f"  ✓ {ticket} complete!\n")
            
        except json.JSONDecodeError as e:
            print(f"  ✗ JSON ERROR on {ticket}: {e}")
            print(f"     (API response was empty or malformed)")
            record_run(sprint_id, sprint_name, story, [f"JSON_ERROR: {e}"])
            continue
        except Exception as e:
            print(f"  ✗ ERROR on {ticket}: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            record_run(sprint_id, sprint_name, story, [f"ERROR: {e}"])
            continue

    print(f"\n[pipeline] Done.")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Run auto-coder pipeline for a Jira sprint")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--sprint", type=int, help="Jira sprint ID")
    group.add_argument("--board",  type=int, help="Jira board ID — uses active sprint")
    parser.add_argument("--model",   default=None, help="Override LLM model")
    parser.add_argument("--dry-run", action="store_true", help="List stories without generating code")
    args = parser.parse_args()

    if args.board:
        from jira_reader import get_sprint_by_board
        sprint = get_sprint_by_board(args.board)
        if not sprint:
            print(f"ERROR: No active sprint found for board {args.board}")
            sys.exit(1)
        sprint_id   = sprint["id"]
        sprint_name = sprint.get("name", "")
        print(f"[pipeline] Active sprint: {sprint_name} (id={sprint_id})")
    else:
        sprint_id   = args.sprint
        sprint_name = f"sprint-{sprint_id}"

    run_pipeline(sprint_id, sprint_name, dry_run=args.dry_run, model=args.model)


if __name__ == "__main__":
    main()
