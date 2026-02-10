"""
Fridge Scanner - AI-powered ingredient detection from fridge photos
Uses GPT-5.1 Vision to identify ingredients and suggest recipes
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

load_dotenv()

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from .deps import db, get_current_user, User
from .feature_gating import FeatureGate

router = APIRouter(prefix="/api/fridge-scanner", tags=["Fridge Scanner"])

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

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
    Requires: Premium subscription or higher
    """
    # Check feature access - Fridge Scanner requires Premium
    access = await FeatureGate.check_access(current_user.id, "fridge_scanner")
    if not access["allowed"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "feature_locked",
                "message": access["reason"],
                "feature": "fridge_scanner",
                "upgrade_to": access["upgrade_to"],
                "current_plan": access["current_plan"]
            }
        )
    
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: JPEG, PNG, WEBP. Got: {file.content_type}"
        )
    
    try:
        # Read image
        image_data = await file.read()
        
        # Compress image if too large (max 1MB)
        from PIL import Image
        import io
        
        if len(image_data) > 1024 * 1024:  # If larger than 1MB
            img = Image.open(io.BytesIO(image_data))
            # Resize to max 1024px on longest side
            max_size = 1024
            ratio = min(max_size / img.width, max_size / img.height)
            if ratio < 1:
                new_size = (int(img.width * ratio), int(img.height * ratio))
                img = img.resize(new_size, Image.LANCZOS)
            # Convert to RGB if needed
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            # Save compressed
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=75)
            image_data = buffer.getvalue()
        
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # Single AI call for BOTH ingredients AND recipes (faster!)
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"fridge-scan-{current_user.id}-{datetime.utcnow().timestamp()}",
            system_message="""You are an expert chef and food identifier. Analyze fridge photos to identify ingredients AND suggest recipes in one response.

Respond ONLY with valid JSON (no markdown):
{
  "ingredients": [{"name": "item", "category": "vegetable/fruit/dairy/meat/seafood/beverage/condiment/grain/snack/other", "quantity": "amount if visible"}],
  "recipes": [{"title": "Recipe Name", "description": "Brief description", "cooking_time": "X mins", "difficulty": "Easy/Medium/Hard", "servings": "2-4", "ingredients_used": ["item1", "item2"], "missing_ingredients": ["optional item"], "instructions": ["Step 1...", "Step 2...", "Step 3..."]}]
}

Be concise. Identify 5-15 ingredients max. Suggest 3 quick recipes with 3-5 instruction steps each."""
        ).with_model("openai", "gpt-5.1")
        
        # Single message with image
        image_content = ImageContent(image_base64=image_base64)
        user_message = UserMessage(
            text="Identify all food ingredients in this fridge photo and suggest 3 quick recipes I can make. Include cooking instructions.",
            file_contents=[image_content]
        )
        
        # Get combined response
        response = await chat.send_message(user_message)
        
        # Parse combined response
        result = parse_combined_response(response)
        ingredients = result.get("ingredients", [])
        recipes = result.get("recipes", [])
        
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


def parse_combined_response(response: str) -> dict:
    """Parse combined ingredients and recipes from AI response (optimized single-call)"""
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
            # Validate structure
            result = {
                "ingredients": data.get("ingredients", []),
                "recipes": data.get("recipes", [])
            }
            return result
        
        # Try direct parse
        data = json.loads(cleaned)
        return {
            "ingredients": data.get("ingredients", []),
            "recipes": data.get("recipes", [])
        }
        
    except Exception as e:
        print(f"Parse combined response error: {e}, response: {response[:200]}")
        return {
            "ingredients": [{"name": "Unable to identify ingredients", "category": "other", "quantity": None}],
            "recipes": [{
                "title": "Unable to suggest recipes",
                "description": "Please try scanning again with a clearer image",
                "cooking_time": "N/A",
                "difficulty": "N/A",
                "ingredients_used": [],
                "missing_ingredients": [],
                "instructions": []
            }]
        }


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
