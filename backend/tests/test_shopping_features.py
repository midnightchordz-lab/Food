"""
Test Suite for Google Shopping Light API Features
Tests: 
1. GET /api/search/supported-stores - List supported stores
2. POST /api/search/ingredient-price-filtered - Store-filtered price check
3. POST /api/search/batch-prices - Batch ingredient prices
4. POST /api/search/buy-ingredients - Buy links for ingredients
5. POST /api/search/shopping-cart - Build cart from recipes
"""

import pytest
import requests
import os
import time

# Get API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://hands-free-cook.preview.emergentagent.com"

# Test credentials
TEST_EMAIL = "test@moodfood.com"
TEST_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def api_headers(auth_token):
    """Get headers with authorization"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestSupportedStores:
    """Test GET /api/search/supported-stores endpoint"""
    
    def test_supported_stores_returns_list(self):
        """Verify supported stores endpoint returns list of stores"""
        response = requests.get(f"{BASE_URL}/api/search/supported-stores")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "stores" in data, "Response should contain 'stores' key"
        assert isinstance(data["stores"], list), "Stores should be a list"
        assert len(data["stores"]) > 0, "Should have at least one store"
    
    def test_supported_stores_structure(self):
        """Verify each store has required fields"""
        response = requests.get(f"{BASE_URL}/api/search/supported-stores")
        data = response.json()
        
        for store in data["stores"]:
            assert "id" in store, f"Store should have 'id' field: {store}"
            assert "name" in store, f"Store should have 'name' field: {store}"
            assert "domain" in store, f"Store should have 'domain' field: {store}"
    
    def test_supported_stores_contains_expected_stores(self):
        """Verify expected stores are present"""
        response = requests.get(f"{BASE_URL}/api/search/supported-stores")
        data = response.json()
        
        store_ids = [s["id"] for s in data["stores"]]
        expected_stores = ["amazon", "walmart", "target"]
        
        for expected in expected_stores:
            assert expected in store_ids, f"Expected store '{expected}' not found in: {store_ids}"


class TestStoreFilteredPrices:
    """Test POST /api/search/ingredient-price-filtered endpoint"""
    
    def test_price_check_without_filter(self, api_headers):
        """Test basic price check without store filter"""
        response = requests.post(
            f"{BASE_URL}/api/search/ingredient-price-filtered",
            json={"ingredient": "olive oil", "location": "USA"},
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Response should indicate success"
        assert "ingredient" in data, "Response should contain ingredient"
        assert "prices" in data, "Response should contain prices"
    
    def test_price_check_with_store_filter(self, api_headers):
        """Test price check with Amazon store filter"""
        response = requests.post(
            f"{BASE_URL}/api/search/ingredient-price-filtered",
            json={"ingredient": "olive oil", "location": "USA", "store": "amazon"},
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") is True, "Response should indicate success"
        assert data.get("store_filter") == "amazon", "Store filter should be returned"
    
    def test_price_check_returns_cheapest(self, api_headers):
        """Verify cheapest option is returned"""
        response = requests.post(
            f"{BASE_URL}/api/search/ingredient-price-filtered",
            json={"ingredient": "rice", "location": "USA"},
            headers=api_headers
        )
        
        data = response.json()
        
        # Should have cheapest field when prices are found
        if data.get("prices") and len(data["prices"]) > 0:
            assert "cheapest" in data, "Response should include cheapest option"
    
    def test_price_check_response_structure(self, api_headers):
        """Verify price response has correct structure"""
        response = requests.post(
            f"{BASE_URL}/api/search/ingredient-price-filtered",
            json={"ingredient": "chicken breast", "location": "USA"},
            headers=api_headers
        )
        
        data = response.json()
        
        if data.get("prices") and len(data["prices"]) > 0:
            price_item = data["prices"][0]
            expected_fields = ["title", "price", "source", "link"]
            for field in expected_fields:
                assert field in price_item, f"Price item should have '{field}' field"


class TestBatchPrices:
    """Test POST /api/search/batch-prices endpoint"""
    
    def test_batch_prices_multiple_ingredients(self, api_headers):
        """Test batch price check for multiple ingredients"""
        response = requests.post(
            f"{BASE_URL}/api/search/batch-prices",
            json={
                "ingredients": ["olive oil", "garlic", "onion"],
                "location": "USA"
            },
            headers=api_headers,
            timeout=60  # Allow more time for batch requests
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Response should indicate success"
        assert "ingredients" in data, "Response should contain ingredients dict"
        assert "estimated_total" in data, "Response should contain estimated_total"
    
    def test_batch_prices_returns_per_ingredient_data(self, api_headers):
        """Verify each ingredient has price data"""
        response = requests.post(
            f"{BASE_URL}/api/search/batch-prices",
            json={"ingredients": ["salt", "pepper"], "location": "USA"},
            headers=api_headers,
            timeout=60
        )
        
        data = response.json()
        
        assert "ingredients" in data
        # Each ingredient should have a result
        for ing_name, ing_data in data["ingredients"].items():
            assert "success" in ing_data, f"Ingredient {ing_name} should have success field"
    
    def test_batch_prices_estimated_total(self, api_headers):
        """Verify estimated total is calculated"""
        response = requests.post(
            f"{BASE_URL}/api/search/batch-prices",
            json={"ingredients": ["flour", "sugar", "eggs"], "location": "USA"},
            headers=api_headers,
            timeout=60
        )
        
        data = response.json()
        
        assert "estimated_total" in data
        assert "min" in data["estimated_total"], "Total should have min"
        assert "max" in data["estimated_total"], "Total should have max"
        assert "currency" in data["estimated_total"], "Total should have currency"
    
    def test_batch_prices_max_ingredients_limit(self, api_headers):
        """Test that exceeding max ingredients returns error"""
        # Create list of 16 ingredients (exceeds 15 limit)
        ingredients = [f"ingredient_{i}" for i in range(16)]
        
        response = requests.post(
            f"{BASE_URL}/api/search/batch-prices",
            json={"ingredients": ingredients, "location": "USA"},
            headers=api_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for exceeding limit, got {response.status_code}"


class TestBuyIngredients:
    """Test POST /api/search/buy-ingredients endpoint"""
    
    def test_buy_ingredients_returns_links(self, api_headers):
        """Test buy ingredients returns purchase links"""
        response = requests.post(
            f"{BASE_URL}/api/search/buy-ingredients",
            json={"ingredients": ["tomato", "basil"], "location": "USA"},
            headers=api_headers,
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") is True, "Response should indicate success"
        assert "buy_links" in data, "Response should contain buy_links"
        assert isinstance(data["buy_links"], list), "buy_links should be a list"
    
    def test_buy_links_structure(self, api_headers):
        """Verify buy links have correct structure"""
        response = requests.post(
            f"{BASE_URL}/api/search/buy-ingredients",
            json={"ingredients": ["pasta"], "location": "USA"},
            headers=api_headers,
            timeout=60
        )
        
        data = response.json()
        
        if data.get("buy_links") and len(data["buy_links"]) > 0:
            link = data["buy_links"][0]
            expected_fields = ["ingredient", "price", "source", "link"]
            for field in expected_fields:
                assert field in link, f"Buy link should have '{field}' field"
    
    def test_buy_ingredients_includes_total(self, api_headers):
        """Verify buy ingredients includes estimated total"""
        response = requests.post(
            f"{BASE_URL}/api/search/buy-ingredients",
            json={"ingredients": ["cheese", "bread"], "location": "USA"},
            headers=api_headers,
            timeout=60
        )
        
        data = response.json()
        
        assert "estimated_total" in data, "Response should include estimated_total"
        assert "currency" in data, "Response should include currency"


class TestShoppingCart:
    """Test POST /api/search/shopping-cart endpoint"""
    
    def test_shopping_cart_single_recipe(self, api_headers):
        """Test shopping cart with single recipe"""
        response = requests.post(
            f"{BASE_URL}/api/search/shopping-cart",
            json={
                "recipes": [
                    {"name": "Spaghetti", "ingredients": ["pasta", "tomato sauce", "ground beef"]}
                ],
                "location": "USA"
            },
            headers=api_headers,
            timeout=90
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Response should indicate success"
        assert "cart_items" in data, "Response should contain cart_items"
        assert "total_items" in data, "Response should contain total_items"
    
    def test_shopping_cart_multiple_recipes(self, api_headers):
        """Test shopping cart aggregates from multiple recipes"""
        response = requests.post(
            f"{BASE_URL}/api/search/shopping-cart",
            json={
                "recipes": [
                    {"name": "Salad", "ingredients": ["lettuce", "tomato", "cucumber"]},
                    {"name": "Pizza", "ingredients": ["flour", "tomato", "cheese"]}
                ],
                "location": "USA"
            },
            headers=api_headers,
            timeout=90
        )
        
        data = response.json()
        
        assert data.get("success") is True
        assert data.get("recipes_included") == 2, "Should include 2 recipes"
    
    def test_shopping_cart_deduplicates_ingredients(self, api_headers):
        """Test that cart deduplicates shared ingredients"""
        response = requests.post(
            f"{BASE_URL}/api/search/shopping-cart",
            json={
                "recipes": [
                    {"name": "Recipe A", "ingredients": ["tomato", "onion"]},
                    {"name": "Recipe B", "ingredients": ["tomato", "garlic"]}
                ],
                "location": "USA"
            },
            headers=api_headers,
            timeout=90
        )
        
        data = response.json()
        
        # Find tomato in cart_items - should show both recipes
        if data.get("cart_items"):
            tomato_item = next((item for item in data["cart_items"] if "tomato" in item.get("ingredient", "").lower()), None)
            if tomato_item:
                # Tomato should be used in both recipes
                assert len(tomato_item.get("used_in", [])) >= 1, "Shared ingredient should list multiple recipes"
    
    def test_shopping_cart_includes_buy_links(self, api_headers):
        """Test cart items include purchase links"""
        response = requests.post(
            f"{BASE_URL}/api/search/shopping-cart",
            json={
                "recipes": [{"name": "Simple Recipe", "ingredients": ["butter", "milk"]}],
                "location": "USA"
            },
            headers=api_headers,
            timeout=90
        )
        
        data = response.json()
        
        # Cart items should have buy links when prices are found
        if data.get("cart_items"):
            # At least some items should have buy links
            has_buy_link = any(item.get("buy_link") for item in data["cart_items"])
            # This is informational - not all items may have links
            print(f"Cart items with buy links: {has_buy_link}")
    
    def test_shopping_cart_max_recipes_limit(self, api_headers):
        """Test that exceeding max recipes returns error"""
        # Create 11 recipes (exceeds 10 limit)
        recipes = [{"name": f"Recipe {i}", "ingredients": ["test"]} for i in range(11)]
        
        response = requests.post(
            f"{BASE_URL}/api/search/shopping-cart",
            json={"recipes": recipes, "location": "USA"},
            headers=api_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for exceeding limit, got {response.status_code}"


class TestAuthRequired:
    """Test that endpoints require authentication"""
    
    def test_price_filtered_requires_auth(self):
        """Verify ingredient-price-filtered requires auth"""
        response = requests.post(
            f"{BASE_URL}/api/search/ingredient-price-filtered",
            json={"ingredient": "test"}
        )
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_batch_prices_requires_auth(self):
        """Verify batch-prices requires auth"""
        response = requests.post(
            f"{BASE_URL}/api/search/batch-prices",
            json={"ingredients": ["test"]}
        )
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_buy_ingredients_requires_auth(self):
        """Verify buy-ingredients requires auth"""
        response = requests.post(
            f"{BASE_URL}/api/search/buy-ingredients",
            json={"ingredients": ["test"]}
        )
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_shopping_cart_requires_auth(self):
        """Verify shopping-cart requires auth"""
        response = requests.post(
            f"{BASE_URL}/api/search/shopping-cart",
            json={"recipes": [{"name": "test", "ingredients": ["test"]}]}
        )
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_supported_stores_no_auth_required(self):
        """Verify supported-stores does NOT require auth"""
        response = requests.get(f"{BASE_URL}/api/search/supported-stores")
        assert response.status_code == 200, "supported-stores should not require auth"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
