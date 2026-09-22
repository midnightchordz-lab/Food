"""
Refresh-token rotation with reuse (stolen-token) detection.
"""
from fastapi import HTTPException
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import hmac
import hashlib
import secrets
import logging

from .db import db
from .security import create_access_token, REFRESH_HASH_SECRET, REFRESH_TOKEN_EXPIRE_DAYS


def _refresh_digest(raw: str) -> str:
    return hmac.new(REFRESH_HASH_SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()


def _new_refresh_raw() -> tuple[str, str, str]:
    """Return (token_id, raw_token, digest). Raw format: '<token_id>.<secret>'."""
    token_id = str(uuid.uuid4())
    raw = f"{token_id}.{secrets.token_urlsafe(48)}"
    return token_id, raw, _refresh_digest(raw)


async def issue_token_pair(user_id: str, request=None, family_id: Optional[str] = None) -> dict:
    """Create a new access token + a fresh rotating refresh token for a login/session."""
    token_id, raw, digest = _new_refresh_raw()
    t = datetime.now(timezone.utc)
    ip = None
    ua = None
    if request is not None:
        fwd = request.headers.get("x-forwarded-for")
        ip = (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else None))
        ua = request.headers.get("user-agent")
    await db.refresh_tokens.insert_one({
        "_id": token_id,
        "user_id": user_id,
        "family_id": family_id or str(uuid.uuid4()),
        "parent_id": None,
        "replaced_by": None,
        "token_hash": digest,
        "created_at": t,
        "expires_at": t + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "used_at": None,
        "revoked_at": None,
        "revocation_reason": None,
        "last_ip": ip,
        "user_agent": ua,
    })
    return {"access_token": create_access_token({"sub": user_id}), "refresh_token": raw}


async def rotate_refresh_token(raw: str, request=None) -> dict:
    """Validate + rotate a refresh token. On reuse of an already-rotated token,
    revoke ALL of the user's sessions (stolen-token response) and log it."""
    try:
        token_id, secret = raw.split(".", 1)
        if not token_id or not secret:
            raise ValueError()
        digest = _refresh_digest(raw)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    doc = await db.refresh_tokens.find_one({"_id": token_id})
    if not doc or not hmac.compare_digest(digest, doc["token_hash"]):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    t = datetime.now(timezone.utc)
    exp = doc.get("expires_at")
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if doc.get("revoked_at") or (exp and exp <= t):
        raise HTTPException(status_code=401, detail="Refresh token revoked or expired")

    ip = None
    if request is not None:
        fwd = request.headers.get("x-forwarded-for")
        ip = (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else None))

    # Atomically claim this token — only one concurrent request can win.
    claimed = await db.refresh_tokens.update_one(
        {"_id": token_id, "used_at": None, "revoked_at": None, "expires_at": {"$gt": t}},
        {"$set": {"used_at": t, "last_ip": ip}},
    )
    if claimed.modified_count != 1:
        # A valid-but-already-used token means replay / stolen token.
        current = await db.refresh_tokens.find_one({"_id": token_id})
        if current and current.get("used_at"):
            await db.refresh_tokens.update_many(
                {"user_id": current["user_id"], "revoked_at": None},
                {"$set": {"revoked_at": t, "revocation_reason": "refresh_token_reuse"}},
            )
            await db.auth_events.insert_one({
                "event": "refresh_token_reuse",
                "user_id": current["user_id"],
                "family_id": current.get("family_id"),
                "token_id": token_id,
                "created_at": t,
                "ip": ip,
            })
            logging.warning(f"[AUTH] refresh token reuse detected — revoked all sessions for user {current['user_id']}")
        raise HTTPException(status_code=401, detail="Refresh token reuse detected")

    # Mint the next node in the rotation chain.
    child_id, child_raw, child_digest = _new_refresh_raw()
    await db.refresh_tokens.insert_one({
        "_id": child_id,
        "user_id": doc["user_id"],
        "family_id": doc["family_id"],
        "parent_id": token_id,
        "replaced_by": None,
        "token_hash": child_digest,
        "created_at": t,
        "expires_at": min(exp, t + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)),
        "used_at": None,
        "revoked_at": None,
        "revocation_reason": None,
        "last_ip": ip,
        "user_agent": doc.get("user_agent"),
    })
    await db.refresh_tokens.update_one({"_id": token_id}, {"$set": {"replaced_by": child_id}})
    return {"access_token": create_access_token({"sub": doc["user_id"]}), "refresh_token": child_raw}


async def revoke_refresh_token(raw: str) -> None:
    """Revoke a single presented refresh token (logout on this device)."""
    try:
        token_id, secret = raw.split(".", 1)
        if not token_id or not secret:
            return
        digest = _refresh_digest(raw)
    except ValueError:
        return
    await db.refresh_tokens.update_one(
        {"_id": token_id, "token_hash": digest, "revoked_at": None},
        {"$set": {"revoked_at": datetime.now(timezone.utc), "revocation_reason": "logout"}},
    )
