"""
Seed a shareable DEMO / APP-REVIEW login with EVERYTHING unlocked.

This account is meant to be handed to the Apple App Review team (or any QA
tester). It logs in with plain email + password (works in Expo Go, web preview,
and real iOS/Android builds), is a top-tier `chef_pro` subscriber that NEVER
expires, and is also flagged `is_admin` so admin-only screens are reachable.

Idempotent: safe to run repeatedly; it upserts the same account.

Usage (run from /app/backend):
    python -m scripts.seed_demo_account
    python -m scripts.seed_demo_account --email reviewer@moodfood.app --password 'Review@MoodFood2026'
"""
import os
import sys
import uuid
import asyncio
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)


def get_password_hash(password: str) -> str:
    """Bcrypt hash — identical scheme to routes/security.py get_password_hash."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")



DEFAULT_EMAIL = "reviewer@moodfood.app"
DEFAULT_PASSWORD = "Review@MoodFood2026"
DEFAULT_NAME = "App Review (Demo)"

# Top tier so EVERY feature is unlocked (AI image gen, diabetes, video import, etc.)
DEMO_PLAN_ID = "chef_pro_annual"
NEVER_EXPIRES = "2099-12-31T23:59:59+00:00"


def _arg(flag: str, default: str) -> str:
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


async def main() -> None:
    email = _arg("--email", DEFAULT_EMAIL).strip().lower()
    password = _arg("--password", DEFAULT_PASSWORD)
    name = _arg("--name", DEFAULT_NAME)

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc)

    existing = await db.users.find_one({"email": email})
    user_id = existing["id"] if existing and existing.get("id") else str(uuid.uuid4())

    user_doc = {
        "id": user_id,
        "email": email,
        "name": name,
        "hashed_password": get_password_hash(password),
        "dietary_restrictions": [],
        "cuisine_preferences": [],
        "is_admin": True,
        # Entitlement fields (trial.py reads these): top tier, no trial prompts.
        "default_plan": "chef_pro",
        "subscription_status": "active",
        "trial_active": False,
        "entitlement_tier": "chef_pro",
        "has_used_trial": True,
        "onboarding_completed": True,
    }
    if not existing:
        user_doc["created_at"] = now.isoformat()

    await db.users.update_one({"email": email}, {"$set": user_doc}, upsert=True)

    # Active, non-expiring top-tier subscription that passes the entitlement guard.
    # A `pay_` payment marker + valid `admin` source clears both the priority
    # validation and the final safety check without any real charge, and the
    # far-future period end keeps the nightly expiry sweep from downgrading it.
    await db.user_subscriptions.delete_many({"user_id": user_id})
    await db.user_subscriptions.insert_one({
        "id": f"sub_demo_{user_id[:8]}",
        "user_id": user_id,
        "plan_id": DEMO_PLAN_ID,
        "status": "active",
        "source": "admin",
        "payment_provider": "razorpay",
        "razorpay_payment_id": f"pay_demoreview{user_id[:10]}",
        "current_period_start": now.isoformat(),
        "current_period_end": NEVER_EXPIRES,
        "cancel_at_period_end": False,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    })

    client.close()
    print("✅ Demo/review account ready")
    print(f"   Email    : {email}")
    print(f"   Password : {password}")
    print(f"   Plan     : {DEMO_PLAN_ID} (never expires) · is_admin: true")


if __name__ == "__main__":
    asyncio.run(main())
