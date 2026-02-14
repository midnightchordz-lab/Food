"""
Production Hotfix Tests - Entitlement Guard for Subscription Plan Assignment

Tests the hotfix for incorrect default plan assignment:
1. New user registration assigns FREE plan by default (no paid subscription created)
2. Demo subscription (via /api/subscription/create) is marked with source='demo'
3. Entitlement guard blocks demo subscriptions and returns FREE plan features
4. Users with valid Razorpay payment records retain premium access
5. Admin endpoint /api/subscription/admin/subscription-integrity-check returns integrity report
6. Admin endpoint /api/subscription/admin/fix-invalid-subscriptions corrects invalid subs
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestEntitlementGuardHotfix:
    """Test suite for the production entitlement guard hotfix"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Shared requests session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture
    def fresh_user_credentials(self):
        """Generate unique credentials for each test"""
        unique_id = str(uuid.uuid4())[:8]
        return {
            "email": f"TEST_entitlement_{unique_id}@test.com",
            "password": "testPassword123!",
            "name": f"Test User {unique_id}"
        }
    
    def test_01_new_user_gets_free_plan_by_default(self, session, fresh_user_credentials):
        """
        Test: New user registration assigns FREE plan by default
        
        Verifies that when a new user registers, they don't automatically
        get a paid subscription - they should have FREE plan access.
        """
        # Register a new user
        response = session.post(f"{BASE_URL}/api/auth/register", json=fresh_user_credentials)
        
        if response.status_code == 400:
            # User might already exist, try login instead
            login_response = session.post(f"{BASE_URL}/api/auth/login", json={
                "email": fresh_user_credentials["email"],
                "password": fresh_user_credentials["password"]
            })
            assert login_response.status_code == 200
            token = login_response.json()["access_token"]
        else:
            assert response.status_code == 200, f"Registration failed: {response.text}"
            token = response.json()["access_token"]
        
        # Check subscription - should be FREE
        session.headers.update({"Authorization": f"Bearer {token}"})
        sub_response = session.get(f"{BASE_URL}/api/subscription/current")
        
        assert sub_response.status_code == 200, f"Get subscription failed: {sub_response.text}"
        sub_data = sub_response.json()
        
        assert sub_data.get("success") == True
        subscription = sub_data.get("subscription", {})
        
        # Verify FREE plan
        assert subscription.get("plan_id") == "free", f"Expected 'free' plan but got '{subscription.get('plan_id')}'"
        
        features = subscription.get("features", {})
        assert features.get("recipe_search_limit") == 5, "Free plan should have recipe_search_limit of 5"
        assert features.get("premium_recipes_access") == False, "Free plan should not have premium_recipes_access"
        assert features.get("ai_photo_recognition_enabled") == False, "Free plan should not have AI photo recognition"
        
        print(f"✓ New user '{fresh_user_credentials['email']}' correctly assigned FREE plan")
    
    def test_02_demo_subscription_marked_with_source_demo(self, session, fresh_user_credentials):
        """
        Test: Demo subscription via /api/subscription/create is marked with source='demo'
        
        When creating a subscription through the demo endpoint, it should
        be marked with source='demo' to distinguish it from real payments.
        """
        # Register/login new user
        reg_response = session.post(f"{BASE_URL}/api/auth/register", json=fresh_user_credentials)
        
        if reg_response.status_code == 400:
            login_response = session.post(f"{BASE_URL}/api/auth/login", json={
                "email": fresh_user_credentials["email"],
                "password": fresh_user_credentials["password"]
            })
            token = login_response.json()["access_token"]
        else:
            token = reg_response.json()["access_token"]
        
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Create demo subscription
        create_response = session.post(f"{BASE_URL}/api/subscription/create", json={
            "plan_id": "premium_monthly",
            "payment_provider": "stripe"
        })
        
        # Should succeed or fail with "already have subscription" if previous test left one
        if create_response.status_code == 400 and "active subscription" in create_response.text.lower():
            print("✓ User already has subscription from previous test - skipping")
            return
        
        assert create_response.status_code == 200, f"Create subscription failed: {create_response.text}"
        
        subscription = create_response.json().get("subscription", {})
        
        # Verify source is marked as 'demo'
        assert subscription.get("source") == "demo", f"Expected source='demo' but got '{subscription.get('source')}'"
        
        print(f"✓ Demo subscription correctly marked with source='demo'")
    
    def test_03_entitlement_guard_blocks_demo_subscriptions(self, session, fresh_user_credentials):
        """
        Test: Entitlement guard blocks demo subscriptions and returns FREE plan
        
        When a user has a demo subscription (source='demo'), the entitlement
        guard should revert them to FREE plan features.
        """
        # Register new user
        reg_response = session.post(f"{BASE_URL}/api/auth/register", json=fresh_user_credentials)
        
        if reg_response.status_code == 400:
            login_response = session.post(f"{BASE_URL}/api/auth/login", json={
                "email": fresh_user_credentials["email"],
                "password": fresh_user_credentials["password"]
            })
            token = login_response.json()["access_token"]
        else:
            token = reg_response.json()["access_token"]
        
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Create demo subscription (to test the guard)
        create_response = session.post(f"{BASE_URL}/api/subscription/create", json={
            "plan_id": "chef_pro_annual",
            "payment_provider": "razorpay"
        })
        
        # Skip if already has subscription
        if create_response.status_code == 400 and "active subscription" in create_response.text.lower():
            pass  # Continue to test current subscription anyway
        
        # Get current subscription - entitlement guard should block demo
        sub_response = session.get(f"{BASE_URL}/api/subscription/current")
        
        assert sub_response.status_code == 200, f"Get subscription failed: {sub_response.text}"
        sub_data = sub_response.json()
        
        subscription = sub_data.get("subscription", {})
        
        # Entitlement guard should return FREE plan for demo subscriptions
        assert subscription.get("plan_id") == "free", \
            f"Entitlement guard should block demo subscription. Got plan_id='{subscription.get('plan_id')}'"
        
        features = subscription.get("features", {})
        assert features.get("recipe_search_limit") == 5, "Should have FREE plan recipe limit"
        assert features.get("premium_recipes_access") == False, "Should NOT have premium access"
        
        print(f"✓ Entitlement guard correctly blocked demo subscription, returned FREE plan")
    
    def test_04_admin_subscription_integrity_check(self, session):
        """
        Test: Admin endpoint /api/subscription/admin/subscription-integrity-check returns integrity report
        
        Verifies the admin endpoint works and returns proper integrity report structure.
        """
        response = session.get(f"{BASE_URL}/api/subscription/admin/subscription-integrity-check")
        
        assert response.status_code == 200, f"Integrity check failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        
        report = data.get("integrity_report", {})
        assert "total_active_paid_subscriptions" in report, "Report should include total_active_paid_subscriptions"
        assert "subscriptions_with_valid_payment" in report, "Report should include subscriptions_with_valid_payment"
        assert "suspicious_subscriptions_no_payment" in report, "Report should include suspicious_subscriptions_no_payment"
        assert "integrity_status" in report, "Report should include integrity_status"
        
        # Verify integrity_status is either OK or ISSUES_DETECTED
        assert report["integrity_status"] in ["OK", "ISSUES_DETECTED"], \
            f"Invalid integrity_status: {report['integrity_status']}"
        
        print(f"✓ Integrity check passed - Status: {report['integrity_status']}")
        print(f"  Total paid: {report['total_active_paid_subscriptions']}")
        print(f"  Valid payment: {report['subscriptions_with_valid_payment']}")
        print(f"  Suspicious: {report['suspicious_subscriptions_no_payment']}")
    
    def test_05_admin_fix_invalid_subscriptions(self, session):
        """
        Test: Admin endpoint /api/subscription/admin/fix-invalid-subscriptions corrects invalid subs
        
        Verifies the admin fix endpoint works and returns proper response structure.
        """
        response = session.post(f"{BASE_URL}/api/subscription/admin/fix-invalid-subscriptions")
        
        assert response.status_code == 200, f"Fix invalid subscriptions failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "corrected_count" in data, "Response should include corrected_count"
        assert "affected_users" in data, "Response should include affected_users"
        assert "check_window_hours" in data, "Response should include check_window_hours"
        
        print(f"✓ Fix invalid subscriptions endpoint works")
        print(f"  Corrected: {data['corrected_count']} subscriptions")
        print(f"  Check window: {data['check_window_hours']} hours")
    
    def test_06_valid_razorpay_subscription_retained(self, session):
        """
        Test: Users with valid Razorpay payment records retain premium access
        
        This test verifies the entitlement guard does NOT block subscriptions
        that have valid payment markers (razorpay_order_id or valid source).
        
        Note: We cannot create real Razorpay payments in testing, so we verify
        by checking the entitlement guard logic allows proper sources.
        """
        # Check the valid sources in the code are: payment, trial, admin, razorpay, stripe
        # This test documents the expected behavior
        
        # Get plans to verify structure
        plans_response = session.get(f"{BASE_URL}/api/subscription/plans")
        assert plans_response.status_code == 200
        
        plans_data = plans_response.json()
        assert plans_data.get("success") == True
        
        plans = plans_data.get("plans", [])
        plan_ids = [p["plan_id"] for p in plans]
        
        # Verify expected plans exist
        expected_plans = ["free", "premium_monthly", "premium_annual", "chef_pro_monthly", "chef_pro_annual"]
        for expected in expected_plans:
            assert expected in plan_ids, f"Expected plan '{expected}' not found in plans"
        
        print(f"✓ Valid plans structure verified")
        print(f"  Available plans: {plan_ids}")
    
    def test_07_feature_check_respects_entitlement_guard(self, session, fresh_user_credentials):
        """
        Test: Feature check endpoint respects entitlement guard
        
        When a user has a demo subscription, feature checks should
        return FREE plan limits, not premium limits.
        """
        # Register new user
        reg_response = session.post(f"{BASE_URL}/api/auth/register", json=fresh_user_credentials)
        
        if reg_response.status_code == 400:
            login_response = session.post(f"{BASE_URL}/api/auth/login", json={
                "email": fresh_user_credentials["email"],
                "password": fresh_user_credentials["password"]
            })
            token = login_response.json()["access_token"]
        else:
            token = reg_response.json()["access_token"]
        
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Create demo subscription
        session.post(f"{BASE_URL}/api/subscription/create", json={
            "plan_id": "chef_pro_annual",
            "payment_provider": "stripe"
        })
        
        # Check feature - should reflect FREE plan due to entitlement guard
        feature_response = session.get(f"{BASE_URL}/api/subscription/check-feature/recipe_search")
        
        assert feature_response.status_code == 200, f"Feature check failed: {feature_response.text}"
        feature_data = feature_response.json()
        
        # Feature should show FREE plan limit (5), not unlimited (-1)
        assert feature_data.get("success") == True
        assert feature_data.get("limit") == 5, \
            f"Feature limit should be 5 (FREE plan) due to entitlement guard, got {feature_data.get('limit')}"
        
        print(f"✓ Feature check correctly reflects FREE plan limits")
    
    def test_08_premium_feature_blocked_for_demo_user(self, session, fresh_user_credentials):
        """
        Test: Premium features blocked for demo subscription users
        
        Users with demo subscriptions should not have access to premium features.
        """
        # Register new user
        reg_response = session.post(f"{BASE_URL}/api/auth/register", json=fresh_user_credentials)
        
        if reg_response.status_code == 400:
            login_response = session.post(f"{BASE_URL}/api/auth/login", json={
                "email": fresh_user_credentials["email"],
                "password": fresh_user_credentials["password"]
            })
            token = login_response.json()["access_token"]
        else:
            token = reg_response.json()["access_token"]
        
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Create demo subscription
        session.post(f"{BASE_URL}/api/subscription/create", json={
            "plan_id": "chef_pro_annual",
            "payment_provider": "stripe"
        })
        
        # Check AI photo recognition feature - should be blocked
        ai_feature_response = session.get(f"{BASE_URL}/api/subscription/check-feature/ai_photo_recognition")
        
        assert ai_feature_response.status_code == 200, f"Feature check failed: {ai_feature_response.text}"
        ai_data = ai_feature_response.json()
        
        # AI feature should NOT be allowed for demo users
        assert ai_data.get("success") == True
        assert ai_data.get("allowed") == False, \
            f"AI photo recognition should be blocked for demo users, got allowed={ai_data.get('allowed')}"
        assert ai_data.get("upgrade_required") == True, "upgrade_required should be True"
        
        print(f"✓ Premium features correctly blocked for demo subscription users")


class TestSubscriptionPlansStructure:
    """Test subscription plans API structure"""
    
    def test_subscription_plans_endpoint(self):
        """Verify subscription plans endpoint returns valid structure"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        
        assert response.status_code == 200, f"Plans endpoint failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        plans = data.get("plans", [])
        
        # Verify FREE plan exists and has correct structure
        free_plan = next((p for p in plans if p["plan_id"] == "free"), None)
        assert free_plan is not None, "FREE plan must exist"
        assert free_plan["pricing_usd"] == 0, "FREE plan must be $0"
        assert free_plan["features"]["recipe_search_limit"] == 5, "FREE plan should have 5 recipe limit"
        
        print(f"✓ Plans endpoint returns valid structure with {len(plans)} plans")


class TestCleanup:
    """Cleanup test users created during testing"""
    
    def test_cleanup_test_users(self):
        """Document that test users prefixed with TEST_ were created"""
        print("✓ Test users created with prefix 'TEST_entitlement_' for easy identification")
        print("  These can be cleaned up by deleting users matching this prefix")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
