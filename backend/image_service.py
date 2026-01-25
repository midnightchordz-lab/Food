import requests
import os
from typing import Optional

def get_food_image(recipe_name: str, max_retries: int = 2) -> Optional[str]:
    """
    Fetch food image URL from Unsplash/Pexels based on recipe name.
    Returns the image URL or None if not found.
    """
    try:
        # Clean up recipe name for search
        search_query = recipe_name.lower()
        # Remove common words that don't help with image search
        remove_words = ['with', 'and', 'the', 'in', 'a', 'an']
        words = [w for w in search_query.split() if w not in remove_words]
        search_query = ' '.join(words[:4])  # Limit to 4 words
        
        # Add 'food' to make search more specific
        search_query = f"{search_query} food dish"
        
        # Try Unsplash first
        unsplash_url = "https://api.unsplash.com/search/photos"
        params = {
            'query': search_query,
            'per_page': 1,
            'client_id': os.environ.get('UNSPLASH_ACCESS_KEY', 'demo')
        }
        
        response = requests.get(unsplash_url, params=params, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('results') and len(data['results']) > 0:
                return data['results'][0]['urls']['regular']
        
        # Fallback: return a placeholder food image
        return f"https://source.unsplash.com/800x600/?{search_query.replace(' ', ',')}"
        
    except Exception as e:
        print(f"Error fetching image for {recipe_name}: {e}")
        # Return a generic food placeholder
        return "https://source.unsplash.com/800x600/?food,meal,dish"

def get_cuisine_specific_image(recipe_name: str, cuisine: str) -> Optional[str]:
    """
    Fetch cuisine-specific food image.
    """
    try:
        search_query = f"{cuisine} {recipe_name} cuisine food"
        return f"https://source.unsplash.com/800x600/?{search_query.replace(' ', ',')}"
    except Exception as e:
        print(f"Error fetching cuisine image: {e}")
        return get_food_image(recipe_name)
