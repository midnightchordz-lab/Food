"""
Ingredient Guide API Tests
Tests for Visual Ingredient Identification System
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestIngredientGuideSearch:
    """Search endpoint tests - /api/ingredients/search"""
    
    def test_search_by_name(self):
        """Search ingredients by name"""
        response = requests.get(f"{BASE_URL}/api/ingredients/search?q=cumin")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["count"] > 0
        assert len(data["results"]) > 0
        
        # Verify first result has expected fields
        result = data["results"][0]
        assert "id" in result
        assert "name" in result
        assert "display_name" in result
        assert "category" in result
    
    def test_search_by_alternate_name(self):
        """Search using alternate name (e.g., 'jeera' for cumin)"""
        response = requests.get(f"{BASE_URL}/api/ingredients/search?q=jeera")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["count"] > 0
        # Should find cumin seeds
        names = [r["name"] for r in data["results"]]
        assert "cumin seeds" in names
    
    def test_search_no_results(self):
        """Search with no matching results"""
        response = requests.get(f"{BASE_URL}/api/ingredients/search?q=xyznonexistent123")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["count"] == 0
        assert len(data["results"]) == 0


class TestIngredientGuideByName:
    """Get ingredient by name tests - /api/ingredients/name/{name}"""
    
    def test_get_by_exact_name(self):
        """Get ingredient by exact name"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/cumin seeds")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        
        ingredient = data["ingredient"]
        assert ingredient["name"] == "cumin seeds"
        assert ingredient["display_name"] == "Cumin Seeds"
        
        # Verify all expected fields exist
        assert "images" in ingredient
        assert "primary" in ingredient["images"]
        assert "appearance" in ingredient
        assert "color" in ingredient["appearance"]
        assert "shape" in ingredient["appearance"]
        assert "size" in ingredient["appearance"]
        
        assert "similar_to" in ingredient
        assert "confused_with" in ingredient
        assert "preparation_tips" in ingredient
        assert "substitutes" in ingredient
        assert "storage" in ingredient
        assert "beginner_notes" in ingredient
    
    def test_get_by_normalized_name(self):
        """Get ingredient with variations like 'cumin seeds, toasted' -> 'cumin seeds'"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/cumin seeds, toasted")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["ingredient"]["name"] == "cumin seeds"
    
    def test_get_by_name_with_quantity(self):
        """Normalize names with quantity prefixes like '2 tbsp cumin seeds'"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/2 tbsp cumin seeds")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["ingredient"]["name"] == "cumin seeds"
    
    def test_get_by_alternate_name(self):
        """Get ingredient by alternate name"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/haldi")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["ingredient"]["name"] == "turmeric powder"
    
    def test_get_not_found(self):
        """Get ingredient that doesn't exist"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/nonexistent_ingredient_xyz")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == False
        assert "searched_for" in data


class TestIngredientGuideConfusedWith:
    """Test 'Don't confuse with' warnings"""
    
    def test_cumin_confused_with_black_cumin(self):
        """Cumin should have confused_with warning for black cumin"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/cumin seeds")
        assert response.status_code == 200
        
        data = response.json()
        ingredient = data["ingredient"]
        
        assert len(ingredient["confused_with"]) > 0
        
        confused_names = [c["name"].lower() for c in ingredient["confused_with"]]
        assert any("black cumin" in name or "nigella" in name or "kalonji" in name for name in confused_names)
        
        # Verify warning exists
        for confused in ingredient["confused_with"]:
            assert "warning" in confused
            assert len(confused["warning"]) > 0
    
    def test_turmeric_confused_with_curry_powder(self):
        """Turmeric should have confused_with warning for curry powder"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/turmeric powder")
        assert response.status_code == 200
        
        data = response.json()
        ingredient = data["ingredient"]
        
        assert len(ingredient["confused_with"]) > 0
        confused_names = [c["name"].lower() for c in ingredient["confused_with"]]
        assert any("curry" in name for name in confused_names)


class TestIngredientGuideSimilarTo:
    """Test similar ingredients comparison"""
    
    def test_cumin_similar_to_caraway(self):
        """Cumin should have caraway as similar ingredient"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/cumin seeds")
        assert response.status_code == 200
        
        data = response.json()
        ingredient = data["ingredient"]
        
        assert len(ingredient["similar_to"]) > 0
        
        similar_names = [s["name"].lower() for s in ingredient["similar_to"]]
        assert any("caraway" in name for name in similar_names)
        
        # Verify differentiation info exists
        for similar in ingredient["similar_to"]:
            assert "how_to_differentiate" in similar
            assert len(similar["how_to_differentiate"]) > 0


class TestIngredientGuideSubstitutes:
    """Test substitutes information"""
    
    def test_cumin_has_substitutes(self):
        """Cumin should have substitute options"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/cumin seeds")
        assert response.status_code == 200
        
        data = response.json()
        ingredient = data["ingredient"]
        
        assert len(ingredient["substitutes"]) > 0
        
        for substitute in ingredient["substitutes"]:
            assert "name" in substitute
            assert len(substitute["name"]) > 0


class TestIngredientGuideStorage:
    """Test storage information"""
    
    def test_ingredient_has_storage_info(self):
        """Ingredients should have storage information"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/cumin seeds")
        assert response.status_code == 200
        
        data = response.json()
        storage = data["ingredient"]["storage"]
        
        assert "method" in storage
        assert "shelf_life" in storage
        assert len(storage["method"]) > 0
        assert len(storage["shelf_life"]) > 0


class TestIngredientGuideFeatured:
    """Test featured ingredients endpoint"""
    
    def test_get_featured_ingredients(self):
        """Get featured ingredients list"""
        response = requests.get(f"{BASE_URL}/api/ingredients/featured")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert len(data["ingredients"]) > 0
        
        # Verify featured ingredients have expected data
        for ing in data["ingredients"]:
            assert ing["featured"] == True
            assert "images" in ing
            assert "appearance" in ing


class TestIngredientGuideCategories:
    """Test categories endpoint"""
    
    def test_get_all_categories(self):
        """Get all ingredient categories"""
        response = requests.get(f"{BASE_URL}/api/ingredients/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert len(data["categories"]) > 0
        
        # Verify category structure
        for cat in data["categories"]:
            assert "category" in cat
            assert "count" in cat
            assert cat["count"] > 0
        
        # Check expected categories exist
        category_names = [c["category"] for c in data["categories"]]
        assert "spice_whole" in category_names
        assert "pulse_lentil" in category_names


class TestIngredientGuideAppearance:
    """Test appearance information (visual identification)"""
    
    def test_appearance_fields(self):
        """Ingredients should have complete appearance info"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/cumin seeds")
        assert response.status_code == 200
        
        data = response.json()
        appearance = data["ingredient"]["appearance"]
        
        assert "color" in appearance
        assert "shape" in appearance
        assert "size" in appearance
        assert "visual_description" in appearance
        
        assert len(appearance["color"]) > 0
        assert len(appearance["shape"]) > 0
        assert len(appearance["size"]) > 0
        assert len(appearance["visual_description"]) > 0


class TestIngredientGuideBeginnerNotes:
    """Test beginner notes for ingredients"""
    
    def test_beginner_notes_exist(self):
        """Ingredients should have beginner notes"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/cumin seeds")
        assert response.status_code == 200
        
        data = response.json()
        assert "beginner_notes" in data["ingredient"]
        assert len(data["ingredient"]["beginner_notes"]) > 0


class TestIngredientGuideByCategory:
    """Test get by category endpoint"""
    
    def test_get_spice_whole_category(self):
        """Get all whole spices"""
        response = requests.get(f"{BASE_URL}/api/ingredients/category/spice_whole")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["category"] == "spice_whole"
        assert data["count"] > 0
        
        # Verify all results are in the correct category
        for ing in data["ingredients"]:
            assert ing["category"] == "spice_whole"
    
    def test_get_pulse_category(self):
        """Get all pulses/lentils"""
        response = requests.get(f"{BASE_URL}/api/ingredients/category/pulse_lentil")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["count"] > 0
        
        for ing in data["ingredients"]:
            assert ing["category"] == "pulse_lentil"


class TestIngredientGuideImages:
    """Test image URLs are valid"""
    
    def test_primary_image_url(self):
        """Primary image URL should be present"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/cumin seeds")
        assert response.status_code == 200
        
        data = response.json()
        images = data["ingredient"]["images"]
        
        assert "primary" in images
        assert images["primary"].startswith("http")
    
    def test_comparison_images(self):
        """Comparison images should have URL and caption"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/cumin seeds")
        assert response.status_code == 200
        
        data = response.json()
        comparison = data["ingredient"]["images"]["comparison"]
        
        for img in comparison:
            if img["url"]:  # Some may be empty
                assert "caption" in img


class TestIngredientGuidePreparationTips:
    """Test preparation tips"""
    
    def test_preparation_tips_exist(self):
        """Ingredients should have preparation tips"""
        response = requests.get(f"{BASE_URL}/api/ingredients/name/cumin seeds")
        assert response.status_code == 200
        
        data = response.json()
        tips = data["ingredient"]["preparation_tips"]
        
        assert len(tips) > 0
        for tip in tips:
            assert len(tip) > 0


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
