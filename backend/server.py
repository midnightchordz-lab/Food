from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# System message for the AI chef
SYSTEM_MESSAGE = """You are a compassionate nutritional expert and chef who specializes in mood-based meal planning. Your approach combines culinary expertise, nutritional science, and emotional wellness to create meals that nourish both body and mind.

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

# Models
class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    session_id: str
    message: str

class ChatResponse(BaseModel):
    session_id: str
    response: str
    timestamp: datetime

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
    complexity: str  # "quick", "standard", "involved"
    nutritional_highlights: str
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

class SavedRecipe(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    recipe_id: str
    saved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SaveRecipeRequest(BaseModel):
    user_id: str
    recipe: RecipeCreate

class ShoppingList(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: List[Dict[str, Any]]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShoppingListCreate(BaseModel):
    user_id: str
    items: List[Dict[str, Any]]

class WeeklyPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    week_start: str
    meals: Dict[str, Any]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WeeklyPlanCreate(BaseModel):
    user_id: str
    week_start: str
    meals: Dict[str, Any]

# Chat endpoints
@api_router.post("/chat/send", response_model=ChatResponse)
async def send_chat_message(request: ChatRequest):
    try:
        # Save user message
        user_msg = ChatMessage(
            session_id=request.session_id,
            role="user",
            content=request.message
        )
        await db.chat_messages.insert_one({
            **user_msg.model_dump(),
            "timestamp": user_msg.timestamp.isoformat()
        })
        
        # Get chat history for context
        history = await db.chat_messages.find(
            {"session_id": request.session_id},
            {"_id": 0}
        ).sort("timestamp", 1).limit(10).to_list(10)
        
        # Initialize LLM chat
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=request.session_id,
            system_message=SYSTEM_MESSAGE
        )
        chat.with_model("openai", "gpt-4o")
        
        # Create user message for LLM
        user_message = UserMessage(text=request.message)
        
        # Get AI response
        ai_response = await chat.send_message(user_message)
        
        # Save assistant message
        assistant_msg = ChatMessage(
            session_id=request.session_id,
            role="assistant",
            content=ai_response
        )
        await db.chat_messages.insert_one({
            **assistant_msg.model_dump(),
            "timestamp": assistant_msg.timestamp.isoformat()
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
async def get_chat_history(session_id: str):
    try:
        messages = await db.chat_messages.find(
            {"session_id": session_id},
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
async def save_recipe(request: SaveRecipeRequest):
    try:
        # Create and save recipe
        recipe = Recipe(**request.recipe.model_dump())
        recipe_dict = recipe.model_dump()
        recipe_dict['created_at'] = recipe_dict['created_at'].isoformat()
        await db.recipes.insert_one(recipe_dict)
        
        # Save to user's saved recipes
        saved = SavedRecipe(user_id=request.user_id, recipe_id=recipe.id)
        saved_dict = saved.model_dump()
        saved_dict['saved_at'] = saved_dict['saved_at'].isoformat()
        await db.saved_recipes.insert_one(saved_dict)
        
        return saved
    except Exception as e:
        logging.error(f"Error saving recipe: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/recipes/saved/{user_id}")
async def get_saved_recipes(user_id: str):
    try:
        # Get saved recipe IDs
        saved = await db.saved_recipes.find({"user_id": user_id}, {"_id": 0}).to_list(100)
        recipe_ids = [s['recipe_id'] for s in saved]
        
        # Get full recipes
        recipes = await db.recipes.find({"id": {"$in": recipe_ids}}, {"_id": 0}).to_list(100)
        
        return {"recipes": recipes}
    except Exception as e:
        logging.error(f"Error fetching saved recipes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Shopping list endpoints
@api_router.post("/shopping-list", response_model=ShoppingList)
async def create_or_update_shopping_list(request: ShoppingListCreate):
    try:
        # Check if user already has a list
        existing = await db.shopping_lists.find_one({"user_id": request.user_id}, {"_id": 0})
        
        if existing:
            # Update existing list
            update_time = datetime.now(timezone.utc)
            await db.shopping_lists.update_one(
                {"user_id": request.user_id},
                {"$set": {
                    "items": request.items,
                    "updated_at": update_time.isoformat()
                }}
            )
            existing['items'] = request.items
            existing['updated_at'] = update_time
            return ShoppingList(**existing)
        else:
            # Create new list
            shopping_list = ShoppingList(
                user_id=request.user_id,
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

@api_router.get("/shopping-list/{user_id}")
async def get_shopping_list(user_id: str):
    try:
        shopping_list = await db.shopping_lists.find_one({"user_id": user_id}, {"_id": 0})
        if not shopping_list:
            return {"items": []}
        return shopping_list
    except Exception as e:
        logging.error(f"Error fetching shopping list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Weekly plan endpoints
@api_router.post("/weekly-plan", response_model=WeeklyPlan)
async def create_weekly_plan(request: WeeklyPlanCreate):
    try:
        plan = WeeklyPlan(**request.model_dump())
        plan_dict = plan.model_dump()
        plan_dict['created_at'] = plan_dict['created_at'].isoformat()
        await db.weekly_plans.insert_one(plan_dict)
        return plan
    except Exception as e:
        logging.error(f"Error creating weekly plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/weekly-plan/{user_id}")
async def get_weekly_plans(user_id: str):
    try:
        plans = await db.weekly_plans.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(10)
        return {"plans": plans}
    except Exception as e:
        logging.error(f"Error fetching weekly plans: {e}")
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