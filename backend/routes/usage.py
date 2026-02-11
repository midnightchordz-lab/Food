"""
Usage Routes - API endpoints for usage tracking and limits
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any
import logging

from .deps import db, User, get_current_user

# Import usage limit service
import sys
sys.path.insert(0, '/app/backend')
from services.usage_limit_service import (
    get_user_usage_status,
    check_recipe_limit,
    check_meal_plan_limit
)

router = APIRouter(prefix="/usage", tags=["Usage"])


@router.get("/status")
async def get_usage_status(current_user: User = Depends(get_current_user)):
    """
    Get current usage status for the authenticated user.
    This should be called on app load and after any limit-consuming action.
    
    Returns:
        {
            "success": true,
            "usage": {
                "tier": "free" | "premium" | "chef_pro",
                "recipes": {
                    "used_today": int,
                    "limit": int,
                    "remaining": int,
                    "reset_at": ISO timestamp
                },
                "meal_plans": {
                    "used_this_week": int,
                    "limit": int,
                    "remaining": int,
                    "reset_at": ISO timestamp
                }
            }
        }
    """
    try:
        usage = await get_user_usage_status(current_user.id)
        return {
            "success": True,
            "usage": usage
        }
    except Exception as e:
        logging.error(f"Error getting usage status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check/recipes")
async def check_recipes_limit(current_user: User = Depends(get_current_user)):
    """
    Check if user can view more recipes today.
    This is a quick check endpoint that doesn't modify anything.
    
    Returns:
        {
            "success": true,
            "allowed": bool,
            "used": int,
            "limit": int,
            "remaining": int
        }
    """
    try:
        result = await check_recipe_limit(current_user.id)
        return {
            "success": True,
            **result
        }
    except Exception as e:
        logging.error(f"Error checking recipe limit: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check/meal-plans")
async def check_meal_plans_limit(current_user: User = Depends(get_current_user)):
    """
    Check if user can create more meal plans this week.
    
    Returns:
        {
            "success": true,
            "allowed": bool,
            "used": int,
            "limit": int,
            "remaining": int
        }
    """
    try:
        result = await check_meal_plan_limit(current_user.id)
        return {
            "success": True,
            **result
        }
    except Exception as e:
        logging.error(f"Error checking meal plan limit: {e}")
        raise HTTPException(status_code=500, detail=str(e))
