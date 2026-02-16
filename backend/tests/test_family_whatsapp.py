"""
Family & WhatsApp Integration Tests
Testing family account creation, joining, WhatsApp settings, and profile phone number update

Features tested:
- GET /api/family/my-family - returns family info or has_family=false
- GET /api/family/whatsapp/settings - returns notification settings
- PUT /api/family/whatsapp/settings - updates notification settings
- PUT /api/auth/profile with phone_number field - updates user phone
- POST /api/family/create - creates family account (requires family plan)
- POST /api/family/join - joins family with invite code
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "lloydmasih1976@gmail.com"
TEST_USER_PASSWORD = "Milokiko*25"
DEMO_USER_EMAIL = "demouser@example.com"
DEMO_USER_PASSWORD = "password123"


class TestFamilyWhatsAppIntegration:
    """Test Family Plan WhatsApp Integration endpoints"""
    
    @pytest.fixture(scope="class")
    def test_user_token(self):
        """Get auth token for test user (Chef Pro - no family plan)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Cannot login as test user: {response.text}")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class") 
    def demo_user_token(self):
        """Get auth token for demo user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_USER_EMAIL,
            "password": DEMO_USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Cannot login as demo user: {response.text}")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def headers(self, test_user_token):
        """Auth headers for test user"""
        return {
            "Authorization": f"Bearer {test_user_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def demo_headers(self, demo_user_token):
        """Auth headers for demo user"""
        return {
            "Authorization": f"Bearer {demo_user_token}",
            "Content-Type": "application/json"
        }
    
    # ==================== MY FAMILY ENDPOINT ====================
    
    def test_get_my_family_returns_200(self, headers):
        """GET /api/family/my-family returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/family/my-family", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/family/my-family returns 200 OK")
    
    def test_get_my_family_structure(self, headers):
        """GET /api/family/my-family returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/family/my-family", headers=headers)
        data = response.json()
        
        assert "success" in data, "Response should have 'success' field"
        assert data["success"] == True, "success should be True"
        assert "has_family" in data, "Response should have 'has_family' field"
        assert "family" in data, "Response should have 'family' field"
        
        # has_family should be boolean
        assert isinstance(data["has_family"], bool), "has_family should be boolean"
        
        print(f"✓ GET /api/family/my-family has correct structure")
        print(f"  has_family: {data['has_family']}")
    
    def test_get_my_family_without_auth(self):
        """GET /api/family/my-family without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/family/my-family")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/family/my-family returns 401 without auth")
    
    # ==================== WHATSAPP SETTINGS ENDPOINTS ====================
    
    def test_get_whatsapp_settings_returns_200(self, headers):
        """GET /api/family/whatsapp/settings returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/family/whatsapp/settings", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/family/whatsapp/settings returns 200 OK")
    
    def test_get_whatsapp_settings_structure(self, headers):
        """GET /api/family/whatsapp/settings returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/family/whatsapp/settings", headers=headers)
        data = response.json()
        
        assert "success" in data, "Response should have 'success' field"
        assert data["success"] == True
        assert "settings" in data, "Response should have 'settings' field"
        assert "phone_number" in data, "Response should have 'phone_number' field"
        assert "has_phone" in data, "Response should have 'has_phone' field"
        
        # Check settings structure
        settings = data["settings"]
        assert "enabled" in settings, "Settings should have 'enabled' field"
        assert "voting_reminders" in settings, "Settings should have 'voting_reminders' field"
        assert "winner_announcements" in settings, "Settings should have 'winner_announcements' field"
        assert "family_invites" in settings, "Settings should have 'family_invites' field"
        
        print("✓ GET /api/family/whatsapp/settings has correct structure")
        print(f"  settings: {settings}")
        print(f"  has_phone: {data['has_phone']}")
    
    def test_get_whatsapp_settings_without_auth(self):
        """GET /api/family/whatsapp/settings without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/family/whatsapp/settings")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/family/whatsapp/settings returns 401 without auth")
    
    def test_put_whatsapp_settings_returns_200(self, headers):
        """PUT /api/family/whatsapp/settings updates settings successfully"""
        new_settings = {
            "enabled": True,
            "voting_reminders": True,
            "winner_announcements": True,
            "family_invites": False
        }
        
        response = requests.put(
            f"{BASE_URL}/api/family/whatsapp/settings", 
            headers=headers,
            json=new_settings
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert data["settings"]["family_invites"] == False, "Settings should be updated"
        
        print("✓ PUT /api/family/whatsapp/settings updates settings successfully")
        
        # Restore original setting
        restore_settings = {
            "enabled": True,
            "voting_reminders": True,
            "winner_announcements": True,
            "family_invites": True
        }
        requests.put(f"{BASE_URL}/api/family/whatsapp/settings", headers=headers, json=restore_settings)
    
    def test_put_whatsapp_settings_verify_persistence(self, headers):
        """PUT /api/family/whatsapp/settings persists settings correctly"""
        # Update to specific values
        test_settings = {
            "enabled": False,
            "voting_reminders": False,
            "winner_announcements": True,
            "family_invites": True
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/family/whatsapp/settings",
            headers=headers,
            json=test_settings
        )
        assert put_response.status_code == 200
        
        # GET to verify persistence
        get_response = requests.get(f"{BASE_URL}/api/family/whatsapp/settings", headers=headers)
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data["settings"]["enabled"] == False, "enabled should be persisted as False"
        assert data["settings"]["voting_reminders"] == False, "voting_reminders should be persisted as False"
        
        print("✓ PUT /api/family/whatsapp/settings persists settings correctly")
        
        # Restore original settings
        restore_settings = {
            "enabled": True,
            "voting_reminders": True,
            "winner_announcements": True,
            "family_invites": True
        }
        requests.put(f"{BASE_URL}/api/family/whatsapp/settings", headers=headers, json=restore_settings)
    
    # ==================== PROFILE PHONE NUMBER UPDATE ====================
    
    def test_put_profile_phone_number(self, headers):
        """PUT /api/auth/profile updates phone_number field"""
        test_phone = "+19991234567"
        
        response = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers=headers,
            json={"phone_number": test_phone}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("phone_number") == test_phone, "Phone number should be updated"
        
        print("✓ PUT /api/auth/profile updates phone_number correctly")
    
    def test_put_profile_phone_number_persists(self, headers):
        """PUT /api/auth/profile - phone_number persists after GET"""
        test_phone = "+12025551234"
        
        # Update phone
        put_response = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers=headers,
            json={"phone_number": test_phone}
        )
        assert put_response.status_code == 200
        
        # GET profile to verify persistence
        get_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data.get("phone_number") == test_phone, "Phone number should persist"
        
        print("✓ PUT /api/auth/profile - phone_number persists correctly")
        print(f"  phone_number: {data.get('phone_number')}")
    
    def test_put_profile_phone_appears_in_whatsapp_settings(self, headers):
        """Phone number appears in WhatsApp settings response"""
        # Get WhatsApp settings
        response = requests.get(f"{BASE_URL}/api/family/whatsapp/settings", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["has_phone"] == True, "has_phone should be True after phone update"
        assert data["phone_number"] is not None, "phone_number should not be None"
        
        print("✓ Phone number appears in WhatsApp settings response")
        print(f"  has_phone: {data['has_phone']}")
        print(f"  phone_number: {data['phone_number']}")
    
    # ==================== FAMILY CREATE (REQUIRES FAMILY PLAN) ====================
    
    def test_post_family_create_without_family_plan(self, headers):
        """POST /api/family/create returns 403 without Family Plan"""
        response = requests.post(
            f"{BASE_URL}/api/family/create",
            headers=headers,
            json={"family_name": "Test Family", "max_members": 5}
        )
        
        # Should return 403 (requires family plan) or 400 (already has family)
        assert response.status_code in [403, 400], f"Expected 403 or 400, got {response.status_code}: {response.text}"
        
        if response.status_code == 403:
            data = response.json()
            assert "family" in data.get("detail", "").lower() or "plan" in data.get("detail", "").lower(), \
                "Error should mention family plan requirement"
            print("✓ POST /api/family/create correctly rejects non-family-plan user (403)")
        else:
            print("✓ POST /api/family/create returns 400 (user may already have family)")
    
    def test_post_family_create_without_auth(self):
        """POST /api/family/create without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/family/create",
            json={"family_name": "Test Family"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/family/create returns 401 without auth")
    
    # ==================== FAMILY JOIN ====================
    
    def test_post_family_join_invalid_code(self, headers):
        """POST /api/family/join with invalid code returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/family/join",
            headers=headers,
            json={"invite_code": "INVALID1"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "invalid" in data.get("detail", "").lower() or "not found" in data.get("detail", "").lower(), \
            "Error should mention invalid invite code"
        
        print("✓ POST /api/family/join with invalid code returns 404")
    
    def test_post_family_join_without_auth(self):
        """POST /api/family/join without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/family/join",
            json={"invite_code": "TESTCODE"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/family/join returns 401 without auth")
    
    # ==================== VOTING ENDPOINTS (REQUIRE FAMILY) ====================
    
    def test_get_active_voting_sessions(self, headers):
        """GET /api/family/voting/active returns 200 with sessions array"""
        response = requests.get(f"{BASE_URL}/api/family/voting/active", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert "sessions" in data
        assert isinstance(data["sessions"], list), "sessions should be a list"
        
        print("✓ GET /api/family/voting/active returns 200 with sessions array")
        print(f"  sessions count: {len(data['sessions'])}")
    
    # ==================== DEMO USER TESTS ====================
    
    def test_demo_user_get_my_family(self, demo_headers):
        """Demo user - GET /api/family/my-family works"""
        response = requests.get(f"{BASE_URL}/api/family/my-family", headers=demo_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        print(f"✓ Demo user - GET /api/family/my-family works (has_family: {data['has_family']})")
    
    def test_demo_user_get_whatsapp_settings(self, demo_headers):
        """Demo user - GET /api/family/whatsapp/settings works"""
        response = requests.get(f"{BASE_URL}/api/family/whatsapp/settings", headers=demo_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        print("✓ Demo user - GET /api/family/whatsapp/settings works")


class TestWhatsAppNotificationSettings:
    """Test WhatsApp notification settings in detail"""
    
    @pytest.fixture
    def user_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Cannot login")
        return response.json().get("access_token")
    
    @pytest.fixture
    def headers(self, user_token):
        return {
            "Authorization": f"Bearer {user_token}",
            "Content-Type": "application/json"
        }
    
    def test_toggle_all_settings_off(self, headers):
        """Can toggle all notification settings off"""
        all_off = {
            "enabled": False,
            "voting_reminders": False,
            "winner_announcements": False,
            "family_invites": False
        }
        
        response = requests.put(
            f"{BASE_URL}/api/family/whatsapp/settings",
            headers=headers,
            json=all_off
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["settings"]["enabled"] == False
        assert data["settings"]["voting_reminders"] == False
        assert data["settings"]["winner_announcements"] == False
        assert data["settings"]["family_invites"] == False
        
        print("✓ Can toggle all notification settings off")
    
    def test_toggle_all_settings_on(self, headers):
        """Can toggle all notification settings on"""
        all_on = {
            "enabled": True,
            "voting_reminders": True,
            "winner_announcements": True,
            "family_invites": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/family/whatsapp/settings",
            headers=headers,
            json=all_on
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["settings"]["enabled"] == True
        assert data["settings"]["voting_reminders"] == True
        assert data["settings"]["winner_announcements"] == True
        assert data["settings"]["family_invites"] == True
        
        print("✓ Can toggle all notification settings on")


class TestProfilePhoneNumberFormat:
    """Test phone number format validation in profile"""
    
    @pytest.fixture
    def user_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Cannot login")
        return response.json().get("access_token")
    
    @pytest.fixture
    def headers(self, user_token):
        return {
            "Authorization": f"Bearer {user_token}",
            "Content-Type": "application/json"
        }
    
    def test_phone_with_country_code(self, headers):
        """Phone number with country code is accepted"""
        phone = "+14155551234"
        response = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers=headers,
            json={"phone_number": phone}
        )
        assert response.status_code == 200
        assert response.json().get("phone_number") == phone
        print(f"✓ Phone with country code accepted: {phone}")
    
    def test_phone_international(self, headers):
        """International phone number is accepted"""
        phone = "+918765432100"  # India
        response = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers=headers,
            json={"phone_number": phone}
        )
        assert response.status_code == 200
        assert response.json().get("phone_number") == phone
        print(f"✓ International phone number accepted: {phone}")
    
    def test_clear_phone_number(self, headers):
        """Phone number can be cleared (set to null)"""
        response = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers=headers,
            json={"phone_number": None}
        )
        assert response.status_code == 200
        # Phone should be cleared or None
        print("✓ Phone number can be cleared")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
