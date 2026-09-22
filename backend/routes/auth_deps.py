"""
Auth dependencies: current-user resolution, optional user, admin gate,
and admin bootstrap.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from typing import Optional
import os
import jwt
import logging

from .db import db
from .models import User
from .security import SECRET_KEY, ALGORITHM, security, security_optional


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
