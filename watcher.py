import argparse
import json
import time
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from jira_reader import find_sprint_by_name, get_sprint_stories, JIRA_BOARD_ID, AUTO_CODER_SPRINT
from pipeline import run_pipeline

STATE_FILE = Path("output/.watcher_state.json")


def load_state():
    if STATE_FILE.exists():
        text = STATE_FILE.read_text().strip()
        if not text:
            return {}
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {}
    return {}


def save_state(data):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(data, indent=2))


def check_and_trigger():
    try:
        sprint = find_sprint_by_name(JIRA_BOARD_ID, AUTO_CODER_SPRINT)

        if not sprint:
            print(f"[watcher] No sprint matching '{AUTO_CODER_SPRINT}' on board {JIRA_BOARD_ID}")
            return

        sprint_id   = sprint["id"]
        sprint_name = sprint["name"]

        stories = get_sprint_stories(sprint_id)

        # Show all tickets and their statuses
        print(f"[watcher] {datetime.now().strftime('%H:%M:%S')}  '{sprint_name}' — {len(stories)} ticket(s) in sprint:")
        for s in stories:
            print(f"           {s['ticket']}  [{s['status']}]  {s['summary'][:60]}")

        in_progress = [s for s in stories if s["status"].lower() == "in progress"]
        print(f"[watcher] {len(in_progress)} ticket(s) 'In Progress' → running pipeline...")

        if in_progress:
            # Jira status is the source of truth — always run the pipeline for In Progress tickets
            succeeded = run_pipeline(sprint_id, sprint_name) or set()

            state = {
                "last_run": datetime.now().isoformat(),
                "last_processed": sorted(succeeded),
            }
            save_state(state)
        else:
            print(f"[watcher] Nothing to do.")

    except json.JSONDecodeError as e:
        print(f"[watcher] X JSON PARSE ERROR: {e}")
    except Exception as e:
        print(f"[watcher] X ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--interval", type=float, default=5, help="Poll interval in minutes")
    parser.add_argument("--once",  action="store_true", help="Check once and exit")
    parser.add_argument("--reset", nargs="*", metavar="TICKET",
                        help="Clear processed-ticket state. Pass ticket keys to remove specific ones (e.g. --reset ASK-782), or no args to reset ALL.")
    args = parser.parse_args()

    if not JIRA_BOARD_ID:
        print("ERROR: Set JIRA_BOARD_ID in .env")
        return

    # Handle --reset
    if args.reset is not None:
        state = load_state()
        if len(args.reset) == 0:
            state["processed_tickets"] = []
            print("[watcher] State cleared -- all tickets will be re-processed on next run.")
        else:
            before = set(state.get("processed_tickets", []))
            state["processed_tickets"] = [t for t in before if t not in args.reset]
            removed = before - set(state["processed_tickets"])
            print(f"[watcher] Removed from state: {', '.join(removed) if removed else 'none matched'}")
        save_state(state)
        return

    if args.once:
        check_and_trigger()
        return

    print(f"[watcher] Watching '{AUTO_CODER_SPRINT}' on board {JIRA_BOARD_ID}")
    print(f"[watcher] Polling every {args.interval} min -- Ctrl+C to stop\n")

    while True:
        try:
            check_and_trigger()
        except Exception as e:
            print(f"[watcher] ERROR: {e}")
        time.sleep(args.interval * 60)


if __name__ == "__main__":
    main()
