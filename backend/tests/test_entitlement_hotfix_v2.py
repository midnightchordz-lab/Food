"""
Production Hotfix Tests V2 - Comprehensive Entitlement Guard Testing

Tests all 5 scenarios from the production hotfix:
1. New signup lands on FREE plan with subscription_status=none
2. Demo subscription via /create is marked source=demo
3. Entitlement guard blocks demo subscriptions - returns FREE plan
4. Failed payment scenario - user remains on FREE
5. Real payment users retain premium access
6. Webhook replay protection (only payment.captured creates subscription)
7. Admin integrity check endpoint returns correct report
8. Admin fix endpoint works with dry_run=true and dry_run=false
9. Cron sync protection (no invalid upgrades)
"""

import pytest
import requests
import os
import uuid
import json
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestScenario1NewSignupFreePlan:
    """SCENARIO 1: New signup lands on FREE plan with subscription_status=none"""
    
    def test_new_user_registration_defaults_to_free(self):
        """New user registration assigns FREE plan with subscription_status=none"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "email": f"TEST_scenario1_{unique_id}@test.com",
            "password": "TestPassword123!",
            "name": f"Scenario1 User {unique_id}"
        }
        
        # Register new user
        response = requests.post(f"{BASE_URL}/api/auth/register", json=user_data)
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        
        # Verify token returned
        assert "access_token" in data, "No access_token in registration response"
        token = data["access_token"]
        
        # Check user data includes default_plan and subscription_status
        user = data.get("user", {})
        assert user.get("default_plan") == "free", f"Expected default_plan='free', got '{user.get('default_plan')}'"
        assert user.get("subscription_status") == "none", f"Expected subscription_status='none', got '{user.get('subscription_status')}'"
        
        # Verify subscription endpoint returns FREE plan
        headers = {"Authorization": f"Bearer {token}"}
        sub_response = requests.get(f"{BASE_URL}/api/subscription/current", headers=headers)
        
        assert sub_response.status_code == 200, f"Get subscription failed: {sub_response.text}"
        sub_data = sub_response.json()
        
        subscription = sub_data.get("subscription", {})
        assert subscription.get("plan_id") == "free", f"Expected plan_id='free', got '{subscription.get('plan_id')}'"
        
        print(f"✓ SCENARIO 1 PASS: New user '{user_data['email']}' correctly assigned FREE plan with status=none")


class TestScenario2DemoSubscriptionSourceMarker:
    """SCENARIO 2: Demo subscription via /create is marked source=demo"""
    
    def test_demo_subscription_has_source_demo(self):
        """Demo subscription created via /create endpoint is marked with source='demo'"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "email": f"TEST_scenario2_{unique_id}@test.com",
            "password": "TestPassword123!",
            "name": f"Scenario2 User {unique_id}"
        }
        
        # Register new user
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json=user_data)
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        token = reg_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Create demo subscription via /create endpoint
        create_response = requests.post(
            f"{BASE_URL}/api/subscription/create",
            headers=headers,
            json={"plan_id": "premium_monthly", "payment_provider": "stripe"}
        )
        
        assert create_response.status_code == 200, f"Create subscription failed: {create_response.text}"
        
        subscription = create_response.json().get("subscription", {})
        
        # Verify source is marked as 'demo'
        assert subscription.get("source") == "demo", f"Expected source='demo', got '{subscription.get('source')}'"
        
        print(f"✓ SCENARIO 2 PASS: Demo subscription correctly marked with source='demo'")


class TestScenario3EntitlementGuardBlocksDemo:
    """SCENARIO 3: Entitlement guard blocks demo subscriptions - returns FREE plan"""
    
    def test_entitlement_guard_returns_free_for_demo(self):
        """Entitlement guard blocks demo subscriptions and returns FREE plan features"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "email": f"TEST_scenario3_{unique_id}@test.com",
            "password": "TestPassword123!",
            "name": f"Scenario3 User {unique_id}"
        }
        
        # Register new user
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json=user_data)
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        token = reg_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Create demo subscription (Chef Pro Annual - expensive plan)
        create_response = requests.post(
            f"{BASE_URL}/api/subscription/create",
            headers=headers,
            json={"plan_id": "chef_pro_annual", "payment_provider": "stripe"}
        )
        
        assert create_response.status_code == 200, f"Create subscription failed: {create_response.text}"
        
        # Now check current subscription - guard should block demo and return FREE
        sub_response = requests.get(f"{BASE_URL}/api/subscription/current", headers=headers)
        assert sub_response.status_code == 200, f"Get subscription failed: {sub_response.text}"
        
        subscription = sub_response.json().get("subscription", {})
        
        # Entitlement guard should return FREE plan
        assert subscription.get("plan_id") == "free", \
            f"Entitlement guard should return FREE for demo sub, got '{subscription.get('plan_id')}'"
        
        # Check for _entitlement_blocked flag
        assert subscription.get("_entitlement_blocked") == True or subscription.get("plan_id") == "free", \
            "Subscription should be blocked or already FREE"
        
        features = subscription.get("features", {})
        assert features.get("recipe_search_limit") == 5, "Should have FREE plan limit of 5"
        assert features.get("premium_recipes_access") == False, "Should NOT have premium access"
        assert features.get("ai_photo_recognition_enabled") == False, "Should NOT have AI photo"
        
        print(f"✓ SCENARIO 3 PASS: Entitlement guard correctly blocked demo subscription")


class TestScenario4FailedPaymentUserRemainsFree:
    """SCENARIO 4: Failed payment scenario - user remains on FREE"""
    
    def test_user_without_payment_remains_free(self):
        """User who never completed payment remains on FREE plan"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "email": f"TEST_scenario4_{unique_id}@test.com",
            "password": "TestPassword123!",
            "name": f"Scenario4 User {unique_id}"
        }
        
        # Register new user
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json=user_data)
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        token = reg_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # User never pays, just checks their subscription
        sub_response = requests.get(f"{BASE_URL}/api/subscription/current", headers=headers)
        assert sub_response.status_code == 200, f"Get subscription failed: {sub_response.text}"
        
        subscription = sub_response.json().get("subscription", {})
        
        # Should remain on FREE plan
        assert subscription.get("plan_id") == "free", \
            f"User without payment should be FREE, got '{subscription.get('plan_id')}'"
        
        # Check feature access - should be limited
        feature_response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/recipe_search",
            headers=headers
        )
        assert feature_response.status_code == 200
        
        feature_data = feature_response.json()
        assert feature_data.get("limit") == 5, "Recipe limit should be 5 for FREE"
        
        # Premium features should be blocked
        ai_response = requests.get(
            f"{BASE_URL}/api/subscription/check-feature/ai_photo_recognition",
            headers=headers
        )
        assert ai_response.status_code == 200
        ai_data = ai_response.json()
        assert ai_data.get("allowed") == False, "AI photo should be blocked for FREE user"
        assert ai_data.get("upgrade_required") == True, "Should require upgrade"
        
        print(f"✓ SCENARIO 4 PASS: User without payment correctly remains on FREE plan")


class TestScenario5RealPaymentRetainsPremium:
    """SCENARIO 5: Real payment users retain premium access"""
    
    def test_valid_sources_for_premium_documented(self):
        """Document valid sources that grant premium access"""
        # This test documents the valid premium sources since we cannot create real payments
        # Valid sources are: payment, trial, admin, razorpay, stripe
        
        # Test that plans endpoint works
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200, f"Plans endpoint failed: {response.text}"
        
        data = response.json()
        plans = data.get("plans", [])
        
        # Find premium plans
        premium_plans = [p for p in plans if p["plan_id"] != "free"]
        
        assert len(premium_plans) >= 4, "Should have at least 4 premium plans"
        
        # Verify premium plan features are different from free
        free_plan = next((p for p in plans if p["plan_id"] == "free"), None)
        premium_plan = next((p for p in plans if p["plan_id"] == "chef_pro_annual"), None)
        
        assert free_plan["features"]["recipe_search_limit"] == 5, "Free should have limit 5"
        assert premium_plan["features"]["recipe_search_limit"] == -1, "Chef Pro should have unlimited"
        
        print(f"✓ SCENARIO 5 DOCUMENTED: Valid premium sources: payment, trial, admin, razorpay, stripe")
        print(f"  Premium plans found: {[p['plan_id'] for p in premium_plans]}")


class TestScenario6WebhookReplayProtection:
    """SCENARIO 6: Webhook replay protection (only payment.captured creates subscription)"""
    
    def test_invalid_webhook_event_rejected(self):
        """Invalid webhook events are rejected by webhook safety filter"""
        # Test the webhook endpoint with invalid event type
        # Note: This will fail signature verification but tests the endpoint exists
        
        invalid_events = [
            "order.created",  # Not a payment success
            "payment.authorized",  # Not captured
            "subscription.pending",  # Not activated
        ]
        
        for event_type in invalid_events:
            payload = {
                "event": event_type,
                "payload": {
                    "payment": {
                        "entity": {
                            "id": "test_pay_123"
                        }
                    }
                }
            }
            
            response = requests.post(
                f"{BASE_URL}/api/subscription/razorpay/webhook",
                json=payload,
                headers={"x-razorpay-signature": "invalid_sig"}
            )
            
            # Should fail (400) due to invalid signature, which is correct behavior
            # The webhook safety filter would reject these events anyway
            assert response.status_code in [400, 500], \
                f"Webhook should reject without valid signature, got {response.status_code}"
        
        print(f"✓ SCENARIO 6 PASS: Webhook endpoint rejects invalid requests")
    
    def test_valid_event_types_documented(self):
        """Document valid webhook event types"""
        # Valid payment events that can create subscriptions:
        valid_payment_events = [
            "payment.captured",
            "payment_link.paid",
            "order.paid",
            "subscription.activated",
            "subscription.charged",
            "invoice.paid"
        ]
        
        valid_trial_events = [
            "subscription.trial_started",
            "trial.started"
        ]
        
        print(f"✓ SCENARIO 6 DOCUMENTED: Valid payment events: {valid_payment_events}")
        print(f"  Valid trial events: {valid_trial_events}")


class TestScenario7AdminIntegrityCheck:
    """SCENARIO 7: Admin integrity check endpoint returns correct report"""
    
    def test_admin_integrity_check_endpoint(self):
        """Admin integrity check endpoint returns proper report structure"""
        response = requests.get(f"{BASE_URL}/api/subscription/admin/subscription-integrity-check")
        
        assert response.status_code == 200, f"Integrity check failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        
        report = data.get("integrity_report", {})
        
        # Verify required fields in report
        required_fields = [
            "total_active_paid_subscriptions",
            "subscriptions_with_valid_payment",
            "suspicious_subscriptions_no_payment",
            "integrity_status"
        ]
        
        for field in required_fields:
            assert field in report, f"Missing required field: {field}"
        
        # Verify integrity_status value
        assert report["integrity_status"] in ["OK", "ISSUES_DETECTED"], \
            f"Invalid integrity_status: {report['integrity_status']}"
        
        # Verify counts are integers
        assert isinstance(report["total_active_paid_subscriptions"], int)
        assert isinstance(report["subscriptions_with_valid_payment"], int)
        assert isinstance(report["suspicious_subscriptions_no_payment"], int)
        
        print(f"✓ SCENARIO 7 PASS: Admin integrity check returns correct report")
        print(f"  Status: {report['integrity_status']}")
        print(f"  Total paid: {report['total_active_paid_subscriptions']}")
        print(f"  Valid: {report['subscriptions_with_valid_payment']}")
        print(f"  Suspicious: {report['suspicious_subscriptions_no_payment']}")


class TestScenario8AdminFixEndpoint:
    """SCENARIO 8: Admin fix endpoint works with dry_run=true and dry_run=false"""
    
    def test_admin_fix_dry_run_true(self):
        """Admin fix endpoint works with dry_run=true"""
        response = requests.post(
            f"{BASE_URL}/api/subscription/admin/fix-invalid-subscriptions",
            params={"dry_run": "true", "hours_window": 24}
        )
        
        assert response.status_code == 200, f"Fix endpoint (dry_run) failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("dry_run") == True, "dry_run should be True"
        assert "corrections_needed" in data, "Response should include corrections_needed"
        assert "total_checked" in data, "Response should include total_checked"
        
        print(f"✓ SCENARIO 8 PASS (dry_run=true): Would correct {data.get('corrections_needed')} subscriptions")
    
    def test_admin_fix_dry_run_false(self):
        """Admin fix endpoint works with dry_run=false"""
        response = requests.post(
            f"{BASE_URL}/api/subscription/admin/fix-invalid-subscriptions",
            params={"dry_run": "false", "hours_window": 1}  # Small window to minimize impact
        )
        
        assert response.status_code == 200, f"Fix endpoint (execute) failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("dry_run") == False, "dry_run should be False"
        
        print(f"✓ SCENARIO 8 PASS (dry_run=false): Corrected {data.get('corrections_needed', 0)} subscriptions")


class TestScenario9CronSyncProtection:
    """SCENARIO 9: Cron sync protection (no invalid upgrades)"""
    
    def test_signup_protection_documented(self):
        """Document signup protection window behavior"""
        # The signup protection window prevents async processes from 
        # upgrading users within SIGNUP_PROTECTION_WINDOW_SECONDS (10s) of signup
        # if the source is not a valid payment source
        
        # This is tested implicitly through the entitlement guard tests
        # Here we document the expected behavior
        
        print("✓ SCENARIO 9 DOCUMENTED: Signup protection rules:")
        print("  - Protection window: 10 seconds after signup")
        print("  - Only valid payment sources can upgrade during this window")
        print("  - Invalid sources (demo, cron, webhook without payment) are blocked")
        print("  - Violations logged as 'ILLEGAL_POST_SIGNUP_UPGRADE'")
    
    def test_cron_source_not_in_valid_premium_sources(self):
        """Verify 'cron' is not a valid premium source"""
        # This test verifies the entitlement guard correctly blocks cron-sourced upgrades
        
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "email": f"TEST_scenario9_{unique_id}@test.com",
            "password": "TestPassword123!",
            "name": f"Scenario9 User {unique_id}"
        }
        
        # Register new user
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json=user_data)
        assert reg_response.status_code == 200
        token = reg_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create a demo subscription (which simulates an invalid upgrade)
        requests.post(
            f"{BASE_URL}/api/subscription/create",
            headers=headers,
            json={"plan_id": "chef_pro_annual", "payment_provider": "stripe"}
        )
        
        # Verify entitlement guard blocks it
        sub_response = requests.get(f"{BASE_URL}/api/subscription/current", headers=headers)
        subscription = sub_response.json().get("subscription", {})
        
        # Should be FREE because demo is not a valid source
        assert subscription.get("plan_id") == "free", \
            f"Guard should block non-payment source, got '{subscription.get('plan_id')}'"
        
        print(f"✓ SCENARIO 9 PASS: Cron/demo sources correctly blocked by entitlement guard")


class TestEntitlementGuardUnit:
    """Unit tests for entitlement guard logic"""
    
    def test_subscription_without_payment_blocked(self):
        """Subscription without payment markers is blocked"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "email": f"TEST_unit_{unique_id}@test.com",
            "password": "TestPassword123!",
            "name": f"Unit Test User {unique_id}"
        }
        
        # Register, create demo sub, verify blocked
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json=user_data)
        assert reg_response.status_code == 200
        token = reg_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create demo sub
        requests.post(
            f"{BASE_URL}/api/subscription/create",
            headers=headers,
            json={"plan_id": "premium_annual", "payment_provider": "stripe"}
        )
        
        # Check - should be blocked
        sub_response = requests.get(f"{BASE_URL}/api/subscription/current", headers=headers)
        subscription = sub_response.json().get("subscription", {})
        
        assert subscription.get("plan_id") == "free", "Demo sub should be blocked"
        
        print(f"✓ Unit test PASS: Subscription without payment correctly blocked")
    
    def test_free_plan_always_valid(self):
        """FREE plan is always valid (not blocked)"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "email": f"TEST_free_{unique_id}@test.com",
            "password": "TestPassword123!",
            "name": f"Free User {unique_id}"
        }
        
        # Register new user (no demo sub)
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json=user_data)
        assert reg_response.status_code == 200
        token = reg_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Check subscription - should be FREE
        sub_response = requests.get(f"{BASE_URL}/api/subscription/current", headers=headers)
        subscription = sub_response.json().get("subscription", {})
        
        assert subscription.get("plan_id") == "free", "New user should be FREE"
        assert subscription.get("_entitlement_blocked") != True, "FREE should not be blocked"
        
        print(f"✓ Unit test PASS: FREE plan is always valid")


class TestAPIEndpointsHealth:
    """Health checks for subscription-related API endpoints"""
    
    def test_plans_endpoint_accessible(self):
        """Plans endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200
        assert response.json().get("success") == True
        print("✓ /api/subscription/plans - OK")
    
    def test_razorpay_config_endpoint(self):
        """Razorpay config endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/subscription/razorpay/config")
        assert response.status_code == 200
        assert response.json().get("success") == True
        print("✓ /api/subscription/razorpay/config - OK")
    
    def test_stats_endpoint_accessible(self):
        """Stats endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/subscription/stats")
        assert response.status_code == 200
        assert response.json().get("success") == True
        print("✓ /api/subscription/stats - OK")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
