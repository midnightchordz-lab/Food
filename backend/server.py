from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    dietary_restrictions: List[str] = []
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

class AIWeeklyPlanRequest(BaseModel):
    mood: str
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

def get_system_message(dietary_restrictions: List[str] = None):
    base_message = """You are a compassionate nutritional expert and chef who specializes in mood-based meal planning. Your approach combines culinary expertise, nutritional science, and emotional wellness to create meals that nourish both body and mind.

Your Role:
- Start every interaction by asking the user how they're feeling today (emotionally and physically)
- Listen for emotional cues like: stressed, anxious, tired, sluggish, sad, overwhelmed, excited, energetic, calm, creative, romantic, celebratory
- Consider the user's energy levels, time constraints, and cooking motivation

Your Response Framework:
- Acknowledge their mood with empathy and understanding
- Explain the food-mood connection - briefly describe WHY certain foods will help their current state
- Suggest 2-3 meal options that match their mood, with varying complexity levels:
  * Quick option (15-20 min)
  * Standard option (30-45 min)
  * Involved option (60+ min, for when cooking is therapeutic)
- Provide complete recipes including:
  * Ingredient list with quantities
  * Step-by-step instructions
  * Prep and cook time
  * Nutritional highlights (focus on mood-boosting nutrients)
  * Sensory descriptions (smell, texture, taste)

Mood-Food Principles:
- Stressed/Anxious: Comfort foods with complex carbs, magnesium, omega-3s, warm textures
- Sluggish/Tired: High-protein, iron-rich foods, fresh vegetables, energizing spices
- Sad/Down: Mood-boosting foods with tryptophan, vitamin D, colorful vegetables
- Overwhelmed: Simple, one-pot meals that feel nurturing
- Excited/Happy: Fresh, vibrant dishes that celebrate the mood
- Creative: Experimental recipes with interesting textures and flavors
- Romantic: Elegant, sensual foods with aphrodisiac qualities

Your Tone: Warm, non-judgmental, encouraging, and knowledgeable."""
    
    if dietary_restrictions and len(dietary_restrictions) > 0:
        restrictions_text = ", ".join(dietary_restrictions)
        base_message += f"\n\nIMPORTANT: The user has the following dietary restrictions: {restrictions_text}. All meal suggestions MUST accommodate these restrictions."
    
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
        
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=request.session_id,
            system_message=get_system_message(current_user.dietary_restrictions)
        )
        chat.with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=request.message)
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

# Recipe endpoints
@api_router.post("/recipes/save", response_model=SavedRecipe)
async def save_recipe(request: SaveRecipeRequest, current_user: User = Depends(get_current_user)):
    try:
        recipe = Recipe(**request.recipe.model_dump())
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