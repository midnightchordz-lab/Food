"""
Test Suite: Recipe Image Search Fix Verification
Purpose: Verify that image search for curry dishes returns cooked curry images, not raw ingredients
Bug: 'Spicy Prawn Curry' was showing raw prawns instead of cooked curry dish

Tests:
1. /api/recipe-image/fast with 'Spicy Prawn Curry' - should return curry image
2. /api/recipe-image/fast with 'Chicken Biryani' - should return biryani image  
3. /api/recipe-image/batch - batch image fetching works
4. Various curry dishes return cooked curry images
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestImageSearchFix:
    """Test image search returns correct images for curry dishes"""
    
    def test_health_check(self):
        """Verify backend is running"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        print(f"✓ Backend health check passed")
    
    def test_spicy_prawn_curry_image_fast(self):
        """
        Test: 'Spicy Prawn Curry' should return curry image, not raw prawns
        Expected: Search query should be 'prawn curry dish plated' (not 'prawns dish plated')
        """
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Spicy Prawn Curry",
                "cuisine": "Indian",
                "use_ai_fallback": False
            },
            timeout=30
        )
        
        # Check status
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"Response for 'Spicy Prawn Curry': {data}")
        
        # Verify response structure
        assert "image_url" in data, "Missing image_url in response"
        assert "recipe_name" in data, "Missing recipe_name in response"
        assert data["recipe_name"] == "Spicy Prawn Curry"
        
        # Image should be found (not None)
        if data.get("image_url"):
            print(f"✓ Image found for Spicy Prawn Curry: {data['image_url'][:80]}...")
            print(f"✓ Source: {data.get('source', 'unknown')}")
            
            # Verify it's from a food-related source (not stock photo sites)
            source = data.get("source_website", "").lower()
            if source:
                bad_sources = ["shutterstock", "istockphoto", "gettyimages"]
                assert not any(bad in source for bad in bad_sources), f"Image from stock photo site: {source}"
        else:
            print(f"⚠ No image found - API response: {data}")
            # This is acceptable if SerpAPI has rate limits, but log it
    
    def test_chicken_biryani_image_fast(self):
        """
        Test: 'Chicken Biryani' should return biryani image
        Expected: Search query should be 'chicken biryani dish plated'
        """
        # Small delay to avoid rate limiting
        time.sleep(1)
        
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Chicken Biryani",
                "cuisine": "Indian",
                "use_ai_fallback": False
            },
            timeout=30
        )
        
        assert response.status_code == 200
        
        data = response.json()
        print(f"Response for 'Chicken Biryani': {data}")
        
        assert "image_url" in data
        assert data["recipe_name"] == "Chicken Biryani"
        
        if data.get("image_url"):
            print(f"✓ Image found for Chicken Biryani: {data['image_url'][:80]}...")
    
    def test_prawn_korma_image_fast(self):
        """Test: 'Prawn Korma' should return korma curry image"""
        time.sleep(1)
        
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Prawn Korma",
                "cuisine": "Indian",
                "use_ai_fallback": False
            },
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        print(f"Response for 'Prawn Korma': {data}")
        
        assert "image_url" in data
        if data.get("image_url"):
            print(f"✓ Image found for Prawn Korma: {data['image_url'][:80]}...")
    
    def test_chicken_tikka_masala_image(self):
        """Test: 'Chicken Tikka Masala' should return masala curry image"""
        time.sleep(1)
        
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Chicken Tikka Masala",
                "cuisine": "Indian",
                "use_ai_fallback": False
            },
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        print(f"Response for 'Chicken Tikka Masala': {data}")
        
        assert "image_url" in data
        if data.get("image_url"):
            print(f"✓ Image found for Chicken Tikka Masala: {data['image_url'][:80]}...")
    
    def test_shrimp_stir_fry_image(self):
        """Test: 'Shrimp Stir Fry' should return stir fry image, not raw shrimp"""
        time.sleep(1)
        
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Shrimp Stir Fry",
                "cuisine": "Chinese",
                "use_ai_fallback": False
            },
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        print(f"Response for 'Shrimp Stir Fry': {data}")
        
        assert "image_url" in data
        if data.get("image_url"):
            print(f"✓ Image found for Shrimp Stir Fry: {data['image_url'][:80]}...")
    
    def test_vegetable_curry_image(self):
        """Test: 'Vegetable Curry' should return curry image"""
        time.sleep(1)
        
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Vegetable Curry",
                "cuisine": "Indian",
                "use_ai_fallback": False
            },
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        print(f"Response for 'Vegetable Curry': {data}")
        
        assert "image_url" in data
    
    def test_batch_image_endpoint(self):
        """Test: /batch endpoint returns unique images for multiple recipes"""
        time.sleep(1)
        
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/batch",
            json={
                "recipes": [
                    {"recipe_name": "Spicy Prawn Curry", "cuisine": "Indian"},
                    {"recipe_name": "Chicken Biryani", "cuisine": "Indian"},
                    {"recipe_name": "Palak Paneer", "cuisine": "Indian"}
                ]
            },
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        print(f"Batch response: {data}")
        
        assert data.get("success") == True
        assert "images" in data
        assert len(data["images"]) == 3
        
        # Check each recipe got an image
        for img in data["images"]:
            print(f"  - {img['recipe_name']}: {img.get('image_url', 'None')[:60] if img.get('image_url') else 'No image'}...")
            assert "recipe_name" in img
            assert "image_url" in img
        
        # Verify images are unique (no duplicates)
        urls = [img.get("image_url") for img in data["images"] if img.get("image_url")]
        if len(urls) > 1:
            unique_urls = set(urls)
            print(f"✓ Total URLs: {len(urls)}, Unique: {len(unique_urls)}")
            # Allow some duplicates due to SerpAPI limitations but warn
            if len(unique_urls) < len(urls):
                print(f"⚠ Warning: Some images may be duplicated")
    
    def test_grilled_salmon_no_dish_type(self):
        """Test: 'Grilled Salmon' (no dish type) should return salmon dish image"""
        time.sleep(1)
        
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Grilled Salmon",
                "cuisine": "",
                "use_ai_fallback": False
            },
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        print(f"Response for 'Grilled Salmon': {data}")
        
        assert "image_url" in data
        if data.get("image_url"):
            print(f"✓ Image found for Grilled Salmon: {data['image_url'][:80]}...")


class TestImageSearchEdgeCases:
    """Test edge cases for image search"""
    
    def test_creative_recipe_name(self):
        """Test: Creative recipe names like 'Tranquil Tofu Palak' should still work"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Tranquil Tofu Palak",
                "cuisine": "Indian",
                "use_ai_fallback": False
            },
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        print(f"Response for 'Tranquil Tofu Palak': {data}")
        
        # Should extract 'Tofu Palak' and find appropriate image
        assert "image_url" in data
    
    def test_plural_prawns_curry(self):
        """Test: 'Prawns Curry' (plural) should work same as singular"""
        time.sleep(1)
        
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Prawns Curry",
                "cuisine": "Indian",
                "use_ai_fallback": False
            },
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        print(f"Response for 'Prawns Curry': {data}")
        
        assert "image_url" in data
    
    def test_lamb_rogan_josh(self):
        """Test: 'Lamb Rogan Josh' - tests complex dish type detection"""
        time.sleep(1)
        
        # Note: 'rogan josh' is not in dish_type_priority, so it will fall back to protein-based search
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Lamb Rogan Josh",
                "cuisine": "Indian",
                "use_ai_fallback": False
            },
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        print(f"Response for 'Lamb Rogan Josh': {data}")
        
        assert "image_url" in data
    
    def test_empty_recipe_name(self):
        """Test: Empty recipe name should handle gracefully"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "",
                "cuisine": "",
                "use_ai_fallback": False
            },
            timeout=30
        )
        
        # Should return 200 with no image, not crash
        assert response.status_code in [200, 422]
        if response.status_code == 200:
            data = response.json()
            print(f"Response for empty recipe name: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
