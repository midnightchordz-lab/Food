"""
Emergent-managed Google sign-in. The frontend obtains a one-time `session_id`
from the Emergent auth redirect and posts it here; we exchange it with Emergent
for the profile, upsert the user into the same `users` collection, and issue our
own app JWT (reusing the existing auth scheme) so /auth/me works unchanged.
"""
import uuid
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .deps import db, create_access_token

router = APIRouter(prefix="/auth", tags=["Google Auth"])

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


class SessionRequest(BaseModel):
    session_id: str


@router.post("/session")
async def google_session(req: SessionRequest):
    if not req.session_id:
        raise HTTPException(status_code=401, detail="Missing session_id")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": req.session_id})
    except Exception as e:
        logging.error(f"Google session exchange error: {e}")
        raise HTTPException(status_code=502, detail="Auth provider unavailable")

    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    data = res.json()
    email = (data.get("email") or "").lower().strip()
    name = data.get("name") or (email.split("@")[0] if email else "Google User")
    if not email:
        raise HTTPException(status_code=401, detail="No email returned from Google")

    existing = await db.users.find_one({"email": email}, {"_id": 0, "hashed_password": 0})
    is_new_user = False
    if existing:
        user_data = existing
    else:
        is_new_user = True
        user_id = str(uuid.uuid4())
        new_user = {
            "id": user_id,
            "email": email,
            "name": name,
            "google_picture": data.get("picture"),
            "dietary_restrictions": [],
            "cuisine_preferences": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "default_plan": "free",
            "subscription_status": "inactive",
            "trial_active": False,
            "entitlement_tier": "free",
        }
        await db.users.insert_one(new_user)
        new_user.pop("_id", None)
        user_data = new_user

    access_token = create_access_token({"sub": user_data["id"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_data,
        "is_new_user": is_new_user,
    }
