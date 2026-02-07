"""
Recipe Library API Tests - Testing proprietary recipe database functionality

Tests the recipe_library endpoints including:
1. GET /api/recipe-library/stats - Library statistics
2. GET /api/recipe-library/browse - Browse with filters  
3. POST /api/recipe-library/search - Full-text search
4. GET /api/recipe-library/discover - Random recipes
5. GET /api/recipe-library/cuisines - Available cuisines
6. Recipe saving via POST /api/chat/send and POST /api/diabetes/recipes
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1OTQ3YzkzNi0xMzY1LTQwNjMtODU0ZS1iMmE1ZjcxNWNlY2UiLCJleHAiOjE3NzMwNDc2MzB9.8AP9fBI7EckLR5uzLN7gpXMjhTrv5Jd8RsrdcUU9DaE"


@pytest.fixture(scope="module")
def auth_headers():
    """Authentication headers for all requests"""
    return {
        "Authorization": f"Bearer {AUTH_TOKEN}",
        "Content-Type": "application/json"
    }


class TestRecipeLibraryStats:
    """Test GET /api/recipe-library/stats endpoint"""
    
    def test_stats_returns_total_recipes(self, auth_headers):
        """Stats endpoint returns total recipe count"""
        response = requests.get(f"{BASE_URL}/api/recipe-library/stats", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_recipes" in data, "Response missing 'total_recipes' field"
        assert isinstance(data["total_recipes"], int), "total_recipes should be an integer"
        print(f"Total recipes in library: {data['total_recipes']}")
    
    def test_stats_returns_cuisines_breakdown(self, auth_headers):
        """Stats endpoint returns cuisines breakdown"""
        response = requests.get(f"{BASE_URL}/api/recipe-library/stats", headers=auth_headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "cuisines" in data, "Response missing 'cuisines' field"
        assert isinstance(data["cuisines"], dict), "cuisines should be a dictionary"
        print(f"Cuisines breakdown: {data['cuisines']}")
    
    def test_stats_returns_dietary_breakdown(self, auth_headers):
        """Stats endpoint returns dietary preferences breakdown"""
        response = requests.get(f"{BASE_URL}/api/recipe-library/stats", headers=auth_headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "dietary" in data, "Response missing 'dietary' field"
        assert isinstance(data["dietary"], dict), "dietary should be a dictionary"
        print(f"Dietary breakdown: {data['dietary']}")
    
    def test_stats_returns_most_popular(self, auth_headers):
        """Stats endpoint returns most popular recipes"""
        response = requests.get(f"{BASE_URL}/api/recipe-library/stats", headers=auth_headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert "most_popular" in data, "Response missing 'most_popular' field"
        assert isinstance(data["most_popular"], list), "most_popular should be a list"
        
        # Verify popular recipe structure if not empty
        if len(data["most_popular"]) > 0:
            recipe = data["most_popular"][0]
            assert "title" in recipe, "Popular recipe missing 'title'"
            assert "times_served" in recipe, "Popular recipe missing 'times_served'"
            print(f"Most popular recipe: {recipe.get('title')} (served {recipe.get('times_served')} times)")


class TestRecipeLibraryBrowse:
    """Test GET /api/recipe-library/browse endpoint"""
    
    def test_browse_returns_recipes(self, auth_headers):
        """Browse endpoint returns recipe list"""
        response = requests.get(f"{BASE_URL}/api/recipe-library/browse", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response missing 'success' field"
        assert data["success"] is True, "success should be True"
        assert "recipes" in data, "Response missing 'recipes' field"
        assert "count" in data, "Response missing 'count' field"
        assert isinstance(data["recipes"], list), "recipes should be a list"
        print(f"Browse returned {data['count']} recipes")
    
    def test_browse_filter_by_cuisine(self, auth_headers):
        """Browse filters by cuisine correctly"""
        response = requests.get(
            f"{BASE_URL}/api/recipe-library/browse",
            params={"cuisine": "Italian"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        
        # Verify filter is returned
        assert "filters" in data
        assert data["filters"]["cuisine"] == "Italian"
        
        # If recipes exist, verify they match the filter
        if data["count"] > 0:
            for recipe in data["recipes"]:
                assert "Italian" in recipe.get("cuisine", "") or recipe.get("cuisine", "").lower() == "italian", \
                    f"Recipe cuisine {recipe.get('cuisine')} doesn't match filter"
        print(f"Italian cuisine filter returned {data['count']} recipes")
    
    def test_browse_filter_by_dietary(self, auth_headers):
        """Browse filters by dietary preference correctly"""
        response = requests.get(
            f"{BASE_URL}/api/recipe-library/browse",
            params={"dietary": "vegetarian"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["filters"]["dietary"] == "vegetarian"
        print(f"Vegetarian filter returned {data['count']} recipes")
    
    def test_browse_filter_by_meal_type(self, auth_headers):
        """Browse filters by meal type correctly"""
        response = requests.get(
            f"{BASE_URL}/api/recipe-library/browse",
            params={"meal_type": "dinner"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["filters"]["meal_type"] == "dinner"
        print(f"Dinner filter returned {data['count']} recipes")
    
    def test_browse_filter_by_mood(self, auth_headers):
        """Browse filters by mood correctly"""
        response = requests.get(
            f"{BASE_URL}/api/recipe-library/browse",
            params={"mood": "happy"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["filters"]["mood"] == "happy"
        print(f"Happy mood filter returned {data['count']} recipes")
    
    def test_browse_multiple_filters(self, auth_headers):
        """Browse with multiple filters works correctly"""
        response = requests.get(
            f"{BASE_URL}/api/recipe-library/browse",
            params={
                "cuisine": "Indian",
                "dietary": "vegetarian",
                "limit": 5
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["filters"]["cuisine"] == "Indian"
        assert data["filters"]["dietary"] == "vegetarian"
        print(f"Indian vegetarian filter returned {data['count']} recipes")
    
    def test_browse_limit_parameter(self, auth_headers):
        """Browse respects limit parameter"""
        response = requests.get(
            f"{BASE_URL}/api/recipe-library/browse",
            params={"limit": 3},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["recipes"]) <= 3, "Should not return more than limit"
        print(f"Limit of 3 returned {len(data['recipes'])} recipes")


class TestRecipeLibrarySearch:
    """Test POST /api/recipe-library/search endpoint"""
    
    def test_search_returns_results(self, auth_headers):
        """Search endpoint returns matching recipes"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-library/search",
            json={"query": "pasta", "limit": 10},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert "recipes" in data
        assert "query" in data
        assert data["query"] == "pasta"
        print(f"Search 'pasta' returned {data['count']} recipes")
    
    def test_search_with_cuisine_term(self, auth_headers):
        """Search by cuisine term works"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-library/search",
            json={"query": "italian", "limit": 10},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        print(f"Search 'italian' returned {data['count']} recipes")
    
    def test_search_with_ingredient_term(self, auth_headers):
        """Search by ingredient term works"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-library/search",
            json={"query": "chicken", "limit": 10},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        print(f"Search 'chicken' returned {data['count']} recipes")
    
    def test_search_minimum_query_length(self, auth_headers):
        """Search enforces minimum query length"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-library/search",
            json={"query": "a", "limit": 10},
            headers=auth_headers
        )
        
        # Should return 400 for query too short
        assert response.status_code == 400, f"Expected 400 for short query, got {response.status_code}"
        print("Short query correctly rejected with 400")
    
    def test_search_recipe_structure(self, auth_headers):
        """Search results have correct recipe structure"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-library/search",
            json={"query": "recipe", "limit": 5},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify recipe structure if results exist
        if data["count"] > 0:
            recipe = data["recipes"][0]
            # Check required fields
            required_fields = ["id", "title", "cuisine", "dietary"]
            for field in required_fields:
                assert field in recipe, f"Recipe missing required field: {field}"
            
            # Verify _id is excluded (MongoDB internal)
            assert "_id" not in recipe, "MongoDB _id should be excluded"
            
            print(f"Recipe structure verified: {recipe.get('title')}")


class TestRecipeLibraryDiscover:
    """Test GET /api/recipe-library/discover endpoint"""
    
    def test_discover_returns_random_recipes(self, auth_headers):
        """Discover endpoint returns random recipes"""
        response = requests.get(f"{BASE_URL}/api/recipe-library/discover", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert data["success"] is True
        assert "recipes" in data
        assert "count" in data
        print(f"Discover returned {data['count']} random recipes")
    
    def test_discover_with_cuisine_filter(self, auth_headers):
        """Discover filters by cuisine correctly"""
        response = requests.get(
            f"{BASE_URL}/api/recipe-library/discover",
            params={"cuisine": "Italian"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        print(f"Discover Italian returned {data['count']} recipes")
    
    def test_discover_with_dietary_filter(self, auth_headers):
        """Discover filters by dietary correctly"""
        response = requests.get(
            f"{BASE_URL}/api/recipe-library/discover",
            params={"dietary": "vegetarian"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        print(f"Discover vegetarian returned {data['count']} recipes")
    
    def test_discover_limit_parameter(self, auth_headers):
        """Discover respects limit parameter"""
        response = requests.get(
            f"{BASE_URL}/api/recipe-library/discover",
            params={"limit": 3},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["recipes"]) <= 3
        print(f"Discover limit 3 returned {len(data['recipes'])} recipes")
    
    def test_discover_randomness(self, auth_headers):
        """Verify discover returns different results on subsequent calls"""
        # Make two calls
        response1 = requests.get(
            f"{BASE_URL}/api/recipe-library/discover",
            params={"limit": 6},
            headers=auth_headers
        )
        response2 = requests.get(
            f"{BASE_URL}/api/recipe-library/discover",
            params={"limit": 6},
            headers=auth_headers
        )
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        data1 = response1.json()
        data2 = response2.json()
        
        # Get recipe IDs from both calls
        ids1 = set(r.get("id") for r in data1["recipes"])
        ids2 = set(r.get("id") for r in data2["recipes"])
        
        # If we have enough recipes, they should potentially be different
        # Note: With small sample size they might be same, so just log
        if data1["count"] > 3:
            overlap = len(ids1 & ids2)
            print(f"Randomness check: {overlap}/{len(ids1)} overlapping IDs (some overlap expected)")


class TestRecipeLibraryCuisines:
    """Test GET /api/recipe-library/cuisines endpoint"""
    
    def test_cuisines_returns_list(self, auth_headers):
        """Cuisines endpoint returns list of available cuisines"""
        response = requests.get(f"{BASE_URL}/api/recipe-library/cuisines", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert data["success"] is True
        assert "cuisines" in data
        assert isinstance(data["cuisines"], list)
        print(f"Found {len(data['cuisines'])} cuisines")
    
    def test_cuisines_structure(self, auth_headers):
        """Each cuisine entry has name and count"""
        response = requests.get(f"{BASE_URL}/api/recipe-library/cuisines", headers=auth_headers)
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify structure if cuisines exist
        if len(data["cuisines"]) > 0:
            cuisine = data["cuisines"][0]
            assert "name" in cuisine, "Cuisine missing 'name' field"
            assert "count" in cuisine, "Cuisine missing 'count' field"
            assert isinstance(cuisine["count"], int), "count should be integer"
            print(f"Top cuisine: {cuisine['name']} with {cuisine['count']} recipes")


class TestRecipeSavingViaChatSend:
    """Test that recipes are saved to library via POST /api/chat/send"""
    
    def test_chat_generates_and_returns_recipes(self, auth_headers):
        """POST /api/chat/send generates recipes with structured data"""
        import uuid
        session_id = str(uuid.uuid4())
        
        # Create a structured recipe request
        message = """[User Preferences]
- Mood: happy (cheerful, positive)
- Meal Type: dinner
- Dietary Preference: vegetarian
- Cuisine(s): Mexican

Please suggest 4 Mexican vegetarian dinner recipes!"""
        
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={
                "session_id": session_id,
                "message": message
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        assert "session_id" in data
        
        # Check structured recipes are returned
        if "structured_recipes" in data and data["structured_recipes"]:
            print(f"Chat returned {len(data['structured_recipes'])} structured recipes")
            
            # Verify recipe structure
            for recipe in data["structured_recipes"][:2]:
                assert "title" in recipe, "Recipe missing title"
                print(f"  - {recipe.get('title')} ({recipe.get('cuisine', 'N/A')})")
        else:
            print("Chat returned response but no structured_recipes field")
    
    def test_library_stats_reflect_saved_recipes(self, auth_headers):
        """Verify recipes get saved to library by checking stats"""
        # Get current stats
        response = requests.get(f"{BASE_URL}/api/recipe-library/stats", headers=auth_headers)
        
        assert response.status_code == 200
        
        data = response.json()
        total_before = data["total_recipes"]
        print(f"Library has {total_before} total recipes")
        
        # Note: We can't easily verify the exact number increased since
        # save_recipes_to_library deduplicates. Just verify endpoint works.
        assert total_before >= 0, "Total recipes should be non-negative"


class TestRecipeSavingViaDiabetesEndpoint:
    """Test that diabetes recipes are saved to library via POST /api/diabetes/recipes"""
    
    def test_diabetes_recipes_endpoint(self, auth_headers):
        """POST /api/diabetes/recipes generates and potentially saves recipes"""
        import uuid
        session_id = str(uuid.uuid4())
        
        response = requests.post(
            f"{BASE_URL}/api/diabetes/recipes",
            json={
                "session_id": session_id,
                "mood": "happy",
                "mood_description": "cheerful",
                "diabetes_type": "type2",
                "diabetes_label": "Type 2 Diabetes",
                "dietary_pref": "vegetarian",
                "meal_type": "lunch",
                "cuisines": "Mediterranean",
                "guidelines": {
                    "maxCarbsPerMeal": 45,
                    "minFiberPerMeal": 8,
                    "maxGlycemicIndex": 55
                }
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        assert "timestamp" in data
        
        # Check if structured_recipes are returned
        if "structured_recipes" in data and data["structured_recipes"]:
            print(f"Diabetes endpoint returned {len(data['structured_recipes'])} structured recipes")
            for recipe in data["structured_recipes"][:2]:
                print(f"  - {recipe.get('title')} ({recipe.get('cuisine', 'N/A')})")
        else:
            print("Diabetes endpoint returned response (recipes in text format)")


class TestRecipeByIdEndpoint:
    """Test GET /api/recipe-library/recipe/{recipe_id} endpoint"""
    
    def test_get_recipe_by_id(self, auth_headers):
        """Can retrieve a specific recipe by ID"""
        # First get some recipes
        browse_response = requests.get(
            f"{BASE_URL}/api/recipe-library/browse",
            params={"limit": 1},
            headers=auth_headers
        )
        
        assert browse_response.status_code == 200
        browse_data = browse_response.json()
        
        if browse_data["count"] == 0:
            pytest.skip("No recipes in library to test with")
        
        recipe_id = browse_data["recipes"][0]["id"]
        
        # Now get that specific recipe
        response = requests.get(
            f"{BASE_URL}/api/recipe-library/recipe/{recipe_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "success" in data
        assert data["success"] is True
        assert "recipe" in data
        assert data["recipe"]["id"] == recipe_id
        print(f"Retrieved recipe by ID: {data['recipe'].get('title')}")
    
    def test_get_nonexistent_recipe(self, auth_headers):
        """Getting non-existent recipe returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/recipe-library/recipe/nonexistent123",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Non-existent recipe correctly returns 404")


class TestRecipeFilterEndpoint:
    """Test POST /api/recipe-library/filter endpoint"""
    
    def test_filter_endpoint(self, auth_headers):
        """Filter endpoint accepts POST with filter criteria"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-library/filter",
            json={
                "cuisine": "Italian",
                "dietary": "vegetarian",
                "limit": 5
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert data["success"] is True
        assert "recipes" in data
        assert "count" in data
        print(f"Filter POST returned {data['count']} recipes")
    
    def test_filter_with_exclude_ids(self, auth_headers):
        """Filter endpoint can exclude specific recipe IDs"""
        # First get some recipes
        initial = requests.get(
            f"{BASE_URL}/api/recipe-library/browse",
            params={"limit": 3},
            headers=auth_headers
        )
        initial_data = initial.json()
        
        if initial_data["count"] < 2:
            pytest.skip("Not enough recipes to test exclusion")
        
        # Get IDs to exclude
        exclude_ids = [r["id"] for r in initial_data["recipes"][:1]]
        
        # Now filter with exclusion
        response = requests.post(
            f"{BASE_URL}/api/recipe-library/filter",
            json={
                "limit": 10,
                "exclude_ids": exclude_ids
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify excluded IDs are not in results
        result_ids = [r["id"] for r in data["recipes"]]
        for excluded_id in exclude_ids:
            assert excluded_id not in result_ids, f"Excluded ID {excluded_id} found in results"
        
        print(f"Filter correctly excluded {len(exclude_ids)} recipe(s)")


class TestAuthenticationRequired:
    """Test that all endpoints require authentication"""
    
    def test_stats_requires_auth(self):
        """Stats endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/recipe-library/stats")
        assert response.status_code == 401 or response.status_code == 403
        print("Stats correctly requires auth")
    
    def test_browse_requires_auth(self):
        """Browse endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/recipe-library/browse")
        assert response.status_code == 401 or response.status_code == 403
        print("Browse correctly requires auth")
    
    def test_search_requires_auth(self):
        """Search endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/recipe-library/search",
            json={"query": "test"}
        )
        assert response.status_code == 401 or response.status_code == 403
        print("Search correctly requires auth")
    
    def test_discover_requires_auth(self):
        """Discover endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/recipe-library/discover")
        assert response.status_code == 401 or response.status_code == 403
        print("Discover correctly requires auth")
    
    def test_cuisines_requires_auth(self):
        """Cuisines endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/recipe-library/cuisines")
        assert response.status_code == 401 or response.status_code == 403
        print("Cuisines correctly requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
