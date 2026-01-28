from emergentintegrations.llm.chat import LlmChat, UserMessage
import os
import json
from typing import List, Optional

# Dietary preference descriptions for AI prompt
DIETARY_DESCRIPTIONS = {
    "vegetarian": "Vegetarian - No meat, poultry, or fish. Eggs and dairy are allowed.",
    "vegan": "Vegan - No animal products whatsoever including meat, dairy, eggs, or honey.",
    "non-vegetarian": "Non-Vegetarian - All foods including meat, poultry, and seafood are allowed.",
    "pescatarian": "Pescatarian - Fish and seafood are allowed, but no meat or poultry.",
    "eggetarian": "Eggetarian - Vegetarian with eggs allowed. No meat, poultry, fish, but eggs are included."
}

async def generate_ai_meal_plan(user, mood, dietary_preference=None, calorie_target=None, focus_areas=None, cuisine_preferences=None, exclude_recipes: Optional[List[str]] = None):
    """
    Generate a personalized weekly meal plan using AI based on user preferences, dietary choice, calorie target, and mood.
    Excludes previously used recipes to ensure variety.
    """
    # Get dietary restriction description
    dietary_desc = DIETARY_DESCRIPTIONS.get(dietary_preference, DIETARY_DESCRIPTIONS["non-vegetarian"])
    
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

    system_message = f"""You are an expert meal planning assistant specializing in mood-based nutrition and global cuisines.
    
    User Profile:
    - DIETARY PREFERENCE (STRICT): {dietary_desc}
    - Additional Restrictions: {', '.join(user_restrictions) if user_restrictions else 'None'}
    - Current Mood/Energy: {mood}
    - Focus Areas: {', '.join(focus_areas) if focus_areas else 'Balanced nutrition'}
    - Cuisine Preferences: {', '.join(cuisine_preferences) if cuisine_preferences else 'Variety'}
    {calorie_section}
    {exclusion_section}
    CRITICAL RULES FOR DIETARY PREFERENCE:
    - If VEGETARIAN: NO meat, chicken, fish, seafood, or any animal flesh
    - If VEGAN: NO meat, fish, eggs, dairy, butter, cheese, honey, or ANY animal products
    - If NON-VEGETARIAN: Can include meat, poultry, fish, and all foods
    - If PESCATARIAN: Fish and seafood OK, but NO chicken, beef, pork, or land animal meat
    - If EGGETARIAN: Vegetarian meals + eggs are allowed, but NO meat, fish, or seafood
    
    Your task is to create a complete 7-day meal plan (Monday through Sunday) with breakfast, lunch, and dinner for each day.
    
    Requirements:
    1. ALL meals MUST strictly follow the dietary preference - this is non-negotiable
    2. {"ALL meals MUST fit within the specified calorie ranges" if calorie_target else "Consider balanced nutrition"}
    3. Incorporate global cuisines for variety (Italian, Mexican, Asian, Indian, Mediterranean, etc.)
    4. Match the user's current mood and energy level
    5. Include simple meals for busy days and more elaborate ones for relaxed days
    6. Ensure nutritional balance across the week
    7. Consider meal prep efficiency (some ingredients used multiple times)
    
    Respond ONLY with a JSON object in this exact format:
    {{
      "Monday": {{"breakfast": "meal name (~Xcal)", "lunch": "meal name (~Xcal)", "dinner": "meal name (~Xcal)"}},
      "Tuesday": {{"breakfast": "meal name (~Xcal)", "lunch": "meal name (~Xcal)", "dinner": "meal name (~Xcal)"}},
      "Wednesday": {{"breakfast": "meal name (~Xcal)", "lunch": "meal name (~Xcal)", "dinner": "meal name (~Xcal)"}},
      "Thursday": {{"breakfast": "meal name (~Xcal)", "lunch": "meal name (~Xcal)", "dinner": "meal name (~Xcal)"}},
      "Friday": {{"breakfast": "meal name (~Xcal)", "lunch": "meal name (~Xcal)", "dinner": "meal name (~Xcal)"}},
      "Saturday": {{"breakfast": "meal name (~Xcal)", "lunch": "meal name (~Xcal)", "dinner": "meal name (~Xcal)"}},
      "Sunday": {{"breakfast": "meal name (~Xcal)", "lunch": "meal name (~Xcal)", "dinner": "meal name (~Xcal)"}}
    }}
    
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
        return meals
    except json.JSONDecodeError as e:
        # Fallback to dietary-appropriate basic plans
        if dietary_preference in ['vegetarian', 'vegan', 'eggetarian']:
            return get_vegetarian_fallback_plan(dietary_preference)
        elif dietary_preference == 'pescatarian':
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
