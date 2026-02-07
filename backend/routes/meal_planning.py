"""
Meal Planning Routes - Weekly plans, preferences, shopping lists, reminders, subscriptions
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timezone, timedelta
import os
import logging

from .deps import db, User, get_current_user
from .exclusions import get_user_excluded_ingredients
from .feature_gating import FeatureGate

router = APIRouter(tags=["Meal Planning"])

# ============== MODELS ==============

class ShoppingList(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(str(__import__('uuid').uuid4())))
    user_id: str
    items: List[Dict[str, Any]]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShoppingListCreate(BaseModel):
    items: List[Dict[str, Any]]

class WeeklyPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(str(__import__('uuid').uuid4())))
    user_id: str
    week_start: str
    meals: Dict[str, Any]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WeeklyPlanCreate(BaseModel):
    week_start: str
    meals: Dict[str, Any]

class MacroTargets(BaseModel):
    """Daily macro nutrient targets"""
    protein_g: Optional[int] = None  # grams
    carbs_g: Optional[int] = None    # grams
    fat_g: Optional[int] = None      # grams
    fiber_g: Optional[int] = None    # grams

class MealPreferences(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(str(__import__('uuid').uuid4())))
    user_id: str
    dietary_preference: Union[str, List[str]] = "non-vegetarian"
    calorie_target: Optional[int] = None
    macro_targets: Optional[MacroTargets] = None
    focus_areas: List[Any] = []  # Can be strings or dicts
    cuisine_preferences: List[Any] = []  # Can be strings or dicts
    mood: str = "balanced"
    is_active: bool = True
    generation_mode: str = "manual"
    day_specific_preferences: Optional[Dict[str, str]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MealPreferencesCreate(BaseModel):
    dietary_preference: Union[str, List[str]] = "non-vegetarian"
    calorie_target: Optional[int] = None
    macro_targets: Optional[MacroTargets] = None
    focus_areas: List[Any] = []  # Can be strings or dicts
    cuisine_preferences: List[Any] = []  # Can be strings or dicts
    mood: str = "balanced"
    is_active: bool = True
    generation_mode: str = "manual"
    day_specific_preferences: Optional[Dict[str, str]] = None

class AIWeeklyPlanRequest(BaseModel):
    mood: str
    dietary_preference: Optional[Union[str, List[str]]] = "non-vegetarian"
    calorie_target: Optional[int] = None
    macro_targets: Optional[MacroTargets] = None
    focus_areas: Optional[List[Any]] = []  # Can be strings or dicts
    cuisine_preferences: Optional[List[Any]] = []  # Can be strings or dicts
    day_specific_preferences: Optional[Dict[str, str]] = None

class WeekOffsetRequest(BaseModel):
    week_offset: int = 0

class MealReminder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(str(__import__('uuid').uuid4())))
    user_id: str
    day_of_week: str
    time: str
    meal_type: str
    enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReminderCreate(BaseModel):
    day_of_week: str
    time: str
    meal_type: str
    enabled: bool = True

class RecipeSubscription(BaseModel):
    email: str
    dietary_preference: str
    cuisines: List[str]
    recipes_per_week: int = 5
    delivery_day: str = "Sunday"

# ============== HELPER FUNCTIONS ==============

async def get_used_recipes(user_id: str, weeks: int = 8) -> List[str]:
    """Get list of recipes used in the last N weeks"""
    try:
        cutoff_date = datetime.now(timezone.utc) - timedelta(weeks=weeks)
        cutoff_str = cutoff_date.strftime('%Y-%m-%d')
        
        used = await db.used_recipes.find(
            {"user_id": user_id, "week_start": {"$gte": cutoff_str}}
        ).to_list(length=500)
        
        # Filter to only include valid string recipe names
        recipe_names = []
        for r in used:
            name = r.get('recipe_name')
            if isinstance(name, str) and len(name) > 2:
                recipe_names.append(name)
        
        return recipe_names
    except Exception as e:
        logging.error(f"Error getting used recipes: {e}")
        return []


async def track_used_recipes(user_id: str, meals: Dict, week_start: str):
    """Track recipes used in a weekly plan to avoid repetition"""
    try:
        recipes_to_track = []
        for day, day_meals in meals.items():
            for meal_type, recipe_name in day_meals.items():
                # Skip drink pairings and non-string values
                if meal_type == 'dinner_pairing' or not isinstance(recipe_name, str):
                    continue
                    
                clean_name = recipe_name.split('(~')[0].strip() if '(~' in recipe_name else recipe_name
                
                # Skip empty or very short names
                if not clean_name or len(clean_name) < 3:
                    continue
                    
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

# ============== SHOPPING LIST ROUTES ==============

@router.post("/shopping-list", response_model=ShoppingList)
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
            import uuid
            shopping_list = ShoppingList(
                id=str(uuid.uuid4()),
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


@router.get("/shopping-list")
async def get_shopping_list(current_user: User = Depends(get_current_user)):
    try:
        shopping_list = await db.shopping_lists.find_one({"user_id": current_user.id}, {"_id": 0})
        if not shopping_list:
            return {"items": []}
        return shopping_list
    except Exception as e:
        logging.error(f"Error fetching shopping list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/shopping-list/export")
async def export_shopping_list_pdf(current_user: User = Depends(get_current_user)):
    try:
        from pdf_generator import generate_shopping_list_pdf
        
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

# ============== WEEKLY PLAN ROUTES ==============

@router.post("/weekly-plan", response_model=WeeklyPlan)
async def create_weekly_plan(request: WeeklyPlanCreate, current_user: User = Depends(get_current_user)):
    try:
        import uuid
        plan = WeeklyPlan(id=str(uuid.uuid4()), user_id=current_user.id, **request.model_dump())
        plan_dict = plan.model_dump()
        plan_dict['created_at'] = plan_dict['created_at'].isoformat()
        await db.weekly_plans.insert_one(plan_dict)
        return plan
    except Exception as e:
        logging.error(f"Error creating weekly plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/weekly-plan")
async def get_weekly_plans(current_user: User = Depends(get_current_user)):
    try:
        plans = await db.weekly_plans.find({"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(10)
        return {"plans": plans}
    except Exception as e:
        logging.error(f"Error fetching weekly plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/weekly-plan/generate")
async def generate_weekly_plan(request: AIWeeklyPlanRequest, current_user: User = Depends(get_current_user)):
    try:
        from ai_meal_planner import generate_ai_meal_plan
        import uuid
        
        user_exclusions = await get_user_excluded_ingredients(current_user.id)
        
        # Convert MacroTargets model to dict if present
        macro_dict = None
        if request.macro_targets:
            macro_dict = request.macro_targets.model_dump() if hasattr(request.macro_targets, 'model_dump') else dict(request.macro_targets)
        
        meals = await generate_ai_meal_plan(
            current_user,
            request.mood,
            request.dietary_preference,
            request.calorie_target,
            request.focus_areas,
            request.cuisine_preferences,
            user_exclusions=user_exclusions,
            macro_targets=macro_dict,
            day_specific_preferences=request.day_specific_preferences
        )
        
        today = datetime.now(timezone.utc)
        week_start = today - timedelta(days=today.weekday())
        
        plan = WeeklyPlan(
            id=str(uuid.uuid4()),
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


@router.get("/weekly-plan/current")
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


@router.post("/weekly-plan/generate-for-week")
async def generate_plan_for_week(request: WeekOffsetRequest, current_user: User = Depends(get_current_user)):
    """Generate plan for a specific week using saved preferences"""
    try:
        from ai_meal_planner import generate_ai_meal_plan
        import uuid
        
        prefs = await db.meal_preferences.find_one(
            {"user_id": current_user.id},
            {"_id": 0}
        )
        if not prefs:
            raise HTTPException(status_code=400, detail="No meal preferences found. Please set your preferences first.")
        
        # Use local date calculation to match frontend
        today = datetime.now()  # Local time, not UTC
        # Get Monday of current week
        current_week_start = today - timedelta(days=today.weekday())
        current_week_start = current_week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        # Calculate target week
        target_week_start = current_week_start + timedelta(days=request.week_offset * 7)
        target_week_str = target_week_start.strftime('%Y-%m-%d')
        
        logging.info(f"Generating plan for week: {target_week_str} (offset: {request.week_offset})")
        
        existing = await db.weekly_plans.find_one(
            {"user_id": current_user.id, "week_start": target_week_str},
            {"_id": 0}
        )
        
        if existing:
            logging.info(f"Plan already exists for week: {target_week_str}")
            return {"message": "Plan for this week already exists", "plan": existing, "already_exists": True}
        
        used_recipes = await get_used_recipes(current_user.id, weeks=8)
        user_exclusions = await get_user_excluded_ingredients(current_user.id)
        
        logging.info(f"Generating AI meal plan for week: {target_week_str}")
        logging.info(f"Used recipes to exclude: {used_recipes}")
        
        # Log the parameters being passed for debugging
        focus_areas_val = prefs.get('focus_areas', [])
        cuisine_prefs_val = prefs.get('cuisine_preferences', [])
        dietary_pref_val = prefs.get('dietary_preference', 'non-vegetarian')
        
        logging.info(f"Parameters - dietary: {dietary_pref_val}, focus_areas: {focus_areas_val}, cuisines: {cuisine_prefs_val}")
        logging.info(f"User exclusions: {user_exclusions}")
        logging.info(f"User dietary_restrictions: {current_user.dietary_restrictions}")
        
        meals = await generate_ai_meal_plan(
            current_user,
            prefs.get('mood', 'balanced'),
            dietary_pref_val,
            prefs.get('calorie_target'),
            focus_areas_val,
            cuisine_prefs_val,
            exclude_recipes=used_recipes,
            user_exclusions=user_exclusions,
            macro_targets=prefs.get('macro_targets')
        )
        
        plan = WeeklyPlan(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            week_start=target_week_str,
            meals=meals
        )
        plan_dict = plan.model_dump()
        plan_dict['created_at'] = plan_dict['created_at'].isoformat()
        await db.weekly_plans.insert_one(plan_dict)
        
        plan_dict.pop('_id', None)
        
        await track_used_recipes(current_user.id, meals, target_week_str)
        
        logging.info(f"Successfully generated plan for week: {target_week_str}")
        return {"message": f"Meal plan for week of {target_week_str} generated!", "plan": plan_dict, "already_exists": False}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error generating plan for week: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/weekly-plan/generate-next")
async def generate_next_week_plan(current_user: User = Depends(get_current_user)):
    """Generate plan for the next week using saved preferences"""
    try:
        from ai_meal_planner import generate_ai_meal_plan
        import uuid
        
        prefs = await db.meal_preferences.find_one(
            {"user_id": current_user.id},
            {"_id": 0}
        )
        if not prefs:
            raise HTTPException(status_code=400, detail="No meal preferences found. Please set your preferences first.")
        
        if not prefs.get('is_active', False):
            raise HTTPException(status_code=400, detail="Continuous planning is not active. Enable it in preferences.")
        
        # Use local date calculation to match frontend
        today = datetime.now()  # Local time, not UTC
        current_week_start = today - timedelta(days=today.weekday())
        current_week_start = current_week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        next_week_start = current_week_start + timedelta(days=7)
        next_week_str = next_week_start.strftime('%Y-%m-%d')
        
        logging.info(f"Generating next week plan: {next_week_str}")
        
        existing = await db.weekly_plans.find_one(
            {"user_id": current_user.id, "week_start": next_week_str},
            {"_id": 0}
        )
        
        if existing:
            return {"message": "Plan for next week already exists", "plan": existing, "already_exists": True}
        
        used_recipes = await get_used_recipes(current_user.id, weeks=8)
        user_exclusions = await get_user_excluded_ingredients(current_user.id)
        
        meals = await generate_ai_meal_plan(
            current_user,
            prefs.get('mood', 'balanced'),
            prefs.get('dietary_preference', 'non-vegetarian'),
            prefs.get('calorie_target'),
            prefs.get('focus_areas', []),
            prefs.get('cuisine_preferences', []),
            exclude_recipes=used_recipes,
            user_exclusions=user_exclusions,
            macro_targets=prefs.get('macro_targets')
        )
        
        plan = WeeklyPlan(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            week_start=next_week_str,
            meals=meals
        )
        plan_dict = plan.model_dump()
        plan_dict['created_at'] = plan_dict['created_at'].isoformat()
        await db.weekly_plans.insert_one(plan_dict)
        
        plan_dict.pop('_id', None)
        
        await track_used_recipes(current_user.id, meals, next_week_str)
        
        return {"message": "Next week's meal plan generated!", "plan": plan_dict, "already_exists": False}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error generating next week plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== MEAL PREFERENCES ROUTES ==============

@router.post("/meal-preferences")
async def save_meal_preferences(request: MealPreferencesCreate, current_user: User = Depends(get_current_user)):
    """Save user meal preferences for continuous planning"""
    try:
        from ai_meal_planner import generate_ai_meal_plan
        import uuid
        
        prefs = MealPreferences(
            id=str(uuid.uuid4()),
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
        
        if request.is_active:
            today = datetime.now(timezone.utc)
            week_start = today - timedelta(days=today.weekday())
            week_start_str = week_start.strftime('%Y-%m-%d')
            
            existing = await db.weekly_plans.find_one({
                "user_id": current_user.id,
                "week_start": week_start_str
            })
            
            if not existing:
                used_recipes = await get_used_recipes(current_user.id)
                user_exclusions = await get_user_excluded_ingredients(current_user.id)
                
                # Convert MacroTargets model to dict if present
                macro_dict = None
                if request.macro_targets:
                    macro_dict = request.macro_targets.model_dump() if hasattr(request.macro_targets, 'model_dump') else dict(request.macro_targets)
                
                meals = await generate_ai_meal_plan(
                    current_user,
                    request.mood,
                    request.dietary_preference,
                    request.calorie_target,
                    request.focus_areas,
                    request.cuisine_preferences,
                    exclude_recipes=used_recipes,
                    user_exclusions=user_exclusions,
                    macro_targets=macro_dict,
                    day_specific_preferences=request.day_specific_preferences
                )
                
                plan = WeeklyPlan(
                    id=str(uuid.uuid4()),
                    user_id=current_user.id,
                    week_start=week_start_str,
                    meals=meals
                )
                plan_dict = plan.model_dump()
                plan_dict['created_at'] = plan_dict['created_at'].isoformat()
                await db.weekly_plans.insert_one(plan_dict)
                
                await track_used_recipes(current_user.id, meals, week_start_str)
        
        return {"message": "Meal preferences saved successfully!", "preferences": prefs_dict}
    except Exception as e:
        logging.error(f"Error saving meal preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/meal-preferences")
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

# ============== REMINDERS ROUTES ==============

@router.post("/reminders")
async def create_reminder(reminder_data: ReminderCreate, current_user: User = Depends(get_current_user)):
    try:
        import uuid
        reminder = MealReminder(id=str(uuid.uuid4()), user_id=current_user.id, **reminder_data.model_dump())
        reminder_dict = reminder.model_dump()
        reminder_dict['created_at'] = reminder_dict['created_at'].isoformat()
        await db.meal_reminders.insert_one(reminder_dict)
        return reminder
    except Exception as e:
        logging.error(f"Error creating reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reminders")
async def get_reminders(current_user: User = Depends(get_current_user)):
    try:
        reminders = await db.meal_reminders.find({"user_id": current_user.id}, {"_id": 0}).to_list(100)
        return {"reminders": reminders}
    except Exception as e:
        logging.error(f"Error fetching reminders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, current_user: User = Depends(get_current_user)):
    try:
        result = await db.meal_reminders.delete_one({"id": reminder_id, "user_id": current_user.id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Reminder not found")
        return {"message": "Reminder deleted successfully"}
    except Exception as e:
        logging.error(f"Error deleting reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== SUBSCRIPTION ROUTES ==============

@router.post("/subscription/recipes")
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
        
        await db.recipe_subscriptions.update_one(
            {"user_id": current_user.id},
            {"$set": subscription},
            upsert=True
        )
        
        logging.info(f"New recipe subscription: {request.email}")
        
        return {"status": "subscribed", "message": "Successfully subscribed to weekly recipes!"}
    except Exception as e:
        logging.error(f"Subscription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subscription/recipes")
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


@router.delete("/subscription/recipes")
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
