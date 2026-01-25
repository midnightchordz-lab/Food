import os
from typing import Optional, List
import asyncio

async def get_food_images_batch(recipe_names: List[str]) -> dict:
    """
    Fetch multiple food images at once using the image_selector_tool.
    Returns a dict mapping recipe names to image URLs.
    """
    from image_selector_tool import image_selector_tool
    
    results = {}
    for recipe_name in recipe_names:
        try:
            # Extract key food terms from recipe name
            search_query = recipe_name.lower()
            # Remove common words
            remove_words = ['with', 'and', 'the', 'in', 'a', 'an', 'or', 'style', 'recipe']
            words = [w for w in search_query.split() if w not in remove_words]
            search_query = ' '.join(words[:3])  # Limit to 3 words
            
            # Use image_selector_tool to get food images
            images = image_selector_tool(search_query=search_query, image_count=1)
            
            if images and len(images) > 0:
                results[recipe_name] = images[0].get('image_url')
            else:
                # Fallback to a food placeholder
                results[recipe_name] = f"https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800"
                
        except Exception as e:
            print(f"Error fetching image for {recipe_name}: {e}")
            results[recipe_name] = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800"
    
    return results

def get_food_image(recipe_name: str) -> Optional[str]:
    """
    Fetch a single food image URL for a recipe.
    Returns the image URL or a placeholder.
    """
    try:
        from image_selector_tool import image_selector_tool
        
        # Clean up recipe name for search
        search_query = recipe_name.lower()
        remove_words = ['with', 'and', 'the', 'in', 'a', 'an', 'or', 'style', 'recipe']
        words = [w for w in search_query.split() if w not in remove_words]
        search_query = ' '.join(words[:3])
        
        # Get food images
        images = image_selector_tool(search_query=search_query, image_count=1)
        
        if images and len(images) > 0:
            return images[0].get('image_url')
        else:
            return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800"
            
    except Exception as e:
        print(f"Error fetching image for {recipe_name}: {e}")
        return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800"

def get_cuisine_specific_image(recipe_name: str, cuisine: str) -> Optional[str]:
    """
    Fetch cuisine-specific food image.
    """
    try:
        from image_selector_tool import image_selector_tool
        
        search_query = f"{cuisine} {recipe_name}"
        images = image_selector_tool(search_query=search_query, image_count=1)
        
        if images and len(images) > 0:
            return images[0].get('image_url')
        else:
            return get_food_image(recipe_name)
            
    except Exception as e:
        print(f"Error fetching cuisine image: {e}")
        return get_food_image(recipe_name)

