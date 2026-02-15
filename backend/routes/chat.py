"""
Chat Routes - Main conversation and recipe generation
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import os
import uuid
import logging
import re
import sys

from emergentintegrations.llm.chat import LlmChat, UserMessage

from .deps import db, User, get_current_user
from .exclusions import (
    get_user_excluded_ingredients,
    filter_unsafe_recipes_from_response,
    filter_recipe_text_strictly
)

# Import the new usage limit service
sys.path.insert(0, '/app/backend')
from services.usage_limit_service import (
    check_recipe_limit,
    increment_recipe_count
)

# Import SerpAPI for external recipe search
sys.path.append('/app/backend')
from services.serpapi_service import search_recipes, search_recipes_for_mood
from services.recipe_library import save_recipes_to_library, get_recipes_from_library

router = APIRouter(prefix="/chat", tags=["Chat"])

# ============== RECIPE PARSER - BACKEND JSON EXTRACTION ==============
# This parses the LLM text response into structured JSON to avoid brittle frontend parsing

def parse_recipes_to_json(ai_response: str, user_cuisine: str = '') -> List[Dict[str, Any]]:
    """
    Parse AI-generated recipe text into structured JSON.
    This is the SINGLE SOURCE OF TRUTH for recipe parsing - done on backend to ensure consistency.
    
    Args:
        ai_response: The raw text response from the AI
        user_cuisine: The cuisine the user selected (e.g., "Indian") - used for ALL recipes
    """
    recipes = []
    
    # Single ingredients/foods that are NOT recipes - comprehensive list
    single_food_items = {
        # Dairy
        'greek yogurt', 'yogurt', 'milk', 'butter', 'cheese', 'cream', 'cream cheese',
        'feta', 'mozzarella', 'parmesan', 'cheddar', 'ricotta', 'cottage cheese',
        # Grains
        'oats', 'oatmeal', 'rice', 'bread', 'quinoa', 'pasta', 'noodles', 'wheat', 'barley',
        # Proteins
        'eggs', 'egg', 'chicken', 'beef', 'fish', 'salmon', 'tuna', 'tofu', 'tempeh',
        'shrimp', 'pork', 'lamb', 'turkey', 'bacon', 'sausage',
        # Legumes
        'beans', 'lentils', 'chickpeas', 'hummus', 'peas',
        # Vegetables (singular and plural)
        'vegetables', 'veggies', 'veggie', 'greens', 'leafy greens',
        'spinach', 'lettuce', 'kale', 'arugula', 'cabbage', 'chard',
        'broccoli', 'cauliflower', 'carrots', 'carrot', 'peppers', 'pepper',
        'mushrooms', 'mushroom', 'zucchini', 'eggplant', 'cucumber', 'celery',
        'tomatoes', 'tomato', 'onion', 'onions', 'garlic', 'ginger',
        'potatoes', 'potato', 'sweet potato', 'corn',
        # Fruits
        'fruits', 'fruit', 'berries', 'avocado', 'banana', 'apple', 'orange',
        'lemon', 'lime', 'mango', 'pineapple', 'grapes', 'strawberries',
        # Nuts & Seeds
        'nuts', 'almonds', 'walnuts', 'cashews', 'peanuts', 'pecans', 'pistachios',
        'seeds', 'chia', 'flax', 'sunflower seeds', 'pumpkin seeds',
        # Herbs & Spices
        'herbs', 'spices', 'basil', 'oregano', 'thyme', 'rosemary', 'cilantro', 'parsley', 'mint',
        'cinnamon', 'turmeric', 'cumin', 'paprika', 'chili', 'pepper', 'salt',
        # Sweeteners & Others
        'honey', 'sugar', 'maple syrup', 'olive oil', 'coconut oil'
    }
    
    # Skip patterns - NOT recipe names (these are section headers or descriptions)
    skip_patterns = [
        r'^(option|tip|note|step|ingredient|instruction|nutritional|description|benefit|why)',
        r'^(blood sugar|diabetes|health|safety|warning|important|disclaimer)',
        r'^(tips?|notes?|benefits?|guidelines?|recommendations?)',
        r'^(mood|mood-boosting|boosting|stress|comfort|relaxation)',
        r'^#?\s*mood-?boosting\s*benefits?',
        r'benefits?$',
        r'^(is\s+packed|provides?|contains?|rich\s+in|high\s+in|low\s+in)',
        r'^(can\s+help|helps?\s+with|known\s+for|great\s+for|good\s+for)',
        r'^(add|adds|adding)\s+',  # "add fiber", "adds nutrients"
        r'^(provide|provides|providing)\s+',  # "provide complex carbs"
        r'^(support|supports|supporting)\s+',  # "supports digestion"
        r'^(boost|boosts|boosting)\s+',  # "boosts energy"
        r'^(promote|promotes|promoting)\s+',  # "promotes wellness"
        r'^cooking\s*time',  # "Cooking Time" is NOT a recipe name
        r'^difficulty',  # "Difficulty" is NOT a recipe name  
        r'^key\s*ingredients?',  # "Key Ingredients" is NOT a recipe name
        r'^serves?',  # "Serves" is NOT a recipe name
        r'^prep\s*time',  # "Prep Time" is NOT a recipe name
        r'^cuisine\s*(type)?',  # "Cuisine Type" is NOT a recipe name
        r'^dietary\s*(preference)?',  # "Dietary Preference" is NOT a recipe name
        r'^meal\s*(type)?',  # "Meal Type" is NOT a recipe name
    ]
    
    def is_valid_recipe_name(title: str) -> bool:
        """Check if a title is a valid recipe name, not an ingredient or section header"""
        if not title or len(title) < 4 or len(title) > 120:
            return False
        title_lower = title.lower().strip()
        
        # Skip single ingredients (exact match)
        if title_lower in single_food_items:
            return False
        
        # Skip section headers/tips
        for pattern in skip_patterns:
            if re.match(pattern, title_lower, re.IGNORECASE):
                return False
        
        # Must have at least 2 words for a proper recipe name
        words = title.split()
        if len(words) < 2:
            return False
        
        # If only 2 words, both should not be common food words
        if len(words) == 2:
            word1, word2 = words[0].lower(), words[1].lower()
            # Check if it's just "Food Food" pattern like "Greek Yogurt"
            common_adjectives = {'greek', 'fresh', 'organic', 'raw', 'cooked', 'fried', 'baked', 'grilled', 'roasted', 'steamed', 'creamy', 'crispy', 'spicy', 'sweet', 'sour', 'salty', 'whole', 'plain', 'vanilla', 'chocolate'}
            if word1 in common_adjectives and word2 in single_food_items:
                return False
            if word1 in single_food_items and word2 in single_food_items:
                return False
        
        # Skip if ends with colon (section header)
        if title.endswith(':'):
            return False
        
        # Skip if title is too short (likely ingredient name) - minimum 10 chars
        if len(title_lower) < 10:
            return False
            
        return True
    
    def detect_cuisine(text: str, default_cuisine: str = '') -> str:
        """
        Detect cuisine from text. If default_cuisine is provided, use that instead.
        The default should be extracted from user's selection.
        """
        # If a default cuisine was provided (from user selection), use it
        if default_cuisine:
            return default_cuisine
        
        # Otherwise try to detect from text (fallback)
        text_lower = text.lower()
        if any(w in text_lower for w in ['indian', 'curry', 'masala', 'paneer', 'tikka', 'biryani', 'dal', 'naan', 'samosa', 'chana']):
            return 'Indian'
        if any(w in text_lower for w in ['italian', 'pasta', 'risotto', 'pizza', 'carbonara', 'lasagna', 'gnocchi', 'pesto']):
            return 'Italian'
        if any(w in text_lower for w in ['mexican', 'taco', 'burrito', 'enchilada', 'quesadilla', 'salsa', 'guacamole']):
            return 'Mexican'
        if any(w in text_lower for w in ['chinese', 'wok', 'stir-fry', 'dumpling', 'dim sum', 'tofu', 'szechuan']):
            return 'Chinese'
        if any(w in text_lower for w in ['japanese', 'sushi', 'ramen', 'teriyaki', 'tempura', 'miso', 'udon']):
            return 'Japanese'
        if any(w in text_lower for w in ['thai', 'pad thai', 'tom yum', 'green curry', 'massaman', 'basil chicken']):
            return 'Thai'
        if any(w in text_lower for w in ['korean', 'kimchi', 'bibimbap', 'bulgogi', 'gochujang']):
            return 'Korean'
        if any(w in text_lower for w in ['mediterranean', 'falafel', 'hummus', 'greek salad', 'tzatziki', 'shawarma']):
            return 'Mediterranean'
        if any(w in text_lower for w in ['american', 'burger', 'bbq', 'mac and cheese', 'fried chicken']):
            return 'American'
        if any(w in text_lower for w in ['french', 'croissant', 'baguette', 'ratatouille', 'bourguignon']):
            return 'French'
        return default_cuisine  # Return whatever was passed if nothing detected
    
    def extract_time(text: str) -> str:
        """Extract cooking time from text"""
        # Pattern 1: **Cooking Time:** 40 min
        time_match = re.search(r'\*\*(?:Cooking\s*)?Time:?\*\*\s*(\d+[-–]?\d*)\s*(?:min|minutes?)?', text, re.IGNORECASE)
        if time_match:
            return f"{time_match.group(1)} min"
        # Pattern 2: | **Time:** 40 min (table format)
        time_match = re.search(r'\|\s*\*\*Time:?\*\*\s*(\d+)\s*min', text, re.IGNORECASE)
        if time_match:
            return f"{time_match.group(1)} min"
        # Pattern 3: Cooking Time: 40 minutes (plain text format)
        time_match = re.search(r'Cooking\s*Time:?\s*(\d+[-–]?\d*)\s*(?:min|minutes?)?', text, re.IGNORECASE)
        if time_match:
            return f"{time_match.group(1)} min"
        # Pattern 4: Just "40 minutes" anywhere
        time_match = re.search(r'(\d+[-–]?\d*)\s*(?:min|minutes?)', text, re.IGNORECASE)
        if time_match:
            return f"{time_match.group(1)} min"
        return "30 min"
    
    def extract_difficulty(text: str) -> str:
        """Extract difficulty from text"""
        # Pattern 1: **Difficulty:** Easy/Medium/Hard
        diff_match = re.search(r'\*\*Difficulty:?\*\*\s*(Easy|Medium|Moderate|Hard)', text, re.IGNORECASE)
        if diff_match:
            diff = diff_match.group(1)
            return 'Medium' if diff.lower() == 'moderate' else diff.title()
        # Pattern 2: Difficulty: Easy/Medium/Hard (plain text format, may have trailing **)
        diff_match = re.search(r'Difficulty:?\s*(Easy|Medium|Moderate|Hard)(?:\*\*)?', text, re.IGNORECASE)
        if diff_match:
            diff = diff_match.group(1)
            return 'Medium' if diff.lower() == 'moderate' else diff.title()
        # Fallback: keyword detection
        if re.search(r'\b(easy|simple|quick)\b', text, re.IGNORECASE):
            return 'Easy'
        if re.search(r'\b(hard|complex|advanced)\b', text, re.IGNORECASE):
            return 'Hard'
        return 'Medium'
    
    def extract_description(text: str, title: str) -> str:
        """Extract description from recipe content"""
        # Try to find explicit description
        desc_match = re.search(r'\*\*Description:?\*\*:?\s*([^\n*]+)', text, re.IGNORECASE)
        if desc_match:
            return desc_match.group(1).strip()
        
        # Try to find "Why" explanation (diabetes format)
        why_match = re.search(r'\*\*Why[^*]+\*\*\s*([^\n*]+)', text, re.IGNORECASE)
        if why_match:
            return why_match.group(1).strip()
        
        # Get first meaningful line
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#') and not line.startswith('*') and not line.startswith('-'):
                if len(line) > 20:
                    # Truncate to 2 sentences max
                    sentences = re.split(r'(?<=[.!?])\s+', line)
                    return ' '.join(sentences[:2])[:200]
        
        return f"A delicious {title} recipe."
    
    def extract_ingredients(text: str) -> List[str]:
        """Extract key ingredients from recipe content"""
        ingredients = []
        
        # Look for "Key Ingredients:" section
        ing_match = re.search(r'\*\*(?:Key\s*)?Ingredients:?\*\*:?\s*([^\n]+)', text, re.IGNORECASE)
        if ing_match:
            ing_text = ing_match.group(1).strip()
            # Split by comma
            ingredients = [i.strip() for i in ing_text.split(',') if i.strip()]
        
        # Look for bullet point ingredients
        if not ingredients:
            bullet_matches = re.findall(r'^\s*[-•]\s*(.+?)$', text, re.MULTILINE)
            for match in bullet_matches[:8]:
                # Skip instruction-like lines
                if not re.match(r'^(step|heat|cook|add|stir|mix|serve)', match.lower()):
                    ingredients.append(match.strip())
        
        return ingredients[:6] if ingredients else []
    
    # PATTERN 1: "### 1. Recipe Name" or "### Recipe Name" format
    pattern1 = r'##[#]?\s*(?:\d+\.?)?\s*\[?([^\n\[\]]+?)\]?\s*\n([\s\S]*?)(?=##[#]?\s*(?:\d+\.?)?\s*\[?[^\n\[\]]+?\]?\s*\n|---\s*$|$)'
    matches1 = re.finditer(pattern1, ai_response)
    
    for match in matches1:
        title = match.group(1).strip()
        # Clean title - remove common prefixes like "Recipe:", brackets, parentheses at end
        title = re.sub(r'^Recipe:\s*', '', title, flags=re.IGNORECASE).strip()  # Remove "Recipe:" prefix
        title = re.sub(r'^Dish:\s*', '', title, flags=re.IGNORECASE).strip()  # Remove "Dish:" prefix
        title = re.sub(r'\([^)]*\)\s*$', '', title).strip()
        title = re.sub(r'\[[^\]]*\]\s*$', '', title).strip()
        title = re.sub(r'^[:\-–]\s*', '', title).strip()
        content = match.group(2).strip()
        
        if not is_valid_recipe_name(title):
            continue
        
        recipes.append({
            "title": title,
            "description": extract_description(content, title),
            "cooking_time": extract_time(content),
            "difficulty": extract_difficulty(content),
            "cuisine": user_cuisine if user_cuisine else detect_cuisine(title + ' ' + content, user_cuisine),
            "ingredients": extract_ingredients(content),
            "full_content": content
        })
    
    # If pattern 1 found recipes, return them
    if recipes:
        return recipes
    
    # PATTERN 2: "**Recipe Name**" format (numbered or not)
    pattern2 = r'(?:^\d+\.\s*)?\*\*([^*]+)\*\*\s*([\s\S]*?)(?=(?:^\d+\.\s*)?\*\*[^*]+\*\*|$)'
    matches2 = re.finditer(pattern2, ai_response, re.MULTILINE)
    
    # Phrases that indicate ingredient/benefit descriptions, NOT recipe content
    ingredient_description_starters = [
        r'^is\s+(packed|rich|high|low|full|great|an?\s+excellent)',
        r'^(provide|provides|providing)\s+',
        r'^(contain|contains|containing)\s+',
        r'^(help|helps|helping)\s+',
        r'^(can\s+help|may\s+help)\s+',
        r'^known\s+for',
        r'^(great|good|excellent)\s+for',
        r'^a\s+(great|good|excellent)\s+source',
        r'^(rich|high)\s+in\s+',
        r'^(add|adds|adding)\s+',  # "add fiber"
        r'^(support|supports|supporting)\s+',  # "supports digestion"
        r'^(boost|boosts|boosting)\s+',  # "boosts energy"
        r'^(promote|promotes|promoting)\s+',  # "promotes wellness"
        r'^(give|gives|giving)\s+',  # "gives you energy"
        r'^(aid|aids|aiding)\s+',  # "aids digestion"
        r'^(improve|improves|improving)\s+',  # "improves mood"
        r'^(reduce|reduces|reducing)\s+',  # "reduces stress"
        r'^(lower|lowers|lowering)\s+',  # "lowers blood sugar"
        r'^(enhance|enhances|enhancing)\s+',  # "enhances flavor"
        r'^\w+\s+complex\s+carbohydrates',  # "provide complex carbohydrates"
        r'^\w+\s+fiber',  # "add fiber"
        r'^\w+\s+(vitamins?|minerals?|nutrients?)',  # "provides vitamins"
    ]
    
    for match in matches2:
        title = match.group(1).strip()
        content = match.group(2).strip()
        
        # Clean title - remove common prefixes like "Recipe:", brackets, parentheses
        title = re.sub(r'^Recipe:\s*', '', title, flags=re.IGNORECASE).strip()  # Remove "Recipe:" prefix
        title = re.sub(r'^Dish:\s*', '', title, flags=re.IGNORECASE).strip()  # Remove "Dish:" prefix
        title = re.sub(r'\([^)]*\)\s*$', '', title).strip()  # Remove trailing parentheses
        title = re.sub(r'\[[^\]]*\]\s*$', '', title).strip()  # Remove trailing brackets
        title = title.rstrip(':')  # Remove trailing colon
        
        if not is_valid_recipe_name(title):
            continue
        
        # Additional check: skip if content starts with ingredient description phrases
        content_lower = content.lower().strip()
        is_ingredient_description = False
        for pattern in ingredient_description_starters:
            if re.match(pattern, content_lower, re.IGNORECASE):
                is_ingredient_description = True
                break
        
        if is_ingredient_description:
            logging.debug(f"Skipping '{title}' - content looks like ingredient description")
            continue
        
        recipes.append({
            "title": title,
            "description": extract_description(content, title),
            "cooking_time": extract_time(content),
            "difficulty": extract_difficulty(content),
            "cuisine": user_cuisine if user_cuisine else detect_cuisine(title + ' ' + content, user_cuisine),
            "ingredients": extract_ingredients(content),
            "full_content": content
        })
    
    return recipes

# ============== RESPONSE CACHE ==============
# In-memory cache for recipe responses (faster than DB lookups)
_recipe_cache: Dict[str, Dict[str, Any]] = {}
CACHE_MAX_SIZE = 100
CACHE_TTL_SECONDS = 600  # 10 minutes


def extract_user_cuisine(message: str) -> str:
    """Extract the cuisine the user selected from the message"""
    # Look for "Cuisine(s):" in the preferences section
    cuisine_match = re.search(r'Cuisine\(s\):\s*([^\n]+)', message, re.IGNORECASE)
    if cuisine_match:
        cuisine_text = cuisine_match.group(1).strip()
        # Handle "any cuisine" 
        if cuisine_text.lower() == 'any cuisine':
            return ''
        # Handle multiple cuisines - take the first one
        cuisines = [c.strip() for c in cuisine_text.split(',')]
        if cuisines:
            return cuisines[0]
    
    # Fallback: look for known cuisine names in the message
    known_cuisines = ['Indian', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai', 'Korean', 
                      'Mediterranean', 'American', 'French', 'Greek', 'Vietnamese', 'Spanish']
    message_lower = message.lower()
    for cuisine in known_cuisines:
        if cuisine.lower() in message_lower:
            return cuisine
    
    return ''


def get_cache_key(mood: str, meal_type: str, dietary_pref: str, cuisines: str, skip_cache: bool = False) -> str:
    """Generate a unique cache key for recipe request"""
    # If skip_cache is True, add a timestamp to make key unique
    key_str = f"{mood}:{meal_type}:{dietary_pref}:{cuisines}".lower()
    if skip_cache:
        key_str += f":{datetime.now(timezone.utc).timestamp()}"
    return hashlib.md5(key_str.encode()).hexdigest()


def is_more_recipes_request(message: str) -> bool:
    """Check if user is asking for more/different recipes"""
    lower_msg = message.lower()
    more_patterns = [
        "more recipe", "another recipe", "different recipe", 
        "show more", "more options", "other recipe", "other options",
        "something else", "different dish", "more dish", "another dish",
        "more suggestion", "different suggestion", "other suggestion",
        "more choices", "different choices", "alternatives",
        "give me more", "show me more", "more please"
    ]
    return any(pattern in lower_msg for pattern in more_patterns)


def extract_context_params(message: str) -> Optional[dict]:
    """
    Extract parameters from [Context: ...] format in the message.
    This is used when user types follow-up messages like "show more" after initial recipe generation.
    
    Returns dict with mood, meal_type, dietary_pref, cuisines or None if no context found.
    """
    if "[Context:" not in message:
        return None
    
    try:
        # Extract the context portion
        context_match = message.split("[Context:")[1].split("]")[0]
        params = {"mood": "", "meal_type": "", "dietary_pref": "", "cuisines": ""}
        
        for part in context_match.split(","):
            part = part.strip()
            if "=" in part:
                key, value = part.split("=", 1)
                key = key.strip().lower()
                value = value.strip()
                
                # Skip "not set" values
                if value.lower() == "not set" or not value:
                    continue
                
                if key == "mood":
                    params["mood"] = value
                elif key == "mealtype":
                    params["meal_type"] = value
                elif key == "dietary":
                    params["dietary_pref"] = value
                elif key == "cuisines":
                    # Convert comma-separated cuisine IDs to labels if needed
                    params["cuisines"] = value if value else "any cuisine"
        
        # Only return if we have at least mood and one other param
        if params["mood"] and (params["meal_type"] or params["dietary_pref"]):
            return params
        
        return None
    except Exception as e:
        logging.debug(f"Error extracting context params: {e}")
        return None

def get_cached_recipes(key: str) -> Optional[str]:
    """Get cached recipe response if not expired"""
    if key in _recipe_cache:
        entry = _recipe_cache[key]
        if datetime.now(timezone.utc).timestamp() - entry['timestamp'] < CACHE_TTL_SECONDS:
            logging.info(f"Cache HIT for recipe key: {key[:8]}...")
            return entry['response']
        else:
            del _recipe_cache[key]
    return None

def cache_recipes(key: str, response: str):
    """Cache recipe response"""
    # Evict oldest entries if cache is full
    if len(_recipe_cache) >= CACHE_MAX_SIZE:
        oldest_key = min(_recipe_cache.keys(), key=lambda k: _recipe_cache[k]['timestamp'])
        del _recipe_cache[oldest_key]
    
    _recipe_cache[key] = {
        'response': response,
        'timestamp': datetime.now(timezone.utc).timestamp()
    }
    logging.info(f"Cached recipe response for key: {key[:8]}...")

# ============== MODELS ==============

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    role: str
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    structured_data: Optional[Dict[str, Any]] = None

class ChatRequest(BaseModel):
    session_id: str
    message: str

class ChatResponse(BaseModel):
    session_id: str
    response: str
    timestamp: datetime
    structured_recipes: Optional[List[Dict[str, Any]]] = None

class DetailedRecipeRequest(BaseModel):
    recipe_title: str
    cuisine: str = "International"
    meal_type: str = "Dinner"
    dietary_pref: str = "Any"

# ============== MOOD DETECTION ==============

MOOD_CHANGE_PATTERNS = [
    r"mood (has |is )?changed?",
    r"feeling different",
    r"not in that mood",
    r"changed my mind",
    r"actually.*feeling",
    r"now (feeling|i'm|i feel)",
    r"instead.*feeling",
]

MOOD_KEYWORDS = {
    "happy": ["happy", "joyful", "cheerful", "pleased", "delighted", "great", "wonderful"],
    "sad": ["sad", "down", "blue", "melancholy", "upset", "depressed"],
    "angry": ["angry", "mad", "furious", "irritated", "frustrated", "annoyed"],
    "excited": ["excited", "thrilled", "pumped", "enthusiastic", "hyped"],
    "calm": ["calm", "peaceful", "relaxed", "tranquil", "serene", "chill"],
    "stressed": ["stressed", "anxious", "tense", "overwhelmed", "worried"],
    "cozy": ["cozy", "comfortable", "snug", "warm", "content", "homey"],
    "romantic": ["romantic", "loving", "amorous", "intimate"],
    "energetic": ["energetic", "lively", "active", "vibrant", "dynamic"]
}

MOOD_RESPONSES = {
    "happy": {
        "acknowledgment": "I can feel your positive energy!",
        "description": "vibrant, fresh, and colorful dishes",
        "emotion": "Let's celebrate that wonderful feeling with bright flavors!",
        "message": "Bright, vibrant meals can enhance that wonderful feeling."
    },
    "sad": {
        "acknowledgment": "I understand you're feeling down.",
        "description": "comforting, warm, and nostalgic dishes",
        "emotion": "Let me suggest some soul-soothing comfort food to help.",
        "message": "Comforting meals can provide warmth when you need it most."
    },
    "angry": {
        "acknowledgment": "I understand you're feeling frustrated.",
        "description": "bold, spicy, and intense flavors",
        "emotion": "Sometimes strong flavors can be satisfying when emotions run high.",
        "message": "Bold flavors can be surprisingly satisfying."
    },
    "excited": {
        "acknowledgment": "I can sense your excitement!",
        "description": "fun, creative, and adventurous dishes",
        "emotion": "Let's match that energy with something special!",
        "message": "Adventurous dishes match that exciting energy!"
    },
    "calm": {
        "acknowledgment": "I understand you're seeking tranquility.",
        "description": "balanced, light, and zen-like dishes",
        "emotion": "Let's find peaceful, mindful meals that promote calm.",
        "message": "Balanced meals support peaceful moments."
    },
    "stressed": {
        "acknowledgment": "I understand you're feeling overwhelmed.",
        "description": "simple, quick, and stress-free meals",
        "emotion": "Let me suggest easy dishes that won't add to your stress.",
        "message": "Simple, easy meals mean one less thing to worry about."
    },
    "cozy": {
        "acknowledgment": "I understand you're craving comfort and warmth.",
        "description": "warm, hearty, and snuggly dishes",
        "emotion": "Let's bring that warmth to your meal!",
        "message": "Cozy meals are comforting and satisfying."
    },
    "romantic": {
        "acknowledgment": "I understand you're in a romantic mood.",
        "description": "elegant, intimate, and special dishes",
        "emotion": "Let's create something special for a romantic moment.",
        "message": "Special meals create memorable moments."
    },
    "energetic": {
        "acknowledgment": "I can feel your energy!",
        "description": "fresh, protein-packed, and revitalizing dishes",
        "emotion": "Let's fuel that vitality with energizing meals!",
        "message": "Nutritious meals sustain that great energy!"
    }
}


def detect_mood_change(message: str) -> dict:
    """Detect if user is indicating a mood change and extract new mood"""
    user_message = message
    if "[Context:" in message and "]" in message:
        context_end = message.find("]") + 1
        user_message = message[context_end:].strip()
    
    lower_msg = user_message.lower().strip()
    
    is_mood_change = False
    for pattern in MOOD_CHANGE_PATTERNS:
        if re.search(pattern, lower_msg):
            is_mood_change = True
            break
    
    detected_mood = None
    best_position = -1
    
    for mood, keywords in MOOD_KEYWORDS.items():
        for keyword in keywords:
            pos = lower_msg.find(keyword)
            if pos != -1 and pos > best_position:
                prefix = lower_msg[max(0, pos-10):pos]
                if "from " not in prefix:
                    detected_mood = mood
                    best_position = pos
    
    word_count = len(lower_msg.split())
    is_direct_mood_response = detected_mood and word_count <= 5
    
    if detected_mood and (is_mood_change or is_direct_mood_response or "now" in lower_msg or "feeling" in lower_msg):
        return {"is_mood_change": True, "new_mood": detected_mood}
    elif is_mood_change:
        return {"is_mood_change": True, "new_mood": None}
    
    return {"is_mood_change": False, "new_mood": None}


def get_mood_change_response(new_mood: str, dietary_pref: str = None, meal_type: str = None, cuisines: str = None) -> str:
    """Generate empathetic response for mood change"""
    mood_data = MOOD_RESPONSES.get(new_mood, MOOD_RESPONSES["happy"])
    
    dietary_text = f"a {dietary_pref}" if dietary_pref else "a"
    meal_text = meal_type if meal_type else "meal"
    cuisine_text = f" with {cuisines} flavors" if cuisines and cuisines != "any cuisine" else ""
    
    response = f"""{mood_data['acknowledgment']} If you're feeling {new_mood} and looking for {dietary_text} {meal_text}{cuisine_text}, {mood_data['emotion'].lower()}

It's great to personalize your meals to match your feelings. {mood_data['message']}

Would you like me to suggest some {mood_data['description']} that match your new mood?"""
    
    return response


def is_mood_change_request(message: str, context: dict = None) -> dict:
    """Detect mood change and prepare response data"""
    result = detect_mood_change(message)
    
    if result["is_mood_change"]:
        if result["new_mood"]:
            dietary_pref = context.get("dietary_pref") if context else None
            meal_type = context.get("meal_type") if context else None
            cuisines = context.get("cuisines") if context else None
            
            return {
                "is_mood_change": True,
                "new_mood": result["new_mood"],
                "needs_clarification": False,
                "response": get_mood_change_response(result["new_mood"], dietary_pref, meal_type, cuisines)
            }
        else:
            return {
                "is_mood_change": True,
                "new_mood": None,
                "needs_clarification": True,
                "response": "I noticed your mood has changed. How are you feeling now? Are you feeling happy, sad, excited, calm, cozy, stressed, energetic, or something else?"
            }
    
    return {"is_mood_change": False}


def is_recipe_generation_request(message: str) -> dict:
    """Detect if message is a structured recipe request and extract parameters"""
    # Check for [User Preferences] marker - handle various message formats
    if "[User Preferences]" in message:
        lines = message.split("\n")
        params = {"mood": "", "meal_type": "", "dietary_pref": "", "cuisines": ""}
        for line in lines:
            if "- Mood:" in line:
                params["mood"] = line.split("- Mood:")[1].strip().split("(")[0].strip()
            elif "- Meal Type:" in line:
                params["meal_type"] = line.split("- Meal Type:")[1].strip()
            elif "- Dietary Preference:" in line:
                params["dietary_pref"] = line.split("- Dietary Preference:")[1].strip()
            elif "- Cuisine(s):" in line:
                params["cuisines"] = line.split("- Cuisine(s):")[1].strip()
        return params
    return None

# ============== PROMPT GENERATORS ==============

def get_conversational_system_message():
    """Short system message for general chat interactions"""
    return """You are MoodFood, a friendly chef helping users discover mood-based recipes. 
Be warm, concise, and helpful. Ask clarifying questions if needed."""


def get_recipe_generation_prompt(mood: str, meal_type: str, dietary_pref: str, cuisines: str, want_different: bool = False):
    """Generate a strict prompt that ONLY returns proper recipes, not ingredients"""
    different_instruction = ""
    if want_different:
        different_instruction = "IMPORTANT: Generate completely DIFFERENT recipes than before. "
    
    return f"""You are an expert chef. {different_instruction}Generate EXACTLY 4 complete {dietary_pref} {cuisines} {meal_type} RECIPES for someone feeling {mood}.

CRITICAL RULES:
1. Each item MUST be a COMPLETE DISH with multiple ingredients and cooking steps
2. NEVER suggest single ingredients like "Greek Yogurt", "Honey", "Nuts", "Tomatoes", "Eggs"
3. NEVER suggest generic foods - only COMPLETE RECIPES with names like "Greek Yogurt Parfait with Honey and Berries" or "Mediterranean Vegetable Frittata"
4. Each recipe MUST have: cooking time, difficulty, multiple ingredients, and cooking instructions

FORMAT - Use this EXACT structure for EACH recipe:

### 1. [Full Recipe Name - Must be a complete dish name]
**Cuisine:** {cuisines} | **Time:** [X] minutes | **Difficulty:** [Easy/Medium/Hard]

**Description:** [2 sentences about this complete dish]

**Key Ingredients:** [List 5-6 main ingredients]

**Quick Instructions:** [3-4 brief cooking steps]

**Mood Benefits:** [1 sentence on why this helps with {mood} mood]

---

### 2. [Next Recipe Name]
[Same format]

---

WRONG EXAMPLES (NEVER do this):
- "Greek Yogurt" ❌ (single ingredient)
- "Honey" ❌ (single ingredient)
- "Nuts and Berries" ❌ (just ingredients)
- "Eggs" ❌ (single ingredient)

CORRECT EXAMPLES:
- "Greek Yogurt Parfait with Honey Granola" ✓ (complete dish)
- "Mediterranean Shakshuka with Feta" ✓ (complete dish)
- "Spinach and Feta Frittata" ✓ (complete dish)
- "Honey Glazed Salmon with Vegetables" ✓ (complete dish)

Generate 4 COMPLETE RECIPES now:"""


def get_detailed_recipe_prompt(recipe_title: str, cuisine: str, meal_type: str, dietary_pref: str):
    """Generate a comprehensive detailed recipe prompt"""
    return f"""You are a professional chef instructor. Generate a COMPLETE, DETAILED recipe for "{recipe_title}".

Follow this EXACT format:

# {recipe_title.upper()}

## Recipe Information
- **Cuisine:** {cuisine}
- **Meal Type:** {meal_type}
- **Difficulty:** [Easy/Medium/Hard]
- **Servings:** [number]
- **Prep Time:** [X minutes]
- **Cook Time:** [X minutes]
- **Total Time:** [X minutes]
- **Dietary Tags:** [{dietary_pref}, plus any applicable: Gluten-Free, Dairy-Free, High-Protein, Low-Carb]

## Description
[Write 2-3 sentences describing the dish, its origins, and what makes it special.]

## 🥕 Ingredients

**For the Main Component:**
- [Exact quantity] [Ingredient name]

**For the Sauce/Seasoning:**
- [Exact quantity] [Ingredient name]

**For Garnish:**
- [Optional ingredients]

## 🔧 Equipment Needed
- [List 6-8 specific tools]

## 📋 Step-by-Step Instructions

**Step 1** ([X] minutes)
[Detailed instruction]
*Visual Cue:* [What to look for]

[Continue for 10-15 steps]

## 💡 Chef's Tips
1. [Tip 1]
2. [Tip 2]
3. [Tip 3]

## 📊 Nutritional Information (Per Serving)
- Calories: [X] kcal
- Protein: [X]g
- Carbohydrates: [X]g
- Fat: [X]g

## 🥡 Storage & Reheating
- **Storage:** [Instructions]
- **Reheating:** [Instructions]

## 🍷 Drink Pairings
**Non-Alcoholic:** [Options]
**Alcoholic (21+):** [Options]

## 🔄 Variations
1. [Variation 1]
2. [Variation 2]

CRITICAL RULES:
- Every step MUST have specific timing
- Every step MUST have exact measurements and temperatures
- Include visual/audio cues for EVERY step"""


def get_system_message(dietary_restrictions: List[str] = None, cuisine_preferences: List[str] = None):
    """Legacy system message for general chat"""
    base_message = """You are MoodFood, a compassionate nutritional expert and chef specializing in mood-based meal planning.

Your approach:
- Listen for emotional cues and acknowledge moods with empathy
- Explain the food-mood connection briefly
- Suggest authentic dishes from diverse global cuisines

When suggesting recipes, always include:
- Recipe name with cuisine type
- Cooking time and difficulty
- Brief appetizing description
- Key mood-boosting benefits

Be warm, encouraging, and concise."""
    
    if dietary_restrictions and len(dietary_restrictions) > 0:
        restrictions_text = ", ".join(dietary_restrictions)
        base_message += f"\n\nDietary restrictions: {restrictions_text}. All suggestions MUST accommodate these."
    
    if cuisine_preferences and len(cuisine_preferences) > 0:
        cuisines_text = ", ".join(cuisine_preferences)
        base_message += f"\n\nPreferred cuisines: {cuisines_text}. Prioritize these cuisines."
    
    return base_message

# ============== ROUTES ==============

@router.post("/send", response_model=ChatResponse)
async def send_chat_message(request: ChatRequest, current_user: User = Depends(get_current_user)):
    try:
        user_msg = ChatMessage(
            session_id=request.session_id,
            role="user",
            content=request.message
        )
        await db.chat_messages.insert_one({
            **user_msg.model_dump(),
            "timestamp": user_msg.timestamp.isoformat(),
            "user_id": current_user.id
        })
        
        # Get user's excluded ingredients for filtering
        user_exclusions = await get_user_excluded_ingredients(current_user.id)
        
        # Extract context from message if provided
        context = {}
        if "[Context:" in request.message:
            context_match = request.message.split("[Context:")[1].split("]")[0] if "[Context:" in request.message else ""
            for part in context_match.split(","):
                if "=" in part:
                    key, value = part.strip().split("=", 1)
                    if value and value.lower() != "not set":
                        context[key.lower().replace("dietary", "dietary_pref").replace("mealtype", "meal_type")] = value
        
        # Check if this is a recipe generation request FIRST
        # (to avoid mood change detection on structured recipe requests)
        recipe_params = is_recipe_generation_request(request.message)
        
        # If not a structured recipe request, check if it's a "show more" request with context
        is_show_more = is_more_recipes_request(request.message)
        if not recipe_params and is_show_more:
            # Try to extract params from [Context:] format
            context_params = extract_context_params(request.message)
            if context_params:
                recipe_params = context_params
                logging.info(f"'Show more' request detected with context params: {recipe_params}")
        
        # Check if this is a mood change request (only if not a recipe generation request)
        mood_change = is_mood_change_request(request.message, context) if not recipe_params else {"is_mood_change": False}
        
        if mood_change.get("is_mood_change"):
            if mood_change.get("needs_clarification"):
                ai_response = mood_change["response"]
            else:
                new_mood = mood_change.get("new_mood")
                ai_response = mood_change["response"]
                logging.info(f"Mood change detected: new_mood={new_mood}")
            
            assistant_msg = ChatMessage(
                session_id=request.session_id,
                role="assistant",
                content=ai_response
            )
            await db.chat_messages.insert_one({
                **assistant_msg.model_dump(),
                "timestamp": assistant_msg.timestamp.isoformat(),
                "user_id": current_user.id
            })
            
            return ChatResponse(
                session_id=request.session_id,
                response=ai_response,
                timestamp=assistant_msg.timestamp
            )
        
        if recipe_params:
            # Check recipe quota for free tier users using the new usage limit service
            quota_check = await check_recipe_limit(current_user.id)
            
            if not quota_check["allowed"]:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=403,
                    content={
                        "detail": {
                            "error": "feature_locked",
                            "message": f"Daily recipe limit reached ({quota_check['limit']} recipes/day). Upgrade for unlimited recipes!",
                            "feature": "recipe_search",
                            "upgrade_to": "premium_monthly",
                            "used": quota_check["used"],
                            "limit": quota_check["limit"]
                        }
                    }
                )
            
            # Determine how many recipes to generate based on remaining quota
            remaining = quota_check.get("remaining", 5)
            # For unlimited users (remaining = -1), generate up to 4
            recipes_to_generate = 4 if remaining == -1 else min(4, remaining)
            
            if recipes_to_generate == 0:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=403,
                    content={
                        "detail": {
                            "error": "feature_locked", 
                            "message": f"Daily recipe limit reached ({quota_check['limit']} recipes/day). Upgrade for unlimited recipes!",
                            "feature": "recipe_search",
                            "upgrade_to": "premium_monthly",
                            "used": quota_check["used"],
                            "limit": quota_check["limit"]
                        }
                    }
                )
            
            # Check if user is asking for more/different recipes
            skip_cache = is_more_recipes_request(request.message)
            
            # Check cache first for faster response (skip if user wants more recipes)
            cache_key = get_cache_key(
                recipe_params["mood"],
                recipe_params["meal_type"],
                recipe_params["dietary_pref"],
                recipe_params["cuisines"],
                skip_cache=skip_cache
            )
            
            # Only use cache if user has no exclusions (exclusions make recipes unique) and not asking for more
            cached_response = get_cached_recipes(cache_key) if (not user_exclusions and not skip_cache) else None
            
            if cached_response:
                # Parse structured recipes even for cached responses
                # This ensures frontend always gets structured data
                cached_structured_recipes = None
                user_cuisine = extract_user_cuisine(request.message)
                try:
                    all_cached_recipes = parse_recipes_to_json(cached_response, user_cuisine)
                    # LIMIT to quota - only return allowed number of recipes
                    cached_structured_recipes = all_cached_recipes[:recipes_to_generate]
                    logging.info(f"Returning {len(cached_structured_recipes)} recipes from cache (quota: {recipes_to_generate})")
                    
                    # INCREMENT USAGE COUNTER for cached responses too
                    if cached_structured_recipes and len(cached_structured_recipes) > 0:
                        await increment_recipe_count(current_user.id, len(cached_structured_recipes))
                        logging.info(f"Incremented recipe count for cached response by {len(cached_structured_recipes)}")
                except Exception as parse_error:
                    logging.error(f"Recipe parsing error (cached): {parse_error}")
                
                # Return cached response with LIMITED structured recipes
                assistant_msg = ChatMessage(
                    session_id=request.session_id,
                    role="assistant",
                    content=cached_response,
                    structured_data={"recipes": cached_structured_recipes} if cached_structured_recipes else None
                )
                await db.chat_messages.insert_one({
                    **assistant_msg.model_dump(),
                    "timestamp": assistant_msg.timestamp.isoformat(),
                    "user_id": current_user.id
                })
                
                return ChatResponse(
                    session_id=request.session_id,
                    response=cached_response,
                    timestamp=assistant_msg.timestamp,
                    structured_recipes=cached_structured_recipes
                )
            
            system_msg = get_recipe_generation_prompt(
                mood=recipe_params["mood"],
                meal_type=recipe_params["meal_type"],
                dietary_pref=recipe_params["dietary_pref"],
                cuisines=recipe_params["cuisines"],
                want_different=skip_cache
            )
            if current_user.dietary_restrictions:
                system_msg += f"\n\nDIETARY RESTRICTIONS: {', '.join(current_user.dietary_restrictions)}. All recipes MUST comply."
            
            if user_exclusions:
                exclusion_list = ", ".join(user_exclusions)
                system_msg += f"""

FOOD RESTRICTIONS: Never suggest recipes containing: {exclusion_list}
- Avoid all variations (e.g., if "shrimp" excluded, also avoid prawns)
- Choose alternative proteins/ingredients instead"""
            
            user_text = f"Generate {recipes_to_generate} {recipe_params['meal_type'].lower()} recipes for someone feeling {recipe_params['mood'].lower()}, preferring {recipe_params['dietary_pref'].lower()} {recipe_params['cuisines']} cuisine."
            if user_exclusions:
                user_text += f" Avoid: {', '.join(user_exclusions)}."
            logging.info(f"Recipe generation request: {recipe_params}, exclusions: {user_exclusions}, count: {recipes_to_generate}")
        else:
            system_msg = get_system_message(current_user.dietary_restrictions, current_user.cuisine_preferences)
            if user_exclusions:
                system_msg += f"\n\nIMPORTANT: User has food allergies/exclusions. Never recommend: {', '.join(user_exclusions)}."
            user_text = request.message
        
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=f"{request.session_id}-{uuid.uuid4().hex[:8]}",
            system_message=system_msg
        )
        model_name = "gpt-4o-mini" if recipe_params else "gpt-4o"
        chat.with_model("openai", model_name)
        
        user_message = UserMessage(text=user_text)
        ai_response = await chat.send_message(user_message)
        
        # CRITICAL SAFETY FILTER
        if recipe_params and user_exclusions:
            logging.info(f"Applying safety filter for exclusions: {user_exclusions}")
            
            filtered_response, removed_recipes, violations = filter_unsafe_recipes_from_response(
                ai_response, user_exclusions
            )
            
            if removed_recipes:
                logging.warning(f"SAFETY: Removed {len(removed_recipes)} unsafe recipes: {removed_recipes}")
            
            has_recipe_content = any(marker in filtered_response for marker in ['###', '**Ingredients', '**Instructions'])
            if has_recipe_content:
                filtered_response = filter_recipe_text_strictly(filtered_response, user_exclusions)
            
            ai_response = filtered_response
        
        # Cache the recipe response for future requests (only if no exclusions)
        if recipe_params and not user_exclusions:
            cache_recipes(cache_key, ai_response)
        
        # CRITICAL: Parse recipes to structured JSON on backend
        # This ensures consistent parsing and avoids brittle frontend regex
        # ALWAYS try to parse - the LLM might include recipes in any response
        structured_recipes = None
        user_cuisine = extract_user_cuisine(request.message)
        try:
            potential_recipes = parse_recipes_to_json(ai_response, user_cuisine)
            # Only include if we found actual recipes (at least 1)
            if potential_recipes and len(potential_recipes) >= 1:
                # LIMIT to quota - only return allowed number of recipes
                structured_recipes = potential_recipes[:recipes_to_generate] if recipe_params else potential_recipes
                logging.info(f"Returning {len(structured_recipes)} recipes (quota: {recipes_to_generate if recipe_params else 'unlimited'})")
                for r in structured_recipes[:3]:  # Log first 3
                    logging.info(f"  - {r.get('title', 'No title')} ({r.get('cuisine', 'No cuisine')})")
                
                # INCREMENT USAGE COUNTER after successful recipe generation
                # This is the key fix - we count RECIPES, not REQUESTS
                if recipe_params and len(structured_recipes) > 0:
                    await increment_recipe_count(current_user.id, len(structured_recipes))
                    logging.info(f"Incremented recipe count for user {current_user.id} by {len(structured_recipes)}")
                
                # Save successfully parsed recipes to the library
                if recipe_params:
                    try:
                        saved_count = await save_recipes_to_library(
                            db,
                            structured_recipes,
                            mood=recipe_params.get("mood", ""),
                            meal_type=recipe_params.get("meal_type", ""),
                            dietary=recipe_params.get("dietary_pref", ""),
                            cuisine=user_cuisine or recipe_params.get("cuisines", "")
                        )
                        if saved_count > 0:
                            logging.info(f"Saved {saved_count} new recipes to library")
                    except Exception as save_error:
                        logging.warning(f"Failed to save recipes to library: {save_error}")
                        # Don't fail the request if saving fails
        except Exception as parse_error:
            logging.error(f"Recipe parsing error: {parse_error}")
            structured_recipes = None
        
        assistant_msg = ChatMessage(
            session_id=request.session_id,
            role="assistant",
            content=ai_response,
            structured_data={"recipes": structured_recipes} if structured_recipes else None
        )
        await db.chat_messages.insert_one({
            **assistant_msg.model_dump(),
            "timestamp": assistant_msg.timestamp.isoformat(),
            "user_id": current_user.id
        })
        
        return ChatResponse(
            session_id=request.session_id,
            response=ai_response,
            timestamp=assistant_msg.timestamp,
            structured_recipes=structured_recipes
        )
    except Exception as e:
        logging.error(f"Error in chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{session_id}")
async def get_chat_history(session_id: str, current_user: User = Depends(get_current_user)):
    try:
        messages = await db.chat_messages.find(
            {"session_id": session_id, "user_id": current_user.id},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(100)
        
        for msg in messages:
            if isinstance(msg.get('timestamp'), str):
                msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
        
        return {"messages": messages}
    except Exception as e:
        logging.error(f"Error fetching history: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ============== HYBRID RECIPE GENERATION (SERPAPI + AI) ==============

class HybridRecipeRequest(BaseModel):
    """Request for hybrid recipe generation using both SerpAPI and AI"""
    mood: str
    cuisines: List[str]
    meal_type: str = "dinner"
    dietary_preference: Optional[str] = None
    use_serpapi: bool = True  # Enable/disable SerpAPI search
    limit: int = 6

class HybridRecipeResponse(BaseModel):
    """Response containing recipes from both sources"""
    session_id: str
    serpapi_recipes: List[Dict[str, Any]] = []  # Real recipes from Google
    ai_recipes: List[Dict[str, Any]] = []  # AI-generated recipes
    combined_recipes: List[Dict[str, Any]] = []  # Merged and deduplicated
    source: str  # "serpapi", "ai", or "hybrid"
    timestamp: datetime


@router.post("/recipes/hybrid", response_model=HybridRecipeResponse)
async def get_hybrid_recipes(
    request: HybridRecipeRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Generate recipes using both SerpAPI (real recipes from Google) and AI.
    
    This endpoint:
    1. First searches SerpAPI for real recipes with ratings, links, and ingredients
    2. Then generates complementary AI recipes for variety
    3. Returns a combined list with source attribution
    
    Benefits:
    - Real recipes with verified ratings and user reviews
    - Links to original recipe sources
    - AI-generated variety for unique mood-based suggestions
    """
    session_id = str(uuid.uuid4())
    serpapi_recipes = []
    ai_recipes = []
    
    try:
        # Step 1: Fetch real recipes from SerpAPI
        if request.use_serpapi:
            for cuisine in request.cuisines[:2]:  # Limit to 2 cuisines for speed
                serp_result = await search_recipes_for_mood(
                    mood=request.mood,
                    cuisine=cuisine,
                    meal_type=request.meal_type,
                    dietary=request.dietary_preference,
                    limit=max(3, request.limit // len(request.cuisines))
                )
                
                if serp_result.get("success") and serp_result.get("recipes"):
                    for recipe in serp_result["recipes"]:
                        serpapi_recipes.append({
                            "title": recipe.get("title", ""),
                            "description": recipe.get("description", ""),
                            "cooking_time": recipe.get("cooking_time", "30 min"),
                            "difficulty": recipe.get("difficulty", "Medium"),
                            "cuisine": cuisine,
                            "rating": recipe.get("rating"),
                            "reviews": recipe.get("reviews", 0),
                            "source": recipe.get("source", ""),
                            "link": recipe.get("link", ""),
                            "thumbnail": recipe.get("thumbnail", ""),
                            "ingredients": recipe.get("ingredients", []),
                            "source_type": "serpapi"  # Mark as SerpAPI recipe
                        })
        
        logging.info(f"SerpAPI returned {len(serpapi_recipes)} recipes for {request.cuisines}")
        
        # Step 2: Generate AI recipes for variety (only if we need more)
        if len(serpapi_recipes) < request.limit:
            ai_needed = request.limit - len(serpapi_recipes)
            cuisines_text = ", ".join(request.cuisines)
            
            prompt = f"""Generate {ai_needed} unique {request.meal_type} recipes for someone feeling {request.mood}.
Cuisines: {cuisines_text}
{"Dietary: " + request.dietary_preference if request.dietary_preference else ""}

For each recipe provide:
### Recipe Name
- **Cooking Time:** X minutes
- **Difficulty:** Easy/Medium/Hard
- **Description:** 2-3 sentences about the dish

Do NOT repeat these recipes: {', '.join([r['title'] for r in serpapi_recipes])}
"""
            
            chat = LlmChat(
                api_key=os.environ.get('EMERGENT_LLM_KEY'),
                session_id=f"hybrid-{session_id}",
                system_message="You are a creative chef generating unique recipe suggestions."
            )
            chat.with_model("openai", "gpt-4o-mini")
            
            ai_response = await chat.send_message(UserMessage(text=prompt))
            
            # Parse AI response
            ai_parsed = parse_recipes_to_json(ai_response)
            for recipe in ai_parsed[:ai_needed]:
                recipe["source_type"] = "ai"  # Mark as AI-generated
                ai_recipes.append(recipe)
        
        # Step 3: Combine and deduplicate
        combined = []
        seen_titles = set()
        
        # Add SerpAPI recipes first (they have ratings and links)
        for recipe in serpapi_recipes:
            title_lower = recipe["title"].lower()
            if title_lower not in seen_titles:
                seen_titles.add(title_lower)
                combined.append(recipe)
        
        # Add AI recipes
        for recipe in ai_recipes:
            title_lower = recipe["title"].lower()
            if title_lower not in seen_titles:
                seen_titles.add(title_lower)
                combined.append(recipe)
        
        # Determine source attribution
        source = "hybrid"
        if len(serpapi_recipes) > 0 and len(ai_recipes) == 0:
            source = "serpapi"
        elif len(serpapi_recipes) == 0 and len(ai_recipes) > 0:
            source = "ai"
        
        logging.info(f"Hybrid recipe generation: {len(serpapi_recipes)} from SerpAPI, {len(ai_recipes)} from AI")
        
        return HybridRecipeResponse(
            session_id=session_id,
            serpapi_recipes=serpapi_recipes,
            ai_recipes=ai_recipes,
            combined_recipes=combined[:request.limit],
            source=source,
            timestamp=datetime.now(timezone.utc)
        )
        
    except Exception as e:
        logging.error(f"Hybrid recipe generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ============================================================================
# AI CHEF CONVERSATION ENDPOINT
# ============================================================================

class AIChefMessage(BaseModel):
    """Single message in AI Chef conversation"""
    role: str  # 'user', 'assistant', 'system'
    content: str

class AIChefRequest(BaseModel):
    """Request for AI Chef conversation"""
    message: str
    recipe_context: Dict[str, Any]  # Recipe title, ingredients, instructions
    conversation_history: List[AIChefMessage] = []
    current_step: int = 0

class AIChefResponse(BaseModel):
    """Response from AI Chef"""
    text: str
    emotion: str = "neutral"
    step: int
    navigation: Optional[str] = None  # 'next', 'back', 'repeat', 'complete', None

@router.post("/ai-chef/chat", response_model=AIChefResponse)
async def ai_chef_chat(
    request: AIChefRequest,
    current_user: User = Depends(get_current_user)
):
    """
    AI Chef conversation endpoint - handles cooking assistant chat
    Processes navigation commands locally, sends questions to AI
    """
    try:
        message = request.message.lower().strip()
        recipe = request.recipe_context
        instructions = recipe.get('instructions', [])
        current_step = request.current_step
        
        # Handle navigation commands locally (no AI needed)
        if 'next' in message or 'continue' in message:
            if current_step < len(instructions) - 1:
                new_step = current_step + 1
                return AIChefResponse(
                    text=f"Great job! Step {new_step + 1}: {instructions[new_step]}",
                    emotion="encouraging",
                    step=new_step,
                    navigation="next"
                )
            else:
                return AIChefResponse(
                    text="You've completed all the steps! Amazing work, chef! Your dish is ready!",
                    emotion="celebratory",
                    step=current_step,
                    navigation="complete"
                )
        
        if 'back' in message or 'previous' in message:
            if current_step > 0:
                new_step = current_step - 1
                return AIChefResponse(
                    text=f"No problem, let's go back. Step {new_step + 1}: {instructions[new_step]}",
                    emotion="supportive",
                    step=new_step,
                    navigation="back"
                )
            else:
                return AIChefResponse(
                    text=f"We're already at the first step. Here it is again: {instructions[0] if instructions else 'No instructions available'}",
                    emotion="helpful",
                    step=current_step,
                    navigation="stay"
                )
        
        if 'repeat' in message or 'again' in message:
            step_text = instructions[current_step] if current_step < len(instructions) else "No current step"
            return AIChefResponse(
                text=f"Of course! Step {current_step + 1}: {step_text}",
                emotion="patient",
                step=current_step,
                navigation="repeat"
            )
        
        # For questions and other messages, use AI
        system_prompt = f"""You are a warm, friendly AI chef assistant helping someone cook "{recipe.get('title', 'a delicious dish')}". 

RECIPE CONTEXT:
- Title: {recipe.get('title', 'Unknown')}
- Servings: {recipe.get('servings', 'Not specified')}
- Current Step: {current_step + 1} of {len(instructions)}

INGREDIENTS:
{chr(10).join(['- ' + str(i) for i in recipe.get('ingredients', [])[:15]])}

CURRENT STEP:
{instructions[current_step] if current_step < len(instructions) else 'Completed'}

YOUR PERSONALITY:
- Be warm, encouraging, and patient
- Use casual, friendly language
- Add cooking tips when relevant
- Keep responses concise (2-3 sentences max)
- Answer cooking questions helpfully"""

        # Build conversation for AI
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=f"ai-chef-{current_user.id}-{uuid.uuid4().hex[:8]}",
            system_message=system_prompt
        )
        chat.with_model("openai", "gpt-4o-mini")
        
        # Add conversation history
        for msg in request.conversation_history[-6:]:  # Last 6 messages for context
            if msg.role == 'user':
                await chat.send_message(UserMessage(text=msg.content))
        
        # Send current message
        ai_response = await chat.send_message(UserMessage(text=request.message))
        
        # Detect emotion from response
        emotion = "neutral"
        lower_response = ai_response.lower()
        if any(w in lower_response for w in ['great', 'perfect', 'excellent', 'wonderful']):
            emotion = "encouraging"
        elif any(w in lower_response for w in ['tip', 'trick', 'try', 'suggest']):
            emotion = "informative"
        elif any(w in lower_response for w in ['careful', 'watch', 'attention', 'don\'t']):
            emotion = "cautioning"
        
        return AIChefResponse(
            text=ai_response,
            emotion=emotion,
            step=current_step,
            navigation=None
        )
        
    except Exception as e:
        logging.error(f"AI Chef error: {e}")
        # Fallback response
        return AIChefResponse(
            text="I understand. Let me know if you need help with this step!",
            emotion="supportive",
            step=request.current_step,
            navigation=None
        )
