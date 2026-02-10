"""
Feature Gating Middleware - Controls access to features based on subscription plan
"""
from fastapi import HTTPException, Depends
from functools import wraps
import logging
from datetime import datetime, timezone

from .deps import db, User, get_current_user
from .subscription import get_user_subscription, check_feature_access, get_plan_by_id


class FeatureGate:
    """Feature gating utilities for subscription-based access control"""
    
    # Feature to plan mapping
    FEATURE_REQUIREMENTS = {
        # Feature name: minimum plan required (in order of tier)
        "recipe_search": "free",  # All have it, but limited for free
        "premium_recipes": "premium_monthly",
        "ad_free": "premium_monthly",
        "ai_photo_recognition": "premium_monthly",
        "fridge_scanner": "premium_monthly",  # Fridge Scanner requires Premium
        "ai_image_generation": "chef_pro_monthly",
        "diabetes_module": "chef_pro_monthly",
        "video_import": "chef_pro_monthly",
        "recipe_import": "premium_monthly",
        "export_pdf": "premium_monthly",
        "voice_cooking": "premium_monthly",
        "advanced_filters": "premium_monthly",
        "meal_planner_extended": "premium_monthly",  # More than 1 week
        "family_sharing": "family_annual",
        "priority_support": "premium_monthly",
    }
    
    # Plan hierarchy (lower index = lower tier)
    PLAN_HIERARCHY = [
        "free",
        "premium_monthly",
        "premium_annual", 
        "chef_pro_monthly",
        "chef_pro_annual",
        "family_annual"
    ]
    
    @staticmethod
    def get_plan_tier(plan_id: str) -> int:
        """Get numeric tier for a plan (higher = more features)"""
        try:
            return FeatureGate.PLAN_HIERARCHY.index(plan_id)
        except ValueError:
            return 0  # Default to free tier
    
    @staticmethod
    async def check_access(user_id: str, feature: str) -> dict:
        """
        Check if user has access to a feature based on their subscription.
        
        Returns:
            dict with keys:
            - allowed: bool
            - reason: str (if not allowed)
            - upgrade_to: str (suggested plan to upgrade to)
            - current_plan: str
        """
        subscription = await get_user_subscription(user_id)
        current_plan = subscription.get("plan_id", "free")
        features = subscription.get("features", {})
        
        result = {
            "allowed": False,
            "reason": "",
            "upgrade_to": None,
            "current_plan": current_plan,
            "feature": feature
        }
        
        # Check specific feature access
        if feature == "recipe_search":
            # Check daily limit for free users
            access = await check_feature_access(user_id, "recipe_search", increment=False)
            if access["limit"] == -1:  # Unlimited
                result["allowed"] = True
            elif access["remaining"] > 0:
                result["allowed"] = True
                result["remaining"] = access["remaining"]
                result["limit"] = access["limit"]
            else:
                result["reason"] = f"Daily search limit reached ({access['limit']} searches/day)"
                result["upgrade_to"] = "premium_monthly"
                
        elif feature == "diabetes_module":
            if features.get("diabetes_module", False):
                result["allowed"] = True
            else:
                result["reason"] = "Diabetes Meals module requires Chef Pro subscription"
                result["upgrade_to"] = "chef_pro_monthly"
                
        elif feature == "ai_photo_recognition":
            if features.get("ai_photo_recognition_enabled", False):
                # Check monthly limit
                limit = features.get("ai_photo_recognition_limit", 0)
                if limit == -1:
                    result["allowed"] = True
                else:
                    # Check usage this month
                    usage = await FeatureGate._get_monthly_usage(user_id, "photo_scans")
                    if usage < limit:
                        result["allowed"] = True
                        result["remaining"] = limit - usage
                    else:
                        result["reason"] = f"Monthly photo scan limit reached ({limit}/month)"
                        result["upgrade_to"] = "premium_annual"
            else:
                result["reason"] = "AI Photo Recognition requires Premium subscription"
                result["upgrade_to"] = "premium_monthly"
                
        elif feature == "fridge_scanner":
            if features.get("ai_photo_recognition_enabled", False):
                result["allowed"] = True
            else:
                result["reason"] = "Fridge Scanner requires Premium subscription"
                result["upgrade_to"] = "premium_monthly"
                
        elif feature == "ai_image_generation":
            if features.get("ai_image_generation_enabled", False):
                result["allowed"] = True
            else:
                result["reason"] = "AI Image Generation requires Chef Pro subscription"
                result["upgrade_to"] = "chef_pro_monthly"
                
        elif feature == "recipe_import":
            if features.get("recipe_import", False):
                result["allowed"] = True
            else:
                result["reason"] = "Recipe Import requires Premium subscription"
                result["upgrade_to"] = "premium_monthly"
                
        elif feature == "premium_recipes":
            if features.get("premium_recipes_access", False):
                result["allowed"] = True
            else:
                result["reason"] = "Premium recipes require a paid subscription"
                result["upgrade_to"] = "premium_monthly"
                
        elif feature == "export_pdf":
            if features.get("export_to_pdf", False):
                result["allowed"] = True
            else:
                result["reason"] = "PDF Export requires Premium subscription"
                result["upgrade_to"] = "premium_monthly"
                
        elif feature == "voice_cooking":
            if features.get("voice_guided_cooking", False):
                result["allowed"] = True
            else:
                result["reason"] = "Voice-Guided Cooking requires Premium subscription"
                result["upgrade_to"] = "premium_monthly"
                
        elif feature == "video_import":
            if features.get("video_import", False):
                result["allowed"] = True
            else:
                result["reason"] = "Video Import requires Chef Pro subscription"
                result["upgrade_to"] = "chef_pro_monthly"
                
        elif feature == "advanced_filters":
            if features.get("advanced_filters", False):
                result["allowed"] = True
            else:
                result["reason"] = "Advanced Filters require Premium subscription"
                result["upgrade_to"] = "premium_monthly"
                
        elif feature == "meal_planner_extended":
            weeks = features.get("meal_planner_weeks", 1)
            if weeks > 1:
                result["allowed"] = True
                result["weeks_allowed"] = weeks
            else:
                result["reason"] = "Extended Meal Planning requires Premium subscription"
                result["upgrade_to"] = "premium_monthly"
        
        else:
            # Unknown feature - deny by default
            result["reason"] = f"Unknown feature: {feature}"
            
        return result
    
    @staticmethod
    async def _get_monthly_usage(user_id: str, usage_type: str) -> int:
        """Get usage count for current month"""
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        usage_doc = await db.feature_usage.find_one({
            "user_id": user_id,
            "type": usage_type,
            "month": month_start.strftime("%Y-%m")
        })
        
        return usage_doc.get("count", 0) if usage_doc else 0
    
    @staticmethod
    async def increment_usage(user_id: str, usage_type: str) -> int:
        """Increment usage counter and return new count"""
        now = datetime.now(timezone.utc)
        month_key = now.strftime("%Y-%m")
        
        result = await db.feature_usage.find_one_and_update(
            {"user_id": user_id, "type": usage_type, "month": month_key},
            {
                "$inc": {"count": 1},
                "$set": {"updated_at": now}
            },
            upsert=True,
            return_document=True
        )
        
        return result.get("count", 1) if result else 1


def require_feature(feature: str):
    """
    Decorator to require a specific feature for an endpoint.
    
    Usage:
        @router.get("/premium-recipes")
        @require_feature("premium_recipes")
        async def get_premium_recipes(current_user: User = Depends(get_current_user)):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from kwargs
            current_user = kwargs.get('current_user')
            if not current_user:
                raise HTTPException(status_code=401, detail="Authentication required")
            
            # Check feature access
            access = await FeatureGate.check_access(current_user.id, feature)
            
            if not access["allowed"]:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "feature_locked",
                        "message": access["reason"],
                        "feature": feature,
                        "upgrade_to": access["upgrade_to"],
                        "current_plan": access["current_plan"]
                    }
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


async def check_and_increment_search(user_id: str) -> dict:
    """Check search limit and increment if allowed"""
    access = await check_feature_access(user_id, "recipe_search", increment=True)
    
    if not access["allowed"]:
        return {
            "allowed": False,
            "reason": f"Daily search limit reached ({access['limit']} searches/day)",
            "upgrade_to": "premium_monthly",
            "used": access["used"],
            "limit": access["limit"]
        }
    
    return {
        "allowed": True,
        "used": access["used"],
        "limit": access["limit"],
        "remaining": access["remaining"]
    }
