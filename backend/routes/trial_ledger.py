"""
Trial-abuse ledger — survives account deletion on purpose.

DELETE /auth/account purges the full user document (required for Apple/Play
compliance), which also wipes `has_used_trial`/`trial_end_date`. That let
anyone re-register with the same Apple/Google/phone identity and get a fresh
7-day trial every time (flagged as "Deletion Risk" during the iOS resubmission
work). This module stores only a one-way hash of each identity that has ever
received a trial — never the identity itself — so eligibility can be checked
even after the originating account is gone.
"""
import hashlib
import hmac
import logging
from datetime import datetime, timezone
from typing import Optional

from .db import db
from .security import SECRET_KEY

logger = logging.getLogger(__name__)

COLLECTION = "trial_identity_ledger"


def _hash_identity(kind: str, value: str) -> str:
    normalized = value.strip().lower()
    return hmac.new(
        SECRET_KEY.encode("utf-8"),
        f"{kind}:{normalized}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _identities(user_doc: dict) -> list[tuple[str, str]]:
    """Every stable identity on this account worth remembering. Internal
    `id` is deliberately excluded — it's freshly generated on every
    re-registration, so it would never catch a repeat."""
    out = []
    if user_doc.get("email"):
        out.append(("email", user_doc["email"]))
    if user_doc.get("phone_number"):
        out.append(("phone", user_doc["phone_number"]))
    if user_doc.get("apple_sub"):
        out.append(("apple_sub", user_doc["apple_sub"]))
    if user_doc.get("google_sub"):
        out.append(("google_sub", user_doc["google_sub"]))
    return out


async def has_used_trial_identity(user_doc: dict) -> bool:
    """True if ANY identity on this account already has a recorded trial —
    i.e. this looks like a repeat registration under a deleted account."""
    for kind, value in _identities(user_doc):
        doc = await db[COLLECTION].find_one({"_id": _hash_identity(kind, value)})
        if doc:
            return True
    return False


async def record_trial_identity(user_doc: dict) -> None:
    """Idempotently mark every identity on this account as having used a
    trial. Safe to call every time a trial is granted/renewed."""
    now = datetime.now(timezone.utc).isoformat()
    for kind, value in _identities(user_doc):
        try:
            await db[COLLECTION].update_one(
                {"_id": _hash_identity(kind, value)},
                {"$setOnInsert": {"kind": kind, "first_trial_at": now}},
                upsert=True,
            )
        except Exception as e:
            logger.warning(f"[trial_ledger] could not record {kind} identity: {e}")
