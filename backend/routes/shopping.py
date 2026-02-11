"""
Shopping Routes - Buy ingredients and regional delivery app integration
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional
import logging
import httpx

from .deps import db, User, get_current_user

# Import delivery apps config
import sys
sys.path.insert(0, '/app/backend')
from config.delivery_apps import DELIVERY_APPS, get_apps_for_country, build_delivery_url

router = APIRouter(prefix="/shopping", tags=["Shopping"])


class IngredientItem(BaseModel):
    name: str
    amount: Optional[str] = ""
    unit: Optional[str] = ""


class BuildUrlRequest(BaseModel):
    app_id: str
    ingredients: List[IngredientItem]
    country_code: str


class AddToListRequest(BaseModel):
    ingredients: List[IngredientItem]
    recipe_id: Optional[str] = None
    recipe_name: Optional[str] = None


async def detect_country_from_ip(ip_address: str) -> str:
    """
    Detect user's country from their IP address
    Uses free ipapi.co service
    """
    try:
        # Skip for localhost/private IPs
        if ip_address in ['127.0.0.1', '::1', 'localhost'] or ip_address.startswith('10.') or ip_address.startswith('192.168.'):
            return 'IN'  # Default to India for development
        
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"https://ipapi.co/{ip_address}/country/")
            if response.status_code == 200:
                return response.text.strip()
    except Exception as e:
        logging.error(f"IP detection failed: {e}")
    
    return 'DEFAULT'


def get_client_ip(request: Request) -> str:
    """Extract client IP from request headers"""
    forwarded = request.headers.get('x-forwarded-for')
    if forwarded:
        return forwarded.split(',')[0].strip()
    
    real_ip = request.headers.get('x-real-ip')
    if real_ip:
        return real_ip
    
    return request.client.host if request.client else '127.0.0.1'


@router.get("/delivery-apps")
async def get_delivery_apps(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    GET /api/shopping/delivery-apps
    Get available delivery apps for user's region
    Called when user opens the Buy Ingredients sheet
    """
    try:
        # Get user's IP
        ip = get_client_ip(request)
        logging.info(f"Detecting region for IP: {ip}")
        
        # Check if user has saved preference
        user_doc = await db.users.find_one({"id": current_user.id}, {"preferred_country": 1})
        saved_country = user_doc.get("preferred_country") if user_doc else None
        
        # Detect country from IP if no preference
        country_code = saved_country or await detect_country_from_ip(ip)
        
        # Get apps for that country
        apps_data = get_apps_for_country(country_code)
        
        return {
            "success": True,
            **apps_data,
            "detected_from": "user_preference" if saved_country else "ip_detection"
        }
    
    except Exception as e:
        logging.error(f"Delivery apps error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get delivery apps")


@router.post("/build-url")
async def build_url(
    request: BuildUrlRequest,
    current_user: User = Depends(get_current_user)
):
    """
    POST /api/shopping/build-url
    Build delivery URL for selected app and ingredients
    """
    try:
        if not request.app_id or not request.ingredients:
            raise HTTPException(status_code=400, detail="app_id and ingredients are required")
        
        # Get apps for country
        country_apps = DELIVERY_APPS.get(request.country_code, DELIVERY_APPS["DEFAULT"])
        app = next((a for a in country_apps["apps"] if a["id"] == request.app_id), None)
        
        if not app:
            raise HTTPException(status_code=404, detail="App not found")
        
        # Build URL
        ingredients_list = [{"name": ing.name, "amount": ing.amount} for ing in request.ingredients]
        url = build_delivery_url(app, ingredients_list)
        
        return {
            "success": True,
            "url": url,
            "app_name": app["name"],
            "app_id": request.app_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Build URL error: {e}")
        raise HTTPException(status_code=500, detail="Failed to build URL")


@router.post("/list/add")
async def add_to_shopping_list(
    request: AddToListRequest,
    current_user: User = Depends(get_current_user)
):
    """
    POST /api/shopping/list/add
    Save selected ingredients to user's shopping list
    """
    try:
        if not request.ingredients:
            raise HTTPException(status_code=400, detail="No ingredients provided")
        
        from datetime import datetime, timezone
        
        # Find or create shopping list
        shopping_list = await db.shopping_lists.find_one({
            "user_id": current_user.id,
            "status": "active"
        })
        
        if not shopping_list:
            shopping_list = {
                "user_id": current_user.id,
                "status": "active",
                "items": [],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        
        # Add ingredients (avoid duplicates)
        existing_names = {item["name"].lower() for item in shopping_list.get("items", [])}
        
        new_items = []
        for ing in request.ingredients:
            if ing.name.lower() not in existing_names:
                new_items.append({
                    "name": ing.name,
                    "amount": ing.amount,
                    "unit": ing.unit,
                    "recipe_id": request.recipe_id,
                    "recipe_name": request.recipe_name,
                    "checked": False,
                    "added_at": datetime.now(timezone.utc).isoformat()
                })
                existing_names.add(ing.name.lower())
        
        shopping_list["items"] = shopping_list.get("items", []) + new_items
        shopping_list["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Upsert
        await db.shopping_lists.update_one(
            {"user_id": current_user.id, "status": "active"},
            {"$set": shopping_list},
            upsert=True
        )
        
        return {
            "success": True,
            "message": f"Added {len(new_items)} ingredients to shopping list",
            "total_items": len(shopping_list["items"])
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Add to list error: {e}")
        raise HTTPException(status_code=500, detail="Failed to add to shopping list")


@router.get("/list")
async def get_shopping_list(current_user: User = Depends(get_current_user)):
    """
    GET /api/shopping/list
    Get user's current shopping list
    """
    try:
        shopping_list = await db.shopping_lists.find_one(
            {"user_id": current_user.id, "status": "active"},
            {"_id": 0}
        )
        
        return {
            "success": True,
            "items": shopping_list.get("items", []) if shopping_list else [],
            "total_items": len(shopping_list.get("items", [])) if shopping_list else 0
        }
    
    except Exception as e:
        logging.error(f"Get list error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get shopping list")


@router.post("/set-country")
async def set_preferred_country(
    country_code: str,
    current_user: User = Depends(get_current_user)
):
    """
    POST /api/shopping/set-country
    Save user's preferred country for delivery apps
    """
    try:
        # Validate country code
        if country_code not in DELIVERY_APPS and country_code != "DEFAULT":
            raise HTTPException(status_code=400, detail="Invalid country code")
        
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"preferred_country": country_code}}
        )
        
        return {
            "success": True,
            "country_code": country_code,
            "message": f"Country set to {DELIVERY_APPS.get(country_code, DELIVERY_APPS['DEFAULT'])['country']}"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Set country error: {e}")
        raise HTTPException(status_code=500, detail="Failed to set country")
