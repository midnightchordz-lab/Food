"""
Security primitives: JWT config, password hashing, access-token minting,
and the HTTP bearer schemes.
"""
from fastapi.security import HTTPBearer
from datetime import datetime, timezone, timedelta
import os
import jwt
import uuid
import warnings

# Suppress passlib bcrypt version warning
warnings.filterwarnings("ignore", message=".*error reading bcrypt version.*")

# Use bcrypt directly instead of through passlib to avoid version issues
import bcrypt

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
