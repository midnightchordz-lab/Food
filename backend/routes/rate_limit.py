"""
Rate limiting + the shared daily AI image-generation cap.
"""
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
from pymongo import ReturnDocument

from .db import db

# Shared per-user daily cap for paid AI image generation (M2). Both image route
# files import this so all generation paths share ONE budget, not one each.
DAILY_IMAGE_GEN_CAP = 30


async def check_and_increment_daily_image_cap(user_id: str) -> None:
    today = datetime.now(timezone.utc).date().isoformat()
    doc = await db.image_gen_usage.find_one_and_update(
        {"user_id": user_id, "date": today},
        {"$inc": {"count": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if doc and doc.get("count", 0) > DAILY_IMAGE_GEN_CAP:
        raise HTTPException(status_code=429, detail="Daily image generation limit reached")


async def check_rate_limit(key: str, max_requests: int, window_seconds: int) -> None:
    """Simple per-key sliding-window throttle backed by the rate_limits collection."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=window_seconds)
    doc = await db.rate_limits.find_one_and_update(
        {"key": key, "window_start": {"$gte": window_start.isoformat()}},
        {"$inc": {"count": 1}},
        upsert=False,
    )
    if doc is None:
        # No active window — start a fresh one.
        await db.rate_limits.update_one(
            {"key": key},
            {"$set": {"key": key, "window_start": now.isoformat(), "count": 1}},
            upsert=True,
        )
        return
    if doc.get("count", 0) >= max_requests:
        raise HTTPException(status_code=429, detail="Too many requests — try again later")
