from emergentintegrations.llm.chat import LlmChat, UserMessage
import os
import json
import logging
from typing import List, Optional, Set

# Dietary preference descriptions for AI prompt
DIETARY_DESCRIPTIONS = {
    "vegetarian": "Vegetarian - No meat, poultry, or fish. Eggs and dairy are allowed.",
    "vegan": "Vegan - No animal products whatsoever including meat, dairy, eggs, or honey.",
    "non-vegetarian": "Non-Vegetarian - All foods including meat, poultry, and seafood are allowed.",
    "pescatarian": "Pescatarian - Fish and seafood are allowed, but no meat or poultry.",
    "eggetarian": "Eggetarian - Vegetarian with eggs allowed. No meat, poultry, fish, but eggs are included."
}

# Ingredient alias mapping (same as in server.py for consistency)
INGREDIENT_ALIASES = {
    'shellfish': ['shrimp', 'shrimps', 'prawn', 'prawns', 'crab', 'crabs', 'lobster', 'lobsters', 'crayfish', 'crawfish', 'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters', 'scallop', 'scallops', 'langoustine', 'langoustines'],
    'shrimp': ['shrimp', 'shrimps', 'prawn', 'prawns', 'jumbo shrimp', 'tiger prawn', 'tiger prawns', 'king prawn', 'king prawns', 'giant prawn', 'giant prawns', 'cocktail shrimp', 'shrimp cocktail', 'prawn cocktail', 'gambas', 'camarones', 'langostino', 'scampi'],
    'chicken': ['chicken', 'poultry', 'hen', 'chicken breast', 'chicken thigh', 'chicken wing', 'chicken drumstick', 'roast chicken', 'fried chicken', 'grilled chicken', 'chicken tender', 'chicken nugget', 'chicken tikka', 'tandoori chicken', 'butter chicken', 'chicken curry', 'chicken biryani', 'chicken kebab'],
    'beef': ['beef', 'steak', 'steaks', 'ground beef', 'minced beef', 'veal', 'brisket', 'sirloin', 'ribeye', 'tenderloin', 'filet', 'fillet', 'roast beef', 'corned beef', 'beef ribs', 'prime rib', 'kofta', 'keema', 'beef curry', 'beef stew', 'hamburger', 'burger patty', 'beef patty'],
    'lamb': ['lamb', 'mutton', 'lamb chop', 'lamb shank', 'leg of lamb', 'lamb shoulder', 'lamb rack', 'ground lamb', 'lamb kebab', 'lamb kofta', 'lamb curry', 'lamb biryani'],
    'pork': ['pork', 'bacon', 'ham', 'sausage', 'prosciutto', 'pancetta', 'pork belly', 'pork chop', 'pulled pork', 'carnitas', 'chorizo', 'salami', 'pepperoni'],
    'fish': ['fish', 'cod', 'tilapia', 'bass', 'sea bass', 'trout', 'halibut', 'anchovy', 'sardine', 'mackerel', 'snapper', 'swordfish', 'catfish', 'fish fillet', 'grilled fish', 'fried fish', 'fish curry', 'fish and chips', 'fish taco'],
    'salmon': ['salmon', 'salmon fillet', 'smoked salmon', 'lox', 'grilled salmon', 'salmon teriyaki'],
    'tuna': ['tuna', 'tuna fish', 'ahi tuna', 'tuna steak', 'tuna salad', 'tuna roll', 'spicy tuna'],
    'eggs': ['egg', 'eggs', 'egg white', 'egg yolk', 'omelette', 'omelet', 'meringue', 'custard'],
    'dairy': ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'sour cream', 'ice cream', 'ghee', 'paneer', 'cottage cheese', 'ricotta', 'mozzarella', 'cheddar', 'parmesan'],
    'peanuts': ['peanut', 'peanuts', 'peanut butter', 'groundnut'],
    'tree_nuts': ['almond', 'almonds', 'walnut', 'walnuts', 'cashew', 'cashews', 'pecan', 'pistachios', 'hazelnut', 'macadamia'],
}


def get_all_excluded_terms_for_meal_plan(excluded_names: List[str]) -> Set[str]:
    """Get all excluded terms including aliases"""
    all_terms = set()
    for excluded in excluded_names:
        excluded_lower = excluded.lower().strip()
        all_terms.add(excluded_lower)
        # Check direct match
        if excluded_lower in INGREDIENT_ALIASES:
            all_terms.update([a.lower() for a in INGREDIENT_ALIASES[excluded_lower]])
        # Check if it's an alias itself
        for key, aliases in INGREDIENT_ALIASES.items():
            if excluded_lower in [a.lower() for a in aliases]:
                all_terms.update([a.lower() for a in aliases])
    return all_terms


def filter_meal_plan_for_exclusions(meals: dict, excluded_names: List[str]) -> dict:
    """Filter out meals containing excluded ingredients from the meal plan"""
    if not excluded_names:
        return meals
    
    all_excluded_terms = get_all_excluded_terms_for_meal_plan(excluded_names)
    filtered_meals = {}
    
    for day, day_meals in meals.items():
        filtered_day = {}
        for meal_type, meal_value in day_meals.items():
            if meal_type == "dinner_pairing":
                # Keep pairings as is
                filtered_day[meal_type] = meal_value
                continue
            
            # Check if meal name contains any excluded term
            meal_name = meal_value.lower() if isinstance(meal_value, str) else str(meal_value).lower()
            contains_excluded = False
            
            for term in all_excluded_terms:
                if term in meal_name:
                    logging.warning(f"MEAL PLAN SAFETY: Replacing {meal_type} '{meal_value}' due to excluded term '{term}'")
                    contains_excluded = True
                    break
            
            if contains_excluded:
                # Replace with a safe alternative based on meal type
                safe_alternatives = {
                    "breakfast": "Fresh fruit bowl with granola and honey",
                    "lunch": "Mediterranean vegetable salad with quinoa",
                    "dinner": "Roasted vegetable stir-fry with tofu and rice"
                }
                filtered_day[meal_type] = safe_alternatives.get(meal_type, "Seasonal vegetable dish")
            else:
                filtered_day[meal_type] = meal_value
        
        filtered_meals[day] = filtered_day
    
    return filtered_meals


async def generate_ai_meal_plan(user, mood, dietary_preference=None, calorie_target=None, focus_areas=None, cuisine_preferences=None, exclude_recipes: Optional[List[str]] = None, user_exclusions: Optional[List[str]] = None, macro_targets: Optional[dict] = None, day_specific_preferences: Optional[dict] = None):
    """
    Generate a personalized weekly meal plan using AI based on user preferences, dietary choice, calorie target, macro targets, and mood.
    Excludes previously used recipes to ensure variety.
    Also filters for user food allergies/exclusions.
    """
    # Normalize cuisine_preferences to list of strings
    if cuisine_preferences:
        normalized_cuisines = []
        for cp in cuisine_preferences:
            if isinstance(cp, dict):
                # Handle {"id": "italian", "label": "Italian"} format
                normalized_cuisines.append(cp.get('label') or cp.get('id') or str(cp))
            elif isinstance(cp, str):
                normalized_cuisines.append(cp)
        cuisine_preferences = normalized_cuisines
    
    # Normalize focus_areas to list of strings
    if focus_areas:
        normalized_focus = []
        for fa in focus_areas:
            if isinstance(fa, dict):
                normalized_focus.append(fa.get('label') or fa.get('id') or str(fa))
            elif isinstance(fa, str):
                normalized_focus.append(fa)
        focus_areas = normalized_focus
    
    # Handle dietary_preference as string or list
    # When user selects both veg and non-veg, the general preference should be non-vegetarian
    # with specific days being vegetarian
    if isinstance(dietary_preference, list):
        # If both veg and non-veg selected, default to non-veg for non-specified days
        if 'non-vegetarian' in dietary_preference and ('vegetarian' in dietary_preference or 'vegan' in dietary_preference):
            dietary_desc = "Mixed diet - can include meat, poultry, fish on most days"
            dietary_pref_str = "non-vegetarian (with some vegetarian days as specified)"
        else:
            dietary_desc_parts = [DIETARY_DESCRIPTIONS.get(dp, "") for dp in dietary_preference]
            dietary_desc = " Also includes: ".join([d for d in dietary_desc_parts if d]) or DIETARY_DESCRIPTIONS["non-vegetarian"]
            dietary_pref_str = ", ".join(dietary_preference)
    else:
        dietary_desc = DIETARY_DESCRIPTIONS.get(dietary_preference, DIETARY_DESCRIPTIONS["non-vegetarian"])
        dietary_pref_str = dietary_preference or "non-vegetarian"
    
    # Additional user dietary restrictions
    user_restrictions = user.dietary_restrictions if user.dietary_restrictions else []
    
    # Build exclusion list for variety
    exclusion_section = ""
    if exclude_recipes and len(exclude_recipes) > 0:
        # Limit to last 50 recipes to keep prompt manageable
        recent_exclusions = exclude_recipes[-50:] if len(exclude_recipes) > 50 else exclude_recipes
        exclusion_section = f"""
    RECIPES TO AVOID (already used recently - DO NOT REPEAT):
    {', '.join(recent_exclusions[:25])}
    {"... and " + str(len(recent_exclusions) - 25) + " more" if len(recent_exclusions) > 25 else ""}
    
    Generate COMPLETELY DIFFERENT recipes from the ones listed above. Be creative and suggest new dishes!
    """
    
    # CRITICAL: Build food allergy/exclusion section
    allergy_section = ""
    if user_exclusions and len(user_exclusions) > 0:
        all_excluded_terms = get_all_excluded_terms_for_meal_plan(user_exclusions)
        all_terms_str = ", ".join(sorted(all_excluded_terms))
        allergy_section = f"""
    🚨🚨🚨 ABSOLUTE MANDATORY FOOD RESTRICTIONS - ZERO TOLERANCE 🚨🚨🚨
    
    THE USER HAS SEVERE FOOD ALLERGIES. YOU MUST FOLLOW THESE RULES WITH NO EXCEPTIONS:
    
    ❌ COMPLETELY BANNED INGREDIENTS (Never suggest ANY meal containing these):
    {all_terms_str}
    
    CRITICAL RULES:
    1. DO NOT suggest ANY meal containing these ingredients in ANY form
    2. PRAWN = SHRIMP - They are the SAME thing. Both are banned.
    3. If a cuisine typically uses a banned ingredient, suggest a different dish from that cuisine
    4. Double-check EVERY meal against this banned list before including it
    
    VIOLATION OF THESE RULES COULD CAUSE SEVERE ALLERGIC REACTION.
    """
    
    # Calorie distribution (breakfast 25%, lunch 35%, dinner 40%)
    calorie_section = ""
    if calorie_target:
        breakfast_cal = int(calorie_target * 0.25)
        lunch_cal = int(calorie_target * 0.35)
        dinner_cal = int(calorie_target * 0.40)
        calorie_section = f"""
    CALORIE REQUIREMENTS (STRICT):
    - Daily Target: {calorie_target} calories
    - Breakfast: ~{breakfast_cal} calories each
    - Lunch: ~{lunch_cal} calories each
    - Dinner: ~{dinner_cal} calories each
    
    Each meal MUST fit within these calorie ranges. Suggest portion-appropriate meals.
    For lower calorie targets (<1800): Focus on lean proteins, vegetables, whole grains
    For higher calorie targets (>2500): Include healthy fats, complex carbs, protein-rich foods
    """
    
    # Macro targets section
    macro_section = ""
    if macro_targets:
        protein = macro_targets.get('protein_g')
        carbs = macro_targets.get('carbs_g')
        fat = macro_targets.get('fat_g')
        fiber = macro_targets.get('fiber_g')
        
        if any([protein, carbs, fat, fiber]):
            macro_section = """
    DAILY MACRO TARGETS (IMPORTANT):"""
            if protein:
                macro_section += f"\n    - Protein: {protein}g daily (prioritize lean proteins, legumes, dairy)"
            if carbs:
                macro_section += f"\n    - Carbohydrates: {carbs}g daily (focus on complex carbs, whole grains)"
            if fat:
                macro_section += f"\n    - Fat: {fat}g daily (emphasize healthy fats: olive oil, nuts, avocado)"
            if fiber:
                macro_section += f"\n    - Fiber: {fiber}g daily (include vegetables, fruits, legumes)"
            
            macro_section += """
    
    Design meals that collectively hit these daily macro targets when breakfast + lunch + dinner are combined.
    Include protein-rich foods at every meal. Balance carbs and fats appropriately.
    """

    system_message = f"""You are an expert meal planning assistant specializing in mood-based nutrition and global cuisines.
    
    User Profile:
    - DIETARY PREFERENCE (STRICT): {dietary_desc}
    - Additional Restrictions: {', '.join(user_restrictions) if user_restrictions else 'None'}
    - Current Mood/Energy: {mood}
    - Focus Areas: {', '.join(focus_areas) if focus_areas else 'Balanced nutrition'}
    - Cuisine Preferences: {', '.join(cuisine_preferences) if cuisine_preferences else 'Variety'}
    {allergy_section}
    {calorie_section}
    {macro_section}
    {exclusion_section}
    DIETARY RULES:
    - VEGETARIAN: NO meat, chicken, fish, seafood, or any animal flesh
    - NON-VEGETARIAN: Can include meat, poultry, fish, and all foods
    
    {"*** CRITICAL: DAY-SPECIFIC MEAL RULES ***" + chr(10) + chr(10).join([f"    {day} = {pref.upper()} ONLY (no meat/fish/chicken)" for day, pref in (day_specific_preferences or {}).items()]) + chr(10) + chr(10) + "    ALL OTHER DAYS = NON-VEGETARIAN (include chicken, fish, beef, etc.)" + chr(10) + chr(10) + "EXAMPLE: If Tuesday is Vegetarian, Monday can have Grilled Chicken Salad but Tuesday must have Paneer Tikka or Vegetable Stir Fry." if day_specific_preferences else "GENERAL PREFERENCE: " + dietary_pref_str}
    
    Your task is to create a 7-day meal plan where:
    {"- " + ", ".join([f"{day} has VEGETARIAN meals" for day, pref in (day_specific_preferences or {}).items()]) if day_specific_preferences else ""}
    {"- All other days (not listed above) MUST have NON-VEGETARIAN options like chicken, fish, lamb, beef" if day_specific_preferences else ""}
    
    Requirements:
    1. {"VEGETARIAN DAYS (" + ", ".join(day_specific_preferences.keys()) + "): Only vegetarian meals - NO meat, chicken, fish" if day_specific_preferences else "Follow dietary preference"}
    2. {"NON-VEG DAYS (all others): MUST include meat/chicken/fish options" if day_specific_preferences else ""}
    3. {"ALL meals MUST fit within " + str(calorie_target) + " calories/day" if calorie_target else "Consider balanced nutrition"}
    4. Incorporate global cuisines for variety
    5. Match the user's mood: {mood}
    
    Respond ONLY with a JSON object in this exact format:
    {{
      "Monday": {{
        "breakfast": "meal name (~Xcal)",
        "lunch": "meal name (~Xcal)",
        "dinner": "meal name (~Xcal)",
        "dinner_pairing": {{"non_alcoholic": "Mocktail/Beverage name", "alcoholic": "Wine/Beer/Cocktail name"}}
      }},
      "Tuesday": {{
        "breakfast": "meal name (~Xcal)",
        "lunch": "meal name (~Xcal)", 
        "dinner": "meal name (~Xcal)",
        "dinner_pairing": {{"non_alcoholic": "Mocktail/Beverage name", "alcoholic": "Wine/Beer/Cocktail name"}}
      }},
      "Wednesday": {{
        "breakfast": "meal name (~Xcal)",
        "lunch": "meal name (~Xcal)",
        "dinner": "meal name (~Xcal)",
        "dinner_pairing": {{"non_alcoholic": "Mocktail/Beverage name", "alcoholic": "Wine/Beer/Cocktail name"}}
      }},
      "Thursday": {{
        "breakfast": "meal name (~Xcal)",
        "lunch": "meal name (~Xcal)",
        "dinner": "meal name (~Xcal)",
        "dinner_pairing": {{"non_alcoholic": "Mocktail/Beverage name", "alcoholic": "Wine/Beer/Cocktail name"}}
      }},
      "Friday": {{
        "breakfast": "meal name (~Xcal)",
        "lunch": "meal name (~Xcal)",
        "dinner": "meal name (~Xcal)",
        "dinner_pairing": {{"non_alcoholic": "Mocktail/Beverage name", "alcoholic": "Wine/Beer/Cocktail name"}}
      }},
      "Saturday": {{
        "breakfast": "meal name (~Xcal)",
        "lunch": "meal name (~Xcal)",
        "dinner": "meal name (~Xcal)",
        "dinner_pairing": {{"non_alcoholic": "Mocktail/Beverage name", "alcoholic": "Wine/Beer/Cocktail name"}}
      }},
      "Sunday": {{
        "breakfast": "meal name (~Xcal)",
        "lunch": "meal name (~Xcal)",
        "dinner": "meal name (~Xcal)",
        "dinner_pairing": {{"non_alcoholic": "Mocktail/Beverage name", "alcoholic": "Wine/Beer/Cocktail name"}}
      }}
    }}
    
    DRINK PAIRING RULES:
    - Each dinner MUST have drink pairings (both non-alcoholic and alcoholic options)
    - Non-alcoholic: Suggest specific mocktails, fresh juices, sparkling waters, or specialty beverages
    - Alcoholic: Suggest specific wines (Pinot Grigio, Cabernet Sauvignon), beers, or cocktails that complement the dish
    - Pairings must match the cuisine and flavors of the dinner
    
    {"Include approximate calories in parentheses after each meal name, e.g., 'Greek Yogurt Parfait (~350cal)'" if calorie_target else "Make meal names descriptive and appetizing."}
    Include cuisine origin when relevant (e.g., "Thai Green Curry with Jasmine Rice" or "Italian Caprese Pasta").
    DOUBLE-CHECK that every meal complies with the {dietary_desc.split(' - ')[0]} dietary requirement before including it.
    """
    
    try:
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=f"meal-plan-{user.id}",
            system_message=system_message
        )
        chat.with_model("openai", "gpt-4o-mini")  # Use mini for faster response
        
        prompt = f"Generate a personalized weekly meal plan for someone feeling {mood}."
        prompt += f" IMPORTANT: All meals must be {dietary_desc.split(' - ')[0].lower()}."
        if focus_areas:
            prompt += f" They want to focus on: {', '.join(focus_areas)}."
        if cuisine_preferences:
            prompt += f" Preferred cuisines: {', '.join(cuisine_preferences)}."
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON from response
        # Sometimes AI wraps JSON in markdown code blocks
        response_text = response.strip()
        if response_text.startswith('```'):
            # Extract JSON from code block
            lines = response_text.split('\n')
            json_lines = []
            in_code_block = False
            for line in lines:
                if line.strip().startswith('```'):
                    in_code_block = not in_code_block
                    continue
                if in_code_block or (not line.strip().startswith('```') and '{' in line):
                    json_lines.append(line)
            response_text = '\n'.join(json_lines)
        
        meals = json.loads(response_text)
        
        # CRITICAL SAFETY FILTER: Apply post-processing filter for food allergies
        if user_exclusions and len(user_exclusions) > 0:
            logging.info(f"Applying meal plan safety filter for exclusions: {user_exclusions}")
            meals = filter_meal_plan_for_exclusions(meals, user_exclusions)
        
        return meals
    except json.JSONDecodeError as e:
        # Fallback to dietary-appropriate basic plans
        # Handle both string and list dietary preferences
        dietary_list = dietary_preference if isinstance(dietary_preference, list) else [dietary_preference]
        if any(dp in ['vegetarian', 'vegan', 'eggetarian'] for dp in dietary_list):
            return get_vegetarian_fallback_plan(dietary_list[0] if dietary_list else 'vegetarian')
        elif 'pescatarian' in dietary_list:
            return get_pescatarian_fallback_plan()
        else:
            return get_nonveg_fallback_plan()
    except Exception as e:
        raise Exception(f"Error generating meal plan: {str(e)}")


def get_vegetarian_fallback_plan(pref):
    """Fallback vegetarian/vegan meal plan"""
    base_plan = {
        "Monday": {"breakfast": "Greek yogurt parfait with granola", "lunch": "Mediterranean falafel wrap", "dinner": "Thai vegetable green curry"},
        "Tuesday": {"breakfast": "Avocado toast with cherry tomatoes", "lunch": "Indian paneer tikka", "dinner": "Italian pasta primavera"},
        "Wednesday": {"breakfast": "Smoothie bowl with chia seeds", "lunch": "Mexican black bean tacos", "dinner": "Japanese vegetable ramen"},
        "Thursday": {"breakfast": "French toast with maple syrup", "lunch": "Greek spanakopita", "dinner": "Indian chana masala with rice"},
        "Friday": {"breakfast": "Overnight oats with berries", "lunch": "Vietnamese spring rolls", "dinner": "Italian mushroom risotto"},
        "Saturday": {"breakfast": "Pancakes with fresh fruit", "lunch": "Middle Eastern hummus platter", "dinner": "Korean kimchi fried rice"},
        "Sunday": {"breakfast": "Eggs Benedict Florentine", "lunch": "Mexican veggie burrito bowl", "dinner": "Comfort mac and cheese"}
    }
    
    if pref == 'vegan':
        # Remove dairy/eggs for vegan
        base_plan["Monday"]["breakfast"] = "Coconut yogurt parfait with granola"
        base_plan["Thursday"]["breakfast"] = "Banana pancakes with maple syrup"
        base_plan["Sunday"]["breakfast"] = "Tofu scramble with vegetables"
        base_plan["Sunday"]["dinner"] = "Vegan cashew mac and cheese"
    
    return base_plan


def get_pescatarian_fallback_plan():
    """Fallback pescatarian meal plan"""
    return {
        "Monday": {"breakfast": "Smoked salmon bagel", "lunch": "Mediterranean tuna salad", "dinner": "Grilled salmon with roasted vegetables"},
        "Tuesday": {"breakfast": "Eggs Benedict", "lunch": "Thai shrimp soup", "dinner": "Italian seafood pasta"},
        "Wednesday": {"breakfast": "Avocado toast with eggs", "lunch": "Japanese sushi bowl", "dinner": "Spanish seafood paella"},
        "Thursday": {"breakfast": "Greek yogurt with honey", "lunch": "Vietnamese fish pho", "dinner": "Mediterranean grilled fish"},
        "Friday": {"breakfast": "Smoked trout omelette", "lunch": "Mexican fish tacos", "dinner": "Thai coconut curry with shrimp"},
        "Saturday": {"breakfast": "Eggs Florentine", "lunch": "Greek calamari salad", "dinner": "Indian fish curry"},
        "Sunday": {"breakfast": "Crab cakes Benedict", "lunch": "Japanese ramen with fish", "dinner": "Italian risotto with seafood"}
    }


def get_nonveg_fallback_plan():
    """Fallback non-vegetarian meal plan"""
    return {
        "Monday": {"breakfast": "Energizing smoothie bowl", "lunch": "Mediterranean quinoa salad", "dinner": "Grilled salmon with roasted vegetables"},
        "Tuesday": {"breakfast": "Overnight oats with berries", "lunch": "Thai chicken stir-fry", "dinner": "Italian pasta with meatballs"},
        "Wednesday": {"breakfast": "Greek yogurt parfait", "lunch": "Mexican chicken burrito bowl", "dinner": "Indian butter chicken"},
        "Thursday": {"breakfast": "Avocado toast with eggs", "lunch": "Japanese teriyaki beef bowl", "dinner": "Spanish paella"},
        "Friday": {"breakfast": "Protein pancakes", "lunch": "Vietnamese pho with beef", "dinner": "French coq au vin"},
        "Saturday": {"breakfast": "French toast with bacon", "lunch": "Middle Eastern lamb shawarma", "dinner": "Korean BBQ"},
        "Sunday": {"breakfast": "Full English breakfast", "lunch": "Greek souvlaki", "dinner": "Sunday roast chicken"}
    }
