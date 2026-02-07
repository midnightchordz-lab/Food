"""
Subscription Routes - Pricing, plans, and subscription management
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import os
import uuid
import logging
import hashlib
import hmac

from .deps import db, User, get_current_user

router = APIRouter(prefix="/subscription", tags=["Subscription"])

# ============== MODELS ==============

class PlanFeatures(BaseModel):
    recipe_search_limit: int = 5  # -1 = unlimited
    premium_recipes_access: bool = False
    ad_free: bool = False
    ai_photo_recognition_enabled: bool = False
    ai_photo_recognition_limit: int = 0  # -1 = unlimited
    ai_image_generation_enabled: bool = False
    ai_image_generation_limit: int = 0
    diabetes_module: bool = False
    video_import: bool = False
    meal_planner_weeks: int = 1
    export_to_pdf: bool = False
    voice_guided_cooking: bool = False
    family_members: int = 1
    priority_support: bool = False
    recipe_import: bool = False
    advanced_filters: bool = False


class SubscriptionPlan(BaseModel):
    plan_id: str
    name: str
    display_name: str
    description: str
    pricing_usd: float
    pricing_inr: float
    billing_cycle: str  # 'free', 'monthly', 'annual'
    features: PlanFeatures
    trial_period_days: int = 0
    is_active: bool = True
    sort_order: int = 0
    badge: Optional[str] = None  # 'popular', 'best_value'
    savings_percent: Optional[int] = None


class CreateSubscriptionRequest(BaseModel):
    plan_id: str
    payment_provider: str = "stripe"  # 'stripe' or 'razorpay'


class CancelSubscriptionRequest(BaseModel):
    cancel_immediately: bool = False


# ============== SUBSCRIPTION PLANS DATA ==============

SUBSCRIPTION_PLANS = [
    {
        "plan_id": "free",
        "name": "Free",
        "display_name": "Free Forever",
        "description": "Get started with basic features",
        "pricing_usd": 0,
        "pricing_inr": 0,
        "billing_cycle": "free",
        "trial_period_days": 0,
        "sort_order": 0,
        "badge": None,
        "features": {
            "recipe_search_limit": 5,
            "premium_recipes_access": False,
            "ad_free": False,
            "ai_photo_recognition_enabled": False,
            "ai_photo_recognition_limit": 0,
            "ai_image_generation_enabled": False,
            "ai_image_generation_limit": 0,
            "diabetes_module": False,
            "video_import": False,
            "meal_planner_weeks": 1,
            "export_to_pdf": False,
            "voice_guided_cooking": False,
            "family_members": 1,
            "priority_support": False,
            "recipe_import": False,
            "advanced_filters": False
        }
    },
    {
        "plan_id": "premium_monthly",
        "name": "Premium Monthly",
        "display_name": "Premium",
        "description": "Unlock all premium features",
        "pricing_usd": 9.99,
        "pricing_inr": 299,
        "billing_cycle": "monthly",
        "trial_period_days": 7,
        "sort_order": 1,
        "badge": None,
        "features": {
            "recipe_search_limit": -1,
            "premium_recipes_access": True,
            "ad_free": True,
            "ai_photo_recognition_enabled": True,
            "ai_photo_recognition_limit": 10,
            "ai_image_generation_enabled": False,
            "ai_image_generation_limit": 0,
            "diabetes_module": False,
            "video_import": False,
            "meal_planner_weeks": 4,
            "export_to_pdf": True,
            "voice_guided_cooking": True,
            "family_members": 1,
            "priority_support": True,
            "recipe_import": True,
            "advanced_filters": True
        }
    },
    {
        "plan_id": "premium_annual",
        "name": "Premium Annual",
        "display_name": "Premium Annual",
        "description": "Best value - 2 months free!",
        "pricing_usd": 79.99,
        "pricing_inr": 2499,
        "billing_cycle": "annual",
        "trial_period_days": 14,
        "sort_order": 2,
        "badge": "popular",
        "savings_percent": 33,
        "features": {
            "recipe_search_limit": -1,
            "premium_recipes_access": True,
            "ad_free": True,
            "ai_photo_recognition_enabled": True,
            "ai_photo_recognition_limit": -1,
            "ai_image_generation_enabled": False,
            "ai_image_generation_limit": 0,
            "diabetes_module": False,
            "video_import": False,
            "meal_planner_weeks": 8,
            "export_to_pdf": True,
            "voice_guided_cooking": True,
            "family_members": 1,
            "priority_support": True,
            "recipe_import": True,
            "advanced_filters": True
        }
    },
    {
        "plan_id": "chef_pro_monthly",
        "name": "Chef Pro Monthly",
        "display_name": "Chef Pro",
        "description": "For serious home chefs",
        "pricing_usd": 19.99,
        "pricing_inr": 599,
        "billing_cycle": "monthly",
        "trial_period_days": 7,
        "sort_order": 3,
        "badge": None,
        "features": {
            "recipe_search_limit": -1,
            "premium_recipes_access": True,
            "ad_free": True,
            "ai_photo_recognition_enabled": True,
            "ai_photo_recognition_limit": -1,
            "ai_image_generation_enabled": True,
            "ai_image_generation_limit": -1,
            "diabetes_module": True,
            "video_import": True,
            "meal_planner_weeks": 12,
            "export_to_pdf": True,
            "voice_guided_cooking": True,
            "family_members": 1,
            "priority_support": True,
            "recipe_import": True,
            "advanced_filters": True
        }
    },
    {
        "plan_id": "chef_pro_annual",
        "name": "Chef Pro Annual",
        "display_name": "Chef Pro Annual",
        "description": "Best for professionals - Save 25%",
        "pricing_usd": 179.99,
        "pricing_inr": 5499,
        "billing_cycle": "annual",
        "trial_period_days": 14,
        "sort_order": 4,
        "badge": "best_value",
        "savings_percent": 25,
        "features": {
            "recipe_search_limit": -1,
            "premium_recipes_access": True,
            "ad_free": True,
            "ai_photo_recognition_enabled": True,
            "ai_photo_recognition_limit": -1,
            "ai_image_generation_enabled": True,
            "ai_image_generation_limit": -1,
            "diabetes_module": True,
            "video_import": True,
            "meal_planner_weeks": 12,
            "export_to_pdf": True,
            "voice_guided_cooking": True,
            "family_members": 1,
            "priority_support": True,
            "recipe_import": True,
            "advanced_filters": True
        }
    },
    {
        "plan_id": "family_annual",
        "name": "Family Plan",
        "display_name": "Family Plan",
        "description": "Perfect for families - Up to 5 members",
        "pricing_usd": 139.99,
        "pricing_inr": 3999,
        "billing_cycle": "annual",
        "trial_period_days": 14,
        "sort_order": 5,
        "badge": None,
        "features": {
            "recipe_search_limit": -1,
            "premium_recipes_access": True,
            "ad_free": True,
            "ai_photo_recognition_enabled": True,
            "ai_photo_recognition_limit": -1,
            "ai_image_generation_enabled": False,
            "ai_image_generation_limit": 0,
            "diabetes_module": False,
            "video_import": False,
            "meal_planner_weeks": 8,
            "export_to_pdf": True,
            "voice_guided_cooking": True,
            "family_members": 5,
            "priority_support": True,
            "recipe_import": True,
            "advanced_filters": True
        }
    }
]


# ============== HELPER FUNCTIONS ==============

def get_plan_by_id(plan_id: str) -> Optional[Dict]:
    """Get plan by ID"""
    for plan in SUBSCRIPTION_PLANS:
        if plan["plan_id"] == plan_id:
            return plan
    return None


async def get_user_subscription(user_id: str) -> Dict:
    """Get user's current subscription"""
    subscription = await db.user_subscriptions.find_one(
        {"user_id": user_id, "status": {"$in": ["active", "trialing"]}},
        {"_id": 0}
    )
    
    if not subscription:
        # Return free plan
        free_plan = get_plan_by_id("free")
        return {
            "plan_id": "free",
            "status": "active",
            "features": free_plan["features"],
            "plan": free_plan
        }
    
    plan = get_plan_by_id(subscription["plan_id"])
    subscription["features"] = plan["features"] if plan else {}
    subscription["plan"] = plan
    
    return subscription


async def check_feature_access(user_id: str, feature_name: str, increment: bool = False) -> Dict:
    """Check if user can access a feature"""
    subscription = await get_user_subscription(user_id)
    features = subscription.get("features", {})
    
    result = {
        "allowed": False,
        "limit": 0,
        "used": 0,
        "remaining": 0,
        "upgrade_required": False
    }
    
    if feature_name == "recipe_search":
        limit = features.get("recipe_search_limit", 5)
        if limit == -1:
            result["allowed"] = True
            result["limit"] = -1
            result["remaining"] = -1
            return result
        
        # Check daily usage
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        usage_key = f"usage:{user_id}:{today}:searches"
        
        usage_doc = await db.usage_tracking.find_one({"key": usage_key})
        used = usage_doc["count"] if usage_doc else 0
        
        if increment and used < limit:
            await db.usage_tracking.update_one(
                {"key": usage_key},
                {"$inc": {"count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
                upsert=True
            )
            used += 1
        
        result["limit"] = limit
        result["used"] = used
        result["remaining"] = max(0, limit - used)
        result["allowed"] = used < limit
        result["upgrade_required"] = used >= limit
        
    elif feature_name == "diabetes_module":
        result["allowed"] = features.get("diabetes_module", False)
        result["upgrade_required"] = not result["allowed"]
        
    elif feature_name == "ai_photo_recognition":
        result["allowed"] = features.get("ai_photo_recognition_enabled", False)
        result["upgrade_required"] = not result["allowed"]
        
    elif feature_name == "ai_image_generation":
        result["allowed"] = features.get("ai_image_generation_enabled", False)
        result["upgrade_required"] = not result["allowed"]
        
    elif feature_name == "premium_recipes":
        result["allowed"] = features.get("premium_recipes_access", False)
        result["upgrade_required"] = not result["allowed"]
        
    elif feature_name == "ad_free":
        result["allowed"] = features.get("ad_free", False)
        
    elif feature_name == "recipe_import":
        result["allowed"] = features.get("recipe_import", False)
        result["upgrade_required"] = not result["allowed"]
    
    return result


# ============== ROUTES ==============

@router.get("/plans")
async def get_subscription_plans():
    """Get all available subscription plans"""
    try:
        plans = [p for p in SUBSCRIPTION_PLANS if p.get("is_active", True)]
        plans.sort(key=lambda x: x.get("sort_order", 0))
        
        return {
            "success": True,
            "plans": plans
        }
    except Exception as e:
        logging.error(f"Error getting plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/current")
async def get_current_subscription(current_user: User = Depends(get_current_user)):
    """Get user's current subscription"""
    try:
        subscription = await get_user_subscription(current_user.id)
        
        # Get usage stats
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        usage_key = f"usage:{current_user.id}:{today}:searches"
        usage_doc = await db.usage_tracking.find_one({"key": usage_key})
        
        subscription["usage"] = {
            "searches_today": usage_doc["count"] if usage_doc else 0,
            "date": today
        }
        
        return {
            "success": True,
            "subscription": subscription
        }
    except Exception as e:
        logging.error(f"Error getting subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check-feature/{feature_name}")
async def check_feature(feature_name: str, current_user: User = Depends(get_current_user)):
    """Check if user can access a specific feature"""
    try:
        result = await check_feature_access(current_user.id, feature_name)
        return {
            "success": True,
            "feature": feature_name,
            **result
        }
    except Exception as e:
        logging.error(f"Error checking feature: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create")
async def create_subscription(
    request: CreateSubscriptionRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new subscription"""
    try:
        plan = get_plan_by_id(request.plan_id)
        if not plan:
            raise HTTPException(status_code=400, detail="Invalid plan")
        
        if plan["plan_id"] == "free":
            raise HTTPException(status_code=400, detail="Cannot subscribe to free plan")
        
        # Check for existing subscription
        existing = await db.user_subscriptions.find_one({
            "user_id": current_user.id,
            "status": {"$in": ["active", "trialing"]}
        })
        
        if existing:
            raise HTTPException(status_code=400, detail="Already have an active subscription")
        
        now = datetime.now(timezone.utc)
        period_end = datetime.now(timezone.utc)
        
        # Calculate period end based on billing cycle
        if plan["billing_cycle"] == "monthly":
            period_end = now + timedelta(days=30)
        elif plan["billing_cycle"] == "annual":
            period_end = now + timedelta(days=365)
        
        # Set trial if applicable
        status = "active"
        trial_end = None
        if plan["trial_period_days"] > 0:
            trial_end = now + timedelta(days=plan["trial_period_days"])
            status = "trialing"
        
        subscription_id = str(uuid.uuid4())
        
        # Create subscription document
        subscription_doc = {
            "id": subscription_id,
            "user_id": current_user.id,
            "plan_id": request.plan_id,
            "status": status,
            "current_period_start": now.isoformat(),
            "current_period_end": period_end.isoformat(),
            "trial_start": now.isoformat() if trial_end else None,
            "trial_end": trial_end.isoformat() if trial_end else None,
            "cancel_at_period_end": False,
            "payment_provider": request.payment_provider,
            "payment_provider_id": f"sub_{uuid.uuid4().hex[:16]}",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.user_subscriptions.insert_one(subscription_doc)
        
        # Record transaction (simulated for demo)
        transaction_doc = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "subscription_id": subscription_id,
            "transaction_id": f"txn_{uuid.uuid4().hex[:16]}",
            "payment_provider": request.payment_provider,
            "amount": plan["pricing_usd"],
            "currency": "USD",
            "status": "completed",
            "transaction_type": "subscription",
            "created_at": now.isoformat(),
            "paid_at": now.isoformat()
        }
        
        await db.payment_transactions.insert_one(transaction_doc)
        
        subscription_doc.pop("_id", None)
        subscription_doc["plan"] = plan
        
        return {
            "success": True,
            "message": f"Successfully subscribed to {plan['display_name']}",
            "subscription": subscription_doc
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel")
async def cancel_subscription(
    request: CancelSubscriptionRequest,
    current_user: User = Depends(get_current_user)
):
    """Cancel subscription"""
    try:
        subscription = await db.user_subscriptions.find_one({
            "user_id": current_user.id,
            "status": {"$in": ["active", "trialing"]}
        })
        
        if not subscription:
            raise HTTPException(status_code=400, detail="No active subscription found")
        
        now = datetime.now(timezone.utc)
        
        if request.cancel_immediately:
            await db.user_subscriptions.update_one(
                {"id": subscription["id"]},
                {
                    "$set": {
                        "status": "canceled",
                        "canceled_at": now.isoformat(),
                        "updated_at": now.isoformat()
                    }
                }
            )
            message = "Subscription canceled immediately"
        else:
            await db.user_subscriptions.update_one(
                {"id": subscription["id"]},
                {
                    "$set": {
                        "cancel_at_period_end": True,
                        "updated_at": now.isoformat()
                    }
                }
            )
            message = "Subscription will cancel at end of billing period"
        
        return {
            "success": True,
            "message": message
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error canceling subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upgrade")
async def upgrade_subscription(
    request: CreateSubscriptionRequest,
    current_user: User = Depends(get_current_user)
):
    """Upgrade or change subscription"""
    try:
        new_plan = get_plan_by_id(request.plan_id)
        if not new_plan:
            raise HTTPException(status_code=400, detail="Invalid plan")
        
        current_sub = await db.user_subscriptions.find_one({
            "user_id": current_user.id,
            "status": {"$in": ["active", "trialing"]}
        })
        
        now = datetime.now(timezone.utc)
        
        if current_sub:
            # Upgrade existing subscription
            period_end = datetime.now(timezone.utc)
            if new_plan["billing_cycle"] == "monthly":
                period_end = now + timedelta(days=30)
            elif new_plan["billing_cycle"] == "annual":
                period_end = now + timedelta(days=365)
            
            await db.user_subscriptions.update_one(
                {"id": current_sub["id"]},
                {
                    "$set": {
                        "plan_id": request.plan_id,
                        "status": "active",
                        "current_period_start": now.isoformat(),
                        "current_period_end": period_end.isoformat(),
                        "cancel_at_period_end": False,
                        "updated_at": now.isoformat()
                    }
                }
            )
            
            message = f"Upgraded to {new_plan['display_name']}"
        else:
            # Create new subscription
            return await create_subscription(request, current_user)
        
        return {
            "success": True,
            "message": message
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error upgrading subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/transactions")
async def get_transactions(current_user: User = Depends(get_current_user)):
    """Get user's payment transaction history"""
    try:
        transactions = await db.payment_transactions.find(
            {"user_id": current_user.id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(length=50)
        
        return {
            "success": True,
            "transactions": transactions
        }
    except Exception as e:
        logging.error(f"Error getting transactions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_subscription_stats():
    """Get subscription statistics (admin)"""
    try:
        total_subscribers = await db.user_subscriptions.count_documents({
            "status": {"$in": ["active", "trialing"]}
        })
        
        # Count by plan
        pipeline = [
            {"$match": {"status": {"$in": ["active", "trialing"]}}},
            {"$group": {"_id": "$plan_id", "count": {"$sum": 1}}}
        ]
        plan_counts = await db.user_subscriptions.aggregate(pipeline).to_list(length=20)
        
        # Calculate MRR
        mrr = 0
        for pc in plan_counts:
            plan = get_plan_by_id(pc["_id"])
            if plan:
                if plan["billing_cycle"] == "monthly":
                    mrr += plan["pricing_usd"] * pc["count"]
                elif plan["billing_cycle"] == "annual":
                    mrr += (plan["pricing_usd"] / 12) * pc["count"]
        
        return {
            "success": True,
            "stats": {
                "total_subscribers": total_subscribers,
                "plans": {pc["_id"]: pc["count"] for pc in plan_counts},
                "mrr": round(mrr, 2),
                "arr": round(mrr * 12, 2)
            }
        }
    except Exception as e:
        logging.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
