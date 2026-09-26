"""
Shared dependencies facade.

The implementation now lives in focused modules — this module re-exports the
public surface so existing `from .deps import ...` call sites keep working:

- db.py          : Mongo client/handle + create_indexes
- models.py      : Pydantic request/response models
- security.py    : JWT config, password hashing, access-token minting, bearer schemes
- rate_limit.py  : rate limiting + shared daily image-generation cap
- auth_deps.py   : current/optional user, admin gate, admin bootstrap
- tokens.py      : refresh-token rotation + reuse detection
"""
from .db import client, db, db_name, mongo_url, create_indexes
from .models import (
    User, UserRegister, UserLogin, PhoneSendOTP, PhoneVerifyOTP,
    PhoneLoginResponse, Token, RefreshRequest, ChatMessage, ChatRequest,
    ChatResponse, SavedRecipe, ShoppingList, WeeklyPlan,
)
from .security import (
    security, security_optional, SECRET_KEY, ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS, REFRESH_HASH_SECRET,
    verify_password, get_password_hash, create_access_token,
)
from .rate_limit import (
    DAILY_IMAGE_GEN_CAP, check_and_increment_daily_image_cap, check_rate_limit,
)
from .auth_deps import (
    get_current_user, get_optional_user, require_admin_user, bootstrap_admins,
    seed_demo_account,
)
from .tokens import (
    issue_token_pair, rotate_refresh_token, revoke_refresh_token,
)

__all__ = [
    "client", "db", "db_name", "mongo_url", "create_indexes",
    "User", "UserRegister", "UserLogin", "PhoneSendOTP", "PhoneVerifyOTP",
    "PhoneLoginResponse", "Token", "RefreshRequest", "ChatMessage", "ChatRequest",
    "ChatResponse", "SavedRecipe", "ShoppingList", "WeeklyPlan",
    "security", "security_optional", "SECRET_KEY", "ALGORITHM",
    "ACCESS_TOKEN_EXPIRE_MINUTES", "REFRESH_TOKEN_EXPIRE_DAYS", "REFRESH_HASH_SECRET",
    "verify_password", "get_password_hash", "create_access_token",
    "DAILY_IMAGE_GEN_CAP", "check_and_increment_daily_image_cap", "check_rate_limit",
    "get_current_user", "get_optional_user", "require_admin_user", "bootstrap_admins",
    "seed_demo_account",
    "issue_token_pair", "rotate_refresh_token", "revoke_refresh_token",
]
