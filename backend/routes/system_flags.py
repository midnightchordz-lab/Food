"""
System-wide kill-switch flags + an automatic circuit breaker for phone OTP.

Born from the Twilio SMS-pumping incidents (Oct 2026): a hardcoded
`raise HTTPException(503, ...)` stopped the bleeding each time, but every
re-enable required another code push, and nothing would catch a *new*
abuse pattern automatically overnight. This module makes "is phone OTP
allowed right now" a DB-backed flag an admin can flip without a deploy,
and adds a global volume cap that flips it off by itself if OTP sends
spike — independent of the per-phone-number limit, which a distributed
botnet can stay under while still generating large aggregate volume.
"""
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .deps import db, User, require_admin_user, check_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/system-flags", tags=["Admin — System Flags"])
webhook_router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

FLAGS_COLLECTION = "system_flags"
PHONE_OTP_FLAG_ID = "phone_otp_enabled"

# Global cap independent of the per-phone-number limit: a botnet rotating
# phone numbers/IPs can stay under that limit per-number while still
# generating large aggregate volume. This catches the aggregate.
GLOBAL_OTP_MAX_REQUESTS = 200
GLOBAL_OTP_WINDOW_SECONDS = 3600


async def is_phone_otp_enabled() -> bool:
    """Defaults to DISABLED (fail closed) if the flag has never been set —
    matches the current emergency-off state until someone explicitly turns
    it back on."""
    doc = await db[FLAGS_COLLECTION].find_one({"_id": PHONE_OTP_FLAG_ID})
    return bool(doc and doc.get("enabled") is True)


async def set_phone_otp_enabled(enabled: bool, reason: str, actor: str = "system") -> None:
    await db[FLAGS_COLLECTION].update_one(
        {"_id": PHONE_OTP_FLAG_ID},
        {"$set": {
            "enabled": enabled,
            "reason": reason,
            "actor": actor,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    logger.warning(f"[system_flags] phone_otp_enabled set to {enabled} by {actor}: {reason}")


async def check_and_trip_otp_circuit_breaker() -> None:
    """Call this once per OTP send attempt, in addition to the per-phone
    limit. Shares the same `rate_limits` collection/mechanism but keyed
    globally, so it catches aggregate volume a distributed attacker can
    otherwise stay under per-number. Tripping it also disables the flag
    for every subsequent request, not just this one."""
    try:
        await check_rate_limit(
            "otp:global:circuit",
            max_requests=GLOBAL_OTP_MAX_REQUESTS,
            window_seconds=GLOBAL_OTP_WINDOW_SECONDS,
        )
    except HTTPException:
        await set_phone_otp_enabled(
            False,
            reason=f"circuit breaker: >{GLOBAL_OTP_MAX_REQUESTS} OTP sends in {GLOBAL_OTP_WINDOW_SECONDS}s",
            actor="circuit_breaker",
        )
        raise


# ============== ADMIN ENDPOINTS (require is_admin) ==============

class FlagResponse(BaseModel):
    key: str
    enabled: bool
    reason: Optional[str] = None
    actor: Optional[str] = None
    updated_at: Optional[str] = None


class SetFlagRequest(BaseModel):
    enabled: bool
    reason: str


@router.get("/phone-otp", response_model=FlagResponse)
async def get_phone_otp_flag(current_user: User = Depends(require_admin_user)):
    doc = await db[FLAGS_COLLECTION].find_one({"_id": PHONE_OTP_FLAG_ID}) or {}
    return FlagResponse(
        key=PHONE_OTP_FLAG_ID,
        enabled=bool(doc.get("enabled")),
        reason=doc.get("reason"),
        actor=doc.get("actor"),
        updated_at=doc.get("updated_at"),
    )


@router.post("/phone-otp", response_model=FlagResponse)
async def set_phone_otp_flag(body: SetFlagRequest, current_user: User = Depends(require_admin_user)):
    await set_phone_otp_enabled(body.enabled, reason=body.reason, actor=current_user.email or current_user.id)
    doc = await db[FLAGS_COLLECTION].find_one({"_id": PHONE_OTP_FLAG_ID}) or {}
    return FlagResponse(
        key=PHONE_OTP_FLAG_ID,
        enabled=bool(doc.get("enabled")),
        reason=doc.get("reason"),
        actor=doc.get("actor"),
        updated_at=doc.get("updated_at"),
    )


# ============== TWILIO USAGE-TRIGGER WEBHOOK ==============
# Twilio POSTs form-encoded data when a configured Usage Trigger fires
# (Console → Monitor → Usage → Usage Triggers). Signed with the account's
# auth token so we can verify it actually came from Twilio before trusting
# it to flip a production kill switch.

@webhook_router.post("/twilio-usage-trigger")
async def twilio_usage_trigger(request: Request):
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    if not auth_token:
        raise HTTPException(status_code=500, detail="Twilio not configured")

    try:
        from twilio.request_validator import RequestValidator
    except ImportError:
        raise HTTPException(status_code=500, detail="Twilio SDK not available")

    form = await request.form()
    signature = request.headers.get("X-Twilio-Signature", "")
    # Twilio signs the exact URL it POSTed to — must match what's configured
    # as the trigger's callback URL verbatim (scheme, host, path, no query drift).
    url = str(request.url)

    validator = RequestValidator(auth_token)
    if not validator.validate(url, dict(form), signature):
        logger.warning("[twilio_usage_trigger] signature validation failed — ignoring")
        raise HTTPException(status_code=403, detail="Invalid signature")

    trigger_name = form.get("TriggerName", "unknown")
    usage_value = form.get("UsageValue", "?")
    logger.warning(f"[twilio_usage_trigger] fired: {trigger_name} (value={usage_value}) — disabling phone OTP")

    await set_phone_otp_enabled(
        False,
        reason=f"Twilio usage trigger fired: {trigger_name} (value={usage_value})",
        actor="twilio_usage_trigger",
    )
    return {"status": "ok"}
