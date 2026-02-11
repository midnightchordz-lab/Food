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


class SetCountryRequest(BaseModel):
    country_code: str


@router.post("/set-country")
async def set_preferred_country(
    request: SetCountryRequest,
    current_user: User = Depends(get_current_user)
):
    """
    POST /api/shopping/set-country
    Save user's preferred country for delivery apps
    """
    try:
        country_code = request.country_code
        
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


class CreateListRequest(BaseModel):
    name: str
    ingredients: Optional[List[IngredientItem]] = []


class RenameListRequest(BaseModel):
    name: str


@router.get("/lists")
async def get_all_shopping_lists(current_user: User = Depends(get_current_user)):
    """
    GET /api/shopping/lists
    Get all shopping lists for the user
    """
    try:
        cursor = db.shopping_lists.find(
            {"user_id": current_user.id},
            {"_id": 0}
        ).sort("updated_at", -1)
        
        lists = await cursor.to_list(length=50)
        
        return {
            "success": True,
            "lists": lists,
            "total": len(lists)
        }
    except Exception as e:
        logging.error(f"Get all lists error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get shopping lists")


@router.post("/lists")
async def create_shopping_list(
    request: CreateListRequest,
    current_user: User = Depends(get_current_user)
):
    """
    POST /api/shopping/lists
    Create a new shopping list
    """
    try:
        from datetime import datetime, timezone
        import uuid
        
        list_id = str(uuid.uuid4())[:8]
        
        items = []
        for ing in request.ingredients:
            items.append({
                "name": ing.name,
                "amount": ing.amount,
                "unit": ing.unit,
                "checked": False,
                "added_at": datetime.now(timezone.utc).isoformat()
            })
        
        new_list = {
            "list_id": list_id,
            "user_id": current_user.id,
            "name": request.name,
            "items": items,
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.shopping_lists.insert_one(new_list)
        
        # Return without _id
        new_list.pop("_id", None)
        
        return {
            "success": True,
            "list": new_list,
            "message": f"Created list '{request.name}'"
        }
    except Exception as e:
        logging.error(f"Create list error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create shopping list")


@router.get("/lists/{list_id}")
async def get_shopping_list_by_id(
    list_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    GET /api/shopping/lists/{list_id}
    Get a specific shopping list
    """
    try:
        shopping_list = await db.shopping_lists.find_one(
            {"list_id": list_id, "user_id": current_user.id},
            {"_id": 0}
        )
        
        if not shopping_list:
            raise HTTPException(status_code=404, detail="List not found")
        
        return {
            "success": True,
            "list": shopping_list
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Get list error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get shopping list")


@router.put("/lists/{list_id}")
async def update_shopping_list(
    list_id: str,
    request: RenameListRequest,
    current_user: User = Depends(get_current_user)
):
    """
    PUT /api/shopping/lists/{list_id}
    Rename a shopping list
    """
    try:
        from datetime import datetime, timezone
        
        result = await db.shopping_lists.update_one(
            {"list_id": list_id, "user_id": current_user.id},
            {"$set": {
                "name": request.name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="List not found")
        
        return {
            "success": True,
            "message": f"List renamed to '{request.name}'"
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Update list error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update shopping list")


@router.delete("/lists/{list_id}")
async def delete_shopping_list(
    list_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    DELETE /api/shopping/lists/{list_id}
    Delete a shopping list
    """
    try:
        result = await db.shopping_lists.delete_one(
            {"list_id": list_id, "user_id": current_user.id}
        )
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="List not found")
        
        return {
            "success": True,
            "message": "List deleted"
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Delete list error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete shopping list")


@router.post("/lists/{list_id}/clear")
async def clear_shopping_list(
    list_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    POST /api/shopping/lists/{list_id}/clear
    Clear all items from a shopping list
    """
    try:
        from datetime import datetime, timezone
        
        result = await db.shopping_lists.update_one(
            {"list_id": list_id, "user_id": current_user.id},
            {"$set": {
                "items": [],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="List not found")
        
        return {
            "success": True,
            "message": "List cleared"
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Clear list error: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear shopping list")


@router.post("/lists/{list_id}/items")
async def add_items_to_list(
    list_id: str,
    request: AddToListRequest,
    current_user: User = Depends(get_current_user)
):
    """
    POST /api/shopping/lists/{list_id}/items
    Add items to a specific shopping list
    """
    try:
        from datetime import datetime, timezone
        
        if not request.ingredients:
            raise HTTPException(status_code=400, detail="No ingredients provided")
        
        # Get current list
        shopping_list = await db.shopping_lists.find_one(
            {"list_id": list_id, "user_id": current_user.id}
        )
        
        if not shopping_list:
            raise HTTPException(status_code=404, detail="List not found")
        
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
        
        # Update list
        await db.shopping_lists.update_one(
            {"list_id": list_id, "user_id": current_user.id},
            {
                "$push": {"items": {"$each": new_items}},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        return {
            "success": True,
            "message": f"Added {len(new_items)} ingredients",
            "added_count": len(new_items)
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Add items to list error: {e}")
        raise HTTPException(status_code=500, detail="Failed to add items")


@router.delete("/lists/{list_id}/items/{item_name}")
async def remove_item_from_list(
    list_id: str,
    item_name: str,
    current_user: User = Depends(get_current_user)
):
    """
    DELETE /api/shopping/lists/{list_id}/items/{item_name}
    Remove an item from a shopping list
    """
    try:
        from datetime import datetime, timezone
        from urllib.parse import unquote
        
        decoded_name = unquote(item_name)
        
        result = await db.shopping_lists.update_one(
            {"list_id": list_id, "user_id": current_user.id},
            {
                "$pull": {"items": {"name": {"$regex": f"^{decoded_name}$", "$options": "i"}}},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="List not found")
        
        return {
            "success": True,
            "message": f"Removed '{decoded_name}'"
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Remove item error: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove item")


class ToggleItemRequest(BaseModel):
    item_name: str
    checked: bool


@router.patch("/lists/{list_id}/items/toggle")
async def toggle_item_checked(
    list_id: str,
    request: ToggleItemRequest,
    current_user: User = Depends(get_current_user)
):
    """
    PATCH /api/shopping/lists/{list_id}/items/toggle
    Toggle checked state of an item
    """
    try:
        from datetime import datetime, timezone
        
        result = await db.shopping_lists.update_one(
            {
                "list_id": list_id,
                "user_id": current_user.id,
                "items.name": {"$regex": f"^{request.item_name}$", "$options": "i"}
            },
            {
                "$set": {
                    "items.$.checked": request.checked,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="List or item not found")
        
        return {
            "success": True,
            "checked": request.checked
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Toggle item error: {e}")
        raise HTTPException(status_code=500, detail="Failed to toggle item")


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
