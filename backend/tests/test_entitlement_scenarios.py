"""
ENTITLEMENT FIX SCENARIO TESTS
5 scenarios to verify the permanent safe fix:

1. New signup → FREE plan
2. Real paid user login → Premium retained
3. Webhook delay simulation → Grace period protection
4. Payment failure case → Stays FREE
5. Expired trial downgrade → FREE plan
"""
import pytest
import asyncio
from datetime import datetime, timezone, timedelta
import uuid

# Import the entitlement guard
import sys
sys.path.insert(0, '/app/backend')
from services.entitlement_guard import (
    validate_subscription_entitlement,
    _is_within_grace_period,
    _check_trial_status,
    _has_direct_payment_markers,
    _has_valid_source,
    GRACE_PERIOD_MINUTES,
    MIN_ACCOUNT_AGE_FOR_DOWNGRADE_MINUTES
)


class TestScenario1NewSignup:
    """SCENARIO 1: New signup → FREE plan"""
    
    def test_no_subscription_returns_valid_free(self):
        """New user with no subscription should be valid (will get FREE features)"""
        is_valid, reason = validate_subscription_entitlement(None, "new_user_123")
        assert is_valid is True
        assert reason == "no_subscription"
    
    def test_free_plan_subscription_always_valid(self):
        """User with free plan should always be valid"""
        subscription = {
            "id": "sub_free_123",
            "user_id": "test_user",
            "plan_id": "free",
            "status": "active"
        }
        is_valid, reason = validate_subscription_entitlement(subscription, "test_user")
        assert is_valid is True
        assert reason == "free_plan"


class TestScenario2RealPaidUser:
    """SCENARIO 2: Real paid user login → Premium retained"""
    
    def test_subscription_with_payment_markers_valid(self):
        """Subscription with razorpay_payment_id should be valid"""
        subscription = {
            "id": "sub_paid_123",
            "user_id": "paid_user",
            "plan_id": "chef_pro_annual",
            "status": "active",
            "razorpay_payment_id": "pay_abc123xyz789def",  # Real Razorpay format
            "razorpay_order_id": "order_xyz789abc123",  # Real Razorpay format
            "created_at": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        }
        is_valid, reason = validate_subscription_entitlement(subscription, "paid_user")
        assert is_valid is True
        assert "priority_1_payment" in reason.lower()
    
    def test_subscription_with_order_id_only_valid(self):
        """Subscription with only razorpay_order_id should be valid"""
        subscription = {
            "id": "sub_paid_456",
            "user_id": "paid_user2",
            "plan_id": "premium_annual",
            "status": "active",
            "razorpay_order_id": "order_abc456def789",  # Real Razorpay format
            "created_at": (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()
        }
        is_valid, reason = validate_subscription_entitlement(subscription, "paid_user2")
        assert is_valid is True
    
    def test_subscription_with_valid_source_valid(self):
        """Subscription with valid source (razorpay/payment) should be valid"""
        subscription = {
            "id": "sub_paid_789",
            "user_id": "paid_user3",
            "plan_id": "chef_pro_monthly",
            "status": "active",
            "source": "razorpay",
            "payment_provider": "razorpay",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
        }
        is_valid, reason = validate_subscription_entitlement(subscription, "paid_user3")
        assert is_valid is True


class TestScenario3WebhookDelay:
    """SCENARIO 3: Webhook delay simulation → Grace period protection"""
    
    def test_new_subscription_in_grace_period(self):
        """Subscription created < 10 minutes ago should be protected"""
        # Created 5 minutes ago (within grace period)
        subscription = {
            "id": "sub_new_123",
            "user_id": "new_paid_user",
            "plan_id": "premium_annual",
            "status": "active",
            "source": "",  # No source yet (webhook delay)
            "created_at": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(),
            "updated_at": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        }
        
        in_grace, reason = _is_within_grace_period(subscription)
        assert in_grace is True
        assert "within_grace_period" in reason
        
        # Full validation should pass due to grace period
        is_valid, full_reason = validate_subscription_entitlement(subscription, "new_paid_user")
        assert is_valid is True
        assert "grace" in full_reason.lower()
    
    def test_subscription_outside_grace_period_needs_verification(self):
        """Subscription > 10 minutes old without payment should need verification"""
        # Created 15 minutes ago (outside grace period)
        subscription = {
            "id": "sub_old_123",
            "user_id": "old_user",
            "plan_id": "premium_annual",
            "status": "active",
            "source": "demo",  # Invalid source
            "created_at": (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat(),
            "updated_at": (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
        }
        
        in_grace, reason = _is_within_grace_period(subscription)
        assert in_grace is False
        
        # Validation should fail (needs source of truth check)
        is_valid, full_reason = validate_subscription_entitlement(subscription, "old_user")
        assert is_valid is False
        assert "requires_verification" in full_reason.lower()


class TestScenario4PaymentFailure:
    """SCENARIO 4: Payment failure case → Stays FREE"""
    
    def test_demo_subscription_without_payment_invalid(self):
        """Demo subscription without payment should be invalid (outside grace)"""
        subscription = {
            "id": "sub_demo_123",
            "user_id": "demo_user",
            "plan_id": "chef_pro_annual",
            "status": "active",
            "source": "demo",  # Test source - not valid for production
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        }
        
        # Check source validation
        has_valid_source, reason = _has_valid_source(subscription)
        assert has_valid_source is False
        
        # Check payment markers
        has_payment, reason = _has_direct_payment_markers(subscription)
        assert has_payment is False
        
        # Full validation should fail
        is_valid, full_reason = validate_subscription_entitlement(subscription, "demo_user")
        assert is_valid is False


class TestScenario5ExpiredTrial:
    """SCENARIO 5: Expired trial downgrade → FREE plan"""
    
    def test_expired_trial_invalid(self):
        """Trial that has expired should be invalid"""
        subscription = {
            "id": "sub_trial_expired",
            "user_id": "trial_user",
            "plan_id": "premium_annual",
            "status": "trialing",
            "trial_end": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),  # Expired yesterday
            "created_at": (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()
        }
        
        has_trial, reason = _check_trial_status(subscription)
        assert has_trial is False
        assert "expired" in reason.lower()
    
    def test_active_trial_valid(self):
        """Active trial should be valid"""
        subscription = {
            "id": "sub_trial_active",
            "user_id": "active_trial_user",
            "plan_id": "premium_annual",
            "status": "trialing",
            "trial_end": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),  # 7 days remaining
            "created_at": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        }
        
        has_trial, reason = _check_trial_status(subscription)
        assert has_trial is True
        assert "active_trial" in reason
        
        # Full validation should pass
        is_valid, full_reason = validate_subscription_entitlement(subscription, "active_trial_user")
        assert is_valid is True
        assert "trial" in full_reason.lower()


class TestGraceAndAccountAge:
    """Additional tests for grace period and account age protection"""
    
    def test_grace_period_duration(self):
        """Verify grace period is exactly 10 minutes"""
        assert GRACE_PERIOD_MINUTES == 10
    
    def test_min_account_age_duration(self):
        """Verify minimum account age before downgrade is 5 minutes"""
        assert MIN_ACCOUNT_AGE_FOR_DOWNGRADE_MINUTES == 5
    
    def test_subscription_at_edge_of_grace_period(self):
        """Subscription at exactly grace period boundary"""
        # At exactly 10 minutes (should be outside grace)
        subscription = {
            "id": "sub_edge",
            "user_id": "edge_user",
            "plan_id": "premium_annual",
            "status": "active",
            "created_at": (datetime.now(timezone.utc) - timedelta(minutes=10, seconds=30)).isoformat()
        }
        
        in_grace, reason = _is_within_grace_period(subscription)
        assert in_grace is False
        
        # At exactly 9.5 minutes (should be inside grace)
        subscription["created_at"] = (datetime.now(timezone.utc) - timedelta(minutes=9, seconds=30)).isoformat()
        in_grace, reason = _is_within_grace_period(subscription)
        assert in_grace is True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
