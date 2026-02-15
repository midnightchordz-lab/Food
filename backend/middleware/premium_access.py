"""
Premium Access Middleware
Works for ALL platforms (Web, iOS, Android)

Use this middleware to protect premium features.
Returns 403 with action hints for frontend handling.
"""
from fastapi import HTTPException, Depends
from datetime import datetime, timezone
import logging

from routes.deps import db, User, get_current_user

logger = logging.getLogger(__name__)


def get_trial_status(user_data: dict) -> dict:
    """Get current trial status for a user"""
    now = datetime.now(timezone.utc)
    
    plan = user_data.get("default_plan", "free")
    trial_start_date = user_data.get("trial_start_date")
    trial_end_date = user_data.get("trial_end_date")
    has_used_trial = user_data.get("has_used_trial", False)
    
    # Paid users
    if plan in ["pro", "team", "chef_pro"]:
        return {
            "isActive": False,
            "hasAccess": True,
            "isPaid": True,
            "plan": plan
        }
    
    # Can start trial
    if not trial_start_date and not has_used_trial:
        return {
            "isActive": False,
            "hasAccess": False,
            "canStartTrial": True,
            "plan": "free"
        }
    
    # Active trial check
    if trial_start_date and trial_end_date:
        if isinstance(trial_end_date, str):
            trial_end_date = datetime.fromisoformat(trial_end_date.replace('Z', '+00:00'))
        
        if now < trial_end_date:
            days_remaining = max(1, int((trial_end_date - now).total_seconds() / (60 * 60 * 24)) + 1)
            return {
                "isActive": True,
                "hasAccess": True,
                "daysRemaining": days_remaining,
                "plan": "trial"
            }
    
    # Expired
    return {
        "isActive": False,
        "hasAccess": False,
        "trialExpired": True,
        "canStartTrial": False,
        "plan": "free"
    }


async def check_premium_access(current_user: User = Depends(get_current_user)) -> dict:
    """
    Premium Access Dependency
    
    Use in route dependencies to protect premium features:
    
    @router.get("/premium-feature")
    async def premium_feature(
        current_user: User = Depends(get_current_user),
        premium: dict = Depends(check_premium_access)
    ):
        # User has access if we reach here
        return {"message": "Premium content", "access": premium}
    """
    try:
        # Get full user data
        user_data = await db.users.find_one(
            {"id": current_user.id},
            {"_id": 0, "hashed_password": 0}
        )
        
        if not user_data:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        status = get_trial_status(user_data)
        
        # User has access (paid OR active trial)
        if status.get("hasAccess"):
            return {
                "granted": True,
                "plan": status.get("plan"),
                "isPaid": status.get("isPaid", False),
                "isTrial": status.get("isActive", False),
                "daysRemaining": status.get("daysRemaining", 0)
            }
        
        # User doesn't have access - return 403 with action hints
        action = "start_trial" if status.get("canStartTrial") else "upgrade_required"
        
        raise HTTPException(
            status_code=403,
            detail={
                "error": "Premium feature",
                "premium": {
                    "required": True,
                    "currentPlan": "free",
                    "canStartTrial": status.get("canStartTrial", False),
                    "trialExpired": status.get("trialExpired", False)
                },
                "action": action
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Premium access check error: {e}")
        raise HTTPException(status_code=500, detail="Failed to check access")


async def optional_premium_access(current_user: User = Depends(get_current_user)) -> dict:
    """
    Optional Premium Access - doesn't block, just returns status
    
    Use when you want to check access without blocking:
    
    @router.get("/feature")
    async def feature(
        current_user: User = Depends(get_current_user),
        premium: dict = Depends(optional_premium_access)
    ):
        if premium["granted"]:
            return {"content": "full_content"}
        else:
            return {"content": "limited_content", "upgrade_prompt": True}
    """
    try:
        user_data = await db.users.find_one(
            {"id": current_user.id},
            {"_id": 0, "hashed_password": 0}
        )
        
        if not user_data:
            return {"granted": False, "reason": "not_authenticated"}
        
        status = get_trial_status(user_data)
        
        if status.get("hasAccess"):
            return {
                "granted": True,
                "plan": status.get("plan"),
                "isPaid": status.get("isPaid", False),
                "isTrial": status.get("isActive", False),
                "daysRemaining": status.get("daysRemaining", 0)
            }
        
        return {
            "granted": False,
            "canStartTrial": status.get("canStartTrial", False),
            "trialExpired": status.get("trialExpired", False),
            "action": "start_trial" if status.get("canStartTrial") else "upgrade_required"
        }
    
    except Exception as e:
        logger.error(f"Optional premium check error: {e}")
        return {"granted": False, "reason": "error"}
