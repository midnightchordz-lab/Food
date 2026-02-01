"""
Chat Routes - Main conversation and recipe generation
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import os
import uuid
import logging
import re

from emergentintegrations.llm.chat import LlmChat, UserMessage

from .deps import db, User, get_current_user
from .exclusions import (
    get_user_excluded_ingredients,
    filter_unsafe_recipes_from_response,
    filter_recipe_text_strictly
)

router = APIRouter(prefix="/chat", tags=["Chat"])

# ============== RESPONSE CACHE ==============
# In-memory cache for recipe responses (faster than DB lookups)
_recipe_cache: Dict[str, Dict[str, Any]] = {}
CACHE_MAX_SIZE = 100
CACHE_TTL_SECONDS = 600  # 10 minutes

def get_cache_key(mood: str, meal_type: str, dietary_pref: str, cuisines: str) -> str:
    """Generate a unique cache key for recipe request"""
    key_str = f"{mood}:{meal_type}:{dietary_pref}:{cuisines}".lower()
    return hashlib.md5(key_str.encode()).hexdigest()

def get_cached_recipes(key: str) -> Optional[str]:
    """Get cached recipe response if not expired"""
    if key in _recipe_cache:
        entry = _recipe_cache[key]
        if datetime.now(timezone.utc).timestamp() - entry['timestamp'] < CACHE_TTL_SECONDS:
            logging.info(f"Cache HIT for recipe key: {key[:8]}...")
            return entry['response']
        else:
            del _recipe_cache[key]
    return None

def cache_recipes(key: str, response: str):
    """Cache recipe response"""
    # Evict oldest entries if cache is full
    if len(_recipe_cache) >= CACHE_MAX_SIZE:
        oldest_key = min(_recipe_cache.keys(), key=lambda k: _recipe_cache[k]['timestamp'])
        del _recipe_cache[oldest_key]
    
    _recipe_cache[key] = {
        'response': response,
        'timestamp': datetime.now(timezone.utc).timestamp()
    }
    logging.info(f"Cached recipe response for key: {key[:8]}...")

# ============== MODELS ==============

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

class DetailedRecipeRequest(BaseModel):
    recipe_title: str
    cuisine: str = "International"
    meal_type: str = "Dinner"
    dietary_pref: str = "Any"

# ============== MOOD DETECTION ==============

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
        "message": "Cozy meals are comforting and satisfying."
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
    user_message = message
    if "[Context:" in message and "]" in message:
        context_end = message.find("]") + 1
        user_message = message[context_end:].strip()
    
    lower_msg = user_message.lower().strip()
    
    is_mood_change = False
    for pattern in MOOD_CHANGE_PATTERNS:
        if re.search(pattern, lower_msg):
            is_mood_change = True
            break
    
    detected_mood = None
    best_position = -1
    
    for mood, keywords in MOOD_KEYWORDS.items():
        for keyword in keywords:
            pos = lower_msg.find(keyword)
            if pos != -1 and pos > best_position:
                prefix = lower_msg[max(0, pos-10):pos]
                if "from " not in prefix:
                    detected_mood = mood
                    best_position = pos
    
    word_count = len(lower_msg.split())
    is_direct_mood_response = detected_mood and word_count <= 5
    
    if detected_mood and (is_mood_change or is_direct_mood_response or "now" in lower_msg or "feeling" in lower_msg):
        return {"is_mood_change": True, "new_mood": detected_mood}
    elif is_mood_change:
        return {"is_mood_change": True, "new_mood": None}
    
    return {"is_mood_change": False, "new_mood": None}


def get_mood_change_response(new_mood: str, dietary_pref: str = None, meal_type: str = None, cuisines: str = None) -> str:
    """Generate empathetic response for mood change"""
    mood_data = MOOD_RESPONSES.get(new_mood, MOOD_RESPONSES["happy"])
    
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
            dietary_pref = context.get("dietary_pref") if context else None
            meal_type = context.get("meal_type") if context else None
            cuisines = context.get("cuisines") if context else None
            
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


def is_recipe_generation_request(message: str) -> dict:
    """Detect if message is a structured recipe request and extract parameters"""
    if "[User Preferences]" in message and "Please suggest" in message:
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

# ============== PROMPT GENERATORS ==============

def get_conversational_system_message():
    """Short system message for general chat interactions"""
    return """You are MoodFood, a friendly chef helping users discover mood-based recipes. 
Be warm, concise, and helpful. Ask clarifying questions if needed."""


def get_recipe_generation_prompt(mood: str, meal_type: str, dietary_pref: str, cuisines: str):
    """Generate a focused prompt for recipe suggestions"""
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


def get_detailed_recipe_prompt(recipe_title: str, cuisine: str, meal_type: str, dietary_pref: str):
    """Generate a comprehensive detailed recipe prompt"""
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
[Write 2-3 sentences describing the dish, its origins, and what makes it special.]

## 🥕 Ingredients

**For the Main Component:**
- [Exact quantity] [Ingredient name]

**For the Sauce/Seasoning:**
- [Exact quantity] [Ingredient name]

**For Garnish:**
- [Optional ingredients]

## 🔧 Equipment Needed
- [List 6-8 specific tools]

## 📋 Step-by-Step Instructions

**Step 1** ([X] minutes)
[Detailed instruction]
*Visual Cue:* [What to look for]

[Continue for 10-15 steps]

## 💡 Chef's Tips
1. [Tip 1]
2. [Tip 2]
3. [Tip 3]

## 📊 Nutritional Information (Per Serving)
- Calories: [X] kcal
- Protein: [X]g
- Carbohydrates: [X]g
- Fat: [X]g

## 🥡 Storage & Reheating
- **Storage:** [Instructions]
- **Reheating:** [Instructions]

## 🍷 Drink Pairings
**Non-Alcoholic:** [Options]
**Alcoholic (21+):** [Options]

## 🔄 Variations
1. [Variation 1]
2. [Variation 2]

CRITICAL RULES:
- Every step MUST have specific timing
- Every step MUST have exact measurements and temperatures
- Include visual/audio cues for EVERY step"""


def get_system_message(dietary_restrictions: List[str] = None, cuisine_preferences: List[str] = None):
    """Legacy system message for general chat"""
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

Be warm, encouraging, and concise."""
    
    if dietary_restrictions and len(dietary_restrictions) > 0:
        restrictions_text = ", ".join(dietary_restrictions)
        base_message += f"\n\nDietary restrictions: {restrictions_text}. All suggestions MUST accommodate these."
    
    if cuisine_preferences and len(cuisine_preferences) > 0:
        cuisines_text = ", ".join(cuisine_preferences)
        base_message += f"\n\nPreferred cuisines: {cuisines_text}. Prioritize these cuisines."
    
    return base_message

# ============== ROUTES ==============

@router.post("/send", response_model=ChatResponse)
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
        
        # Get user's excluded ingredients for filtering
        user_exclusions = await get_user_excluded_ingredients(current_user.id)
        
        # Extract context from message if provided
        context = {}
        if "[Context:" in request.message:
            context_match = request.message.split("[Context:")[1].split("]")[0] if "[Context:" in request.message else ""
            for part in context_match.split(","):
                if "=" in part:
                    key, value = part.strip().split("=", 1)
                    if value and value.lower() != "not set":
                        context[key.lower().replace("dietary", "dietary_pref").replace("mealtype", "meal_type")] = value
        
        # Check if this is a mood change request
        mood_change = is_mood_change_request(request.message, context)
        
        if mood_change.get("is_mood_change"):
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
            # Check cache first for faster response
            cache_key = get_cache_key(
                recipe_params["mood"],
                recipe_params["meal_type"],
                recipe_params["dietary_pref"],
                recipe_params["cuisines"]
            )
            
            # Only use cache if user has no exclusions (exclusions make recipes unique)
            cached_response = get_cached_recipes(cache_key) if not user_exclusions else None
            
            if cached_response:
                # Return cached response immediately
                assistant_msg = ChatMessage(
                    session_id=request.session_id,
                    role="assistant",
                    content=cached_response
                )
                await db.chat_messages.insert_one({
                    **assistant_msg.model_dump(),
                    "timestamp": assistant_msg.timestamp.isoformat(),
                    "user_id": current_user.id
                })
                
                return ChatResponse(
                    session_id=request.session_id,
                    response=cached_response,
                    timestamp=assistant_msg.timestamp
                )
            
            system_msg = get_recipe_generation_prompt(
                mood=recipe_params["mood"],
                meal_type=recipe_params["meal_type"],
                dietary_pref=recipe_params["dietary_pref"],
                cuisines=recipe_params["cuisines"]
            )
            if current_user.dietary_restrictions:
                system_msg += f"\n\nDIETARY RESTRICTIONS: {', '.join(current_user.dietary_restrictions)}. All recipes MUST comply."
            
            if user_exclusions:
                exclusion_list = ", ".join(user_exclusions)
                system_msg += f"""

FOOD RESTRICTIONS: Never suggest recipes containing: {exclusion_list}
- Avoid all variations (e.g., if "shrimp" excluded, also avoid prawns)
- Choose alternative proteins/ingredients instead"""
            
            user_text = f"Generate 4 {recipe_params['meal_type'].lower()} recipes for someone feeling {recipe_params['mood'].lower()}, preferring {recipe_params['dietary_pref'].lower()} {recipe_params['cuisines']} cuisine."
            if user_exclusions:
                user_text += f" Avoid: {', '.join(user_exclusions)}."
            logging.info(f"Recipe generation request: {recipe_params}, exclusions: {user_exclusions}")
        else:
            system_msg = get_system_message(current_user.dietary_restrictions, current_user.cuisine_preferences)
            if user_exclusions:
                system_msg += f"\n\nIMPORTANT: User has food allergies/exclusions. Never recommend: {', '.join(user_exclusions)}."
            user_text = request.message
        
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=f"{request.session_id}-{uuid.uuid4().hex[:8]}",
            system_message=system_msg
        )
        model_name = "gpt-4o-mini" if recipe_params else "gpt-4o"
        chat.with_model("openai", model_name)
        
        user_message = UserMessage(text=user_text)
        ai_response = await chat.send_message(user_message)
        
        # CRITICAL SAFETY FILTER
        if recipe_params and user_exclusions:
            logging.info(f"Applying safety filter for exclusions: {user_exclusions}")
            
            filtered_response, removed_recipes, violations = filter_unsafe_recipes_from_response(
                ai_response, user_exclusions
            )
            
            if removed_recipes:
                logging.warning(f"SAFETY: Removed {len(removed_recipes)} unsafe recipes: {removed_recipes}")
            
            has_recipe_content = any(marker in filtered_response for marker in ['###', '**Ingredients', '**Instructions'])
            if has_recipe_content:
                filtered_response = filter_recipe_text_strictly(filtered_response, user_exclusions)
            
            ai_response = filtered_response
        
        # Cache the recipe response for future requests (only if no exclusions)
        if recipe_params and not user_exclusions:
            cache_recipes(cache_key, ai_response)
        
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


@router.get("/history/{session_id}")
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
