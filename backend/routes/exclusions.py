"""
Food Exclusion/Allergy Management Routes and Helpers
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime, timezone
import re
import logging

from .deps import db, User, get_current_user

router = APIRouter(prefix="/exclusions", tags=["Food Exclusions"])

# ============== MODELS ==============

class ExcludedIngredient(BaseModel):
    name: str
    category: str = "preference"
    severity: str = "preference"
    reason: Optional[str] = None

class UserExclusions(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    excluded_ingredients: List[ExcludedIngredient] = []
    excluded_ingredient_names: List[str] = []
    common_allergens: Dict[str, bool] = {
        "eggs": False, "milk": False, "peanuts": False, "tree_nuts": False,
        "soy": False, "wheat": False, "fish": False, "shellfish": False, "sesame": False
    }
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ExclusionCreate(BaseModel):
    excluded_ingredients: List[ExcludedIngredient]

class ExclusionUpdate(BaseModel):
    add_ingredients: Optional[List[ExcludedIngredient]] = []
    remove_ingredient_names: Optional[List[str]] = []

# ============== INGREDIENT ALIASES ==============

INGREDIENT_ALIASES = {
    'eggs': ['egg', 'eggs', 'egg white', 'egg yolk', 'mayonnaise', 'mayo', 'omelette', 'omelet', 'meringue', 'custard'],
    'milk': ['milk', 'dairy', 'cream', 'buttermilk', 'whey', 'casein', 'lactose'],
    'peanuts': ['peanut', 'peanuts', 'peanut butter', 'peanut oil', 'groundnut'],
    'tree_nuts': ['almond', 'almonds', 'walnut', 'walnuts', 'cashew', 'cashews', 'pecan', 'pistachios', 'hazelnut', 'macadamia', 'pine nut'],
    'shellfish': ['shrimp', 'shrimps', 'prawn', 'prawns', 'crab', 'lobster', 'crayfish', 'clam', 'mussel', 'oyster', 'scallop', 'langoustine'],
    'wheat': ['wheat', 'flour', 'bread flour', 'whole wheat', 'semolina', 'bulgur'],
    'soy': ['soy', 'soya', 'soy sauce', 'tofu', 'edamame', 'soybean', 'miso', 'tempeh'],
    'gluten': ['wheat', 'barley', 'rye', 'flour', 'bread', 'pasta', 'couscous', 'seitan'],
    'dairy': ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'ghee', 'paneer', 'cottage cheese', 'ricotta', 'mozzarella', 'cheddar', 'parmesan'],
    'sesame': ['sesame', 'sesame seed', 'sesame oil', 'tahini', 'hummus'],
    'beef': ['beef', 'steak', 'ground beef', 'veal', 'brisket', 'sirloin', 'ribeye', 'tenderloin', 'filet', 'roast beef', 'corned beef', 'prime rib', 'kofta', 'keema', 'beef curry', 'hamburger', 'burger patty'],
    'pork': ['pork', 'bacon', 'ham', 'sausage', 'prosciutto', 'pancetta', 'pork belly', 'pork chop', 'pulled pork', 'carnitas', 'chorizo', 'salami', 'pepperoni', 'hot dog'],
    'chicken': ['chicken', 'poultry', 'chicken breast', 'chicken thigh', 'chicken wing', 'chicken drumstick', 'roast chicken', 'fried chicken', 'grilled chicken', 'chicken tikka', 'tandoori chicken', 'butter chicken', 'chicken curry', 'chicken biryani', 'chicken kebab', 'orange chicken', 'kung pao chicken', 'chicken soup', 'chicken broth', 'ground chicken'],
    'lamb': ['lamb', 'mutton', 'lamb chop', 'lamb shank', 'leg of lamb', 'lamb shoulder', 'ground lamb', 'lamb kebab', 'lamb kofta', 'lamb curry', 'lamb biryani'],
    'shrimp': ['shrimp', 'shrimps', 'prawn', 'prawns', 'jumbo shrimp', 'tiger prawn', 'king prawn', 'cocktail shrimp', 'shrimp cocktail', 'prawn cocktail', 'shrimp curry', 'prawn curry', 'shrimp biryani', 'prawn biryani', 'gambas', 'scampi', 'langostino'],
    'salmon': ['salmon', 'salmon fillet', 'smoked salmon', 'lox', 'grilled salmon', 'salmon teriyaki'],
    'tuna': ['tuna', 'tuna fish', 'ahi tuna', 'tuna steak', 'tuna salad', 'tuna roll', 'spicy tuna'],
    'fish': ['fish', 'cod', 'tilapia', 'bass', 'sea bass', 'trout', 'halibut', 'anchovy', 'sardine', 'mackerel', 'snapper', 'swordfish', 'catfish', 'fish fillet', 'fish curry', 'fish and chips', 'fish taco'],
    'garlic': ['garlic', 'garlic powder', 'minced garlic', 'roasted garlic', 'garlic paste', 'garlic bread'],
    'onion': ['onion', 'onions', 'shallot', 'scallion', 'green onion', 'spring onion', 'leek', 'red onion', 'onion powder'],
    'mushroom': ['mushroom', 'mushrooms', 'shiitake', 'portobello', 'cremini', 'oyster mushroom', 'chanterelle', 'porcini', 'truffle'],
    'coconut': ['coconut', 'coconut milk', 'coconut oil', 'coconut cream', 'coconut flakes', 'coconut water'],
    'tomato': ['tomato', 'tomatoes', 'tomato sauce', 'tomato paste', 'marinara', 'cherry tomato', 'ketchup'],
}


def get_ingredient_aliases(ingredient_name: str) -> List[str]:
    """Get all aliases for an ingredient"""
    name_lower = ingredient_name.lower().strip()
    
    aliases = INGREDIENT_ALIASES.get(name_lower, [])
    aliases = INGREDIENT_ALIASES.get(name_lower.replace(' ', '_'), aliases)
    
    if not aliases:
        for key, alias_list in INGREDIENT_ALIASES.items():
            if name_lower in [a.lower() for a in alias_list]:
                aliases = alias_list
                break
    
    if not aliases:
        aliases = [name_lower]
    
    return aliases


def get_all_excluded_terms(excluded_names: List[str]) -> set:
    """Get all excluded terms including aliases"""
    all_terms = set()
    for excluded in excluded_names:
        all_terms.add(excluded.lower().strip())
        aliases = get_ingredient_aliases(excluded)
        all_terms.update([a.lower().strip() for a in aliases])
    return all_terms


def check_text_for_excluded_ingredients(text: str, excluded_terms: set) -> List[str]:
    """Check if text contains excluded ingredients using word boundaries"""
    text_lower = text.lower()
    found_violations = []
    
    for term in excluded_terms:
        pattern = r'\b' + re.escape(term) + r'(?:s|es)?\b'
        if re.search(pattern, text_lower):
            found_violations.append(term)
    
    return found_violations


def filter_unsafe_recipes_from_response(ai_response: str, excluded_names: List[str]) -> tuple:
    """
    Post-process AI response to remove recipes containing excluded ingredients.
    Returns: (filtered_response, removed_recipes, violation_details)
    """
    if not excluded_names:
        return ai_response, [], []
    
    all_excluded_terms = get_all_excluded_terms(excluded_names)
    recipe_pattern = r'(#{2,3}\s*(?:\d+\.?\s*)?([^\n#]+)(?:.*?)(?=#{2,3}\s*(?:\d+\.?\s*)?[A-Z]|$))'
    
    sections = re.split(r'(#{2,3}\s*(?:\d+\.?\s*)?[A-Z][^\n]+)', ai_response)
    
    removed_recipes = []
    violation_details = []
    safe_sections = []
    current_recipe_title = None
    
    for i, section in enumerate(sections):
        header_match = re.match(r'^#{2,3}\s*(?:\d+\.?\s*)?([A-Z][^\n]+)', section)
        
        if header_match:
            current_recipe_title = header_match.group(1).strip()
            title_violations = check_text_for_excluded_ingredients(current_recipe_title, all_excluded_terms)
            
            if title_violations:
                logging.warning(f"SAFETY FILTER: Removed recipe '{current_recipe_title}' - title contains: {title_violations}")
                removed_recipes.append(current_recipe_title)
                violation_details.append({"recipe": current_recipe_title, "reason": "title", "terms": title_violations})
                current_recipe_title = None
                continue
            
            safe_sections.append(section)
        else:
            if current_recipe_title:
                content_violations = check_text_for_excluded_ingredients(section, all_excluded_terms)
                
                if content_violations:
                    logging.warning(f"SAFETY FILTER: Removed recipe '{current_recipe_title}' - content contains: {content_violations}")
                    removed_recipes.append(current_recipe_title)
                    violation_details.append({"recipe": current_recipe_title, "reason": "content", "terms": content_violations})
                    if safe_sections and current_recipe_title in safe_sections[-1]:
                        safe_sections.pop()
                    current_recipe_title = None
                    continue
                
                safe_sections.append(section)
            else:
                content_violations = check_text_for_excluded_ingredients(section, all_excluded_terms)
                if not content_violations:
                    safe_sections.append(section)
    
    filtered_response = ''.join(safe_sections)
    
    if removed_recipes and not any('###' in s or '##' in s for s in safe_sections):
        filtered_response = f"""I apologize, but I was unable to provide safe recipe suggestions that don't contain your excluded ingredients ({', '.join(excluded_names)}).

Please try:
1. Adjusting your cuisine preference to one that doesn't typically use these ingredients
2. Selecting a different meal type
3. Let me know if you'd like suggestions for alternative cuisines

Your safety is my top priority."""
    elif removed_recipes:
        filtered_response += f"\n\n---\n*Note: {len(removed_recipes)} recipe(s) were automatically filtered out due to containing excluded ingredients.*"
    
    return filtered_response, removed_recipes, violation_details


def filter_recipe_text_strictly(ai_response: str, excluded_names: List[str]) -> str:
    """Ultra-strict line-by-line safety filter"""
    if not excluded_names:
        return ai_response
    
    all_excluded_terms = get_all_excluded_terms(excluded_names)
    lines = ai_response.split('\n')
    safe_lines = []
    in_unsafe_section = False
    
    def has_excluded_term(text: str) -> bool:
        text_lower = text.lower()
        for term in all_excluded_terms:
            pattern = r'\b' + re.escape(term) + r'(?:s|es)?\b'
            if re.search(pattern, text_lower):
                return True
        return False
    
    for line in lines:
        is_recipe_header = line.strip().startswith('##') or line.strip().startswith('###')
        has_violation = has_excluded_term(line)
        
        if is_recipe_header:
            if has_violation:
                in_unsafe_section = True
                logging.warning(f"STRICT FILTER: Skipping recipe: {line.strip()}")
                continue
            else:
                in_unsafe_section = False
                safe_lines.append(line)
        elif in_unsafe_section:
            continue
        elif has_violation:
            if '**' in line or '-' in line.strip()[:2]:
                in_unsafe_section = True
                logging.warning(f"STRICT FILTER: Content violation: {line.strip()}")
                while safe_lines and not (safe_lines[-1].strip().startswith('##')):
                    safe_lines.pop()
                if safe_lines and safe_lines[-1].strip().startswith('##'):
                    safe_lines.pop()
                continue
            else:
                continue
        else:
            safe_lines.append(line)
    
    return '\n'.join(safe_lines)


async def get_user_excluded_ingredients(user_id: str) -> List[str]:
    """Get list of excluded ingredient names for a user"""
    exclusions = await db.user_exclusions.find_one(
        {"user_id": user_id},
        {"_id": 0, "excluded_ingredient_names": 1}
    )
    if exclusions:
        return exclusions.get("excluded_ingredient_names", [])
    return []


# ============== ROUTES ==============

@router.get("")
async def get_exclusions(current_user: User = Depends(get_current_user)):
    """Get user's current food exclusions"""
    exclusions = await db.user_exclusions.find_one(
        {"user_id": current_user.id},
        {"_id": 0}
    )
    
    if not exclusions:
        return {
            "user_id": current_user.id,
            "excluded_ingredients": [],
            "excluded_ingredient_names": [],
            "common_allergens": {
                "eggs": False, "milk": False, "peanuts": False, "tree_nuts": False,
                "soy": False, "wheat": False, "fish": False, "shellfish": False, "sesame": False
            }
        }
    
    return exclusions


@router.post("")
async def create_exclusions(request: ExclusionCreate, current_user: User = Depends(get_current_user)):
    """Create or replace user's food exclusions"""
    excluded_names = [ing.name.lower().strip() for ing in request.excluded_ingredients]
    
    common_allergens = {
        "eggs": False, "milk": False, "peanuts": False, "tree_nuts": False,
        "soy": False, "wheat": False, "fish": False, "shellfish": False, "sesame": False
    }
    for name in excluded_names:
        if name in common_allergens:
            common_allergens[name] = True
        for allergen, aliases in INGREDIENT_ALIASES.items():
            if allergen in common_allergens and name in [a.lower() for a in aliases]:
                common_allergens[allergen] = True
    
    exclusion_data = {
        "user_id": current_user.id,
        "excluded_ingredients": [ing.model_dump() for ing in request.excluded_ingredients],
        "excluded_ingredient_names": excluded_names,
        "common_allergens": common_allergens,
        "last_updated": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_exclusions.update_one(
        {"user_id": current_user.id},
        {"$set": exclusion_data},
        upsert=True
    )
    
    return {"message": "Exclusions saved successfully", "exclusions": exclusion_data}


@router.put("")
async def update_exclusions(request: ExclusionUpdate, current_user: User = Depends(get_current_user)):
    """Add or remove specific exclusions"""
    existing = await db.user_exclusions.find_one({"user_id": current_user.id})
    
    if existing:
        current_ingredients = existing.get("excluded_ingredients", [])
        current_names = existing.get("excluded_ingredient_names", [])
    else:
        current_ingredients = []
        current_names = []
    
    if request.remove_ingredient_names:
        remove_lower = [n.lower().strip() for n in request.remove_ingredient_names]
        current_ingredients = [ing for ing in current_ingredients if ing["name"].lower() not in remove_lower]
        current_names = [n for n in current_names if n.lower() not in remove_lower]
    
    if request.add_ingredients:
        for ing in request.add_ingredients:
            name_lower = ing.name.lower().strip()
            if name_lower not in current_names:
                current_ingredients.append(ing.model_dump())
                current_names.append(name_lower)
    
    common_allergens = {
        "eggs": False, "milk": False, "peanuts": False, "tree_nuts": False,
        "soy": False, "wheat": False, "fish": False, "shellfish": False, "sesame": False
    }
    for name in current_names:
        if name in common_allergens:
            common_allergens[name] = True
        for allergen, aliases in INGREDIENT_ALIASES.items():
            if allergen in common_allergens and name in [a.lower() for a in aliases]:
                common_allergens[allergen] = True
    
    exclusion_data = {
        "user_id": current_user.id,
        "excluded_ingredients": current_ingredients,
        "excluded_ingredient_names": current_names,
        "common_allergens": common_allergens,
        "last_updated": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_exclusions.update_one(
        {"user_id": current_user.id},
        {"$set": exclusion_data},
        upsert=True
    )
    
    return {"message": "Exclusions updated", "exclusions": exclusion_data}


@router.delete("/{ingredient_name}")
async def remove_exclusion(ingredient_name: str, current_user: User = Depends(get_current_user)):
    """Remove a specific ingredient from exclusions"""
    name_lower = ingredient_name.lower().strip()
    
    result = await db.user_exclusions.update_one(
        {"user_id": current_user.id},
        {
            "$pull": {
                "excluded_ingredients": {"name": {"$regex": f"^{name_lower}$", "$options": "i"}},
                "excluded_ingredient_names": name_lower
            },
            "$set": {"last_updated": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail=f"Ingredient '{ingredient_name}' not found in exclusions")
    
    return {"message": f"'{ingredient_name}' removed from exclusions"}
