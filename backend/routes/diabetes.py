"""
Diabetes Routes - Diabetes-specific meal planning, recipes, and chat
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import os
import uuid
import logging
import sys

from emergentintegrations.llm.chat import LlmChat, UserMessage

from .deps import db, User, get_current_user
from .exclusions import (
    get_user_excluded_ingredients,
    filter_unsafe_recipes_from_response,
    filter_recipe_text_strictly
)
from .chat import is_mood_change_request, MOOD_RESPONSES, parse_recipes_to_json

# Import recipe library service
sys.path.append('/app/backend')
from services.recipe_library import save_recipes_to_library

router = APIRouter(prefix="/diabetes", tags=["Diabetes"])

# ============== MODELS ==============

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

class DiabetesMealPlanRequest(BaseModel):
    diabetes_type: str = "type2"
    dietary_preference: Any = "non-vegetarian"  # Can be string or list for multiple preferences
    cuisine_preferences: Optional[List[str]] = None
    calorie_target: Optional[int] = None
    day_specific_preferences: Optional[Dict[str, str]] = None  # e.g., {"Tuesday": "Vegetarian"}

class DiabetesMealPlanWeekRequest(BaseModel):
    week_offset: int = 0

# ============== DIABETES GUIDELINES ==============

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

# ============== PROMPT GENERATORS ==============

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

Generate recipes that are both medically appropriate AND genuinely appetizing for someone feeling {mood.lower()}."""

# ============== ROUTES ==============

@router.post("/research")
async def research_diabetes_type(request: DiabetesResearchRequest, current_user: User = Depends(get_current_user)):
    """Research diabetes type and return dietary guidelines"""
    try:
        diabetes_type = request.diabetes_type
        guidelines = DIABETES_GUIDELINES.get(diabetes_type, DIABETES_GUIDELINES["type2"])
        
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


@router.post("/recipes")
async def get_diabetes_recipes(request: DiabetesRecipeRequest, current_user: User = Depends(get_current_user)):
    """Generate diabetes-safe recipes based on user preferences"""
    try:
        llm_api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        user_exclusions = await get_user_excluded_ingredients(current_user.id)
        
        # Use strict recipe-only prompt to avoid tips
        system_msg = f"""You are a recipe generator. Generate EXACTLY 3 {request.cuisines} {request.dietary_pref} {request.meal_type} recipes.

CRITICAL - YOU MUST FOLLOW THESE RULES:
1. Each recipe MUST have a REAL DISH NAME like "Pad Thai", "Green Curry Chicken", "Tom Yum Soup"
2. NEVER use tip titles like "Beware of Added Sugars", "Monitoring Portion Sizes", "Load Up on Vegetables"
3. NEVER generate cooking tips, warnings, or dietary advice as recipe names
4. Recipe names should be what you'd see on a restaurant menu

The user has {request.diabetes_label} - keep carbs under 45g per serving.
User is feeling: {request.mood}

FORMAT - Follow exactly for each recipe:
## Recipe 1: [REAL DISH NAME - like Grilled Salmon Teriyaki]

**Prep Time:** X minutes
**Cook Time:** X minutes
**Difficulty:** Easy/Medium/Hard

**Ingredients:**
- [list ingredients]

**Instructions:**
1. [steps]

---

## Recipe 2: [REAL DISH NAME]
[same format]

---

## Recipe 3: [REAL DISH NAME]
[same format]"""
        
        if user_exclusions:
            exclusion_list = ", ".join(user_exclusions)
            system_msg += f"\n\nFOOD RESTRICTIONS - NEVER include: {exclusion_list}"
        
        chat = LlmChat(
            api_key=llm_api_key,
            session_id=f"diabetes-{request.session_id}-{uuid.uuid4().hex[:8]}",
            system_message=system_msg
        )
        chat.with_model("openai", "gpt-4o")
        
        ai_response = await chat.send_message(
            UserMessage(text=f"Generate 3 {request.cuisines} recipes with REAL dish names only. No tips or warnings as titles.")
        )
        
        # CRITICAL SAFETY FILTER
        if user_exclusions:
            logging.info(f"Applying safety filter for diabetes recipes, exclusions: {user_exclusions}")
            
            filtered_response, removed_recipes, violations = filter_unsafe_recipes_from_response(
                ai_response, user_exclusions
            )
            
            if removed_recipes:
                logging.warning(f"SAFETY (Diabetes): Removed {len(removed_recipes)} unsafe recipes: {removed_recipes}")
            
            has_recipe_content = any(marker in filtered_response for marker in ['###', '**Ingredients', '**Instructions'])
            if has_recipe_content:
                filtered_response = filter_recipe_text_strictly(filtered_response, user_exclusions)
            
            ai_response = filtered_response
        
        # Parse recipes to structured JSON
        structured_recipes = None
        try:
            potential_recipes = parse_recipes_to_json(ai_response, request.cuisines)
            if potential_recipes and len(potential_recipes) >= 1:
                structured_recipes = potential_recipes
                logging.info(f"Diabetes /recipes: Parsed {len(structured_recipes)} recipes")
                
                # Save to recipe library
                try:
                    saved_count = await save_recipes_to_library(
                        db,
                        structured_recipes,
                        mood=request.mood or "",
                        meal_type=request.meal_type or "",
                        dietary=request.dietary_pref or "",
                        cuisine=request.cuisines or ""
                    )
                    if saved_count > 0:
                        logging.info(f"Diabetes: Saved {saved_count} new recipes to library")
                except Exception as save_error:
                    logging.warning(f"Failed to save diabetes recipes to library: {save_error}")
        except Exception as parse_error:
            logging.error(f"Diabetes recipe parsing error: {parse_error}")
        
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
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "structured_recipes": structured_recipes
        }
        
    except Exception as e:
        logging.error(f"Error generating diabetes recipes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def diabetes_chat(request: DiabetesChatRequest, current_user: User = Depends(get_current_user)):
    """Handle free-form chat in diabetes meals section"""
    try:
        llm_api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        context = request.context or {}
        diabetes_type = context.get("diabetesType", "type2")
        guidelines = DIABETES_GUIDELINES.get(diabetes_type, DIABETES_GUIDELINES["type2"])
        dietary_pref = context.get("dietaryPref", "non-vegetarian")
        meal_type = context.get("mealType", "dinner")
        mood = context.get("mood", "happy")
        
        user_exclusions = await get_user_excluded_ingredients(current_user.id)
        
        # Check if this is a mood change request
        mood_change = is_mood_change_request(request.message, context)
        
        if mood_change.get("is_mood_change"):
            new_mood = mood_change.get("new_mood")
            if new_mood:
                response_text = f"""I see your mood has shifted to {new_mood}. That's completely normal - our feelings can change throughout the day.

{MOOD_RESPONSES.get(new_mood, MOOD_RESPONSES['happy'])['message']}

Click the button below to get new diabetes-friendly recipes that match your {new_mood} mood! ✨"""
                
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
                    "content": response_text,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
                return {
                    "response": response_text,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "mood_change_detected": True,
                    "new_mood": new_mood
                }
        
        # Check if this is a cuisine change request - user wants recipes from a different cuisine
        cuisine_keywords = {
            'indian': ['indian', 'india', 'curry', 'masala', 'tandoori', 'biryani', 'dal', 'naan', 'paneer'],
            'thai': ['thai', 'thailand', 'pad thai', 'tom yum', 'green curry', 'basil', 'coconut curry'],
            'mexican': ['mexican', 'mexico', 'tacos', 'burrito', 'enchilada', 'salsa', 'guacamole', 'quesadilla'],
            'italian': ['italian', 'italy', 'pasta', 'pizza', 'risotto', 'lasagna', 'pesto', 'carbonara'],
            'chinese': ['chinese', 'china', 'stir fry', 'wok', 'dim sum', 'fried rice', 'kung pao', 'szechuan'],
            'japanese': ['japanese', 'japan', 'sushi', 'ramen', 'teriyaki', 'miso', 'tempura', 'udon'],
            'mediterranean': ['mediterranean', 'greek', 'hummus', 'falafel', 'tzatziki', 'olive oil', 'feta'],
            'american': ['american', 'burger', 'bbq', 'barbecue', 'grilled', 'southern', 'comfort food'],
            'korean': ['korean', 'korea', 'kimchi', 'bibimbap', 'bulgogi', 'gochujang'],
            'vietnamese': ['vietnamese', 'vietnam', 'pho', 'banh mi', 'spring roll', 'fish sauce'],
        }
        
        message_lower = request.message.lower().strip()
        detected_cuisine = None
        
        # Check if this is a "show more" request
        more_patterns = [
            "more recipe", "another recipe", "different recipe", 
            "show more", "more options", "other recipe", "other options",
            "something else", "different dish", "more dish", "another dish",
            "more suggestion", "different suggestion", "other suggestion",
            "more choices", "different choices", "alternatives",
            "give me more", "show me more", "more please"
        ]
        is_show_more = any(pattern in message_lower for pattern in more_patterns)
        
        # Handle "show more" request - generate new recipes using existing context
        if is_show_more and context:
            cuisines = context.get("cuisines", ["any"])
            # Convert list to string if needed
            if isinstance(cuisines, list):
                cuisines = cuisines[0] if cuisines else "any"
            cuisine_label = cuisines.replace("_", " ").title() if cuisines != "any" else "International"
            
            recipe_system_msg = f"""You are a recipe generator. Generate EXACTLY 3 NEW {cuisine_label} {dietary_pref} {meal_type} recipes.

CRITICAL RULES - MUST FOLLOW:
1. Each recipe MUST be a REAL DISH NAME
2. NEVER use tip titles or dietary advice as recipe names
3. Generate DIFFERENT recipes than before - be creative!

User has diabetes ({diabetes_type}) - keep carbs under 45g per serving.
User is feeling: {mood}

FORMAT - Follow exactly:
## Recipe 1: [ACTUAL DISH NAME]
**Prep Time:** X minutes
**Cook Time:** X minutes  
**Difficulty:** Easy/Medium/Hard

**Ingredients:**
- [ingredient list]

**Instructions:**
1. [step by step]

---

## Recipe 2: [ACTUAL DISH NAME]
[same format]

---

## Recipe 3: [ACTUAL DISH NAME]
[same format]"""

            if user_exclusions:
                exclusion_list = ", ".join(user_exclusions)
                recipe_system_msg += f"\n\nFOOD RESTRICTIONS - NEVER include: {exclusion_list}"
            
            chat = LlmChat(
                api_key=llm_api_key,
                session_id=f"diabetes-more-{request.session_id}-{uuid.uuid4().hex[:8]}",
                system_message=recipe_system_msg
            )
            chat.with_model("openai", "gpt-4o")
            
            ai_response = await chat.send_message(
                UserMessage(text=f"Generate 3 NEW {cuisine_label} {dietary_pref} {meal_type} recipes that are different from previous suggestions.")
            )
            
            if user_exclusions:
                filtered_response, removed_recipes, violations = filter_unsafe_recipes_from_response(
                    ai_response, user_exclusions
                )
                if removed_recipes:
                    logging.warning(f"SAFETY (Diabetes Show More): Removed {len(removed_recipes)} unsafe recipes")
                ai_response = filtered_response
            
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
                "content": ai_response,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
            # Parse recipes to structured JSON
            structured_recipes = None
            try:
                structured_recipes = parse_recipes_to_json(ai_response, cuisine_label)
                logging.info(f"Diabetes 'show more': Parsed {len(structured_recipes)} recipes")
            except Exception as parse_error:
                logging.error(f"Diabetes 'show more' recipe parsing error: {parse_error}")
            
            return {
                "response": ai_response,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "structured_recipes": structured_recipes
            }
        
        # Check if user is requesting a specific cuisine
        for cuisine, keywords in cuisine_keywords.items():
            if any(kw in message_lower for kw in keywords):
                detected_cuisine = cuisine.capitalize()
                break
        
        # If cuisine detected, ALWAYS generate recipes (don't require action words)
        # User typing just "American" or "Thai" clearly wants recipes for that cuisine
        if detected_cuisine:
            # Generate proper recipes for the new cuisine with STRICT instructions
            recipe_system_msg = f"""You are a recipe generator. Generate EXACTLY 3 {detected_cuisine} recipes.

CRITICAL RULES - MUST FOLLOW:
1. Each recipe MUST be a REAL DISH NAME like "Chicken Fajitas", "Beef Tacos", "Shrimp Quesadillas"
2. NEVER use tip titles like "Load Up on Vegetables", "Flavored with Herbs", "Whole Grains in Moderation"
3. NEVER generate cooking tips or dietary advice as recipe names
4. Recipe names should be what you'd see on a restaurant menu

FORMAT - Follow exactly:
## Recipe 1: [ACTUAL DISH NAME - e.g., Grilled Chicken Tacos]
**Prep Time:** X minutes
**Cook Time:** X minutes  
**Difficulty:** Easy/Medium/Hard

**Ingredients:**
- [ingredient list]

**Instructions:**
1. [step by step]

## Recipe 2: [ACTUAL DISH NAME]
[same format]

## Recipe 3: [ACTUAL DISH NAME]
[same format]

User has diabetes - keep carbs under 45g per serving. But focus on REAL DISH NAMES."""

            if user_exclusions:
                exclusion_list = ", ".join(user_exclusions)
                recipe_system_msg += f"\n\nFOOD RESTRICTIONS - NEVER include: {exclusion_list}"
            
            chat = LlmChat(
                api_key=llm_api_key,
                session_id=f"diabetes-cuisine-{request.session_id}-{uuid.uuid4().hex[:8]}",
                system_message=recipe_system_msg
            )
            chat.with_model("openai", "gpt-4o")
            
            ai_response = await chat.send_message(
                UserMessage(text=f"Generate 3 {detected_cuisine} recipes. Use REAL dish names only.")
            )
            
            if user_exclusions:
                filtered_response, removed_recipes, violations = filter_unsafe_recipes_from_response(
                    ai_response, user_exclusions
                )
                if removed_recipes:
                    logging.warning(f"SAFETY (Diabetes Cuisine Change): Removed {len(removed_recipes)} unsafe recipes")
                ai_response = filtered_response
            
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
                "content": ai_response,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
            # Parse recipes to structured JSON
            structured_recipes = None
            try:
                structured_recipes = parse_recipes_to_json(ai_response)
                logging.info(f"Diabetes chat: Parsed {len(structured_recipes)} recipes")
            except Exception as parse_error:
                logging.error(f"Diabetes chat recipe parsing error: {parse_error}")
            
            return {
                "response": ai_response,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "cuisine_change_detected": True,
                "new_cuisine": detected_cuisine,
                "structured_recipes": structured_recipes
            }
        
        system_msg = f"""You are a helpful diabetes nutrition assistant. The user has {guidelines['name']}.

Key dietary principles for this user:
{chr(10).join(['- ' + p for p in guidelines['key_principles']])}

Answer their questions helpfully while keeping diabetes management in mind. Be encouraging and supportive.
Always remind them to consult their healthcare provider for personalized medical advice."""
        
        if user_exclusions:
            exclusion_list = ", ".join(user_exclusions)
            system_msg += f"""

IMPORTANT FOOD RESTRICTIONS: The user has allergies/exclusions to: {exclusion_list}
- NEVER suggest recipes or foods containing these ingredients
- If asked about recipes with these ingredients, suggest safe alternatives instead"""
        
        chat = LlmChat(
            api_key=llm_api_key,
            session_id=f"diabetes-chat-{request.session_id}-{uuid.uuid4().hex[:8]}",
            system_message=system_msg
        )
        chat.with_model("openai", "gpt-4o-mini")
        
        ai_response = await chat.send_message(UserMessage(text=request.message))
        
        if user_exclusions:
            filtered_response, removed_recipes, violations = filter_unsafe_recipes_from_response(
                ai_response, user_exclusions
            )
            if removed_recipes:
                logging.warning(f"SAFETY (Diabetes Chat): Filtered content with violations: {violations}")
            ai_response = filtered_response
        
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
            "content": ai_response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "response": ai_response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error in diabetes chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== DIABETES WEEKLY PLANNER ROUTES ==============

@router.post("/weekly-plan/generate")
async def generate_diabetes_weekly_plan(request: DiabetesMealPlanRequest, current_user: User = Depends(get_current_user)):
    """Generate a diabetes-optimized weekly meal plan with exclusion filtering"""
    try:
        from diabetes_meal_planner import generate_diabetes_weekly_meal_plan
        
        user_exclusions = await get_user_excluded_ingredients(current_user.id)
        
        meals = await generate_diabetes_weekly_meal_plan(
            current_user,
            diabetes_type=request.diabetes_type,
            dietary_preference=request.dietary_preference,
            cuisine_preferences=request.cuisine_preferences,
            user_exclusions=user_exclusions,
            calorie_target=request.calorie_target,
            day_specific_preferences=request.day_specific_preferences
        )
        
        today = datetime.now(timezone.utc)
        week_start = today - timedelta(days=today.weekday())
        week_start_str = week_start.strftime('%Y-%m-%d')
        
        plan_data = {
            "user_id": current_user.id,
            "week_start": week_start_str,
            "meals": meals,
            "diabetes_type": request.diabetes_type,
            "dietary_preference": request.dietary_preference,
            "day_specific_preferences": request.day_specific_preferences,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_diabetes_plan": True
        }
        
        await db.diabetes_weekly_plans.update_one(
            {"user_id": current_user.id, "week_start": week_start_str},
            {"$set": plan_data},
            upsert=True
        )
        
        return {
            "plan": plan_data,
            "message": "Diabetes meal plan generated successfully!",
            "exclusions_applied": user_exclusions
        }
    except Exception as e:
        logging.error(f"Error generating diabetes meal plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/weekly-plan")
async def get_diabetes_weekly_plans(current_user: User = Depends(get_current_user)):
    """Get all diabetes weekly meal plans for the user"""
    try:
        plans = await db.diabetes_weekly_plans.find(
            {"user_id": current_user.id},
            {"_id": 0}
        ).sort("week_start", -1).to_list(length=52)
        
        return {"plans": plans}
    except Exception as e:
        logging.error(f"Error fetching diabetes weekly plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/weekly-plan/generate-for-week")
async def generate_diabetes_plan_for_week(request: DiabetesMealPlanWeekRequest, current_user: User = Depends(get_current_user)):
    """Generate diabetes meal plan for a specific week offset"""
    try:
        from diabetes_meal_planner import generate_diabetes_weekly_meal_plan
        
        user_exclusions = await get_user_excluded_ingredients(current_user.id)
        
        prefs = await db.diabetes_meal_preferences.find_one(
            {"user_id": current_user.id},
            {"_id": 0}
        )
        
        if not prefs:
            raise HTTPException(status_code=400, detail="Please set your diabetes meal preferences first")
        
        today = datetime.now(timezone.utc)
        current_week_start = today - timedelta(days=today.weekday())
        target_week_start = current_week_start + timedelta(weeks=request.week_offset)
        target_week_str = target_week_start.strftime('%Y-%m-%d')
        
        existing = await db.diabetes_weekly_plans.find_one(
            {"user_id": current_user.id, "week_start": target_week_str},
            {"_id": 0}
        )
        
        if existing:
            return {"message": "Plan already exists", "plan": existing, "already_exists": True}
        
        meals = await generate_diabetes_weekly_meal_plan(
            current_user,
            diabetes_type=prefs.get('diabetes_type', 'type2'),
            dietary_preference=prefs.get('dietary_preference', 'non-vegetarian'),
            cuisine_preferences=prefs.get('cuisine_preferences', []),
            user_exclusions=user_exclusions,
            calorie_target=prefs.get('calorie_target')
        )
        
        plan_data = {
            "user_id": current_user.id,
            "week_start": target_week_str,
            "meals": meals,
            "diabetes_type": prefs.get('diabetes_type', 'type2'),
            "dietary_preference": prefs.get('dietary_preference', 'non-vegetarian'),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_diabetes_plan": True
        }
        
        await db.diabetes_weekly_plans.insert_one(plan_data)
        plan_data.pop('_id', None)
        
        return {"message": f"Diabetes meal plan for week of {target_week_str} generated!", "plan": plan_data, "already_exists": False}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error generating diabetes plan for week: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/meal-preferences")
async def save_diabetes_meal_preferences(request: DiabetesMealPlanRequest, current_user: User = Depends(get_current_user)):
    """Save user's diabetes meal planning preferences"""
    try:
        prefs_data = {
            "user_id": current_user.id,
            "diabetes_type": request.diabetes_type,
            "dietary_preference": request.dietary_preference,
            "cuisine_preferences": request.cuisine_preferences or [],
            "calorie_target": request.calorie_target,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.diabetes_meal_preferences.update_one(
            {"user_id": current_user.id},
            {"$set": prefs_data},
            upsert=True
        )
        
        return {"message": "Diabetes meal preferences saved!", "preferences": prefs_data}
    except Exception as e:
        logging.error(f"Error saving diabetes meal preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/meal-preferences")
async def get_diabetes_meal_preferences(current_user: User = Depends(get_current_user)):
    """Get user's diabetes meal planning preferences"""
    try:
        prefs = await db.diabetes_meal_preferences.find_one(
            {"user_id": current_user.id},
            {"_id": 0}
        )
        
        return {"preferences": prefs}
    except Exception as e:
        logging.error(f"Error fetching diabetes meal preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))
