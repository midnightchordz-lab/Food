"""
Mobile Recipe Import — unguarded URL/text conversion endpoints.
Premium gating for the mobile app is handled client-side via RevenueCat
(subscription state lives on-device), so these endpoints do not enforce the
legacy server-side FeatureGate. Saving reuses /api/import/save.
"""
from fastapi import APIRouter, HTTPException, Depends

from .deps import User, get_current_user
from .import_recipe import (
    ImportURLRequest,
    ImportTextRequest,
    extract_recipe_from_url,
    convert_to_standard_recipe,
)

router = APIRouter(prefix="/mobile-import", tags=["Mobile Import"])


@router.post("/url")
async def mobile_import_from_url(request: ImportURLRequest, current_user: User = Depends(get_current_user)):
    if not request.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Please enter a valid link starting with http")
    content = await extract_recipe_from_url(request.url)
    if not content or len(content) < 100:
        raise HTTPException(status_code=400, detail="Couldn't find a recipe on that page")
    recipe = await convert_to_standard_recipe(content, "url", request.url)
    return {"recipe": recipe, "source": request.url}


@router.post("/text")
async def mobile_import_from_text(request: ImportTextRequest, current_user: User = Depends(get_current_user)):
    if len(request.recipe_text) < 20:
        raise HTTPException(status_code=400, detail="Please paste a bit more recipe text")
    recipe = await convert_to_standard_recipe(request.recipe_text, "text", "User submitted")
    return {"recipe": recipe, "source": "User submitted text"}
