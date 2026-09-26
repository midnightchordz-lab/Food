"""
Auth dependencies: current-user resolution, optional user, admin gate,
and admin bootstrap.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from typing import Optional
from datetime import datetime, timezone
import os
import uuid
import jwt
import logging

from .db import db
from .models import User
from .security import SECRET_KEY, ALGORITHM, security, security_optional, get_password_hash


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # A refresh token must never be usable as an API access token.
        if payload.get("type") == "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")

        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logging.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")


async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security_optional)):
    """Like get_current_user but returns None (instead of 401) when there is no
    valid token. Used by graceful-degradation endpoints that must stay usable
    without login so a security fix never hard-breaks an existing request."""
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") == "refresh":
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        return User(**user) if user else None
    except Exception:
        return None


async def require_admin_user(current_user: "User" = Depends(get_current_user)) -> "User":
    """Authorize an authenticated user as an admin. DB-authoritative (get_current_user
    loads the live user) so a token issued before demotion won't retain admin.
    403 for non-admins, 401 (from get_current_user) for missing/invalid tokens."""
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Administrator role required")
    return current_user


async def bootstrap_admins() -> int:
    """Idempotently promote accounts listed in ADMIN_BOOTSTRAP_EMAILS to admin.
    Never demotes anyone; safe to run on every startup. Returns count promoted."""
    raw = os.environ.get("ADMIN_BOOTSTRAP_EMAILS", "")
    emails = sorted({v.strip().lower() for v in raw.split(",") if v.strip()})
    if not emails:
        return 0
    result = await db.users.update_many(
        {"email": {"$in": emails}, "is_admin": {"$ne": True}},
        {"$set": {"is_admin": True}},
    )
    if result.modified_count:
        logging.info(f"bootstrap_admins: promoted {result.modified_count} account(s) to admin")
    return result.modified_count


async def seed_demo_account() -> None:
    """Idempotently ensure the App Review / demo login exists with EVERYTHING
    unlocked (top-tier `chef_pro`, never expires, admin). Runs on every startup
    so the reviewer account is always present in the deployed build.

    Controlled by env (all optional):
      DEMO_ACCOUNT_ENABLED   (default "true"; set "false" to skip)
      DEMO_ACCOUNT_EMAIL     (default "reviewer@moodfood.app")
      DEMO_ACCOUNT_PASSWORD  (default "Review@MoodFood2026")
    """
    if os.environ.get("DEMO_ACCOUNT_ENABLED", "true").strip().lower() in ("false", "0", "no"):
        return

    # Credentials come only from the environment (deploy-time secrets in .env) —
    # no defaults are baked into source. If they aren't provided, skip seeding.
    email = os.environ.get("DEMO_ACCOUNT_EMAIL", "").strip().lower()
    password = os.environ.get("DEMO_ACCOUNT_PASSWORD", "")
    if not email or not password:
        return
    now = datetime.now(timezone.utc)
    never_expires = "2099-12-31T23:59:59+00:00"

    existing = await db.users.find_one({"email": email})
    user_id = existing["id"] if existing and existing.get("id") else str(uuid.uuid4())

    # Entitlement fields that trial.py reads: top tier, no trial prompts, admin.
    entitlement_fields = {
        "is_admin": True,
        "default_plan": "chef_pro",
        "subscription_status": "active",
        "trial_active": False,
        "entitlement_tier": "chef_pro",
        "has_used_trial": True,
        "onboarding_completed": True,
    }

    if not existing:
        await db.users.insert_one({
            "id": user_id,
            "email": email,
            "name": "App Review (Demo)",
            "hashed_password": get_password_hash(password),
            "dietary_restrictions": [],
            "cuisine_preferences": [],
            "created_at": now.isoformat(),
            **entitlement_fields,
        })
        logging.info(f"seed_demo_account: created demo/review account {email}")
    else:
        # Keep entitlement + admin correct without rehashing the password each boot.
        await db.users.update_one({"id": user_id}, {"$set": entitlement_fields})
        # Self-heal the password only if it's somehow missing (e.g. social-only doc).
        if not existing.get("hashed_password"):
            await db.users.update_one(
                {"id": user_id}, {"$set": {"hashed_password": get_password_hash(password)}}
            )

    # Ensure a single active, non-expiring top-tier subscription that clears the
    # entitlement guard (payment marker + valid source + far-future period).
    # NON-DESTRUCTIVE: upsert the demo subscription in place (no deletes) so this
    # is safe to run on every startup, including in production.
    active_sub = await db.user_subscriptions.find_one(
        {"user_id": user_id, "status": "active", "plan_id": "chef_pro_annual"}
    )
    if not active_sub:
        await db.user_subscriptions.update_one(
            {"user_id": user_id, "source": "admin"},
            {"$set": {
                "id": f"sub_demo_{user_id[:8]}",
                "user_id": user_id,
                "plan_id": "chef_pro_annual",
                "status": "active",
                "source": "admin",
                "payment_provider": "razorpay",
                "razorpay_payment_id": f"pay_demoreview{user_id[:10]}",
                "current_period_start": now.isoformat(),
                "current_period_end": never_expires,
                "cancel_at_period_end": False,
                "updated_at": now.isoformat(),
            },
             "$setOnInsert": {"created_at": now.isoformat()}},
            upsert=True,
        )
        logging.info(f"seed_demo_account: ensured chef_pro subscription for {email}")
