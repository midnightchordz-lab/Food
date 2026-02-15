"""
Test Auto-Start Trial on Registration
Tests that new users automatically get a 7-day trial when they register
via email registration endpoint

Test Coverage:
- POST /api/auth/register - auto-starts trial and returns trial info
- User fields after registration: trial_active=true, entitlement_tier='trial'
- Registration response includes trial object with active=true, daysRemaining=7
- GET /api/trial/status - returns isActive=true, hasAccess=true for new user
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAutoStartTrialOnRegistration:
    """Test auto-start trial feature for new user registration"""
    
    @pytest.fixture(scope="class")
    def unique_test_email(self):
        """Generate unique email for each test run"""
        timestamp = int(time.time() * 1000)
        return f"test_autostart_{timestamp}@example.com"
    
    @pytest.fixture(scope="class")
    def registration_response(self, unique_test_email):
        """Register a new user and return the full response"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_test_email,
                "password": "testpass123",
                "name": f"AutoStart Test User",
                "dietary_restrictions": ["Vegetarian"],
                "cuisine_preferences": ["Italian"]
            }
        )
        return response
    
    def test_registration_returns_200(self, registration_response):
        """Test that registration returns 200 status code"""
        print(f"Registration status code: {registration_response.status_code}")
        print(f"Registration response: {registration_response.json()}")
        assert registration_response.status_code == 200, f"Expected 200, got {registration_response.status_code}: {registration_response.text}"
        print("✓ Registration returns 200 OK")
    
    def test_registration_returns_access_token(self, registration_response):
        """Test that registration returns access token"""
        data = registration_response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert data["access_token"], "access_token is empty"
        assert data["token_type"] == "bearer", f"Expected bearer token type, got {data.get('token_type')}"
        print(f"✓ Registration returns access_token (length: {len(data['access_token'])})")
    
    def test_registration_returns_user_data(self, registration_response, unique_test_email):
        """Test that registration returns user data"""
        data = registration_response.json()
        assert "user" in data, "Missing user in response"
        user = data["user"]
        assert user.get("email") == unique_test_email, f"Email mismatch: {user.get('email')}"
        assert user.get("name") == "AutoStart Test User", f"Name mismatch: {user.get('name')}"
        assert "id" in user, "Missing user id"
        print(f"✓ Registration returns user data with id: {user.get('id')}")
    
    def test_registration_returns_trial_info(self, registration_response):
        """Test that registration returns trial info object"""
        data = registration_response.json()
        assert "trial" in data, "Missing trial field in registration response"
        trial = data["trial"]
        assert trial is not None, "trial field is None - trial was not auto-started"
        print(f"✓ Registration returns trial info: {trial}")
    
    def test_trial_is_active(self, registration_response):
        """Test that trial.active is true in registration response"""
        data = registration_response.json()
        trial = data.get("trial")
        assert trial is not None, "trial field is None"
        assert trial.get("active") == True, f"Expected trial.active=true, got {trial.get('active')}"
        print("✓ Trial is active (trial.active=true)")
    
    def test_trial_days_remaining(self, registration_response):
        """Test that trial.daysRemaining is 7"""
        data = registration_response.json()
        trial = data.get("trial")
        assert trial is not None, "trial field is None"
        assert trial.get("daysRemaining") == 7, f"Expected daysRemaining=7, got {trial.get('daysRemaining')}"
        print("✓ Trial has 7 days remaining")
    
    def test_trial_ends_at_present(self, registration_response):
        """Test that trial.endsAt is present"""
        data = registration_response.json()
        trial = data.get("trial")
        assert trial is not None, "trial field is None"
        assert "endsAt" in trial, "Missing endsAt in trial info"
        assert trial.get("endsAt"), "endsAt is empty"
        print(f"✓ Trial endsAt: {trial.get('endsAt')}")
    
    def test_trial_message_present(self, registration_response):
        """Test that trial has welcome message"""
        data = registration_response.json()
        trial = data.get("trial")
        assert trial is not None, "trial field is None"
        assert "message" in trial, "Missing message in trial info"
        assert "trial" in trial.get("message", "").lower() or "7-day" in trial.get("message", "").lower() or "premium" in trial.get("message", "").lower(), \
            f"Unexpected trial message: {trial.get('message')}"
        print(f"✓ Trial message: {trial.get('message')}")
    
    def test_user_trial_active_field(self, registration_response):
        """Test that user.trial_active is true after registration"""
        data = registration_response.json()
        user = data.get("user")
        assert user is not None, "user field is None"
        assert user.get("trial_active") == True, f"Expected user.trial_active=true, got {user.get('trial_active')}"
        print("✓ User trial_active=true")
    
    def test_user_entitlement_tier(self, registration_response):
        """Test that user.entitlement_tier is 'trial' after registration"""
        data = registration_response.json()
        user = data.get("user")
        assert user is not None, "user field is None"
        assert user.get("entitlement_tier") == "trial", f"Expected user.entitlement_tier='trial', got {user.get('entitlement_tier')}"
        print("✓ User entitlement_tier='trial'")


class TestTrialStatusAfterRegistration:
    """Test /api/trial/status endpoint for newly registered user"""
    
    @pytest.fixture(scope="class")
    def registered_user(self):
        """Register a new user and return token + user data"""
        timestamp = int(time.time() * 1000)
        email = f"test_status_{timestamp}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": "testpass123",
                "name": "Status Test User",
                "dietary_restrictions": [],
                "cuisine_preferences": []
            }
        )
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        
        return {
            "token": data["access_token"],
            "user": data["user"],
            "trial": data.get("trial"),
            "email": email
        }
    
    def test_trial_status_endpoint(self, registered_user):
        """Test GET /api/trial/status returns correct status for new user"""
        headers = {"Authorization": f"Bearer {registered_user['token']}"}
        
        response = requests.get(
            f"{BASE_URL}/api/trial/status",
            headers=headers
        )
        
        print(f"Trial status response: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=true"
        assert "trial" in data, "Missing trial in response"
        
        trial = data["trial"]
        assert trial.get("isActive") == True, f"Expected isActive=true, got {trial.get('isActive')}"
        assert trial.get("hasAccess") == True, f"Expected hasAccess=true, got {trial.get('hasAccess')}"
        assert trial.get("daysRemaining") == 7, f"Expected daysRemaining=7, got {trial.get('daysRemaining')}"
        assert trial.get("plan") == "trial", f"Expected plan='trial', got {trial.get('plan')}"
        
        print("✓ GET /api/trial/status returns isActive=true, hasAccess=true, daysRemaining=7")
    
    def test_check_access_endpoint(self, registered_user):
        """Test GET /api/trial/check-access returns hasAccess=true for new user"""
        headers = {"Authorization": f"Bearer {registered_user['token']}"}
        
        response = requests.get(
            f"{BASE_URL}/api/trial/check-access",
            headers=headers
        )
        
        print(f"Check access response: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=true"
        assert data.get("hasAccess") == True, "Expected hasAccess=true for new user with trial"
        
        print("✓ GET /api/trial/check-access returns hasAccess=true for newly registered user")


class TestDuplicateRegistration:
    """Test that duplicate email registration is rejected"""
    
    def test_duplicate_email_rejected(self):
        """Test that registering with same email twice fails"""
        timestamp = int(time.time() * 1000)
        email = f"test_duplicate_{timestamp}@example.com"
        
        # First registration
        response1 = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": "testpass123",
                "name": "First User",
                "dietary_restrictions": [],
                "cuisine_preferences": []
            }
        )
        assert response1.status_code == 200, f"First registration failed: {response1.text}"
        print(f"✓ First registration successful for {email}")
        
        # Second registration with same email
        response2 = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": "testpass123",
                "name": "Second User",
                "dietary_restrictions": [],
                "cuisine_preferences": []
            }
        )
        assert response2.status_code == 400, f"Expected 400 for duplicate email, got {response2.status_code}"
        assert "already registered" in response2.text.lower(), f"Unexpected error: {response2.text}"
        print(f"✓ Duplicate registration rejected with 400")


class TestRegistrationResponseStructure:
    """Test the full response structure of registration endpoint"""
    
    def test_response_structure(self):
        """Test that registration response has correct structure"""
        timestamp = int(time.time() * 1000)
        email = f"test_structure_{timestamp}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": "testpass123",
                "name": "Structure Test User",
                "dietary_restrictions": ["Vegan"],
                "cuisine_preferences": ["Mexican", "Thai"]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Top level fields
        assert "access_token" in data, "Missing access_token"
        assert "token_type" in data, "Missing token_type"
        assert "user" in data, "Missing user"
        assert "trial" in data, "Missing trial"
        
        # User fields
        user = data["user"]
        expected_user_fields = ["id", "email", "name", "trial_active", "entitlement_tier"]
        for field in expected_user_fields:
            assert field in user, f"Missing user.{field}"
        
        # Trial fields
        trial = data["trial"]
        expected_trial_fields = ["active", "endsAt", "daysRemaining", "message"]
        for field in expected_trial_fields:
            assert field in trial, f"Missing trial.{field}"
        
        print(f"✓ Response structure is correct with all expected fields")
        print(f"  - access_token: present")
        print(f"  - token_type: {data['token_type']}")
        print(f"  - user.id: {user['id']}")
        print(f"  - user.email: {user['email']}")
        print(f"  - user.trial_active: {user['trial_active']}")
        print(f"  - user.entitlement_tier: {user['entitlement_tier']}")
        print(f"  - trial.active: {trial['active']}")
        print(f"  - trial.daysRemaining: {trial['daysRemaining']}")
        print(f"  - trial.endsAt: {trial['endsAt']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
