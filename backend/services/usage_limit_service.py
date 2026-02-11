"""
Usage Limit Service - Handles freemium usage tracking and limits
This is the single source of truth for all usage limit logic.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
import logging

# Import db from deps
import sys
sys.path.insert(0, '/app/backend')
from routes.deps import db

# Default limits for free tier
FREE_TIER_LIMITS = {
    "recipes_per_day": 5,
    "meal_plans_per_week": 3
}

# Paid users get unlimited (-1)
PAID_TIER_LIMITS = {
    "recipes_per_day": -1,  # Unlimited
    "meal_plans_per_week": -1  # Unlimited
}


async def get_user_subscription_tier(user_id: str) -> str:
    """
    Get user's subscription tier from database.
    Returns 'free', 'premium', or 'chef_pro'
    """
    try:
        subscription = await db.user_subscriptions.find_one(
            {"user_id": user_id, "status": {"$in": ["active", "trialing"]}},
            {"_id": 0, "plan_id": 1}
        )
        
        if not subscription:
            return "free"
        
        plan_id = subscription.get("plan_id", "free")
        
        # Map plan_id to tier
        if plan_id in ["premium_monthly", "premium_annual"]:
            return "premium"
        elif plan_id in ["chef_pro_monthly", "chef_pro_annual", "family_annual"]:
            return "chef_pro"
        else:
            return "free"
    except Exception as e:
        logging.error(f"Error getting user subscription tier: {e}")
        return "free"


async def get_usage_limits(user_id: str) -> Dict[str, Any]:
    """
    Get the usage limits for a user based on their tier.
    """
    tier = await get_user_subscription_tier(user_id)
    
    if tier == "free":
        return {
            "tier": tier,
            "recipes_per_day": FREE_TIER_LIMITS["recipes_per_day"],
            "meal_plans_per_week": FREE_TIER_LIMITS["meal_plans_per_week"]
        }
    else:
        return {
            "tier": tier,
            "recipes_per_day": PAID_TIER_LIMITS["recipes_per_day"],
            "meal_plans_per_week": PAID_TIER_LIMITS["meal_plans_per_week"]
        }


async def get_user_usage_status(user_id: str) -> Dict[str, Any]:
    """
    Get current usage status for a user.
    This is the main function called by the frontend to check limits.
    
    Returns:
        {
            "tier": "free" | "premium" | "chef_pro",
            "recipes": {
                "used_today": int,
                "limit": int,  # -1 = unlimited
                "remaining": int,  # -1 = unlimited
                "reset_at": ISO timestamp
            },
            "meal_plans": {
                "used_this_week": int,
                "limit": int,
                "remaining": int,
                "reset_at": ISO timestamp
            }
        }
    """
    try:
        tier = await get_user_subscription_tier(user_id)
        limits = await get_usage_limits(user_id)
        
        # Get today's date (UTC) for recipe tracking
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Get this week's start (Monday) for meal plan tracking
        now = datetime.now(timezone.utc)
        days_since_monday = now.weekday()
        week_start = (now - timedelta(days=days_since_monday)).strftime("%Y-%m-%d")
        
        # Get usage document for this user
        usage_doc = await db.user_usage.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        
        # Initialize default usage values
        recipes_used_today = 0
        meal_plans_used_this_week = 0
        
        if usage_doc:
            # Check if recipe count needs reset (new day)
            recipe_last_reset = usage_doc.get("recipes_last_reset_date", "")
            if recipe_last_reset == today:
                recipes_used_today = usage_doc.get("recipes_viewed_today", 0)
            # If different day, count is effectively 0 (will be reset on next increment)
            
            # Check if meal plan count needs reset (new week)
            meal_plan_last_reset = usage_doc.get("meal_plans_last_reset_date", "")
            if meal_plan_last_reset == week_start:
                meal_plans_used_this_week = usage_doc.get("meal_plans_created_this_week", 0)
        
        # Calculate remaining
        recipes_limit = limits["recipes_per_day"]
        meal_plans_limit = limits["meal_plans_per_week"]
        
        recipes_remaining = -1 if recipes_limit == -1 else max(0, recipes_limit - recipes_used_today)
        meal_plans_remaining = -1 if meal_plans_limit == -1 else max(0, meal_plans_limit - meal_plans_used_this_week)
        
        # Calculate reset times
        # Recipes reset at midnight UTC
        tomorrow = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        
        # Meal plans reset next Monday
        days_until_monday = (7 - now.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7
        next_monday = (now + timedelta(days=days_until_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
        
        return {
            "tier": tier,
            "recipes": {
                "used_today": recipes_used_today,
                "limit": recipes_limit,
                "remaining": recipes_remaining,
                "reset_at": tomorrow.isoformat()
            },
            "meal_plans": {
                "used_this_week": meal_plans_used_this_week,
                "limit": meal_plans_limit,
                "remaining": meal_plans_remaining,
                "reset_at": next_monday.isoformat()
            }
        }
    except Exception as e:
        logging.error(f"Error getting user usage status: {e}")
        # Return safe defaults on error
        return {
            "tier": "free",
            "recipes": {
                "used_today": 0,
                "limit": 5,
                "remaining": 5,
                "reset_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
            },
            "meal_plans": {
                "used_this_week": 0,
                "limit": 3,
                "remaining": 3,
                "reset_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
            }
        }


async def check_recipe_limit(user_id: str) -> Dict[str, Any]:
    """
    Check if user can view more recipes today.
    Does NOT increment the counter.
    
    Returns:
        {
            "allowed": bool,
            "used": int,
            "limit": int,
            "remaining": int
        }
    """
    status = await get_user_usage_status(user_id)
    recipes = status["recipes"]
    
    # Unlimited for paid users
    if recipes["limit"] == -1:
        return {
            "allowed": True,
            "used": recipes["used_today"],
            "limit": -1,
            "remaining": -1
        }
    
    allowed = recipes["remaining"] > 0
    
    return {
        "allowed": allowed,
        "used": recipes["used_today"],
        "limit": recipes["limit"],
        "remaining": recipes["remaining"]
    }


async def increment_recipe_count(user_id: str, count: int = 1) -> Dict[str, Any]:
    """
    Increment the recipe view counter for a user.
    Should be called AFTER successfully generating/viewing recipes.
    
    Args:
        user_id: User ID
        count: Number of recipes to add (default 1)
    
    Returns:
        {
            "success": bool,
            "used": int,
            "limit": int,
            "remaining": int
        }
    """
    try:
        # Check if user is unlimited
        tier = await get_user_subscription_tier(user_id)
        if tier != "free":
            return {
                "success": True,
                "used": 0,
                "limit": -1,
                "remaining": -1
            }
        
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Atomically update the usage counter
        result = await db.user_usage.find_one_and_update(
            {"user_id": user_id},
            [
                {
                    "$set": {
                        # Reset counter if day changed, otherwise increment
                        "recipes_viewed_today": {
                            "$cond": {
                                "if": {"$eq": ["$recipes_last_reset_date", today]},
                                "then": {"$add": [{"$ifNull": ["$recipes_viewed_today", 0]}, count]},
                                "else": count  # New day, start fresh
                            }
                        },
                        "recipes_last_reset_date": today,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            ],
            upsert=True,
            return_document=True
        )
        
        new_count = result.get("recipes_viewed_today", count) if result else count
        limit = FREE_TIER_LIMITS["recipes_per_day"]
        
        logging.info(f"Recipe count incremented for user {user_id}: {new_count}/{limit}")
        
        return {
            "success": True,
            "used": new_count,
            "limit": limit,
            "remaining": max(0, limit - new_count)
        }
    except Exception as e:
        logging.error(f"Error incrementing recipe count: {e}")
        return {
            "success": False,
            "used": 0,
            "limit": FREE_TIER_LIMITS["recipes_per_day"],
            "remaining": FREE_TIER_LIMITS["recipes_per_day"]
        }


async def check_meal_plan_limit(user_id: str) -> Dict[str, Any]:
    """
    Check if user can create more meal plans this week.
    Does NOT increment the counter.
    """
    status = await get_user_usage_status(user_id)
    meal_plans = status["meal_plans"]
    
    if meal_plans["limit"] == -1:
        return {
            "allowed": True,
            "used": meal_plans["used_this_week"],
            "limit": -1,
            "remaining": -1
        }
    
    allowed = meal_plans["remaining"] > 0
    
    return {
        "allowed": allowed,
        "used": meal_plans["used_this_week"],
        "limit": meal_plans["limit"],
        "remaining": meal_plans["remaining"]
    }


async def increment_meal_plan_count(user_id: str) -> Dict[str, Any]:
    """
    Increment the meal plan counter for a user.
    Should be called AFTER successfully creating a meal plan.
    """
    try:
        tier = await get_user_subscription_tier(user_id)
        if tier != "free":
            return {
                "success": True,
                "used": 0,
                "limit": -1,
                "remaining": -1
            }
        
        now = datetime.now(timezone.utc)
        days_since_monday = now.weekday()
        week_start = (now - timedelta(days=days_since_monday)).strftime("%Y-%m-%d")
        
        result = await db.user_usage.find_one_and_update(
            {"user_id": user_id},
            [
                {
                    "$set": {
                        "meal_plans_created_this_week": {
                            "$cond": {
                                "if": {"$eq": ["$meal_plans_last_reset_date", week_start]},
                                "then": {"$add": [{"$ifNull": ["$meal_plans_created_this_week", 0]}, 1]},
                                "else": 1
                            }
                        },
                        "meal_plans_last_reset_date": week_start,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            ],
            upsert=True,
            return_document=True
        )
        
        new_count = result.get("meal_plans_created_this_week", 1) if result else 1
        limit = FREE_TIER_LIMITS["meal_plans_per_week"]
        
        logging.info(f"Meal plan count incremented for user {user_id}: {new_count}/{limit}")
        
        return {
            "success": True,
            "used": new_count,
            "limit": limit,
            "remaining": max(0, limit - new_count)
        }
    except Exception as e:
        logging.error(f"Error incrementing meal plan count: {e}")
        return {
            "success": False,
            "used": 0,
            "limit": FREE_TIER_LIMITS["meal_plans_per_week"],
            "remaining": FREE_TIER_LIMITS["meal_plans_per_week"]
        }


async def reset_daily_usage(user_id: str) -> bool:
    """
    Manually reset daily usage for a user.
    Used by scheduled tasks or admin actions.
    """
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        await db.user_usage.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "recipes_viewed_today": 0,
                    "recipes_last_reset_date": today,
                    "updated_at": datetime.now(timezone.utc)
                }
            },
            upsert=True
        )
        return True
    except Exception as e:
        logging.error(f"Error resetting daily usage: {e}")
        return False


async def reset_weekly_usage(user_id: str) -> bool:
    """
    Manually reset weekly usage for a user.
    """
    try:
        now = datetime.now(timezone.utc)
        days_since_monday = now.weekday()
        week_start = (now - timedelta(days=days_since_monday)).strftime("%Y-%m-%d")
        
        await db.user_usage.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "meal_plans_created_this_week": 0,
                    "meal_plans_last_reset_date": week_start,
                    "updated_at": datetime.now(timezone.utc)
                }
            },
            upsert=True
        )
        return True
    except Exception as e:
        logging.error(f"Error resetting weekly usage: {e}")
        return False
