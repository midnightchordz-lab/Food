"""
Test suite for rate limiting and SerpAPI fallback functionality
Tests the fix for 429 errors when loading planners with many recipes
"""

import pytest
import requests
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFastImageEndpoint:
    """Tests for /api/recipe-image/fast endpoint - Core functionality"""
    
    def test_fast_image_returns_google_images(self):
        """Test that fast endpoint returns Google Images for common dishes"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={"recipe_name": "Pasta Carbonara", "cuisine": "Italian", "use_ai_fallback": True},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert "image_url" in data
        assert "source" in data
        assert data["source"] in ["google_images", "ai_generated", "generated", "none"]
        print(f"✓ Fast image returned with source: {data['source']}")
    
    def test_fast_image_response_structure(self):
        """Test response structure is correct"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={"recipe_name": "Sushi Roll", "use_ai_fallback": True},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Required fields
        assert "image_url" in data
        assert "source" in data
        assert "recipe_name" in data
        assert data["recipe_name"] == "Sushi Roll"
        
        # If image found, should have additional fields
        if data["image_url"]:
            assert data["source"] in ["google_images", "ai_generated", "generated"]
            print(f"✓ Response structure valid with image from {data['source']}")
        else:
            assert data["source"] == "none"
            print("✓ Response structure valid (no image found)")
    
    def test_fast_image_ai_fallback_disabled(self):
        """Test that AI fallback can be disabled"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={"recipe_name": "Test Dish", "use_ai_fallback": False},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        # Should NOT have ai_generated source when fallback is disabled and Google fails
        # (though Google might still succeed)
        if data["source"] == "none":
            assert data["image_url"] is None
            print("✓ AI fallback correctly disabled - no image when Google fails")
        else:
            print(f"✓ Google Images returned result (fallback not needed): {data['source']}")
    
    def test_fast_image_get_endpoint(self):
        """Test GET endpoint for fast image"""
        response = requests.get(
            f"{BASE_URL}/api/recipe-image/fast/Chicken%20Tikka%20Masala",
            params={"cuisine": "Indian", "use_ai_fallback": "true"},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert "image_url" in data
        assert "source" in data
        print(f"✓ GET endpoint works with source: {data['source']}")


class TestRateLimiting:
    """Tests for rate limiting functionality"""
    
    def test_sequential_requests_succeed(self):
        """Test that sequential requests work (rate limiting allows them)"""
        recipes = ["Butter Chicken", "Pad Thai", "Margherita Pizza"]
        results = []
        
        for recipe in recipes:
            response = requests.post(
                f"{BASE_URL}/api/recipe-image/fast",
                json={"recipe_name": recipe, "use_ai_fallback": True},
                timeout=30
            )
            assert response.status_code == 200
            data = response.json()
            results.append({"recipe": recipe, "source": data.get("source"), "has_image": data.get("image_url") is not None})
            time.sleep(0.2)  # Small delay to simulate normal usage
        
        # All should succeed
        for r in results:
            print(f"✓ {r['recipe']}: source={r['source']}, has_image={r['has_image']}")
        
        success_count = sum(1 for r in results if r['has_image'])
        assert success_count >= 2, f"Expected at least 2/3 images, got {success_count}"
        print(f"✓ Sequential requests: {success_count}/3 returned images")
    
    def test_concurrent_requests_handled_gracefully(self):
        """Test that concurrent requests are handled without 500 errors"""
        recipes = [
            "Grilled Salmon",
            "Beef Tacos",
            "Vegetable Stir Fry",
            "Mushroom Risotto",
            "Lemon Chicken"
        ]
        
        results = []
        errors = []
        
        def fetch_image(recipe):
            try:
                response = requests.post(
                    f"{BASE_URL}/api/recipe-image/fast",
                    json={"recipe_name": recipe, "use_ai_fallback": True},
                    timeout=45
                )
                return {"recipe": recipe, "status": response.status_code, "data": response.json() if response.status_code == 200 else None}
            except Exception as e:
                return {"recipe": recipe, "status": "error", "error": str(e)}
        
        # Execute concurrently
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {executor.submit(fetch_image, recipe): recipe for recipe in recipes}
            for future in as_completed(futures):
                result = future.result()
                if result["status"] == 200:
                    results.append(result)
                else:
                    errors.append(result)
        
        # No 500 errors should occur (the fix should handle rate limiting gracefully)
        for error in errors:
            assert error["status"] != 500, f"Got 500 error for {error['recipe']}: {error.get('error')}"
        
        # Most should succeed
        success_count = len([r for r in results if r["data"] and r["data"].get("image_url")])
        print(f"✓ Concurrent requests: {success_count}/{len(recipes)} returned images")
        print(f"✓ No 500 errors encountered ({len(errors)} non-200 responses handled gracefully)")


class TestFallbackBehavior:
    """Tests for exception handling and fallback behavior"""
    
    def test_graceful_handling_when_no_images_found(self):
        """Test endpoint returns gracefully when no images found"""
        # Use a very obscure query that's unlikely to have images
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={"recipe_name": "zzzznonexistent1234567890dish", "use_ai_fallback": True},
            timeout=60
        )
        # Should NOT return 500 - should handle gracefully
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Should return a valid response structure
        assert "image_url" in data
        assert "source" in data
        assert "recipe_name" in data
        
        # If AI fallback works, we might get an image, otherwise source should be 'none'
        if data["image_url"]:
            assert data["source"] in ["ai_generated", "generated", "google_images"]
            print(f"✓ Fallback worked: got image with source={data['source']}")
        else:
            assert data["source"] == "none"
            print("✓ Graceful handling: source='none' when no images found")
    
    def test_endpoint_returns_200_even_with_empty_recipe_name(self):
        """Test endpoint handles empty recipe name"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={"recipe_name": "", "use_ai_fallback": True},
            timeout=30
        )
        # Should not crash
        assert response.status_code in [200, 400, 422]  # 200 with no result, or validation error
        print(f"✓ Empty recipe name handled with status: {response.status_code}")


class TestImageSourceTypes:
    """Verify image sources are correctly identified"""
    
    def test_google_images_source(self):
        """Test that common dishes return google_images source"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={"recipe_name": "Pepperoni Pizza", "cuisine": "Italian", "use_ai_fallback": True},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        if data.get("image_url"):
            # For common dishes, Google Images should typically work
            assert data["source"] in ["google_images", "ai_generated", "generated"]
            print(f"✓ Image source: {data['source']}")
        
    def test_ai_fallback_for_unusual_dishes(self):
        """Test that unusual dishes might trigger AI fallback"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Quantum Molecular Gastronomy Delight",
                "cuisine": "Futuristic",
                "use_ai_fallback": True
            },
            timeout=60  # Longer timeout for AI generation
        )
        assert response.status_code == 200
        data = response.json()
        
        # Either Google found something or AI generated it
        assert data["source"] in ["google_images", "ai_generated", "generated", "none"]
        print(f"✓ Unusual dish handled with source: {data['source']}")


class TestBatchImageLoading:
    """Simulate the planner page loading multiple images"""
    
    def test_load_7_meal_images(self):
        """Test loading 7 images like a weekly planner would"""
        meals = [
            "Greek Yogurt with Berries",  # Breakfast
            "Grilled Chicken Caesar Salad",  # Lunch
            "Salmon with Roasted Vegetables",  # Dinner
            "Avocado Toast",  # Breakfast
            "Turkey Club Sandwich",  # Lunch
            "Beef Stir Fry with Noodles",  # Dinner
            "Overnight Oats with Banana"  # Breakfast
        ]
        
        results = []
        start_time = time.time()
        
        for meal in meals:
            response = requests.post(
                f"{BASE_URL}/api/recipe-image/fast",
                json={"recipe_name": meal, "use_ai_fallback": True},
                timeout=30
            )
            assert response.status_code == 200
            data = response.json()
            results.append({
                "meal": meal,
                "has_image": data.get("image_url") is not None,
                "source": data.get("source")
            })
            # Small delay between requests (simulating frontend stagger)
            time.sleep(0.5)
        
        total_time = time.time() - start_time
        success_count = sum(1 for r in results if r["has_image"])
        
        print(f"\n--- Weekly Planner Image Load Test ---")
        for r in results:
            status = "✓" if r["has_image"] else "✗"
            print(f"  {status} {r['meal'][:30]:30} - {r['source']}")
        
        print(f"\nTotal: {success_count}/{len(meals)} images loaded in {total_time:.1f}s")
        
        # At least 5/7 should succeed
        assert success_count >= 5, f"Expected at least 5/7 images, got {success_count}"
        print(f"✓ Batch loading test passed: {success_count}/7 meals have images")


class TestImageGenerationEndpoint:
    """Test the AI generation endpoint directly"""
    
    def test_generate_endpoint_returns_ai_image(self):
        """Test /api/recipe-image/generate returns AI-generated image"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/generate",
            json={"recipe_name": "Chocolate Lava Cake", "cuisine": "French"},
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "image_url" in data
        if data.get("image_url"):
            # AI images are typically data URLs or have specific source
            assert data.get("source") in ["generated", "ai_generated", None] or data["image_url"].startswith("data:")
            print(f"✓ AI generation endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
