"""
SerpAPI Integration Service
Provides recipe search, grocery store finder, and ingredient price check features
"""

import os
import re
import httpx
import logging
import asyncio
from typing import List, Dict, Optional
from urllib.parse import urlencode
from datetime import datetime, timedelta

SERPAPI_KEY = os.environ.get('SERPAPI_KEY', '61b164ba24fae31ca5fda08e0280c76c873edfc80cf9d34169587d52a7fb42ac')
SERPAPI_BASE_URL = "https://serpapi.com/search.json"

# Rate limiting: Track API calls to avoid 429 errors
_last_api_call = datetime.min
_api_call_lock = asyncio.Lock()
_min_delay_seconds = 0.5  # Minimum 500ms between API calls


def extract_actual_dish_name(creative_name: str) -> str:
    """
    Extract the actual dish name from creative AI-generated recipe titles.
    
    Examples:
    - "Tranquil Tofu Palak" -> "Tofu Palak" (removes "Tranquil")
    - "Sunny Paneer Tikka Masala Delight" -> "Paneer Tikka Masala" (removes "Sunny" and "Delight")
    - "Happy Hour Vegetable Biryani" -> "Vegetable Biryani"
    - "Seaside Shrimp Revuelto" -> "Shrimp Revuelto"
    - "Happy Mussalana Prawn Poha" -> "Prawn Poha"
    - "Paneer Tikka" -> "Paneer Tikka" (already good)
    """
    if not creative_name:
        return creative_name
    
    # Common creative adjectives/prefixes to remove (can appear multiple times)
    creative_words = r'(tranquil|peaceful|serene|calm|blissful|happy|joyful|sunny|radiant|golden|cozy|warm|hearty|vibrant|colorful|delightful|wonderful|amazing|incredible|fantastic|ultimate|perfect|best|great|lovely|beautiful|gorgeous|stunning|elegant|simple|easy|quick|super|mega|ultra|royal|classic|traditional|authentic|homestyle|homemade|grandma\'?s?|mom\'?s?|chef\'?s?|secret|special|famous|legendary|divine|heavenly|dreamy|magical|enchanted|mystical|seaside|coastal|ocean|beachside|tropical|island|garden|forest|countryside|rustic|modern|fusion|artisan|gourmet|decadent|luxurious|comforting|soothing|refreshing|energizing|wholesome|mussalana|sensational|morning|evening|afternoon|delight|bliss|heaven|wonder|joy|love|special|midnight|sunrise|sunset|exquisite|savory|aromatic|zesty|tangy|spicy|mild|rich|creamy|crispy|crunchy|tender|succulent|luscious|mouthwatering|tasty|yummy|scrumptious|delectable|sumptuous|appetizing|flavorful|fragrant)'
    
    remove_prefixes = [
        rf'^{creative_words}\s+',
    ]
    
    # Common creative suffixes to remove
    remove_suffixes = [
        r'\s+(delight|bliss|heaven|dream|magic|wonder|joy|love|special|supreme|royale|supreme|deluxe|premium|gourmet|style|twist|remix|fusion|explosion|extravaganza|fiesta|celebration|party|bowl|plate|platter|medley|symphony|harmony|sensation|paradise|escape|adventure|journey|experience)$',
    ]
    
    result = creative_name
    
    # Remove prefixes (may need multiple passes for stacked adjectives like "Happy Mussalana")
    for _ in range(3):  # Up to 3 creative words at start
        for pattern in remove_prefixes:
            result = re.sub(pattern, '', result, flags=re.IGNORECASE)
    
    # Remove suffixes
    for pattern in remove_suffixes:
        result = re.sub(pattern, '', result, flags=re.IGNORECASE)
    
    # Remove parentheses and their contents (often cooking time)
    result = re.sub(r'\s*\([^)]+\)\s*', ' ', result)
    
    # Clean up extra whitespace
    result = ' '.join(result.split())
    
    # If we removed everything, return original
    if not result or len(result) < 3:
        return creative_name
    
    return result


async def _rate_limited_request(client: httpx.AsyncClient, url: str, params: dict) -> httpx.Response:
    """
    Make a rate-limited request to SerpAPI to avoid 429 errors.
    """
    global _last_api_call
    
    async with _api_call_lock:
        # Wait if we're calling too fast
        now = datetime.now()
        time_since_last = (now - _last_api_call).total_seconds()
        if time_since_last < _min_delay_seconds:
            await asyncio.sleep(_min_delay_seconds - time_since_last)
        
        _last_api_call = datetime.now()
    
    return await client.get(url, params=params)


async def search_recipes(query: str, cuisine: str = None, dietary: str = None, limit: int = 10) -> Dict:
    """
    Search for recipes from external websites using Google Search
    Returns rich recipe data from Google's recipe search results
    """
    try:
        # Build search query optimized for recipe results
        search_query = f"{query} recipe"
        if cuisine:
            search_query = f"{cuisine} {query} recipe"
        if dietary:
            search_query += f" {dietary}"
        
        params = {
            "api_key": SERPAPI_KEY,
            "engine": "google",
            "q": search_query,
            "num": limit * 2,  # Get extra results for filtering
            "gl": "us",
            "hl": "en",
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await _rate_limited_request(client, SERPAPI_BASE_URL, params)
            response.raise_for_status()
            data = response.json()
        
        recipes = []
        
        # PRIORITY 1: Rich recipe results from Google's recipe carousel
        # These have structured data with ratings, time, ingredients
        if "recipes_results" in data:
            for r in data["recipes_results"][:limit]:
                recipe = {
                    "title": r.get("title", ""),
                    "link": r.get("link", ""),
                    "source": r.get("source", ""),
                    "rating": r.get("rating"),
                    "reviews": r.get("reviews", 0),
                    "total_time": r.get("total_time", ""),
                    "ingredients": r.get("ingredients", []),
                    "thumbnail": r.get("thumbnail", ""),
                    "is_featured": True,
                    "description": f"From {r.get('source', 'Web')} - {r.get('total_time', 'Time varies')}",
                }
                recipes.append(recipe)
        
        # PRIORITY 2: Organic search results (as fallback)
        if len(recipes) < limit:
            organic_results = data.get("organic_results", [])
            for result in organic_results:
                if len(recipes) >= limit:
                    break
                # Filter for recipe-related results
                title = result.get("title", "")
                snippet = result.get("snippet", "")
                if any(word in title.lower() or word in snippet.lower() 
                       for word in ["recipe", "cook", "make", "how to"]):
                    recipe = {
                        "title": title.replace(" Recipe", "").replace(" - ", " ").strip(),
                        "link": result.get("link", ""),
                        "source": result.get("displayed_link", ""),
                        "thumbnail": result.get("thumbnail", ""),
                        "description": snippet[:200] if snippet else "",
                        "is_featured": False
                    }
                    # Avoid duplicates
                    if not any(r["title"].lower() == recipe["title"].lower() for r in recipes):
                        recipes.append(recipe)
        
        logging.info(f"SerpAPI recipe search for '{search_query}': Found {len(recipes)} recipes")
        
        return {
            "success": True,
            "query": search_query,
            "results": recipes[:limit],
            "total_found": len(recipes)
        }
        
    except Exception as e:
        logging.error(f"SerpAPI recipe search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "results": []
        }


async def search_recipes_for_mood(
    mood: str, 
    cuisine: str, 
    meal_type: str = "dinner",
    dietary: str = None, 
    limit: int = 6
) -> Dict:
    """
    Search for SPECIFIC recipes (not collection pages) matching mood, cuisine, and meal type.
    Returns structured recipe data ready for display in the chat.
    """
    try:
        # Use SPECIFIC dish queries instead of generic "recipe" searches
        # This helps get actual recipes, not "40+ best recipes" collection pages
        cuisine_dishes = {
            "indian": ["butter chicken", "paneer tikka", "dal makhani", "biryani", "palak paneer", "chicken curry", "samosa", "naan bread", "tandoori chicken", "chana masala", "aloo gobi", "malai kofta"],
            "italian": ["pasta carbonara", "margherita pizza", "lasagna", "risotto", "tiramisu", "bruschetta", "gnocchi", "pesto pasta", "chicken parmesan", "minestrone soup", "caprese salad", "osso buco"],
            "mexican": ["tacos al pastor", "chicken enchiladas", "guacamole", "quesadilla", "burrito bowl", "churros", "pozole", "tamales", "chile relleno", "carnitas", "fajitas", "elote"],
            "thai": ["pad thai", "green curry", "tom yum soup", "massaman curry", "thai basil chicken", "spring rolls", "mango sticky rice", "larb", "papaya salad", "panang curry", "red curry", "satay"],
            "chinese": ["kung pao chicken", "sweet and sour pork", "fried rice", "dumplings", "mapo tofu", "chow mein", "hot pot", "peking duck", "spring rolls", "dan dan noodles", "char siu", "wonton soup"],
            "japanese": ["sushi rolls", "ramen", "teriyaki chicken", "miso soup", "tempura", "gyoza", "okonomiyaki", "katsu curry", "yakitori", "udon noodles", "onigiri", "tamagoyaki"],
            "mediterranean": ["falafel", "hummus bowl", "greek salad", "shawarma", "moussaka", "tzatziki", "baba ganoush", "tabbouleh", "souvlaki", "spanakopita", "dolmas", "fattoush"],
            "american": ["mac and cheese", "bbq ribs", "burger", "fried chicken", "meatloaf", "clam chowder", "cornbread", "coleslaw", "pulled pork", "buffalo wings", "pot roast", "biscuits and gravy"],
            "french": ["croissants", "beef bourguignon", "coq au vin", "ratatouille", "quiche", "crepes", "french onion soup", "duck confit", "souffle", "bouillabaisse", "cassoulet", "tarte tatin"],
            "korean": ["bibimbap", "korean fried chicken", "kimchi jjigae", "bulgogi", "japchae", "tteokbokki", "samgyeopsal", "sundubu jjigae", "kimbap", "galbi", "jjajangmyeon", "hobakjuk"],
        }
        
        # Get dishes for this cuisine
        cuisine_lower = cuisine.lower()
        dishes = cuisine_dishes.get(cuisine_lower, [f"{cuisine} dinner", f"{cuisine} lunch", f"{cuisine} dish"])
        
        # Select dishes based on meal type
        import random
        random.shuffle(dishes)
        selected_dishes = dishes[:limit + 4]  # Get extra for filtering
        
        all_recipes = []
        
        # Search for each specific dish
        for dish in selected_dishes[:min(4, limit + 2)]:  # Limit API calls
            search_query = f"{dish} recipe"
            if dietary and dietary.lower() != "non-vegetarian":
                search_query = f"{dietary} {dish} recipe"
            
            params = {
                "api_key": SERPAPI_KEY,
                "engine": "google",
                "q": search_query,
                "num": 5,
                "gl": "us",
                "hl": "en",
            }
            
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    response = await _rate_limited_request(client, SERPAPI_BASE_URL, params)
                    response.raise_for_status()
                    data = response.json()
                
                # Extract rich recipe results from recipe carousel
                if "recipes_results" in data:
                    for r in data["recipes_results"][:2]:  # Take top 2 from each search
                        title = r.get("title", "")
                        
                        # FILTER OUT collection pages
                        if is_collection_page(title):
                            continue
                        
                        # Parse cooking time
                        total_time = r.get("total_time", "30 min")
                        time_minutes = parse_time_to_minutes(total_time)
                        
                        # Determine difficulty
                        ingredient_count = len(r.get("ingredients", []))
                        difficulty = determine_difficulty(time_minutes, ingredient_count)
                        
                        # Clean source name
                        source_name = clean_source_name(r.get("source", ""))
                        
                        recipe = {
                            "title": title,
                            "link": r.get("link", ""),
                            "source": source_name,
                            "rating": r.get("rating"),
                            "reviews": r.get("reviews", 0),
                            "cooking_time": total_time,
                            "difficulty": difficulty,
                            "ingredients": r.get("ingredients", []),
                            "thumbnail": r.get("thumbnail", ""),
                            "cuisine": cuisine,
                            "description": f"From {source_name}. Rating: {r.get('rating', 'N/A')}⭐ ({r.get('reviews', 0)} reviews)",
                        }
                        
                        # Avoid duplicates
                        if not any(existing["title"].lower() == recipe["title"].lower() for existing in all_recipes):
                            all_recipes.append(recipe)
                        
                        if len(all_recipes) >= limit:
                            break
                
            except Exception as search_error:
                logging.warning(f"Search error for '{dish}': {search_error}")
                continue
            
            if len(all_recipes) >= limit:
                break
        
        logging.info(f"Mood recipe search for '{mood}' {cuisine} {meal_type}: Found {len(all_recipes)} specific recipes")
        
        return {
            "success": True,
            "mood": mood,
            "cuisine": cuisine,
            "meal_type": meal_type,
            "recipes": all_recipes[:limit],
            "total_found": len(all_recipes)
        }
        
    except Exception as e:
        logging.error(f"SerpAPI mood recipe search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "recipes": []
        }


def is_collection_page(title: str) -> bool:
    """Check if a title indicates a collection/roundup page rather than a specific recipe"""
    title_lower = title.lower()
    collection_patterns = [
        r'\d+\+?\s*(best|top|easy|quick|healthy)',  # "40+ best", "10 easy"
        r'\d+\s+(recipes|ideas|dishes)',  # "40 recipes", "25 ideas"
        r'(best|top)\s+\d+',  # "best 10", "top 25"
        r'(roundup|collection|list)',
        r'recipes?\s*$',  # Ends with "recipes"
        r'^(best|top|easy)\s+\w+\s+recipes',  # "best indian recipes"
    ]
    
    for pattern in collection_patterns:
        if re.search(pattern, title_lower):
            return True
    
    # Also check for very short generic titles
    if len(title) < 10:
        return True
    
    return False


def parse_time_to_minutes(time_str: str) -> int:
    """Parse cooking time string to minutes"""
    if not time_str:
        return 30
    
    time_str = time_str.lower()
    total_minutes = 0
    
    # Extract hours
    hour_match = re.search(r'(\d+)\s*(?:hr|hour)', time_str)
    if hour_match:
        total_minutes += int(hour_match.group(1)) * 60
    
    # Extract minutes
    min_match = re.search(r'(\d+)\s*(?:min|m\b)', time_str)
    if min_match:
        total_minutes += int(min_match.group(1))
    
    # If no pattern matched, try just extracting number
    if total_minutes == 0:
        num_match = re.search(r'(\d+)', time_str)
        if num_match:
            total_minutes = int(num_match.group(1))
    
    return total_minutes if total_minutes > 0 else 30


def determine_difficulty(time_minutes: int, ingredient_count: int) -> str:
    """Determine recipe difficulty based on time and ingredients"""
    if time_minutes <= 20 and ingredient_count <= 6:
        return "Easy"
    elif time_minutes >= 60 or ingredient_count >= 12:
        return "Hard"
    else:
        return "Medium"


def clean_source_name(source: str) -> str:
    """Clean up source name to be human-readable"""
    if not source:
        return "Web Recipe"
    
    # Remove common URL patterns
    source = re.sub(r'^https?://', '', source)
    source = re.sub(r'^www\.', '', source)
    source = re.sub(r'\.com.*$', '', source)
    source = re.sub(r'\.org.*$', '', source)
    source = re.sub(r'\.net.*$', '', source)
    
    # Handle specific known sources
    source_mappings = {
        'allrecipes': 'AllRecipes',
        'foodnetwork': 'Food Network',
        'epicurious': 'Epicurious',
        'bonappetit': 'Bon Appetit',
        'seriouseats': 'Serious Eats',
        'simplyrecipes': 'Simply Recipes',
        'delish': 'Delish',
        'tasty': 'Tasty',
        'food52': 'Food52',
        'thekitchn': 'The Kitchn',
        'cookinglight': 'Cooking Light',
        'eatingwell': 'Eating Well',
        'myrecipes': 'My Recipes',
        'bettycrocker': 'Betty Crocker',
        'pillsbury': 'Pillsbury',
        'marthastewart': 'Martha Stewart',
        'rachaelray': 'Rachael Ray',
        'budgetbytes': 'Budget Bytes',
        'skinnytaste': 'Skinny Taste',
        'cookieandkate': 'Cookie and Kate',
        'minimalistbaker': 'Minimalist Baker',
        'loveandlemons': 'Love and Lemons',
        'rainbowplantlife': 'Rainbow Plant Life',
        'feastingathome': 'Feasting at Home',
        'indianhealthyrecipes': 'Indian Healthy Recipes',
        'vegrecipesofindia': 'Veg Recipes of India',
        'hebbarskitchen': 'Hebbars Kitchen',
    }
    
    source_lower = source.lower().replace('-', '').replace('_', '')
    for key, value in source_mappings.items():
        if key in source_lower:
            return value
    
    # Capitalize and clean up
    if source:
        # Title case and limit length
        cleaned = source.replace('-', ' ').replace('_', ' ').title()
        return cleaned[:25] if len(cleaned) > 25 else cleaned
    
    return "Web Recipe"


async def find_grocery_stores(location: str, ingredient: str = None) -> Dict:
    """
    Find nearby grocery stores using Google Maps search
    """
    try:
        search_query = "grocery stores"
        if ingredient:
            search_query = f"grocery stores {ingredient}"
        
        params = {
            "api_key": SERPAPI_KEY,
            "engine": "google_maps",
            "q": search_query,
            "ll": None,  # Will use location string instead
            "type": "search",
        }
        
        # If location looks like coordinates, use ll parameter
        if "," in location and all(part.replace(".", "").replace("-", "").isdigit() for part in location.split(",")):
            params["ll"] = f"@{location},15z"
        else:
            params["q"] = f"{search_query} near {location}"
        
        params = {k: v for k, v in params.items() if v is not None}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(SERPAPI_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
        
        stores = []
        local_results = data.get("local_results", [])
        
        for store in local_results[:10]:
            store_name = store.get("title", "")
            store_address = store.get("address", "")
            gps_coords = store.get("gps_coordinates", {})
            
            # Generate Google Maps URL for directions
            google_maps_url = None
            if gps_coords and gps_coords.get("latitude") and gps_coords.get("longitude"):
                # Use coordinates for precise location
                lat = gps_coords.get("latitude")
                lng = gps_coords.get("longitude")
                google_maps_url = f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&destination_place_id={store.get('place_id', '')}"
            elif store_name and store_address:
                # Fallback to name + address search
                from urllib.parse import quote
                search_query = f"{store_name}, {store_address}"
                google_maps_url = f"https://www.google.com/maps/search/?api=1&query={quote(search_query)}"
            
            stores.append({
                "name": store_name,
                "address": store_address,
                "rating": store.get("rating", "N/A"),
                "reviews": store.get("reviews", 0),
                "type": store.get("type", "Grocery Store"),
                "hours": store.get("hours", ""),
                "phone": store.get("phone", ""),
                "website": store.get("website", ""),
                "directions_link": store.get("directions", ""),
                "google_maps_url": google_maps_url,
                "thumbnail": store.get("thumbnail", ""),
                "gps_coordinates": gps_coords,
                "price_level": store.get("price", ""),
                "open_now": "Open" in store.get("hours", "") if store.get("hours") else None
            })
        
        return {
            "success": True,
            "location": location,
            "query": search_query,
            "stores": stores,
            "total_found": len(stores)
        }
        
    except Exception as e:
        logging.error(f"SerpAPI grocery store search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "stores": []
        }


async def check_ingredient_prices(ingredient: str, location: str = "USA") -> Dict:
    """
    Search for ingredient prices and deals using Google Shopping
    Automatically detects country and displays prices in local currency
    """
    try:
        search_query = f"{ingredient} grocery price"
        
        # Map common locations to their Google location codes and currencies
        location_mapping = {
            # India
            'mumbai': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Mumbai, Maharashtra, India'},
            'bandra': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Mumbai, Maharashtra, India'},
            'delhi': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Delhi, India'},
            'bangalore': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Bangalore, Karnataka, India'},
            'bengaluru': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Bangalore, Karnataka, India'},
            'chennai': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Chennai, Tamil Nadu, India'},
            'kolkata': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Kolkata, West Bengal, India'},
            'hyderabad': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Hyderabad, Telangana, India'},
            'pune': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Pune, Maharashtra, India'},
            'india': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'India'},
            # UK
            'london': {'gl': 'uk', 'hl': 'en', 'currency': 'GBP', 'location': 'London, United Kingdom'},
            'manchester': {'gl': 'uk', 'hl': 'en', 'currency': 'GBP', 'location': 'Manchester, United Kingdom'},
            'uk': {'gl': 'uk', 'hl': 'en', 'currency': 'GBP', 'location': 'United Kingdom'},
            'united kingdom': {'gl': 'uk', 'hl': 'en', 'currency': 'GBP', 'location': 'United Kingdom'},
            # Europe
            'paris': {'gl': 'fr', 'hl': 'fr', 'currency': 'EUR', 'location': 'Paris, France'},
            'berlin': {'gl': 'de', 'hl': 'de', 'currency': 'EUR', 'location': 'Berlin, Germany'},
            'france': {'gl': 'fr', 'hl': 'fr', 'currency': 'EUR', 'location': 'France'},
            'germany': {'gl': 'de', 'hl': 'de', 'currency': 'EUR', 'location': 'Germany'},
            # Canada
            'toronto': {'gl': 'ca', 'hl': 'en', 'currency': 'CAD', 'location': 'Toronto, Ontario, Canada'},
            'vancouver': {'gl': 'ca', 'hl': 'en', 'currency': 'CAD', 'location': 'Vancouver, BC, Canada'},
            'canada': {'gl': 'ca', 'hl': 'en', 'currency': 'CAD', 'location': 'Canada'},
            # Australia
            'sydney': {'gl': 'au', 'hl': 'en', 'currency': 'AUD', 'location': 'Sydney, NSW, Australia'},
            'melbourne': {'gl': 'au', 'hl': 'en', 'currency': 'AUD', 'location': 'Melbourne, VIC, Australia'},
            'australia': {'gl': 'au', 'hl': 'en', 'currency': 'AUD', 'location': 'Australia'},
            # USA (default)
            'usa': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'United States'},
            'us': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'United States'},
            'united states': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'United States'},
            'new york': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'New York, NY, United States'},
            'los angeles': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'Los Angeles, CA, United States'},
            'austin': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'Austin, TX, United States'},
            'chicago': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'Chicago, IL, United States'},
            'san francisco': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'San Francisco, CA, United States'},
        }
        
        # Find matching location (case-insensitive)
        location_lower = location.lower().strip()
        location_config = None
        
        for key, config in location_mapping.items():
            if key in location_lower or location_lower in key:
                location_config = config
                break
        
        # Default to US if no match
        if not location_config:
            location_config = {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': location}
        
        params = {
            "api_key": SERPAPI_KEY,
            "engine": "google_shopping",
            "q": search_query,
            "location": location_config['location'],
            "gl": location_config['gl'],
            "hl": location_config['hl'],
            "num": 15
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(SERPAPI_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
        
        prices = []
        shopping_results = data.get("shopping_results", [])
        
        for item in shopping_results[:15]:
            price_info = {
                "title": item.get("title", ""),
                "price": item.get("price", "N/A"),
                "extracted_price": item.get("extracted_price", 0),
                "source": item.get("source", ""),
                "link": item.get("link", ""),
                "thumbnail": item.get("thumbnail", ""),
                "rating": item.get("rating", None),
                "reviews": item.get("reviews", 0),
                "delivery": item.get("delivery", ""),
                "store_rating": item.get("store_rating", None),
                "second_hand": item.get("second_hand_condition", None),
            }
            prices.append(price_info)
        
        # Calculate price stats
        valid_prices = [p["extracted_price"] for p in prices if p["extracted_price"] and p["extracted_price"] > 0]
        price_stats = {}
        if valid_prices:
            price_stats = {
                "min_price": min(valid_prices),
                "max_price": max(valid_prices),
                "avg_price": round(sum(valid_prices) / len(valid_prices), 2),
                "price_count": len(valid_prices),
                "currency": location_config['currency']
            }
        
        # Also search for deals/coupons
        deals = []
        if "inline_shopping_results" in data:
            for deal in data["inline_shopping_results"][:5]:
                deals.append({
                    "title": deal.get("title", ""),
                    "price": deal.get("price", ""),
                    "source": deal.get("source", ""),
                    "link": deal.get("link", "")
                })
        
        return {
            "success": True,
            "ingredient": ingredient,
            "location": location,
            "detected_location": location_config['location'],
            "currency": location_config['currency'],
            "country_code": location_config['gl'].upper(),
            "prices": prices,
            "price_stats": price_stats,
            "deals": deals,
            "total_found": len(prices)
        }
        
    except Exception as e:
        logging.error(f"SerpAPI price check error: {e}")
        return {
            "success": False,
            "error": str(e),
            "prices": []
        }


# Supported store filters for Google Shopping
SUPPORTED_STORES = {
    'amazon': {'name': 'Amazon', 'domain': 'amazon.com'},
    'walmart': {'name': 'Walmart', 'domain': 'walmart.com'},
    'target': {'name': 'Target', 'domain': 'target.com'},
    'instacart': {'name': 'Instacart', 'domain': 'instacart.com'},
    'kroger': {'name': 'Kroger', 'domain': 'kroger.com'},
    'wholefoods': {'name': 'Whole Foods', 'domain': 'wholefoodsmarket.com'},
    'costco': {'name': 'Costco', 'domain': 'costco.com'},
    'safeway': {'name': 'Safeway', 'domain': 'safeway.com'},
    'trader_joes': {'name': "Trader Joe's", 'domain': 'traderjoes.com'},
}


async def check_ingredient_price_with_store(ingredient: str, location: str = "USA", store_filter: str = None) -> Dict:
    """
    Search for ingredient prices with optional store filtering.
    Use store_filter to limit results to specific stores (amazon, walmart, target, etc.)
    """
    try:
        # Build search query
        search_query = f"{ingredient} grocery"
        
        # Add store filter if specified
        if store_filter and store_filter.lower() in SUPPORTED_STORES:
            store_info = SUPPORTED_STORES[store_filter.lower()]
            search_query = f"{ingredient} site:{store_info['domain']}"
        
        # Get location config
        location_mapping = {
            'usa': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'United States'},
            'us': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'United States'},
            'india': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'India'},
            'uk': {'gl': 'uk', 'hl': 'en', 'currency': 'GBP', 'location': 'United Kingdom'},
            'canada': {'gl': 'ca', 'hl': 'en', 'currency': 'CAD', 'location': 'Canada'},
            'australia': {'gl': 'au', 'hl': 'en', 'currency': 'AUD', 'location': 'Australia'},
        }
        
        location_lower = location.lower().strip()
        location_config = location_mapping.get(location_lower, {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': location})
        
        params = {
            "api_key": SERPAPI_KEY,
            "engine": "google_shopping",
            "q": search_query,
            "location": location_config['location'],
            "gl": location_config['gl'],
            "hl": location_config['hl'],
            "num": 10
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(SERPAPI_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
        
        prices = []
        shopping_results = data.get("shopping_results", [])
        
        for item in shopping_results[:10]:
            source = item.get("source", "").lower()
            
            # If store filter is active, only include matching stores
            if store_filter:
                store_info = SUPPORTED_STORES.get(store_filter.lower())
                if store_info and store_info['domain'].split('.')[0] not in source:
                    continue
            
            prices.append({
                "title": item.get("title", ""),
                "price": item.get("price", "N/A"),
                "extracted_price": item.get("extracted_price", 0),
                "source": item.get("source", ""),
                "link": item.get("link", ""),
                "thumbnail": item.get("thumbnail", ""),
                "rating": item.get("rating", None),
                "reviews": item.get("reviews", 0),
                "delivery": item.get("delivery", ""),
            })
        
        # Find cheapest option
        valid_prices = [p for p in prices if p["extracted_price"] and p["extracted_price"] > 0]
        cheapest = min(valid_prices, key=lambda x: x["extracted_price"]) if valid_prices else None
        
        return {
            "success": True,
            "ingredient": ingredient,
            "store_filter": store_filter,
            "currency": location_config['currency'],
            "prices": prices,
            "cheapest": cheapest,
            "total_found": len(prices)
        }
        
    except Exception as e:
        logging.error(f"Store-specific price check error: {e}")
        return {"success": False, "error": str(e), "prices": []}


async def batch_ingredient_prices(ingredients: List[str], location: str = "USA") -> Dict:
    """
    Check prices for multiple ingredients in batch.
    Returns price comparison for each ingredient.
    """
    import asyncio
    
    results = {}
    total_min = 0
    total_max = 0
    currency = "USD"
    
    # Process in batches to avoid rate limiting
    batch_size = 3
    for i in range(0, len(ingredients), batch_size):
        batch = ingredients[i:i + batch_size]
        
        tasks = [check_ingredient_prices(ing, location) for ing in batch]
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for j, result in enumerate(batch_results):
            ingredient = batch[j]
            if isinstance(result, Exception):
                results[ingredient] = {"success": False, "error": str(result)}
            elif result.get("success"):
                results[ingredient] = {
                    "success": True,
                    "cheapest": result.get("prices", [{}])[0] if result.get("prices") else None,
                    "price_stats": result.get("price_stats", {}),
                    "prices": result.get("prices", [])[:3]  # Top 3 options
                }
                if result.get("price_stats", {}).get("min_price"):
                    total_min += result["price_stats"]["min_price"]
                    total_max += result["price_stats"].get("max_price", 0)
                    currency = result.get("currency", "USD")
            else:
                results[ingredient] = {"success": False, "error": result.get("error")}
        
        # Small delay between batches
        if i + batch_size < len(ingredients):
            await asyncio.sleep(0.5)
    
    return {
        "success": True,
        "location": location,
        "currency": currency,
        "ingredients": results,
        "estimated_total": {
            "min": round(total_min, 2),
            "max": round(total_max, 2),
            "currency": currency
        },
        "total_ingredients": len(ingredients)
    }


async def build_shopping_cart(recipes: List[Dict], location: str = "USA") -> Dict:
    """
    Build an aggregated shopping cart from multiple recipes.
    Combines duplicate ingredients and provides price estimates.
    """
    # Aggregate all ingredients
    all_ingredients = {}
    
    for recipe in recipes:
        recipe_name = recipe.get("name", "Unknown Recipe")
        ingredients = recipe.get("ingredients", [])
        
        for ing in ingredients:
            # Normalize ingredient name
            ing_name = ing.lower().strip() if isinstance(ing, str) else ing.get("item", "").lower().strip()
            
            if not ing_name:
                continue
            
            # Remove common quantity words for grouping
            base_name = ing_name
            for word in ["cup", "cups", "tbsp", "tsp", "oz", "lb", "lbs", "g", "kg", "ml", "large", "medium", "small", "clove", "cloves", "piece", "pieces"]:
                base_name = base_name.replace(word, "").strip()
            
            # Clean up numbers
            import re
            base_name = re.sub(r'^\d+[\d\/\s]*', '', base_name).strip()
            
            if base_name:
                if base_name not in all_ingredients:
                    all_ingredients[base_name] = {
                        "name": ing_name,
                        "recipes": [],
                        "count": 0
                    }
                all_ingredients[base_name]["recipes"].append(recipe_name)
                all_ingredients[base_name]["count"] += 1
    
    # Get prices for unique ingredients
    unique_ingredients = list(all_ingredients.keys())[:15]  # Limit to avoid too many API calls
    
    price_results = await batch_ingredient_prices(unique_ingredients, location)
    
    # Combine data
    cart_items = []
    for base_name, info in all_ingredients.items():
        item_data = {
            "ingredient": info["name"],
            "used_in": info["recipes"],
            "usage_count": info["count"],
        }
        
        # Add price info if available
        if base_name in price_results.get("ingredients", {}):
            price_info = price_results["ingredients"][base_name]
            if price_info.get("success") and price_info.get("cheapest"):
                item_data["cheapest_price"] = price_info["cheapest"].get("price", "N/A")
                item_data["cheapest_source"] = price_info["cheapest"].get("source", "")
                item_data["buy_link"] = price_info["cheapest"].get("link", "")
        
        cart_items.append(item_data)
    
    return {
        "success": True,
        "location": location,
        "currency": price_results.get("currency", "USD"),
        "cart_items": cart_items,
        "estimated_total": price_results.get("estimated_total", {}),
        "total_items": len(cart_items),
        "recipes_included": len(recipes)
    }


async def search_food_images(dish_name: str, cuisine: str = '', limit: int = 5) -> Dict:
    """
    Search for food/dish images using Google Images via SerpAPI.
    Returns high-quality, relevant food photography.
    Uses rate limiting to avoid 429 errors.
    """
    try:
        # Extract the actual dish name from creative titles
        # e.g., "Tranquil Tofu Palak" -> "Tofu Palak"
        # e.g., "Sunny Paneer Tikka Masala" -> "Paneer Tikka Masala"
        actual_dish = extract_actual_dish_name(dish_name)
        
        # Identify main protein/ingredient for better image matching
        proteins = ['shrimp', 'chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'lamb', 
                   'tofu', 'paneer', 'prawns', 'lobster', 'crab', 'duck', 'turkey', 'scallop',
                   'mushroom', 'vegetable', 'egg', 'pasta', 'rice', 'noodle']
        main_protein = None
        for protein in proteins:
            if protein.lower() in actual_dish.lower():
                main_protein = protein
                break
        
        # Words that might cause wrong image matches (cooking styles that have their own imagery)
        confusing_terms = ['revuelto', 'scramble', 'stir-fry', 'casserole', 'stew', 'soup', 'curry']
        has_confusing_term = any(term in actual_dish.lower() for term in confusing_terms)
        
        # Indian/Asian dishes where the dish type matters more than the protein
        dish_type_priority = ['congee', 'porridge', 'poha', 'biryani', 'pulao', 'pilaf', 'fried rice', 'noodles', 
                             'pasta', 'risotto', 'paella', 'curry', 'korma', 'tikka masala',
                             'dosa', 'idli', 'uttapam', 'upma', 'khichdi', 'dal', 'sambar']
        main_dish_type = None
        for dish_type in dish_type_priority:
            if dish_type.lower() in actual_dish.lower():
                main_dish_type = dish_type
                break
        
        # Build search query optimized for food images
        if main_dish_type:
            # Prioritize the dish type (e.g., "Prawn Poha" -> search for "poha prawn")
            search_query = f"{main_dish_type} {main_protein or ''} dish plated"
        elif main_protein and has_confusing_term:
            # When there's a confusing cooking term, focus on the protein
            search_query = f"{main_protein} dish plated"
        elif main_protein:
            # Put protein first for better image matching
            search_query = f"{main_protein} {actual_dish} dish"
        else:
            search_query = f"{actual_dish} food dish"
            
        if cuisine:
            search_query = f"{search_query} {cuisine}"
        
        # Add quality modifiers
        search_query += " recipe photo"
        
        logging.info(f"Image search: '{dish_name}' -> '{search_query}'")
        
        params = {
            "api_key": SERPAPI_KEY,
            "engine": "google_images",
            "q": search_query,
            "num": limit * 2,  # Get extra for filtering
            "safe": "active",
            "ijn": 0,  # First page
            "tbs": "isz:m,itp:photo",  # Medium size, photo type only
        }
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Use rate-limited request to avoid 429 errors
            response = await _rate_limited_request(client, SERPAPI_BASE_URL, params)
            response.raise_for_status()
            data = response.json()
        
        images = []
        images_results = data.get("images_results", [])
        
        for img in images_results[:limit * 2]:
            # Filter out low quality or irrelevant images
            width = img.get("original_width", 0)
            height = img.get("original_height", 0)
            
            # Skip small images (less than 300x300)
            if width < 300 or height < 300:
                continue
            
            # Skip images from certain domains that may have watermarks
            source = img.get("source", "").lower()
            skip_sources = ["shutterstock", "istockphoto", "gettyimages", "dreamstime", "123rf"]
            if any(skip in source for skip in skip_sources):
                continue
            
            image_data = {
                "url": img.get("original", img.get("thumbnail", "")),
                "thumbnail": img.get("thumbnail", ""),
                "title": img.get("title", ""),
                "source": img.get("source", ""),
                "source_url": img.get("link", ""),
                "width": width,
                "height": height,
            }
            
            # Prefer food-related sources
            food_sources = ["allrecipes", "foodnetwork", "epicurious", "seriouseats", "bonappetit", 
                          "delish", "tasty", "simplyrecipes", "cookinglight", "yummly", "food52"]
            is_food_source = any(fs in source for fs in food_sources)
            
            if is_food_source:
                images.insert(0, image_data)  # Priority placement
            else:
                images.append(image_data)
            
            if len(images) >= limit:
                break
        
        return {
            "success": True,
            "dish_name": dish_name,
            "cuisine": cuisine,
            "images": images[:limit],
            "total_found": len(images)
        }
        
    except Exception as e:
        logging.error(f"SerpAPI image search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "images": []
        }


async def search_recipe_videos(recipe_name: str, limit: int = 5) -> Dict:
    """
    Search for cooking tutorial videos on YouTube
    """
    try:
        search_query = f"{recipe_name} recipe cooking tutorial"
        
        params = {
            "api_key": SERPAPI_KEY,
            "engine": "youtube",
            "search_query": search_query,
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(SERPAPI_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
        
        videos = []
        video_results = data.get("video_results", [])
        
        for video in video_results[:limit]:
            videos.append({
                "title": video.get("title", ""),
                "link": video.get("link", ""),
                "channel": video.get("channel", {}).get("name", ""),
                "channel_link": video.get("channel", {}).get("link", ""),
                "duration": video.get("length", {}).get("text", ""),
                "views": video.get("views", 0),
                "published": video.get("published_date", ""),
                "thumbnail": video.get("thumbnail", {}).get("static", ""),
                "description": video.get("description", "")
            })
        
        return {
            "success": True,
            "query": recipe_name,
            "videos": videos,
            "total_found": len(videos)
        }
        
    except Exception as e:
        logging.error(f"SerpAPI video search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "videos": []
        }
