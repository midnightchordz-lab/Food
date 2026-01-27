import os
from typing import Optional, List
import hashlib

# Curated high-quality food images from Unsplash (royalty-free)
FOOD_IMAGES = {
    # Indian
    'butter chicken': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800',
    'palak paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
    'chicken biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
    'biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
    'dal tadka': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800',
    'chole bhature': 'https://images.unsplash.com/photo-1626132647523-66c5e4c6c3f0?w=800',
    
    # Chinese
    'kung pao chicken': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800',
    'mapo tofu': 'https://images.unsplash.com/photo-1582452919408-80d02cb4cf45?w=800',
    'dim sum': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
    'dumplings': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
    'sweet and sour pork': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800',
    'fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    
    # Italian
    'spaghetti carbonara': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
    'carbonara': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
    'osso buco': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'margherita pizza': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
    'pizza': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
    'risotto': 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800',
    'tiramisu': 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
    
    # Mexican
    'tacos': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    'tacos al pastor': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800',
    'mole': 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800',
    'guacamole': 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=800',
    'enchiladas': 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800',
    'pozole': 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=800',
    
    # Japanese
    'ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
    'tonkotsu ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
    'chicken teriyaki': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    'teriyaki': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    'sushi': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
    'sushi rolls': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
    'katsu curry': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800',
    'miso soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    
    # Thai
    'pad thai': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
    'green curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
    'tom yum': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
    'tom yum soup': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
    'massaman curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
    'mango sticky rice': 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=800',
    
    # Mediterranean
    'moussaka': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'greek moussaka': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'falafel': 'https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?w=800',
    'shakshuka': 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=800',
    'hummus': 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800',
    'lamb kebabs': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'kebabs': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    
    # Korean
    'bibimbap': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800',
    'bulgogi': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
    'kimchi jjigae': 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800',
    'japchae': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
    'korean fried chicken': 'https://images.unsplash.com/photo-1575932444877-5106bee2a599?w=800',
    
    # French
    'coq au vin': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    'ratatouille': 'https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=800',
    'creme brulee': 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=800',
    'crème brûlée': 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=800',
    'french onion soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    'croissants': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
}

# Category fallbacks for when specific dish isn't found
CUISINE_FALLBACKS = {
    'indian': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
    'chinese': 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800',
    'italian': 'https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=800',
    'mexican': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800',
    'japanese': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
    'thai': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
    'mediterranean': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'korean': 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800',
    'french': 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800',
}

# Generic food images for complete fallback
GENERIC_FOOD_IMAGES = [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
]

def get_food_image(recipe_name: str, cuisine: str = None) -> str:
    """
    Get a high-quality food image URL for a recipe.
    Uses curated Unsplash images for reliable, watermark-free results.
    """
    # Normalize recipe name for lookup
    name_lower = recipe_name.lower().strip()
    
    # Try exact match first
    if name_lower in FOOD_IMAGES:
        return FOOD_IMAGES[name_lower]
    
    # Try partial match
    for key, url in FOOD_IMAGES.items():
        if key in name_lower or name_lower in key:
            return url
    
    # Try matching individual words
    words = name_lower.split()
    for word in words:
        if len(word) > 3:  # Skip short words
            for key, url in FOOD_IMAGES.items():
                if word in key:
                    return url
    
    # Try cuisine fallback
    if cuisine:
        cuisine_lower = cuisine.lower()
        if cuisine_lower in CUISINE_FALLBACKS:
            return CUISINE_FALLBACKS[cuisine_lower]
    
    # Use a consistent generic fallback based on recipe name hash
    hash_val = int(hashlib.md5(name_lower.encode()).hexdigest(), 16)
    return GENERIC_FOOD_IMAGES[hash_val % len(GENERIC_FOOD_IMAGES)]

def get_cuisine_specific_image(recipe_name: str, cuisine: str) -> str:
    """
    Fetch cuisine-specific food image.
    """
    return get_food_image(recipe_name, cuisine)

async def get_food_images_batch(recipe_names: List[str], cuisine: str = None) -> dict:
    """
    Fetch multiple food images at once.
    Returns a dict mapping recipe names to image URLs.
    """
    return {name: get_food_image(name, cuisine) for name in recipe_names}
