"""
Import Recipe Routes - Import from URL, image, video, text
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime, timezone
import os
import uuid
import json
import logging

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

from .deps import db, User, get_current_user

router = APIRouter(prefix="/import", tags=["Import"])

# ============== MODELS ==============

class ImportURLRequest(BaseModel):
    url: str

class ImportImageRequest(BaseModel):
    image_data: str  # base64 encoded
    filename: str

class ImportVideoRequest(BaseModel):
    video_url: str

class ImportTextRequest(BaseModel):
    recipe_text: str

class ImportSaveRequest(BaseModel):
    recipe: Dict[str, Any]

# ============== PROMPTS ==============

IMPORT_RECIPE_PROMPT = """You are an expert chef and recipe converter. Convert the provided recipe content into a HIGHLY DETAILED, STANDARDIZED format that a complete beginner can follow.

CRITICAL REQUIREMENTS:
1. EVERY step must have SPECIFIC timing (e.g., "Cook for 3-4 minutes")
2. EVERY step must have EXACT temperatures (e.g., "375°F/190°C", "medium-high heat")
3. EVERY step must have VISUAL or SENSORY cues (e.g., "until golden brown", "when it starts sizzling")
4. ALL measurements must be precise (e.g., "2 cups", "1/4 teaspoon", not "some" or "a bit")
5. Include technique descriptions for beginners

OUTPUT FORMAT (JSON):
{
    "name": "Recipe Title",
    "description": "2-3 sentence description of the dish",
    "cuisine": "Italian/Mexican/Indian/etc",
    "difficulty": "Easy/Medium/Hard",
    "prepTime": "X minutes",
    "cookTime": "X minutes", 
    "totalTime": "X minutes",
    "servings": 4,
    "ingredients": [
        {
            "name": "2 cups all-purpose flour",
            "category": "pantry",
            "notes": "sifted for fluffier results"
        }
    ],
    "instructions": [
        {
            "stepNumber": 1,
            "instruction": "DETAILED step with exact timing, temperature, and technique",
            "time": "5 minutes",
            "visualCue": "What to look for to know this step is complete",
            "technique": "Beginner-friendly explanation"
        }
    ],
    "chefTips": ["Tip 1", "Tip 2", "Tip 3"],
    "nutritionPerServing": {
        "calories": 350,
        "protein": "15g",
        "carbs": "45g",
        "fat": "12g",
        "fiber": "3g"
    },
    "storage": "How to store leftovers and for how long",
    "drinkPairings": {
        "nonAlcoholic": ["Drink 1 with description"],
        "alcoholic": ["Wine/beer/cocktail with why it pairs well"]
    },
    "variations": ["Variation 1", "Variation 2"],
    "source": "Original source URL or 'User submitted'"
}

IMPORTANT: 
- Do NOT use generic phrases like "cook until done" or "season to taste"
- Each step should be detailed enough that someone who has never cooked can follow it"""


def get_import_system_prompt(source_type: str) -> str:
    """Generate system prompt based on import source type"""
    source_context = {
        "url": "The recipe was extracted from a website. Parse the recipe content and convert it.",
        "image": "The recipe was extracted from an image. OCR may have errors - use your knowledge to correct likely mistakes.",
        "video": "The recipe was extracted from a video transcript/description. Reconstruct the full recipe from the spoken instructions.",
        "text": "The recipe was provided as plain text by the user. It may be informal or incomplete - fill in reasonable details."
    }
    
    return f"""{IMPORT_RECIPE_PROMPT}

SOURCE CONTEXT: {source_context.get(source_type, source_context['text'])}

If the recipe is incomplete or missing information, use your culinary expertise to:
1. Add reasonable cook times and temperatures based on the dish type
2. Suggest standard portion sizes
3. Add visual cues for each step
4. Include storage and reheating instructions

ALWAYS output valid JSON. If you cannot parse a recipe, return an error JSON:
{{"error": "Unable to parse recipe", "reason": "explanation"}}"""

# ============== HELPER FUNCTIONS ==============

async def extract_recipe_from_url(url: str) -> str:
    """Fetch and extract recipe content from a URL"""
    import httpx
    import re
    
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            
            html_content = response.text
            
            # Remove script and style elements
            html_content = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
            html_content = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
            # Remove HTML tags but keep newlines
            html_content = re.sub(r'<br\s*/?>', '\n', html_content, flags=re.IGNORECASE)
            html_content = re.sub(r'</(p|div|h[1-6]|li|tr)>', '\n', html_content, flags=re.IGNORECASE)
            html_content = re.sub(r'<[^>]+>', ' ', html_content)
            # Clean up whitespace
            html_content = re.sub(r'\s+', ' ', html_content)
            html_content = re.sub(r'\n\s*\n', '\n\n', html_content)
            
            return html_content[:15000]
            
    except Exception as e:
        logging.error(f"Error fetching URL {url}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {str(e)}")


async def convert_to_standard_recipe(content: str, source_type: str, source_info: str = None) -> Dict:
    """Use AI to convert extracted content into standard recipe format"""
    llm_api_key = os.environ.get('EMERGENT_LLM_KEY')
    
    chat = LlmChat(
        api_key=llm_api_key,
        session_id=f"import-{uuid.uuid4().hex[:8]}",
        system_message=get_import_system_prompt(source_type)
    )
    # Use gpt-4o-mini for faster response (3-5x faster than gpt-4o)
    chat.with_model("openai", "gpt-4o-mini")
    
    # Truncate content to reduce processing time (keep first 8000 chars)
    truncated_content = content[:8000] if len(content) > 8000 else content
    
    user_prompt = f"""Convert this recipe to JSON format:

{truncated_content}

Output ONLY valid JSON."""

    response = await chat.send_message(UserMessage(text=user_prompt))
    
    try:
        json_match = response
        if "```json" in response:
            json_match = response.split("```json")[1].split("```")[0]
        elif "```" in response:
            json_match = response.split("```")[1].split("```")[0]
        
        recipe = json.loads(json_match.strip())
        
        recipe['importMethod'] = source_type
        recipe['originalSource'] = source_info or 'Unknown'
        recipe['importDate'] = datetime.now(timezone.utc).isoformat()
        
        return recipe
        
    except json.JSONDecodeError as e:
        logging.error(f"Failed to parse AI response as JSON: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse recipe. Please try again.")

# ============== ROUTES ==============

@router.post("/url")
async def import_from_url(request: ImportURLRequest, current_user: User = Depends(get_current_user)):
    """Import a recipe from a website URL"""
    try:
        logging.info(f"Importing recipe from URL: {request.url}")
        
        if not request.url.startswith(('http://', 'https://')):
            raise HTTPException(status_code=400, detail="Invalid URL format")
        
        content = await extract_recipe_from_url(request.url)
        
        if not content or len(content) < 100:
            raise HTTPException(status_code=400, detail="Could not extract recipe content from URL")
        
        recipe = await convert_to_standard_recipe(content, "url", request.url)
        
        return {"recipe": recipe, "source": request.url}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error importing from URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image")
async def import_from_image(request: ImportImageRequest, current_user: User = Depends(get_current_user)):
    """Import a recipe from an uploaded image using AI vision"""
    try:
        logging.info(f"Importing recipe from image: {request.filename}")
        
        llm_api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        # Simplified prompt for faster processing
        vision_chat = LlmChat(
            api_key=llm_api_key,
            session_id=f"import-vision-{uuid.uuid4().hex[:8]}",
            system_message="""You are a chef. Extract or create a recipe from this image as JSON.

JSON format:
{
    "name": "Recipe Title",
    "description": "Brief description",
    "cuisine": "Cuisine type",
    "difficulty": "Easy/Medium/Hard",
    "prepTime": "X minutes",
    "cookTime": "X minutes",
    "servings": 4,
    "ingredients": [{"name": "ingredient with amount", "category": "pantry/produce/protein"}],
    "instructions": [{"stepNumber": 1, "instruction": "Step description", "time": "X min"}],
    "chefTips": ["Tip 1"]
}

If showing a dish photo: identify it and create a recipe.
Output ONLY valid JSON."""
        )
        # Use gpt-4o-mini for vision - still capable but faster
        vision_chat.with_model("openai", "gpt-4o-mini")
        
        image_content = ImageContent(image_base64=request.image_data)
        
        extraction_prompt = "Extract or create a complete recipe from this image. Output JSON only."

Include ALL required fields. Output ONLY the JSON object, no markdown or explanation."""

        response = await vision_chat.send_message(
            UserMessage(text=extraction_prompt, file_contents=[image_content])
        )
        
        try:
            json_match = response
            if "```json" in response:
                json_match = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                json_match = response.split("```")[1].split("```")[0]
            
            recipe = json.loads(json_match.strip())
            
            recipe['importMethod'] = 'image'
            recipe['originalSource'] = f"Image: {request.filename}"
            recipe['importDate'] = datetime.now(timezone.utc).isoformat()
            
            return {"recipe": recipe, "source": f"Image: {request.filename}"}
            
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse vision response: {e}")
            raise HTTPException(status_code=500, detail="Failed to parse recipe from image. Please try again.")
        
    except Exception as e:
        logging.error(f"Error importing from image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/video")
async def import_from_video(request: ImportVideoRequest, current_user: User = Depends(get_current_user)):
    """Import a recipe from a video URL (YouTube, etc.)"""
    try:
        import httpx
        import re
        
        logging.info(f"Importing recipe from video: {request.video_url}")
        
        llm_api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        video_info = ""
        video_title = "Unknown"
        video_description = ""
        channel_name = ""
        
        youtube_patterns = ['youtube.com', 'youtu.be']
        is_youtube = any(p in request.video_url for p in youtube_patterns)
        
        if is_youtube:
            video_id = None
            if 'youtu.be/' in request.video_url:
                video_id = request.video_url.split('youtu.be/')[-1].split('?')[0]
            elif 'v=' in request.video_url:
                video_id = request.video_url.split('v=')[-1].split('&')[0]
            elif 'shorts/' in request.video_url:
                video_id = request.video_url.split('shorts/')[-1].split('?')[0]
            
            if video_id:
                video_url = f"https://www.youtube.com/watch?v={video_id}"
                
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        oembed_url = f"https://www.youtube.com/oembed?url={video_url}&format=json"
                        response = await client.get(oembed_url)
                        
                        if response.status_code == 200:
                            oembed_data = response.json()
                            video_title = oembed_data.get('title', 'Unknown')
                            channel_name = oembed_data.get('author_name', '')
                        
                except Exception as e:
                    logging.warning(f"oEmbed failed: {e}")
                
                try:
                    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                        response = await client.get(
                            video_url,
                            headers={
                                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
                                'Accept-Language': 'en-US,en;q=0.9',
                            }
                        )
                        html = response.text
                        
                        desc_patterns = [
                            r'"shortDescription":"((?:[^"\\]|\\.)*)"',
                            r'"description":\s*\{\s*"simpleText":\s*"((?:[^"\\]|\\.)*)"',
                        ]
                        
                        for pattern in desc_patterns:
                            desc_match = re.search(pattern, html, re.DOTALL)
                            if desc_match:
                                video_description = desc_match.group(1)
                                video_description = video_description.encode().decode('unicode_escape')
                                video_description = video_description.replace('\\n', '\n')
                                if len(video_description) > 50:
                                    break
                        
                except Exception as e:
                    logging.warning(f"Page scrape failed: {e}")
        
        video_info = f"""=== COOKING VIDEO INFORMATION ===

Video Title: {video_title}
Channel/Creator: {channel_name}
Video URL: {request.video_url}

Video Description:
{video_description[:8000] if video_description else 'No description available - use the video title to identify the recipe'}

=== END VIDEO INFO ===

Based on this YouTube cooking video, create a detailed recipe.
The VIDEO TITLE clearly indicates what dish is being made: "{video_title}"
Extract the recipe for this EXACT dish."""
        
        chat = LlmChat(
            api_key=llm_api_key,
            session_id=f"import-video-{uuid.uuid4().hex[:8]}",
            system_message=f"""{IMPORT_RECIPE_PROMPT}

SOURCE CONTEXT: You are extracting a recipe from a YouTube cooking video.

CRITICAL INSTRUCTIONS:
1. The VIDEO TITLE tells you EXACTLY what dish is being made - use this as the recipe name
2. If the description contains ingredients or steps, use them
3. If description is empty, create an authentic recipe for the dish in the title
4. Match the style of the channel if mentioned
5. Include detailed steps that would typically be shown in such a video

NEVER return an error or refuse. ALWAYS create a valid recipe JSON based on the title."""
        )
        chat.with_model("openai", "gpt-4o")
        
        prompt = f"""Create a detailed recipe based on this cooking video.

{video_info}

The recipe name should match the dish in the video title: "{video_title}"

Output ONLY the JSON object for this recipe."""

        response = await chat.send_message(UserMessage(text=prompt))
        
        try:
            json_match = response
            if "```json" in response:
                json_match = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                json_match = response.split("```")[1].split("```")[0]
            
            recipe = json.loads(json_match.strip())
            recipe['importMethod'] = 'video'
            recipe['originalSource'] = request.video_url
            recipe['importDate'] = datetime.now(timezone.utc).isoformat()
            recipe['videoTitle'] = video_title
            recipe['channelName'] = channel_name
            
            return {"recipe": recipe, "source": request.video_url, "videoTitle": video_title}
            
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse AI response: {e}")
            raise HTTPException(status_code=500, detail="Failed to parse recipe from video")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error importing from video: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/text")
async def import_from_text(request: ImportTextRequest, current_user: User = Depends(get_current_user)):
    """Import a recipe from plain text"""
    try:
        logging.info(f"Importing recipe from text ({len(request.recipe_text)} chars)")
        
        if len(request.recipe_text) < 20:
            raise HTTPException(status_code=400, detail="Recipe text is too short")
        
        recipe = await convert_to_standard_recipe(request.recipe_text, "text", "User submitted")
        
        return {"recipe": recipe, "source": "User submitted text"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error importing from text: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save")
async def save_imported_recipe(request: ImportSaveRequest, current_user: User = Depends(get_current_user)):
    """Save an imported recipe to the user's collection"""
    try:
        from image_service import get_food_image
        
        recipe_data = request.recipe
        
        recipe_id = str(uuid.uuid4())
        
        recipe_doc = {
            "id": recipe_id,
            "user_id": current_user.id,
            "title": recipe_data.get("name", "Untitled Recipe"),
            "description": recipe_data.get("description", ""),
            "cuisine_type": recipe_data.get("cuisine", "International"),
            "difficulty": recipe_data.get("difficulty", "Medium"),
            "prep_time": recipe_data.get("prepTime", ""),
            "cook_time": recipe_data.get("cookTime", ""),
            "total_time": recipe_data.get("totalTime", ""),
            "servings": recipe_data.get("servings", 4),
            "ingredients": recipe_data.get("ingredients", []),
            "instructions": recipe_data.get("instructions", []),
            "chef_tips": recipe_data.get("chefTips", []),
            "nutrition": recipe_data.get("nutritionPerServing", {}),
            "storage": recipe_data.get("storage", ""),
            "drink_pairings": recipe_data.get("drinkPairings", {}),
            "variations": recipe_data.get("variations", []),
            "import_method": recipe_data.get("importMethod", "unknown"),
            "original_source": recipe_data.get("originalSource", ""),
            "import_date": recipe_data.get("importDate", datetime.now(timezone.utc).isoformat()),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "image_url": get_food_image(recipe_data.get("name", "food"), recipe_data.get("cuisine", ""))
        }
        
        await db.imported_recipes.insert_one(recipe_doc)
        
        saved_entry = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "recipe_id": recipe_id,
            "saved_at": datetime.now(timezone.utc).isoformat()
        }
        await db.saved_recipes.insert_one(saved_entry)
        
        recipe_doc.pop('_id', None)
        
        return {"message": "Recipe saved successfully!", "recipe": recipe_doc}
        
    except Exception as e:
        logging.error(f"Error saving imported recipe: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent")
async def get_recent_imports(current_user: User = Depends(get_current_user)):
    """Get user's recently imported recipes"""
    try:
        recipes = await db.imported_recipes.find(
            {"user_id": current_user.id},
            {"_id": 0}
        ).sort("import_date", -1).limit(10).to_list(length=10)
        
        return {"recipes": recipes}
        
    except Exception as e:
        logging.error(f"Error fetching recent imports: {e}")
        return {"recipes": []}
