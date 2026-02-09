"""
Shared dependencies and utilities for all routes
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import os
import jwt
import uuid
import logging
import asyncio

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
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY environment variable is required")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# ============== DATABASE INDEXES ==============

async def create_indexes():
    """Create database indexes for faster queries"""
    try:
        # Users collection
        await db.users.create_index("id", unique=True, background=True)
        await db.users.create_index("email", sparse=True, background=True)
        await db.users.create_index("phone_number", sparse=True, background=True)
        
        # Recipes collection
        await db.recipes.create_index("id", unique=True, background=True)
        await db.recipes.create_index("title", background=True)
        await db.recipes.create_index([("title", "text"), ("description", "text")], background=True)
        
        # Saved recipes
        await db.saved_recipes.create_index("user_id", background=True)
        await db.saved_recipes.create_index([("user_id", 1), ("recipe_id", 1)], background=True)
        
        # Chat messages
        await db.chat_messages.create_index([("session_id", 1), ("user_id", 1)], background=True)
        await db.chat_messages.create_index("timestamp", background=True)
        
        # Weekly plans
        await db.weekly_plans.create_index([("user_id", 1), ("week_start", 1)], background=True)
        
        # Meal preferences
        await db.meal_preferences.create_index("user_id", unique=True, background=True)
        
        # User exclusions
        await db.user_exclusions.create_index("userId", unique=True, background=True)
        
        # Shopping lists
        await db.shopping_lists.create_index("user_id", unique=True, background=True)
        
        # Imported recipes
        await db.imported_recipes.create_index("user_id", background=True)
        await db.imported_recipes.create_index("id", unique=True, background=True)
        
        # Recipe Library (AI-generated recipes storage)
        await db.recipe_library.create_index("id", unique=True, background=True)
        await db.recipe_library.create_index("title_normalized", background=True)
        await db.recipe_library.create_index("cuisine", background=True)
        await db.recipe_library.create_index("dietary", background=True)
        await db.recipe_library.create_index("meal_type", background=True)
        await db.recipe_library.create_index("mood", background=True)
        await db.recipe_library.create_index("tags", background=True)
        await db.recipe_library.create_index("times_served", background=True)
        await db.recipe_library.create_index("is_premium", background=True)  # Premium recipe filter
        await db.recipe_library.create_index([
            ("cuisine", 1), ("dietary", 1), ("meal_type", 1), ("mood", 1)
        ], background=True)
        await db.recipe_library.create_index([
            ("is_premium", 1), ("times_served", -1)
        ], background=True)  # For premium filtering with popularity sort
        
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
    token_type: str
    user: dict
    is_new_user: bool = False

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

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

# ============== HELPER FUNCTIONS ==============

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
