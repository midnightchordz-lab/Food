"""
Diabetes-Focused Meal Planner
Generates weekly meal plans specifically designed for blood sugar control
with strict adherence to food exclusions/allergies
"""
from emergentintegrations.llm.chat import LlmChat, UserMessage
import os
import json
import logging
import re
from typing import List, Optional, Set

# Diabetes types and their dietary requirements
DIABETES_MEAL_GUIDELINES = {
    "type1": {
        "name": "Type 1 Diabetes",
        "carb_target": "45-60g per meal",
        "focus": "Consistent carb counting, balanced meals",
        "avoid": "Large carb loads, sugary drinks",
        "prefer": "Complex carbs, lean proteins, healthy fats"
    },
    "type2": {
        "name": "Type 2 Diabetes", 
        "carb_target": "30-45g per meal",
        "focus": "Weight management, insulin sensitivity",
        "avoid": "Refined carbs, added sugars, saturated fats",
        "prefer": "High fiber, lean proteins, non-starchy vegetables"
    },
    "gestational": {
        "name": "Gestational Diabetes",
        "carb_target": "30-45g per meal",
        "focus": "Fetal health, blood sugar stability",
        "avoid": "Large meals, high GI foods",
        "prefer": "Frequent small meals, folate-rich foods, iron"
    },
    "prediabetes": {
        "name": "Pre-Diabetes",
        "carb_target": "45-60g per meal", 
        "focus": "Prevention, weight loss if needed",
        "avoid": "Processed foods, sugary beverages",
        "prefer": "Whole grains, vegetables, lean proteins"
    }
}

# Ingredient alias mapping for exclusion checking
INGREDIENT_ALIASES = {
    'shellfish': ['shrimp', 'shrimps', 'prawn', 'prawns', 'crab', 'lobster', 'crayfish', 'clam', 'mussel', 'oyster', 'scallop'],
    'shrimp': ['shrimp', 'shrimps', 'prawn', 'prawns', 'gambas', 'scampi', 'langostino'],
    'chicken': ['chicken', 'poultry', 'chicken breast', 'chicken thigh', 'chicken tikka', 'butter chicken', 'tandoori'],
    'beef': ['beef', 'steak', 'ground beef', 'veal', 'brisket', 'sirloin', 'ribeye', 'kofta', 'keema'],
    'lamb': ['lamb', 'mutton', 'lamb chop', 'lamb kebab', 'lamb curry'],
    'pork': ['pork', 'bacon', 'ham', 'sausage', 'prosciutto', 'chorizo'],
    'fish': ['fish', 'cod', 'tilapia', 'bass', 'trout', 'halibut', 'sardine', 'mackerel'],
    'salmon': ['salmon', 'lox', 'smoked salmon'],
    'eggs': ['egg', 'eggs', 'omelette', 'omelet'],
    'dairy': ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'paneer', 'ghee'],
    'peanuts': ['peanut', 'peanuts', 'groundnut'],
    'tree_nuts': ['almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'hazelnut'],
    'gluten': ['wheat', 'bread', 'pasta', 'flour', 'naan', 'roti', 'barley', 'rye'],
    'soy': ['soy', 'tofu', 'tempeh', 'edamame', 'soy sauce']
}


def get_all_excluded_terms(excluded_names: List[str]) -> Set[str]:
    """Get all excluded terms including aliases"""
    all_terms = set()
    for excluded in excluded_names:
        excluded_lower = excluded.lower().strip()
        all_terms.add(excluded_lower)
        if excluded_lower in INGREDIENT_ALIASES:
            all_terms.update([a.lower() for a in INGREDIENT_ALIASES[excluded_lower]])
        for key, aliases in INGREDIENT_ALIASES.items():
            if excluded_lower in [a.lower() for a in aliases]:
                all_terms.update([a.lower() for a in aliases])
    return all_terms


def filter_diabetes_meal_plan(meals: dict, excluded_names: List[str]) -> dict:
    """Filter meals containing excluded ingredients and replace with safe alternatives"""
    if not excluded_names:
        return meals
    
    all_excluded_terms = get_all_excluded_terms(excluded_names)
    filtered_meals = {}
    
    # Diabetes-safe replacement meals
    safe_replacements = {
        "breakfast": [
            "Greek yogurt parfait with berries (~25g carbs)",
            "Vegetable egg white frittata (~15g carbs)",
            "Overnight oats with chia seeds (~35g carbs)",
            "Avocado toast on whole grain (~30g carbs)",
            "Spinach smoothie bowl (~25g carbs)"
        ],
        "lunch": [
            "Mediterranean quinoa bowl (~40g carbs)",
            "Grilled vegetable wrap (~35g carbs)",
            "Lentil soup with side salad (~30g carbs)",
            "Cauliflower rice stir-fry (~20g carbs)",
            "Turkey lettuce wraps (~15g carbs)"
        ],
        "dinner": [
            "Grilled salmon with roasted vegetables (~25g carbs)",
            "Herb-crusted tofu with quinoa (~35g carbs)",
            "Lean beef stir-fry with brown rice (~40g carbs)",
            "Baked cod with sweet potato (~35g carbs)",
            "Vegetable curry with cauliflower rice (~25g carbs)"
        ]
    }
    
    replacement_idx = {"breakfast": 0, "lunch": 0, "dinner": 0}
    
    for day, day_meals in meals.items():
        filtered_day = {}
        for meal_type, meal_value in day_meals.items():
            if meal_type not in ["breakfast", "lunch", "dinner"]:
                filtered_day[meal_type] = meal_value
                continue
            
            meal_name = str(meal_value).lower()
            contains_excluded = False
            
            for term in all_excluded_terms:
                pattern = r'\b' + re.escape(term) + r'(?:s|es)?\b'
                if re.search(pattern, meal_name):
                    logging.warning(f"DIABETES MEAL SAFETY: Replacing {meal_type} '{meal_value}' due to '{term}'")
                    contains_excluded = True
                    break
            
            if contains_excluded:
                # Get a safe replacement
                replacements = safe_replacements.get(meal_type, safe_replacements["lunch"])
                idx = replacement_idx[meal_type] % len(replacements)
                filtered_day[meal_type] = replacements[idx]
                replacement_idx[meal_type] += 1
            else:
                filtered_day[meal_type] = meal_value
        
        filtered_meals[day] = filtered_day
    
    return filtered_meals


async def generate_diabetes_weekly_meal_plan(
    user,
    diabetes_type: str = "type2",
    dietary_preference = "non-vegetarian",  # Can be string or list
    cuisine_preferences: Optional[List[str]] = None,
    user_exclusions: Optional[List[str]] = None,
    calorie_target: Optional[int] = None,
    day_specific_preferences: Optional[dict] = None  # e.g., {"Tuesday": "Vegetarian"}
):
    """
    Generate a diabetes-optimized weekly meal plan with strict exclusion adherence
    Supports multiple dietary preferences and day-specific opt-outs
    """
    guidelines = DIABETES_MEAL_GUIDELINES.get(diabetes_type, DIABETES_MEAL_GUIDELINES["type2"])
    
    # Handle multiple dietary preferences
    if isinstance(dietary_preference, list):
        dietary_pref_str = ' + '.join(dietary_preference)
        dietary_instruction = f"""
DIETARY PREFERENCES (MIXED): {dietary_pref_str}
- Create a variety of meals mixing these preferences throughout the week
- Some days can have {dietary_preference[0]} meals, others {dietary_preference[1] if len(dietary_preference) > 1 else dietary_preference[0]} meals
"""
    else:
        dietary_pref_str = dietary_preference
        dietary_instruction = f"DIETARY PREFERENCE: {dietary_preference}"
    
    # Handle day-specific opt-outs (e.g., no non-veg on Tuesday)
    day_specific_instruction = ""
    if day_specific_preferences:
        day_specific_instruction = "\n🗓️ DAY-SPECIFIC PREFERENCES:\n"
        for day, pref in day_specific_preferences.items():
            day_specific_instruction += f"- {day}: {pref} meals ONLY\n"
    
    # Build exclusion instruction
    exclusion_instruction = ""
    if user_exclusions and len(user_exclusions) > 0:
        all_excluded_terms = get_all_excluded_terms(user_exclusions)
        exclusion_instruction = f"""
🚨 CRITICAL FOOD RESTRICTIONS - USER HAS ALLERGIES:
NEVER include these ingredients: {', '.join(sorted(all_excluded_terms))}
- If shrimp is banned, prawns are also banned (same thing)
- If chicken is banned, all poultry is banned
- Choose alternative proteins instead
"""

    # Calorie distribution for diabetes
    calorie_info = ""
    if calorie_target:
        breakfast_cal = int(calorie_target * 0.25)
        lunch_cal = int(calorie_target * 0.35) 
        dinner_cal = int(calorie_target * 0.40)
        calorie_info = f"""
CALORIE TARGETS:
- Daily: {calorie_target} cal
- Breakfast: ~{breakfast_cal} cal
- Lunch: ~{lunch_cal} cal
- Dinner: ~{dinner_cal} cal
"""

    system_message = f"""You are an expert diabetes nutritionist creating weekly meal plans.

DIABETES TYPE: {guidelines['name']}
CARB TARGET: {guidelines['carb_target']}
DIETARY FOCUS: {guidelines['focus']}
FOODS TO AVOID: {guidelines['avoid']}
PREFERRED FOODS: {guidelines['prefer']}

{dietary_instruction}
CUISINE PREFERENCES: {', '.join(cuisine_preferences) if cuisine_preferences else 'Varied global cuisines'}
{calorie_info}
{day_specific_instruction}
{exclusion_instruction}

RULES FOR DIABETES-SAFE MEALS:
1. Include estimated carbs (g) for each meal in parentheses
2. Focus on low-glycemic index foods
3. Include protein with every meal to slow glucose absorption
4. Limit refined carbohydrates
5. Include fiber-rich foods
6. Vary cuisines throughout the week
7. Make meals practical and enjoyable

Generate a 7-day meal plan in EXACT JSON format:
{{
  "Monday": {{"breakfast": "meal name (~Xg carbs)", "lunch": "meal name (~Xg carbs)", "dinner": "meal name (~Xg carbs)"}},
  "Tuesday": {{"breakfast": "...", "lunch": "...", "dinner": "..."}},
  ...continue for all 7 days...
}}

IMPORTANT: Return ONLY the JSON object, no other text."""

    try:
        llm_api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=llm_api_key,
            session_id=f"diabetes-planner-{user.id}",
            system_message=system_message
        )
        chat.with_model("openai", "gpt-4o")
        
        user_message = UserMessage(
            text=f"Generate a diabetes-friendly weekly meal plan for {guidelines['name']} with {dietary_preference} preferences."
        )
        
        response = await chat.send_message(user_message)
        
        # Parse JSON from response
        response_text = response.strip()
        if response_text.startswith('```'):
            lines = response_text.split('\n')
            json_lines = []
            in_code_block = False
            for line in lines:
                if line.strip().startswith('```'):
                    in_code_block = not in_code_block
                    continue
                if in_code_block:
                    json_lines.append(line)
            response_text = '\n'.join(json_lines)
        
        meals = json.loads(response_text)
        
        # CRITICAL: Apply exclusion filter as safety net
        if user_exclusions and len(user_exclusions) > 0:
            logging.info(f"Applying diabetes meal plan safety filter for: {user_exclusions}")
            meals = filter_diabetes_meal_plan(meals, user_exclusions)
        
        return meals
        
    except json.JSONDecodeError as e:
        logging.error(f"Failed to parse diabetes meal plan JSON: {e}")
        # Return a safe default plan
        return get_default_diabetes_plan(dietary_preference)
    except Exception as e:
        logging.error(f"Error generating diabetes meal plan: {e}")
        raise


def get_default_diabetes_plan(dietary_preference: str) -> dict:
    """Return a safe default diabetes meal plan"""
    if dietary_preference.lower() in ["vegetarian", "vegan"]:
        return {
            "Monday": {"breakfast": "Vegetable omelette with whole grain toast (~30g carbs)", "lunch": "Lentil soup with mixed salad (~35g carbs)", "dinner": "Grilled tofu stir-fry with brown rice (~40g carbs)"},
            "Tuesday": {"breakfast": "Greek yogurt with berries and nuts (~25g carbs)", "lunch": "Quinoa Buddha bowl (~35g carbs)", "dinner": "Vegetable curry with cauliflower rice (~25g carbs)"},
            "Wednesday": {"breakfast": "Overnight oats with chia seeds (~35g carbs)", "lunch": "Mediterranean wrap with hummus (~35g carbs)", "dinner": "Stuffed bell peppers with black beans (~30g carbs)"},
            "Thursday": {"breakfast": "Avocado toast on whole grain bread (~30g carbs)", "lunch": "Chickpea salad with tahini dressing (~30g carbs)", "dinner": "Eggplant parmesan with zucchini noodles (~25g carbs)"},
            "Friday": {"breakfast": "Spinach smoothie bowl (~25g carbs)", "lunch": "Vegetable soup with whole grain crackers (~30g carbs)", "dinner": "Mushroom risotto with side salad (~40g carbs)"},
            "Saturday": {"breakfast": "Whole grain pancakes with fresh berries (~35g carbs)", "lunch": "Falafel wrap with tzatziki (~35g carbs)", "dinner": "Thai vegetable curry with brown rice (~40g carbs)"},
            "Sunday": {"breakfast": "Veggie scramble with sweet potato hash (~30g carbs)", "lunch": "Caprese salad with quinoa (~30g carbs)", "dinner": "Vegetable lasagna with side salad (~40g carbs)"}
        }
    else:
        return {
            "Monday": {"breakfast": "Egg white frittata with vegetables (~20g carbs)", "lunch": "Grilled salmon salad (~25g carbs)", "dinner": "Lean beef stir-fry with vegetables (~35g carbs)"},
            "Tuesday": {"breakfast": "Greek yogurt parfait with nuts (~25g carbs)", "lunch": "Turkey lettuce wraps (~15g carbs)", "dinner": "Baked cod with roasted vegetables (~30g carbs)"},
            "Wednesday": {"breakfast": "Overnight oats with protein powder (~35g carbs)", "lunch": "Grilled chicken Caesar salad (~20g carbs)", "dinner": "Lamb kebabs with tabbouleh (~30g carbs)"},
            "Thursday": {"breakfast": "Smoked salmon with cream cheese on toast (~30g carbs)", "lunch": "Tuna salad with whole grain crackers (~25g carbs)", "dinner": "Grilled fish tacos with cabbage slaw (~35g carbs)"},
            "Friday": {"breakfast": "Protein smoothie with berries (~25g carbs)", "lunch": "Chicken soup with vegetables (~25g carbs)", "dinner": "Herb-crusted salmon with quinoa (~35g carbs)"},
            "Saturday": {"breakfast": "Eggs Benedict on whole grain muffin (~30g carbs)", "lunch": "Mediterranean mezze platter (~30g carbs)", "dinner": "Grilled steak with sweet potato (~40g carbs)"},
            "Sunday": {"breakfast": "Full English with turkey sausage (~35g carbs)", "lunch": "Seafood salad (~20g carbs)", "dinner": "Roast chicken with roasted vegetables (~30g carbs)"}
        }
