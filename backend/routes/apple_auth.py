"""
Sign in with Apple — verifies the Apple identity token against Apple's JWKS
and issues our own JWT (reusing the existing auth token scheme). Users are
upserted into the same `users` collection so /auth/me works unchanged.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional
import os
import time
import uuid
import logging
import httpx
import jwt
from jwt.algorithms import RSAAlgorithm

from .deps import db, issue_token_pair

router = APIRouter(prefix="/auth", tags=["Apple Auth"])

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"
_jwks_cache: dict = {"keys": None, "fetched": 0}


class AppleLoginRequest(BaseModel):
    identity_token: str
    name: Optional[str] = None
    email: Optional[str] = None


async def _get_apple_keys():
    now = time.time()
    if _jwks_cache["keys"] and now - _jwks_cache["fetched"] < 3600:
        return _jwks_cache["keys"]
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(APPLE_KEYS_URL)
        res.raise_for_status()
        keys = res.json()["keys"]
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched"] = now
    return keys


@router.post("/apple")
async def apple_login(req: AppleLoginRequest, http_request: Request):
    audiences = [a.strip() for a in os.environ.get("APPLE_AUDIENCES", "").split(",") if a.strip()]
    if not audiences:
        raise HTTPException(status_code=500, detail="Apple Sign In not configured")

    try:
        header = jwt.get_unverified_header(req.identity_token)
        keys = await _get_apple_keys()
        jwk = next((k for k in keys if k["kid"] == header["kid"]), None)
        if not jwk:
            raise HTTPException(status_code=401, detail="Apple key not found")
        public_key = RSAAlgorithm.from_jwk(jwk)

        # Try each configured audience (bundle id + host.exp.Exponent)
        payload = None
        last_err = None
        for aud in audiences:
            try:
                payload = jwt.decode(
                    req.identity_token, public_key, algorithms=["RS256"],
                    audience=aud, issuer=APPLE_ISSUER,
                )
                break
            except jwt.InvalidTokenError as e:
                last_err = e
        if payload is None:
            logging.warning(f"Apple token verification failed: {last_err}")
            raise HTTPException(status_code=401, detail="Invalid Apple token")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Apple auth error: {e}")
        raise HTTPException(status_code=401, detail="Could not verify Apple token")

    apple_sub = payload.get("sub")
    token_email = payload.get("email") or req.email

    existing = await db.users.find_one({"apple_sub": apple_sub}, {"_id": 0, "hashed_password": 0})
    is_new_user = False
    if existing:
        user_data = existing
    else:
        is_new_user = True
        user_id = str(uuid.uuid4())
        new_user = {
            "id": user_id,
            "apple_sub": apple_sub,
            "email": token_email,
            "name": req.name or (token_email.split("@")[0] if token_email else "Apple User"),
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

    # New Apple signups must get the same auto-started 7-day trial as email/OTP
    # signups, otherwise they have no trial and are wrongly routed to payment.
    if is_new_user:
        try:
            from .trial import auto_start_trial_if_eligible
            await auto_start_trial_if_eligible(user_data["id"], "ios")
        except Exception as trial_error:
            logging.error(f"⚠️ Trial auto-start failed for Apple user {user_data.get('id')}: {trial_error}")

    pair = await issue_token_pair(user_data["id"], http_request)
    return {
        "access_token": pair["access_token"],
        "refresh_token": pair["refresh_token"],
        "token_type": "bearer",
        "user": user_data,
        "is_new_user": is_new_user,
    }
