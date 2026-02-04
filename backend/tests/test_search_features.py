"""
Tests for Search Hub Features - Google Maps URL and Local Currency
Testing: grocery-stores (google_maps_url) and ingredient-prices (currency/location)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = "test@moodfood.com"
TEST_PASSWORD = "Test123!"


class TestAuthSetup:
    """Authentication setup for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
        return response.json().get("token")


class TestGroceryStoresAPI:
    """Tests for /api/search/grocery-stores endpoint - Google Maps URL feature"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Auth failed: {response.text}")
        return response.json().get("token")
    
    def test_grocery_stores_returns_google_maps_url(self, auth_token):
        """Test that grocery stores API returns google_maps_url field"""
        response = requests.post(
            f"{BASE_URL}/api/search/grocery-stores",
            json={"location": "New York", "ingredient": None},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"API failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True, "Response should indicate success"
        assert "stores" in data, "Response should contain stores array"
        
        # Check that at least some stores have google_maps_url
        stores_with_map_url = [s for s in data["stores"] if s.get("google_maps_url")]
        print(f"Found {len(stores_with_map_url)} stores with google_maps_url out of {len(data['stores'])}")
        
        if len(data["stores"]) > 0:
            # Verify google_maps_url field exists in store object
            store = data["stores"][0]
            assert "google_maps_url" in store, "Store object should have google_maps_url field"
    
    def test_google_maps_url_format(self, auth_token):
        """Test that google_maps_url has correct Google Maps format"""
        response = requests.post(
            f"{BASE_URL}/api/search/grocery-stores",
            json={"location": "San Francisco", "ingredient": "organic"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check URL format for stores that have google_maps_url
        for store in data.get("stores", []):
            if store.get("google_maps_url"):
                url = store["google_maps_url"]
                assert url.startswith("https://www.google.com/maps"), \
                    f"URL should start with Google Maps domain: {url}"
                print(f"Store '{store['name']}' - URL: {url[:80]}...")
    
    def test_grocery_stores_with_ingredient_filter(self, auth_token):
        """Test grocery stores search with ingredient filter"""
        response = requests.post(
            f"{BASE_URL}/api/search/grocery-stores",
            json={"location": "Los Angeles", "ingredient": "fresh vegetables"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"Found {data.get('total_found', 0)} stores for fresh vegetables in Los Angeles")


class TestIngredientPricesAPI:
    """Tests for /api/search/ingredient-prices endpoint - Local Currency feature"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Auth failed: {response.text}")
        return response.json().get("token")
    
    def test_price_check_india_returns_inr(self, auth_token):
        """Test that India location returns INR currency"""
        response = requests.post(
            f"{BASE_URL}/api/search/ingredient-prices",
            json={"ingredient": "rice", "location": "Mumbai"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"API failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert "currency" in data, "Response should contain currency field"
        assert data["currency"] == "INR", f"India should return INR, got: {data['currency']}"
        assert "detected_location" in data, "Response should contain detected_location"
        assert "Mumbai" in data["detected_location"] or "India" in data["detected_location"], \
            f"Detected location should include Mumbai/India: {data['detected_location']}"
        
        print(f"Currency: {data['currency']}, Location: {data['detected_location']}")
        
        # Check price_stats also has currency
        if data.get("price_stats"):
            assert data["price_stats"].get("currency") == "INR", \
                f"price_stats should have INR currency: {data['price_stats']}"
    
    def test_price_check_uk_returns_gbp(self, auth_token):
        """Test that UK location returns GBP currency"""
        response = requests.post(
            f"{BASE_URL}/api/search/ingredient-prices",
            json={"ingredient": "olive oil", "location": "London"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["currency"] == "GBP", f"UK should return GBP, got: {data['currency']}"
        assert "United Kingdom" in data["detected_location"], \
            f"Detected location should include UK: {data['detected_location']}"
        
        print(f"Currency: {data['currency']}, Location: {data['detected_location']}")
    
    def test_price_check_usa_returns_usd(self, auth_token):
        """Test that USA location returns USD currency"""
        response = requests.post(
            f"{BASE_URL}/api/search/ingredient-prices",
            json={"ingredient": "chicken breast", "location": "USA"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["currency"] == "USD", f"USA should return USD, got: {data['currency']}"
        
        print(f"Currency: {data['currency']}, Location: {data['detected_location']}")
    
    def test_price_check_default_currency_for_unknown_location(self, auth_token):
        """Test that unknown location defaults to USD"""
        response = requests.post(
            f"{BASE_URL}/api/search/ingredient-prices",
            json={"ingredient": "milk", "location": "SomeUnknownCity123"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["currency"] == "USD", f"Unknown location should default to USD, got: {data['currency']}"
        
        print(f"Currency: {data['currency']}, Location: {data['detected_location']}")
    
    def test_price_check_returns_country_code(self, auth_token):
        """Test that response includes country_code field"""
        response = requests.post(
            f"{BASE_URL}/api/search/ingredient-prices",
            json={"ingredient": "tomatoes", "location": "Delhi"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "country_code" in data, "Response should contain country_code field"
        assert data["country_code"] == "IN", f"India should have country code IN, got: {data['country_code']}"
        
        print(f"Country Code: {data['country_code']}")
    
    def test_price_check_europe_returns_eur(self, auth_token):
        """Test that European location returns EUR currency"""
        response = requests.post(
            f"{BASE_URL}/api/search/ingredient-prices",
            json={"ingredient": "bread", "location": "Paris"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["currency"] == "EUR", f"France should return EUR, got: {data['currency']}"
        
        print(f"Currency: {data['currency']}, Location: {data['detected_location']}")
    
    def test_price_stats_include_currency_symbol_data(self, auth_token):
        """Test that price_stats properly includes currency for UI display"""
        response = requests.post(
            f"{BASE_URL}/api/search/ingredient-prices",
            json={"ingredient": "sugar", "location": "India"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        
        if data.get("price_stats") and data["price_stats"].get("price_count", 0) > 0:
            stats = data["price_stats"]
            assert "currency" in stats, "price_stats should include currency"
            assert "min_price" in stats, "price_stats should include min_price"
            assert "max_price" in stats, "price_stats should include max_price"
            assert "avg_price" in stats, "price_stats should include avg_price"
            print(f"Price Stats: Min={stats['min_price']}, Max={stats['max_price']}, Avg={stats['avg_price']} {stats['currency']}")


class TestSearchStatusEndpoint:
    """Test search API status endpoint (no auth required)"""
    
    def test_search_status_returns_features(self):
        """Test that /api/search/status returns feature list"""
        response = requests.get(f"{BASE_URL}/api/search/status")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "features" in data
        assert "grocery_store_finder" in data["features"]
        assert "ingredient_price_check" in data["features"]
        print(f"Search API Status: {data['status']}, Features: {data['features']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
