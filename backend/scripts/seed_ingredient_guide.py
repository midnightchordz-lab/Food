"""
Seed Ingredient Guide Database
Pre-populate with common spices, pulses, and ingredients
Run with: python -m scripts.seed_ingredient_guide
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# ═══════════════════════════════════════════════════════════════
# INGREDIENT DATA
# ═══════════════════════════════════════════════════════════════

INGREDIENT_DATA = [
    # ════════════════════════════════════════════════════════
    # SPICES - WHOLE
    # ════════════════════════════════════════════════════════
    {
        "name": "cumin seeds",
        "display_name": "Cumin Seeds",
        "alternate_names": ["jeera", "cumin", "cuminum cyminum", "zeera"],
        "category": "spice_whole",
        "images": {
            "primary": "https://images.unsplash.com/photo-1600791102844-208e695205f6?w=400",
            "comparison": [
                {"url": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400", "caption": "Whole seeds"},
                {"url": "https://images.unsplash.com/photo-1607672632458-9eb56696346b?w=400", "caption": "Ground powder"}
            ],
            "closeup": "https://images.unsplash.com/photo-1600791102844-208e695205f6?w=800"
        },
        "appearance": {
            "color": "Light to medium brown",
            "shape": "Elongated oval seeds with ridges",
            "size": "3-5mm long",
            "texture": "Ridged lengthwise, slightly curved",
            "visual_description": "Small, elongated brown seeds with distinctive ridges running lengthwise. Lighter in color than caraway seeds."
        },
        "similar_to": [
            {
                "name": "Caraway seeds",
                "how_to_differentiate": "Cumin is lighter brown and slightly larger. Caraway is darker and more curved. Cumin has earthy aroma, caraway is more anise-like."
            },
            {
                "name": "Fennel seeds",
                "how_to_differentiate": "Fennel seeds are greenish and larger. Fennel tastes like licorice, cumin is earthy."
            }
        ],
        "confused_with": [
            {
                "name": "Black cumin (Nigella/Kalonji)",
                "warning": "Black cumin is completely different! It's black, smaller, and has a different flavor. Don't substitute."
            }
        ],
        "aroma": "Warm, earthy, slightly citrusy",
        "taste": "Earthy, slightly bitter, warm",
        "common_uses": [
            "Indian curries and dals",
            "Mexican dishes (tacos, chili)",
            "Middle Eastern cuisine",
            "Dry roasting before use enhances flavor"
        ],
        "cuisines": ["Indian", "Mexican", "Middle Eastern", "North African"],
        "preparation_tips": [
            "Dry roast in a pan for 30 seconds to release aroma",
            "Grind fresh for maximum flavor",
            "Add whole seeds at the start of cooking in hot oil",
            "Toast until they darken slightly and smell fragrant"
        ],
        "storage": {
            "method": "Airtight container in cool, dark place",
            "shelf_life": "Whole: 1 year, Ground: 6 months",
            "signs_of_spoilage": ["Loss of aroma", "Dull color", "Musty smell"]
        },
        "substitutes": [
            {"name": "Ground cumin", "ratio": "1 tsp seeds = 3/4 tsp ground", "notes": "Ground is more potent"},
            {"name": "Caraway seeds", "ratio": "1:1", "notes": "Similar but slightly sweeter"},
            {"name": "Coriander seeds", "ratio": "1:1", "notes": "Milder, slightly citrusy"}
        ],
        "nutritional_highlights": ["Rich in iron", "Good source of manganese", "Contains antioxidants"],
        "beginner_notes": "This is one of the most common spices worldwide. Start by smelling it - once you know its warm, earthy aroma, you'll recognize it anywhere. It's essential for Indian and Mexican cooking!",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store spice aisle, Indian/Asian markets (much cheaper)",
        "what_to_look_for": "Buy whole seeds when possible. Look for uniform brown color without dirt or debris.",
        "featured": True,
        "popularity": 100
    },
    
    {
        "name": "mustard seeds",
        "display_name": "Mustard Seeds",
        "alternate_names": ["rai", "sarson", "mustard", "black mustard seeds", "yellow mustard seeds"],
        "category": "spice_whole",
        "images": {
            "primary": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400",
            "comparison": [
                {"url": "", "caption": "Yellow mustard seeds"},
                {"url": "", "caption": "Black mustard seeds"}
            ],
            "closeup": ""
        },
        "appearance": {
            "color": "Yellow, brown, or black depending on variety",
            "shape": "Perfectly round, tiny spheres",
            "size": "1-2mm diameter",
            "texture": "Smooth, hard, glossy surface",
            "visual_description": "Tiny, perfectly round seeds. Yellow variety is pale cream, brown is medium brown, black is dark brown (not truly black)."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Mild when raw, pungent and sharp when toasted or ground",
        "taste": "Sharp, pungent, slightly bitter (intensifies when toasted)",
        "common_uses": [
            "Indian tempering (tadka/chaunk)",
            "Pickling",
            "Mustard sauce and condiments",
            "South Indian curries and rasam"
        ],
        "cuisines": ["Indian", "South Indian", "Bengali", "European"],
        "preparation_tips": [
            "Heat oil first until shimmering, then add seeds",
            "Wait for them to pop/splutter (cover pan with lid!)",
            "Takes 10-20 seconds to pop fully",
            "They're ready when the popping slows down"
        ],
        "storage": {
            "method": "Airtight jar in cool, dry pantry",
            "shelf_life": "1-2 years",
            "signs_of_spoilage": ["Loss of pungency", "Stale or musty smell"]
        },
        "substitutes": [
            {"name": "Mustard powder", "ratio": "1 tsp seeds = 1/2 tsp powder", "notes": "Different texture but similar flavor"}
        ],
        "nutritional_highlights": ["High in selenium", "Contains omega-3", "Anti-inflammatory properties"],
        "beginner_notes": "These will POP and SPLUTTER when heated in oil - it's completely normal! Cover your pan with a lid to avoid hot oil splattering. The popping sound means they're releasing their flavor.",
        "difficulty_level": "beginner",
        "where_to_find": "Grocery store spice aisle, Indian markets",
        "what_to_look_for": "Black/brown seeds are more common in Indian cooking. Yellow seeds are milder.",
        "featured": True,
        "popularity": 90
    },
    
    {
        "name": "coriander seeds",
        "display_name": "Coriander Seeds",
        "alternate_names": ["dhania seeds", "cilantro seeds", "dhaniya"],
        "category": "spice_whole",
        "images": {
            "primary": "https://images.unsplash.com/photo-1599909533601-fc71c5c8c8b9?w=400",
            "comparison": [
                {"url": "", "caption": "Whole seeds"},
                {"url": "", "caption": "Ground coriander powder"}
            ],
            "closeup": ""
        },
        "appearance": {
            "color": "Light brown to tan/beige",
            "shape": "Round with ridges, hollow inside",
            "size": "3-5mm diameter",
            "texture": "Ribbed surface, feels hollow when crushed",
            "visual_description": "Round, ridged seeds that are actually the dried fruit of the cilantro plant. Lighter in color than peppercorns, with visible vertical ridges."
        },
        "similar_to": [
            {
                "name": "White peppercorns",
                "how_to_differentiate": "Coriander seeds are lighter colored, ridged, and hollow. Peppercorns are smooth, solid, and have a spicy aroma."
            }
        ],
        "confused_with": [],
        "aroma": "Citrusy, floral, slightly sweet with hints of orange peel",
        "taste": "Mild, sweet, citrusy, slightly nutty when toasted",
        "common_uses": [
            "Indian curries and spice blends",
            "Garam masala and curry powder",
            "Pickling spices",
            "Marinades for meat and vegetables"
        ],
        "cuisines": ["Indian", "Middle Eastern", "Mediterranean", "Thai"],
        "preparation_tips": [
            "Dry roast to bring out citrus notes before grinding",
            "Crush lightly before grinding for easier grinding",
            "Seeds are much milder than fresh cilantro leaves",
            "Toast until golden brown and very fragrant"
        ],
        "storage": {
            "method": "Airtight container away from light and heat",
            "shelf_life": "1 year whole, 6 months ground",
            "signs_of_spoilage": ["Faded color", "Loss of citrus aroma"]
        },
        "substitutes": [
            {"name": "Ground coriander", "ratio": "1 tbsp seeds = 1 tsp ground", "notes": "Grind fresh for best flavor"},
            {"name": "Cumin + caraway", "ratio": "Mix equal parts", "notes": "Approximate substitute only"}
        ],
        "nutritional_highlights": ["Good source of fiber", "Contains iron and magnesium"],
        "beginner_notes": "Fun fact: These are cilantro seeds! But they taste NOTHING like cilantro leaves - they're sweet and citrusy instead of that distinctive herb flavor. Great for people who hate cilantro!",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store, Indian markets for better prices",
        "what_to_look_for": "Look for uniform tan color. Avoid seeds that look damp or clumped.",
        "featured": True,
        "popularity": 85
    },
    
    {
        "name": "cardamom pods",
        "display_name": "Green Cardamom Pods",
        "alternate_names": ["elaichi", "cardamom", "green cardamom", "choti elaichi"],
        "category": "spice_whole",
        "images": {
            "primary": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400",
            "comparison": [
                {"url": "", "caption": "Green cardamom pods"},
                {"url": "", "caption": "Black cardamom pods"}
            ],
            "closeup": ""
        },
        "appearance": {
            "color": "Light green to pale yellow-green",
            "shape": "Small oval pods with ridges",
            "size": "1-2cm long",
            "texture": "Papery outer shell containing small black seeds",
            "visual_description": "Small, oval-shaped green pods. The outer shell is papery and contains tiny black seeds inside. The seeds are the most aromatic part."
        },
        "similar_to": [
            {
                "name": "Black cardamom",
                "how_to_differentiate": "Black cardamom is much larger, dark brown/black, and has a smoky flavor. Green is sweet and floral. They're NOT interchangeable!"
            }
        ],
        "confused_with": [
            {
                "name": "Black cardamom",
                "warning": "Black cardamom has a completely different smoky, camphor-like flavor. Using it instead of green will drastically change your dish!"
            }
        ],
        "aroma": "Sweet, floral, eucalyptus-like, intensely fragrant",
        "taste": "Sweet, floral, slightly spicy, menthol-like freshness",
        "common_uses": [
            "Indian chai and desserts",
            "Biryani and pulao rice dishes",
            "Scandinavian baking",
            "Middle Eastern coffee"
        ],
        "cuisines": ["Indian", "Middle Eastern", "Scandinavian", "Arabic"],
        "preparation_tips": [
            "Lightly crush pods to release seeds' flavor",
            "Remove pods before serving (they're not pleasant to bite)",
            "Can use just the seeds for finer dishes",
            "A little goes a long way - very potent!"
        ],
        "storage": {
            "method": "Airtight container away from light",
            "shelf_life": "1 year for pods, less for ground",
            "signs_of_spoilage": ["Faded green color (turns tan)", "Loss of strong aroma"]
        },
        "substitutes": [
            {"name": "Ground cardamom", "ratio": "10 pods = 1.5 tsp ground", "notes": "Ground loses flavor quickly"},
            {"name": "Cinnamon + nutmeg", "ratio": "Equal parts", "notes": "Not exact but similar warmth"}
        ],
        "nutritional_highlights": ["Aids digestion", "Freshens breath naturally"],
        "beginner_notes": "Cardamom is expensive but incredibly potent - you only need 2-3 pods per dish. The green pods are used in sweets and chai, black pods in savory dishes. Don't mix them up!",
        "difficulty_level": "beginner",
        "where_to_find": "Indian grocery stores (much cheaper than regular grocery)",
        "what_to_look_for": "Bright green color indicates freshness. Pale or brown pods have lost potency.",
        "featured": True,
        "popularity": 80
    },
    
    {
        "name": "turmeric powder",
        "display_name": "Turmeric Powder",
        "alternate_names": ["haldi", "turmeric", "ground turmeric", "curcuma"],
        "category": "spice_ground",
        "images": {
            "primary": "https://images.unsplash.com/photo-1615485500834-bc10199bc727?w=400",
            "comparison": [
                {"url": "https://images.unsplash.com/photo-1768729340164-7d83fe18384d?w=400", "caption": "Ground powder"},
                {"url": "", "caption": "Fresh turmeric root"}
            ],
            "closeup": ""
        },
        "appearance": {
            "color": "Bright golden yellow-orange",
            "shape": "Fine powder",
            "size": "N/A - powder",
            "texture": "Smooth, fine powder that stains easily",
            "visual_description": "Vibrant golden-yellow to orange powder. Will stain everything it touches! Much brighter and more orange than curry powder."
        },
        "similar_to": [],
        "confused_with": [
            {
                "name": "Curry powder",
                "warning": "Curry powder is a MIX of spices including turmeric. They're completely different products - you can't use them interchangeably!"
            }
        ],
        "aroma": "Earthy, slightly bitter, peppery, warm",
        "taste": "Earthy, slightly bitter, warm with mild peppery notes",
        "common_uses": [
            "Almost all Indian curries (for color and flavor)",
            "Golden milk / turmeric latte",
            "Rice dishes for color",
            "Anti-inflammatory health drinks"
        ],
        "cuisines": ["Indian", "Thai", "Indonesian", "Middle Eastern"],
        "preparation_tips": [
            "Wear gloves or oil your hands - it STAINS!",
            "Add early in cooking to mellow bitterness",
            "Use 1/4 to 1/2 tsp per dish (a little goes a long way)",
            "Blooms best when added to hot oil before adding liquid"
        ],
        "storage": {
            "method": "Dark glass jar or opaque container",
            "shelf_life": "6 months for best color and potency",
            "signs_of_spoilage": ["Dull/faded color", "Loss of aroma", "Clumping"]
        },
        "substitutes": [
            {"name": "Fresh turmeric root", "ratio": "1 tsp powder = 1 inch fresh", "notes": "Fresh is milder, grate finely"},
            {"name": "Annatto or saffron", "ratio": "Small amount for color only", "notes": "Different flavor, similar color"}
        ],
        "nutritional_highlights": ["Contains curcumin (anti-inflammatory)", "Antioxidant properties", "Aids digestion"],
        "beginner_notes": "This will STAIN your hands, cutting board, counters, and clothes! That's completely normal. Use plastic or glass bowls, not wooden ones. The yellow stains will fade over time, or use dish soap immediately.",
        "difficulty_level": "beginner",
        "where_to_find": "Every grocery store spice aisle, Indian markets (much cheaper and fresher)",
        "what_to_look_for": "Bright orange-yellow color. Avoid dull brown turmeric - it's old.",
        "featured": True,
        "popularity": 100
    },
    
    {
        "name": "garam masala",
        "display_name": "Garam Masala",
        "alternate_names": ["garam masala powder", "indian spice blend"],
        "category": "spice_ground",
        "images": {
            "primary": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400",
            "comparison": [
                {"url": "", "caption": "Store-bought blend"},
                {"url": "", "caption": "Homemade blend with whole spices"}
            ],
            "closeup": ""
        },
        "appearance": {
            "color": "Dark brown to reddish-brown",
            "shape": "Fine to medium powder",
            "size": "N/A - powder blend",
            "texture": "Slightly coarse powder with visible spice particles",
            "visual_description": "Dark brown spice blend. Noticeably darker than curry powder, with a reddish-brown tint. You might see small spice particles."
        },
        "similar_to": [
            {
                "name": "Curry powder",
                "how_to_differentiate": "Garam masala is darker and added at END of cooking. Curry powder contains turmeric (yellow) and is added at the beginning."
            }
        ],
        "confused_with": [
            {
                "name": "Curry powder",
                "warning": "NOT the same! Garam masala is a finishing spice (added at end). Curry powder is a cooking spice (added at start). Using them wrong affects the dish!"
            }
        ],
        "aroma": "Warm, complex, aromatic (notes of cinnamon, cloves, cardamom)",
        "taste": "Warm, slightly sweet, complex and aromatic",
        "common_uses": [
            "Added at END of cooking Indian curries",
            "Finishing spice for lentil dishes (dal)",
            "Sprinkled on yogurt, vegetables, snacks",
            "North Indian cuisine primarily"
        ],
        "cuisines": ["Indian", "North Indian", "Pakistani"],
        "preparation_tips": [
            "Add at the END of cooking (last 5 minutes or after turning off heat)",
            "Loses flavor rapidly if overcooked",
            "Use sparingly - 1/2 to 1 tsp per dish for 4 servings",
            "Don't fry in hot oil - add to simmering liquid or finished dish"
        ],
        "storage": {
            "method": "Airtight container away from heat and light",
            "shelf_life": "6 months maximum for good flavor",
            "signs_of_spoilage": ["Flat/dusty aroma", "No warmth when smelled"]
        },
        "substitutes": [
            {"name": "DIY blend", "ratio": "Mix: 2 parts cumin, 2 parts coriander, 1 part black pepper, 1/2 part each cinnamon, cardamom, cloves", "notes": "Toast and grind for best results"}
        ],
        "nutritional_highlights": ["Contains warming spices that aid digestion"],
        "beginner_notes": "This is a BLEND, not a single spice - every brand tastes different! The key thing to remember: add it at the END of cooking, not the beginning. If you cook it too long, it loses its magic aroma.",
        "difficulty_level": "beginner",
        "where_to_find": "Indian markets (fresher and cheaper), grocery store international aisle",
        "what_to_look_for": "Buy small quantities since it loses potency quickly. Smell before buying if possible - should be very aromatic.",
        "featured": True,
        "popularity": 85
    },
    
    # ════════════════════════════════════════════════════════
    # PULSES - LENTILS
    # ════════════════════════════════════════════════════════
    
    {
        "name": "red lentils",
        "display_name": "Red Lentils",
        "alternate_names": ["masoor dal", "red dal", "pink lentils", "masur dal"],
        "category": "pulse_lentil",
        "images": {
            "primary": "https://images.unsplash.com/photo-1764573464925-da17a9f796d4?w=400",
            "comparison": [
                {"url": "", "caption": "Dry red lentils"},
                {"url": "", "caption": "Cooked (turns golden yellow)"}
            ],
            "closeup": ""
        },
        "appearance": {
            "color": "Bright orange-red when dry, turns yellow when cooked",
            "shape": "Small, flat, lens-shaped (split)",
            "size": "3-4mm diameter",
            "texture": "Smooth, already split/dehusked",
            "visual_description": "Bright salmon-orange color when dry. These are split lentils with no skin/husk. They break down completely when cooked, turning golden yellow and mushy."
        },
        "similar_to": [
            {
                "name": "Yellow lentils (Moong dal)",
                "how_to_differentiate": "Red lentils are orange-pink when dry. Yellow moong dal is pale yellow. Red lentils turn completely mushy; yellow dal holds shape slightly better."
            }
        ],
        "confused_with": [],
        "aroma": "Mild, slightly earthy",
        "taste": "Mild, slightly sweet, earthy, very easy to eat",
        "common_uses": [
            "Indian dal (daily comfort food)",
            "Soups and stews (thickener)",
            "Quick curries",
            "Puréed baby food"
        ],
        "cuisines": ["Indian", "Middle Eastern", "Mediterranean", "Ethiopian"],
        "preparation_tips": [
            "No soaking needed - just rinse!",
            "Cooks in just 15-20 minutes",
            "Rinse thoroughly until water runs clear",
            "They WILL turn completely mushy - this is correct!",
            "Add water gradually as they absorb a lot"
        ],
        "storage": {
            "method": "Airtight container in cool, dry pantry",
            "shelf_life": "1-2 years",
            "signs_of_spoilage": ["Insect infestation", "Off/musty smell", "Excessive dust or debris"]
        },
        "substitutes": [
            {"name": "Yellow split peas", "ratio": "1:1", "notes": "Takes longer to cook"},
            {"name": "Yellow moong dal", "ratio": "1:1", "notes": "Cooks similarly, slightly different flavor"}
        ],
        "nutritional_highlights": ["High in protein", "Excellent source of iron", "Rich in fiber", "Low in fat"],
        "beginner_notes": "Perfect for beginners! They cook FAST (15 min), don't need soaking, and are very forgiving. They're SUPPOSED to break down into a thick soup/porridge - that's exactly how dal works!",
        "difficulty_level": "beginner",
        "where_to_find": "Regular grocery stores, Indian markets, bulk food stores",
        "what_to_look_for": "Bright orange color, no debris or stones, uniform size",
        "featured": True,
        "popularity": 95
    },
    
    {
        "name": "moong dal",
        "display_name": "Yellow Moong Dal (Split Mung Beans)",
        "alternate_names": ["yellow lentils", "split mung beans", "moong", "mung dal", "green gram split"],
        "category": "pulse_lentil",
        "images": {
            "primary": "https://images.unsplash.com/photo-1515543904823-77c6b6c6ed42?w=400",
            "comparison": [
                {"url": "", "caption": "Yellow split moong dal"},
                {"url": "", "caption": "Whole green mung beans"}
            ],
            "closeup": ""
        },
        "appearance": {
            "color": "Pale yellow",
            "shape": "Small, flat ovals (split in half)",
            "size": "3-4mm",
            "texture": "Smooth, split with slight shine",
            "visual_description": "Pale yellow, small split beans. These are mung beans with the green skin removed and split in half. Lighter yellow color than red lentils."
        },
        "similar_to": [
            {
                "name": "Red lentils",
                "how_to_differentiate": "Moong dal is pale yellow, red lentils are orange. Moong dal holds its shape slightly better when cooked."
            },
            {
                "name": "Chana dal",
                "how_to_differentiate": "Chana dal is much larger, brighter yellow, and takes much longer to cook."
            }
        ],
        "confused_with": [],
        "aroma": "Mild, slightly sweet, delicate",
        "taste": "Mild, slightly sweet, earthy, very gentle on stomach",
        "common_uses": [
            "Light Indian dal",
            "Khichdi (rice + dal comfort food)",
            "Baby food and invalid food",
            "Light soups"
        ],
        "cuisines": ["Indian", "Asian", "Ayurvedic cuisine"],
        "preparation_tips": [
            "Soak 30 minutes for faster cooking (optional)",
            "Cooks in 20-25 minutes",
            "Very easy to digest - traditional healing food",
            "Stays slightly more intact than red lentils"
        ],
        "storage": {
            "method": "Airtight container in dry place",
            "shelf_life": "1 year",
            "signs_of_spoilage": ["Insects", "Moisture/clumping", "Off smell"]
        },
        "substitutes": [
            {"name": "Red lentils", "ratio": "1:1", "notes": "Similar cooking time, slightly different flavor"}
        ],
        "nutritional_highlights": ["High protein", "Easy to digest", "Good source of potassium"],
        "beginner_notes": "This is the easiest dal to digest, making it the traditional food for babies, sick people, and anyone with digestive issues. It's mild, gentle, and won't turn into complete mush like red lentils.",
        "difficulty_level": "beginner",
        "where_to_find": "Indian grocery stores, Asian markets, health food stores",
        "what_to_look_for": "Uniform pale yellow color, no debris",
        "featured": True,
        "popularity": 80
    },
    
    {
        "name": "chana dal",
        "display_name": "Chana Dal (Split Chickpeas)",
        "alternate_names": ["bengal gram", "split chickpeas", "split garbanzo", "chana", "gram dal"],
        "category": "pulse_lentil",
        "images": {
            "primary": "https://images.unsplash.com/photo-1515543904823-77c6b6c6ed42?w=400",
            "comparison": [
                {"url": "", "caption": "Split chana dal"},
                {"url": "", "caption": "Whole chickpeas for comparison"}
            ],
            "closeup": ""
        },
        "appearance": {
            "color": "Bright golden yellow",
            "shape": "Larger than other dals, irregular split halves",
            "size": "5-7mm",
            "texture": "Rough, slightly grainy surface",
            "visual_description": "These are split and skinned chickpeas (garbanzo beans). Much larger and brighter yellow than other lentils. Look like small broken corn kernels."
        },
        "similar_to": [
            {
                "name": "Toor dal",
                "how_to_differentiate": "Chana dal is brighter yellow and larger. Toor dal is smaller and more pale/cream colored."
            }
        ],
        "confused_with": [],
        "aroma": "Nutty, earthy, slightly sweet",
        "taste": "Nutty, slightly sweet, hearty and substantial",
        "common_uses": [
            "Indian dal dishes",
            "Roasted as crunchy snack",
            "Indian sweets (besan/gram flour base)",
            "Added to rice dishes and mixed vegetable curries"
        ],
        "cuisines": ["Indian", "Bengali", "South Indian"],
        "preparation_tips": [
            "MUST soak for at least 1-2 hours (or overnight)",
            "Takes 45-60 minutes to cook even after soaking",
            "Stays firm even when fully cooked - that's normal!",
            "Great for adding to rice dishes where you want texture"
        ],
        "storage": {
            "method": "Sealed container in cool, dry place",
            "shelf_life": "1 year or more",
            "signs_of_spoilage": ["Insects", "Moisture", "Off smell"]
        },
        "substitutes": [
            {"name": "Yellow split peas", "ratio": "1:1", "notes": "Similar cooking time and texture"}
        ],
        "nutritional_highlights": ["Very high in protein", "Good source of fiber", "Complex carbohydrates"],
        "beginner_notes": "This is basically a split chickpea. It takes MUCH longer to cook than red lentils - don't expect it to cook in 15 minutes! Plan for at least 1 hour. It's supposed to stay a bit firm.",
        "difficulty_level": "intermediate",
        "where_to_find": "Indian grocery stores, bulk food stores",
        "what_to_look_for": "Bright yellow color, large uniform pieces",
        "featured": True,
        "popularity": 75
    },
    
    {
        "name": "toor dal",
        "display_name": "Toor Dal (Split Pigeon Peas)",
        "alternate_names": ["arhar dal", "tuvar dal", "pigeon peas", "red gram"],
        "category": "pulse_lentil",
        "images": {
            "primary": "https://images.unsplash.com/photo-1515543904823-77c6b6c6ed42?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Pale yellow to cream with slight oily sheen",
            "shape": "Round, split in half",
            "size": "5-6mm",
            "texture": "Smooth with slightly oily coating",
            "visual_description": "Pale yellow split lentils with a distinctive oily sheen (they're often coated in oil to preserve freshness). Slightly larger than moong dal."
        },
        "similar_to": [
            {
                "name": "Chana dal",
                "how_to_differentiate": "Toor dal is paler/cream colored and has an oily sheen. Chana dal is brighter yellow and larger."
            }
        ],
        "confused_with": [],
        "aroma": "Earthy, slightly nutty",
        "taste": "Earthy, mild, slightly nutty",
        "common_uses": [
            "Sambar (South Indian lentil stew)",
            "Daily dal in many Indian households",
            "Mixed with rice for protein"
        ],
        "cuisines": ["South Indian", "Gujarati", "Maharashtrian"],
        "preparation_tips": [
            "Soak for 30 minutes to reduce cooking time",
            "Cooks in 25-35 minutes in regular pot",
            "Wash thoroughly to remove oil coating",
            "Pressure cooking reduces time significantly"
        ],
        "storage": {
            "method": "Airtight container",
            "shelf_life": "1 year",
            "signs_of_spoilage": ["Rancid smell from oil going bad", "Insects"]
        },
        "substitutes": [
            {"name": "Red lentils + chana dal mix", "ratio": "50:50", "notes": "Approximates the texture"}
        ],
        "nutritional_highlights": ["High protein", "Good source of folic acid"],
        "beginner_notes": "This dal often has an oily coating to keep it fresh - wash it well before cooking! It's the base for sambar, the famous South Indian lentil stew.",
        "difficulty_level": "beginner",
        "where_to_find": "Indian grocery stores",
        "what_to_look_for": "Look for 'oily' toor dal - it stays fresher longer",
        "featured": True,
        "popularity": 70
    },
    
    # ════════════════════════════════════════════════════════
    # MORE COMMON SPICES
    # ════════════════════════════════════════════════════════
    
    {
        "name": "red chili powder",
        "display_name": "Red Chili Powder",
        "alternate_names": ["lal mirch", "cayenne", "ground red pepper", "deggi mirch"],
        "category": "spice_ground",
        "images": {
            "primary": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Bright red to deep brick red",
            "shape": "Fine powder",
            "size": "N/A - powder",
            "texture": "Very fine, smooth powder",
            "visual_description": "Vibrant red powder. Indian chili powder is usually less spicy than cayenne. Deggi mirch is specifically for color with mild heat."
        },
        "similar_to": [
            {
                "name": "Paprika",
                "how_to_differentiate": "Chili powder is spicier. Paprika is milder and sweeter. Smoked paprika has a smoky taste."
            },
            {
                "name": "Cayenne pepper",
                "how_to_differentiate": "Cayenne is usually much hotter than Indian chili powder. Use less cayenne as substitute."
            }
        ],
        "confused_with": [
            {
                "name": "American chili powder (blend)",
                "warning": "American 'chili powder' is a BLEND with cumin, garlic, oregano. Indian 'chili powder' is PURE ground chilies. Very different!"
            }
        ],
        "aroma": "Sharp, pungent, slightly smoky",
        "taste": "Spicy, hot, slightly fruity undertones",
        "common_uses": [
            "All Indian curries for heat and color",
            "Marinades for meat",
            "Sprinkling on snacks",
            "Adding heat to any dish"
        ],
        "cuisines": ["Indian", "Mexican", "Thai", "Korean"],
        "preparation_tips": [
            "Add to hot oil carefully - it can burn quickly",
            "Start with less, add more gradually",
            "Blooms in oil for deeper color",
            "Kashmiri chili powder is milder but gives great color"
        ],
        "storage": {
            "method": "Airtight container away from light",
            "shelf_life": "6 months to 1 year",
            "signs_of_spoilage": ["Faded color", "Loss of heat/pungency"]
        },
        "substitutes": [
            {"name": "Cayenne pepper", "ratio": "Use 1/2 the amount", "notes": "Cayenne is hotter"},
            {"name": "Paprika + cayenne", "ratio": "3:1 mix", "notes": "For color with less heat"}
        ],
        "nutritional_highlights": ["Contains capsaicin", "Boosts metabolism", "High in vitamin C"],
        "beginner_notes": "Indian chili powder is different from American 'chili powder' (which is a blend)! If a recipe says 1 tsp chili powder and you use cayenne, you might get much more heat than expected. Start with half and adjust.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store, Indian markets for varieties like Kashmiri",
        "what_to_look_for": "Bright red color. Kashmiri chili powder is milder but gives beautiful red color.",
        "featured": True,
        "popularity": 90
    },
    
    {
        "name": "bay leaves",
        "display_name": "Bay Leaves",
        "alternate_names": ["tej patta", "bay leaf", "laurel leaves"],
        "category": "herb_dried",
        "images": {
            "primary": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Olive green to brownish-green",
            "shape": "Oval, pointed leaf shape",
            "size": "5-8cm long",
            "texture": "Stiff, papery, slightly brittle",
            "visual_description": "Dried whole leaves with pointed ends. Stiff and papery texture. Indian bay leaves (tej patta) are larger and have 3 veins; Mediterranean bay leaves are smaller with 1 vein."
        },
        "similar_to": [
            {
                "name": "Indian bay leaf (Tej patta)",
                "how_to_differentiate": "Indian bay leaves are larger, have 3 parallel veins, and taste like cinnamon. Mediterranean bay leaves are smaller, have 1 central vein, and are more herbal."
            }
        ],
        "confused_with": [],
        "aroma": "Herbal, slightly floral, with hints of eucalyptus (Indian: cinnamon-like)",
        "taste": "Subtle, herbal, adds depth rather than distinct flavor",
        "common_uses": [
            "Indian rice dishes (biryani, pulao)",
            "Soups and stews",
            "Braised meats",
            "Simmering liquids for flavor"
        ],
        "cuisines": ["Indian", "Mediterranean", "European", "Thai"],
        "preparation_tips": [
            "Add at the beginning of cooking",
            "ALWAYS remove before serving (tough to eat)",
            "Breaks down over long cooking - that's good",
            "1-2 leaves are enough for most dishes"
        ],
        "storage": {
            "method": "Airtight container in dark place",
            "shelf_life": "1-2 years",
            "signs_of_spoilage": ["No aroma when crushed", "Crumbles to dust"]
        },
        "substitutes": [
            {"name": "Dried thyme", "ratio": "1/4 tsp per bay leaf", "notes": "Not exact but adds herbal note"}
        ],
        "nutritional_highlights": ["Aids digestion", "Contains antioxidants"],
        "beginner_notes": "Bay leaves add subtle background flavor - you won't taste them directly. The most important thing: ALWAYS fish them out before serving! They don't soften and are unpleasant to bite into.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store spice aisle",
        "what_to_look_for": "Intact leaves without too much crumbling. Should smell aromatic when crushed.",
        "featured": True,
        "popularity": 75
    },
    
    {
        "name": "cinnamon sticks",
        "display_name": "Cinnamon Sticks",
        "alternate_names": ["dalchini", "cassia", "cinnamon bark"],
        "category": "spice_whole",
        "images": {
            "primary": "https://images.unsplash.com/photo-1587049016823-69ef9d68bd44?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Reddish-brown to dark brown",
            "shape": "Rolled bark, hollow tubes/quills",
            "size": "5-10cm long",
            "texture": "Rough bark exterior, smooth inner surface",
            "visual_description": "Rolled tree bark forming hollow tubes. True Ceylon cinnamon is light tan and brittle with many thin layers. Cassia (common cinnamon) is darker, thicker, and harder."
        },
        "similar_to": [
            {
                "name": "Ceylon cinnamon vs Cassia",
                "how_to_differentiate": "Ceylon: light tan, thin, brittle, many layers, subtle flavor. Cassia: dark brown, thick, hard, single layer, stronger flavor. Most stores sell Cassia."
            }
        ],
        "confused_with": [],
        "aroma": "Sweet, warm, woody, distinctively 'cinnamon'",
        "taste": "Sweet, warm, slightly spicy, woody",
        "common_uses": [
            "Indian rice dishes and biryanis",
            "Chai tea",
            "Desserts and baked goods",
            "Mulled drinks and warm beverages"
        ],
        "cuisines": ["Indian", "Middle Eastern", "Mexican", "American"],
        "preparation_tips": [
            "Add to hot oil at the start of cooking",
            "Remove before serving (tough to eat)",
            "Can be reused if not overcooked",
            "Cinnamon powder has different uses than sticks"
        ],
        "storage": {
            "method": "Airtight container",
            "shelf_life": "2-3 years for sticks, 6 months for ground",
            "signs_of_spoilage": ["Loss of aroma", "No flavor when chewed slightly"]
        },
        "substitutes": [
            {"name": "Ground cinnamon", "ratio": "1 stick = 1/2 tsp ground", "notes": "Add ground later in cooking"}
        ],
        "nutritional_highlights": ["May help regulate blood sugar", "Anti-inflammatory properties"],
        "beginner_notes": "Cinnamon sticks are used in savory Indian cooking - not just desserts! Add them to hot oil with other whole spices, and remove before serving. They add warmth without making the dish taste like dessert.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store, Indian markets for better prices",
        "what_to_look_for": "Should smell strongly aromatic. Avoid sticks that look dusty or have no smell.",
        "featured": True,
        "popularity": 85
    },
    
    {
        "name": "cloves",
        "display_name": "Whole Cloves",
        "alternate_names": ["laung", "lavang", "clove buds"],
        "category": "spice_whole",
        "images": {
            "primary": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Dark brown to reddish-brown",
            "shape": "Small nail-shaped buds with round head",
            "size": "1-1.5cm long",
            "texture": "Hard, dry, woody",
            "visual_description": "Look like tiny brown nails - a round head (the bud) with a tapered stem. Very hard and woody. The name 'clove' comes from Latin 'clavus' meaning nail."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Intensely aromatic, warm, sweet, slightly medicinal",
        "taste": "Strong, pungent, warm, numbing, slightly bitter",
        "common_uses": [
            "Indian rice dishes and biryanis",
            "Chai tea and mulled drinks",
            "Ham and meat preparations",
            "Garam masala blend"
        ],
        "cuisines": ["Indian", "Chinese", "Indonesian", "European"],
        "preparation_tips": [
            "Use sparingly - very potent! 3-4 cloves per dish",
            "Add to hot oil with other whole spices",
            "Remove before serving (unpleasant to bite)",
            "Can be stuck into onions for stews"
        ],
        "storage": {
            "method": "Airtight container away from light",
            "shelf_life": "1-2 years whole, 6 months ground",
            "signs_of_spoilage": ["No aroma", "Brittle and crumbly"]
        },
        "substitutes": [
            {"name": "Ground cloves", "ratio": "3 whole = 1/4 tsp ground", "notes": "Ground is more potent"},
            {"name": "Allspice", "ratio": "1:1", "notes": "Similar warm notes"}
        ],
        "nutritional_highlights": ["Natural anesthetic (used for toothache)", "Antibacterial properties"],
        "beginner_notes": "A LITTLE goes a LONG way! Cloves are extremely potent - using too many will overpower your dish with a medicinal taste. Start with 2-3 per dish. Also, biting into a whole clove is unpleasant, so fish them out!",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store spice section",
        "what_to_look_for": "Plump buds with strong aroma. Press the stem - oil should release if fresh.",
        "featured": True,
        "popularity": 75
    },
    
    # ════════════════════════════════════════════════════════
    # FRESH HERBS & VEGETABLES
    # ════════════════════════════════════════════════════════
    
    {
        "name": "fresh coriander",
        "display_name": "Fresh Coriander (Cilantro)",
        "alternate_names": ["cilantro", "coriander leaves", "fresh cilantro", "dhania", "hara dhania", "chinese parsley"],
        "category": "herb_fresh",
        "images": {
            "primary": "https://images.unsplash.com/photo-1767156969831-0beee76fa958?w=400",
            "comparison": [
                {"url": "", "caption": "Fresh bunch"},
                {"url": "", "caption": "Chopped for garnish"}
            ],
            "closeup": ""
        },
        "appearance": {
            "color": "Bright green leaves with thin pale green stems",
            "shape": "Delicate, fan-shaped leaves with serrated edges",
            "size": "Leaves 1-3cm, stems up to 20cm long",
            "texture": "Soft, delicate, slightly feathery leaves",
            "visual_description": "Bright green herb with delicate, feathery leaves. Looks similar to flat-leaf parsley but has more delicate, lacy leaves. The stems are thinner and more tender than parsley."
        },
        "similar_to": [
            {
                "name": "Flat-leaf parsley",
                "how_to_differentiate": "Coriander has more delicate, lacy leaves and a distinctive pungent smell. Parsley leaves are more pointed and have a fresh, grassy smell."
            }
        ],
        "confused_with": [
            {
                "name": "Parsley",
                "warning": "They look similar! Smell them - cilantro has a strong, distinctive aroma (some say soapy). Parsley smells fresh and grassy. Using the wrong one will completely change your dish."
            }
        ],
        "aroma": "Strong, distinctive, citrusy, some say soapy (genetic)",
        "taste": "Bright, citrusy, slightly peppery, polarizing (love it or hate it)",
        "common_uses": [
            "Indian curries as garnish",
            "Mexican salsas and guacamole",
            "Thai and Vietnamese dishes",
            "Chutneys and sauces"
        ],
        "cuisines": ["Indian", "Mexican", "Thai", "Vietnamese", "Middle Eastern"],
        "preparation_tips": [
            "Wash thoroughly - can be sandy",
            "Add at the END of cooking or as garnish",
            "Heat destroys the flavor quickly",
            "Stems are edible and very flavorful - don't throw them away!",
            "Chop just before using for best flavor"
        ],
        "storage": {
            "method": "Wrap in damp paper towel, store in plastic bag in fridge OR stand stems in water like flowers",
            "shelf_life": "5-7 days in fridge",
            "signs_of_spoilage": ["Yellow leaves", "Slimy stems", "Wilted appearance", "Bad smell"]
        },
        "substitutes": [
            {"name": "Parsley + lime zest", "ratio": "Equal parsley + pinch of lime zest", "notes": "Approximates the brightness"},
            {"name": "Thai basil", "ratio": "1:1", "notes": "Different but works in Asian dishes"},
            {"name": "Culantro (if available)", "ratio": "Use less - stronger flavor", "notes": "Same flavor, more intense"}
        ],
        "nutritional_highlights": ["High in vitamin K", "Good source of vitamin C", "Contains antioxidants"],
        "beginner_notes": "Fun fact: Whether you love or hate cilantro is partly genetic! About 4-14% of people have a gene that makes it taste soapy. If you hate it, you're not crazy - it's your genes. Always add fresh cilantro at the END or as garnish, never cook it.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store produce section, Asian/Mexican markets",
        "what_to_look_for": "Bright green leaves, no yellow or wilting. Stems should be firm, not slimy.",
        "featured": True,
        "popularity": 95
    },
    
    {
        "name": "green chili",
        "display_name": "Green Chili (Fresh)",
        "alternate_names": ["green chilli", "hari mirch", "fresh green pepper", "serrano", "thai chili", "finger chili"],
        "category": "vegetable",
        "images": {
            "primary": "https://images.unsplash.com/photo-1763221126437-ebf2339c7b67?w=400",
            "comparison": [
                {"url": "", "caption": "Whole green chilies"},
                {"url": "", "caption": "Sliced green chili"}
            ],
            "closeup": ""
        },
        "appearance": {
            "color": "Bright green (can vary from light to dark green)",
            "shape": "Long, slender, pointed pods",
            "size": "5-10cm long depending on variety",
            "texture": "Smooth, shiny skin, firm flesh",
            "visual_description": "Bright green, elongated peppers with pointed tips. The skin is smooth and shiny. Indian green chilies are typically thinner and longer than jalapeños."
        },
        "similar_to": [
            {
                "name": "Jalapeño",
                "how_to_differentiate": "Jalapeños are thicker, shorter, and have a blunter tip. Indian green chilies are thinner, longer, and more pointed. Jalapeños are milder."
            },
            {
                "name": "Serrano pepper",
                "how_to_differentiate": "Serranos are similar heat level but slightly smaller and more cylindrical. Good substitute for Indian green chilies."
            }
        ],
        "confused_with": [
            {
                "name": "Bell pepper (green)",
                "warning": "Bell peppers are NOT spicy at all! They're much larger with thick walls. If recipe says 'green chili', it means the small hot pepper, not bell pepper."
            }
        ],
        "aroma": "Fresh, slightly grassy, with a hint of heat",
        "taste": "Fresh, bright heat that hits quickly, grassy undertones",
        "common_uses": [
            "Indian curries and dals",
            "Salsas and Mexican dishes",
            "Thai stir-fries",
            "Tempering (tadka) in oil",
            "Fresh in salads and raitas"
        ],
        "cuisines": ["Indian", "Mexican", "Thai", "Vietnamese"],
        "preparation_tips": [
            "Remove seeds and white membrane for less heat",
            "Wear gloves when handling - oils can burn skin",
            "Slit lengthwise to release flavor without too much heat",
            "Don't touch eyes after handling!",
            "Add whole for mild heat, chopped for more heat"
        ],
        "storage": {
            "method": "Refrigerate in paper bag or wrap loosely",
            "shelf_life": "1-2 weeks in fridge",
            "signs_of_spoilage": ["Wrinkled skin", "Soft spots", "Discoloration"]
        },
        "substitutes": [
            {"name": "Serrano pepper", "ratio": "1:1", "notes": "Similar heat level"},
            {"name": "Jalapeño", "ratio": "2 jalapeños = 1 green chili", "notes": "Jalapeños are milder"},
            {"name": "Red chili flakes", "ratio": "1/4 tsp per chili", "notes": "Different flavor but adds heat"}
        ],
        "nutritional_highlights": ["Very high in vitamin C", "Contains capsaicin", "Low calories"],
        "beginner_notes": "The heat is in the seeds and white membrane inside. For mild heat, remove them. For more heat, keep them. ALWAYS wash hands after handling, and never touch your eyes! If you find them too hot, dairy (yogurt, milk) helps neutralize the burn, not water.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store, Indian/Asian markets have more varieties",
        "what_to_look_for": "Firm, shiny, bright green. Avoid soft, wrinkled, or discolored ones.",
        "featured": True,
        "popularity": 90
    },
    
    {
        "name": "ginger",
        "display_name": "Fresh Ginger",
        "alternate_names": ["adrak", "ginger root", "fresh ginger root"],
        "category": "vegetable",
        "images": {
            "primary": "https://images.unsplash.com/photo-1615485500834-bc10199bc727?w=400",
            "comparison": [
                {"url": "", "caption": "Whole ginger root"},
                {"url": "", "caption": "Sliced/grated ginger"}
            ],
            "closeup": ""
        },
        "appearance": {
            "color": "Tan/beige skin, pale yellow flesh inside",
            "shape": "Knobby, irregular root with finger-like branches",
            "size": "Varies - typically 5-15cm pieces",
            "texture": "Thin papery skin, fibrous flesh",
            "visual_description": "Knobby, irregularly shaped root with tan skin. When cut, the inside is pale yellow and fibrous. Young ginger has thinner skin and is less fibrous."
        },
        "similar_to": [
            {
                "name": "Galangal",
                "how_to_differentiate": "Galangal is harder, has pink tinge to skin, and tastes more piney/citrusy. Ginger is softer with tan skin and a sharper, spicier taste."
            }
        ],
        "confused_with": [
            {
                "name": "Galangal",
                "warning": "They're both roots but taste very different! Galangal has harder flesh and piney flavor. They're not interchangeable in recipes."
            }
        ],
        "aroma": "Sharp, warm, slightly sweet, peppery",
        "taste": "Warm, spicy, slightly sweet, with a bite",
        "common_uses": [
            "Indian curries and chai",
            "Stir-fries",
            "Marinades",
            "Ginger tea",
            "Baking (gingerbread)"
        ],
        "cuisines": ["Indian", "Chinese", "Japanese", "Thai", "Caribbean"],
        "preparation_tips": [
            "Peel with a spoon (easier than a knife)",
            "Grate on a microplane for fine texture",
            "Mince for curries, slice for stir-fries",
            "Fresh ginger is MUCH more flavorful than dried",
            "1 inch fresh = 1/4 tsp ground ginger (NOT a good substitute)"
        ],
        "storage": {
            "method": "Unpeeled in fridge, or freeze for longer storage",
            "shelf_life": "3-4 weeks in fridge, months frozen",
            "signs_of_spoilage": ["Moldy spots", "Wrinkled/soft skin", "Gray or mushy flesh"]
        },
        "substitutes": [
            {"name": "Ground ginger", "ratio": "1 inch fresh = 1/4 tsp ground", "notes": "Dried is much less flavorful, use as last resort"},
            {"name": "Ginger paste", "ratio": "1 inch fresh = 1 tsp paste", "notes": "Good substitute, keeps longer"}
        ],
        "nutritional_highlights": ["Anti-inflammatory", "Aids digestion", "Helps with nausea"],
        "beginner_notes": "Peeling tip: Use the edge of a spoon to scrape off the skin - it's way easier than using a knife and wastes less ginger! You can also freeze ginger and grate it directly from frozen - it actually grates easier when frozen.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store produce section",
        "what_to_look_for": "Firm, smooth skin, heavy for its size. Avoid soft, wrinkled, or moldy pieces.",
        "featured": True,
        "popularity": 95
    },
    
    {
        "name": "garlic",
        "display_name": "Garlic",
        "alternate_names": ["lahsun", "garlic cloves", "fresh garlic"],
        "category": "vegetable",
        "images": {
            "primary": "https://images.unsplash.com/photo-1540148426945-6cf22a6b2f85?w=400",
            "comparison": [
                {"url": "", "caption": "Whole garlic bulb"},
                {"url": "", "caption": "Individual cloves"}
            ],
            "closeup": ""
        },
        "appearance": {
            "color": "White papery skin, pale cream/white cloves inside",
            "shape": "Bulb made of individual cloves wrapped in papery skin",
            "size": "Bulb 4-6cm, individual cloves 2-4cm",
            "texture": "Papery outer skin, firm flesh inside cloves",
            "visual_description": "A bulb made up of multiple cloves, each wrapped in papery skin. When you break open a bulb, you'll find 8-12 individual cloves arranged around a central stem."
        },
        "similar_to": [
            {
                "name": "Elephant garlic",
                "how_to_differentiate": "Elephant garlic is MUCH larger (size of an onion) and milder. Regular garlic is smaller and more pungent."
            },
            {
                "name": "Shallots",
                "how_to_differentiate": "Shallots are longer/oval shaped with purple-brown skin. Garlic is rounder with white papery skin."
            }
        ],
        "confused_with": [],
        "aroma": "Pungent, sharp, sulfurous (stronger when crushed)",
        "taste": "Sharp, pungent when raw; sweet, nutty when roasted",
        "common_uses": [
            "Base for almost all savory cooking worldwide",
            "Garlic bread",
            "Roasted garlic spread",
            "Marinades and sauces",
            "Stir-fries and curries"
        ],
        "cuisines": ["Italian", "Indian", "Chinese", "French", "Mediterranean", "Korean"],
        "preparation_tips": [
            "Crush cloves with flat side of knife to loosen skin",
            "Mincing releases more flavor than slicing",
            "Don't burn garlic - it becomes bitter (add after onions)",
            "Roast whole bulbs for sweet, spreadable garlic",
            "Let crushed garlic sit 10 minutes before cooking for health benefits"
        ],
        "storage": {
            "method": "Cool, dry, dark place with ventilation (not fridge!)",
            "shelf_life": "3-5 months whole, 1 week once broken",
            "signs_of_spoilage": ["Green sprouts", "Soft/mushy cloves", "Mold", "Dried out"]
        },
        "substitutes": [
            {"name": "Garlic powder", "ratio": "1 clove = 1/8 tsp powder", "notes": "Convenient but less flavorful"},
            {"name": "Garlic paste", "ratio": "1 clove = 1/2 tsp paste", "notes": "Good substitute, keeps longer"},
            {"name": "Shallots", "ratio": "Not a real substitute", "notes": "Can add similar depth but different flavor"}
        ],
        "nutritional_highlights": ["Immune boosting", "Contains allicin (antimicrobial)", "Heart healthy"],
        "beginner_notes": "Garlic burns easily and becomes bitter, so add it AFTER your onions have started cooking, not at the same time. The green sprout in the center of old garlic is bitter - remove it. Crushing garlic releases more flavor than slicing!",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store produce section",
        "what_to_look_for": "Firm bulbs, tight skin, no soft spots or sprouting. Heavier bulbs are usually fresher.",
        "featured": True,
        "popularity": 100
    },
    
    {
        "name": "onion",
        "display_name": "Onion",
        "alternate_names": ["pyaz", "pyaaz", "yellow onion", "white onion", "red onion"],
        "category": "vegetable",
        "images": {
            "primary": "https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=400",
            "comparison": [
                {"url": "", "caption": "Yellow onion"},
                {"url": "", "caption": "Red onion"}
            ],
            "closeup": ""
        },
        "appearance": {
            "color": "Yellow/brown skin (yellow onion), purple skin (red), white skin (white)",
            "shape": "Round to oval bulb",
            "size": "5-10cm diameter",
            "texture": "Papery outer skin, layers of firm flesh",
            "visual_description": "Round bulbs with papery outer skin. Yellow onions have golden-brown skin and pale yellow layers. Red onions have purple skin and pink-white layers. White onions have white skin throughout."
        },
        "similar_to": [
            {
                "name": "Shallots",
                "how_to_differentiate": "Shallots are smaller, elongated, with milder flavor. Onions are larger and rounder with stronger flavor."
            }
        ],
        "confused_with": [],
        "aroma": "Sharp, pungent (makes you cry!), sulfurous",
        "taste": "Sharp when raw, sweet when cooked, varies by type",
        "common_uses": [
            "Base for almost all savory cooking",
            "Salads (raw)",
            "Caramelized onions",
            "Soups and stews",
            "Curries and stir-fries"
        ],
        "cuisines": ["Universal - used in almost all cuisines"],
        "preparation_tips": [
            "Chill onion before cutting to reduce tears",
            "Cut near running water or ventilation",
            "Yellow onions are best for cooking (caramelize well)",
            "Red onions are best raw in salads",
            "White onions are milder, good for Mexican food"
        ],
        "storage": {
            "method": "Cool, dry, dark place with ventilation (not with potatoes!)",
            "shelf_life": "2-3 months whole",
            "signs_of_spoilage": ["Soft spots", "Mold", "Sprouting", "Strong off-smell"]
        },
        "substitutes": [
            {"name": "Shallots", "ratio": "3 shallots = 1 medium onion", "notes": "Milder, sweeter flavor"},
            {"name": "Leeks", "ratio": "1 leek = 1 onion", "notes": "Milder, good in soups"},
            {"name": "Green onions", "ratio": "6 green onions = 1 small onion", "notes": "More delicate"}
        ],
        "nutritional_highlights": ["Contains quercetin (antioxidant)", "Prebiotic fiber", "Vitamin C"],
        "beginner_notes": "Crying while cutting onions? Try: chilling the onion first, cutting near a vent/fan, or cutting underwater. The tears are caused by sulfur compounds released when you cut through the cells. Cooking breaks these down, which is why cooked onions don't make you cry!",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Firm, dry skin, no soft spots or sprouting. Heavy for size means more moisture inside.",
        "featured": True,
        "popularity": 100
    }
]

async def seed_database():
    """Seed the ingredient guide collection"""
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'moodfood')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🌱 Seeding ingredient guide database...")
    
    # Check if collection exists and has data
    existing_count = await db.ingredient_guide.count_documents({})
    if existing_count > 0:
        print(f"⚠️  Found {existing_count} existing ingredients. Clearing and re-seeding...")
        await db.ingredient_guide.delete_many({})
    
    # Add timestamps and view count to each ingredient
    for ing in INGREDIENT_DATA:
        ing["created_at"] = datetime.now(timezone.utc)
        ing["updated_at"] = datetime.now(timezone.utc)
        ing["view_count"] = 0
    
    # Insert all ingredients
    result = await db.ingredient_guide.insert_many(INGREDIENT_DATA)
    
    print(f"✅ Successfully seeded {len(result.inserted_ids)} ingredients")
    
    # Create indexes
    await db.ingredient_guide.create_index("name")
    await db.ingredient_guide.create_index("alternate_names")
    await db.ingredient_guide.create_index("category")
    await db.ingredient_guide.create_index([("popularity", -1)])
    await db.ingredient_guide.create_index([("featured", 1), ("popularity", -1)])
    
    print("✅ Created indexes")
    
    # Verify
    final_count = await db.ingredient_guide.count_documents({})
    print(f"📊 Total ingredients in database: {final_count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())
