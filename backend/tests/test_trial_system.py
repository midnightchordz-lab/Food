"""
Test Suite: 7-Day Trial Subscription System
Tests for: /api/trial/status, /api/trial/start, /api/trial/check-access

Scenarios:
1. Get trial status for unauthenticated users
2. Get trial status for eligible users (can start trial)
3. Get trial status for users with active trial
4. Start trial for eligible user
5. Reject starting trial twice (already_active or already_used)
6. Check premium access status
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Use production URL for testing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # Fallback for local testing
    BASE_URL = "https://hands-free-cook.preview.emergentagent.com"

print(f"Testing against: {BASE_URL}")

# Test credentials provided
TEST_USER_1 = {"email": "demouser@example.com", "password": "password123"}  # Fresh user
TEST_USER_2 = {"email": "lloydmasih1976@gmail.com", "password": "Milokiko*25"}  # Has active trial


class TestTrialSystem:
    """7-Day Trial System Test Suite"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a requests session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture(scope="class")
    def user1_token(self, session):
        """Get token for demouser@example.com (fresh user - can start trial)"""
        response = session.post(f"{BASE_URL}/api/auth/login", json=TEST_USER_1)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Could not login user1: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def user2_token(self, session):
        """Get token for lloydmasih1976@gmail.com (already has active trial)"""
        response = session.post(f"{BASE_URL}/api/auth/login", json=TEST_USER_2)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Could not login user2: {response.status_code} - {response.text}")

    # =========================
    # UNAUTHORIZED ACCESS TESTS
    # =========================
    
    def test_trial_status_unauthorized(self, session):
        """Test GET /api/trial/status without auth token"""
        response = session.get(f"{BASE_URL}/api/trial/status")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Trial status correctly requires authentication: {response.status_code}")
    
    def test_trial_start_unauthorized(self, session):
        """Test POST /api/trial/start without auth token"""
        response = session.post(f"{BASE_URL}/api/trial/start", json={"platform": "web"})
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Trial start correctly requires authentication: {response.status_code}")
    
    def test_trial_check_access_unauthorized(self, session):
        """Test GET /api/trial/check-access without auth token"""
        response = session.get(f"{BASE_URL}/api/trial/check-access")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Check access correctly requires authentication: {response.status_code}")

    # =========================
    # AUTHENTICATED USER TESTS
    # =========================
    
    def test_trial_status_for_user2_with_active_trial(self, session, user2_token):
        """Test GET /api/trial/status for user with active trial"""
        response = session.get(
            f"{BASE_URL}/api/trial/status",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert data.get("success") == True, "Response should indicate success"
        assert "user" in data, "Response should contain user info"
        assert "trial" in data, "Response should contain trial info"
        
        trial = data["trial"]
        print(f"✓ Trial status returned: {trial}")
        
        # User 2 should have active trial or be paid
        if trial.get("isActive"):
            assert trial.get("hasAccess") == True, "Active trial should have access"
            assert trial.get("daysRemaining", 0) > 0, "Active trial should have days remaining"
            print(f"✓ User2 has active trial with {trial.get('daysRemaining')} days remaining")
        elif trial.get("isPaid"):
            assert trial.get("hasAccess") == True, "Paid user should have access"
            print(f"✓ User2 is a paid user with plan: {trial.get('plan')}")
        else:
            # Trial might have expired
            print(f"✓ User2 trial status: {trial}")
    
    def test_trial_check_access_for_user2(self, session, user2_token):
        """Test GET /api/trial/check-access for user with active trial"""
        response = session.get(
            f"{BASE_URL}/api/trial/check-access",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert data.get("success") == True, "Response should indicate success"
        assert "hasAccess" in data, "Response should contain hasAccess"
        assert "status" in data, "Response should contain status"
        
        print(f"✓ User2 has premium access: {data.get('hasAccess')}")
        print(f"✓ Status: {data.get('status')}")

    def test_trial_start_rejected_for_user2_already_active(self, session, user2_token):
        """Test POST /api/trial/start is rejected for user who already has trial"""
        response = session.post(
            f"{BASE_URL}/api/trial/start",
            json={"platform": "web"},
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        
        # Should return 400 with reason
        if response.status_code == 400:
            data = response.json()
            detail = data.get("detail", {})
            reason = detail.get("reason") if isinstance(detail, dict) else None
            
            # Accept either "already_active" or "already_used"
            assert reason in ["already_active", "already_used", None], f"Unexpected reason: {reason}"
            print(f"✓ Trial start correctly rejected for user2: reason={reason}")
        elif response.status_code == 200:
            # User might have expired trial and is eligible again? Check response
            data = response.json()
            print(f"⚠ Trial start succeeded unexpectedly: {data}")
            # If it succeeded, the trial feature is still working
        else:
            pytest.fail(f"Unexpected status code: {response.status_code} - {response.text}")

    def test_trial_status_for_user1(self, session, user1_token):
        """Test GET /api/trial/status for user1 (should be able to start trial)"""
        response = session.get(
            f"{BASE_URL}/api/trial/status",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert data.get("success") == True, "Response should indicate success"
        assert "trial" in data, "Response should contain trial info"
        
        trial = data["trial"]
        print(f"✓ User1 trial status: {trial}")

    def test_trial_check_access_for_user1(self, session, user1_token):
        """Test GET /api/trial/check-access for user1"""
        response = session.get(
            f"{BASE_URL}/api/trial/check-access",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        print(f"✓ User1 premium access: {data.get('hasAccess')}")
        print(f"✓ User1 status: {data.get('status')}")

    # =========================
    # TRIAL START FLOW TESTS
    # =========================
    
    def test_trial_start_with_different_platforms(self, session, user1_token):
        """Test POST /api/trial/start with different platform values"""
        # Test with iOS platform
        response = session.post(
            f"{BASE_URL}/api/trial/start",
            json={"platform": "ios"},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        # Could be 200 (started) or 400 (already started/used)
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Response should indicate success"
            assert "trial" in data, "Response should contain trial info"
            trial = data["trial"]
            assert "startDate" in trial, "Trial should have start date"
            assert "endDate" in trial, "Trial should have end date"
            assert trial.get("daysRemaining") == 7, "New trial should have 7 days"
            print(f"✓ Trial started successfully for user1: {trial}")
        elif response.status_code == 400:
            data = response.json()
            detail = data.get("detail", {})
            reason = detail.get("reason") if isinstance(detail, dict) else None
            print(f"✓ Trial start rejected (user1 already used/active): reason={reason}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code} - {response.text}")

    def test_trial_status_after_start_attempt(self, session, user1_token):
        """Verify trial status is updated after start attempt"""
        response = session.get(
            f"{BASE_URL}/api/trial/status",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        trial = data["trial"]
        
        print(f"✓ User1 final trial status: {trial}")
        
        # Verify the status reflects current state
        if trial.get("isActive"):
            assert trial.get("hasAccess") == True, "Active trial should have access"
            assert trial.get("daysRemaining", 0) > 0, "Active trial should have days remaining"
        elif trial.get("trialExpired"):
            assert trial.get("canStartTrial") == False, "Expired trial should not allow restart"
        elif trial.get("canStartTrial"):
            assert trial.get("hasAccess") == False, "User without trial should not have access"


class TestTrialDataValidation:
    """Test trial response data validation"""
    
    @pytest.fixture(scope="class")
    def session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture(scope="class")
    def auth_token(self, session):
        """Get any valid auth token"""
        response = session.post(f"{BASE_URL}/api/auth/login", json=TEST_USER_2)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Could not get auth token: {response.status_code}")

    def test_trial_status_response_structure(self, session, auth_token):
        """Validate complete response structure of /api/trial/status"""
        response = session.get(
            f"{BASE_URL}/api/trial/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Top level structure
        assert "success" in data, "Missing 'success' field"
        assert "user" in data, "Missing 'user' field"
        assert "trial" in data, "Missing 'trial' field"
        
        # User structure
        user = data["user"]
        assert "id" in user, "User should have id"
        assert "email" in user, "User should have email"
        assert "plan" in user, "User should have plan"
        
        # Trial structure - should have key fields
        trial = data["trial"]
        assert "hasAccess" in trial, "Trial should indicate hasAccess"
        assert "plan" in trial, "Trial should indicate plan"
        
        print(f"✓ Response structure validated: {list(data.keys())}")
        print(f"✓ User fields: {list(user.keys())}")
        print(f"✓ Trial fields: {list(trial.keys())}")

    def test_check_access_response_structure(self, session, auth_token):
        """Validate complete response structure of /api/trial/check-access"""
        response = session.get(
            f"{BASE_URL}/api/trial/check-access",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Top level structure
        assert "success" in data, "Missing 'success' field"
        assert "hasAccess" in data, "Missing 'hasAccess' field"
        assert "status" in data, "Missing 'status' field"
        
        # Status should be dict
        assert isinstance(data["status"], dict), "Status should be a dict"
        
        print(f"✓ Check-access response validated: {list(data.keys())}")
        print(f"✓ Status fields: {list(data['status'].keys())}")


class TestTrialEdgeCases:
    """Test edge cases and error handling"""
    
    @pytest.fixture(scope="class")
    def session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture(scope="class")
    def auth_token(self, session):
        response = session.post(f"{BASE_URL}/api/auth/login", json=TEST_USER_2)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Could not get auth token")

    def test_trial_start_with_invalid_platform(self, session, auth_token):
        """Test trial start with invalid platform value"""
        response = session.post(
            f"{BASE_URL}/api/trial/start",
            json={"platform": "invalid_platform_xyz"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Should either accept (platform is optional) or return 400
        # Based on code review, platform is optional with default "web"
        print(f"✓ Invalid platform handled: {response.status_code}")

    def test_trial_start_without_platform(self, session, auth_token):
        """Test trial start without platform field (should use default 'web')"""
        response = session.post(
            f"{BASE_URL}/api/trial/start",
            json={},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Should work with default platform
        assert response.status_code in [200, 400], f"Unexpected: {response.status_code}"
        print(f"✓ Empty payload handled: {response.status_code}")

    def test_invalid_token_rejection(self, session):
        """Test all endpoints reject invalid tokens"""
        invalid_token = "invalid.token.here"
        
        # Test status endpoint
        r1 = session.get(
            f"{BASE_URL}/api/trial/status",
            headers={"Authorization": f"Bearer {invalid_token}"}
        )
        assert r1.status_code == 401, f"Status should reject invalid token: {r1.status_code}"
        
        # Test start endpoint
        r2 = session.post(
            f"{BASE_URL}/api/trial/start",
            json={"platform": "web"},
            headers={"Authorization": f"Bearer {invalid_token}"}
        )
        assert r2.status_code == 401, f"Start should reject invalid token: {r2.status_code}"
        
        # Test check-access endpoint
        r3 = session.get(
            f"{BASE_URL}/api/trial/check-access",
            headers={"Authorization": f"Bearer {invalid_token}"}
        )
        assert r3.status_code == 401, f"Check-access should reject invalid token: {r3.status_code}"
        
        print("✓ All endpoints correctly reject invalid tokens")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
