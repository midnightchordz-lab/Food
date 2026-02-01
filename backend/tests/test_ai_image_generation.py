"""
Test AI Image Generation API
Tests the /api/recipe-image/* endpoints for AI-generated recipe images
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAIImageGenerationAPI:
    """Tests for AI-powered recipe image generation"""
    
    def test_image_service_status(self):
        """Test that the image service status endpoint returns operational"""
        response = requests.get(f"{BASE_URL}/api/recipe-image/status")
        assert response.status_code == 200
        
        data = response.json()
        assert data["service"] == "ai_image_generation"
        assert data["status"] == "operational"
        assert data["model"] == "gpt-image-1"
        assert "ai_generation" in data["features"]
        assert "caching" in data["features"]
        print(f"✓ Image service status: {data['status']}")
    
    def test_generate_recipe_image_basic(self):
        """Test basic AI image generation for a recipe"""
        payload = {
            "recipe_name": "Teriyaki Salmon",
            "cuisine": "Japanese",
            "ingredients": ["salmon", "soy sauce", "mirin"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/generate",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "image_url" in data
        assert "source" in data
        assert "recipe_name" in data
        
        # Verify image_url is a data URL (base64 encoded)
        assert data["image_url"].startswith("data:image/png;base64,")
        
        # Verify source is either cached or generated
        assert data["source"] in ["cached", "generated", "fallback_static"]
        
        print(f"✓ Generated image for '{payload['recipe_name']}' - source: {data['source']}")
    
    def test_generate_image_different_cuisines(self):
        """Test AI image generation for different cuisines"""
        test_recipes = [
            {"recipe_name": "Pad Thai", "cuisine": "Thai", "ingredients": ["rice noodles", "shrimp"]},
            {"recipe_name": "Butter Chicken", "cuisine": "Indian", "ingredients": ["chicken", "butter", "tomato"]},
            {"recipe_name": "Spaghetti Carbonara", "cuisine": "Italian", "ingredients": ["pasta", "bacon", "egg"]}
        ]
        
        for recipe in test_recipes:
            response = requests.post(
                f"{BASE_URL}/api/recipe-image/generate",
                json=recipe
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "image_url" in data
            assert data["recipe_name"] == recipe["recipe_name"]
            print(f"✓ Generated image for '{recipe['recipe_name']}' ({recipe['cuisine']})")
    
    def test_image_caching(self):
        """Test that images are cached and returned faster on subsequent requests"""
        payload = {
            "recipe_name": "TEST_Miso Soup",
            "cuisine": "Japanese",
            "ingredients": ["miso paste", "tofu", "seaweed"]
        }
        
        # First request - should generate new image
        start_time = time.time()
        response1 = requests.post(
            f"{BASE_URL}/api/recipe-image/generate",
            json=payload
        )
        first_request_time = time.time() - start_time
        
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Second request - should return cached image
        start_time = time.time()
        response2 = requests.post(
            f"{BASE_URL}/api/recipe-image/generate",
            json=payload
        )
        second_request_time = time.time() - start_time
        
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Verify caching works - second request should be from cache
        assert data2["source"] == "cached"
        
        # Cached request should be faster (or at least not significantly slower)
        print(f"✓ First request: {first_request_time:.2f}s, Second request (cached): {second_request_time:.2f}s")
        print(f"✓ Caching verified - source: {data2['source']}")
    
    def test_generate_image_minimal_params(self):
        """Test image generation with minimal parameters (just recipe name)"""
        payload = {
            "recipe_name": "Chicken Tikka Masala"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/generate",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "image_url" in data
        print(f"✓ Generated image with minimal params for '{payload['recipe_name']}'")
    
    def test_get_cached_image_endpoint(self):
        """Test the GET cached image endpoint"""
        recipe_name = "Ramen"
        cuisine = "Japanese"
        
        response = requests.get(
            f"{BASE_URL}/api/recipe-image/cached/{recipe_name}",
            params={"cuisine": cuisine}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "image_url" in data
        print(f"✓ Retrieved cached/generated image for '{recipe_name}'")
    
    def test_batch_image_generation(self):
        """Test batch image generation for multiple recipes"""
        payload = {
            "recipes": [
                {"recipe_name": "Sushi Roll", "cuisine": "Japanese", "ingredients": ["rice", "fish"]},
                {"recipe_name": "Tacos", "cuisine": "Mexican", "ingredients": ["tortilla", "beef"]}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/generate-batch",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "results" in data
        assert len(data["results"]) == 2
        
        for result in data["results"]:
            assert "image_url" in result or "error" in result
            if "image_url" in result:
                print(f"✓ Batch generated image for '{result.get('recipe_name', 'unknown')}'")
    
    def test_invalid_request_handling(self):
        """Test that invalid requests are handled gracefully"""
        # Empty recipe name
        payload = {
            "recipe_name": "",
            "cuisine": "Japanese"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/generate",
            json=payload
        )
        
        # Should still return 200 with fallback image or handle gracefully
        # The API should not crash
        assert response.status_code in [200, 400, 422]
        print(f"✓ Empty recipe name handled with status: {response.status_code}")


class TestImageGenerationIntegration:
    """Integration tests for image generation with the recipe flow"""
    
    def test_image_url_format(self):
        """Verify the image URL format is correct for frontend consumption"""
        payload = {
            "recipe_name": "Green Curry",
            "cuisine": "Thai"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/generate",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        image_url = data["image_url"]
        
        # Should be a data URL that can be used directly in img src
        if image_url.startswith("data:"):
            assert "base64," in image_url
            # Extract base64 part and verify it's valid
            base64_part = image_url.split("base64,")[1]
            assert len(base64_part) > 100  # Should have substantial content
            print(f"✓ Image URL is valid data URL format (length: {len(base64_part)} chars)")
        else:
            # Fallback URL should be a valid HTTP URL
            assert image_url.startswith("http")
            print(f"✓ Image URL is valid HTTP URL: {image_url[:50]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
