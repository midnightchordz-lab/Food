from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
import jwt
from passlib.context import CryptContext
import json
from pdf_generator import generate_shopping_list_pdf
from ai_meal_planner import generate_ai_meal_plan
from voice_service import transcribe_audio, generate_mood_aware_speech, detect_mood_from_text, get_voice_description
import base64
from io import BytesIO
from image_service import get_food_image, get_cuisine_specific_image

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    dietary_restrictions: List[str] = []
    cuisine_preferences: List[str] = []

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Phone authentication models
class PhoneSendOTP(BaseModel):
    phone_number: str  # E.164 format: +1234567890

class PhoneVerifyOTP(BaseModel):
    phone_number: str
    code: str

class PhoneLoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict
    is_new_user: bool = False

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    dietary_restrictions: List[str] = []
    cuisine_preferences: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    role: str
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    structured_data: Optional[Dict[str, Any]] = None

class ChatRequest(BaseModel):
    session_id: str
    message: str

class ChatResponse(BaseModel):
    session_id: str
    response: str
    timestamp: datetime
    structured_recipes: Optional[List[Dict[str, Any]]] = None

class Recipe(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    ingredients: List[str]
    instructions: List[str]
    mood_tags: List[str]
    prep_time: str
    cook_time: str
    complexity: str
    nutritional_highlights: str
    dietary_info: List[str] = []
    image_url: Optional[str] = None
    cuisine_type: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RecipeCreate(BaseModel):
    title: str
    description: str
    ingredients: List[str]
    instructions: List[str]
    mood_tags: List[str]
    prep_time: str
    cook_time: str
    complexity: str
    nutritional_highlights: str
    dietary_info: List[str] = []
    image_url: Optional[str] = None
    cuisine_type: Optional[str] = None

class SavedRecipe(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    recipe_id: str
    saved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SaveRecipeRequest(BaseModel):
    recipe: RecipeCreate

class ShoppingList(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: List[Dict[str, Any]]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShoppingListCreate(BaseModel):
    items: List[Dict[str, Any]]

class WeeklyPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    week_start: str
    meals: Dict[str, Any]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WeeklyPlanCreate(BaseModel):
    week_start: str
    meals: Dict[str, Any]

# Meal Preferences for Continuous Planning
class MealPreferences(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    dietary_preference: str = "non-vegetarian"
    calorie_target: Optional[int] = None
    focus_areas: List[str] = []
    cuisine_preferences: List[str] = []
    mood: str = "balanced"
    is_active: bool = True
    generation_mode: str = "manual"  # 'manual' or 'auto'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MealPreferencesCreate(BaseModel):
    dietary_preference: str = "non-vegetarian"
    calorie_target: Optional[int] = None
    focus_areas: List[str] = []
    cuisine_preferences: List[str] = []
    mood: str = "balanced"
    is_active: bool = True
    generation_mode: str = "manual"  # 'manual' or 'auto'

# Track used recipes to avoid repetition
class UsedRecipe(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    recipe_name: str
    used_date: str
    week_start: str

class AIWeeklyPlanRequest(BaseModel):
    mood: str
    dietary_preference: Optional[str] = "non-vegetarian"
    calorie_target: Optional[int] = None
    focus_areas: Optional[List[str]] = []
    cuisine_preferences: Optional[List[str]] = []

class RecipeRating(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    recipe_id: str
    rating: int  # 1-5
    review: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RatingCreate(BaseModel):
    rating: int
    review: Optional[str] = None

class RecipeSearchRequest(BaseModel):
    query: Optional[str] = None
    mood_tags: Optional[List[str]] = None
    dietary_tags: Optional[List[str]] = None
    complexity: Optional[str] = None

class MealReminder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    day_of_week: str
    time: str  # HH:MM format
    meal_type: str  # breakfast, lunch, dinner
    enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReminderCreate(BaseModel):
    day_of_week: str
    time: str
    meal_type: str
    enabled: bool = True

class RecipeSearchRequest(BaseModel):
    cuisine: Optional[str] = None
    count: int = 12

class DiscoveredRecipe(BaseModel):
    title: str
    description: str
    cooking_time: str
    difficulty: str
    image_url: str
    cuisine: str
    source_url: str

class VoiceTranscriptionResponse(BaseModel):
    text: str
    detected_mood: Optional[str] = None

class VoiceTranscriptionRequest(BaseModel):
    language: Optional[str] = 'en'

class VoiceSynthesisRequest(BaseModel):
    text: str
    mood: Optional[str] = None
    language: Optional[str] = 'en'

class VoiceSynthesisResponse(BaseModel):
    audio_base64: str
    mood: str
    voice_description: str

class LanguagesResponse(BaseModel):
    languages: dict

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    dietary_restrictions: Optional[List[str]] = None
    cuisine_preferences: Optional[List[str]] = None

# Auth helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

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
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_conversational_system_message():
    """Short system message for general chat interactions"""
    return """You are MoodFood, a friendly chef helping users discover mood-based recipes. 
Be warm, concise, and helpful. Ask clarifying questions if needed."""


def get_detailed_recipe_prompt(recipe_title: str, cuisine: str, meal_type: str, dietary_pref: str):
    """Generate a comprehensive detailed recipe with professional-grade instructions"""
    return f"""You are a professional chef instructor. Generate a COMPLETE, DETAILED recipe for "{recipe_title}".

Follow this EXACT format:

# {recipe_title.upper()}

## Recipe Information
- **Cuisine:** {cuisine}
- **Meal Type:** {meal_type}
- **Difficulty:** [Easy/Medium/Hard]
- **Servings:** [number]
- **Prep Time:** [X minutes]
- **Cook Time:** [X minutes]
- **Total Time:** [X minutes]
- **Dietary Tags:** [{dietary_pref}, plus any applicable: Gluten-Free, Dairy-Free, High-Protein, Low-Carb]

## Description
[Write 2-3 sentences describing the dish, its origins, and what makes it special. Include sensory descriptions - taste, texture, aroma.]

## 🥕 Ingredients

**For the Main Component:**
- [Exact quantity] [Ingredient name]
- [Continue listing 4-6 ingredients]

**For the Sauce/Seasoning:**
- [Exact quantity] [Ingredient name]
- [Continue listing 3-5 ingredients]

**For Garnish:**
- [Optional ingredients]

## 🔧 Equipment Needed
- [List 6-8 specific tools: pan sizes, utensils, bowls]

## 📋 Step-by-Step Instructions

**Step 1** ([X] minutes)
[Detailed instruction with EXACT measurements, specific techniques, tool to use]
*Visual Cue:* [What to look for to know this step is complete]

**Step 2** ([X] minutes)
[Continue with detailed instructions]
*Important:* [Critical technique note if applicable]

[Continue for 10-15 steps, each with timing and visual cues]

**Final Step** ([X] minutes)
[Plating and serving instructions]
*Serving Suggestion:* [What to serve with this dish]

## 💡 Chef's Tips
1. [Specific tip about temperature, timing, or technique]
2. [Tip about ingredient selection or substitution]
3. [Tip about common pitfalls to avoid]
4. [Pro tip for restaurant-quality results]

## 📊 Nutritional Information (Per Serving)
- Calories: [X] kcal
- Protein: [X]g
- Carbohydrates: [X]g
- Fat: [X]g
- Fiber: [X]g
- Sodium: [X]mg

## 🥡 Storage & Reheating
- **Storage:** [How to store, container type, duration]
- **Reheating:** [Best method, temperature, time]

## 🍷 Drink Pairings

**Non-Alcoholic:**
- **[Mocktail/Beverage Name]:** [Brief description of why it pairs well - flavor notes, how it complements the dish]
- **[Alternative Option]:** [Another non-alcoholic option]

**Alcoholic (21+):**
- **[Wine/Beer/Cocktail Name]:** [Specific recommendation with why it pairs - e.g., "Pinot Grigio - its citrus notes complement the seafood"]
- **[Alternative Option]:** [Another alcoholic option]

## 🔄 Variations
1. **[Variation Name]:** [Brief description]
2. **[Variation Name]:** [Brief description]

## ⚠️ Common Mistakes to Avoid
1. [Mistake and why it happens]
2. [Mistake and how to prevent it]
3. [Mistake and the correct technique]

CRITICAL RULES:
- Every step MUST have specific timing
- Every step MUST have exact measurements and temperatures
- Include visual/audio cues for EVERY step (e.g., "until golden brown", "when it starts sizzling")
- NO generic phrases like "cook until done" or "season to taste"
- Use SPECIFIC pan sizes, heat levels, and cooking times
- Include technique notes where critical"""


def get_recipe_generation_prompt(mood: str, meal_type: str, dietary_pref: str, cuisines: str):
    """Generate a focused prompt for recipe suggestions with detailed instructions"""
    return f"""You are an expert chef and sommelier. Generate EXACTLY 4 {dietary_pref} {cuisines} {meal_type} recipes matching a {mood} mood.

For EACH recipe:

### [Recipe Name]
**Cuisine:** {cuisines} | **Time:** X min | **Difficulty:** Easy/Medium/Hard

**Why it fits the {mood} mood:** 1-2 sentences

**Ingredients:** (6-8 items with quantities)
- [Qty] [Ingredient]

**Instructions:** (6-8 specific steps)
1. [PREP X min] Do this with [specific ingredient]: [technique, cut size, bowl type]
2. [COOK X min] Heat [specific pan] to [exact temp/heat level]. Add [ingredient]. Cook [X minutes] until [visual cue].
3. Continue...

**Chef's Tip:** One unique tip for this dish.

**🍹 Drink Pairings:**
- **Non-Alcoholic:** [Specific mocktail or beverage name] - [why it pairs well with flavors]
- **Alcoholic (21+):** [Specific wine/beer/cocktail] - [why it complements the dish]

---

RULES:
- NO generic phrases like "cook until done" or "season to taste"
- ALWAYS include: exact temperatures, timing per step, visual/audio cues
- Each recipe must have UNIQUE, dish-specific instructions
- Drink pairings must be SPECIFIC (not generic "white wine" but "Sauvignon Blanc" or "Pinot Grigio")
- Keep total response under 3500 words"""


def get_system_message(dietary_restrictions: List[str] = None, cuisine_preferences: List[str] = None):
    """Legacy system message for backward compatibility - used for general chat"""
    base_message = """You are MoodFood, a compassionate nutritional expert and chef specializing in mood-based meal planning.

Your approach:
- Listen for emotional cues and acknowledge moods with empathy
- Explain the food-mood connection briefly
- Suggest authentic dishes from diverse global cuisines

When suggesting recipes, always include:
- Recipe name with cuisine type
- Cooking time and difficulty
- Brief appetizing description
- Key mood-boosting benefits

Be warm, encouraging, and concise. Keep responses focused and helpful."""
    
    if dietary_restrictions and len(dietary_restrictions) > 0:
        restrictions_text = ", ".join(dietary_restrictions)
        base_message += f"\n\nDietary restrictions: {restrictions_text}. All suggestions MUST accommodate these."
    
    if cuisine_preferences and len(cuisine_preferences) > 0:
        cuisines_text = ", ".join(cuisine_preferences)
        base_message += f"\n\nPreferred cuisines: {cuisines_text}. Prioritize these cuisines."
    
    return base_message

# Auth endpoints
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = UserInDB(
        email=user_data.email,
        name=user_data.name,
        dietary_restrictions=user_data.dietary_restrictions,
        cuisine_preferences=user_data.cuisine_preferences,
        hashed_password=get_password_hash(user_data.password)
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token = create_access_token(data={"sub": user.id})
    
    user_response = User(**{k: v for k, v in user.model_dump().items() if k != 'hashed_password'})
    
    return Token(access_token=access_token, token_type="bearer", user=user_response)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user['hashed_password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user['id']})
    
    user_response = User(**{k: v for k, v in user.items() if k != 'hashed_password'})
    
    return Token(access_token=access_token, token_type="bearer", user=user_response)

# ============== PHONE AUTHENTICATION ==============
# Twilio credentials - add to .env file:
# TWILIO_ACCOUNT_SID=your_account_sid
# TWILIO_AUTH_TOKEN=your_auth_token
# TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid

# In-memory OTP storage for demo (use Redis in production)
otp_storage = {}

@api_router.post("/auth/phone/send-otp")
async def send_phone_otp(request: PhoneSendOTP):
    """Send OTP to phone number via Twilio SMS"""
    phone = request.phone_number.strip()
    
    # Validate E.164 format
    if not phone.startswith('+') or len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number format. Use E.164 format: +1234567890")
    
    # Check if Twilio is configured
    twilio_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    twilio_token = os.environ.get('TWILIO_AUTH_TOKEN')
    twilio_verify_sid = os.environ.get('TWILIO_VERIFY_SERVICE_SID')
    
    if twilio_sid and twilio_token and twilio_verify_sid:
        # Use Twilio Verify API
        try:
            from twilio.rest import Client
            client = Client(twilio_sid, twilio_token)
            verification = client.verify.v2.services(twilio_verify_sid).verifications.create(
                to=phone, 
                channel="sms"
            )
            return {"status": verification.status, "message": "OTP sent successfully"}
        except Exception as e:
            logging.error(f"Twilio error: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to send OTP: {str(e)}")
    else:
        # Demo mode - generate and store OTP locally
        import random
        otp = str(random.randint(100000, 999999))
        otp_storage[phone] = {
            "code": otp,
            "expires": datetime.now(timezone.utc) + timedelta(minutes=10),
            "attempts": 0
        }
        logging.info(f"Demo OTP for {phone}: {otp}")
        return {
            "status": "pending", 
            "message": "Demo mode: OTP generated (check server logs)",
            "demo_otp": otp  # Remove this in production!
        }

@api_router.post("/auth/phone/verify-otp", response_model=PhoneLoginResponse)
async def verify_phone_otp(request: PhoneVerifyOTP):
    """Verify OTP and login/register user"""
    phone = request.phone_number.strip()
    code = request.code.strip()
    
    # Check if Twilio is configured
    twilio_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    twilio_token = os.environ.get('TWILIO_AUTH_TOKEN')
    twilio_verify_sid = os.environ.get('TWILIO_VERIFY_SERVICE_SID')
    
    is_valid = False
    
    if twilio_sid and twilio_token and twilio_verify_sid:
        # Verify with Twilio
        try:
            from twilio.rest import Client
            client = Client(twilio_sid, twilio_token)
            verification_check = client.verify.v2.services(twilio_verify_sid).verification_checks.create(
                to=phone, 
                code=code
            )
            is_valid = verification_check.status == "approved"
        except Exception as e:
            logging.error(f"Twilio verification error: {e}")
            raise HTTPException(status_code=400, detail="Verification failed")
    else:
        # Demo mode - check local storage
        if phone in otp_storage:
            stored = otp_storage[phone]
            if stored["expires"] > datetime.now(timezone.utc):
                if stored["code"] == code:
                    is_valid = True
                    del otp_storage[phone]  # Clear used OTP
                else:
                    stored["attempts"] += 1
                    if stored["attempts"] >= 3:
                        del otp_storage[phone]
                        raise HTTPException(status_code=400, detail="Too many failed attempts. Request new OTP.")
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    # Check if user exists
    existing_user = await db.users.find_one({"phone_number": phone}, {"_id": 0, "hashed_password": 0})
    is_new_user = False
    
    if existing_user:
        user_data = existing_user
    else:
        # Create new user with phone number
        is_new_user = True
        new_user = {
            "id": str(uuid.uuid4()),
            "phone_number": phone,
            "email": None,
            "name": f"User-{phone[-4:]}",  # Temporary name
            "dietary_restrictions": [],
            "cuisine_preferences": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
        # Remove MongoDB _id from response
        new_user.pop('_id', None)
        user_data = new_user
    
    # Generate JWT token
    token_data = {
        "sub": user_data["id"],
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    }
    access_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    
    return PhoneLoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_data,
        is_new_user=is_new_user
    )

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/auth/profile", response_model=User)
async def update_profile(profile_data: UserProfileUpdate, current_user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in profile_data.model_dump().items() if v is not None}
    
    if update_data:
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"id": current_user.id}, {"_id": 0, "hashed_password": 0})
    return User(**updated_user)


# Mood change detection patterns and mood mapping
MOOD_CHANGE_PATTERNS = [
    r"mood (has |is )?changed?",
    r"feeling different",
    r"not in that mood",
    r"changed my mind",
    r"actually.*feeling",
    r"now (feeling|i'm|i feel)",
    r"instead.*feeling",
]

MOOD_KEYWORDS = {
    "happy": ["happy", "joyful", "cheerful", "pleased", "delighted", "great", "wonderful"],
    "sad": ["sad", "down", "blue", "melancholy", "upset", "depressed"],
    "angry": ["angry", "mad", "furious", "irritated", "frustrated", "annoyed"],
    "excited": ["excited", "thrilled", "pumped", "enthusiastic", "hyped"],
    "calm": ["calm", "peaceful", "relaxed", "tranquil", "serene", "chill"],
    "stressed": ["stressed", "anxious", "tense", "overwhelmed", "worried"],
    "cozy": ["cozy", "comfortable", "snug", "warm", "content", "homey"],
    "romantic": ["romantic", "loving", "amorous", "intimate"],
    "energetic": ["energetic", "lively", "active", "vibrant", "dynamic"]
}

MOOD_RESPONSES = {
    "happy": {
        "acknowledgment": "I can feel your positive energy!",
        "description": "vibrant, fresh, and colorful dishes",
        "emotion": "Let's celebrate that wonderful feeling with bright flavors!",
        "message": "Bright, vibrant meals can enhance that wonderful feeling."
    },
    "sad": {
        "acknowledgment": "I understand you're feeling down.",
        "description": "comforting, warm, and nostalgic dishes",
        "emotion": "Let me suggest some soul-soothing comfort food to help.",
        "message": "Comforting meals can provide warmth when you need it most."
    },
    "angry": {
        "acknowledgment": "I understand you're feeling frustrated.",
        "description": "bold, spicy, and intense flavors",
        "emotion": "Sometimes strong flavors can be satisfying when emotions run high.",
        "message": "Bold flavors can be surprisingly satisfying."
    },
    "excited": {
        "acknowledgment": "I can sense your excitement!",
        "description": "fun, creative, and adventurous dishes",
        "emotion": "Let's match that energy with something special!",
        "message": "Adventurous dishes match that exciting energy!"
    },
    "calm": {
        "acknowledgment": "I understand you're seeking tranquility.",
        "description": "balanced, light, and zen-like dishes",
        "emotion": "Let's find peaceful, mindful meals that promote calm.",
        "message": "Balanced meals support peaceful moments."
    },
    "stressed": {
        "acknowledgment": "I understand you're feeling overwhelmed.",
        "description": "simple, quick, and stress-free meals",
        "emotion": "Let me suggest easy dishes that won't add to your stress.",
        "message": "Simple, easy meals mean one less thing to worry about."
    },
    "cozy": {
        "acknowledgment": "I understand you're craving comfort and warmth.",
        "description": "warm, hearty, and snuggly dishes",
        "emotion": "Let's bring that warmth to your meal!",
        "message": "Cozy meals are comforting and satisfying, just what you need to wrap up a day."
    },
    "romantic": {
        "acknowledgment": "I understand you're in a romantic mood.",
        "description": "elegant, intimate, and special dishes",
        "emotion": "Let's create something special for a romantic moment.",
        "message": "Special meals create memorable moments."
    },
    "energetic": {
        "acknowledgment": "I can feel your energy!",
        "description": "fresh, protein-packed, and revitalizing dishes",
        "emotion": "Let's fuel that vitality with energizing meals!",
        "message": "Nutritious meals sustain that great energy!"
    }
}


def detect_mood_change(message: str) -> dict:
    """Detect if user is indicating a mood change and extract new mood"""
    import re
    
    # Extract just the user message (after context if present)
    user_message = message
    if "[Context:" in message and "]" in message:
        context_end = message.find("]") + 1
        user_message = message[context_end:].strip()
    
    lower_msg = user_message.lower().strip()
    
    # Check for mood change indicators
    is_mood_change = False
    for pattern in MOOD_CHANGE_PATTERNS:
        if re.search(pattern, lower_msg):
            is_mood_change = True
            break
    
    # Also check for direct mood statements - prioritize words that appear LATER in the message
    detected_mood = None
    best_position = -1
    
    for mood, keywords in MOOD_KEYWORDS.items():
        for keyword in keywords:
            pos = lower_msg.find(keyword)
            if pos != -1 and pos > best_position:
                # Make sure it's not preceded by "from" (e.g., "changed from happy to cozy")
                prefix = lower_msg[max(0, pos-10):pos]
                if "from " not in prefix:
                    detected_mood = mood
                    best_position = pos
    
    # Check if this is a SHORT direct mood statement (user just typed the mood word)
    # This handles cases like user typing "cozy" after AI asks "How are you feeling?"
    word_count = len(lower_msg.split())
    is_direct_mood_response = detected_mood and word_count <= 5
    
    # If we detect a mood with context suggesting change OR it's a direct short response
    if detected_mood and (is_mood_change or is_direct_mood_response or "now" in lower_msg or "feeling" in lower_msg):
        return {"is_mood_change": True, "new_mood": detected_mood}
    elif is_mood_change:
        return {"is_mood_change": True, "new_mood": None}  # Need clarification
    
    return {"is_mood_change": False, "new_mood": None}


def get_mood_change_response(new_mood: str, dietary_pref: str = None, meal_type: str = None, cuisines: str = None) -> str:
    """Generate empathetic response for mood change"""
    mood_data = MOOD_RESPONSES.get(new_mood, MOOD_RESPONSES["happy"])
    
    # Build context-aware response
    dietary_text = f"a {dietary_pref}" if dietary_pref else "a"
    meal_text = meal_type if meal_type else "meal"
    cuisine_text = f" with {cuisines} flavors" if cuisines and cuisines != "any cuisine" else ""
    
    response = f"""{mood_data['acknowledgment']} If you're feeling {new_mood} and looking for {dietary_text} {meal_text}{cuisine_text}, {mood_data['emotion'].lower()}

It's great to personalize your meals to match your feelings. {mood_data['message']}

Would you like me to suggest some {mood_data['description']} that match your new mood?"""
    
    return response


def is_mood_change_request(message: str, context: dict = None) -> dict:
    """Detect mood change and prepare response data"""
    result = detect_mood_change(message)
    
    if result["is_mood_change"]:
        if result["new_mood"]:
            # Extract context from message if available
            dietary_pref = None
            meal_type = None
            cuisines = None
            
            if context:
                dietary_pref = context.get("dietary_pref")
                meal_type = context.get("meal_type") 
                cuisines = context.get("cuisines")
            
            return {
                "is_mood_change": True,
                "new_mood": result["new_mood"],
                "needs_clarification": False,
                "response": get_mood_change_response(result["new_mood"], dietary_pref, meal_type, cuisines)
            }
        else:
            return {
                "is_mood_change": True,
                "new_mood": None,
                "needs_clarification": True,
                "response": "I noticed your mood has changed. How are you feeling now? Are you feeling happy, sad, excited, calm, cozy, stressed, energetic, or something else?"
            }
    
    return {"is_mood_change": False}


# Helper to detect recipe generation requests from the frontend
def is_recipe_generation_request(message: str) -> dict:
    """Detect if message is a structured recipe request and extract parameters"""
    if "[User Preferences]" in message and "Please suggest" in message:
        # Parse the structured message from frontend
        lines = message.split("\n")
        params = {"mood": "", "meal_type": "", "dietary_pref": "", "cuisines": ""}
        for line in lines:
            if "- Mood:" in line:
                params["mood"] = line.split("- Mood:")[1].strip().split("(")[0].strip()
            elif "- Meal Type:" in line:
                params["meal_type"] = line.split("- Meal Type:")[1].strip()
            elif "- Dietary Preference:" in line:
                params["dietary_pref"] = line.split("- Dietary Preference:")[1].strip()
            elif "- Cuisine(s):" in line:
                params["cuisines"] = line.split("- Cuisine(s):")[1].strip()
        return params
    return None


# Chat endpoints
@api_router.post("/chat/send", response_model=ChatResponse)
async def send_chat_message(request: ChatRequest, current_user: User = Depends(get_current_user)):
    try:
        user_msg = ChatMessage(
            session_id=request.session_id,
            role="user",
            content=request.message
        )
        await db.chat_messages.insert_one({
            **user_msg.model_dump(),
            "timestamp": user_msg.timestamp.isoformat(),
            "user_id": current_user.id
        })
        
        # Extract context from message if provided
        context = {}
        if "[Context:" in request.message:
            context_match = request.message.split("[Context:")[1].split("]")[0] if "[Context:" in request.message else ""
            for part in context_match.split(","):
                if "=" in part:
                    key, value = part.strip().split("=", 1)
                    if value and value.lower() != "not set":
                        context[key.lower().replace("dietary", "dietary_pref").replace("mealtype", "meal_type")] = value
        
        # Check if this is a mood change request FIRST
        mood_change = is_mood_change_request(request.message, context)
        
        if mood_change.get("is_mood_change"):
            # Handle mood change
            if mood_change.get("needs_clarification"):
                ai_response = mood_change["response"]
            else:
                new_mood = mood_change.get("new_mood")
                ai_response = mood_change["response"]
                logging.info(f"Mood change detected: new_mood={new_mood}")
            
            assistant_msg = ChatMessage(
                session_id=request.session_id,
                role="assistant",
                content=ai_response
            )
            await db.chat_messages.insert_one({
                **assistant_msg.model_dump(),
                "timestamp": assistant_msg.timestamp.isoformat(),
                "user_id": current_user.id
            })
            
            return ChatResponse(
                session_id=request.session_id,
                response=ai_response,
                timestamp=assistant_msg.timestamp
            )
        
        # Check if this is a recipe generation request
        recipe_params = is_recipe_generation_request(request.message)
        
        if recipe_params:
            # Use optimized recipe generation prompt
            system_msg = get_recipe_generation_prompt(
                mood=recipe_params["mood"],
                meal_type=recipe_params["meal_type"],
                dietary_pref=recipe_params["dietary_pref"],
                cuisines=recipe_params["cuisines"]
            )
            # Add user dietary restrictions if any
            if current_user.dietary_restrictions:
                system_msg += f"\n\nDIETARY RESTRICTIONS: {', '.join(current_user.dietary_restrictions)}. All recipes MUST comply."
            
            # Simplified user message for recipe generation
            user_text = f"Generate 6 {recipe_params['meal_type'].lower()} recipes for someone feeling {recipe_params['mood'].lower()}, preferring {recipe_params['dietary_pref'].lower()} {recipe_params['cuisines']} cuisine."
            logging.info(f"Recipe generation request: {recipe_params}")
        else:
            # Use general conversational system message
            system_msg = get_system_message(current_user.dietary_restrictions, current_user.cuisine_preferences)
            user_text = request.message
        
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=f"{request.session_id}-{uuid.uuid4().hex[:8]}",  # Unique session to avoid context buildup
            system_message=system_msg
        )
        # Use gpt-4o-mini for faster recipe generation, gpt-4o for general chat
        model_name = "gpt-4o-mini" if recipe_params else "gpt-4o"
        chat.with_model("openai", model_name)
        
        user_message = UserMessage(text=user_text)
        ai_response = await chat.send_message(user_message)
        
        assistant_msg = ChatMessage(
            session_id=request.session_id,
            role="assistant",
            content=ai_response
        )
        await db.chat_messages.insert_one({
            **assistant_msg.model_dump(),
            "timestamp": assistant_msg.timestamp.isoformat(),
            "user_id": current_user.id
        })
        
        return ChatResponse(
            session_id=request.session_id,
            response=ai_response,
            timestamp=assistant_msg.timestamp
        )
    except Exception as e:
        logging.error(f"Error in chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str, current_user: User = Depends(get_current_user)):
    try:
        messages = await db.chat_messages.find(
            {"session_id": session_id, "user_id": current_user.id},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(100)
        
        for msg in messages:
            if isinstance(msg.get('timestamp'), str):
                msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
        
        return {"messages": messages}
    except Exception as e:
        logging.error(f"Error fetching history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Detailed Recipe Generation Request Model
class DetailedRecipeRequest(BaseModel):
    recipe_title: str
    cuisine: str = "International"
    meal_type: str = "Dinner"
    dietary_pref: str = "Any"


@api_router.post("/recipes/detailed")
async def get_detailed_recipe(request: DetailedRecipeRequest, current_user: User = Depends(get_current_user)):
    """Generate a comprehensive detailed recipe with professional-grade instructions"""
    try:
        logging.info(f"Generating detailed recipe for: {request.recipe_title}")
        
        # Check cache first (in database)
        cached = await db.detailed_recipes.find_one(
            {"title_lower": request.recipe_title.lower().strip()},
            {"_id": 0}
        )
        if cached and cached.get("detailed_content"):
            logging.info(f"Found cached detailed recipe for: {request.recipe_title}")
            return {"recipe": cached["detailed_content"], "cached": True}
        
        # Generate new detailed recipe
        system_msg = get_detailed_recipe_prompt(
            recipe_title=request.recipe_title,
            cuisine=request.cuisine,
            meal_type=request.meal_type,
            dietary_pref=request.dietary_pref
        )
        
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=f"detailed-{uuid.uuid4().hex[:8]}",
            system_message=system_msg
        )
        chat.with_model("openai", "gpt-4o")  # Use gpt-4o for detailed recipes (better quality)
        
        user_message = UserMessage(text=f"Generate the complete detailed recipe for {request.recipe_title}")
        detailed_content = await chat.send_message(user_message)
        
        # Cache in database
        await db.detailed_recipes.update_one(
            {"title_lower": request.recipe_title.lower().strip()},
            {
                "$set": {
                    "title": request.recipe_title,
                    "title_lower": request.recipe_title.lower().strip(),
                    "cuisine": request.cuisine,
                    "meal_type": request.meal_type,
                    "dietary_pref": request.dietary_pref,
                    "detailed_content": detailed_content,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "user_id": current_user.id
                }
            },
            upsert=True
        )
        
        return {"recipe": detailed_content, "cached": False}
    except Exception as e:
        logging.error(f"Error generating detailed recipe: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Recipe endpoints
@api_router.post("/recipes/save", response_model=SavedRecipe)
async def save_recipe(request: SaveRecipeRequest, current_user: User = Depends(get_current_user)):
    try:
        recipe = Recipe(**request.recipe.model_dump())
        
        # Fetch image if not provided
        if not recipe.image_url:
            recipe.image_url = get_food_image(recipe.title)
        
        recipe_dict = recipe.model_dump()
        recipe_dict['created_at'] = recipe_dict['created_at'].isoformat()
        await db.recipes.insert_one(recipe_dict)
        
        saved = SavedRecipe(user_id=current_user.id, recipe_id=recipe.id)
        saved_dict = saved.model_dump()
        saved_dict['saved_at'] = saved_dict['saved_at'].isoformat()
        await db.saved_recipes.insert_one(saved_dict)
        
        return saved
    except Exception as e:
        logging.error(f"Error saving recipe: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/recipes/saved")
async def get_saved_recipes(current_user: User = Depends(get_current_user)):
    try:
        saved = await db.saved_recipes.find({"user_id": current_user.id}, {"_id": 0}).to_list(100)
        recipe_ids = [s['recipe_id'] for s in saved]
        
        recipes = await db.recipes.find({"id": {"$in": recipe_ids}}, {"_id": 0}).to_list(100)
        
        return {"recipes": recipes}
    except Exception as e:
        logging.error(f"Error fetching saved recipes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/recipes/{recipe_id}/add-to-shopping-list")
async def add_recipe_to_shopping_list(recipe_id: str, current_user: User = Depends(get_current_user)):
    try:
        recipe = await db.recipes.find_one({"id": recipe_id}, {"_id": 0})
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        existing_list = await db.shopping_lists.find_one({"user_id": current_user.id}, {"_id": 0})
        
        new_items = [{"name": ingredient, "checked": False} for ingredient in recipe['ingredients']]
        
        if existing_list:
            updated_items = existing_list['items'] + new_items
            update_time = datetime.now(timezone.utc)
            await db.shopping_lists.update_one(
                {"user_id": current_user.id},
                {"$set": {
                    "items": updated_items,
                    "updated_at": update_time.isoformat()
                }}
            )
        else:
            shopping_list = ShoppingList(user_id=current_user.id, items=new_items)
            list_dict = shopping_list.model_dump()
            list_dict['created_at'] = list_dict['created_at'].isoformat()
            list_dict['updated_at'] = list_dict['updated_at'].isoformat()
            await db.shopping_lists.insert_one(list_dict)
        
        return {"message": "Ingredients added to shopping list", "items_added": len(new_items)}
    except Exception as e:
        logging.error(f"Error adding to shopping list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Shopping list endpoints
@api_router.post("/shopping-list", response_model=ShoppingList)
async def create_or_update_shopping_list(request: ShoppingListCreate, current_user: User = Depends(get_current_user)):
    try:
        existing = await db.shopping_lists.find_one({"user_id": current_user.id}, {"_id": 0})
        
        if existing:
            update_time = datetime.now(timezone.utc)
            await db.shopping_lists.update_one(
                {"user_id": current_user.id},
                {"$set": {
                    "items": request.items,
                    "updated_at": update_time.isoformat()
                }}
            )
            existing['items'] = request.items
            existing['updated_at'] = update_time
            return ShoppingList(**existing)
        else:
            shopping_list = ShoppingList(
                user_id=current_user.id,
                items=request.items
            )
            list_dict = shopping_list.model_dump()
            list_dict['created_at'] = list_dict['created_at'].isoformat()
            list_dict['updated_at'] = list_dict['updated_at'].isoformat()
            await db.shopping_lists.insert_one(list_dict)
            return shopping_list
    except Exception as e:
        logging.error(f"Error with shopping list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/shopping-list")
async def get_shopping_list(current_user: User = Depends(get_current_user)):
    try:
        shopping_list = await db.shopping_lists.find_one({"user_id": current_user.id}, {"_id": 0})
        if not shopping_list:
            return {"items": []}
        return shopping_list
    except Exception as e:
        logging.error(f"Error fetching shopping list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Weekly plan endpoints
@api_router.post("/weekly-plan", response_model=WeeklyPlan)
async def create_weekly_plan(request: WeeklyPlanCreate, current_user: User = Depends(get_current_user)):
    try:
        plan = WeeklyPlan(user_id=current_user.id, **request.model_dump())
        plan_dict = plan.model_dump()
        plan_dict['created_at'] = plan_dict['created_at'].isoformat()
        await db.weekly_plans.insert_one(plan_dict)
        return plan
    except Exception as e:
        logging.error(f"Error creating weekly plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/weekly-plan")
async def get_weekly_plans(current_user: User = Depends(get_current_user)):
    try:
        plans = await db.weekly_plans.find({"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(10)
        return {"plans": plans}
    except Exception as e:
        logging.error(f"Error fetching weekly plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# AI-powered meal plan generation
@api_router.post("/weekly-plan/generate")
async def generate_weekly_plan(request: AIWeeklyPlanRequest, current_user: User = Depends(get_current_user)):
    try:
        meals = await generate_ai_meal_plan(
            current_user,
            request.mood,
            request.dietary_preference,
            request.calorie_target,
            request.focus_areas,
            request.cuisine_preferences
        )
        
        # Save the generated plan
        today = datetime.now(timezone.utc)
        week_start = today - timedelta(days=today.weekday())
        
        plan = WeeklyPlan(
            user_id=current_user.id,
            week_start=week_start.strftime('%Y-%m-%d'),
            meals=meals
        )
        plan_dict = plan.model_dump()
        plan_dict['created_at'] = plan_dict['created_at'].isoformat()
        await db.weekly_plans.insert_one(plan_dict)
        
        return {"plan": plan, "message": "AI meal plan generated successfully!"}
    except Exception as e:
        logging.error(f"Error generating AI meal plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== CONTINUOUS MEAL PLANNING ==============

@api_router.post("/meal-preferences")
async def save_meal_preferences(request: MealPreferencesCreate, current_user: User = Depends(get_current_user)):
    """Save user meal preferences for continuous planning"""
    try:
        # Update or create preferences
        prefs = MealPreferences(
            user_id=current_user.id,
            **request.model_dump()
        )
        prefs_dict = prefs.model_dump()
        prefs_dict['created_at'] = prefs_dict['created_at'].isoformat()
        prefs_dict['updated_at'] = prefs_dict['updated_at'].isoformat()
        
        await db.meal_preferences.update_one(
            {"user_id": current_user.id},
            {"$set": prefs_dict},
            upsert=True
        )
        
        # If active, generate the first week's plan immediately
        if request.is_active:
            today = datetime.now(timezone.utc)
            week_start = today - timedelta(days=today.weekday())
            week_start_str = week_start.strftime('%Y-%m-%d')
            
            # Check if plan already exists for this week
            existing = await db.weekly_plans.find_one({
                "user_id": current_user.id,
                "week_start": week_start_str
            })
            
            if not existing:
                # Get previously used recipes
                used_recipes = await get_used_recipes(current_user.id)
                
                # Generate new plan
                meals = await generate_ai_meal_plan(
                    current_user,
                    request.mood,
                    request.dietary_preference,
                    request.calorie_target,
                    request.focus_areas,
                    request.cuisine_preferences,
                    exclude_recipes=used_recipes
                )
                
                # Save the plan
                plan = WeeklyPlan(
                    user_id=current_user.id,
                    week_start=week_start_str,
                    meals=meals
                )
                plan_dict = plan.model_dump()
                plan_dict['created_at'] = plan_dict['created_at'].isoformat()
                await db.weekly_plans.insert_one(plan_dict)
                
                # Track used recipes
                await track_used_recipes(current_user.id, meals, week_start_str)
        
        return {"message": "Meal preferences saved successfully!", "preferences": prefs_dict}
    except Exception as e:
        logging.error(f"Error saving meal preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/meal-preferences")
async def get_meal_preferences(current_user: User = Depends(get_current_user)):
    """Get user's saved meal preferences"""
    try:
        prefs = await db.meal_preferences.find_one(
            {"user_id": current_user.id},
            {"_id": 0}
        )
        return {"preferences": prefs}
    except Exception as e:
        logging.error(f"Error fetching meal preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class WeekOffsetRequest(BaseModel):
    week_offset: int = 0


@api_router.post("/weekly-plan/generate-for-week")
async def generate_plan_for_week(request: WeekOffsetRequest, current_user: User = Depends(get_current_user)):
    """Generate plan for a specific week (by offset from current week) using saved preferences"""
    try:
        # Get saved preferences
        prefs = await db.meal_preferences.find_one(
            {"user_id": current_user.id},
            {"_id": 0}
        )
        if not prefs:
            raise HTTPException(status_code=400, detail="No meal preferences found. Please set your preferences first.")
        
        # Calculate target week's start date
        today = datetime.now(timezone.utc)
        current_week_start = today - timedelta(days=today.weekday())
        target_week_start = current_week_start + timedelta(days=request.week_offset * 7)
        target_week_str = target_week_start.strftime('%Y-%m-%d')
        
        # Check if plan already exists
        existing = await db.weekly_plans.find_one(
            {"user_id": current_user.id, "week_start": target_week_str},
            {"_id": 0}
        )
        
        if existing:
            return {"message": "Plan for this week already exists", "plan": existing, "already_exists": True}
        
        # Get previously used recipes (last 8 weeks to ensure variety)
        used_recipes = await get_used_recipes(current_user.id, weeks=8)
        
        # Generate new plan
        meals = await generate_ai_meal_plan(
            current_user,
            prefs.get('mood', 'balanced'),
            prefs.get('dietary_preference', 'non-vegetarian'),
            prefs.get('calorie_target'),
            prefs.get('focus_areas', []),
            prefs.get('cuisine_preferences', []),
            exclude_recipes=used_recipes
        )
        
        # Save the plan
        plan = WeeklyPlan(
            user_id=current_user.id,
            week_start=target_week_str,
            meals=meals
        )
        plan_dict = plan.model_dump()
        plan_dict['created_at'] = plan_dict['created_at'].isoformat()
        await db.weekly_plans.insert_one(plan_dict)
        
        # Remove _id before returning
        plan_dict.pop('_id', None)
        
        # Track used recipes
        await track_used_recipes(current_user.id, meals, target_week_str)
        
        return {"message": f"Meal plan for week of {target_week_str} generated!", "plan": plan_dict, "already_exists": False}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error generating plan for week: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/weekly-plan/generate-next")
async def generate_next_week_plan(current_user: User = Depends(get_current_user)):
    """Generate plan for the next week using saved preferences"""
    try:
        # Get saved preferences
        prefs = await db.meal_preferences.find_one(
            {"user_id": current_user.id},
            {"_id": 0}
        )
        if not prefs:
            raise HTTPException(status_code=400, detail="No meal preferences found. Please set your preferences first.")
        
        if not prefs.get('is_active', False):
            raise HTTPException(status_code=400, detail="Continuous planning is not active. Enable it in preferences.")
        
        # Calculate next week's start date
        today = datetime.now(timezone.utc)
        current_week_start = today - timedelta(days=today.weekday())
        next_week_start = current_week_start + timedelta(days=7)
        next_week_str = next_week_start.strftime('%Y-%m-%d')
        
        # Check if plan already exists
        existing = await db.weekly_plans.find_one(
            {"user_id": current_user.id, "week_start": next_week_str},
            {"_id": 0}
        )
        
        if existing:
            return {"message": "Plan for next week already exists", "plan": existing, "already_exists": True}
        
        # Get previously used recipes (last 8 weeks to ensure variety)
        used_recipes = await get_used_recipes(current_user.id, weeks=8)
        
        # Generate new plan
        meals = await generate_ai_meal_plan(
            current_user,
            prefs.get('mood', 'balanced'),
            prefs.get('dietary_preference', 'non-vegetarian'),
            prefs.get('calorie_target'),
            prefs.get('focus_areas', []),
            prefs.get('cuisine_preferences', []),
            exclude_recipes=used_recipes
        )
        
        # Save the plan
        plan = WeeklyPlan(
            user_id=current_user.id,
            week_start=next_week_str,
            meals=meals
        )
        plan_dict = plan.model_dump()
        plan_dict['created_at'] = plan_dict['created_at'].isoformat()
        await db.weekly_plans.insert_one(plan_dict)
        
        # Remove _id before returning (MongoDB adds it during insert)
        plan_dict.pop('_id', None)
        
        # Track used recipes
        await track_used_recipes(current_user.id, meals, next_week_str)
        
        return {"message": "Next week's meal plan generated!", "plan": plan_dict, "already_exists": False}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error generating next week plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/weekly-plan/current")
async def get_current_week_plan(current_user: User = Depends(get_current_user)):
    """Get the meal plan for the current week"""
    try:
        today = datetime.now(timezone.utc)
        week_start = today - timedelta(days=today.weekday())
        week_start_str = week_start.strftime('%Y-%m-%d')
        
        plan = await db.weekly_plans.find_one(
            {"user_id": current_user.id, "week_start": week_start_str},
            {"_id": 0}
        )
        
        # Also get preferences
        prefs = await db.meal_preferences.find_one(
            {"user_id": current_user.id},
            {"_id": 0}
        )
        
        return {
            "plan": plan,
            "preferences": prefs,
            "week_start": week_start_str,
            "has_plan": plan is not None,
            "has_preferences": prefs is not None
        }
    except Exception as e:
        logging.error(f"Error fetching current week plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def get_used_recipes(user_id: str, weeks: int = 8) -> List[str]:
    """Get list of recipes used in the last N weeks"""
    try:
        cutoff_date = datetime.now(timezone.utc) - timedelta(weeks=weeks)
        cutoff_str = cutoff_date.strftime('%Y-%m-%d')
        
        used = await db.used_recipes.find(
            {"user_id": user_id, "week_start": {"$gte": cutoff_str}}
        ).to_list(length=500)
        
        return [r['recipe_name'] for r in used]
    except Exception as e:
        logging.error(f"Error getting used recipes: {e}")
        return []


async def track_used_recipes(user_id: str, meals: Dict, week_start: str):
    """Track recipes used in a weekly plan to avoid repetition"""
    try:
        recipes_to_track = []
        for day, day_meals in meals.items():
            for meal_type, recipe_name in day_meals.items():
                # Clean recipe name (remove calorie info if present)
                clean_name = recipe_name.split('(~')[0].strip() if '(~' in recipe_name else recipe_name
                recipes_to_track.append({
                    "user_id": user_id,
                    "recipe_name": clean_name,
                    "used_date": datetime.now(timezone.utc).isoformat(),
                    "week_start": week_start
                })
        
        if recipes_to_track:
            await db.used_recipes.insert_many(recipes_to_track)
    except Exception as e:
        logging.error(f"Error tracking used recipes: {e}")


# ============== RECIPE SUBSCRIPTION ==============
class RecipeSubscription(BaseModel):
    email: str
    dietary_preference: str
    cuisines: List[str]
    recipes_per_week: int = 5
    delivery_day: str = "Sunday"

@api_router.post("/subscription/recipes")
async def subscribe_to_recipes(request: RecipeSubscription, current_user: User = Depends(get_current_user)):
    """Subscribe to weekly recipe newsletter"""
    try:
        subscription = {
            "user_id": current_user.id,
            "email": request.email,
            "dietary_preference": request.dietary_preference,
            "cuisines": request.cuisines,
            "recipes_per_week": request.recipes_per_week,
            "delivery_day": request.delivery_day,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Upsert - update if exists, create if not
        await db.recipe_subscriptions.update_one(
            {"user_id": current_user.id},
            {"$set": subscription},
            upsert=True
        )
        
        # In production, integrate with email service like SendGrid
        # For now, just store the subscription
        logging.info(f"New recipe subscription: {request.email}")
        
        return {"status": "subscribed", "message": "Successfully subscribed to weekly recipes!"}
    except Exception as e:
        logging.error(f"Subscription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/subscription/recipes")
async def get_subscription_status(current_user: User = Depends(get_current_user)):
    """Get user's subscription status"""
    try:
        subscription = await db.recipe_subscriptions.find_one(
            {"user_id": current_user.id, "active": True},
            {"_id": 0}
        )
        return {"subscribed": subscription is not None, "subscription": subscription}
    except Exception as e:
        logging.error(f"Error fetching subscription: {e}")
        return {"subscribed": False, "subscription": None}

@api_router.delete("/subscription/recipes")
async def unsubscribe_from_recipes(current_user: User = Depends(get_current_user)):
    """Unsubscribe from weekly recipes"""
    try:
        await db.recipe_subscriptions.update_one(
            {"user_id": current_user.id},
            {"$set": {"active": False}}
        )
        return {"status": "unsubscribed", "message": "Successfully unsubscribed"}
    except Exception as e:
        logging.error(f"Unsubscribe error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Recipe rating and review endpoints
@api_router.post("/recipes/{recipe_id}/rate")
async def rate_recipe(recipe_id: str, rating_data: RatingCreate, current_user: User = Depends(get_current_user)):
    try:
        # Check if user already rated this recipe
        existing_rating = await db.recipe_ratings.find_one({
            "user_id": current_user.id,
            "recipe_id": recipe_id
        }, {"_id": 0})
        
        if existing_rating:
            # Update existing rating
            await db.recipe_ratings.update_one(
                {"user_id": current_user.id, "recipe_id": recipe_id},
                {"$set": {
                    "rating": rating_data.rating,
                    "review": rating_data.review
                }}
            )
            return {"message": "Rating updated successfully"}
        else:
            # Create new rating
            rating = RecipeRating(
                user_id=current_user.id,
                recipe_id=recipe_id,
                rating=rating_data.rating,
                review=rating_data.review
            )
            rating_dict = rating.model_dump()
            rating_dict['created_at'] = rating_dict['created_at'].isoformat()
            await db.recipe_ratings.insert_one(rating_dict)
            return {"message": "Rating added successfully"}
    except Exception as e:
        logging.error(f"Error rating recipe: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/recipes/{recipe_id}/ratings")
async def get_recipe_ratings(recipe_id: str):
    try:
        ratings = await db.recipe_ratings.find({"recipe_id": recipe_id}, {"_id": 0}).to_list(100)
        if not ratings:
            return {"average_rating": 0, "total_ratings": 0, "ratings": []}
        
        avg_rating = sum(r['rating'] for r in ratings) / len(ratings)
        return {
            "average_rating": round(avg_rating, 1),
            "total_ratings": len(ratings),
            "ratings": ratings
        }
    except Exception as e:
        logging.error(f"Error fetching ratings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Recipe search and filter
@api_router.post("/recipes/search")
async def search_recipes(search_params: RecipeSearchRequest, current_user: User = Depends(get_current_user)):
    try:
        # Build search query
        query = {}
        
        # Get user's saved recipe IDs
        saved = await db.saved_recipes.find({"user_id": current_user.id}, {"_id": 0, "recipe_id": 1}).to_list(100)
        saved_ids = [s['recipe_id'] for s in saved]
        query["id"] = {"$in": saved_ids}
        
        # Text search
        if search_params.query:
            query["$or"] = [
                {"title": {"$regex": search_params.query, "$options": "i"}},
                {"description": {"$regex": search_params.query, "$options": "i"}}
            ]
        
        # Mood tags filter
        if search_params.mood_tags:
            query["mood_tags"] = {"$in": search_params.mood_tags}
        
        # Dietary tags filter
        if search_params.dietary_tags:
            query["dietary_info"] = {"$all": search_params.dietary_tags}
        
        # Complexity filter
        if search_params.complexity:
            query["complexity"] = search_params.complexity
        
        recipes = await db.recipes.find(query, {"_id": 0}).to_list(100)
        return {"recipes": recipes}
    except Exception as e:
        logging.error(f"Error searching recipes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Meal prep reminders
@api_router.post("/reminders")
async def create_reminder(reminder_data: ReminderCreate, current_user: User = Depends(get_current_user)):
    try:
        reminder = MealReminder(user_id=current_user.id, **reminder_data.model_dump())
        reminder_dict = reminder.model_dump()
        reminder_dict['created_at'] = reminder_dict['created_at'].isoformat()
        await db.meal_reminders.insert_one(reminder_dict)
        return reminder
    except Exception as e:
        logging.error(f"Error creating reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/reminders")
async def get_reminders(current_user: User = Depends(get_current_user)):
    try:
        reminders = await db.meal_reminders.find({"user_id": current_user.id}, {"_id": 0}).to_list(100)
        return {"reminders": reminders}
    except Exception as e:
        logging.error(f"Error fetching reminders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, current_user: User = Depends(get_current_user)):
    try:
        result = await db.meal_reminders.delete_one({"id": reminder_id, "user_id": current_user.id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Reminder not found")
        return {"message": "Reminder deleted successfully"}
    except Exception as e:
        logging.error(f"Error deleting reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# PDF export for shopping list
@api_router.get("/shopping-list/export")
async def export_shopping_list_pdf(current_user: User = Depends(get_current_user)):
    try:
        shopping_list = await db.shopping_lists.find_one({"user_id": current_user.id}, {"_id": 0})
        items = shopping_list.get('items', []) if shopping_list else []
        
        pdf_buffer = generate_shopping_list_pdf(items, current_user.name)
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=shopping_list_{datetime.now().strftime('%Y%m%d')}.pdf"}
        )
    except Exception as e:
        logging.error(f"Error exporting shopping list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Voice endpoints
@api_router.post("/voice/transcribe", response_model=VoiceTranscriptionResponse)
async def transcribe_voice(
    audio: UploadFile = File(...),
    language: str = 'en',
    current_user: User = Depends(get_current_user)
):
    """
    Transcribe audio to text using Whisper with language support.
    OPTIMIZED for faster response.
    """
    try:
        # Read audio file
        audio_content = await audio.read()
        audio_file = BytesIO(audio_content)
        audio_file.name = audio.filename or "audio.webm"
        
        # Transcribe with language hint for faster processing
        text = await transcribe_audio(audio_file, os.environ['EMERGENT_LLM_KEY'], language=language)
        
        # Detect mood from transcribed text
        detected_mood = detect_mood_from_text(text)
        
        return VoiceTranscriptionResponse(
            text=text,
            detected_mood=detected_mood if detected_mood != 'default' else None
        )
    except Exception as e:
        logging.error(f"Error transcribing audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/voice/synthesize", response_model=VoiceSynthesisResponse)
async def synthesize_speech(
    request: VoiceSynthesisRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Convert text to speech with mood-appropriate voice.
    OPTIMIZED: Using tts-1 model for 2x faster response.
    """
    try:
        # Detect mood if not provided
        mood = request.mood or detect_mood_from_text(request.text)
        
        # Generate speech (optimized with tts-1 and text truncation)
        audio_base64 = await generate_mood_aware_speech(
            text=request.text,
            mood=mood,
            api_key=os.environ['EMERGENT_LLM_KEY'],
            language=request.language or 'en',
            model="tts-1",  # Faster model
            return_base64=True
        )
        
        voice_description = get_voice_description(mood)
        
        return VoiceSynthesisResponse(
            audio_base64=audio_base64,
            mood=mood,
            voice_description=voice_description
        )
    except Exception as e:
        logging.error(f"Error synthesizing speech: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/voice/languages", response_model=LanguagesResponse)
async def get_supported_languages():
    """
    Get list of supported languages for voice features.
    """
    from voice_service import SUPPORTED_LANGUAGES
    return LanguagesResponse(languages=SUPPORTED_LANGUAGES)

@api_router.get("/voice/languages", response_model=LanguagesResponse)
async def get_supported_languages():
    """
    Get list of supported languages for voice features.
    """
    from voice_service import SUPPORTED_LANGUAGES
    return LanguagesResponse(languages=SUPPORTED_LANGUAGES)

# Recipe discovery endpoint - curated recipes organized by cuisine
@api_router.post("/recipes/discover")
async def discover_recipes(request: RecipeSearchRequest, current_user: User = Depends(get_current_user)):
    """
    Discover curated recipes organized by cuisine.
    Returns authentic recipes with images, descriptions, cooking times, and difficulty levels.
    """
    try:
        # Define cuisine-specific recipes database
        CUISINE_RECIPES = {
            'Indian': [
                {'title': 'Butter Chicken', 'description': 'Creamy tomato-based curry with tender chicken, rich with butter and aromatic spices', 'cooking_time': '50 min', 'difficulty': 'Medium'},
                {'title': 'Palak Paneer', 'description': 'Spinach curry with cottage cheese cubes in a creamy, mildly spiced gravy', 'cooking_time': '35 min', 'difficulty': 'Easy'},
                {'title': 'Chicken Biryani', 'description': 'Fragrant basmati rice layered with marinated chicken and aromatic spices', 'cooking_time': '90 min', 'difficulty': 'Hard'},
                {'title': 'Dal Tadka', 'description': 'Yellow lentils tempered with cumin, garlic, and ghee', 'cooking_time': '30 min', 'difficulty': 'Easy'},
                {'title': 'Chole Bhature', 'description': 'Spiced chickpea curry served with fluffy fried bread', 'cooking_time': '60 min', 'difficulty': 'Medium'},
            ],
            'Chinese': [
                {'title': 'Kung Pao Chicken', 'description': 'Spicy stir-fried chicken with peanuts, vegetables, and chili peppers', 'cooking_time': '25 min', 'difficulty': 'Easy'},
                {'title': 'Mapo Tofu', 'description': 'Silky tofu in a spicy Sichuan peppercorn sauce with minced pork', 'cooking_time': '30 min', 'difficulty': 'Medium'},
                {'title': 'Dim Sum Dumplings', 'description': 'Steamed dumplings filled with pork, shrimp, or vegetables', 'cooking_time': '60 min', 'difficulty': 'Hard'},
                {'title': 'Sweet and Sour Pork', 'description': 'Crispy pork pieces in tangy sweet and sour sauce with bell peppers', 'cooking_time': '35 min', 'difficulty': 'Medium'},
                {'title': 'Fried Rice', 'description': 'Wok-tossed rice with eggs, vegetables, and savory soy sauce', 'cooking_time': '20 min', 'difficulty': 'Easy'},
            ],
            'Italian': [
                {'title': 'Spaghetti Carbonara', 'description': 'Classic Roman pasta with eggs, pecorino cheese, guanciale, and black pepper', 'cooking_time': '20 min', 'difficulty': 'Easy'},
                {'title': 'Osso Buco', 'description': 'Braised veal shanks with vegetables, white wine, and broth', 'cooking_time': '120 min', 'difficulty': 'Hard'},
                {'title': 'Margherita Pizza', 'description': 'Classic pizza with tomato, fresh mozzarella, basil, and olive oil', 'cooking_time': '30 min', 'difficulty': 'Medium'},
                {'title': 'Risotto alla Milanese', 'description': 'Creamy saffron-infused rice with parmesan cheese', 'cooking_time': '45 min', 'difficulty': 'Medium'},
                {'title': 'Tiramisu', 'description': 'Layered coffee-soaked ladyfingers with mascarpone cream', 'cooking_time': '30 min', 'difficulty': 'Easy'},
            ],
            'Mexican': [
                {'title': 'Tacos al Pastor', 'description': 'Marinated pork with pineapple, cilantro, and onions in corn tortillas', 'cooking_time': '40 min', 'difficulty': 'Easy'},
                {'title': 'Mole Poblano', 'description': 'Complex sauce with chocolate, chilies, and spices served over chicken', 'cooking_time': '120 min', 'difficulty': 'Hard'},
                {'title': 'Guacamole', 'description': 'Fresh avocado dip with lime, cilantro, tomatoes, and jalapeño', 'cooking_time': '15 min', 'difficulty': 'Easy'},
                {'title': 'Enchiladas Verdes', 'description': 'Rolled tortillas in tangy green tomatillo sauce with cheese', 'cooking_time': '45 min', 'difficulty': 'Medium'},
                {'title': 'Pozole Rojo', 'description': 'Traditional hominy soup with pork in rich red chile broth', 'cooking_time': '90 min', 'difficulty': 'Medium'},
            ],
            'Japanese': [
                {'title': 'Tonkotsu Ramen', 'description': 'Rich pork bone broth with noodles, chashu pork, and soft-boiled egg', 'cooking_time': '180 min', 'difficulty': 'Hard'},
                {'title': 'Chicken Teriyaki', 'description': 'Glazed chicken with sweet and savory teriyaki sauce', 'cooking_time': '25 min', 'difficulty': 'Easy'},
                {'title': 'Sushi Rolls', 'description': 'Vinegared rice with fresh fish and vegetables rolled in seaweed', 'cooking_time': '45 min', 'difficulty': 'Medium'},
                {'title': 'Katsu Curry', 'description': 'Crispy breaded pork cutlet with Japanese curry sauce', 'cooking_time': '40 min', 'difficulty': 'Medium'},
                {'title': 'Miso Soup', 'description': 'Traditional soup with fermented soybean paste, tofu, and wakame', 'cooking_time': '15 min', 'difficulty': 'Easy'},
            ],
            'Thai': [
                {'title': 'Pad Thai', 'description': 'Stir-fried rice noodles with shrimp, tofu, peanuts, and tamarind sauce', 'cooking_time': '30 min', 'difficulty': 'Easy'},
                {'title': 'Green Curry', 'description': 'Coconut milk curry with green chilies, Thai basil, and vegetables', 'cooking_time': '35 min', 'difficulty': 'Medium'},
                {'title': 'Tom Yum Soup', 'description': 'Hot and sour soup with lemongrass, galangal, and lime leaves', 'cooking_time': '25 min', 'difficulty': 'Easy'},
                {'title': 'Massaman Curry', 'description': 'Rich curry with potatoes, peanuts, and warm spices', 'cooking_time': '60 min', 'difficulty': 'Medium'},
                {'title': 'Mango Sticky Rice', 'description': 'Sweet coconut sticky rice with fresh ripe mango slices', 'cooking_time': '40 min', 'difficulty': 'Easy'},
            ],
            'Mediterranean': [
                {'title': 'Greek Moussaka', 'description': 'Layered eggplant casserole with meat sauce and béchamel', 'cooking_time': '90 min', 'difficulty': 'Medium'},
                {'title': 'Falafel', 'description': 'Crispy chickpea fritters with tahini sauce and fresh vegetables', 'cooking_time': '40 min', 'difficulty': 'Easy'},
                {'title': 'Shakshuka', 'description': 'Poached eggs in spicy tomato and pepper sauce with herbs', 'cooking_time': '30 min', 'difficulty': 'Easy'},
                {'title': 'Hummus', 'description': 'Creamy chickpea dip with tahini, lemon, and garlic', 'cooking_time': '15 min', 'difficulty': 'Easy'},
                {'title': 'Lamb Kebabs', 'description': 'Grilled spiced lamb skewers with yogurt sauce', 'cooking_time': '35 min', 'difficulty': 'Medium'},
            ],
            'Korean': [
                {'title': 'Bibimbap', 'description': 'Mixed rice bowl with vegetables, egg, meat, and gochujang sauce', 'cooking_time': '40 min', 'difficulty': 'Medium'},
                {'title': 'Bulgogi', 'description': 'Marinated beef grilled and served with lettuce wraps', 'cooking_time': '30 min', 'difficulty': 'Easy'},
                {'title': 'Kimchi Jjigae', 'description': 'Spicy kimchi stew with pork, tofu, and vegetables', 'cooking_time': '35 min', 'difficulty': 'Easy'},
                {'title': 'Japchae', 'description': 'Sweet potato glass noodles stir-fried with vegetables and beef', 'cooking_time': '40 min', 'difficulty': 'Medium'},
                {'title': 'Korean Fried Chicken', 'description': 'Double-fried crispy chicken with sweet and spicy glaze', 'cooking_time': '45 min', 'difficulty': 'Medium'},
            ],
            'French': [
                {'title': 'Coq au Vin', 'description': 'Chicken braised with wine, mushrooms, and pearl onions', 'cooking_time': '90 min', 'difficulty': 'Medium'},
                {'title': 'Ratatouille', 'description': 'Provençal vegetable stew with eggplant, zucchini, and tomatoes', 'cooking_time': '60 min', 'difficulty': 'Easy'},
                {'title': 'Crème Brûlée', 'description': 'Rich vanilla custard with caramelized sugar topping', 'cooking_time': '50 min', 'difficulty': 'Medium'},
                {'title': 'French Onion Soup', 'description': 'Caramelized onion soup with melted gruyère cheese toast', 'cooking_time': '60 min', 'difficulty': 'Medium'},
                {'title': 'Croissants', 'description': 'Flaky buttery pastry with layers of laminated dough', 'cooking_time': '180 min', 'difficulty': 'Hard'},
            ],
        }
        
        discovered_recipes = []
        
        # Determine which cuisines to include
        if request.cuisine and request.cuisine in CUISINE_RECIPES:
            cuisines_to_search = [request.cuisine]
        else:
            cuisines_to_search = list(CUISINE_RECIPES.keys())
        
        recipes_per_cuisine = max(2, request.count // len(cuisines_to_search))
        
        for cuisine in cuisines_to_search:
            cuisine_recipes = CUISINE_RECIPES.get(cuisine, [])
            
            for recipe in cuisine_recipes[:recipes_per_cuisine]:
                # Get image for the recipe (uses curated Unsplash images)
                image_url = get_food_image(recipe['title'], cuisine)
                
                discovered_recipe = DiscoveredRecipe(
                    title=recipe['title'],
                    description=recipe['description'],
                    cooking_time=recipe['cooking_time'],
                    difficulty=recipe['difficulty'],
                    image_url=image_url,
                    cuisine=cuisine,
                    source_url=f"https://www.allrecipes.com/search?q={recipe['title'].replace(' ', '+')}"
                )
                discovered_recipes.append(discovered_recipe)
        
        return {"recipes": [r.model_dump() for r in discovered_recipes[:request.count]]}
        
    except Exception as e:
        logging.error(f"Error discovering recipes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/voice/mood-info")
async def get_mood_voice_info(current_user: User = Depends(get_current_user)):
    """
    Get information about available moods and their voice characteristics.
    """
    from voice_service import MOOD_VOICE_CONFIG
    
    mood_info = {
        mood: {
            'voice': config['voice'],
            'description': config['description'],
            'speed': config['speed']
        }
        for mood, config in MOOD_VOICE_CONFIG.items()
    }
    
    return {"moods": mood_info}


# ============================================
# DIABETES MEALS ENDPOINTS
# ============================================

class DiabetesResearchRequest(BaseModel):
    diabetes_type: str
    session_id: str

class DiabetesRecipeRequest(BaseModel):
    session_id: str
    mood: str
    mood_description: Optional[str] = None
    diabetes_type: str
    diabetes_label: str
    dietary_pref: str
    meal_type: str
    cuisines: str
    guidelines: Optional[Dict[str, Any]] = None

class DiabetesChatRequest(BaseModel):
    session_id: str
    message: str
    context: Optional[Dict[str, Any]] = None


# Diabetes dietary guidelines database
DIABETES_GUIDELINES = {
    "type1": {
        "name": "Type 1 Diabetes",
        "overview": "Insulin-dependent diabetes where the pancreas produces little or no insulin",
        "key_principles": [
            "Carbohydrate counting is critical for insulin dosing",
            "Balance carbs with insulin doses",
            "Consistent meal timing",
            "Low glycemic index foods preferred",
            "45-60g carbs per meal typical"
        ],
        "recommended_foods": [
            "Complex carbs (whole grains, legumes)",
            "High-fiber vegetables",
            "Lean proteins",
            "Healthy fats (nuts, avocado, olive oil)",
            "Low-GI fruits (berries, apples)"
        ],
        "avoid_foods": [
            "Simple sugars (candy, soda, juice)",
            "Refined carbs (white bread, white rice)",
            "High-GI foods (potatoes, watermelon)",
            "Sugary drinks",
            "Processed foods with hidden sugars"
        ],
        "max_carbs_per_meal": 60,
        "min_fiber_per_meal": 8,
        "max_glycemic_index": 55,
        "macro_split": {"carbs": 45, "protein": 30, "fat": 25}
    },
    "type2": {
        "name": "Type 2 Diabetes",
        "overview": "Insulin resistance where the body doesn't use insulin effectively",
        "key_principles": [
            "Lower carbohydrate intake (30-40% of calories)",
            "Emphasis on non-starchy vegetables",
            "Lean proteins for satiety",
            "Healthy fats for insulin sensitivity",
            "Low glycemic index foods (GI < 55)",
            "Portion control for weight management"
        ],
        "recommended_foods": [
            "Non-starchy vegetables (unlimited)",
            "Lean proteins (chicken, fish, tofu)",
            "Whole grains in moderation",
            "Legumes and beans",
            "Foods with cinnamon, turmeric (insulin sensitivity)"
        ],
        "avoid_foods": [
            "Simple carbohydrates",
            "Sugary foods and drinks",
            "Trans fats",
            "Processed meats",
            "Full-fat dairy",
            "Fried foods",
            "High-sodium foods"
        ],
        "max_carbs_per_meal": 45,
        "min_fiber_per_meal": 10,
        "max_glycemic_index": 55,
        "macro_split": {"carbs": 35, "protein": 30, "fat": 35}
    },
    "gestational": {
        "name": "Gestational Diabetes",
        "overview": "Pregnancy-related diabetes that usually resolves after delivery",
        "key_principles": [
            "Cannot skip meals (harmful to baby)",
            "Smaller, frequent meals",
            "Protein at every meal/snack",
            "Adequate nutrition for baby",
            "Morning blood sugar focus"
        ],
        "recommended_foods": [
            "Complex carbs in moderation",
            "Protein at every meal",
            "Greek yogurt, nuts, seeds",
            "Plenty of vegetables",
            "Whole grains (small portions)"
        ],
        "avoid_foods": [
            "Simple sugars",
            "Fruit juice",
            "Large portions of carbs",
            "Skipping meals (dangerous)",
            "Sugary cereals"
        ],
        "max_carbs_per_meal": 45,
        "min_fiber_per_meal": 8,
        "max_glycemic_index": 55,
        "macro_split": {"carbs": 40, "protein": 30, "fat": 30}
    },
    "prediabetes": {
        "name": "Pre-Diabetes",
        "overview": "Blood sugar levels higher than normal but not yet diabetes",
        "key_principles": [
            "Focus on preventing progression",
            "Moderate carbohydrate intake",
            "Weight management support",
            "Increase fiber intake",
            "Regular meal timing"
        ],
        "recommended_foods": [
            "Whole grains over refined",
            "Lots of vegetables",
            "Lean proteins",
            "Healthy fats",
            "Low-GI fruits"
        ],
        "avoid_foods": [
            "Sugary drinks and snacks",
            "Refined carbohydrates",
            "Processed foods",
            "Large portions"
        ],
        "max_carbs_per_meal": 50,
        "min_fiber_per_meal": 8,
        "max_glycemic_index": 60,
        "macro_split": {"carbs": 45, "protein": 25, "fat": 30}
    }
}


@api_router.post("/diabetes/research")
async def research_diabetes_type(request: DiabetesResearchRequest, current_user: User = Depends(get_current_user)):
    """Research diabetes type and return dietary guidelines"""
    try:
        diabetes_type = request.diabetes_type
        guidelines = DIABETES_GUIDELINES.get(diabetes_type, DIABETES_GUIDELINES["type2"])
        
        # Format summary for user
        summary = f"""I've researched {guidelines['name']} management. Here's what I understand:

**{guidelines['overview']}**

**Key Dietary Principles:**
{chr(10).join(['✅ ' + p for p in guidelines['key_principles']])}

**Foods I'll Recommend:**
{chr(10).join(['• ' + f for f in guidelines['recommended_foods']])}

**Foods I'll Avoid in Suggestions:**
{chr(10).join(['• ' + f for f in guidelines['avoid_foods']])}

All my recipe suggestions will follow these evidence-based guidelines!

What's your dietary preference?"""
        
        return {
            "summary": summary,
            "guidelines": {
                "maxCarbsPerMeal": guidelines["max_carbs_per_meal"],
                "minFiberPerMeal": guidelines["min_fiber_per_meal"],
                "maxGlycemicIndex": guidelines["max_glycemic_index"],
                "macroSplit": guidelines["macro_split"],
                "avoidFoods": guidelines["avoid_foods"],
                "recommendedFoods": guidelines["recommended_foods"]
            }
        }
    except Exception as e:
        logging.error(f"Error researching diabetes type: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def get_diabetes_recipe_prompt(mood: str, diabetes_type: str, diabetes_label: str, dietary_pref: str, meal_type: str, cuisines: str, guidelines: dict = None):
    """Generate a prompt for diabetes-safe recipes"""
    
    max_carbs = guidelines.get("maxCarbsPerMeal", 45) if guidelines else 45
    min_fiber = guidelines.get("minFiberPerMeal", 8) if guidelines else 8
    max_gi = guidelines.get("maxGlycemicIndex", 55) if guidelines else 55
    
    return f"""You are a certified diabetes educator and nutritionist. Generate EXACTLY 3 delicious {dietary_pref} {meal_type} recipes that are safe for {diabetes_label} management.

**USER CONTEXT:**
- Mood: {mood}
- Diabetes Type: {diabetes_label}
- Dietary Preference: {dietary_pref}
- Meal Type: {meal_type}
- Cuisines: {cuisines}

**DIABETES SAFETY REQUIREMENTS (CRITICAL):**
- Maximum {max_carbs}g net carbs per serving
- Minimum {min_fiber}g fiber per serving
- Glycemic Index below {max_gi}
- Include blood sugar stabilizing ingredients
- Avoid refined sugars, white flour, high-GI foods

**FOR EACH RECIPE, YOU MUST INCLUDE:**

## Recipe [Number]: [Recipe Name]

🩺 **Diabetes Info:**
- Net Carbs: [X]g per serving
- Fiber: [X]g per serving
- Protein: [X]g per serving
- Glycemic Index: [Low/Medium] (approximately [X])
- Blood Sugar Impact: [Low/Moderate]

💚 **Why This is Blood Sugar Safe:**
[2-3 bullet points explaining why this recipe supports blood sugar control]

**Prep Time:** [X] minutes
**Cook Time:** [X] minutes
**Difficulty:** [Easy/Medium]
**Servings:** [X]

### Ingredients:
[List ingredients with amounts]

### Instructions:
[Step-by-step instructions with times and temperatures]

### 🥤 Diabetes-Safe Drink Pairing:

**Non-Alcoholic:**
- **[Drink Name]:** [Description and why it's diabetes-safe]

**Note for Alcoholic Options (21+):**
- **[Drink Name]:** [If appropriate, note to enjoy in moderation and monitor blood sugar]

### 💡 Blood Sugar Tips:
[2-3 tips specific to this recipe for managing blood sugar]

---

**IMPORTANT RULES:**
1. All nutritional info must be realistic and accurate
2. Emphasize fiber-rich, low-GI ingredients
3. Include protein to slow sugar absorption
4. Make recipes genuinely delicious, not just "healthy"
5. Drink pairings must be sugar-free or very low sugar
6. Include portion guidance if the recipe could spike blood sugar with larger portions

Generate recipes that are both medically appropriate AND genuinely appetizing for someone feeling {mood.lower()}."""


@api_router.post("/diabetes/recipes")
async def get_diabetes_recipes(request: DiabetesRecipeRequest, current_user: User = Depends(get_current_user)):
    """Generate diabetes-safe recipes based on user preferences"""
    try:
        llm_api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        system_msg = get_diabetes_recipe_prompt(
            mood=request.mood,
            diabetes_type=request.diabetes_type,
            diabetes_label=request.diabetes_label,
            dietary_pref=request.dietary_pref,
            meal_type=request.meal_type,
            cuisines=request.cuisines,
            guidelines=request.guidelines
        )
        
        chat = LlmChat(
            api_key=llm_api_key,
            session_id=f"diabetes-{request.session_id}-{uuid.uuid4().hex[:8]}",
            system_message=system_msg
        )
        chat.with_model("openai", "gpt-4o")
        
        ai_response = await chat.send_message(
            UserMessage(text=f"Please generate 3 {request.dietary_pref} {request.meal_type} recipes for {request.cuisines} cuisine that are safe for {request.diabetes_label} and match a {request.mood.lower()} mood.")
        )
        
        # Save to chat history
        await db.diabetes_chat_messages.insert_one({
            "session_id": request.session_id,
            "user_id": current_user.id,
            "role": "assistant",
            "content": ai_response,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "is_recipe_response": True,
            "diabetes_type": request.diabetes_type
        })
        
        return {
            "response": ai_response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error generating diabetes recipes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/diabetes/chat")
async def diabetes_chat(request: DiabetesChatRequest, current_user: User = Depends(get_current_user)):
    """Handle free-form chat in diabetes meals section"""
    try:
        llm_api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        context = request.context or {}
        diabetes_type = context.get("diabetesType", "type2")
        guidelines = DIABETES_GUIDELINES.get(diabetes_type, DIABETES_GUIDELINES["type2"])
        
        system_msg = f"""You are a helpful diabetes nutrition assistant. The user has {guidelines['name']}.

Key dietary principles for this user:
{chr(10).join(['- ' + p for p in guidelines['key_principles']])}

Answer their questions helpfully while keeping diabetes management in mind. Be encouraging and supportive.
If they ask for recipe modifications, ensure your suggestions maintain blood sugar safety.
Always remind them to consult their healthcare provider for personalized medical advice."""
        
        chat = LlmChat(
            api_key=llm_api_key,
            session_id=f"diabetes-chat-{request.session_id}-{uuid.uuid4().hex[:8]}",
            system_message=system_msg
        )
        chat.with_model("openai", "gpt-4o-mini")
        
        response = await chat.send_message(UserMessage(text=request.message))
        
        # Save to chat history
        await db.diabetes_chat_messages.insert_one({
            "session_id": request.session_id,
            "user_id": current_user.id,
            "role": "user",
            "content": request.message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        await db.diabetes_chat_messages.insert_one({
            "session_id": request.session_id,
            "user_id": current_user.id,
            "role": "assistant",
            "content": response.text,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "response": response.text,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error in diabetes chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()