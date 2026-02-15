"""
Trial Routes - 7-Day Trial System
Cross-platform compatible (Web, iOS, Android)

API Endpoints:
- GET /api/trial/status - Get trial status for current user
- POST /api/trial/start - Start 7-day trial
- GET /api/trial/check-access - Check if user has premium access
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional
import logging

from .deps import db, User, get_current_user

router = APIRouter(prefix="/trial", tags=["Trial"])

logger = logging.getLogger(__name__)


class TrialStatusResponse(BaseModel):
    """Trial status response model"""
    success: bool
    user: dict
    trial: dict


class TrialStartRequest(BaseModel):
    """Trial start request model"""
    platform: Optional[str] = "web"  # 'web', 'ios', or 'android'


class TrialStartResponse(BaseModel):
    """Trial start response model"""
    success: bool
    message: str
    trial: dict


class AccessCheckResponse(BaseModel):
    """Access check response model"""
    success: bool
    hasAccess: bool
    status: dict


def get_trial_status(user_data: dict) -> dict:
    """
    Get current trial status for a user
    Works for all platforms (Web, iOS, Android)
    """
    now = datetime.now(timezone.utc)
    
    # Get user's plan and trial fields
    plan = user_data.get("default_plan", "free")
    trial_start_date = user_data.get("trial_start_date")
    trial_end_date = user_data.get("trial_end_date")
    has_used_trial = user_data.get("has_used_trial", False)
    
    # Paid users don't need trial
    if plan in ["pro", "team", "chef_pro"]:
        return {
            "isActive": False,
            "hasAccess": True,
            "isPaid": True,
            "plan": plan,
            "daysRemaining": 0
        }
    
    # New user - can start trial
    if not trial_start_date and not has_used_trial:
        return {
            "isActive": False,
            "hasAccess": False,
            "canStartTrial": True,
            "daysRemaining": 7,
            "plan": "free"
        }
    
    # Trial is active - check if still valid
    if trial_start_date and trial_end_date:
        # Parse dates if they're strings
        if isinstance(trial_end_date, str):
            trial_end_date = datetime.fromisoformat(trial_end_date.replace('Z', '+00:00'))
        
        if now < trial_end_date:
            ms_remaining = (trial_end_date - now).total_seconds()
            days_remaining = max(1, int(ms_remaining / (60 * 60 * 24)) + 1)
            
            return {
                "isActive": True,
                "hasAccess": True,
                "daysRemaining": days_remaining,
                "trialEndsAt": trial_end_date.isoformat(),
                "plan": "trial"
            }
    
    # Trial expired or used
    return {
        "isActive": False,
        "hasAccess": False,
        "trialExpired": True,
        "canStartTrial": False,
        "plan": "free",
        "daysRemaining": 0
    }


def has_premium_access(user_data: dict) -> bool:
    """
    Check if user has premium access (paid OR active trial)
    Works for all platforms
    """
    status = get_trial_status(user_data)
    return status.get("hasAccess", False)


@router.get("/status", response_model=TrialStatusResponse)
async def get_trial_status_endpoint(current_user: User = Depends(get_current_user)):
    """
    GET /api/trial/status
    Get trial status for current user
    Platform: ALL (Web, iOS, Android)
    """
    try:
        # Get full user data from DB (includes trial fields)
        user_data = await db.users.find_one(
            {"id": current_user.id}, 
            {"_id": 0, "hashed_password": 0}
        )
        
        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")
        
        status = get_trial_status(user_data)
        
        return TrialStatusResponse(
            success=True,
            user={
                "id": user_data.get("id"),
                "email": user_data.get("email"),
                "plan": user_data.get("default_plan", "free")
            },
            trial=status
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Trial status error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get trial status")


@router.post("/start", response_model=TrialStartResponse)
async def start_trial(
    request: TrialStartRequest,
    current_user: User = Depends(get_current_user)
):
    """
    POST /api/trial/start
    Start 7-day trial
    Platform: ALL (Web, iOS, Android)
    """
    try:
        # Get full user data
        user_data = await db.users.find_one(
            {"id": current_user.id},
            {"_id": 0, "hashed_password": 0}
        )
        
        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check eligibility
        status = get_trial_status(user_data)
        
        if not status.get("canStartTrial", False):
            reason = "already_used" if status.get("trialExpired") else "already_active"
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Not eligible for trial",
                    "reason": reason
                }
            )
        
        # Start trial - 7 days from now
        now = datetime.now(timezone.utc)
        end_date = now + timedelta(days=7)
        
        # Update user with trial info
        await db.users.update_one(
            {"id": current_user.id},
            {
                "$set": {
                    "trial_start_date": now.isoformat(),
                    "trial_end_date": end_date.isoformat(),
                    "has_used_trial": True,
                    "last_platform": request.platform or "web",
                    "trial_active": True,
                    "entitlement_tier": "trial"
                }
            }
        )
        
        logger.info(f"Trial started for user {current_user.id} from platform {request.platform}")
        
        return TrialStartResponse(
            success=True,
            message="7-day trial started successfully",
            trial={
                "startDate": now.isoformat(),
                "endDate": end_date.isoformat(),
                "daysRemaining": 7
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Trial start error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check-access", response_model=AccessCheckResponse)
async def check_premium_access(current_user: User = Depends(get_current_user)):
    """
    GET /api/trial/check-access
    Check if user has premium access
    Platform: ALL (Web, iOS, Android)
    """
    try:
        # Get full user data
        user_data = await db.users.find_one(
            {"id": current_user.id},
            {"_id": 0, "hashed_password": 0}
        )
        
        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")
        
        has_access = has_premium_access(user_data)
        status = get_trial_status(user_data)
        
        return AccessCheckResponse(
            success=True,
            hasAccess=has_access,
            status=status
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Access check error: {e}")
        raise HTTPException(status_code=500, detail="Failed to check access")
