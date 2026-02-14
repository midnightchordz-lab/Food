"""
Subscription Routes - Pricing, plans, and subscription management
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import os
import sys
import uuid
import logging
import hashlib
import hmac

import razorpay

from .deps import db, User, get_current_user

# Add backend to path for services import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.entitlement_guard import (
    validate_subscription_entitlement,
    validate_webhook_event,
    check_signup_protection,
    log_subscription_creation,
    log_security_event,
    run_bulk_premium_correction,
    get_user_subscription_safe,
    verify_payment_from_source_of_truth,
    enforce_free_default,
    safety_check_before_premium,
    log_plan_change,
    get_plan_change_history,
    SecurityEvent,
    EntitlementSource,
    VALID_PREMIUM_SOURCES,
    INVALID_UPGRADE_SOURCES
)

router = APIRouter(prefix="/subscription", tags=["Subscription"])

# Initialize Razorpay client
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')

razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    logging.info("Razorpay client initialized successfully")

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
    """
    Get user's current subscription with SAFE ENTITLEMENT RESOLUTION.
    
    PERMANENT SAFE FIX - Priority-Based Entitlement Resolution:
    
    Priority 1 → Valid successful payment record (payment markers)
    Priority 2 → Active trial not expired
    Priority 3 → Existing active subscription with valid source
    Priority 4 → Grace period protection (10 min for new/renewed subs)
    Else → Free plan
    
    NEVER downgrades if ANY priority is met.
    NEVER incorrectly downgrades paid users.
    
    Uses source-of-truth validation before any downgrade:
    - Checks local payments table
    - Checks Razorpay orders table
    - Checks recent webhook events
    """
    return await get_user_subscription_safe(db, user_id, get_plan_by_id)


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
        limit = features.get("recipe_search_limit", 5)  # 5 RECIPES per day for free
        if limit == -1:
            result["allowed"] = True
            result["limit"] = -1
            result["remaining"] = -1
            return result
        
        # Check daily usage - now tracking RECIPES not searches
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        usage_key = f"usage:{user_id}:{today}:recipes"  # Changed from :searches to :recipes
        
        usage_doc = await db.usage_tracking.find_one({"key": usage_key})
        used = usage_doc["count"] if usage_doc else 0
        
        # Check how many recipes remaining
        remaining = max(0, limit - used)
        allowed = remaining > 0
        
        # If incrementing, add the specified count (default 4 recipes per request)
        increment_count = increment if isinstance(increment, int) else (4 if increment else 0)
        
        if increment_count > 0 and allowed:
            # Only increment by what's actually allowed
            actual_increment = min(increment_count, remaining)
            await db.usage_tracking.update_one(
                {"key": usage_key},
                {"$inc": {"count": actual_increment}, "$set": {"updated_at": datetime.now(timezone.utc)}},
                upsert=True
            )
            used += actual_increment
            remaining = max(0, limit - used)
        
        result["limit"] = limit
        result["used"] = used
        result["remaining"] = remaining
        result["allowed"] = allowed
        result["upgrade_required"] = not allowed
        
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
    
    elif feature_name == "fridge_scanner":
        result["allowed"] = features.get("ai_photo_recognition_enabled", False)
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
    """
    Create a new subscription - DEMO/TEST ENDPOINT ONLY
    
    PRODUCTION WARNING: This endpoint is for testing purposes only.
    In production, subscriptions should ONLY be created via the payment flow:
    - POST /api/subscription/razorpay/create-order (create payment order)
    - POST /api/subscription/razorpay/verify-payment (verify and activate after payment)
    
    This endpoint creates subscriptions without payment verification and marks them
    as 'source: demo' which will be blocked by the entitlement guard.
    
    IMPORTANT: Demo subscriptions do NOT get trials since trials require
    a valid payment source to be honored.
    """
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
        
        # DEMO subscriptions do NOT get trials - trials require valid payment source
        # Status is "active" for demo, but entitlement guard will block premium access
        status = "active"
        trial_end = None
        trial_start = None
        
        subscription_id = str(uuid.uuid4())
        
        # Create subscription document - marked as DEMO source (no payment verification)
        subscription_doc = {
            "id": subscription_id,
            "user_id": current_user.id,
            "plan_id": request.plan_id,
            "status": status,
            "source": "demo",  # CRITICAL: Marks this as demo/test subscription
            "current_period_start": now.isoformat(),
            "current_period_end": period_end.isoformat(),
            "trial_start": trial_start,
            "trial_end": trial_end,
            "cancel_at_period_end": False,
            "payment_provider": request.payment_provider,
            "payment_provider_id": f"sub_{uuid.uuid4().hex[:16]}",  # NOT a valid payment marker
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
            "source": "demo",  # Mark as demo transaction
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



# ============== RAZORPAY PAYMENT ENDPOINTS ==============

class RazorpayOrderRequest(BaseModel):
    plan_id: str
    currency: str = "INR"  # INR for India, USD for others


class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: str


@router.post("/razorpay/create-order")
async def create_razorpay_order(
    request: RazorpayOrderRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a Razorpay order for subscription payment"""
    try:
        if not razorpay_client:
            raise HTTPException(status_code=500, detail="Razorpay not configured")
        
        plan = get_plan_by_id(request.plan_id)
        if not plan:
            raise HTTPException(status_code=400, detail="Invalid plan")
        
        if plan["plan_id"] == "free":
            raise HTTPException(status_code=400, detail="Cannot create order for free plan")
        
        # Get price based on currency
        if request.currency == "INR":
            amount = plan["pricing_inr"]
        else:
            amount = plan["pricing_usd"]
        
        # Razorpay expects amount in paise (for INR) or cents (for USD)
        amount_in_smallest_unit = int(amount * 100)
        
        # Create Razorpay order
        order_data = {
            "amount": amount_in_smallest_unit,
            "currency": request.currency,
            "receipt": f"order_{uuid.uuid4().hex[:16]}",
            "notes": {
                "user_id": current_user.id,
                "plan_id": request.plan_id,
                "user_email": current_user.email
            }
        }
        
        razorpay_order = razorpay_client.order.create(data=order_data)
        
        # Store order in database for verification later
        order_doc = {
            "id": razorpay_order["id"],
            "user_id": current_user.id,
            "plan_id": request.plan_id,
            "amount": amount,
            "currency": request.currency,
            "status": "created",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.razorpay_orders.insert_one(order_doc)
        
        return {
            "success": True,
            "order": {
                "id": razorpay_order["id"],
                "amount": amount,
                "amount_in_paise": amount_in_smallest_unit,
                "currency": request.currency,
                "key_id": RAZORPAY_KEY_ID
            },
            "plan": {
                "name": plan["display_name"],
                "billing_cycle": plan["billing_cycle"]
            },
            "user": {
                "email": current_user.email,
                "name": current_user.name
            }
        }
        
    except razorpay.errors.BadRequestError as e:
        logging.error(f"Razorpay error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating Razorpay order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/razorpay/verify-payment")
async def verify_razorpay_payment(
    request: RazorpayVerifyRequest,
    current_user: User = Depends(get_current_user)
):
    """Verify Razorpay payment and activate subscription"""
    try:
        if not razorpay_client:
            raise HTTPException(status_code=500, detail="Razorpay not configured")
        
        # Verify signature
        params_dict = {
            'razorpay_order_id': request.razorpay_order_id,
            'razorpay_payment_id': request.razorpay_payment_id,
            'razorpay_signature': request.razorpay_signature
        }
        
        try:
            razorpay_client.utility.verify_payment_signature(params_dict)
        except razorpay.errors.SignatureVerificationError:
            logging.error(f"Payment signature verification failed for order {request.razorpay_order_id}")
            raise HTTPException(status_code=400, detail="Payment verification failed")
        
        # Get order from database
        order = await db.razorpay_orders.find_one({"id": request.razorpay_order_id})
        if not order:
            raise HTTPException(status_code=400, detail="Order not found")
        
        if order["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Order does not belong to user")
        
        plan = get_plan_by_id(request.plan_id)
        if not plan:
            raise HTTPException(status_code=400, detail="Invalid plan")
        
        now = datetime.now(timezone.utc)
        period_end = datetime.now(timezone.utc)
        
        # Calculate period end based on billing cycle
        if plan["billing_cycle"] == "monthly":
            period_end = now + timedelta(days=30)
        elif plan["billing_cycle"] == "annual":
            period_end = now + timedelta(days=365)
        
        # Cancel any existing subscription
        await db.user_subscriptions.update_many(
            {"user_id": current_user.id, "status": {"$in": ["active", "trialing"]}},
            {"$set": {"status": "canceled", "canceled_at": now.isoformat()}}
        )
        
        subscription_id = str(uuid.uuid4())
        
        # Create new subscription
        subscription_doc = {
            "id": subscription_id,
            "user_id": current_user.id,
            "plan_id": request.plan_id,
            "status": "active",
            "current_period_start": now.isoformat(),
            "current_period_end": period_end.isoformat(),
            "trial_start": None,
            "trial_end": None,
            "cancel_at_period_end": False,
            "payment_provider": "razorpay",
            "payment_provider_id": request.razorpay_payment_id,
            "razorpay_order_id": request.razorpay_order_id,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.user_subscriptions.insert_one(subscription_doc)
        
        # Update order status
        await db.razorpay_orders.update_one(
            {"id": request.razorpay_order_id},
            {"$set": {"status": "paid", "payment_id": request.razorpay_payment_id}}
        )
        
        # Record transaction
        transaction_doc = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "subscription_id": subscription_id,
            "transaction_id": request.razorpay_payment_id,
            "payment_provider": "razorpay",
            "payment_provider_transaction_id": request.razorpay_payment_id,
            "razorpay_order_id": request.razorpay_order_id,
            "amount": order["amount"],
            "currency": order["currency"],
            "status": "completed",
            "transaction_type": "subscription",
            "created_at": now.isoformat(),
            "paid_at": now.isoformat()
        }
        
        await db.payment_transactions.insert_one(transaction_doc)
        
        # AUDIT LOG: Record plan change
        # Get old plan (if any exists)
        old_plan = "free"  # Default if no previous subscription
        await log_plan_change(
            db=db,
            user_id=current_user.id,
            old_plan=old_plan,
            new_plan=request.plan_id,
            reason="payment_verified",
            metadata={
                "subscription_id": subscription_id,
                "payment_id": request.razorpay_payment_id,
                "order_id": request.razorpay_order_id,
                "payment_provider": "razorpay",
                "amount": order["amount"],
                "currency": order["currency"]
            }
        )
        
        logging.info(f"Payment verified and subscription activated for user {current_user.id}, plan {request.plan_id}")
        
        subscription_doc.pop("_id", None)
        subscription_doc["plan"] = plan
        
        return {
            "success": True,
            "message": f"Successfully subscribed to {plan['display_name']}!",
            "subscription": subscription_doc
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error verifying Razorpay payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/razorpay/config")
async def get_razorpay_config():
    """Get Razorpay public configuration"""
    return {
        "success": True,
        "key_id": RAZORPAY_KEY_ID,
        "configured": bool(razorpay_client)
    }


@router.post("/razorpay/webhook")
async def razorpay_webhook(request: Request):
    """
    Handle Razorpay webhook events with WEBHOOK SAFETY FILTER
    
    Before creating any subscription from a webhook:
    ALLOW only if:
        - event type is verified payment success OR trial start
        - signature is valid
        - payment_id exists and is stored
    
    Otherwise:
        → IGNORE event
        → LOG "WEBHOOK_REJECTED_NO_PAYMENT"
    """
    try:
        body = await request.body()
        signature = request.headers.get('x-razorpay-signature', '')
        
        # Verify webhook signature
        webhook_secret = os.environ.get('RAZORPAY_WEBHOOK_SECRET', RAZORPAY_KEY_SECRET)
        
        expected_signature = hmac.new(
            webhook_secret.encode(),
            body,
            hashlib.sha256
        ).hexdigest()
        
        if signature != expected_signature:
            logging.warning("[WEBHOOK_SAFETY] Invalid Razorpay webhook signature - REJECTED")
            log_security_event(
                event_type=SecurityEvent.WEBHOOK_REJECTED_NO_PAYMENT,
                user_id="unknown",
                source="razorpay_webhook",
                details={"reason": "invalid_signature"}
            )
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        import json
        event = json.loads(body)
        event_type = event.get('event')
        
        logging.info(f"[WEBHOOK] Received Razorpay webhook: {event_type}")
        
        # WEBHOOK SAFETY FILTER
        is_valid_event, validation_reason = validate_webhook_event(
            event_type=event_type,
            payload=event,
            signature=signature,
            expected_secret=webhook_secret
        )
        
        if not is_valid_event:
            logging.warning(f"[WEBHOOK_SAFETY] Event rejected: {event_type}, reason: {validation_reason}")
            log_security_event(
                event_type=SecurityEvent.WEBHOOK_REJECTED_NO_PAYMENT,
                user_id="unknown",
                source="razorpay_webhook",
                details={
                    "event_type": event_type,
                    "reason": validation_reason
                }
            )
            return {"status": "ignored", "reason": validation_reason}
        
        now = datetime.now(timezone.utc)
        
        if event_type == 'payment.captured':
            # Payment successful - activate subscription if order exists
            payment = event['payload']['payment']['entity']
            payment_id = payment['id']
            order_id = payment.get('order_id')
            
            logging.info(f"Payment captured: {payment_id}, Order: {order_id}")
            
            if order_id:
                # Find the order in our database
                order = await db.razorpay_orders.find_one({"id": order_id})
                
                if order and order.get("status") != "paid":
                    user_id = order.get("user_id")
                    plan_id = order.get("plan_id")
                    
                    if user_id and plan_id:
                        plan = get_plan_by_id(plan_id)
                        
                        if plan:
                            # Calculate period end
                            period_end = now
                            if plan["billing_cycle"] == "monthly":
                                period_end = now + timedelta(days=30)
                            elif plan["billing_cycle"] == "annual":
                                period_end = now + timedelta(days=365)
                            
                            # Cancel any existing subscription
                            await db.user_subscriptions.update_many(
                                {"user_id": user_id, "status": {"$in": ["active", "trialing"]}},
                                {"$set": {"status": "canceled", "canceled_at": now.isoformat()}}
                            )
                            
                            # Create new subscription with VALID PAYMENT SOURCE
                            subscription_id = str(uuid.uuid4())
                            subscription_doc = {
                                "id": subscription_id,
                                "user_id": user_id,
                                "plan_id": plan_id,
                                "status": "active",
                                "source": EntitlementSource.RAZORPAY.value,  # VALID SOURCE
                                "current_period_start": now.isoformat(),
                                "current_period_end": period_end.isoformat(),
                                "trial_start": None,
                                "trial_end": None,
                                "cancel_at_period_end": False,
                                "payment_provider": "razorpay",
                                "payment_provider_id": payment_id,
                                "razorpay_order_id": order_id,
                                "razorpay_payment_id": payment_id,  # REQUIRED for entitlement guard
                                "created_at": now.isoformat(),
                                "updated_at": now.isoformat()
                            }
                            await db.user_subscriptions.insert_one(subscription_doc)
                            
                            # LOG SUBSCRIPTION CREATION
                            log_subscription_creation(
                                user_id=user_id,
                                subscription_id=subscription_id,
                                plan_id=plan_id,
                                source="webhook",
                                payment_id=payment_id,
                                trial_flag=False,
                                additional_data={
                                    "razorpay_order_id": order_id,
                                    "webhook_event": event_type
                                }
                            )
                            
                            # AUDIT LOG: Record plan change from webhook
                            await log_plan_change(
                                db=db,
                                user_id=user_id,
                                old_plan="free",
                                new_plan=plan_id,
                                reason="webhook_payment_captured",
                                metadata={
                                    "subscription_id": subscription_id,
                                    "payment_id": payment_id,
                                    "order_id": order_id,
                                    "webhook_event": event_type
                                }
                            )
                            
                            # Update order status
                            await db.razorpay_orders.update_one(
                                {"id": order_id},
                                {"$set": {"status": "paid", "payment_id": payment_id}}
                            )
                            
                            # Record transaction
                            transaction_doc = {
                                "id": str(uuid.uuid4()),
                                "user_id": user_id,
                                "subscription_id": subscription_id,
                                "transaction_id": payment_id,
                                "payment_provider": "razorpay",
                                "amount": order.get("amount", 0),
                                "currency": order.get("currency", "INR"),
                                "status": "completed",
                                "transaction_type": "subscription",
                                "webhook_event": event_type,
                                "created_at": now.isoformat(),
                                "paid_at": now.isoformat()
                            }
                            await db.payment_transactions.insert_one(transaction_doc)
                            
                            logging.info(f"Webhook: Subscription activated for user {user_id}, plan {plan_id}")
            
        elif event_type == 'payment.failed':
            # Payment failed - update order status
            payment = event['payload']['payment']['entity']
            payment_id = payment['id']
            order_id = payment.get('order_id')
            error_description = payment.get('error_description', 'Payment failed')
            
            logging.warning(f"Payment failed: {payment_id}, Order: {order_id}, Error: {error_description}")
            
            if order_id:
                await db.razorpay_orders.update_one(
                    {"id": order_id},
                    {"$set": {"status": "failed", "error": error_description, "updated_at": now.isoformat()}}
                )
            
        elif event_type == 'subscription.activated':
            # Razorpay subscription activated (for recurring)
            subscription = event['payload']['subscription']['entity']
            logging.info(f"Razorpay subscription activated: {subscription['id']}")
            
        elif event_type == 'subscription.cancelled':
            # Razorpay subscription cancelled
            subscription = event['payload']['subscription']['entity']
            subscription_id = subscription['id']
            
            logging.info(f"Razorpay subscription cancelled: {subscription_id}")
            
            # Find and cancel in our database
            await db.user_subscriptions.update_one(
                {"payment_provider_id": subscription_id, "payment_provider": "razorpay"},
                {"$set": {"status": "canceled", "canceled_at": now.isoformat(), "updated_at": now.isoformat()}}
            )
            
        elif event_type == 'subscription.charged':
            # Recurring payment successful
            subscription = event['payload']['subscription']['entity']
            payment = event['payload'].get('payment', {}).get('entity', {})
            
            logging.info(f"Subscription charged: {subscription['id']}")
            
            # Extend subscription period
            await db.user_subscriptions.update_one(
                {"payment_provider_id": subscription['id'], "payment_provider": "razorpay"},
                {"$set": {
                    "status": "active",
                    "current_period_end": (now + timedelta(days=30)).isoformat(),
                    "updated_at": now.isoformat()
                }}
            )
        
        return {"success": True, "received": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing Razorpay webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== SUBSCRIPTION MANAGEMENT ENDPOINTS ==============

class CancelSubscriptionRequest(BaseModel):
    cancel_at_period_end: bool = True  # If true, access continues until period end


@router.post("/cancel-v2")
async def cancel_subscription_v2(
    request: CancelSubscriptionRequest,
    current_user: User = Depends(get_current_user)
):
    """Cancel the current subscription"""
    try:
        now = datetime.now(timezone.utc)
        
        # Find active subscription
        subscription = await db.user_subscriptions.find_one({
            "user_id": current_user.id,
            "status": {"$in": ["active", "trialing"]}
        })
        
        if not subscription:
            raise HTTPException(status_code=404, detail="No active subscription found")
        
        if subscription.get("plan_id") == "free":
            raise HTTPException(status_code=400, detail="Cannot cancel free plan")
        
        if request.cancel_at_period_end:
            # Mark to cancel at end of period
            await db.user_subscriptions.update_one(
                {"_id": subscription["_id"]},
                {
                    "$set": {
                        "cancel_at_period_end": True,
                        "cancellation_requested_at": now.isoformat(),
                        "updated_at": now.isoformat()
                    }
                }
            )
            
            return {
                "success": True,
                "message": "Subscription will be cancelled at the end of your billing period",
                "access_until": subscription.get("current_period_end")
            }
        else:
            # Immediate cancellation
            await db.user_subscriptions.update_one(
                {"_id": subscription["_id"]},
                {
                    "$set": {
                        "status": "canceled",
                        "canceled_at": now.isoformat(),
                        "updated_at": now.isoformat()
                    }
                }
            )
            
            return {
                "success": True,
                "message": "Subscription cancelled immediately"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error cancelling subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reactivate")
async def reactivate_subscription(current_user: User = Depends(get_current_user)):
    """Reactivate a subscription that was set to cancel at period end"""
    try:
        now = datetime.now(timezone.utc)
        
        # Find subscription marked for cancellation (can be active or trialing)
        subscription = await db.user_subscriptions.find_one({
            "user_id": current_user.id,
            "status": {"$in": ["active", "trialing"]},
            "cancel_at_period_end": True
        })
        
        if not subscription:
            raise HTTPException(
                status_code=404, 
                detail="No subscription pending cancellation found"
            )
        
        # Check if still within period
        period_end = subscription.get("current_period_end")
        if period_end:
            end_date = datetime.fromisoformat(period_end.replace('Z', '+00:00'))
            if end_date < now:
                raise HTTPException(
                    status_code=400,
                    detail="Subscription period has already ended. Please subscribe again."
                )
        
        # Reactivate
        await db.user_subscriptions.update_one(
            {"_id": subscription["_id"]},
            {
                "$set": {
                    "cancel_at_period_end": False,
                    "updated_at": now.isoformat()
                },
                "$unset": {
                    "cancellation_requested_at": ""
                }
            }
        )
        
        return {
            "success": True,
            "message": "Subscription reactivated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error reactivating subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/billing-history")
async def get_billing_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Get billing history / payment transactions"""
    try:
        # Get payment transactions for user
        transactions = await db.payment_transactions.find(
            {"user_id": current_user.id},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(length=limit)
        
        # Enhance with plan details
        for txn in transactions:
            if txn.get("subscription_id"):
                sub = await db.user_subscriptions.find_one(
                    {"id": txn["subscription_id"]},
                    {"_id": 0, "plan_id": 1}
                )
                if sub:
                    plan = get_plan_by_id(sub.get("plan_id"))
                    if plan:
                        txn["description"] = f"{plan['display_name']} Subscription"
        
        return {
            "success": True,
            "transactions": transactions,
            "count": len(transactions)
        }
        
    except Exception as e:
        logging.error(f"Error getting billing history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/invoices/{transaction_id}")
async def get_invoice(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get invoice details for a specific transaction"""
    try:
        transaction = await db.payment_transactions.find_one(
            {"id": transaction_id, "user_id": current_user.id},
            {"_id": 0}
        )
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Get user details
        user = await db.users.find_one(
            {"id": current_user.id},
            {"_id": 0, "name": 1, "email": 1}
        )
        
        # Get plan details
        plan_name = "Subscription"
        if transaction.get("subscription_id"):
            sub = await db.user_subscriptions.find_one(
                {"id": transaction["subscription_id"]},
                {"_id": 0, "plan_id": 1}
            )
            if sub:
                plan = get_plan_by_id(sub.get("plan_id"))
                if plan:
                    plan_name = plan['display_name']
        
        invoice = {
            "invoice_id": f"INV-{transaction_id[:8].upper()}",
            "transaction_id": transaction_id,
            "date": transaction.get("paid_at") or transaction.get("created_at"),
            "customer": {
                "name": user.get("name", "Customer"),
                "email": user.get("email", "")
            },
            "items": [
                {
                    "description": f"{plan_name} Subscription",
                    "amount": transaction.get("amount", 0),
                    "currency": transaction.get("currency", "INR")
                }
            ],
            "total": transaction.get("amount", 0),
            "currency": transaction.get("currency", "INR"),
            "status": transaction.get("status", "completed"),
            "payment_method": transaction.get("payment_provider", "razorpay")
        }
        
        return {
            "success": True,
            "invoice": invoice
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting invoice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== ADMIN/MIGRATION ENDPOINTS ==============

@router.post("/admin/fix-invalid-subscriptions")
async def fix_invalid_subscriptions(
    hours_window: int = 24,
    dry_run: bool = True
):
    """
    TARGETED DATA REPAIR SCRIPT (SAFE)
    
    This script has two modes:
    
    1. RESTORE MODE: For users marked Free BUT having valid payment record
       → Restore correct paid tier
       → Log "PREMIUM_RESTORED_AFTER_FALSE_DOWNGRADE"
    
    2. CORRECTION MODE: For users with paid plan but NO payment anywhere
       → Downgrade to FREE (only after source-of-truth verification)
       → Log "BULK_PREMIUM_CORRECTION"
    
    SAFETY: Does NOT touch real free users or valid paid users.
    
    Query params:
    - hours_window: Only check subscriptions in last N hours (0 = all time)
    - dry_run: If true (DEFAULT), only report without making changes
    """
    try:
        result = await run_bulk_premium_correction(
            db=db,
            hours_window=hours_window,
            dry_run=dry_run
        )
        
        return {
            "success": True,
            "message": (
                f"{'Would restore' if dry_run else 'Restored'} {result['restorations_performed']} falsely downgraded users. "
                f"{'Would correct' if dry_run else 'Corrected'} {result['corrections_performed']} invalid subscriptions."
            ),
            **result
        }
        
    except Exception as e:
        logging.error(f"Error in data repair script: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/subscription-integrity-check")
async def subscription_integrity_check():
    """
    ADMIN ENDPOINT: Comprehensive subscription integrity report.
    
    Returns:
    - Total active paid subscriptions
    - Subscriptions with valid payment markers
    - Subscriptions protected by grace period
    - Subscriptions needing verification
    - Falsely downgraded users (have payment but on free)
    """
    try:
        now = datetime.now(timezone.utc)
        grace_cutoff = now - timedelta(minutes=10)
        
        # Count all active paid subscriptions
        total_paid = await db.user_subscriptions.count_documents({
            "status": {"$in": ["active", "trialing"]},
            "plan_id": {"$ne": "free"}
        })
        
        # Count subscriptions with valid payment markers
        valid_paid = await db.user_subscriptions.count_documents({
            "status": {"$in": ["active", "trialing"]},
            "plan_id": {"$ne": "free"},
            "$or": [
                {"razorpay_payment_id": {"$exists": True, "$ne": None}},
                {"razorpay_order_id": {"$exists": True, "$ne": None}},
                {"source": {"$in": ["payment", "admin", "razorpay", "stripe", "webhook"]}}
            ]
        })
        
        # Count subscriptions in grace period
        in_grace_period = await db.user_subscriptions.count_documents({
            "status": {"$in": ["active", "trialing"]},
            "plan_id": {"$ne": "free"},
            "$or": [
                {"created_at": {"$gte": grace_cutoff.isoformat()}},
                {"updated_at": {"$gte": grace_cutoff.isoformat()}}
            ]
        })
        
        # Count blocked/corrected subscriptions
        blocked_count = await db.user_subscriptions.count_documents({
            "status": {"$in": ["invalid_blocked", "bulk_corrected"]}
        })
        
        # Check for falsely downgraded users (have payment but on free/blocked)
        paid_users = await db.payment_transactions.distinct("user_id", {
            "status": "completed",
            "$or": [
                {"source": {"$ne": "demo"}},
                {"source": {"$exists": False}}
            ]
        })
        
        falsely_downgraded = 0
        for user_id in paid_users:
            sub = await db.user_subscriptions.find_one({
                "user_id": user_id,
                "$or": [
                    {"plan_id": "free"},
                    {"status": "invalid_blocked"},
                    {"status": "bulk_corrected"}
                ]
            })
            if sub:
                falsely_downgraded += 1
        
        # Determine status
        if falsely_downgraded > 0:
            status = "CRITICAL_FALSE_DOWNGRADES"
        elif blocked_count > 0:
            status = "HAS_BLOCKED_SUBSCRIPTIONS"
        elif total_paid == valid_paid:
            status = "OK"
        else:
            status = "NEEDS_REVIEW"
        
        return {
            "success": True,
            "integrity_report": {
                "total_active_paid_subscriptions": total_paid,
                "subscriptions_with_valid_payment": valid_paid,
                "subscriptions_in_grace_period": in_grace_period,
                "blocked_or_corrected_subscriptions": blocked_count,
                "falsely_downgraded_users": falsely_downgraded,
                "integrity_status": status,
                "recommendation": (
                    "Run POST /admin/fix-invalid-subscriptions?dry_run=true to preview fixes"
                    if falsely_downgraded > 0 else
                    "System healthy" if status == "OK" else
                    "Review blocked subscriptions"
                )
            }
        }
        
    except Exception as e:
        logging.error(f"Error checking subscription integrity: {e}")
        raise HTTPException(status_code=500, detail=str(e))

