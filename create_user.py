import json
import sys
from pathlib import Path
from passlib.context import CryptContext

USERS_FILE  = Path("users.json")
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")


def load_users():
    if not USERS_FILE.exists():
        return {}
    return json.loads(USERS_FILE.read_text(encoding="utf-8"))


def save_users(users):
    USERS_FILE.write_text(json.dumps(users, indent=2), encoding="utf-8")


def add_user(email, password):
    users = load_users()
    users[email.lower()] = {"email": email.lower(), "password": pwd_context.hash(password)}
    save_users(users)
    print(f"User '{email}' added.")


def remove_user(email):
    users = load_users()
    if email.lower() in users:
        del users[email.lower()]
        save_users(users)
        print(f"User '{email}' removed.")
    else:
        print(f"User '{email}' not found.")


def list_users():
    users = load_users()
    if not users:
        print("No users registered.")
        return
    for email in users:
        print(f"  {email}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python create_user.py add <email> <password>")
        print("  python create_user.py remove <email>")
        print("  python create_user.py list")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "add" and len(sys.argv) == 4:
        add_user(sys.argv[2], sys.argv[3])
    elif cmd == "remove" and len(sys.argv) == 3:
        remove_user(sys.argv[2])
    elif cmd == "list":
        list_users()
    else:
        print("Invalid command. Run without arguments for usage.")
