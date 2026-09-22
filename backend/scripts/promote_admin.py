"""
Promote or demote a user to/from admin by email.

Usage:
    python -m scripts.promote_admin user@example.com          # promote
    python -m scripts.promote_admin user@example.com --revoke # demote

The target account must already exist (register through the normal flow first).
Run from /app/backend so the .env and routes package resolve.
"""
import os
import sys
import asyncio
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)


async def main() -> None:
    args = [a for a in sys.argv[1:]]
    revoke = "--revoke" in args
    emails = [a.strip().lower() for a in args if not a.startswith("--")]
    if len(emails) != 1:
        raise SystemExit("usage: python -m scripts.promote_admin <email> [--revoke]")
    email = emails[0]

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    result = await db.users.update_one(
        {"email": email},
        {"$set": {"is_admin": not revoke}},
    )
    if result.matched_count == 0:
        raise SystemExit(f"No account found for {email} — register it first.")
    action = "revoked admin from" if revoke else "promoted to admin"
    print(f"{action}: {email} (modified={result.modified_count})")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
