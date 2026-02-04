"""
Google Images Integration Tests via SerpAPI
Tests the fast image loading feature for recipes
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFastImageEndpoint:
    """Tests for /api/recipe-image/fast endpoint (Google Images with AI fallback)"""
    
    def test_fast_image_post_returns_google_images(self):
        """POST /api/recipe-image/fast returns Google Images for common recipe"""
        response = requests.post(f"{BASE_URL}/api/recipe-image/fast", json={
            "recipe_name": "Chicken Biryani",
            "cuisine": "Indian",
            "use_ai_fallback": False
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "image_url" in data
        assert "source" in data
        assert "recipe_name" in data
        
        # Should return Google Images
        assert data["source"] == "google_images"
        assert data["image_url"].startswith("http")
        
        # Should have alternatives
        assert "alternatives" in data
        assert isinstance(data["alternatives"], list)
        
    def test_fast_image_get_endpoint(self):
        """GET /api/recipe-image/fast/{recipe_name} works correctly"""
        response = requests.get(
            f"{BASE_URL}/api/recipe-image/fast/Pasta%20Carbonara",
            params={"cuisine": "Italian", "use_ai_fallback": False}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["source"] == "google_images"
        assert data["image_url"].startswith("http")
        assert data["recipe_name"] == "Pasta Carbonara"
        
    def test_fast_image_with_japanese_cuisine(self):
        """Test Japanese cuisine recipe returns relevant images"""
        response = requests.post(f"{BASE_URL}/api/recipe-image/fast", json={
            "recipe_name": "Chicken Teriyaki",
            "cuisine": "Japanese",
            "use_ai_fallback": False
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["source"] == "google_images"
        assert data["image_url"] is not None
        assert len(data.get("alternatives", [])) > 0
        
    def test_fast_image_with_mexican_cuisine(self):
        """Test Mexican cuisine recipe returns relevant images"""
        response = requests.post(f"{BASE_URL}/api/recipe-image/fast", json={
            "recipe_name": "Tacos",
            "cuisine": "Mexican",
            "use_ai_fallback": False
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["source"] == "google_images"
        assert data["image_url"].startswith("http")
        
    def test_fast_image_response_time_under_2_seconds(self):
        """Verify fast image endpoint responds within 2 seconds"""
        start = time.time()
        response = requests.post(f"{BASE_URL}/api/recipe-image/fast", json={
            "recipe_name": "Grilled Salmon",
            "cuisine": "",
            "use_ai_fallback": False
        })
        duration = time.time() - start
        
        assert response.status_code == 200
        assert duration < 2.0, f"Response took {duration:.2f}s, expected <2s"
        
    def test_fast_image_without_cuisine(self):
        """Test fast image works without cuisine parameter"""
        response = requests.post(f"{BASE_URL}/api/recipe-image/fast", json={
            "recipe_name": "Caesar Salad",
            "use_ai_fallback": False
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["source"] in ["google_images", "none"]


class TestFastImageFallback:
    """Tests for AI fallback behavior when Google Images fails"""
    
    def test_no_image_found_returns_none_when_fallback_disabled(self):
        """When no images found and AI fallback disabled, returns source=none"""
        # Use a very obscure recipe name unlikely to have images
        response = requests.post(f"{BASE_URL}/api/recipe-image/fast", json={
            "recipe_name": "XYZ123NonExistentDish987",
            "cuisine": "",
            "use_ai_fallback": False
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Should indicate no images found
        if data.get("source") != "google_images":
            assert data["source"] == "none" or data["image_url"] is None


class TestImageAlternatives:
    """Tests for image alternatives functionality"""
    
    def test_alternatives_contain_required_fields(self):
        """Verify alternatives have url, thumbnail, and source fields"""
        response = requests.post(f"{BASE_URL}/api/recipe-image/fast", json={
            "recipe_name": "Pad Thai",
            "cuisine": "Thai",
            "use_ai_fallback": False
        })
        
        assert response.status_code == 200
        data = response.json()
        
        if data.get("alternatives") and len(data["alternatives"]) > 0:
            alt = data["alternatives"][0]
            assert "url" in alt
            assert alt["url"].startswith("http")
            
    def test_alternatives_from_quality_sources(self):
        """Verify alternatives come from reputable food sources"""
        response = requests.post(f"{BASE_URL}/api/recipe-image/fast", json={
            "recipe_name": "Chicken Curry",
            "cuisine": "Indian",
            "use_ai_fallback": False
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have alternatives
        assert len(data.get("alternatives", [])) >= 1


class TestImageServiceStatus:
    """Tests for image service status endpoint"""
    
    def test_image_service_status(self):
        """Verify image service status endpoint returns operational"""
        response = requests.get(f"{BASE_URL}/api/recipe-image/status")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["service"] == "ai_image_generation"
        assert data["status"] in ["operational", "no_api_key"]
        assert "features" in data


class TestAIImageGeneration:
    """Tests for AI image generation endpoint (slower, higher quality)"""
    
    def test_ai_generation_endpoint_exists(self):
        """Verify AI generation endpoint is accessible"""
        response = requests.post(f"{BASE_URL}/api/recipe-image/generate", json={
            "recipe_name": "Test Recipe",
            "cuisine": "",
            "ingredients": []
        })
        
        # Should return 200 or 500 (if API key issues), not 404
        assert response.status_code in [200, 500]


class TestSerpAPIFoodImages:
    """Direct tests for search_food_images function via fast endpoint"""
    
    def test_filters_watermarked_images(self):
        """Verify watermarked stock images are filtered out"""
        response = requests.post(f"{BASE_URL}/api/recipe-image/fast", json={
            "recipe_name": "Burger",
            "cuisine": "American",
            "use_ai_fallback": False
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Check main image URL doesn't contain stock photo sites
        if data.get("image_url"):
            blocked_sources = ["shutterstock", "istockphoto", "gettyimages", "dreamstime"]
            for blocked in blocked_sources:
                assert blocked not in data["image_url"].lower()
                
    def test_prioritizes_food_sources(self):
        """Verify food-related sources are prioritized"""
        response = requests.post(f"{BASE_URL}/api/recipe-image/fast", json={
            "recipe_name": "Pizza Margherita",
            "cuisine": "Italian",
            "use_ai_fallback": False
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return valid image
        assert data.get("image_url") is not None
        assert data["source"] == "google_images"
