"""
Recipe Routes - Save, retrieve, rate, search, and detailed recipes
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import os
import uuid
import logging

from emergentintegrations.llm.chat import LlmChat, UserMessage

from .deps import db, User, get_current_user
from .chat import get_detailed_recipe_prompt

router = APIRouter(prefix="/recipes", tags=["Recipes"])

# ============== MODELS ==============

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

class RecipeRating(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    recipe_id: str
    rating: int
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

class DetailedRecipeRequest(BaseModel):
    recipe_title: str
    recipe_id: Optional[str] = None  # ID from chat-generated recipe for AI Chef lookup
    cuisine: str = "International"
    meal_type: str = "Dinner"
    dietary_pref: str = "Any"

class DiscoverRecipeRequest(BaseModel):
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

# ============== ROUTES ==============

@router.post("/detailed")
async def get_detailed_recipe(request: DetailedRecipeRequest, current_user: User = Depends(get_current_user)):
    """Generate a comprehensive detailed recipe"""
    try:
        logging.info(f"Generating detailed recipe for: {request.recipe_title}")
        
        # Check cache first
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
        chat.with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=f"Generate the complete detailed recipe for {request.recipe_title}")
        detailed_content = await chat.send_message(user_message)
        
        # Cache in database - include recipe_id for AI Chef lookup
        update_doc = {
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
        }
        
        # Add recipe_id if provided (for AI Chef to find)
        if request.recipe_id:
            update_doc["$set"]["id"] = request.recipe_id
        
        await db.detailed_recipes.update_one(
            {"title_lower": request.recipe_title.lower().strip()},
            update_doc,
            upsert=True
        )
        
        return {"recipe": detailed_content, "cached": False}
    except Exception as e:
        logging.error(f"Error generating detailed recipe: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save", response_model=SavedRecipe)
async def save_recipe(request: SaveRecipeRequest, current_user: User = Depends(get_current_user)):
    try:
        from image_service import get_food_image
        
        recipe = Recipe(**request.recipe.model_dump())
        
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


@router.get("/saved")
async def get_saved_recipes(current_user: User = Depends(get_current_user)):
    try:
        saved = await db.saved_recipes.find({"user_id": current_user.id}, {"_id": 0}).to_list(100)
        recipe_ids = [s['recipe_id'] for s in saved]
        
        recipes = await db.recipes.find({"id": {"$in": recipe_ids}}, {"_id": 0}).to_list(100)
        imported = await db.imported_recipes.find({"id": {"$in": recipe_ids}}, {"_id": 0}).to_list(100)
        
        for imp in imported:
            if imp.get('ingredients') and len(imp['ingredients']) > 0:
                if isinstance(imp['ingredients'][0], dict):
                    imp['ingredients'] = [ing.get('name', str(ing)) for ing in imp['ingredients']]
            
            if imp.get('instructions') and len(imp['instructions']) > 0:
                if isinstance(imp['instructions'][0], dict):
                    imp['instructions'] = [inst.get('instruction', str(inst)) for inst in imp['instructions']]
            
            imp['mood_tags'] = imp.get('mood_tags', [imp.get('cuisine_type', 'Imported')])
            imp['nutritional_highlights'] = imp.get('nutritional_highlights', f"Imported recipe - {imp.get('cuisine_type', 'International')} cuisine")
            imp['complexity'] = imp.get('complexity', imp.get('difficulty', 'Standard'))
        
        all_recipes = recipes + imported
        
        return {"recipes": all_recipes}
    except Exception as e:
        logging.error(f"Error fetching saved recipes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{recipe_id}/add-to-shopping-list")
async def add_recipe_to_shopping_list(recipe_id: str, current_user: User = Depends(get_current_user)):
    try:
        recipe = await db.recipes.find_one({"id": recipe_id}, {"_id": 0})
        if not recipe:
            recipe = await db.imported_recipes.find_one({"id": recipe_id}, {"_id": 0})
        
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        ingredients_list = recipe.get('ingredients', [])
        if ingredients_list and isinstance(ingredients_list[0], dict):
            new_items = [{"name": ing.get('name', str(ing)), "checked": False} for ing in ingredients_list]
        else:
            new_items = [{"name": ingredient, "checked": False} for ingredient in ingredients_list]
        
        existing_list = await db.shopping_lists.find_one({"user_id": current_user.id}, {"_id": 0})
        
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
            from .meal_planning import ShoppingList
            shopping_list = ShoppingList(user_id=current_user.id, items=new_items)
            list_dict = shopping_list.model_dump()
            list_dict['created_at'] = list_dict['created_at'].isoformat()
            list_dict['updated_at'] = list_dict['updated_at'].isoformat()
            await db.shopping_lists.insert_one(list_dict)
        
        return {"message": "Ingredients added to shopping list", "items_added": len(new_items)}
    except Exception as e:
        logging.error(f"Error adding to shopping list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{recipe_id}/rate")
async def rate_recipe(recipe_id: str, rating_data: RatingCreate, current_user: User = Depends(get_current_user)):
    try:
        existing_rating = await db.recipe_ratings.find_one({
            "user_id": current_user.id,
            "recipe_id": recipe_id
        }, {"_id": 0})
        
        if existing_rating:
            await db.recipe_ratings.update_one(
                {"user_id": current_user.id, "recipe_id": recipe_id},
                {"$set": {
                    "rating": rating_data.rating,
                    "review": rating_data.review
                }}
            )
            return {"message": "Rating updated successfully"}
        else:
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


@router.get("/{recipe_id}/ratings")
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


@router.post("/search")
async def search_recipes(search_params: RecipeSearchRequest, current_user: User = Depends(get_current_user)):
    try:
        query = {}
        
        saved = await db.saved_recipes.find({"user_id": current_user.id}, {"_id": 0, "recipe_id": 1}).to_list(100)
        saved_ids = [s['recipe_id'] for s in saved]
        query["id"] = {"$in": saved_ids}
        
        if search_params.query:
            query["$or"] = [
                {"title": {"$regex": search_params.query, "$options": "i"}},
                {"description": {"$regex": search_params.query, "$options": "i"}}
            ]
        
        if search_params.mood_tags:
            query["mood_tags"] = {"$in": search_params.mood_tags}
        
        if search_params.dietary_tags:
            query["dietary_info"] = {"$all": search_params.dietary_tags}
        
        if search_params.complexity:
            query["complexity"] = search_params.complexity
        
        recipes = await db.recipes.find(query, {"_id": 0}).to_list(100)
        return {"recipes": recipes}
    except Exception as e:
        logging.error(f"Error searching recipes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/discover")
async def discover_recipes(request: DiscoverRecipeRequest, current_user: User = Depends(get_current_user)):
    """Discover curated recipes organized by cuisine"""
    try:
        from image_service import get_food_image
        
        CUISINE_RECIPES = {
            'Indian': [
                {'title': 'Butter Chicken', 'description': 'Creamy tomato-based curry with tender chicken', 'cooking_time': '50 min', 'difficulty': 'Medium'},
                {'title': 'Palak Paneer', 'description': 'Spinach curry with cottage cheese cubes', 'cooking_time': '35 min', 'difficulty': 'Easy'},
                {'title': 'Chicken Biryani', 'description': 'Fragrant basmati rice layered with marinated chicken', 'cooking_time': '90 min', 'difficulty': 'Hard'},
                {'title': 'Dal Tadka', 'description': 'Yellow lentils tempered with cumin and garlic', 'cooking_time': '30 min', 'difficulty': 'Easy'},
                {'title': 'Chole Bhature', 'description': 'Spiced chickpea curry with fluffy fried bread', 'cooking_time': '60 min', 'difficulty': 'Medium'},
            ],
            'Chinese': [
                {'title': 'Kung Pao Chicken', 'description': 'Spicy stir-fried chicken with peanuts', 'cooking_time': '25 min', 'difficulty': 'Easy'},
                {'title': 'Mapo Tofu', 'description': 'Silky tofu in a spicy Sichuan peppercorn sauce', 'cooking_time': '30 min', 'difficulty': 'Medium'},
                {'title': 'Sweet and Sour Pork', 'description': 'Crispy pork in tangy sweet and sour sauce', 'cooking_time': '35 min', 'difficulty': 'Medium'},
                {'title': 'Fried Rice', 'description': 'Wok-tossed rice with eggs and vegetables', 'cooking_time': '20 min', 'difficulty': 'Easy'},
            ],
            'Italian': [
                {'title': 'Spaghetti Carbonara', 'description': 'Classic Roman pasta with eggs and pecorino', 'cooking_time': '20 min', 'difficulty': 'Easy'},
                {'title': 'Margherita Pizza', 'description': 'Classic pizza with tomato, mozzarella, and basil', 'cooking_time': '30 min', 'difficulty': 'Medium'},
                {'title': 'Risotto alla Milanese', 'description': 'Creamy saffron-infused rice', 'cooking_time': '45 min', 'difficulty': 'Medium'},
            ],
            'Mexican': [
                {'title': 'Tacos al Pastor', 'description': 'Marinated pork with pineapple and cilantro', 'cooking_time': '40 min', 'difficulty': 'Easy'},
                {'title': 'Guacamole', 'description': 'Fresh avocado dip with lime and cilantro', 'cooking_time': '15 min', 'difficulty': 'Easy'},
                {'title': 'Enchiladas Verdes', 'description': 'Rolled tortillas in green tomatillo sauce', 'cooking_time': '45 min', 'difficulty': 'Medium'},
            ],
            'Japanese': [
                {'title': 'Chicken Teriyaki', 'description': 'Glazed chicken with sweet teriyaki sauce', 'cooking_time': '25 min', 'difficulty': 'Easy'},
                {'title': 'Katsu Curry', 'description': 'Crispy pork cutlet with Japanese curry', 'cooking_time': '40 min', 'difficulty': 'Medium'},
                {'title': 'Miso Soup', 'description': 'Traditional soup with tofu and wakame', 'cooking_time': '15 min', 'difficulty': 'Easy'},
            ],
            'Thai': [
                {'title': 'Pad Thai', 'description': 'Stir-fried rice noodles with shrimp and peanuts', 'cooking_time': '30 min', 'difficulty': 'Easy'},
                {'title': 'Green Curry', 'description': 'Coconut milk curry with green chilies', 'cooking_time': '35 min', 'difficulty': 'Medium'},
                {'title': 'Tom Yum Soup', 'description': 'Hot and sour soup with lemongrass', 'cooking_time': '25 min', 'difficulty': 'Easy'},
            ],
        }
        
        discovered_recipes = []
        
        if request.cuisine and request.cuisine in CUISINE_RECIPES:
            cuisines_to_search = [request.cuisine]
        else:
            cuisines_to_search = list(CUISINE_RECIPES.keys())
        
        recipes_per_cuisine = max(2, request.count // len(cuisines_to_search))
        
        for cuisine in cuisines_to_search:
            cuisine_recipes = CUISINE_RECIPES.get(cuisine, [])
            
            for recipe in cuisine_recipes[:recipes_per_cuisine]:
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
