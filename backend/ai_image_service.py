"""
AI-Powered Recipe Image Generation Service
Generates accurate, dish-specific images using OpenAI's gpt-image-1
Converts to WebP format for 25-34% smaller file sizes
"""

import os
import base64
import hashlib
import asyncio
import io
from typing import Optional, Dict, List
from datetime import datetime, timezone
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

# WebP quality setting (80 provides good balance of quality and size)
WEBP_QUALITY = 80

# MongoDB connection (import from server)
from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# Collection for caching generated images
recipe_images_collection = db['recipe_images']


def convert_to_webp(image_bytes: bytes, quality: int = WEBP_QUALITY) -> tuple[bytes, str]:
    """
    Convert image bytes (PNG/JPEG) to WebP format.
    Returns tuple of (webp_bytes, mime_type).
    WebP is 25-34% smaller than JPEG at equivalent quality.
    """
    try:
        # Open the image from bytes
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary (WebP doesn't support all modes)
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            # Keep alpha channel for transparent images
            img = img.convert('RGBA')
        else:
            img = img.convert('RGB')
        
        # Save as WebP
        output = io.BytesIO()
        img.save(output, format='WEBP', quality=quality, method=6)  # method=6 is slowest but best compression
        output.seek(0)
        
        return output.getvalue(), 'image/webp'
    except Exception as e:
        print(f"WebP conversion failed, using original: {e}")
        return image_bytes, 'image/png'


def get_visual_guidance(recipe_name: str, cuisine: str = '') -> str:
    """Get specific visual guidance for common dishes to ensure accuracy"""
    
    recipe_lower = recipe_name.lower()
    
    visual_guides = {
        # Japanese dishes
        'tempura': """
- Light, crispy golden batter coating on shrimp and vegetables
- Individual pieces arranged on paper or traditional plate
- Small bowl of tentsuyu dipping sauce
- Grated daikon radish visible
- Visible airy, lacy batter texture
- NOT sushi, NOT regular fried food""",

        'yakitori': """
- Chicken pieces skewered on wooden sticks/bamboo skewers
- Charred grill marks visible on meat
- Glazed with tare sauce (shiny appearance)
- Multiple skewers arranged together
- Garnished with green onions or sesame
- NOT grilled chicken breast, NOT kebabs""",

        'sushi': """
- Individual sushi pieces (nigiri) or cut rolls (maki)
- Visible rice and fresh fish/seafood
- Nori seaweed wrapper on rolls
- Arranged on wooden board or ceramic plate
- Wasabi and pickled ginger on the side
- NOT sashimi alone, NOT poke bowl""",

        'ramen': """
- Deep bowl of rich broth with noodles visible
- Toppings: soft-boiled egg, chashu pork, nori, green onions
- Steam rising from bowl
- Curly wheat noodles in soup
- NOT pho, NOT udon, NOT other noodle soups""",

        # Indian dishes
        'biryani': """
- Layered rice with visible saffron yellow and white grains
- Whole spices visible (cardamom, bay leaves, cinnamon)
- Fried onions (birista) garnish on top
- Fresh cilantro and mint garnish
- Served in traditional handi or plate
- NOT curry with rice on side, NOT pulao, NOT fried rice""",

        'pulao': """
- One-pot rice dish with vegetables/meat mixed throughout
- Light, fluffy rice grains
- Mild coloring from spices
- Vegetables or meat evenly distributed
- NOT biryani (no layers), NOT fried rice""",

        'dal': """
- Thick lentil curry/soup in bowl
- Tadka (tempering) of spices visible on top
- Golden/yellow color for dal tadka
- Served with rice or roti on side
- NOT sambar, NOT rasam""",

        'paneer tikka': """
- Cubed paneer cheese with char marks
- Skewered or arranged on plate
- Bell peppers and onions alongside
- Red/orange tandoori marinade color
- NOT palak paneer, NOT paneer butter masala""",

        # Thai dishes
        'pad thai': """
- Wide rice noodles stir-fried (NOT wheat noodles)
- Scrambled egg pieces mixed in
- Crushed peanuts sprinkled on top
- Bean sprouts and green onions
- Lime wedge on the side
- Orange-brown color from tamarind sauce
- NOT lo mein, NOT chow mein, NOT pho""",

        'tom yum': """
- Clear or creamy red soup with visible ingredients
- Shrimp and mushrooms floating
- Lemongrass stalks visible
- Kaffir lime leaves
- Red chili oil on surface
- NOT tom kha, NOT other Asian soups""",

        'green curry': """
- Creamy green coconut curry
- Chicken/tofu and vegetables in sauce
- Thai basil leaves
- Green chili visible
- Served with jasmine rice
- NOT yellow curry, NOT red curry""",

        # Mexican dishes
        'tacos': """
- Corn or flour tortillas folded with filling visible
- Multiple tacos on plate (2-3)
- Toppings: cilantro, onion, lime, salsa
- Open-faced presentation showing filling
- NOT burritos (wrapped), NOT quesadillas, NOT nachos""",

        'burrito': """
- Large flour tortilla wrapped around filling
- Completely enclosed cylinder shape
- May be cut in half showing filling cross-section
- NOT tacos, NOT enchiladas, NOT wrap""",

        'enchiladas': """
- Rolled tortillas covered in red or green sauce
- Melted cheese on top
- Arranged in baking dish or plate
- Garnished with sour cream, cilantro
- NOT burritos, NOT tacos, NOT chimichangas""",

        # Italian dishes
        'carbonara': """
- Long pasta (spaghetti/fettuccine) with creamy sauce
- Crispy guanciale/pancetta pieces
- Cracked black pepper on top
- Creamy egg-based sauce (NOT cream sauce)
- Parmesan cheese
- NOT alfredo, NOT cacio e pepe, NOT bolognese""",

        'lasagna': """
- Layered pasta dish in baking pan
- Visible layers of pasta, meat sauce, cheese
- Golden-brown cheese top
- Portion cut showing layers
- NOT moussaka, NOT cannelloni""",

        'risotto': """
- Creamy rice dish with visible arborio grains
- Loose, flowing consistency
- Parmesan and butter visible
- Garnished with herbs or main ingredient
- NOT pilaf, NOT fried rice, NOT paella""",

        # Korean dishes
        'bibimbap': """
- Rice bowl with arranged colorful toppings
- Vegetables in sections around bowl
- Fried egg on top
- Gochujang sauce dollop
- NOT fried rice, NOT poke bowl""",

        'bulgogi': """
- Thinly sliced marinated beef
- Caramelized, slightly charred edges
- Sesame seeds and green onions
- Served with lettuce wraps
- NOT galbi, NOT other Korean BBQ""",

        # Chinese dishes
        'kung pao chicken': """
- Diced chicken with peanuts
- Dried red chilies visible
- Glossy brown sauce
- Scallions/green onions
- NOT general tso, NOT orange chicken""",

        'dim sum': """
- Assorted small dumplings/buns in steamer baskets
- Har gow, siu mai, char siu bao visible
- Bamboo steamers stacked
- NOT gyoza alone, NOT wontons alone""",
    }
    
    # Check for matches
    for dish, guidance in visual_guides.items():
        if dish in recipe_lower:
            return guidance
    
    # Return generic guidance if no specific match
    return f"""
- Show the finished {recipe_name} as it would be served in a restaurant
- Highlight unique visual characteristics of this dish
- Use authentic {cuisine} presentation style
- Make it immediately recognizable as {recipe_name}
- NOT similar dishes from the same cuisine"""


def generate_image_prompt(recipe_name: str, cuisine: str = '', ingredients: List[str] = None) -> str:
    """Generate a highly specific image prompt for the recipe"""
    
    ingredients_str = ', '.join(ingredients[:5]) if ingredients else 'typical ingredients'
    visual_guidance = get_visual_guidance(recipe_name, cuisine)
    
    prompt = f"""Create a high-quality, photorealistic food photograph of {recipe_name}.

CRITICAL REQUIREMENTS:
1. This image MUST show EXACTLY {recipe_name} - not a similar or related dish
2. Professional food photography style with excellent lighting
3. 45-degree overhead angle (optimal for food photography)
4. Restaurant-quality plating and presentation
5. Sharp focus, appetizing appearance

DISH DETAILS:
- Recipe: {recipe_name}
- Cuisine: {cuisine if cuisine else 'International'}
- Key Ingredients: {ingredients_str}

VISUAL SPECIFICS FOR {recipe_name}:
{visual_guidance}

QUALITY STANDARDS:
- Natural, warm lighting
- Clean, neutral background
- No text, watermarks, or labels
- Accurate colors and textures
- Steam/freshness indicators if appropriate

Make this image immediately recognizable as {recipe_name} to anyone familiar with the dish."""

    return prompt


async def generate_recipe_image(recipe_name: str, cuisine: str = '', ingredients: List[str] = None) -> Optional[str]:
    """
    Generate an AI image for a recipe using OpenAI's gpt-image-1.
    Converts to WebP format for smaller file sizes (25-34% reduction).
    Returns tuple of (base64_string, mime_type).
    """
    try:
        from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            print("No EMERGENT_LLM_KEY found")
            return None, None
        
        # Generate the prompt
        prompt = generate_image_prompt(recipe_name, cuisine, ingredients)
        
        # Initialize image generator
        image_gen = OpenAIImageGeneration(api_key=api_key)
        
        # Generate the image
        images = await image_gen.generate_images(
            prompt=prompt,
            model="gpt-image-1",
            number_of_images=1
        )
        
        if images and len(images) > 0:
            # Convert to WebP for smaller file size
            webp_bytes, mime_type = convert_to_webp(images[0])
            
            # Log size reduction
            original_size = len(images[0])
            webp_size = len(webp_bytes)
            reduction = ((original_size - webp_size) / original_size) * 100
            print(f"Image optimized: {original_size/1024:.1f}KB -> {webp_size/1024:.1f}KB ({reduction:.1f}% smaller)")
            
            # Convert to base64
            image_base64 = base64.b64encode(webp_bytes).decode('utf-8')
            return image_base64, mime_type
        
        return None, None
        
    except Exception as e:
        print(f"Error generating image for {recipe_name}: {str(e)}")
        return None, None


async def get_or_generate_recipe_image(recipe_name: str, cuisine: str = '', ingredients: List[str] = None) -> Dict:
    """
    Get a cached image or generate a new one for the recipe.
    Returns dict with image_url (data URL) and metadata.
    """
    
    # Create a unique key for this recipe
    cache_key = hashlib.md5(f"{recipe_name.lower()}:{cuisine.lower()}".encode()).hexdigest()
    
    # Check cache first
    cached = await recipe_images_collection.find_one({"cache_key": cache_key})
    
    if cached and cached.get('image_base64'):
        return {
            "image_url": f"data:image/png;base64,{cached['image_base64']}",
            "source": "cached",
            "recipe_name": recipe_name,
            "generated_at": cached.get('created_at')
        }
    
    # Generate new image
    print(f"Generating new image for: {recipe_name}")
    image_base64 = await generate_recipe_image(recipe_name, cuisine, ingredients)
    
    if image_base64:
        # Cache the result
        await recipe_images_collection.update_one(
            {"cache_key": cache_key},
            {
                "$set": {
                    "cache_key": cache_key,
                    "recipe_name": recipe_name,
                    "cuisine": cuisine,
                    "image_base64": image_base64,
                    "created_at": datetime.now(timezone.utc),
                    "source": "ai_generated"
                }
            },
            upsert=True
        )
        
        return {
            "image_url": f"data:image/png;base64,{image_base64}",
            "source": "generated",
            "recipe_name": recipe_name,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    
    # Fallback to static image service if generation fails
    from image_service import get_food_image
    fallback_url = get_food_image(recipe_name, cuisine)
    
    return {
        "image_url": fallback_url,
        "source": "fallback_static",
        "recipe_name": recipe_name
    }


async def batch_generate_images(recipes: List[Dict], max_concurrent: int = 3) -> List[Dict]:
    """
    Generate images for multiple recipes with rate limiting.
    """
    results = []
    
    # Process in batches to avoid rate limiting
    for i in range(0, len(recipes), max_concurrent):
        batch = recipes[i:i + max_concurrent]
        
        tasks = [
            get_or_generate_recipe_image(
                r.get('name', r.get('title', '')),
                r.get('cuisine', ''),
                r.get('ingredients', [])
            )
            for r in batch
        ]
        
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for j, result in enumerate(batch_results):
            if isinstance(result, Exception):
                results.append({
                    "recipe_name": batch[j].get('name', batch[j].get('title', '')),
                    "error": str(result),
                    "source": "error"
                })
            else:
                results.append(result)
        
        # Rate limit delay between batches
        if i + max_concurrent < len(recipes):
            await asyncio.sleep(2)
    
    return results


async def clear_recipe_image_cache(recipe_name: str = None):
    """Clear cached images - all or for a specific recipe"""
    if recipe_name:
        cache_key = hashlib.md5(recipe_name.lower().encode()).hexdigest()
        await recipe_images_collection.delete_many({"cache_key": {"$regex": cache_key}})
    else:
        await recipe_images_collection.delete_many({})


# Export functions
__all__ = [
    'generate_recipe_image',
    'get_or_generate_recipe_image',
    'batch_generate_images',
    'clear_recipe_image_cache',
    'generate_image_prompt'
]
