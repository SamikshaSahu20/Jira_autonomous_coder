"""
jira_reader.py — Fetch all stories from a Jira sprint.

Uses the Jira REST API v3 with Basic Auth (email + API token).
Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN in .env
"""

import os
import sys
import requests
import urllib3
from dotenv import load_dotenv

# Suppress InsecureRequestWarning for unverified HTTPS requests (Zscaler)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

load_dotenv()

JIRA_BASE_URL       = os.getenv("JIRA_BASE_URL", "").rstrip("/")
JIRA_EMAIL          = os.getenv("JIRA_EMAIL", "")
JIRA_API_TOKEN      = os.getenv("JIRA_API_TOKEN", "")
JIRA_BOARD_ID       = int(os.getenv("JIRA_BOARD_ID", "0"))
AUTO_CODER_SPRINT   = os.getenv("AUTO_CODER_SPRINT", "autonomous-coder")  # sprint name to watch

_SESSION = None


def _session() -> requests.Session:
    global _SESSION
    if _SESSION is None:
        s = requests.Session()
        s.auth = (JIRA_EMAIL, JIRA_API_TOKEN)
        s.headers.update({"Accept": "application/json"})
        s.verify = False   # Zscaler SSL bypass
        _SESSION = s
    return _SESSION


# ── Public API ────────────────────────────────────────────────────────────────

def get_sprint_stories(sprint_id: int) -> list[dict]:
    """
    Return a list of story dicts for every issue in a sprint.
    Each dict has: ticket, summary, description, status, story_points
    """
    stories = []
    start = 0
    max_results = 50

    while True:
        url = f"{JIRA_BASE_URL}/rest/agile/1.0/sprint/{sprint_id}/issue"
        params = {
            "startAt":    start,
            "maxResults": max_results,
            "fields":     "summary,description,status,issuetype,priority,labels,assignee,reporter,customfield_10016,customfield_10014,comment,subtasks,issuelinks",
        }
        resp = _session().get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

        issues = data.get("issues", [])
        for issue in issues:
            fields = issue.get("fields", {})
            desc_raw = fields.get("description") or ""
            # Extract comments
            comments_raw = fields.get("comment", {}).get("comments", [])
            recent_comments = [
                c.get("body", "") if isinstance(c.get("body"), str) else _extract_description(c.get("body", ""))
                for c in comments_raw[-3:]  # last 3 comments
            ]

            # Extract linked issues
            linked = [
                f"{lnk.get('type', {}).get('name', '')} {(lnk.get('inwardIssue') or lnk.get('outwardIssue') or {}).get('key', '')}"
                for lnk in fields.get("issuelinks", [])
            ]

            stories.append({
                "ticket":        issue["key"],
                "summary":       fields.get("summary", ""),
                "description":   _extract_description(desc_raw),
                "status":        fields.get("status", {}).get("name", ""),
                "story_points":  fields.get("customfield_10016") or 0,
                "issue_type":    fields.get("issuetype", {}).get("name", ""),
                "priority":      (fields.get("priority") or {}).get("name", ""),
                "labels":        fields.get("labels", []),
                "assignee":      (fields.get("assignee") or {}).get("displayName", "Unassigned"),
                "reporter":      (fields.get("reporter") or {}).get("displayName", "Unknown"),
                "epic_link":     fields.get("customfield_10014", ""),
                "comments":      recent_comments,
                "linked_issues": linked,
                "subtasks":      [s["key"] for s in fields.get("subtasks", [])],
            })

        total = data.get("total", 0)
        start += len(issues)
        if start >= total or not issues:
            break

    return stories


def get_sprint_by_board(board_id: int, state: str = "active") -> dict | None:
    """
    Return the active (or future) sprint for a board.
    state = 'active' | 'future' | 'closed'
    """
    url = f"{JIRA_BASE_URL}/rest/agile/1.0/board/{board_id}/sprint"
    params = {"state": state}
    resp = _session().get(url, params=params)
    resp.raise_for_status()
    sprints = resp.json().get("values", [])
    return sprints[0] if sprints else None


def get_all_sprints(board_id: int) -> list[dict]:
    """Return all sprints (active + future + closed) for a board."""
    url = f"{JIRA_BASE_URL}/rest/agile/1.0/board/{board_id}/sprint"
    resp = _session().get(url, params={"maxResults": 50})
    resp.raise_for_status()
    return resp.json().get("values", [])


def find_sprint_by_name(board_id: int, name_filter: str) -> dict | None:
    """
    Find the first sprint whose name contains name_filter (case-insensitive).
    Looks across all states: active, future, closed.
    """
    for sprint in get_all_sprints(board_id):
        if name_filter.lower() in sprint.get("name", "").lower():
            return sprint
    return None


def get_backlog_issues(board_id: int, sprint_name_filter: str = None) -> list[dict]:
    """
    Fetch issues from the board backlog.
    Optionally filter by sprint name substring (e.g. 'autonomous-coder').
    """
    url = f"{JIRA_BASE_URL}/rest/agile/1.0/board/{board_id}/backlog"
    params = {
        "maxResults": 100,
        "fields": "summary,description,status,issuetype,customfield_10016,priority,assignee",
    }
    resp = _session().get(url, params=params)
    resp.raise_for_status()
    issues = resp.json().get("issues", [])

    result = []
    for issue in issues:
        fields = issue.get("fields", {})
        result.append({
            "ticket":       issue["key"],
            "summary":      fields.get("summary", ""),
            "description":  _extract_description(fields.get("description") or ""),
            "status":       fields.get("status", {}).get("name", ""),
            "story_points": fields.get("customfield_10016") or 0,
            "issue_type":   fields.get("issuetype", {}).get("name", ""),
            "priority":     fields.get("priority", {}).get("name", "") if fields.get("priority") else "",
            "assignee":     fields.get("assignee", {}).get("displayName", "Unassigned") if fields.get("assignee") else "Unassigned",
        })
    return result


def build_prompt_from_story(story: dict) -> str:
    """Turn a Jira story dict into a full prompt string for the code generator."""
    parts = [f"Ticket: {story['ticket']}"]
    if story.get("summary"):
        parts.append(f"Title: {story['summary']}")
    if story.get("issue_type"):
        parts.append(f"Type: {story['issue_type']}")
    if story.get("priority"):
        parts.append(f"Priority: {story['priority']}")
    if story.get("story_points"):
        parts.append(f"Story Points: {story['story_points']}")
    if story.get("assignee"):
        parts.append(f"Assignee: {story['assignee']}")
    if story.get("reporter"):
        parts.append(f"Reporter: {story['reporter']}")
    if story.get("labels"):
        parts.append(f"Labels: {', '.join(story['labels'])}")
    if story.get("epic_link"):
        parts.append(f"Epic: {story['epic_link']}")
    if story.get("linked_issues"):
        parts.append(f"Linked Issues: {', '.join(story['linked_issues'])}")
    if story.get("subtasks"):
        parts.append(f"Subtasks: {', '.join(story['subtasks'])}")
    if story.get("description"):
        parts.append(f"Description:\n{story['description']}")
    if story.get("comments"):
        parts.append(f"Recent Comments:\n" + "\n---\n".join(story['comments']))
    return "\n\n".join(parts)


def add_jira_comment(issue_key: str, comment_text: str):
    """Add a comment to a Jira issue using v3 API."""
    url = f"{JIRA_BASE_URL}/rest/api/3/issue/{issue_key}/comment"
    payload = {
        "body": {
            "version": 1,
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": comment_text}]
                }
            ]
        }
    }
    resp = _session().post(url, json=payload)
    if not resp.ok:
        print(f"[jira] Failed to add comment to {issue_key}")
    else:
        print(f"[jira] Added implementation comment to {issue_key}")


def transition_jira_issue(issue_key: str, target_status: str):
    """Transition a Jira issue to a specific status by name."""
    url_trans = f"{JIRA_BASE_URL}/rest/api/3/issue/{issue_key}/transitions"
    resp = _session().get(url_trans)
    if not resp.ok:
        print(f"[jira] Failed to fetch transitions for {issue_key}")
        return False

    transitions = resp.json().get("transitions", [])
    target_id = None
    for t in transitions:
        if t["to"]["name"].casefold() == target_status.casefold():
            target_id = t["id"]
            break
            
    if target_id:
        post_resp = _session().post(url_trans, json={"transition": {"id": target_id}})
        if post_resp.ok:
            print(f"[jira] Successfully transitioned {issue_key} to '{target_status}'")
            return True
        else:
            print(f"[jira] Transition failed for {issue_key}: {post_resp.text}")
    else:
        available = [t["to"]["name"] for t in transitions]
        print(f"[jira] No transition found to '{target_status}' for {issue_key}. Available: {available}")
    return False


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_description(raw) -> str:
    """Handle both plain string and Atlassian Document Format (ADF) dict."""
    if not raw:
        return ""
    if isinstance(raw, str):
        return raw
    # ADF format — walk the content tree and extract text nodes
    return _adf_to_text(raw)


def _adf_to_text(node: dict, depth: int = 0) -> str:
    """Recursively extract plain text from an ADF document node."""
    text = ""
    node_type = node.get("type", "")

    if node_type == "text":
        return node.get("text", "")

    for child in node.get("content", []):
        text += _adf_to_text(child, depth + 1)
        if node_type in ("paragraph", "heading", "listItem", "bulletList", "orderedList"):
            text += "\n"

    return text.strip()


# ── CLI helper ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json

    if not JIRA_BOARD_ID:
        print("ERROR: Set JIRA_BOARD_ID in .env")
        sys.exit(1)

    cmd = sys.argv[1] if len(sys.argv) > 1 else "backlog"

    if cmd == "backlog":
        # Find the autonomous-coder sprint and show only its stories
        sprint = find_sprint_by_name(JIRA_BOARD_ID, AUTO_CODER_SPRINT)
        if not sprint:
            print(f"ERROR: No sprint found matching '{AUTO_CODER_SPRINT}' on board {JIRA_BOARD_ID}")
            sys.exit(1)

        stories = get_sprint_stories(sprint["id"])

        print(f"\n{'─'*65}")
        print(f"  Sprint : {sprint['name']}  (id={sprint['id']}, state={sprint['state']})")
        print(f"  Board  : {JIRA_BOARD_ID}    Total: {len(stories)} stories")
        print(f"{'─'*65}")
        print(f"  {'Ticket':<12} {'Pts':>3}  {'Status':<18}  Summary")
        print(f"{'─'*65}")
        for s in stories:
            pts = str(int(s["story_points"])) if s["story_points"] else "-"
            print(f"  {s['ticket']:<12} {pts:>3}  {s['status']:<18}  {s['summary']}")
        print(f"{'─'*65}\n")

    elif cmd == "sprints":
        sprints = get_all_sprints(JIRA_BOARD_ID)
        print(f"\n{'─'*60}")
        print(f"  All sprints — Board {JIRA_BOARD_ID}")
        print(f"{'─'*60}")
        for s in sprints:
            marker = " ◄" if AUTO_CODER_SPRINT.lower() in s["name"].lower() else ""
            print(f"  id={s['id']:<8}  state={s['state']:<8}  {s['name']}{marker}")
        print()

    elif cmd == "sprint":
        if len(sys.argv) < 3:
            print("Usage: python jira_reader.py sprint <sprint_id>")
            sys.exit(1)
        stories = get_sprint_stories(int(sys.argv[2]))
        print(json.dumps(stories, indent=2))

    else:
        print(f"Unknown command: {cmd}")
        print("Usage: python jira_reader.py [backlog|sprints|sprint <id>]")
