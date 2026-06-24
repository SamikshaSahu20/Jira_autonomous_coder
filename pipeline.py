"""
pipeline.py -- Run the code generator across all stories in a sprint.

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
import threading
from pathlib import Path
from datetime import datetime

from jira_reader import (
    get_sprint_stories, get_sprint_by_board, build_prompt_from_story,
    add_jira_comment, transition_jira_issue
)
from generate  import generate_code, save_output


# -- Helpers -------------------------------------------------------------------

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
    """Agent 4 (Reviewer): Analyzes the generated code and posts a structured code review summary to Jira."""
    from portkey_client import call_llm
    system_prompt = (
        "You are an expert AI Code Reviewer. Your task is to genuinely analyze the provided code "
        "and provide an authentic, objective code review summary to be posted in Jira. "
        "Read the code carefully and provide real feedback based on what you actually see. "
        "You MUST output exactly and only in this format, replacing the bracketed text with your real analysis, without markdown code block wrappers:\n\n"
        "💻 *Code Review Summary*\n"
        "- *Security*: [Write your actual findings regarding security, vulnerabilities, or hardcoded secrets]\n"
        "- *Complexity*: [Write your actual assessment of the code's complexity, structure, and maintainability]\n"
        "- *Suggestions*: [Write any real, practical suggestions for improvement or refactoring. If none, say so.]"
    )
    user_prompt = (
        "Based on the following AI-generated code response, write the structured code review summary.\n\n"
        f"Generated Code:\n{response[:4000]}\n" # Truncate to first 4000 chars
    )
    
    try:
        print("  -> Agent 4 (Reviewer) is analyzing the generated code...")
        comment = call_llm(system_prompt=system_prompt, user_prompt=user_prompt, agent="reviewer", temperature=0.3)
        return comment.strip()
    except Exception as e:
        print(f"[pipeline] Failed to generate AI review comment, falling back to regex: {e}")
        # Fallback logic
        match = re.search(r"## EXPLANATION\s*\n(.*?)(?=##|$)", response, re.DOTALL)
        if match:
            raw_text = match.group(1).strip()
            clean_text = re.sub(r"```.*?```", "", raw_text, flags=re.DOTALL).strip()
            clean_text = re.sub(r"\*\*.*?\*\*", "", clean_text).strip()
            return clean_text.splitlines()[0].strip() if clean_text else "Code generation completed successfully"
        return "Code generation completed successfully"


# -- Core pipeline -------------------------------------------------------------

def run_pipeline(sprint_id: int, sprint_name: str = "", dry_run: bool = False, model: str = None):
    print(f"\n{'='*60}")
    print(f"  Sprint: {sprint_name or sprint_id}")
    print(f"{'='*60}\n")

    try:
        stories = get_sprint_stories(sprint_id)
    except Exception as e:
        print(f"[pipeline] X ERROR fetching stories: {e}")
        return

    if not stories:
        print("[pipeline] No stories found in sprint.")
        return set()

    print(f"[pipeline] Found {len(stories)} stories\n")

    succeeded = set()

    for i, story in enumerate(stories, 1):
        ticket  = story["ticket"]
        summary = story["summary"]
        status  = story["status"]
        print(f"[{i}/{len(stories)}] {ticket} (Status: {status}): {summary}")

        if status.lower() != "in progress":
            print(f"  -> Skipping (Ticket is not 'In Progress')\n")
            continue

        if dry_run:
            print(f"  [dry-run] Would generate code for: {ticket}")
            continue

        try:
            print(f"  -> Building prompt...")
            prompt   = build_prompt_from_story(story)
            
            print(f"  -> Generating code...")
            response = generate_code(prompt, ticket=ticket, model=model)
            
            # Validate response
            if not response or not isinstance(response, str):
                raise Exception(f"Invalid response from AI: {type(response)} (expected string)")
            
            if response.strip() == "":
                raise Exception("LLM returned empty response")
            
            # Additional check: If response from LLM implies an error and doesn't contain a CODE block, throw exception
            if "## CODE" not in response and "```" not in response:
                 raise Exception("LLM returned an invalid or completely empty code response")

            print(f"  -> Saving output...")
            run_dir  = save_output(prompt, response, ticket=ticket)
            files    = [f.name for f in run_dir.iterdir() if f.suffix != ".md"]
            print(f"  OK Saved {len(files)} file(s): {', '.join(files)}")

            # Agent 4 (Reviewer) -- runs in background thread so pipeline continues immediately
            def _run_reviewer(response=response, run_dir=run_dir, ticket=ticket):
                try:
                    import time
                    t4 = time.time()
                    comment_text = get_full_explanation(response)
                    t5 = time.time()
                    reviewer_time = t5 - t4

                    review_file = run_dir / "AI_Review.md"
                    review_file.write_text(comment_text, encoding="utf-8")

                    timings_file = run_dir / "timings.json"
                    if timings_file.exists():
                        try:
                            tdata = json.loads(timings_file.read_text("utf-8"))
                            tdata["reviewer"] = reviewer_time
                            timings_file.write_text(json.dumps(tdata, indent=2), "utf-8")
                        except Exception:
                            pass

                    add_jira_comment(ticket, comment_text)
                    transition_jira_issue(ticket, "In Review")
                    print(f"  OK [Reviewer] {ticket} Jira comment posted ({reviewer_time:.1f}s)")
                except Exception as e:
                    print(f"  X [Reviewer] {ticket} failed: {e}")

            threading.Thread(target=_run_reviewer, daemon=True).start()
            print(f"  -> Reviewer running in background...")

            record_run(sprint_id, sprint_name, story, files)
            succeeded.add(ticket)
            print(f"  OK {ticket} complete!\n")

        except json.JSONDecodeError as e:
            print(f"  X JSON ERROR on {ticket}: {e}")
            print(f"     (API response was empty or malformed)")
            continue
        except Exception as e:
            print(f"  X ERROR on {ticket}: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            continue

    print(f"\n[pipeline] Done. Succeeded: {succeeded}")
    return succeeded


# -- CLI -----------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Run auto-coder pipeline for a Jira sprint")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--sprint", type=int, help="Jira sprint ID")
    group.add_argument("--board",  type=int, help="Jira board ID -- uses active sprint")
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
