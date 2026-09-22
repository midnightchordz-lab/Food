"""
Push Notifications - Emergent managed relay (SuprSend passthrough).

Exposes /api/register-push for device registration and a send_push() helper the
backend uses to trigger notifications (e.g. the weekly meal-plan nudge).
"""
import os
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from routes.deps import db, User, get_current_user

logger = logging.getLogger(__name__)

PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")

_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": PUSH_KEY},
    timeout=10.0,
)

router = APIRouter(tags=["Push"])


class RegisterPushBody(BaseModel):
    platform: str  # "android" | "ios"
    device_token: str
    # user_id intentionally removed — derived server-side from the auth token (H2)


@router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody, current_user: User = Depends(get_current_user)):
    payload = {
        "user_id": current_user.id,  # H2: from the token, never the client body
        "platform": body.platform,
        "device_token": body.device_token,
    }
    resp = await _client.post("/api/v1/push/users/register", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()

    # Track opted-in users so scheduled jobs know who to notify.
    try:
        await db.push_users.update_one(
            {"user_id": current_user.id},
            {"$set": {
                "user_id": current_user.id,
                "platform": body.platform,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    except Exception as e:
        logger.warning(f"Could not persist push user {current_user.id}: {e}")

    return {"status": "registered"}


async def send_push(recipients: list[str], data: dict, idempotency_key: str | None = None) -> None:
    """Relay a push to the Emergent managed service. recipients = list of user IDs."""
    if not recipients:
        return
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")

    # Chunk to respect the 100-recipient-per-call limit.
    for i in range(0, len(recipients), 100):
        chunk = recipients[i:i + 100]
        payload: dict = {"recipients": chunk, "data": data}
        if idempotency_key:
            payload["$idempotency_key"] = f"{idempotency_key}-{i}"
        resp = await _client.post("/api/v1/push/trigger", json=payload)
        if resp.status_code == 401:
            raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
        if resp.status_code >= 500:
            raise HTTPException(502, "Push provider unavailable")
        resp.raise_for_status()


async def send_weekly_plan_nudge() -> int:
    """Send the Sunday 'plan your week' nudge to every registered user. Returns count."""
    users = await db.push_users.find({}, {"_id": 0, "user_id": 1}).to_list(length=100000)
    recipients = [u["user_id"] for u in users if u.get("user_id")]
    if not recipients:
        return 0
    week_key = datetime.now(timezone.utc).strftime("%Y-W%W")
    await send_push(
        recipients=recipients,
        data={
            "title": "Plan your delicious week 🍲",
            "message": "Pick a mood and let MoodFood map out your meals for the week ahead.",
            "action_url": "/(tabs)/planner",
        },
        idempotency_key=f"weekly-nudge-{week_key}",
    )
    logger.info(f"Sent weekly plan nudge to {len(recipients)} users")
    return len(recipients)


from fastapi import Depends
from routes.deps import User, get_current_user


@router.post("/push/test-weekly-nudge")
async def test_weekly_nudge(current_user: User = Depends(get_current_user)):
    """Send the weekly nudge to the current user only (for verifying wiring on a real build)."""
    try:
        await send_push(
            recipients=[current_user.id],
            data={
                "title": "Plan your delicious week 🍲",
                "message": "Pick a mood and let MoodFood map out your meals for the week ahead.",
                "action_url": "/(tabs)/planner",
            },
        )
        return {"status": "sent", "user_id": current_user.id}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Push failed: {e}")

