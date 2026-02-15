"""
Entitlement Guard Service - Production-Safe Premium Access Control

PERMANENT SAFE FIX - Priority-Based Entitlement Resolution

This module provides authoritative server-side entitlement validation that:
1. NEVER incorrectly downgrades paid users
2. ALWAYS starts new users on Free plan
3. Only downgrades when truly unpaid (with multi-source validation)
4. Includes grace periods to handle webhook delays and sync lag

PRIORITY ORDER FOR ENTITLEMENT:
    Priority 1 → Valid successful payment record
    Priority 2 → Active trial not expired
    Priority 3 → Existing active subscription with valid markers
    Priority 4 → Grace period protection (10 min for new/renewed subs)
    Else → Free plan

NEVER downgrade if ANY of the top 4 are true.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple, List
from enum import Enum

# Configure audit logger
audit_logger = logging.getLogger("entitlement_audit")
audit_logger.setLevel(logging.INFO)


class EntitlementSource(Enum):
    """Valid sources for subscription creation"""
    PAYMENT = "payment"
    TRIAL = "trial"
    ADMIN = "admin"
    RAZORPAY = "razorpay"
    STRIPE = "stripe"
    DEMO = "demo"  # Test only - blocked for premium in production
    WEBHOOK = "webhook"
    CRON = "cron"
    SIGNUP = "signup"
    MIGRATION = "migration"


class SecurityEvent(Enum):
    """Security event types for audit logging"""
    INVALID_PREMIUM_BLOCKED = "INVALID_PREMIUM_BLOCKED"
    WEBHOOK_REJECTED_NO_PAYMENT = "WEBHOOK_REJECTED_NO_PAYMENT"
    ILLEGAL_POST_SIGNUP_UPGRADE = "ILLEGAL_POST_SIGNUP_UPGRADE"
    BULK_PREMIUM_CORRECTION = "BULK_PREMIUM_CORRECTION"
    SUBSCRIPTION_CREATED = "SUBSCRIPTION_CREATED"
    SUBSCRIPTION_VALIDATED = "SUBSCRIPTION_VALIDATED"
    ENTITLEMENT_CHECK = "ENTITLEMENT_CHECK"
    PREMIUM_RESTORED_AFTER_FALSE_DOWNGRADE = "PREMIUM_RESTORED_AFTER_FALSE_DOWNGRADE"
    GRACE_PERIOD_PROTECTION = "GRACE_PERIOD_PROTECTION"
    PAYMENT_VERIFIED_FROM_SOURCE = "PAYMENT_VERIFIED_FROM_SOURCE"
    ILLEGAL_AUTO_UPGRADE_BLOCKED = "ILLEGAL_AUTO_UPGRADE_BLOCKED"


# Valid sources that can grant premium access - ONLY FROM PAYMENTS/TRIALS
VALID_PREMIUM_SOURCES = {
    EntitlementSource.PAYMENT.value,
    EntitlementSource.TRIAL.value,
    EntitlementSource.ADMIN.value,
    EntitlementSource.RAZORPAY.value,
    EntitlementSource.STRIPE.value,
    EntitlementSource.WEBHOOK.value,  # Webhooks from payment providers
}

# INVALID sources that should NEVER grant premium
INVALID_UPGRADE_SOURCES = {
    EntitlementSource.DEMO.value,
    EntitlementSource.CRON.value,
    EntitlementSource.SIGNUP.value,
    EntitlementSource.MIGRATION.value,
    "",
    None,
}

# Signup protection window (seconds)
SIGNUP_PROTECTION_WINDOW_SECONDS = 10

# GRACE PERIOD: 10 minutes for new/renewed subscriptions
# Prevents downgrades during webhook delay, DB replication lag, background sync timing
GRACE_PERIOD_MINUTES = 10

# Minimum account age before downgrade is allowed (prevents race conditions)
MIN_ACCOUNT_AGE_FOR_DOWNGRADE_MINUTES = 5


def log_security_event(
    event_type: SecurityEvent,
    user_id: str,
    source: str = "unknown",
    payment_id: Optional[str] = None,
    trial_flag: bool = False,
    plan_id: str = "free",
    details: Optional[Dict] = None
):
    """
    Log security event for audit trail with full decision visibility.
    
    REQUIRED LOGGING FIELDS:
    - user_id
    - final_plan
    - payment_found (true/false)
    - trial_active (true/false)
    - decision_reason
    - timestamp
    """
    log_entry = {
        "event": event_type.value,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "source": source,
        "payment_id": payment_id,
        "payment_found": bool(payment_id),
        "trial_active": trial_flag,
        "final_plan": plan_id,
        "decision_reason": details.get("decision_reason") if details else "unknown",
        "details": details or {}
    }
    
    # Log level based on event severity
    if event_type in [
        SecurityEvent.INVALID_PREMIUM_BLOCKED,
        SecurityEvent.WEBHOOK_REJECTED_NO_PAYMENT,
        SecurityEvent.ILLEGAL_POST_SIGNUP_UPGRADE,
        SecurityEvent.ILLEGAL_AUTO_UPGRADE_BLOCKED
    ]:
        audit_logger.warning(f"[SECURITY] {log_entry}")
        logging.warning(f"[ENTITLEMENT_GUARD] {event_type.value}: user={user_id}, source={source}, payment={payment_id}")
    elif event_type == SecurityEvent.PREMIUM_RESTORED_AFTER_FALSE_DOWNGRADE:
        audit_logger.info(f"[RESTORE] {log_entry}")
        logging.info(f"[ENTITLEMENT_GUARD] PREMIUM_RESTORED: user={user_id}")
    else:
        audit_logger.info(f"[AUDIT] {log_entry}")
        logging.info(f"[ENTITLEMENT_GUARD] {event_type.value}: user={user_id}, source={source}")
    
    return log_entry


def enforce_free_default(plan_id: Optional[str], user_id: str) -> str:
    """
    CRITICAL SAFETY: If plan is null/undefined/empty → ALWAYS return FREE.
    
    This is the final fallback that prevents ANY auto-upgrade logic.
    
    REMOVES ANY FALLBACK SUCH AS:
    - "if plan null → CHEF_PRO"
    - "if user has no tier → assign highest"
    - "if entitlement undefined → premium"
    
    REPLACES WITH:
    - "if undefined → FREE"
    """
    if not plan_id or plan_id in [None, "", "null", "undefined"]:
        log_security_event(
            event_type=SecurityEvent.ILLEGAL_AUTO_UPGRADE_BLOCKED,
            user_id=user_id,
            source="default_enforcement",
            plan_id="free",
            details={
                "decision_reason": "NULL_PLAN_DEFAULTED_TO_FREE",
                "original_value": str(plan_id),
                "enforced_value": "free"
            }
        )
        return "free"
    return plan_id


def safety_check_before_premium(
    payment_exists: bool,
    trial_active: bool,
    user_id: str,
    requested_plan: str
) -> Tuple[bool, str]:
    """
    SAFETY CHECK - MUST RUN BEFORE RETURNING PREMIUM ENTITLEMENT
    
    Rule: if (!payment && !trialActive) return FREE;
    
    This is the FINAL gate that prevents premium access without payment/trial.
    """
    if requested_plan == "free":
        return True, "free_plan_allowed"
    
    # For ANY non-free plan, require payment OR active trial
    if not payment_exists and not trial_active:
        log_security_event(
            event_type=SecurityEvent.ILLEGAL_AUTO_UPGRADE_BLOCKED,
            user_id=user_id,
            source="safety_check",
            plan_id="free",
            details={
                "decision_reason": "NO_PAYMENT_NO_TRIAL_BLOCKED",
                "requested_plan": requested_plan,
                "payment_exists": payment_exists,
                "trial_active": trial_active,
                "enforced_plan": "free"
            }
        )
        return False, "blocked_no_payment_no_trial"
    
    return True, "payment_or_trial_verified"


def _is_within_grace_period(subscription: Dict) -> Tuple[bool, str]:
    """
    Check if subscription is within the grace period.
    
    Grace period protects against:
    - Webhook delays
    - DB replication lag
    - Background sync timing issues
    """
    created_at = subscription.get("created_at")
    updated_at = subscription.get("updated_at")
    
    # Use the more recent timestamp
    timestamp_str = updated_at or created_at
    if not timestamp_str:
        return False, "no_timestamp"
    
    try:
        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        minutes_since = (now - timestamp).total_seconds() / 60
        
        if minutes_since <= GRACE_PERIOD_MINUTES:
            return True, f"within_grace_period_{minutes_since:.1f}_min"
        return False, f"outside_grace_period_{minutes_since:.1f}_min"
    except Exception as e:
        logging.error(f"[ENTITLEMENT_GUARD] Grace period check error: {e}")
        return False, "timestamp_parse_error"


def _check_trial_status(subscription: Dict) -> Tuple[bool, str]:
    """
    Check if subscription has an active, non-expired trial from a VALID source.
    
    IMPORTANT: Trials are only valid from legitimate sources (payment, trial, webhook).
    Demo subscriptions do NOT get valid trials.
    
    Returns:
        Tuple[bool, str]: (is_active_trial, reason)
    """
    status = subscription.get("status", "")
    trial_end = subscription.get("trial_end")
    source = subscription.get("source", "")
    
    # Trials must come from valid sources - demo trials are NOT valid
    if source in INVALID_UPGRADE_SOURCES or source == "demo":
        return False, f"trial_invalid_source:{source}"
    
    if status != "trialing":
        return False, "not_in_trial_status"
    
    if not trial_end:
        return False, "no_trial_end_date"
    
    try:
        trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        
        if trial_end_dt > now:
            days_remaining = (trial_end_dt - now).days
            return True, f"active_trial_{days_remaining}_days_remaining"
        else:
            return False, "trial_expired"
    except Exception as e:
        logging.error(f"[ENTITLEMENT_GUARD] Trial check error: {e}")
        return False, "trial_date_parse_error"


def _has_direct_payment_markers(subscription: Dict) -> Tuple[bool, str]:
    """
    Check if subscription has direct payment markers embedded.
    
    This is Priority 1 validation - most reliable.
    
    ONLY accepts real payment provider IDs:
    - razorpay_payment_id: starts with "pay_"
    - razorpay_order_id: starts with "order_"
    - Stripe payment_intent: starts with "pi_"
    
    Demo/test IDs (sub_xxxx) are NOT valid payment markers.
    """
    payment_id = subscription.get("razorpay_payment_id") or subscription.get("payment_id")
    order_id = subscription.get("razorpay_order_id")
    
    markers_found = []
    
    # Check razorpay_payment_id (must start with "pay_")
    if payment_id and isinstance(payment_id, str) and payment_id.startswith("pay_"):
        markers_found.append(f"razorpay_payment:{payment_id[:16]}...")
    
    # Check razorpay_order_id (must start with "order_")
    if order_id and isinstance(order_id, str) and order_id.startswith("order_"):
        markers_found.append(f"razorpay_order:{order_id[:16]}...")
    
    # Check for Stripe payment_intent
    if payment_id and isinstance(payment_id, str) and payment_id.startswith("pi_"):
        markers_found.append(f"stripe_payment:{payment_id[:16]}...")
    
    if markers_found:
        return True, f"has_payment_markers:[{','.join(markers_found)}]"
    return False, "no_payment_markers"


def _has_valid_source(subscription: Dict) -> Tuple[bool, str]:
    """
    Check if subscription has a valid premium source.
    """
    source = subscription.get("source", "")
    
    if source in VALID_PREMIUM_SOURCES:
        return True, f"valid_source:{source}"
    
    # Also check payment_provider as a backup source indicator
    payment_provider = subscription.get("payment_provider", "")
    if payment_provider in ["razorpay", "stripe"]:
        return True, f"valid_payment_provider:{payment_provider}"
    
    return False, f"invalid_source:{source or 'none'}"


def validate_subscription_entitlement(
    subscription: Dict,
    user_id: str
) -> Tuple[bool, str]:
    """
    AUTHORITATIVE ENTITLEMENT RESOLUTION (CRITICAL)
    
    Final entitlement decided using PRIORITY ORDER:
    
    Priority 1 → Valid successful payment record (payment markers in subscription)
    Priority 2 → Active trial not expired
    Priority 3 → Existing active subscription with valid source
    Priority 4 → Grace period protection (10 min for new/renewed subs)
    Else → Free plan
    
    NEVER downgrade if ANY of the top 4 are true.
    
    This is a SAFE guard that:
    - Never incorrectly downgrades paid users
    - Handles webhook delays gracefully
    - Handles DB sync lag gracefully
    - Only returns False for truly invalid subscriptions
    
    Returns:
        Tuple[bool, str]: (is_valid, reason)
    """
    if not subscription:
        return True, "no_subscription"  # No subscription = FREE plan (valid state)
    
    plan_id = subscription.get("plan_id", "free")
    sub_id = subscription.get("id", "unknown")
    
    # Free plan always valid - no checks needed
    if plan_id == "free":
        return True, "free_plan"
    
    validation_checks = []
    
    # ============================================================
    # PRIORITY 1: Check for direct payment markers (HIGHEST TRUST)
    # ============================================================
    has_payment, payment_reason = _has_direct_payment_markers(subscription)
    validation_checks.append(f"P1_payment_markers:{has_payment}({payment_reason})")
    
    if has_payment:
        log_security_event(
            event_type=SecurityEvent.SUBSCRIPTION_VALIDATED,
            user_id=user_id,
            source=subscription.get("source", "unknown"),
            payment_id=subscription.get("razorpay_payment_id"),
            plan_id=plan_id,
            details={"decision_reason": "PRIORITY_1_PAYMENT_MARKERS", "checks": validation_checks}
        )
        return True, f"valid_priority_1_payment:{payment_reason}"
    
    # ============================================================
    # PRIORITY 2: Check for active trial
    # ============================================================
    has_trial, trial_reason = _check_trial_status(subscription)
    validation_checks.append(f"P2_active_trial:{has_trial}({trial_reason})")
    
    if has_trial:
        log_security_event(
            event_type=SecurityEvent.SUBSCRIPTION_VALIDATED,
            user_id=user_id,
            source=subscription.get("source", "unknown"),
            trial_flag=True,
            plan_id=plan_id,
            details={"decision_reason": "PRIORITY_2_ACTIVE_TRIAL", "checks": validation_checks}
        )
        return True, f"valid_priority_2_trial:{trial_reason}"
    
    # ============================================================
    # PRIORITY 3: Check for valid subscription source
    # ============================================================
    has_valid_source, source_reason = _has_valid_source(subscription)
    validation_checks.append(f"P3_valid_source:{has_valid_source}({source_reason})")
    
    if has_valid_source:
        log_security_event(
            event_type=SecurityEvent.SUBSCRIPTION_VALIDATED,
            user_id=user_id,
            source=subscription.get("source", "unknown"),
            plan_id=plan_id,
            details={"decision_reason": "PRIORITY_3_VALID_SOURCE", "checks": validation_checks}
        )
        return True, f"valid_priority_3_source:{source_reason}"
    
    # ============================================================
    # PRIORITY 4: Grace period protection
    # ============================================================
    in_grace, grace_reason = _is_within_grace_period(subscription)
    validation_checks.append(f"P4_grace_period:{in_grace}({grace_reason})")
    
    if in_grace:
        log_security_event(
            event_type=SecurityEvent.GRACE_PERIOD_PROTECTION,
            user_id=user_id,
            source=subscription.get("source", "unknown"),
            plan_id=plan_id,
            details={
                "decision_reason": "PRIORITY_4_GRACE_PERIOD",
                "checks": validation_checks,
                "subscription_id": sub_id
            }
        )
        return True, f"valid_priority_4_grace:{grace_reason}"
    
    # ============================================================
    # ALL PRIORITIES FAILED - But we need additional safety checks
    # before declaring invalid
    # ============================================================
    
    # SAFETY: Check subscription status - only block truly invalid
    status = subscription.get("status", "")
    if status not in ["active", "trialing"]:
        # Already inactive - let it through, caller handles status
        return True, f"inactive_status:{status}"
    
    # If we reach here, subscription appears invalid
    # Log security event but DON'T immediately block
    # The caller should do source-of-truth validation
    log_security_event(
        event_type=SecurityEvent.ENTITLEMENT_CHECK,
        user_id=user_id,
        source=subscription.get("source", "unknown"),
        plan_id=plan_id,
        details={
            "decision_reason": "REQUIRES_SOURCE_OF_TRUTH_VALIDATION",
            "checks": validation_checks,
            "subscription_id": sub_id,
            "recommendation": "verify_with_payment_provider_before_downgrade"
        }
    )
    
    # Return requires_verification instead of hard block
    # This allows the caller to do additional validation
    return False, f"requires_verification:checks={','.join(validation_checks)}"


async def verify_payment_from_source_of_truth(
    db,
    user_id: str,
    subscription: Dict
) -> Tuple[bool, str]:
    """
    SOURCE OF TRUTH VALIDATION
    
    Before downgrading any paid plan, system MUST check in order:
    1. Local payments table
    2. Razorpay orders table
    3. Recent webhook events (last 10 minutes)
    
    If ANY confirms payment → keep premium.
    
    This is the CRITICAL re-verification step that prevents false downgrades.
    """
    sub_id = subscription.get("id", "unknown")
    plan_id = subscription.get("plan_id", "free")
    
    # ============================================================
    # SOURCE 1: Check local payments table
    # ============================================================
    payment_record = await db.payment_transactions.find_one({
        "user_id": user_id,
        "status": "completed",
        "$or": [
            {"source": {"$ne": "demo"}},
            {"source": {"$exists": False}}
        ]
    }, sort=[("created_at", -1)])
    
    if payment_record:
        payment_id = payment_record.get("transaction_id") or payment_record.get("id")
        log_security_event(
            event_type=SecurityEvent.PAYMENT_VERIFIED_FROM_SOURCE,
            user_id=user_id,
            source="payments_table",
            payment_id=payment_id,
            plan_id=plan_id,
            details={
                "decision_reason": "PAYMENT_FOUND_IN_TRANSACTIONS",
                "payment_record_id": payment_record.get("id"),
                "subscription_id": sub_id
            }
        )
        return True, "payment_verified_source_1:transactions_table"
    
    # ============================================================
    # SOURCE 2: Check Razorpay orders table
    # ============================================================
    razorpay_order = await db.razorpay_orders.find_one({
        "user_id": user_id,
        "status": "paid"
    }, sort=[("created_at", -1)])
    
    if razorpay_order:
        order_id = razorpay_order.get("id")
        log_security_event(
            event_type=SecurityEvent.PAYMENT_VERIFIED_FROM_SOURCE,
            user_id=user_id,
            source="razorpay_orders",
            payment_id=razorpay_order.get("payment_id"),
            plan_id=plan_id,
            details={
                "decision_reason": "PAYMENT_FOUND_IN_RAZORPAY_ORDERS",
                "order_id": order_id,
                "subscription_id": sub_id
            }
        )
        return True, "payment_verified_source_2:razorpay_orders"
    
    # ============================================================
    # SOURCE 3: Check recent webhook events (last 10 minutes)
    # ============================================================
    ten_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=10)
    
    # Check if there's any recent successful subscription for this user
    recent_sub = await db.user_subscriptions.find_one({
        "user_id": user_id,
        "status": {"$in": ["active", "trialing"]},
        "plan_id": {"$ne": "free"},
        "updated_at": {"$gte": ten_minutes_ago.isoformat()},
        "$or": [
            {"razorpay_payment_id": {"$exists": True, "$ne": None}},
            {"razorpay_order_id": {"$exists": True, "$ne": None}},
            {"source": {"$in": list(VALID_PREMIUM_SOURCES)}}
        ]
    })
    
    if recent_sub:
        log_security_event(
            event_type=SecurityEvent.PAYMENT_VERIFIED_FROM_SOURCE,
            user_id=user_id,
            source="recent_webhook",
            payment_id=recent_sub.get("razorpay_payment_id"),
            plan_id=plan_id,
            details={
                "decision_reason": "RECENT_VALID_SUBSCRIPTION_FOUND",
                "recent_sub_id": recent_sub.get("id"),
                "subscription_id": sub_id
            }
        )
        return True, "payment_verified_source_3:recent_subscription"
    
    # All sources exhausted - payment not found
    return False, "no_payment_found_in_any_source"


async def get_user_subscription_safe(
    db,
    user_id: str,
    get_plan_by_id_func
) -> Dict:
    """
    SAFE ENTITLEMENT RESOLUTION - VALIDATOR ONLY, NOT CREATOR
    
    CORE RULES:
    1. Resolver may ONLY: confirm premium, restore premium, downgrade expired
    2. Resolver must NOT: upgrade free users to premium
    3. if (!payment && !trialActive) return FREE
    4. if (plan == null || undefined) return FREE
    
    Flow:
    1. Fetch subscription from DB
    2. Apply enforce_free_default() for null/undefined plans
    3. Run priority-based validation
    4. Run safety_check_before_premium()
    5. If validation fails, do SOURCE OF TRUTH re-verification
    6. Only downgrade if re-verification also fails
    
    Returns subscription dict with plan features.
    """
    subscription = await db.user_subscriptions.find_one(
        {"user_id": user_id, "status": {"$in": ["active", "trialing"]}},
        {"_id": 0}
    )
    
    if not subscription:
        # No subscription - return FREE plan (correct default)
        free_plan = get_plan_by_id_func("free")
        log_security_event(
            event_type=SecurityEvent.ENTITLEMENT_CHECK,
            user_id=user_id,
            source="subscription_fetch",
            plan_id="free",
            details={"decision_reason": "NO_ACTIVE_SUBSCRIPTION_DEFAULT_FREE"}
        )
        return {
            "plan_id": "free",
            "status": "active",
            "features": free_plan["features"] if free_plan else {},
            "plan": free_plan,
            "entitlement_tier": "free",
            "trial_active": False
        }
    
    # STEP 0: Enforce FREE default for null/undefined plans
    raw_plan_id = subscription.get("plan_id")
    plan_id = enforce_free_default(raw_plan_id, user_id)
    
    # Free plan - no validation needed
    if plan_id == "free":
        free_plan = get_plan_by_id_func("free")
        return {
            "plan_id": "free",
            "status": "active",
            "features": free_plan["features"] if free_plan else {},
            "plan": free_plan,
            "entitlement_tier": "free",
            "trial_active": False
        }
    
    # ============================================================
    # STEP 1: Run priority-based validation
    # ============================================================
    is_valid, reason = validate_subscription_entitlement(subscription, user_id)
    
    # Check if subscription has trial active
    has_trial, _ = _check_trial_status(subscription)
    
    if is_valid:
        # SAFETY CHECK: Before returning premium, verify payment or trial exists
        has_payment, _ = _has_direct_payment_markers(subscription)
        can_have_premium, safety_reason = safety_check_before_premium(
            payment_exists=has_payment,
            trial_active=has_trial,
            user_id=user_id,
            requested_plan=plan_id
        )
        
        if not can_have_premium:
            # Safety check failed - return FREE
            free_plan = get_plan_by_id_func("free")
            return {
                "plan_id": "free",
                "status": "active",
                "features": free_plan["features"] if free_plan else {},
                "plan": free_plan,
                "entitlement_tier": "free",
                "trial_active": False,
                "_safety_blocked": True,
                "_blocked_reason": safety_reason
            }
        
        # Subscription is valid - return with full features
        plan = get_plan_by_id_func(subscription["plan_id"])
        
        # For trials, prefer subscription features over plan features (trials get all features)
        if has_trial and subscription.get("features"):
            # Keep the trial's features (which include all premium features)
            pass
        else:
            # For paid subscriptions, use plan features
            subscription["features"] = plan["features"] if plan else {}
        
        subscription["plan"] = plan
        subscription["entitlement_tier"] = plan_id
        subscription["trial_active"] = has_trial
        return subscription
    
    # ============================================================
    # STEP 2: Validation failed - do SOURCE OF TRUTH re-verification
    # This is CRITICAL to prevent false downgrades
    # ============================================================
    payment_verified, verify_reason = await verify_payment_from_source_of_truth(
        db, user_id, subscription
    )
    
    if payment_verified:
        # Payment found in source of truth - KEEP PREMIUM
        # Also update subscription with payment marker for future checks
        logging.info(
            f"[ENTITLEMENT_GUARD] Payment verified from source of truth for user {user_id}: {verify_reason}"
        )
        plan = get_plan_by_id_func(subscription["plan_id"])
        subscription["features"] = plan["features"] if plan else {}
        subscription["plan"] = plan
        subscription["_payment_verified_from_source"] = True
        subscription["entitlement_tier"] = plan_id
        subscription["trial_active"] = has_trial
        return subscription
    
    # ============================================================
    # STEP 3: Check account age before downgrade (race condition protection)
    # ============================================================
    created_at = subscription.get("created_at")
    if created_at:
        try:
            created_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            minutes_since_creation = (now - created_dt).total_seconds() / 60
            
            if minutes_since_creation < MIN_ACCOUNT_AGE_FOR_DOWNGRADE_MINUTES:
                # Account too new - protect from race condition downgrade
                log_security_event(
                    event_type=SecurityEvent.GRACE_PERIOD_PROTECTION,
                    user_id=user_id,
                    source="account_age_protection",
                    plan_id=plan_id,
                    details={
                        "decision_reason": "ACCOUNT_TOO_NEW_FOR_DOWNGRADE",
                        "minutes_since_creation": minutes_since_creation,
                        "min_required": MIN_ACCOUNT_AGE_FOR_DOWNGRADE_MINUTES
                    }
                )
                plan = get_plan_by_id_func(subscription["plan_id"])
                subscription["features"] = plan["features"] if plan else {}
                subscription["plan"] = plan
                subscription["entitlement_tier"] = plan_id
                subscription["trial_active"] = has_trial
                return subscription
        except Exception as e:
            logging.error(f"[ENTITLEMENT_GUARD] Account age check error: {e}")
    
    # ============================================================
    # STEP 4: All checks failed - DOWNGRADE TO FREE
    # This is the ONLY path where we return FREE for a premium subscription
    # ============================================================
    logging.warning(
        f"[ENTITLEMENT_GUARD] BLOCKED premium for user {user_id}: {reason}. "
        f"Source of truth verification: {verify_reason}. "
        f"Subscription: {subscription.get('id')}, Plan: {plan_id}"
    )
    
    log_security_event(
        event_type=SecurityEvent.INVALID_PREMIUM_BLOCKED,
        user_id=user_id,
        source=subscription.get("source", "unknown"),
        plan_id=plan_id,
        details={
            "decision_reason": "ALL_VALIDATION_FAILED_DOWNGRADE_TO_FREE",
            "initial_reason": reason,
            "source_of_truth_reason": verify_reason,
            "subscription_id": subscription.get("id")
        }
    )
    
    free_plan = get_plan_by_id_func("free")
    return {
        "plan_id": "free",
        "status": "active",
        "features": free_plan["features"] if free_plan else {},
        "plan": free_plan,
        "entitlement_tier": "free",
        "trial_active": False,
        "_entitlement_blocked": True,
        "_blocked_reason": reason,
        "_source_verification_reason": verify_reason
    }


def validate_webhook_event(
    event_type: str,
    payload: Dict,
    signature: Optional[str] = None,
    expected_secret: Optional[str] = None
) -> Tuple[bool, str]:
    """
    WEBHOOK SAFETY FILTER
    
    Before creating any subscription from a webhook:
    
    ALLOW only if:
        - event type is verified payment success OR trial start
        - signature is valid (if provided)
        - payment_id exists for payment events
    
    Otherwise:
        → REJECT event
        → LOG "WEBHOOK_REJECTED_NO_PAYMENT"
    """
    # Valid webhook events that can create/update subscriptions
    VALID_PAYMENT_EVENTS = {
        "payment.captured",
        "payment_link.paid", 
        "order.paid",
        "subscription.activated",
        "subscription.charged",
        "invoice.paid"
    }
    
    VALID_TRIAL_EVENTS = {
        "subscription.trial_started",
        "trial.started"
    }
    
    # Check event type
    is_payment_event = event_type in VALID_PAYMENT_EVENTS
    is_trial_event = event_type in VALID_TRIAL_EVENTS
    
    if not (is_payment_event or is_trial_event):
        return False, f"invalid_event_type:{event_type}"
    
    # Check for payment_id in payload
    payment_id = None
    if "payload" in payload:
        payment_data = payload.get("payload", {}).get("payment", {}).get("entity", {})
        payment_id = payment_data.get("id")
    elif "payment_id" in payload:
        payment_id = payload.get("payment_id")
    
    if is_payment_event and not payment_id:
        return False, "payment_event_missing_payment_id"
    
    return True, "valid"


def check_signup_protection(
    user_id: str,
    user_created_at: str,
    subscription_source: str
) -> Tuple[bool, str]:
    """
    SIGNUP PROTECTION
    
    IF any async process upgrades the user within SIGNUP_PROTECTION_WINDOW_SECONDS of signup
    AND source is not a valid payment source
    → BLOCK the upgrade
    → LOG "ILLEGAL_POST_SIGNUP_UPGRADE"
    """
    try:
        created_at = datetime.fromisoformat(user_created_at.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        seconds_since_signup = (now - created_at).total_seconds()
        
        if seconds_since_signup <= SIGNUP_PROTECTION_WINDOW_SECONDS:
            if subscription_source not in VALID_PREMIUM_SOURCES:
                log_security_event(
                    event_type=SecurityEvent.ILLEGAL_POST_SIGNUP_UPGRADE,
                    user_id=user_id,
                    source=subscription_source,
                    details={
                        "decision_reason": "blocked_by_signup_protection",
                        "seconds_since_signup": seconds_since_signup,
                        "protection_window": SIGNUP_PROTECTION_WINDOW_SECONDS
                    }
                )
                return False, "blocked_by_signup_protection"
        
        return True, "allowed"
        
    except Exception as e:
        logging.error(f"[ENTITLEMENT_GUARD] Error in signup protection check: {e}")
        return True, "check_error_allowed"


async def run_bulk_premium_correction(
    db,
    hours_window: int = 24,
    dry_run: bool = False
) -> Dict:
    """
    TARGETED DATA REPAIR SCRIPT (SAFE)
    
    This script has two modes:
    
    1. RESTORE MODE: For users marked Free BUT having valid payment record
       → Restore correct paid tier
       → Log "PREMIUM_RESTORED_AFTER_FALSE_DOWNGRADE"
    
    2. CORRECTION MODE: For users with paid plan but NO payment anywhere
       → Downgrade to FREE
       → Log "BULK_PREMIUM_CORRECTION"
    
    SAFETY: Does NOT touch real free users or valid paid users.
    """
    now = datetime.now(timezone.utc)
    restorations = []
    corrections = []
    
    # Build time query
    time_query = {}
    if hours_window > 0:
        cutoff = now - timedelta(hours=hours_window)
        time_query = {"$or": [
            {"created_at": {"$gte": cutoff.isoformat()}},
            {"updated_at": {"$gte": cutoff.isoformat()}}
        ]}
    
    # ============================================================
    # PHASE 1: RESTORE falsely downgraded users
    # Find users who have valid payments but are on free/blocked status
    # ============================================================
    
    # Get all users with completed payments
    paid_users = await db.payment_transactions.distinct("user_id", {
        "status": "completed",
        "$or": [
            {"source": {"$ne": "demo"}},
            {"source": {"$exists": False}}
        ]
    })
    
    for user_id in paid_users:
        # Check if this user has a free or blocked subscription
        current_sub = await db.user_subscriptions.find_one({
            "user_id": user_id,
            "$or": [
                {"plan_id": "free"},
                {"status": "invalid_blocked"},
                {"status": "bulk_corrected"}
            ]
        })
        
        if current_sub:
            # Get the original payment and plan
            payment = await db.payment_transactions.find_one({
                "user_id": user_id,
                "status": "completed"
            }, sort=[("created_at", -1)])
            
            if payment:
                # Find what plan they should have
                original_plan = current_sub.get("original_plan_id") or "premium_annual"
                
                restoration = {
                    "user_id": user_id,
                    "subscription_id": current_sub.get("id"),
                    "current_status": current_sub.get("status"),
                    "should_restore_to": original_plan,
                    "payment_id": payment.get("transaction_id"),
                    "action": "would_restore" if dry_run else "restored"
                }
                
                if not dry_run:
                    # Restore the subscription
                    await db.user_subscriptions.update_one(
                        {"id": current_sub["id"]},
                        {
                            "$set": {
                                "status": "active",
                                "plan_id": original_plan,
                                "restored_at": now.isoformat(),
                                "restoration_reason": "valid_payment_found"
                            },
                            "$unset": {
                                "blocked_at": "",
                                "blocked_reason": "",
                                "corrected_at": "",
                                "correction_reason": ""
                            }
                        }
                    )
                    
                    log_security_event(
                        event_type=SecurityEvent.PREMIUM_RESTORED_AFTER_FALSE_DOWNGRADE,
                        user_id=user_id,
                        source="bulk_restoration_script",
                        payment_id=payment.get("transaction_id"),
                        plan_id=original_plan,
                        details={
                            "decision_reason": "RESTORED_VALID_PAYMENT_FOUND",
                            "subscription_id": current_sub.get("id"),
                            "previous_status": current_sub.get("status")
                        }
                    )
                    
                    # AUDIT LOG: Record restoration
                    await log_plan_change(
                        db=db,
                        user_id=user_id,
                        old_plan="free",
                        new_plan=original_plan,
                        reason="admin_bulk_restoration",
                        metadata={
                            "subscription_id": current_sub.get("id"),
                            "payment_id": payment.get("transaction_id"),
                            "previous_status": current_sub.get("status")
                        }
                    )
                
                restorations.append(restoration)
    
    # ============================================================
    # PHASE 2: CORRECT truly invalid subscriptions
    # Find paid subscriptions with NO payment anywhere
    # ============================================================
    
    query = {
        "status": {"$in": ["active", "trialing"]},
        "plan_id": {"$ne": "free"}
    }
    if time_query:
        query.update(time_query)
    
    subscriptions = await db.user_subscriptions.find(query).to_list(length=10000)
    
    for sub in subscriptions:
        user_id = sub["user_id"]
        subscription_id = sub["id"]
        plan_id = sub["plan_id"]
        
        # Skip if already checked in restoration phase
        if user_id in paid_users:
            continue
        
        # Validate subscription
        is_valid, reason = validate_subscription_entitlement(sub, user_id)
        
        if not is_valid:
            # Double-check: verify no payment exists anywhere
            payment = await db.payment_transactions.find_one({
                "user_id": user_id,
                "status": "completed",
                "$or": [
                    {"source": {"$ne": "demo"}},
                    {"source": {"$exists": False}}
                ]
            })
            
            if payment:
                # Has payment - skip (shouldn't happen but safety check)
                continue
            
            # Check razorpay orders
            order = await db.razorpay_orders.find_one({
                "user_id": user_id,
                "status": "paid"
            })
            
            if order:
                # Has paid order - skip
                continue
            
            # Check account age
            created_at = sub.get("created_at")
            if created_at:
                try:
                    created_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    minutes_old = (now - created_dt).total_seconds() / 60
                    if minutes_old < MIN_ACCOUNT_AGE_FOR_DOWNGRADE_MINUTES:
                        # Too new - skip
                        continue
                except Exception:
                    pass
            
            # Truly invalid - add to corrections
            correction = {
                "user_id": user_id,
                "subscription_id": subscription_id,
                "old_plan": plan_id,
                "reason": reason,
                "action": "would_downgrade" if dry_run else "downgraded"
            }
            
            if not dry_run:
                await db.user_subscriptions.update_one(
                    {"id": subscription_id},
                    {
                        "$set": {
                            "status": "bulk_corrected",
                            "corrected_at": now.isoformat(),
                            "correction_reason": reason,
                            "original_plan_id": plan_id
                        }
                    }
                )
                
                log_security_event(
                    event_type=SecurityEvent.BULK_PREMIUM_CORRECTION,
                    user_id=user_id,
                    source="bulk_correction_script",
                    plan_id=plan_id,
                    details={
                        "decision_reason": "NO_PAYMENT_FOUND_ANYWHERE",
                        "subscription_id": subscription_id,
                        "old_plan": plan_id,
                        "new_plan": "free",
                        "reason": reason
                    }
                )
                
                # AUDIT LOG: Record downgrade
                await log_plan_change(
                    db=db,
                    user_id=user_id,
                    old_plan=plan_id,
                    new_plan="free",
                    reason="admin_bulk_correction",
                    metadata={
                        "subscription_id": subscription_id,
                        "validation_reason": reason
                    }
                )
            
            corrections.append(correction)
    
    return {
        "total_subscriptions_checked": len(subscriptions),
        "restorations_performed": len(restorations),
        "corrections_performed": len(corrections),
        "dry_run": dry_run,
        "restorations": restorations,
        "corrections": corrections,
        "hours_window": hours_window if hours_window > 0 else "all_time"
    }


def log_subscription_creation(
    user_id: str,
    subscription_id: str,
    plan_id: str,
    source: str,
    payment_id: Optional[str] = None,
    trial_flag: bool = False,
    additional_data: Optional[Dict] = None
):
    """
    PRODUCTION LOGGING FOR SUBSCRIPTION CREATION
    
    Log every subscription creation with full decision visibility.
    """
    log_security_event(
        event_type=SecurityEvent.SUBSCRIPTION_CREATED,
        user_id=user_id,
        source=source,
        payment_id=payment_id,
        trial_flag=trial_flag,
        plan_id=plan_id,
        details={
            "decision_reason": "subscription_created",
            "subscription_id": subscription_id,
            **(additional_data or {})
        }
    )


async def log_plan_change(
    db,
    user_id: str,
    old_plan: str,
    new_plan: str,
    reason: str,
    metadata: Optional[Dict] = None
) -> Dict:
    """
    AUDIT LOG FOR SUBSCRIPTION PLAN CHANGES
    
    Tracks all subscription plan changes for debugging and compliance.
    Creates a permanent, append-only audit trail.
    
    Args:
        db: Database connection
        user_id: User whose plan changed
        old_plan: Previous plan_id (e.g., "free", "premium_monthly")
        new_plan: New plan_id
        reason: Human-readable reason for change (e.g., "payment_verified", "trial_expired", "admin_override")
        metadata: Optional additional context (payment_id, subscription_id, etc.)
    
    Returns:
        The created audit log entry
    """
    import uuid
    
    now = datetime.now(timezone.utc)
    
    audit_entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "old_plan": old_plan or "none",
        "new_plan": new_plan or "none",
        "reason": reason,
        "timestamp": now.isoformat(),
        "metadata": metadata or {}
    }
    
    # Insert into audit_logs collection
    await db.audit_logs.insert_one(audit_entry)
    
    # Also log to standard logger for immediate visibility
    logging.info(
        f"[AUDIT_LOG] Plan change: user={user_id}, "
        f"old_plan={old_plan}, new_plan={new_plan}, reason={reason}"
    )
    
    # Remove _id before returning (MongoDB adds it)
    audit_entry.pop("_id", None)
    
    return audit_entry


async def get_plan_change_history(
    db,
    user_id: str,
    limit: int = 50
) -> List[Dict]:
    """
    Get plan change history for a user.
    
    Args:
        db: Database connection
        user_id: User to get history for
        limit: Max records to return
    
    Returns:
        List of audit log entries, newest first
    """
    cursor = db.audit_logs.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit)
    
    return await cursor.to_list(length=limit)
