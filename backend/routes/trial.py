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

# ALL premium features unlocked during the trial. Shared by auto-start and the
# self-heal path in /activate so both create identical subscription records.
TRIAL_FEATURES = {
    "recipe_search_limit": -1,  # Unlimited
    "premium_recipes_access": True,
    "ad_free": True,
    "ai_photo_recognition_enabled": True,
    "ai_photo_recognition_limit": 100,
    "ai_image_generation_enabled": True,
    "ai_image_generation_limit": 50,
    "meal_planner_weeks": 12,
    "export_to_pdf": True,
    "recipe_import": True,
    "video_import": True,
    "voice_guided_cooking": True,
    "diabetes_module": True,
    "priority_support": True,
    "advanced_filters": True,
    "family_members": 5,
    "fridge_scanner": True,
}


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


class AutoStartTrialResult(BaseModel):
    """Result of auto-starting trial"""
    started: bool
    reason: str
    trial_ends: Optional[str] = None
    days_remaining: int = 0


async def auto_start_trial_if_eligible(user_id: str, platform: str = "web") -> dict:
    """
    Auto-start trial for new users
    Safe to call multiple times - only starts once
    
    Creates both user flags AND subscription record for feature gating
    
    Args:
        user_id: The user's ID
        platform: 'web', 'ios', or 'android'
    
    Returns:
        dict with started, reason, trial_ends, days_remaining
    """
    try:
        # Get user data
        user_data = await db.users.find_one({"id": user_id})
        
        if not user_data:
            return {"started": False, "reason": "User not found", "days_remaining": 0}
        
        # Already has used trial
        if user_data.get("has_used_trial"):
            return {"started": False, "reason": "Already used trial", "days_remaining": 0}
        
        # Paid user - doesn't need trial
        plan = user_data.get("default_plan", "free")
        if plan in ["pro", "team", "chef_pro"]:
            return {"started": False, "reason": "Paid user", "days_remaining": 0}
        
        # Check if trial subscription already exists
        existing_trial_sub = await db.user_subscriptions.find_one({
            "user_id": user_id,
            "status": "trialing"
        })
        if existing_trial_sub:
            trial_end = existing_trial_sub.get("trial_end")
            if trial_end:
                if isinstance(trial_end, str):
                    trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                else:
                    trial_end_dt = trial_end
                if datetime.now(timezone.utc) < trial_end_dt:
                    days = max(1, int((trial_end_dt - datetime.now(timezone.utc)).total_seconds() / 86400) + 1)
                    return {
                        "started": False, 
                        "reason": "Trial already active",
                        "trial_ends": trial_end_dt.isoformat(),
                        "days_remaining": days
                    }
        
        # Trial already active (fallback check on user)
        trial_end = user_data.get("trial_end_date")
        if trial_end:
            if isinstance(trial_end, str):
                trial_end = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
            if datetime.now(timezone.utc) < trial_end:
                days = max(1, int((trial_end - datetime.now(timezone.utc)).total_seconds() / 86400) + 1)
                return {
                    "started": False, 
                    "reason": "Trial already active",
                    "trial_ends": trial_end.isoformat(),
                    "days_remaining": days
                }
        
        # Start the trial
        now = datetime.now(timezone.utc)
        end_date = now + timedelta(days=7)
        
        # Update user document
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "trial_start_date": now.isoformat(),
                    "trial_end_date": end_date.isoformat(),
                    "has_used_trial": True,
                    "last_platform": platform,
                    "trial_active": True,
                    "entitlement_tier": "trial"
                }
            }
        )
        
        # ============ CREATE SUBSCRIPTION RECORD FOR FEATURE GATING ============
        # This is CRITICAL - the FeatureGate system reads from user_subscriptions

        # Remove any existing subscription for this user (to avoid duplicates)
        await db.user_subscriptions.delete_many({"user_id": user_id})

        # Create trial subscription
        subscription_doc = {
            "user_id": user_id,
            "plan_id": "premium_monthly",  # Trial gives premium features
            "status": "trialing",
            "source": "trial",  # Use standard 'trial' source for entitlement validation
            "trial_start": now.isoformat(),
            "trial_end": end_date.isoformat(),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "platform": platform,
            "features": TRIAL_FEATURES,
            "is_trial": True,
            "auto_started": True  # Mark as auto-started for tracking
        }
        
        await db.user_subscriptions.insert_one(subscription_doc)
        
        logger.info(f"✅ Trial auto-started for user {user_id} from platform {platform}")
        logger.info("✅ Created trial subscription with premium features")
        
        return {
            "started": True,
            "reason": "Trial started",
            "trial_ends": end_date.isoformat(),
            "days_remaining": 7
        }
        
    except Exception as e:
        logger.error(f"⚠️ Trial auto-start failed for {user_id}: {e}")
        return {"started": False, "reason": str(e), "days_remaining": 0}


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



class TrialActivateResponse(BaseModel):
    """Response for the one-tap trial activation used by the paywall CTA."""
    success: bool
    premium: bool
    trial_used: bool
    reason: str
    days_remaining: int = 0
    trial_ends: Optional[str] = None


@router.post("/activate", response_model=TrialActivateResponse)
async def activate_trial(
    request: TrialStartRequest,
    current_user: User = Depends(get_current_user),
):
    """
    POST /api/trial/activate

    One-tap trial activation for the paywall "Start 7-day free trial" button.
    Idempotently ensures a premium `trialing` subscription exists (this is what
    /subscription/current reads for premium), reusing auto_start_trial_if_eligible.

    Returns premium=True when the user now has (or already had) an active trial or
    a paid plan. Returns trial_used=True when the free trial was already consumed,
    so the client can route the user to payment instead.
    """
    try:
        now = datetime.now(timezone.utc)

        # 1) If the user already has an active/trialing premium subscription, they
        #    are premium right now — report success without touching anything.
        existing = await db.user_subscriptions.find_one({
            "user_id": current_user.id,
            "status": {"$in": ["active", "trialing"]},
            "plan_id": {"$ne": "free"},
        })
        if existing:
            days_remaining = 0
            trial_ends = existing.get("trial_end") or existing.get("current_period_end")
            end_raw = existing.get("trial_end") or existing.get("current_period_end")
            if end_raw:
                try:
                    end_dt = datetime.fromisoformat(str(end_raw).replace('Z', '+00:00'))
                    if end_dt > now:
                        days_remaining = max(1, int((end_dt - now).total_seconds() / 86400) + 1)
                    else:
                        existing = None  # expired — fall through to (2)
                except Exception:
                    pass
            if existing:
                return TrialActivateResponse(
                    success=True, premium=True, trial_used=False,
                    reason="Trial already active", days_remaining=days_remaining, trial_ends=trial_ends,
                )

        # 2) Self-heal desync: the user may still be INSIDE their original 7-day
        #    trial window (per the user document) while the premium subscription
        #    record is missing/expired (e.g. the auto-start insert failed or was
        #    cleaned up). In that case recreate the trialing subscription so a
        #    genuine trial user is NEVER pushed to a payment screen.
        user_doc = await db.users.find_one({"id": current_user.id})
        end_raw = (user_doc or {}).get("trial_end_date")
        if end_raw:
            try:
                end_dt = datetime.fromisoformat(str(end_raw).replace('Z', '+00:00'))
            except Exception:
                end_dt = None
            if end_dt and end_dt > now:
                days_remaining = max(1, int((end_dt - now).total_seconds() / 86400) + 1)
                try:
                    sub_doc = {
                        "user_id": current_user.id,
                        "plan_id": "premium_monthly",
                        "status": "trialing",
                        "source": "trial",
                        "trial_start": (user_doc or {}).get("trial_start_date") or now.isoformat(),
                        "trial_end": end_dt.isoformat(),
                        "created_at": now.isoformat(),
                        "updated_at": now.isoformat(),
                        "platform": request.platform or "android",
                        "features": TRIAL_FEATURES,
                        "is_trial": True,
                        "auto_started": False,
                    }
                    # Upsert so the user always ends up with exactly one premium
                    # trialing record, even if a prior delete/insert half-failed.
                    await db.user_subscriptions.update_one(
                        {"user_id": current_user.id},
                        {"$set": sub_doc},
                        upsert=True,
                    )
                    await db.user_subscriptions.delete_many({
                        "user_id": current_user.id,
                        "status": {"$ne": "trialing"},
                    })
                except Exception as heal_err:
                    logger.error(f"Trial self-heal failed for {current_user.id}: {heal_err}")
                else:
                    logger.info(f"♻️ Re-activated in-window trial subscription for user {current_user.id}")
                    return TrialActivateResponse(
                        success=True, premium=True, trial_used=False,
                        reason="Trial re-activated", days_remaining=days_remaining, trial_ends=end_dt.isoformat(),
                    )

        # 3) Otherwise try to start a fresh trial (creates the premium `trialing`
        #    subscription record that /subscription/current reads).
        result = await auto_start_trial_if_eligible(current_user.id, request.platform or "android")
        reason = result.get("reason", "")

        premium = bool(result.get("started")) or reason in ("Trial already active", "Paid user")
        trial_used = reason == "Already used trial"

        return TrialActivateResponse(
            success=True,
            premium=premium,
            trial_used=trial_used,
            reason=reason or ("started" if result.get("started") else "unknown"),
            days_remaining=result.get("days_remaining", 7 if premium else 0),
            trial_ends=result.get("trial_ends"),
        )
    except Exception as e:
        logger.error(f"Trial activate error: {e}")
        raise HTTPException(status_code=500, detail="Failed to activate trial")
