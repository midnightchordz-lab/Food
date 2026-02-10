"""
Fridge Scanner - AI-powered ingredient detection from fridge photos
Uses GPT-4o Vision to identify ingredients and suggest recipes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import base64
import os
import json
import re
from datetime import datetime
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

from .deps import db, get_current_user, User

router = APIRouter(prefix="/api/fridge-scanner", tags=["Fridge Scanner"])

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Initialize OpenAI client with Emergent key
openai_client = None
if EMERGENT_LLM_KEY:
    openai_client = OpenAI(
        api_key=EMERGENT_LLM_KEY,
        base_url="https://llm.tnow.me/v1"
    )

# Response Models
class IngredientItem(BaseModel):
    name: str
    category: str  # vegetable, fruit, dairy, meat, condiment, etc.
    quantity: Optional[str] = None

class FridgeScanResult(BaseModel):
    ingredients: List[IngredientItem]
    suggested_recipes: List[dict]
    scan_id: str

class RecipeSuggestion(BaseModel):
    title: str
    description: str
    cooking_time: str
    difficulty: str
    ingredients_used: List[str]
    missing_ingredients: List[str]


@router.post("/scan", response_model=FridgeScanResult)
async def scan_fridge(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Scan a fridge photo to identify ingredients and suggest recipes.
    Accepts: JPEG, PNG, WEBP images
    """
    if not openai_client:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: JPEG, PNG, WEBP. Got: {file.content_type}"
        )
    
    try:
        # Read and encode image
        image_data = await file.read()
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # Determine mime type
        mime_type = file.content_type if file.content_type else "image/jpeg"
        
        # Call GPT-4o Vision API for ingredient detection
        ingredient_response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert at identifying food ingredients from refrigerator photos.
                    
When shown a fridge photo, identify ALL visible food items and ingredients.
Be specific about what you see - don't guess if something is unclear.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{"ingredients": [{"name": "ingredient name", "category": "category", "quantity": "estimated quantity if visible"}]}

Categories: vegetable, fruit, dairy, meat, seafood, beverage, condiment, grain, snack, leftover, other

Only include items you can clearly identify."""
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Please analyze this refrigerator photo and identify all visible food ingredients. List each item with its category."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_base64}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens=1000
        )
        
        # Parse ingredients from response
        ingredient_text = ingredient_response.choices[0].message.content
        ingredients = parse_ingredients(ingredient_text)
        
        # Now get recipe suggestions based on ingredients
        ingredient_names = [ing["name"] for ing in ingredients]
        
        recipe_response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """You are a creative chef who suggests delicious recipes based on available ingredients.

Given a list of ingredients, suggest 3-5 recipes that can be made.
Consider variety - include both quick meals and more elaborate options.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{"recipes": [{"title": "Recipe Name", "description": "Brief description", "cooking_time": "30 mins", "difficulty": "Easy", "ingredients_used": ["ingredient1", "ingredient2"], "missing_ingredients": ["optional ingredient"]}]}"""
                },
                {
                    "role": "user",
                    "content": f"I have these ingredients in my fridge: {', '.join(ingredient_names)}. Suggest 3-5 recipes I can make."
                }
            ],
            max_tokens=1500
        )
        
        recipe_text = recipe_response.choices[0].message.content
        recipes = parse_recipes(recipe_text)
        
        # Generate scan ID and save to database
        import uuid
        scan_id = str(uuid.uuid4())
        
        await db.fridge_scans.insert_one({
            "scan_id": scan_id,
            "user_id": current_user.id,
            "ingredients": ingredients,
            "suggested_recipes": recipes,
            "scanned_at": datetime.utcnow()
        })
        
        return FridgeScanResult(
            ingredients=[IngredientItem(**ing) for ing in ingredients],
            suggested_recipes=recipes,
            scan_id=scan_id
        )
        
    except Exception as e:
        print(f"Fridge scan error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze image: {str(e)}")


@router.get("/history")
async def get_scan_history(
    limit: int = 10,
    current_user: User = Depends(get_current_user)
):
    """Get user's fridge scan history"""
    try:
        scans = await db.fridge_scans.find(
            {"user_id": current_user.id},
            {"_id": 0}
        ).sort("scanned_at", -1).limit(limit).to_list(limit)
        
        return {"scans": scans}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get history: {str(e)}")


@router.get("/scan/{scan_id}")
async def get_scan_details(
    scan_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get details of a specific scan"""
    try:
        scan = await db.fridge_scans.find_one(
            {"scan_id": scan_id, "user_id": current_user.id},
            {"_id": 0}
        )
        
        if not scan:
            raise HTTPException(status_code=404, detail="Scan not found")
        
        return scan
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get scan: {str(e)}")


def parse_ingredients(response: str) -> List[dict]:
    """Parse ingredients from AI response"""
    try:
        # Clean response - remove markdown code blocks if present
        cleaned = response.strip()
        if cleaned.startswith("```"):
            # Remove ```json and ``` markers
            cleaned = re.sub(r'^```\w*\n?', '', cleaned)
            cleaned = re.sub(r'\n?```$', '', cleaned)
        
        # Try to extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', cleaned)
        if json_match:
            data = json.loads(json_match.group())
            if "ingredients" in data:
                return data["ingredients"]
        
        # Try direct parse
        data = json.loads(cleaned)
        if "ingredients" in data:
            return data["ingredients"]
        
        return [{"name": "Unable to identify ingredients", "category": "other", "quantity": None}]
        
    except Exception as e:
        print(f"Parse ingredients error: {e}, response: {response[:200]}")
        return [{"name": "Unable to parse ingredients", "category": "other", "quantity": None}]


def parse_recipes(response: str) -> List[dict]:
    """Parse recipes from AI response"""
    try:
        # Clean response - remove markdown code blocks if present
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r'^```\w*\n?', '', cleaned)
            cleaned = re.sub(r'\n?```$', '', cleaned)
        
        # Try to extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', cleaned)
        if json_match:
            data = json.loads(json_match.group())
            if "recipes" in data:
                return data["recipes"]
        
        # Try direct parse
        data = json.loads(cleaned)
        if "recipes" in data:
            return data["recipes"]
        
        return [{
            "title": "Custom Recipe",
            "description": "Create your own dish with available ingredients",
            "cooking_time": "Varies",
            "difficulty": "Medium",
            "ingredients_used": [],
            "missing_ingredients": []
        }]
        
    except Exception as e:
        print(f"Parse recipes error: {e}, response: {response[:200]}")
        return [{
            "title": "Unable to suggest recipes",
            "description": "Please try scanning again",
            "cooking_time": "N/A",
            "difficulty": "N/A",
            "ingredients_used": [],
            "missing_ingredients": []
        }]
