"""
Test Suite for Smart Shopping Flow - Regional Delivery App Integration

Features tested:
1. GET /api/shopping/delivery-apps - Get regional delivery apps
2. POST /api/shopping/build-url - Build delivery URL with ingredients
3. POST /api/shopping/list/add - Save ingredients to shopping list
4. GET /api/shopping/list - Retrieve user's shopping list
5. POST /api/shopping/set-country - Set user's preferred country
"""

import pytest
import requests
import os
import time

# Get API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials for shopping feature
TEST_EMAIL = "shopper@test.com"
TEST_PASSWORD = "shop123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token - register if needed"""
    # First try to login
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    # If login fails, try to register
    register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "name": "Test Shopper"
    })
    
    if register_response.status_code == 200:
        data = register_response.json()
        return data.get("access_token") or data.get("token")
    
    # Try login again after registration
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if login_response.status_code == 200:
        data = login_response.json()
        return data.get("access_token") or data.get("token")
    
    pytest.skip(f"Authentication failed for shopping tests")


@pytest.fixture
def api_headers(auth_token):
    """Get headers with authorization"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestDeliveryAppsEndpoint:
    """Test GET /api/shopping/delivery-apps endpoint"""
    
    def test_delivery_apps_requires_auth(self):
        """Verify delivery-apps requires authentication"""
        response = requests.get(f"{BASE_URL}/api/shopping/delivery-apps")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_delivery_apps_returns_apps_list(self, api_headers):
        """Verify delivery apps endpoint returns apps for detected region"""
        response = requests.get(
            f"{BASE_URL}/api/shopping/delivery-apps",
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Response should indicate success"
        assert "apps" in data, "Response should contain 'apps' key"
        assert isinstance(data["apps"], list), "Apps should be a list"
        assert len(data["apps"]) > 0, "Should have at least one app"
    
    def test_delivery_apps_returns_country_info(self, api_headers):
        """Verify delivery apps returns country information"""
        response = requests.get(
            f"{BASE_URL}/api/shopping/delivery-apps",
            headers=api_headers
        )
        
        data = response.json()
        
        assert "country" in data, "Response should contain country"
        assert "country_code" in data, "Response should contain country_code"
        assert "currency_symbol" in data, "Response should contain currency_symbol"
        assert "detected_from" in data, "Response should indicate how country was detected"
    
    def test_delivery_apps_structure(self, api_headers):
        """Verify each app has required fields"""
        response = requests.get(
            f"{BASE_URL}/api/shopping/delivery-apps",
            headers=api_headers
        )
        
        data = response.json()
        
        for app in data["apps"]:
            assert "id" in app, f"App should have 'id' field: {app}"
            assert "name" in app, f"App should have 'name' field: {app}"
            assert "delivery_time" in app, f"App should have 'delivery_time' field: {app}"
            assert "search_url" in app, f"App should have 'search_url' field: {app}"


class TestBuildUrlEndpoint:
    """Test POST /api/shopping/build-url endpoint"""
    
    def test_build_url_requires_auth(self):
        """Verify build-url requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/shopping/build-url",
            json={"app_id": "blinkit", "ingredients": [{"name": "tomato"}], "country_code": "IN"}
        )
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_build_url_success(self, api_headers):
        """Test building URL with valid ingredients"""
        # First get available apps
        apps_response = requests.get(
            f"{BASE_URL}/api/shopping/delivery-apps",
            headers=api_headers
        )
        apps_data = apps_response.json()
        
        if not apps_data.get("apps"):
            pytest.skip("No delivery apps available")
        
        first_app = apps_data["apps"][0]
        country_code = apps_data.get("country_code", "IN")
        
        response = requests.post(
            f"{BASE_URL}/api/shopping/build-url",
            json={
                "app_id": first_app["id"],
                "ingredients": [
                    {"name": "tomato", "amount": "2"},
                    {"name": "onion", "amount": "1"}
                ],
                "country_code": country_code
            },
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Response should indicate success"
        assert "url" in data, "Response should contain URL"
        assert data["url"].startswith("http"), "URL should be a valid HTTP URL"
        assert "app_name" in data, "Response should contain app_name"
        assert "app_id" in data, "Response should contain app_id"
    
    def test_build_url_validates_app_id(self, api_headers):
        """Test build-url returns error for invalid app_id"""
        response = requests.post(
            f"{BASE_URL}/api/shopping/build-url",
            json={
                "app_id": "invalid_app_xyz",
                "ingredients": [{"name": "tomato"}],
                "country_code": "IN"
            },
            headers=api_headers
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid app, got {response.status_code}"
    
    def test_build_url_requires_ingredients(self, api_headers):
        """Test build-url requires ingredients"""
        response = requests.post(
            f"{BASE_URL}/api/shopping/build-url",
            json={
                "app_id": "blinkit",
                "ingredients": [],
                "country_code": "IN"
            },
            headers=api_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for empty ingredients, got {response.status_code}"
    
    def test_build_url_encodes_ingredients_in_url(self, api_headers):
        """Test that ingredients are properly encoded in the URL"""
        # Get available apps
        apps_response = requests.get(
            f"{BASE_URL}/api/shopping/delivery-apps",
            headers=api_headers
        )
        apps_data = apps_response.json()
        
        if not apps_data.get("apps"):
            pytest.skip("No delivery apps available")
        
        first_app = apps_data["apps"][0]
        country_code = apps_data.get("country_code", "IN")
        
        response = requests.post(
            f"{BASE_URL}/api/shopping/build-url",
            json={
                "app_id": first_app["id"],
                "ingredients": [
                    {"name": "chicken breast"},
                    {"name": "garlic cloves"}
                ],
                "country_code": country_code
            },
            headers=api_headers
        )
        
        data = response.json()
        # URL should contain encoded query
        assert "url" in data
        # At least the first ingredient should be in the URL (URL-encoded)
        assert "chicken" in data["url"].lower() or "chicken%20" in data["url"].lower()


class TestShoppingListAdd:
    """Test POST /api/shopping/list/add endpoint"""
    
    def test_add_to_list_requires_auth(self):
        """Verify add-to-list requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/shopping/list/add",
            json={"ingredients": [{"name": "tomato"}]}
        )
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_add_ingredients_to_list(self, api_headers):
        """Test adding ingredients to shopping list"""
        unique_ingredient = f"TEST_ingredient_{int(time.time())}"
        
        response = requests.post(
            f"{BASE_URL}/api/shopping/list/add",
            json={
                "ingredients": [
                    {"name": unique_ingredient, "amount": "2", "unit": "cups"},
                    {"name": f"TEST_garlic_{int(time.time())}", "amount": "3", "unit": "cloves"}
                ],
                "recipe_name": "Test Recipe"
            },
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Response should indicate success"
        assert "message" in data, "Response should contain message"
        assert "total_items" in data, "Response should contain total_items"
    
    def test_add_to_list_requires_ingredients(self, api_headers):
        """Test add-to-list requires at least one ingredient"""
        response = requests.post(
            f"{BASE_URL}/api/shopping/list/add",
            json={"ingredients": []},
            headers=api_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for empty ingredients, got {response.status_code}"
    
    def test_add_to_list_with_recipe_info(self, api_headers):
        """Test adding ingredients with recipe association"""
        unique_ingredient = f"TEST_recipe_ing_{int(time.time())}"
        
        response = requests.post(
            f"{BASE_URL}/api/shopping/list/add",
            json={
                "ingredients": [{"name": unique_ingredient, "amount": "1"}],
                "recipe_id": "test_recipe_123",
                "recipe_name": "Spaghetti Carbonara"
            },
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") is True


class TestShoppingListGet:
    """Test GET /api/shopping/list endpoint"""
    
    def test_get_list_requires_auth(self):
        """Verify get-list requires authentication"""
        response = requests.get(f"{BASE_URL}/api/shopping/list")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_get_shopping_list(self, api_headers):
        """Test retrieving shopping list"""
        response = requests.get(
            f"{BASE_URL}/api/shopping/list",
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Response should indicate success"
        assert "items" in data, "Response should contain items"
        assert isinstance(data["items"], list), "Items should be a list"
        assert "total_items" in data, "Response should contain total_items"
    
    def test_add_then_get_list_persistence(self, api_headers):
        """Test that added items persist and can be retrieved"""
        # Add a unique item
        unique_name = f"TEST_persist_{int(time.time())}"
        
        add_response = requests.post(
            f"{BASE_URL}/api/shopping/list/add",
            json={"ingredients": [{"name": unique_name, "amount": "5", "unit": "kg"}]},
            headers=api_headers
        )
        assert add_response.status_code == 200
        
        # Retrieve the list
        get_response = requests.get(
            f"{BASE_URL}/api/shopping/list",
            headers=api_headers
        )
        
        data = get_response.json()
        
        # Find our added item
        item_names = [item["name"].lower() for item in data["items"]]
        assert unique_name.lower() in item_names, f"Added item '{unique_name}' should be in list: {item_names}"


class TestSetCountryPreference:
    """Test POST /api/shopping/set-country endpoint"""
    
    def test_set_country_requires_auth(self):
        """Verify set-country requires authentication"""
        response = requests.post(f"{BASE_URL}/api/shopping/set-country?country_code=US")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_set_valid_country(self, api_headers):
        """Test setting a valid country preference"""
        response = requests.post(
            f"{BASE_URL}/api/shopping/set-country?country_code=US",
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert data.get("country_code") == "US"
    
    def test_set_invalid_country(self, api_headers):
        """Test setting an invalid country code"""
        response = requests.post(
            f"{BASE_URL}/api/shopping/set-country?country_code=INVALID_XYZ",
            headers=api_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid country, got {response.status_code}"
    
    def test_country_preference_affects_delivery_apps(self, api_headers):
        """Test that setting country preference affects delivery apps returned"""
        # Set country to USA
        set_response = requests.post(
            f"{BASE_URL}/api/shopping/set-country?country_code=US",
            headers=api_headers
        )
        assert set_response.status_code == 200
        
        # Get delivery apps - should return US apps
        apps_response = requests.get(
            f"{BASE_URL}/api/shopping/delivery-apps",
            headers=api_headers
        )
        
        data = apps_response.json()
        
        assert data.get("country") == "United States", f"Country should be USA, got {data.get('country')}"
        assert data.get("detected_from") == "user_preference", "Should indicate preference was used"
        
        # Check for US-specific apps
        app_ids = [app["id"] for app in data["apps"]]
        us_apps = ["instacart", "amazon_fresh", "walmart_grocery"]
        has_us_app = any(app_id in us_apps for app_id in app_ids)
        assert has_us_app, f"Should have US delivery apps, got: {app_ids}"
        
        # Reset to India for other tests
        requests.post(
            f"{BASE_URL}/api/shopping/set-country?country_code=IN",
            headers=api_headers
        )


class TestRegionalAppConfiguration:
    """Test regional delivery app configurations"""
    
    def test_india_apps_available(self, api_headers):
        """Test India has correct delivery apps"""
        # Set country to India
        requests.post(
            f"{BASE_URL}/api/shopping/set-country?country_code=IN",
            headers=api_headers
        )
        
        response = requests.get(
            f"{BASE_URL}/api/shopping/delivery-apps",
            headers=api_headers
        )
        
        data = response.json()
        app_ids = [app["id"] for app in data["apps"]]
        
        # Check for India-specific apps
        india_apps = ["blinkit", "zepto", "swiggy_instamart"]
        has_india_apps = any(app_id in india_apps for app_id in app_ids)
        assert has_india_apps or data.get("country_code") != "IN", f"India should have local apps: {app_ids}"
    
    def test_uk_apps_available(self, api_headers):
        """Test UK has correct delivery apps"""
        # Set country to UK
        requests.post(
            f"{BASE_URL}/api/shopping/set-country?country_code=GB",
            headers=api_headers
        )
        
        response = requests.get(
            f"{BASE_URL}/api/shopping/delivery-apps",
            headers=api_headers
        )
        
        data = response.json()
        
        if data.get("country_code") == "GB":
            app_ids = [app["id"] for app in data["apps"]]
            uk_apps = ["tesco", "ocado", "sainsburys"]
            has_uk_app = any(app_id in uk_apps for app_id in app_ids)
            assert has_uk_app, f"UK should have local apps: {app_ids}"
        
        # Reset to default
        requests.post(
            f"{BASE_URL}/api/shopping/set-country?country_code=IN",
            headers=api_headers
        )


class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_duplicate_ingredients_not_added(self, api_headers):
        """Test that duplicate ingredients are handled"""
        unique_name = f"TEST_dup_{int(time.time())}"
        
        # Add ingredient first time
        response1 = requests.post(
            f"{BASE_URL}/api/shopping/list/add",
            json={"ingredients": [{"name": unique_name}]},
            headers=api_headers
        )
        items_after_first = response1.json().get("total_items", 0)
        
        # Add same ingredient again
        response2 = requests.post(
            f"{BASE_URL}/api/shopping/list/add",
            json={"ingredients": [{"name": unique_name}]},
            headers=api_headers
        )
        items_after_second = response2.json().get("total_items", 0)
        
        # Total should not increase for duplicate
        assert items_after_second == items_after_first, "Duplicate items should not increase count"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
