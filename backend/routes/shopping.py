"""
Shopping Routes - Buy ingredients and regional delivery app integration
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
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


async def detect_country_from_ip(request: Request) -> tuple[str, str]:
    """
    Detect user's country from their IP address
    Uses free ipapi.co service
    Returns: (country_code, detection_method)
    """
    try:
        # Try to get the real client IP from various headers
        # Check Cloudflare header first (most reliable)
        cf_country = request.headers.get('cf-ipcountry')
        if cf_country and cf_country != 'XX':
            logging.info(f"Country from Cloudflare: {cf_country}")
            return cf_country, 'cloudflare'
        
        # Get IP from forwarded headers
        ip_address = None
        forwarded = request.headers.get('x-forwarded-for')
        if forwarded:
            # Get the first (original client) IP
            ip_address = forwarded.split(',')[0].strip()
        
        if not ip_address:
            ip_address = request.headers.get('x-real-ip')
        
        if not ip_address and request.client:
            ip_address = request.client.host
        
        if not ip_address:
            return 'DEFAULT', 'fallback'
        
        logging.info(f"Detecting country for IP: {ip_address}")
        
        # Skip for localhost/private IPs - but try to use a geo service anyway
        if ip_address in ['127.0.0.1', '::1', 'localhost']:
            return 'DEFAULT', 'localhost'
        
        # Check if private IP (10.x, 192.168.x, 172.16-31.x)
        if (ip_address.startswith('10.') or 
            ip_address.startswith('192.168.') or 
            ip_address.startswith('172.') and 16 <= int(ip_address.split('.')[1]) <= 31):
            # For private IPs in k8s, try to detect via external service
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.get("https://ipapi.co/country/")
                if response.status_code == 200:
                    country = response.text.strip()
                    logging.info(f"Country from ipapi (server IP): {country}")
                    return country, 'server_ip'
            return 'DEFAULT', 'private_ip'
        
        # For public IPs, detect country
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"https://ipapi.co/{ip_address}/country/")
            if response.status_code == 200:
                country = response.text.strip()
                logging.info(f"Country from ipapi: {country}")
                return country, 'ip_detection'
    except Exception as e:
        logging.error(f"IP detection failed: {e}")
    
    return 'DEFAULT', 'error'


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
    country_hint: str = Query(None, description="Optional country code hint from browser"),
    current_user: User = Depends(get_current_user)
):
    """
    GET /api/shopping/delivery-apps
    Get available delivery apps for user's region
    Called when user opens the Buy Ingredients sheet
    """
    try:
        # Check if user has saved preference first
        user_doc = await db.users.find_one({"id": current_user.id}, {"preferred_country": 1})
        saved_country = user_doc.get("preferred_country") if user_doc else None
        
        if saved_country:
            apps_data = get_apps_for_country(saved_country)
            return {
                "success": True,
                **apps_data,
                "detected_from": "user_preference"
            }
        
        # Use country hint from browser if provided (more reliable than IP)
        if country_hint and len(country_hint) == 2:
            apps_data = get_apps_for_country(country_hint.upper())
            return {
                "success": True,
                **apps_data,
                "detected_from": "browser_hint"
            }
        
        # Detect country from IP as fallback
        country_code, detection_method = await detect_country_from_ip(request)
        
        # Get apps for that country
        apps_data = get_apps_for_country(country_code)
        
        return {
            "success": True,
            **apps_data,
            "detected_from": detection_method
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


class PriceEstimateRequest(BaseModel):
    ingredients: List[IngredientItem]
    country_code: str


@router.post("/price-estimate")
async def get_price_estimate(
    request: PriceEstimateRequest,
    current_user: User = Depends(get_current_user)
):
    """
    POST /api/shopping/price-estimate
    Get estimated total price range for selected ingredients
    Uses SerpAPI Google Shopping for price data
    """
    try:
        if not request.ingredients:
            raise HTTPException(status_code=400, detail="No ingredients provided")
        
        # Import the batch pricing function
        import sys
        sys.path.insert(0, '/app/backend')
        from services.serpapi_service import batch_ingredient_prices
        
        # Get ingredient names
        ingredient_names = [ing.name for ing in request.ingredients if ing.name][:10]  # Limit to 10
        
        if not ingredient_names:
            return {
                "success": True,
                "estimated_total": {"min": 0, "max": 0, "currency": "$"},
                "ingredients": {},
                "message": "No valid ingredients to price"
            }
        
        # Get country-specific location
        location_mapping = {
            "IN": "India",
            "US": "USA",
            "GB": "United Kingdom",
            "UK": "United Kingdom",
            "AE": "UAE",
            "AU": "Australia",
            "SG": "Singapore",
            "CA": "Canada",
            "DEFAULT": "USA"
        }
        location = location_mapping.get(request.country_code, "USA")
        
        # Fetch prices
        result = await batch_ingredient_prices(ingredient_names, location)
        
        if result.get("success"):
            return {
                "success": True,
                "estimated_total": result.get("estimated_total", {"min": 0, "max": 0}),
                "currency": result.get("currency", "USD"),
                "ingredients": result.get("ingredients", {}),
                "location": location
            }
        else:
            return {
                "success": False,
                "error": result.get("error", "Price fetch failed"),
                "estimated_total": {"min": 0, "max": 0, "currency": "USD"}
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Price estimate error: {e}")
        # Return graceful fallback instead of error
        return {
            "success": False,
            "error": "Could not fetch prices",
            "estimated_total": {"min": 0, "max": 0, "currency": "USD"},
            "ingredients": {}
        }
