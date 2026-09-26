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
APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token"
APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke"
_jwks_cache: dict = {"keys": None, "fetched": 0}


def _apple_client_id() -> str:
    """Bundle id used for Sign in with Apple. Falls back to the first
    configured audience (which is the iOS bundle id)."""
    explicit = os.environ.get("APPLE_CLIENT_ID", "").strip()
    if explicit:
        return explicit
    auds = [a.strip() for a in os.environ.get("APPLE_AUDIENCES", "").split(",") if a.strip()]
    # Skip the Expo Go audience; return the real bundle id.
    for a in auds:
        if a != "host.exp.Exponent":
            return a
    return auds[0] if auds else ""


def _apple_revocation_configured() -> bool:
    return all([
        os.environ.get("APPLE_TEAM_ID", "").strip(),
        os.environ.get("APPLE_KEY_ID", "").strip(),
        os.environ.get("APPLE_PRIVATE_KEY", "").strip(),
        _apple_client_id(),
    ])


def _make_apple_client_secret() -> str:
    """Build the ES256-signed JWT that Apple accepts as the OAuth client_secret."""
    team_id = os.environ["APPLE_TEAM_ID"].strip()
    key_id = os.environ["APPLE_KEY_ID"].strip()
    # .p8 stored in .env with literal \n — normalise to real newlines.
    private_key = os.environ["APPLE_PRIVATE_KEY"].strip().replace("\\n", "\n")
    now = int(time.time())
    payload = {
        "iss": team_id,
        "iat": now,
        "exp": now + 60 * 30,  # short-lived; only used for the immediate call
        "aud": APPLE_ISSUER,
        "sub": _apple_client_id(),
    }
    return jwt.encode(payload, private_key, algorithm="ES256", headers={"kid": key_id})


async def exchange_apple_code(code: str) -> Optional[str]:
    """Exchange an Apple authorization code for a refresh token. Returns the
    refresh token, or None on failure."""
    if not _apple_revocation_configured():
        return None
    data = {
        "client_id": _apple_client_id(),
        "client_secret": _make_apple_client_secret(),
        "code": code,
        "grant_type": "authorization_code",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                APPLE_TOKEN_URL, data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if res.status_code != 200:
            logging.warning(f"Apple code exchange failed ({res.status_code}): {res.text}")
            return None
        return res.json().get("refresh_token")
    except Exception as e:
        logging.error(f"Apple code exchange error: {e}")
        return None


async def revoke_apple_token(refresh_token: str) -> bool:
    """Revoke a user's Apple tokens (Guideline 5.1.1(v) on account deletion)."""
    if not refresh_token or not _apple_revocation_configured():
        return False
    data = {
        "client_id": _apple_client_id(),
        "client_secret": _make_apple_client_secret(),
        "token": refresh_token,
        "token_type_hint": "refresh_token",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                APPLE_REVOKE_URL, data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if res.status_code == 200:
            logging.info("[APPLE] Token revoked on account deletion")
            return True
        logging.warning(f"Apple token revoke failed ({res.status_code}): {res.text}")
        return False
    except Exception as e:
        logging.error(f"Apple token revoke error: {e}")
        return False


class AppleLoginRequest(BaseModel):
    identity_token: str
    name: Optional[str] = None
    email: Optional[str] = None
    authorization_code: Optional[str] = None


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

    existing = await db.users.find_one({"apple_sub": apple_sub}, {"_id": 0, "hashed_password": 0, "apple_refresh_token": 0})
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

    # Exchange the one-time authorization code for a refresh token and store it,
    # so we can revoke the user's Apple tokens on account deletion (Apple
    # Guideline 5.1.1(v)). Only present on the first sign-in of a session.
    if req.authorization_code:
        refresh_token = await exchange_apple_code(req.authorization_code)
        if refresh_token:
            await db.users.update_one(
                {"id": user_data["id"]},
                {"$set": {"apple_refresh_token": refresh_token}},
            )

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
