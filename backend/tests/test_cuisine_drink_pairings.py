"""
Test Cuisine-Specific Drink Pairings
Tests that drink pairings are DYNAMIC and specific to each recipe based on cuisine and flavors.
- Thai cuisine should show Thai-specific drinks (Thai Iced Tea, Coconut Water, Riesling)
- Italian cuisine should show Italian-specific drinks (Limoncello, Chianti, Prosecco)
- Indian cuisine should show Indian-specific drinks (Mango Lassi, Kingfisher Beer)
"""

import pytest
import requests
import os
import time
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "drinktest@test.com"
TEST_PASSWORD = "testpass123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


class TestThaiCuisineDrinkPairings:
    """Test Thai cuisine returns Thai-specific drink pairings"""
    
    def test_thai_detailed_recipe_drink_pairings(self, auth_token):
        """Test POST /api/recipes/detailed for Thai cuisine returns Thai-specific drinks"""
        # Use unique recipe name to avoid cached recipes without drink pairings
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Tom Yum Goong Soup",
                "cuisine": "Thai",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=120
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "recipe" in data
        
        recipe_content = data["recipe"].lower()
        
        # Check for drink pairings section
        assert "drink pairings" in recipe_content, "Recipe should contain drink pairings section"
        
        # Check for Thai-specific drinks (at least one should be present)
        thai_drinks = [
            "thai iced tea", "thai tea", "coconut water", "coconut", 
            "lemongrass", "ginger", "riesling", "gewürztraminer", 
            "singha", "chang", "lime", "tamarind"
        ]
        
        found_thai_drinks = [drink for drink in thai_drinks if drink in recipe_content]
        
        print(f"✓ Thai recipe drink pairings found: {found_thai_drinks}")
        assert len(found_thai_drinks) > 0, \
            f"Thai recipe should contain Thai-specific drinks. Found: {found_thai_drinks}"
        
        # Verify NOT showing generic fallback drinks
        assert "sparkling citrus mocktail" not in recipe_content, \
            "Should NOT show generic fallback 'Sparkling Citrus Mocktail'"
        assert "house wine pairing" not in recipe_content, \
            "Should NOT show generic fallback 'House Wine Pairing'"


class TestItalianCuisineDrinkPairings:
    """Test Italian cuisine returns Italian-specific drink pairings"""
    
    def test_italian_detailed_recipe_drink_pairings(self, auth_token):
        """Test POST /api/recipes/detailed for Italian cuisine returns Italian-specific drinks"""
        # Use unique recipe name to avoid cached recipes without drink pairings
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Osso Buco alla Milanese",
                "cuisine": "Italian",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=120
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "recipe" in data
        
        recipe_content = data["recipe"].lower()
        
        # Check for drink pairings section
        assert "drink pairings" in recipe_content, "Recipe should contain drink pairings section"
        
        # Check for Italian-specific drinks (at least one should be present)
        italian_drinks = [
            "limoncello", "chianti", "prosecco", "pinot grigio", 
            "sangiovese", "barolo", "montepulciano", "vermentino",
            "aperol", "negroni", "espresso", "san pellegrino",
            "italian soda", "limonata", "aranciata"
        ]
        
        found_italian_drinks = [drink for drink in italian_drinks if drink in recipe_content]
        
        print(f"✓ Italian recipe drink pairings found: {found_italian_drinks}")
        assert len(found_italian_drinks) > 0, \
            f"Italian recipe should contain Italian-specific drinks. Found: {found_italian_drinks}"
        
        # Verify NOT showing generic fallback drinks
        assert "sparkling citrus mocktail" not in recipe_content, \
            "Should NOT show generic fallback 'Sparkling Citrus Mocktail'"


class TestIndianCuisineDrinkPairings:
    """Test Indian cuisine returns Indian-specific drink pairings"""
    
    def test_indian_detailed_recipe_drink_pairings(self, auth_token):
        """Test POST /api/recipes/detailed for Indian cuisine returns Indian-specific drinks"""
        # Use unique recipe name to avoid cached recipes without drink pairings
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Lamb Rogan Josh",
                "cuisine": "Indian",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=120
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "recipe" in data
        
        recipe_content = data["recipe"].lower()
        
        # Check for drink pairings section
        assert "drink pairings" in recipe_content, "Recipe should contain drink pairings section"
        
        # Check for Indian-specific drinks (at least one should be present)
        indian_drinks = [
            "mango lassi", "lassi", "chai", "masala chai",
            "kingfisher", "cobra", "riesling", "gewürztraminer",
            "nimbu pani", "lemon water", "rose", "jaljeera",
            "buttermilk", "chaas", "thandai"
        ]
        
        found_indian_drinks = [drink for drink in indian_drinks if drink in recipe_content]
        
        print(f"✓ Indian recipe drink pairings found: {found_indian_drinks}")
        assert len(found_indian_drinks) > 0, \
            f"Indian recipe should contain Indian-specific drinks. Found: {found_indian_drinks}"
        
        # Verify NOT showing generic fallback drinks
        assert "sparkling citrus mocktail" not in recipe_content, \
            "Should NOT show generic fallback 'Sparkling Citrus Mocktail'"


class TestDrinkPairingsParsing:
    """Test that drink pairings are in the correct markdown format for frontend parsing"""
    
    def test_drink_pairings_markdown_format(self, auth_token):
        """Test that drink pairings follow the expected markdown format with bullet points"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Green Curry",
                "cuisine": "Thai",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=120
        )
        
        assert response.status_code == 200
        data = response.json()
        recipe_content = data["recipe"]
        
        # Check for drink pairings section
        drink_section_match = re.search(
            r'##\s*🍷?\s*Drink Pairings([\s\S]*?)(?=##|$)', 
            recipe_content, 
            re.IGNORECASE
        )
        
        assert drink_section_match, "Recipe should contain Drink Pairings section"
        drink_section = drink_section_match.group(1)
        
        # Check for Non-Alcoholic section
        assert "non-alcoholic" in drink_section.lower(), \
            "Drink pairings should have Non-Alcoholic section"
        
        # Check for Alcoholic section
        assert "alcoholic" in drink_section.lower(), \
            "Drink pairings should have Alcoholic section"
        
        # Check for bullet format: - **Name:** Description
        bullet_pattern = r'-?\s*\*\*([^*]+)\*\*:?\s*([^\n]+)'
        bullet_matches = re.findall(bullet_pattern, drink_section)
        
        print(f"✓ Found {len(bullet_matches)} drink pairings in bullet format")
        for name, desc in bullet_matches:
            print(f"  - {name.strip()}: {desc.strip()[:50]}...")
        
        assert len(bullet_matches) >= 2, \
            f"Should have at least 2 drink pairings (non-alcoholic + alcoholic). Found: {len(bullet_matches)}"


class TestNonGenericDrinkPairings:
    """Test that drink pairings are NOT generic fallback content"""
    
    def test_no_generic_fallback_drinks(self, auth_token):
        """Test that recipes don't show generic fallback drinks"""
        cuisines_to_test = [
            ("Pad Thai", "Thai"),
            ("Spaghetti Carbonara", "Italian"),
            ("Butter Chicken", "Indian")
        ]
        
        generic_fallbacks = [
            "sparkling citrus mocktail",
            "house wine pairing",
            "click view full recipe to load"
        ]
        
        for recipe_title, cuisine in cuisines_to_test:
            response = requests.post(
                f"{BASE_URL}/api/recipes/detailed",
                headers={"Authorization": f"Bearer {auth_token}"},
                json={
                    "recipe_title": recipe_title,
                    "cuisine": cuisine,
                    "meal_type": "Dinner",
                    "dietary_pref": "Any"
                },
                timeout=120
            )
            
            assert response.status_code == 200
            recipe_content = response.json()["recipe"].lower()
            
            for fallback in generic_fallbacks:
                assert fallback not in recipe_content, \
                    f"{cuisine} recipe '{recipe_title}' should NOT contain generic fallback: '{fallback}'"
            
            print(f"✓ {cuisine} recipe '{recipe_title}' has no generic fallback drinks")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
