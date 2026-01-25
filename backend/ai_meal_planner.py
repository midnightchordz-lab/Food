from emergentintegrations.llm.chat import LlmChat, UserMessage
import os
import json

async def generate_ai_meal_plan(user, mood, focus_areas=None, cuisine_preferences=None):
    """
    Generate a personalized weekly meal plan using AI based on user preferences and mood.
    """
    dietary_restrictions = user.dietary_restrictions if user.dietary_restrictions else []
    
    system_message = f"""You are an expert meal planning assistant specializing in mood-based nutrition and global cuisines.
    
    User Profile:
    - Dietary Restrictions: {', '.join(dietary_restrictions) if dietary_restrictions else 'None'}
    - Current Mood/Energy: {mood}
    - Focus Areas: {', '.join(focus_areas) if focus_areas else 'Balanced nutrition'}
    - Cuisine Preferences: {', '.join(cuisine_preferences) if cuisine_preferences else 'Variety'}
    
    Your task is to create a complete 7-day meal plan (Monday through Sunday) with breakfast, lunch, and dinner for each day.
    
    Requirements:
    1. All meals MUST respect the dietary restrictions
    2. Incorporate global cuisines for variety (Italian, Mexican, Asian, Indian, Mediterranean, etc.)
    3. Match the user's current mood and energy level
    4. Include simple meals for busy days and more elaborate ones for relaxed days
    5. Ensure nutritional balance across the week
    6. Consider meal prep efficiency (some ingredients used multiple times)
    
    Respond ONLY with a JSON object in this exact format:
    {{
      "Monday": {{"breakfast": "meal name", "lunch": "meal name", "dinner": "meal name"}},
      "Tuesday": {{"breakfast": "meal name", "lunch": "meal name", "dinner": "meal name"}},
      "Wednesday": {{"breakfast": "meal name", "lunch": "meal name", "dinner": "meal name"}},
      "Thursday": {{"breakfast": "meal name", "lunch": "meal name", "dinner": "meal name"}},
      "Friday": {{"breakfast": "meal name", "lunch": "meal name", "dinner": "meal name"}},
      "Saturday": {{"breakfast": "meal name", "lunch": "meal name", "dinner": "meal name"}},
      "Sunday": {{"breakfast": "meal name", "lunch": "meal name", "dinner": "meal name"}}
    }}
    
    Make meal names descriptive and appetizing. Include cuisine origin when relevant (e.g., "Thai Green Curry with Jasmine Rice" or "Italian Caprese Pasta").
    """
    
    try:
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=f"meal-plan-{user.id}",
            system_message=system_message
        )
        chat.with_model("openai", "gpt-4o")
        
        prompt = f"Generate a personalized weekly meal plan for someone feeling {mood}."
        if focus_areas:
            prompt += f" They want to focus on: {', '.join(focus_areas)}."
        
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
        # Fallback to a basic plan if AI response can't be parsed
        return {
            "Monday": {"breakfast": "Energizing smoothie bowl", "lunch": "Mediterranean quinoa salad", "dinner": "Grilled salmon with roasted vegetables"},
            "Tuesday": {"breakfast": "Overnight oats with berries", "lunch": "Thai vegetable stir-fry", "dinner": "Italian pasta primavera"},
            "Wednesday": {"breakfast": "Greek yogurt parfait", "lunch": "Mexican burrito bowl", "dinner": "Indian chickpea curry"},
            "Thursday": {"breakfast": "Avocado toast with eggs", "lunch": "Japanese miso soup with rice", "dinner": "Spanish paella"},
            "Friday": {"breakfast": "Protein pancakes", "lunch": "Vietnamese pho", "dinner": "French ratatouille"},
            "Saturday": {"breakfast": "French toast with fruit", "lunch": "Middle Eastern falafel wrap", "dinner": "Korean bibimbap"},
            "Sunday": {"breakfast": "Eggs Benedict", "lunch": "Greek souvlaki", "dinner": "Comfort meal prep"}   
        }
    except Exception as e:
        raise Exception(f"Error generating meal plan: {str(e)}")