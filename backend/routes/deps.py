"""
Shared dependencies and utilities for all routes
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import os
import jwt
import uuid
import hmac
import hashlib
import secrets
import logging
import asyncio
import warnings

from pymongo import ReturnDocument

# Suppress passlib bcrypt version warning
warnings.filterwarnings("ignore", message=".*error reading bcrypt version.*")

# Use bcrypt directly instead of through passlib to avoid version issues
import bcrypt

# Database connection - Production ready (no fallbacks)
mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise RuntimeError("MONGO_URL environment variable is required")
client = AsyncIOMotorClient(mongo_url)

db_name = os.environ.get('DB_NAME')
if not db_name:
    raise RuntimeError("DB_NAME environment variable is required")
db = client[db_name]

# Security - Production ready (no fallbacks)
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)
SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY environment variable is required")
ALGORITHM = "HS256"
# Short-lived access tokens + long-lived rotating refresh tokens.
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 30
# Keyed HMAC secret for hashing refresh tokens at rest (falls back to JWT secret).
REFRESH_HASH_SECRET = os.environ.get("REFRESH_HASH_SECRET", SECRET_KEY)

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

# ============== DATABASE INDEXES ==============

async def create_indexes():
    """Create database indexes for faster queries"""
    try:
        # Users collection
        try:
            await db.users.create_index("id", unique=True, background=True)
        except Exception:
            pass
        try:
            await db.users.create_index("email", sparse=True, background=True)
        except Exception:
            pass
        try:
            await db.users.create_index("phone_number", sparse=True, background=True)
        except Exception:
            pass
        
        # Recipes collection
        try:
            await db.recipes.create_index("id", unique=True, background=True)
        except Exception:
            pass
        try:
            await db.recipes.create_index("title", background=True)
        except Exception:
            pass
        try:
            await db.recipes.create_index([("title", "text"), ("description", "text")], background=True)
        except Exception:
            pass
        
        # Saved recipes
        try:
            await db.saved_recipes.create_index("user_id", background=True)
        except Exception:
            pass
        try:
            await db.saved_recipes.create_index([("user_id", 1), ("recipe_id", 1)], background=True)
        except Exception:
            pass
        
        # Chat messages
        try:
            await db.chat_messages.create_index([("session_id", 1), ("user_id", 1)], background=True)
        except Exception:
            pass
        try:
            await db.chat_messages.create_index("timestamp", background=True)
        except Exception:
            pass
        
        # Weekly plans
        try:
            await db.weekly_plans.create_index([("user_id", 1), ("week_start", 1)], background=True)
        except Exception:
            pass
        
        # Meal preferences
        try:
            await db.meal_preferences.create_index("user_id", unique=True, background=True)
        except Exception:
            pass
        
        # User exclusions
        try:
            # Drop legacy camelCase index if present (caused DuplicateKeyError on null userId)
            try:
                await db.user_exclusions.drop_index("userId_1")
            except Exception:
                pass
            await db.user_exclusions.create_index("user_id", unique=True, background=True)
        except Exception:
            pass
        
        # Shopping lists
        try:
            await db.shopping_lists.create_index("user_id", unique=True, background=True)
        except Exception:
            pass
        
        # Imported recipes
        try:
            await db.imported_recipes.create_index("user_id", background=True)
        except Exception:
            pass
        try:
            await db.imported_recipes.create_index("id", unique=True, background=True)
        except Exception:
            pass
        
        # Recipe Library (AI-generated recipes storage)
        try:
            await db.recipe_library.create_index("id", unique=True, background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("title_normalized", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("cuisine", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("dietary", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("meal_type", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("mood", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("tags", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("times_served", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("is_premium", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index([
                ("cuisine", 1), ("dietary", 1), ("meal_type", 1), ("mood", 1)
            ], background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index([
                ("is_premium", 1), ("times_served", -1)
            ], background=True)
        except Exception:
            pass
        
        # Refresh tokens (rotation + reuse detection). TTL auto-purges expired nodes.
        try:
            await db.refresh_tokens.create_index("user_id", background=True)
        except Exception:
            pass
        try:
            await db.refresh_tokens.create_index("family_id", background=True)
        except Exception:
            pass
        try:
            await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0, background=True)
        except Exception:
            pass
        try:
            await db.auth_events.create_index("created_at", background=True)
        except Exception:
            pass

        logging.info("Database indexes created successfully")
    except Exception as e:
        logging.warning(f"Index creation warning (may already exist): {e}")

# Index creation will be handled by startup event

# ============== PYDANTIC MODELS ==============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: Optional[str] = None
    phone_number: Optional[str] = None
    name: str
    dietary_restrictions: List[str] = []
    cuisine_preferences: List[str] = []
    is_admin: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    dietary_restrictions: List[str] = []
    cuisine_preferences: List[str] = []

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PhoneSendOTP(BaseModel):
    phone_number: str

class PhoneVerifyOTP(BaseModel):
    phone_number: str
    code: str

class PhoneLoginResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str
    user: dict
    is_new_user: bool = False

class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str
    user: dict
    trial: Optional[dict] = None  # Trial info for new users

class RefreshRequest(BaseModel):
    refresh_token: str

class ChatMessage(BaseModel):
    session_id: str
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    session_id: str
    message: str

class ChatResponse(BaseModel):
    session_id: str
    response: str
    timestamp: datetime

class SavedRecipe(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    content: str
    image_url: Optional[str] = None
    source: Optional[str] = None
    cuisine: Optional[str] = None
    meal_type: Optional[str] = None
    cooking_time: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShoppingList(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WeeklyPlan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    week_start: str
    meals: Dict[str, Dict[str, str]] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== AUTH DEPENDENCY ==============

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

# ============== HELPER FUNCTIONS ==============

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash using bcrypt directly"""
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'), 
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt directly"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now, "jti": str(uuid.uuid4()), "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ============== REFRESH TOKEN ROTATION + REUSE DETECTION ==============

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
