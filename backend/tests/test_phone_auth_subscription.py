"""
Test suite for Phase 3 (Phone Authentication) and Phase 4 (Meal Planner Subscription)
Tests phone OTP flow (demo mode) and recipe subscription endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPhoneAuthentication:
    """Tests for Phone OTP Authentication (Demo Mode)"""
    
    def test_send_otp_valid_phone(self):
        """TEST 4 - POST /api/auth/phone/send-otp returns demo OTP"""
        response = requests.post(
            f"{BASE_URL}/api/auth/phone/send-otp",
            json={"phone_number": "+15551234567"}
        )
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "status" in data, "Response should contain 'status'"
        assert data["status"] == "pending", f"Expected status 'pending', got {data['status']}"
        assert "demo_otp" in data, "Demo mode should return demo_otp"
        assert len(data["demo_otp"]) == 6, f"OTP should be 6 digits, got {data['demo_otp']}"
        print(f"PASS: Send OTP returned demo_otp: {data['demo_otp']}")
    
    def test_send_otp_invalid_phone_format(self):
        """Test send OTP with invalid phone format"""
        response = requests.post(
            f"{BASE_URL}/api/auth/phone/send-otp",
            json={"phone_number": "1234"}  # Too short, no + prefix
        )
        
        # Should return 400 for invalid format
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: Invalid phone format rejected")
    
    def test_verify_otp_valid_code(self):
        """TEST 5 - POST /api/auth/phone/verify-otp validates code and returns token"""
        # Step 1: Send OTP
        send_response = requests.post(
            f"{BASE_URL}/api/auth/phone/send-otp",
            json={"phone_number": "+15557778888"}
        )
        assert send_response.status_code == 200
        demo_otp = send_response.json()["demo_otp"]
        
        # Step 2: Verify OTP
        verify_response = requests.post(
            f"{BASE_URL}/api/auth/phone/verify-otp",
            json={"phone_number": "+15557778888", "code": demo_otp}
        )
        
        # Status assertion
        assert verify_response.status_code == 200, f"Expected 200, got {verify_response.status_code}: {verify_response.text}"
        
        # Data assertions
        data = verify_response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user"
        assert "is_new_user" in data, "Response should contain is_new_user"
        assert data["token_type"] == "bearer", "Token type should be bearer"
        
        # Verify user data
        user = data["user"]
        assert user["phone_number"] == "+15557778888", "Phone number should match"
        assert "id" in user, "User should have id"
        print(f"PASS: OTP verified, is_new_user={data['is_new_user']}")
    
    def test_verify_otp_invalid_code(self):
        """Test verify OTP with wrong code"""
        # Step 1: Send OTP
        send_response = requests.post(
            f"{BASE_URL}/api/auth/phone/send-otp",
            json={"phone_number": "+15559990000"}
        )
        assert send_response.status_code == 200
        
        # Step 2: Try to verify with wrong code
        verify_response = requests.post(
            f"{BASE_URL}/api/auth/phone/verify-otp",
            json={"phone_number": "+15559990000", "code": "000000"}
        )
        
        # Should return 400 for invalid code
        assert verify_response.status_code == 400, f"Expected 400, got {verify_response.status_code}"
        print("PASS: Invalid OTP code rejected")
    
    def test_phone_auth_creates_new_user(self):
        """Test that phone auth creates new user on first login"""
        import uuid
        unique_phone = f"+1555{str(uuid.uuid4())[:7].replace('-', '')}"
        
        # Send OTP
        send_response = requests.post(
            f"{BASE_URL}/api/auth/phone/send-otp",
            json={"phone_number": unique_phone}
        )
        assert send_response.status_code == 200
        demo_otp = send_response.json()["demo_otp"]
        
        # Verify OTP
        verify_response = requests.post(
            f"{BASE_URL}/api/auth/phone/verify-otp",
            json={"phone_number": unique_phone, "code": demo_otp}
        )
        
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert data["is_new_user"] == True, "First login should mark as new user"
        print(f"PASS: New user created for phone {unique_phone}")


class TestRecipeSubscription:
    """Tests for Recipe Subscription API (Phase 4)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testuser123@example.com",
            "password": "Test1234!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_subscribe_to_recipes(self):
        """TEST 9 - POST /api/subscription/recipes saves subscription"""
        response = requests.post(
            f"{BASE_URL}/api/subscription/recipes",
            headers=self.headers,
            json={
                "email": "testuser123@example.com",
                "dietary_preference": "Vegetarian",
                "cuisines": ["Italian", "Mexican", "Indian"],
                "recipes_per_week": 5,
                "delivery_day": "Sunday"
            }
        )
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert data["status"] == "subscribed", f"Expected status 'subscribed', got {data['status']}"
        assert "message" in data, "Response should contain message"
        print(f"PASS: Subscription created - {data['message']}")
    
    def test_get_subscription_status(self):
        """Test GET /api/subscription/recipes returns subscription status"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/recipes",
            headers=self.headers
        )
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert "subscribed" in data, "Response should contain 'subscribed' field"
        assert "subscription" in data, "Response should contain 'subscription' field"
        
        if data["subscribed"]:
            sub = data["subscription"]
            assert "email" in sub, "Subscription should have email"
            assert "dietary_preference" in sub, "Subscription should have dietary_preference"
            assert "cuisines" in sub, "Subscription should have cuisines"
            assert "recipes_per_week" in sub, "Subscription should have recipes_per_week"
            assert "delivery_day" in sub, "Subscription should have delivery_day"
        print(f"PASS: Subscription status retrieved - subscribed={data['subscribed']}")
    
    def test_subscription_requires_auth(self):
        """Test that subscription endpoints require authentication"""
        # POST without auth
        response = requests.post(
            f"{BASE_URL}/api/subscription/recipes",
            json={"email": "test@test.com", "dietary_preference": "Vegan", "cuisines": [], "recipes_per_week": 3, "delivery_day": "Monday"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
        # GET without auth
        response = requests.get(f"{BASE_URL}/api/subscription/recipes")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Subscription endpoints require authentication")
    
    def test_unsubscribe_from_recipes(self):
        """Test DELETE /api/subscription/recipes unsubscribes user"""
        # First subscribe
        requests.post(
            f"{BASE_URL}/api/subscription/recipes",
            headers=self.headers,
            json={
                "email": "testuser123@example.com",
                "dietary_preference": "Vegan",
                "cuisines": ["Thai"],
                "recipes_per_week": 3,
                "delivery_day": "Monday"
            }
        )
        
        # Then unsubscribe
        response = requests.delete(
            f"{BASE_URL}/api/subscription/recipes",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["status"] == "unsubscribed", f"Expected 'unsubscribed', got {data['status']}"
        print("PASS: Unsubscribe successful")


class TestWeeklyPlannerAPI:
    """Tests for Weekly Planner API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testuser123@example.com",
            "password": "Test1234!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_weekly_plans(self):
        """Test GET /api/weekly-plan returns user's plans"""
        response = requests.get(
            f"{BASE_URL}/api/weekly-plan",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "plans" in data, "Response should contain 'plans'"
        assert isinstance(data["plans"], list), "Plans should be a list"
        print(f"PASS: Weekly plans retrieved - {len(data['plans'])} plans found")
    
    def test_create_weekly_plan(self):
        """Test POST /api/weekly-plan creates a new plan"""
        from datetime import datetime, timedelta
        
        # Calculate week start (Monday)
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        week_start = monday.strftime('%Y-%m-%d')
        
        response = requests.post(
            f"{BASE_URL}/api/weekly-plan",
            headers=self.headers,
            json={
                "week_start": week_start,
                "meals": {
                    "Monday": {"breakfast": "Oatmeal", "lunch": "Salad", "dinner": "Pasta"},
                    "Tuesday": {"breakfast": "Toast", "lunch": "Soup", "dinner": "Stir-fry"}
                }
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain plan id"
        assert data["week_start"] == week_start, "Week start should match"
        print(f"PASS: Weekly plan created with id {data['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
