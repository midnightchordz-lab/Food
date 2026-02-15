"""
Test Image Fallback Functionality
Tests the /api/recipe-image/fast endpoint to verify:
1. Google Images returns results for common dishes
2. AI fallback works when Google Images fails
3. Loading states and retry mechanisms work correctly
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://premium-voice-cook.preview.emergentagent.com')


class TestFastImageEndpoint:
    """Test /api/recipe-image/fast endpoint"""
    
    def test_google_images_common_dish(self):
        """Test that common dishes return Google Images results"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Grilled Chicken Salad",
                "cuisine": "American",
                "use_ai_fallback": False
            },
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have image_url
        assert "image_url" in data
        assert data["image_url"] is not None
        
        # Source should be google_images
        assert data.get("source") == "google_images"
        print(f"✓ Google Images found for 'Grilled Chicken Salad': {data.get('source')}")
    
    def test_google_images_with_alternatives(self):
        """Test that alternatives are returned"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Pasta Carbonara",
                "cuisine": "Italian",
                "use_ai_fallback": False
            },
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check for alternatives
        if data.get("source") == "google_images":
            assert "alternatives" in data
            print(f"✓ Alternatives returned: {len(data.get('alternatives', []))}")
    
    def test_ai_fallback_enabled(self):
        """Test AI fallback when use_ai_fallback=True"""
        # Use a real dish name that might not have great Google Images results
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Traditional Bavarian Leberkas",
                "cuisine": "German",
                "use_ai_fallback": True
            },
            timeout=60  # AI generation can take longer
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have image_url (from either Google or AI)
        assert "image_url" in data
        assert data["image_url"] is not None
        print(f"✓ Image returned with source: {data.get('source')}")
    
    def test_ai_generation_direct(self):
        """Test direct AI generation endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/generate",
            json={
                "recipe_name": "Healthy Quinoa Bowl with Avocado",
                "cuisine": "Health",
                "ingredients": []
            },
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "image_url" in data
        # AI generated images should be data URLs
        image_url = data.get("image_url", "")
        assert image_url.startswith("data:image") or "http" in image_url
        print(f"✓ AI generation returned image (starts with): {image_url[:50]}...")
    
    def test_response_structure(self):
        """Test response structure for fast endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Chicken Tikka Masala",
                "cuisine": "Indian",
                "use_ai_fallback": True
            },
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "image_url" in data
        assert "source" in data
        assert "recipe_name" in data
        
        # Source should be one of: google_images, ai_generated, none
        assert data["source"] in ["google_images", "ai_generated", "none", None]
        print(f"✓ Response structure valid: source={data['source']}")
    
    def test_get_endpoint(self):
        """Test GET version of fast endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/recipe-image/fast/Spaghetti%20Bolognese",
            params={"cuisine": "Italian", "use_ai_fallback": "true"},
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "image_url" in data
        print(f"✓ GET endpoint works: {data.get('source')}")
    
    def test_image_service_status(self):
        """Test image service status endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/recipe-image/status",
            timeout=10
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "service" in data
        assert "status" in data
        print(f"✓ Service status: {data.get('status')}")


class TestImageLoadingBehavior:
    """Test image loading behaviors for frontend components"""
    
    def test_multiple_dishes_batch(self):
        """Test loading images for multiple dishes (simulates planner cards)"""
        dishes = [
            ("Oatmeal with Berries", "Breakfast"),
            ("Caesar Salad", "Lunch"),
            ("Grilled Salmon", "Dinner"),
            ("Vegetable Stir Fry", "Asian"),
            ("Banana Smoothie", "Breakfast")
        ]
        
        results = []
        for dish_name, cuisine in dishes:
            response = requests.post(
                f"{BASE_URL}/api/recipe-image/fast",
                json={
                    "recipe_name": dish_name,
                    "cuisine": cuisine,
                    "use_ai_fallback": False
                },
                timeout=30
            )
            
            assert response.status_code == 200
            data = response.json()
            results.append({
                "dish": dish_name,
                "source": data.get("source"),
                "has_image": bool(data.get("image_url"))
            })
            time.sleep(0.5)  # Avoid rate limiting
        
        # Print results
        print("\n=== Batch Image Loading Results ===")
        for r in results:
            status = "✓" if r["has_image"] else "✗"
            print(f"{status} {r['dish']}: {r['source']}")
        
        # At least 80% should have images
        success_count = sum(1 for r in results if r["has_image"])
        assert success_count >= len(dishes) * 0.8
    
    def test_timeout_handling(self):
        """Test that timeout is properly handled"""
        # This tests the 30 second timeout in PlannerMealCard.jsx
        start_time = time.time()
        
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Simple Pasta",
                "cuisine": "",
                "use_ai_fallback": True
            },
            timeout=35  # Slightly longer than frontend timeout
        )
        
        elapsed = time.time() - start_time
        
        assert response.status_code == 200
        # Should respond within reasonable time
        assert elapsed < 35  # Should not timeout
        print(f"✓ Response time: {elapsed:.2f}s")


class TestFrontendIntegration:
    """Test frontend component integration requirements"""
    
    def test_planner_meal_card_flow(self):
        """
        Test the flow PlannerMealCard.jsx uses:
        1. First tries getFastImage
        2. If null, tries generateAIImage directly
        """
        # Step 1: Try fast image
        fast_response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Mediterranean Quinoa Bowl",
                "cuisine": "Mediterranean",
                "use_ai_fallback": True  # Backend will try AI if Google fails
            },
            timeout=30
        )
        
        assert fast_response.status_code == 200
        fast_data = fast_response.json()
        
        # If fast endpoint returns image, we're done
        if fast_data.get("image_url"):
            print(f"✓ Fast endpoint returned image: source={fast_data.get('source')}")
            return
        
        # Step 2: If fast returns null, frontend would call generate
        gen_response = requests.post(
            f"{BASE_URL}/api/recipe-image/generate",
            json={
                "recipe_name": "Mediterranean Quinoa Bowl",
                "cuisine": "Mediterranean"
            },
            timeout=60
        )
        
        assert gen_response.status_code == 200
        gen_data = gen_response.json()
        assert gen_data.get("image_url") is not None
        print(f"✓ AI fallback generated image successfully")
    
    def test_recipe_card_flow(self):
        """
        Test the flow RecipeMessageDisplay.js RecipeCard uses:
        Similar to PlannerMealCard but for chat recipe cards
        """
        # Test with a recipe that would come from chat
        response = requests.post(
            f"{BASE_URL}/api/recipe-image/fast",
            json={
                "recipe_name": "Energy Boosting Smoothie",
                "cuisine": "",
                "use_ai_fallback": True
            },
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return an image
        assert data.get("image_url") is not None
        print(f"✓ RecipeCard flow: source={data.get('source')}, has_image={bool(data.get('image_url'))}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
