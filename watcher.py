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
        in_progress = [s for s in stories if s["status"].lower() == "in progress"]

        print(f"[watcher] {datetime.now().strftime('%H:%M:%S')}  '{sprint_name}' — Found {len(in_progress)} tickets 'In Progress'.")

        # Track processed tickets to avoid re-processing
        state = load_state()
        processed = state.get("processed_tickets", [])
        
        new_tickets = [t for t in in_progress if t["ticket"] not in processed]
        
        if new_tickets:
            print(f"[watcher] Found {len(new_tickets)} NEW ticket(s) to process")
            run_pipeline(sprint_id, sprint_name)
            
            # Update state with newly processed tickets
            for ticket in new_tickets:
                if ticket["ticket"] not in processed:
                    processed.append(ticket["ticket"])
            
            state["processed_tickets"] = processed
            state["last_run"] = datetime.now().isoformat()
            save_state(state)
            print(f"[watcher] State saved. Processed tickets: {processed}")
        else:
            print(f"[watcher] No new tickets to process (all seen before)")
    
    except json.JSONDecodeError as e:
        print(f"[watcher] ✗ JSON PARSE ERROR: {e}")
        print(f"[watcher] This usually means an API response was empty or malformed")
    except Exception as e:
        print(f"[watcher] ✗ ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--interval", type=float, default=5, help="Poll interval in minutes")
    parser.add_argument("--once", action="store_true", help="Check once and exit")
    args = parser.parse_args()

    if not JIRA_BOARD_ID:
        print("ERROR: Set JIRA_BOARD_ID in .env")
        return

    if args.once:
        check_and_trigger()
        return

    print(f"[watcher] Watching '{AUTO_CODER_SPRINT}' on board {JIRA_BOARD_ID}")
    print(f"[watcher] Polling every {args.interval} min � Ctrl+C to stop\n")

    while True:
        try:
            check_and_trigger()
        except Exception as e:
            print(f"[watcher] ERROR: {e}")
        time.sleep(args.interval * 60)


if __name__ == "__main__":
    main()
