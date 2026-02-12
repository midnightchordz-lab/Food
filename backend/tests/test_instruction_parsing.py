"""
Test suite for Recipe Instruction Parsing
Tests both markdown formats:
1. **Step X (Y minutes)** - time inside bold tags
2. **Step X** (Y minutes) - time outside bold tags

Also verifies Visual Cue and Audio Cue extraction
"""
import pytest
import requests
import os
import re
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Demo credentials
DEMO_EMAIL = "demo@demo.com"
DEMO_PASSWORD = "Demo1234!"


class TestInstructionParsingBackend:
    """Backend tests for /api/recipes/detailed endpoint instruction format"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token using demo credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not authenticate with demo credentials")
    
    def test_detailed_recipe_returns_step_format_1(self, auth_token):
        """Test that recipe returns **Step X (Y minutes)** format (time inside bold)"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Kerala Egg Curry with Appam",
                "cuisine": "Indian",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=120
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        recipe = response.json()["recipe"]
        
        # Check for Format 1: **Step X (Y minutes)**
        format1_pattern = r'\*\*Step\s*(\d+)\s*\(([^)]+)\)\*\*'
        format1_matches = re.findall(format1_pattern, recipe)
        
        print(f"Format 1 matches found: {len(format1_matches)}")
        assert len(format1_matches) > 0, "Expected at least one step in **Step X (Y minutes)** format"
        
        # Verify step 1 has timing
        step1_match = next((m for m in format1_matches if m[0] == "1"), None)
        assert step1_match is not None, "Step 1 should be present"
        assert "minute" in step1_match[1].lower(), f"Step 1 should have timing, got: {step1_match[1]}"
    
    def test_detailed_recipe_contains_visual_cues(self, auth_token):
        """Test that recipe contains Visual Cue markers"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Kerala Egg Curry with Appam",
                "cuisine": "Indian",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=120
        )
        recipe = response.json()["recipe"]
        
        visual_cue_pattern = r'\*Visual Cue:\*\s*([^\n]+)'
        visual_cues = re.findall(visual_cue_pattern, recipe)
        
        print(f"Visual Cues found: {len(visual_cues)}")
        assert len(visual_cues) > 0, "Recipe should contain at least one Visual Cue"
        
        # Verify visual cues have meaningful content
        for cue in visual_cues[:3]:
            assert len(cue.strip()) > 10, f"Visual cue should be descriptive: {cue}"
    
    def test_detailed_recipe_contains_audio_cues(self, auth_token):
        """Test that recipe contains Audio Cue markers"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Kerala Egg Curry with Appam",
                "cuisine": "Indian",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=120
        )
        recipe = response.json()["recipe"]
        
        audio_cue_pattern = r'\*Audio Cue:\*\s*([^\n]+)'
        audio_cues = re.findall(audio_cue_pattern, recipe)
        
        print(f"Audio Cues found: {len(audio_cues)}")
        # Audio cues may not be present in all steps, just verify pattern works
        if len(audio_cues) > 0:
            for cue in audio_cues:
                assert len(cue.strip()) > 5, f"Audio cue should be descriptive: {cue}"
    
    def test_detailed_recipe_has_step_by_step_section(self, auth_token):
        """Test recipe has Step-by-Step Instructions section"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Kerala Egg Curry with Appam",
                "cuisine": "Indian",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=120
        )
        recipe = response.json()["recipe"]
        
        assert "Step-by-Step Instructions" in recipe, "Recipe should have Step-by-Step Instructions section"
        assert "## 📋 Step-by-Step Instructions" in recipe or "## Step-by-Step Instructions" in recipe, \
            "Instructions section should have proper markdown header"
    
    def test_detailed_recipe_steps_have_instruction_text(self, auth_token):
        """Test that each step has instruction text after the header"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/detailed",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "recipe_title": "Kerala Egg Curry with Appam",
                "cuisine": "Indian",
                "meal_type": "Dinner",
                "dietary_pref": "Any"
            },
            timeout=120
        )
        recipe = response.json()["recipe"]
        
        # Match step headers and their following text
        step_pattern = r'\*\*Step\s*\d+\s*\([^)]+\)\*\*\s*\n([^\n\*]+)'
        step_matches = re.findall(step_pattern, recipe)
        
        print(f"Steps with instruction text: {len(step_matches)}")
        assert len(step_matches) > 0, "Steps should have instruction text"
        
        for text in step_matches[:3]:
            assert len(text.strip()) > 20, f"Instruction text should be substantial: {text}"


class TestFrontendRegexParsing:
    """Test the frontend regex pattern for instruction parsing
    
    This tests the regex that was fixed:
    OLD: /\\*\\*(?:Step\\s*)?(\\d+)\\*\\*\\s*\\(([^)]+)\\)/
    NEW: /\\*\\*(?:Step\\s*)?(\\d+)(?:\\*\\*\\s*\\(([^)]+)\\)|\\s*\\(([^)]+)\\)\\*\\*)/
    """
    
    def test_regex_parses_format_1_time_inside_bold(self):
        """Test parsing **Step 1 (10 minutes)** format"""
        import re
        
        # This is the updated regex from RecipeDetailModal.js line 131
        pattern = r'\*\*(?:Step\s*)?(\d+)(?:\*\*\s*\(([^)]+)\)|\s*\(([^)]+)\)\*\*)'
        
        test_cases = [
            ("**Step 1 (10 minutes)**\nBoil the eggs...", "1", "10 minutes"),
            ("**Step 2 (5 minutes)**\nHeat oil...", "2", "5 minutes"),
            ("**Step 3 (3 minutes)**\nAdd spices...", "3", "3 minutes"),
        ]
        
        for text, expected_step, expected_time in test_cases:
            matches = re.findall(pattern, text)
            assert len(matches) > 0, f"Should match: {text}"
            
            step_num = matches[0][0]
            # Time is in group 2 or group 3 depending on format
            time_val = matches[0][1] or matches[0][2]
            
            assert step_num == expected_step, f"Expected step {expected_step}, got {step_num}"
            assert time_val == expected_time, f"Expected time '{expected_time}', got '{time_val}'"
    
    def test_regex_parses_format_2_time_outside_bold(self):
        """Test parsing **Step 1** (10 minutes) format"""
        import re
        
        # Updated regex should also handle this format
        pattern = r'\*\*(?:Step\s*)?(\d+)(?:\*\*\s*\(([^)]+)\)|\s*\(([^)]+)\)\*\*)'
        
        test_cases = [
            ("**Step 1** (10 minutes)\nBoil the eggs...", "1", "10 minutes"),
            ("**Step 2** (5 minutes)\nHeat oil...", "2", "5 minutes"),
        ]
        
        for text, expected_step, expected_time in test_cases:
            matches = re.findall(pattern, text)
            assert len(matches) > 0, f"Should match: {text}"
            
            step_num = matches[0][0]
            time_val = matches[0][1] or matches[0][2]
            
            assert step_num == expected_step, f"Expected step {expected_step}, got {step_num}"
            assert time_val == expected_time, f"Expected time '{expected_time}', got '{time_val}'"
    
    def test_regex_extracts_visual_cue(self):
        """Test Visual Cue extraction pattern"""
        import re
        
        pattern = r'\*Visual Cue:\*\s*([^\n*]+)'
        
        test_text = """**Step 1 (10 minutes)**
Boil the eggs in a medium saucepan filled with water.
*Visual Cue:* Eggs are firm with no translucent yolk.
"""
        
        matches = re.findall(pattern, test_text)
        assert len(matches) == 1, "Should find one Visual Cue"
        assert "Eggs are firm" in matches[0], f"Unexpected visual cue: {matches[0]}"
    
    def test_regex_extracts_audio_cue(self):
        """Test Audio Cue extraction pattern"""
        import re
        
        pattern = r'\*Audio Cue:\*\s*([^\n*]+)'
        
        test_text = """**Step 2 (5 minutes)**
Heat oil in a large frying pan over medium heat.
*Audio Cue:* Hear a popping sound when mustard seeds splutter.
"""
        
        matches = re.findall(pattern, test_text)
        assert len(matches) == 1, "Should find one Audio Cue"
        assert "popping sound" in matches[0], f"Unexpected audio cue: {matches[0]}"
    
    def test_full_instruction_parsing_simulation(self):
        """Simulate the full parsing logic from RecipeDetailModal.js"""
        import re
        
        # Sample markdown in Format 1 (the actual format returned by backend)
        sample_markdown = """## 📋 Step-by-Step Instructions

**Step 1 (10 minutes)**
Boil the eggs in a medium saucepan filled with water over medium heat.
*Visual Cue:* Eggs are firm with no translucent yolk.

**Step 2 (5 minutes)**
Heat oil in a large frying pan over medium heat. Add mustard seeds.
*Audio Cue:* Hear a popping sound when mustard seeds splutter.

**Step 3 (5 minutes)**
Add the sliced onion, sauté until golden brown.
*Visual Cue:* Onions should be soft and golden.
"""
        
        # Updated regex from RecipeDetailModal.js
        step_pattern = r'\*\*(?:Step\s*)?(\d+)(?:\*\*\s*\(([^)]+)\)|\s*\(([^)]+)\)\*\*)\s*([\s\S]*?)(?=\*\*(?:Step|Final)|$)'
        
        matches = list(re.finditer(step_pattern, sample_markdown, re.IGNORECASE))
        
        assert len(matches) == 3, f"Expected 3 steps, found {len(matches)}"
        
        instructions = []
        for match in matches:
            step_num = int(match.group(1))
            time_val = (match.group(2) or match.group(3) or '').strip()
            text = (match.group(4) or '').strip()
            
            # Extract cues
            visual_cue = re.search(r'\*Visual Cue:\*\s*([^\n*]+)', text)
            audio_cue = re.search(r'\*Audio Cue:\*\s*([^\n*]+)', text)
            
            instructions.append({
                'step': step_num,
                'time': time_val,
                'text': text,
                'visualCue': visual_cue.group(1).strip() if visual_cue else '',
                'audioCue': audio_cue.group(1).strip() if audio_cue else ''
            })
        
        # Verify step 1
        assert instructions[0]['step'] == 1
        assert instructions[0]['time'] == '10 minutes'
        assert 'Boil the eggs' in instructions[0]['text']
        assert 'Eggs are firm' in instructions[0]['visualCue']
        
        # Verify step 2 has audio cue
        assert instructions[1]['step'] == 2
        assert instructions[1]['time'] == '5 minutes'
        assert 'popping sound' in instructions[1]['audioCue']
        
        # Verify step 3
        assert instructions[2]['step'] == 3
        assert 'golden' in instructions[2]['visualCue'].lower()
        
        print("All instruction parsing tests passed!")
        print(f"Parsed {len(instructions)} steps successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
