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
            "primary": "https://images.unsplash.com/photo-1666425324466-ff6d57a59370?w=400",
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
            "primary": "https://images.unsplash.com/photo-1665858060923-4fbb69587507?w=400",
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
            "primary": "https://images.unsplash.com/photo-1668295037389-292efc20dafe?w=400",
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
    },
    
    {
        "name": "black pepper",
        "display_name": "Black Pepper",
        "alternate_names": ["kali mirch", "peppercorns", "black peppercorns", "ground black pepper", "pepper"],
        "category": "spice_whole",
        "images": {
            "primary": "https://images.unsplash.com/photo-1599909533601-fc71c5c8c8b9?w=400",
            "comparison": [
                {"url": "", "caption": "Whole peppercorns"},
                {"url": "", "caption": "Ground pepper"}
            ],
            "closeup": ""
        },
        "appearance": {
            "color": "Dark brown to black",
            "shape": "Small, round, wrinkled spheres",
            "size": "3-5mm diameter",
            "texture": "Wrinkled, hard exterior",
            "visual_description": "Small, round, wrinkled dark berries. The wrinkled surface distinguishes them from smooth allspice berries. When ground, produces grey-black powder with visible specks."
        },
        "similar_to": [
            {
                "name": "White pepper",
                "how_to_differentiate": "White pepper is the same berry with outer skin removed - it's tan/cream colored and has milder, more earthy flavor."
            },
            {
                "name": "Allspice",
                "how_to_differentiate": "Allspice berries are larger, smoother, and brown. They taste like cinnamon-clove-nutmeg combined, not peppery."
            }
        ],
        "confused_with": [
            {
                "name": "Allspice",
                "warning": "Despite looking similar, allspice is NOT pepper! It tastes like warm baking spices (cinnamon, clove). Using allspice instead of pepper will completely change your dish."
            }
        ],
        "aroma": "Sharp, pungent, woody, slightly floral",
        "taste": "Sharp, hot, biting heat that hits the back of throat",
        "common_uses": [
            "Universal seasoning in almost all cuisines",
            "Freshly ground on finished dishes",
            "Marinades and rubs",
            "Soups, stews, sauces"
        ],
        "cuisines": ["Universal - used worldwide"],
        "preparation_tips": [
            "Always grind fresh for best flavor",
            "Pre-ground pepper loses flavor quickly",
            "Add at end of cooking for more heat",
            "Add during cooking for deeper, mellower flavor",
            "Toast whole peppercorns to intensify flavor"
        ],
        "storage": {
            "method": "Airtight container, away from light and heat",
            "shelf_life": "Whole: 3-4 years, Ground: 3-4 months",
            "signs_of_spoilage": ["Loss of aroma", "No heat when tasted", "Dusty/musty smell"]
        },
        "substitutes": [
            {"name": "White pepper", "ratio": "1:1", "notes": "Milder, good for light-colored dishes"},
            {"name": "Green peppercorns", "ratio": "1:1", "notes": "Fresher, milder taste"},
            {"name": "Pink peppercorns", "ratio": "1:1", "notes": "Milder, slightly sweet (not true pepper)"}
        ],
        "nutritional_highlights": ["Contains piperine (aids nutrient absorption)", "Antioxidant properties", "Aids digestion"],
        "beginner_notes": "Pre-ground pepper from the store loses flavor within weeks. Invest in a pepper grinder and buy whole peppercorns - the difference is HUGE! A good pepper grinder is one of the best $15 you'll spend on your kitchen.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Buy whole peppercorns, not pre-ground. Look for uniform size and strong aroma when crushed.",
        "featured": True,
        "popularity": 100
    },
    
    {
        "name": "tomato",
        "display_name": "Tomato",
        "alternate_names": ["tamatar", "tomatoes", "fresh tomato", "roma tomato"],
        "category": "vegetable",
        "images": {
            "primary": "https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Red (ripe), green (unripe), also yellow, orange varieties",
            "shape": "Round to slightly oval",
            "size": "5-10cm diameter depending on variety",
            "texture": "Smooth, shiny skin, juicy flesh with seeds",
            "visual_description": "Round red fruit with smooth, shiny skin. Inside has juicy flesh with seed cavities. Roma tomatoes are more oval/elongated."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Fresh, slightly sweet, vegetal",
        "taste": "Sweet-tart, umami, juicy",
        "common_uses": [
            "Base for curries and sauces",
            "Salads",
            "Sandwiches",
            "Soups and stews"
        ],
        "cuisines": ["Italian", "Indian", "Mexican", "Mediterranean", "Universal"],
        "preparation_tips": [
            "Store at room temperature for best flavor (not fridge)",
            "Blanch in hot water to easily peel skin",
            "Remove seeds for smoother sauces",
            "Roma tomatoes have less water - best for cooking"
        ],
        "storage": {
            "method": "Room temperature until ripe, then refrigerate",
            "shelf_life": "5-7 days at room temp, 2 weeks refrigerated",
            "signs_of_spoilage": ["Soft spots", "Mold", "Wrinkled skin", "Off smell"]
        },
        "substitutes": [
            {"name": "Canned tomatoes", "ratio": "1 fresh = 1/2 cup canned", "notes": "Good for cooking"},
            {"name": "Tomato paste + water", "ratio": "1 tbsp paste + 1/2 cup water = 1 tomato", "notes": "For sauces"}
        ],
        "nutritional_highlights": ["High in lycopene (antioxidant)", "Vitamin C", "Potassium"],
        "beginner_notes": "Never store tomatoes in the fridge until they're fully ripe - cold kills the flavor! Keep them on the counter stem-side down. If they're too firm, put them in a paper bag with a banana to ripen faster.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Firm but gives slightly when pressed. Deep red color. Avoid cracks or soft spots.",
        "featured": True,
        "popularity": 100
    },
    
    {
        "name": "salt",
        "display_name": "Salt",
        "alternate_names": ["namak", "table salt", "sea salt", "rock salt", "kosher salt"],
        "category": "other",
        "images": {
            "primary": "https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "White (table salt), pink (Himalayan), grey (Celtic sea salt)",
            "shape": "Fine crystals to coarse flakes",
            "size": "Varies by type",
            "texture": "Crystalline, dissolves in water",
            "visual_description": "White crystalline mineral. Table salt is fine and uniform. Sea salt and kosher salt have larger, irregular flakes. Himalayan salt is pink."
        },
        "similar_to": [],
        "confused_with": [
            {
                "name": "Sugar",
                "warning": "They look similar! Always taste a tiny bit before adding large amounts to avoid a disaster."
            }
        ],
        "aroma": "None",
        "taste": "Salty, enhances other flavors",
        "common_uses": [
            "Seasoning everything",
            "Bringing out flavors",
            "Preserving food",
            "Baking (controls yeast)"
        ],
        "cuisines": ["Universal"],
        "preparation_tips": [
            "Salt during cooking, not just at the end",
            "Kosher salt is less salty by volume than table salt",
            "Add salt to pasta water (should taste like the sea)",
            "Salt draws out moisture - good for browning meat"
        ],
        "storage": {
            "method": "Airtight container, dry place",
            "shelf_life": "Indefinite",
            "signs_of_spoilage": ["Clumping (add rice to absorb moisture)"]
        },
        "substitutes": [
            {"name": "Low-sodium salt", "ratio": "1:1", "notes": "For health reasons"},
            {"name": "Soy sauce", "ratio": "1/4 tsp salt = 1 tsp soy sauce", "notes": "Adds umami too"}
        ],
        "nutritional_highlights": ["Essential mineral", "Needed for nerve and muscle function"],
        "beginner_notes": "Different salts have different saltiness by volume! 1 tsp table salt = 1.5 tsp kosher salt = 2 tsp flaky sea salt. If a recipe doesn't specify, assume table salt. Always taste and adjust!",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Kosher salt is preferred by chefs for its clean taste and easy pinching.",
        "featured": True,
        "popularity": 100
    },
    
    {
        "name": "cooking oil",
        "display_name": "Cooking Oil",
        "alternate_names": ["vegetable oil", "oil", "neutral oil", "canola oil", "sunflower oil"],
        "category": "oil",
        "images": {
            "primary": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Pale yellow to golden (varies by type)",
            "shape": "Liquid",
            "size": "N/A",
            "texture": "Smooth, viscous liquid",
            "visual_description": "Clear to golden liquid. Vegetable and canola oils are very pale. Olive oil is more golden-green. Sesame oil is darker amber."
        },
        "similar_to": [
            {
                "name": "Olive oil",
                "how_to_differentiate": "Olive oil has a distinct fruity/peppery taste and darker color. Neutral oils (vegetable, canola) have no flavor."
            }
        ],
        "confused_with": [],
        "aroma": "Neutral (vegetable/canola), fruity (olive), nutty (sesame)",
        "taste": "Neutral oils have no taste; flavored oils add distinct notes",
        "common_uses": [
            "Frying and sautéing",
            "Baking",
            "Salad dressings",
            "Preventing sticking"
        ],
        "cuisines": ["Universal"],
        "preparation_tips": [
            "Use neutral oils for high-heat cooking",
            "Save olive oil for lower heat or finishing",
            "Oil should shimmer before adding food",
            "Don't let oil smoke - it's burning"
        ],
        "storage": {
            "method": "Cool, dark place, tightly sealed",
            "shelf_life": "6-12 months",
            "signs_of_spoilage": ["Rancid smell", "Off taste", "Darker color"]
        },
        "substitutes": [
            {"name": "Butter", "ratio": "1:1 for sautéing", "notes": "Adds flavor but burns easier"},
            {"name": "Ghee", "ratio": "1:1", "notes": "Higher smoke point than butter"}
        ],
        "nutritional_highlights": ["Source of healthy fats", "Varies by oil type"],
        "beginner_notes": "For most cooking, use a neutral oil (vegetable, canola, sunflower). Save expensive olive oil for salads and finishing dishes. The oil is hot enough when it shimmers and flows easily in the pan.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Check expiration date. Canola and vegetable oils are most versatile for beginners.",
        "featured": True,
        "popularity": 100
    },
    
    # ════════════════════════════════════════════════════════
    # DAIRY & EGGS
    # ════════════════════════════════════════════════════════
    
    {
        "name": "yogurt",
        "display_name": "Yogurt",
        "alternate_names": ["dahi", "curd", "plain yogurt", "greek yogurt"],
        "category": "dairy",
        "images": {
            "primary": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "White to cream",
            "shape": "Thick creamy liquid",
            "size": "N/A",
            "texture": "Smooth, creamy, can be thick or thin",
            "visual_description": "White, creamy dairy product. Greek yogurt is thicker. Indian dahi is slightly thinner. Should be smooth without lumps."
        },
        "similar_to": [
            {"name": "Sour cream", "how_to_differentiate": "Sour cream is thicker and tangier. Yogurt is more fluid and milder."}
        ],
        "confused_with": [],
        "aroma": "Slightly tangy, fresh dairy smell",
        "taste": "Tangy, creamy, slightly sour",
        "common_uses": ["Indian raita", "Marinades (tenderizes meat)", "Smoothies", "Baking", "Sauces"],
        "cuisines": ["Indian", "Middle Eastern", "Greek", "Mediterranean"],
        "preparation_tips": [
            "Bring to room temperature before adding to hot dishes",
            "Add slowly to hot curries to prevent curdling",
            "Whisking before adding prevents curdling",
            "Full-fat yogurt works best for cooking"
        ],
        "storage": {"method": "Refrigerator", "shelf_life": "2-3 weeks", "signs_of_spoilage": ["Mold", "Separation", "Sour smell", "Pink/green tinge"]},
        "substitutes": [
            {"name": "Sour cream", "ratio": "1:1", "notes": "Thicker and tangier"},
            {"name": "Buttermilk", "ratio": "3/4 cup buttermilk = 1 cup yogurt", "notes": "Thinner"}
        ],
        "nutritional_highlights": ["High in protein", "Probiotics for gut health", "Calcium"],
        "beginner_notes": "To prevent yogurt from curdling in hot dishes: temper it first by adding a spoonful of hot liquid to the yogurt, mix well, then add to the dish. Never boil yogurt directly!",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store dairy section",
        "what_to_look_for": "Plain, unsweetened yogurt for cooking. Full-fat for best results.",
        "featured": True,
        "popularity": 90
    },
    
    {
        "name": "butter",
        "display_name": "Butter",
        "alternate_names": ["makhan", "unsalted butter", "salted butter"],
        "category": "dairy",
        "images": {
            "primary": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Pale yellow to golden yellow",
            "shape": "Solid block or sticks",
            "size": "Typically 100g-500g blocks",
            "texture": "Solid when cold, soft at room temp, melts when heated",
            "visual_description": "Pale yellow solid fat. Deeper yellow usually indicates grass-fed cows. Should be smooth without cracks."
        },
        "similar_to": [
            {"name": "Ghee", "how_to_differentiate": "Ghee is clarified butter - golden liquid with no milk solids. Has higher smoke point."},
            {"name": "Margarine", "how_to_differentiate": "Margarine is plant-based, softer, and has different flavor."}
        ],
        "confused_with": [],
        "aroma": "Rich, creamy, slightly sweet",
        "taste": "Rich, creamy, slightly sweet, salty if salted",
        "common_uses": ["Baking", "Sautéing", "Finishing dishes", "Toast", "Sauces"],
        "cuisines": ["French", "European", "American", "Indian"],
        "preparation_tips": [
            "Use unsalted for baking (control salt level)",
            "Room temperature for creaming in baking",
            "Burns easily - use medium heat",
            "Brown butter adds nutty flavor"
        ],
        "storage": {"method": "Refrigerator or freezer", "shelf_life": "1 month fridge, 6 months freezer", "signs_of_spoilage": ["Rancid smell", "Discoloration", "Mold"]},
        "substitutes": [
            {"name": "Ghee", "ratio": "1:1", "notes": "For cooking, not baking"},
            {"name": "Oil", "ratio": "3/4 cup oil = 1 cup butter", "notes": "Different texture in baking"}
        ],
        "nutritional_highlights": ["Fat-soluble vitamins A, D, E", "Saturated fat"],
        "beginner_notes": "For baking, always use UNSALTED butter so you can control the salt. For cooking, either works. Butter burns easily, so use medium heat. If it starts smoking, it's burning!",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Check expiration date. Unsalted for baking, salted for everyday cooking.",
        "featured": True,
        "popularity": 95
    },
    
    {
        "name": "ghee",
        "display_name": "Ghee (Clarified Butter)",
        "alternate_names": ["clarified butter", "desi ghee", "pure ghee"],
        "category": "dairy",
        "images": {
            "primary": "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Golden yellow to amber",
            "shape": "Liquid when warm, solid when cold",
            "size": "N/A",
            "texture": "Smooth, grainy texture when solid",
            "visual_description": "Clear golden liquid when melted. Sets to grainy solid when cold. Much darker than regular butter."
        },
        "similar_to": [
            {"name": "Butter", "how_to_differentiate": "Ghee has milk solids removed, higher smoke point, nuttier flavor."}
        ],
        "confused_with": [],
        "aroma": "Nutty, rich, toasted",
        "taste": "Nutty, rich, deeper than butter",
        "common_uses": ["Indian cooking", "High-heat frying", "Drizzling on rice/roti", "Ayurvedic uses"],
        "cuisines": ["Indian", "Middle Eastern", "South Asian"],
        "preparation_tips": [
            "Can be heated to high temperatures without burning",
            "A little goes a long way - very rich",
            "No need to refrigerate if kept clean",
            "Use for tempering spices"
        ],
        "storage": {"method": "Room temperature or refrigerator", "shelf_life": "3 months room temp, 1 year fridge", "signs_of_spoilage": ["Rancid smell", "Mold", "Off taste"]},
        "substitutes": [
            {"name": "Butter", "ratio": "1:1", "notes": "Lower smoke point"},
            {"name": "Coconut oil", "ratio": "1:1", "notes": "Different flavor"}
        ],
        "nutritional_highlights": ["Lactose-free", "High smoke point", "Contains butyrate"],
        "beginner_notes": "Ghee is butter with the milk solids removed, so it doesn't burn as easily and is often tolerated by lactose-intolerant people. It has an amazing nutty flavor - try it on rice or roti!",
        "difficulty_level": "beginner",
        "where_to_find": "Indian grocery stores, health food stores, regular grocery stores",
        "what_to_look_for": "Should be golden, clear, and have a nutty smell. Avoid if cloudy or smells off.",
        "featured": True,
        "popularity": 85
    },
    
    {
        "name": "cream",
        "display_name": "Heavy Cream",
        "alternate_names": ["heavy cream", "whipping cream", "fresh cream", "malai"],
        "category": "dairy",
        "images": {
            "primary": "https://images.unsplash.com/photo-1587657249780-c27b2c1e6790?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "White to off-white",
            "shape": "Thick liquid",
            "size": "N/A",
            "texture": "Thick, pourable liquid that can be whipped",
            "visual_description": "Thick white liquid, much thicker than milk. Heavy cream is thickest, light cream is thinner."
        },
        "similar_to": [
            {"name": "Half and half", "how_to_differentiate": "Half and half is thinner (half milk, half cream). Won't whip."}
        ],
        "confused_with": [],
        "aroma": "Rich, milky, slightly sweet",
        "taste": "Rich, creamy, slightly sweet",
        "common_uses": ["Curries and gravies", "Whipped cream", "Pasta sauces", "Soups", "Desserts"],
        "cuisines": ["Indian", "Italian", "French", "Universal"],
        "preparation_tips": [
            "Can be boiled without curdling (unlike milk)",
            "Chill bowl and beaters for whipping",
            "Add at end of cooking for richness",
            "Heavy cream = 36%+ fat for whipping"
        ],
        "storage": {"method": "Refrigerator", "shelf_life": "1-2 weeks", "signs_of_spoilage": ["Sour smell", "Curdling", "Mold"]},
        "substitutes": [
            {"name": "Coconut cream", "ratio": "1:1", "notes": "Dairy-free, adds coconut flavor"},
            {"name": "Milk + butter", "ratio": "3/4 cup milk + 1/4 cup butter = 1 cup cream", "notes": "For cooking only"}
        ],
        "nutritional_highlights": ["High in fat", "Source of vitamin A"],
        "beginner_notes": "Unlike yogurt, cream can be boiled without curdling, making it great for rich gravies. For Indian restaurant-style curries, cream is the secret to that silky, rich texture!",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store dairy section",
        "what_to_look_for": "Heavy cream or whipping cream for cooking. Check fat percentage - higher is richer.",
        "featured": True,
        "popularity": 80
    },
    
    {
        "name": "paneer",
        "display_name": "Paneer (Indian Cottage Cheese)",
        "alternate_names": ["cottage cheese", "indian cheese", "panir"],
        "category": "dairy",
        "images": {
            "primary": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "White to cream",
            "shape": "Firm block that can be cubed",
            "size": "Sold in 200g-400g blocks",
            "texture": "Firm, slightly crumbly, doesn't melt",
            "visual_description": "White, firm cheese that can be cut into cubes. Does NOT melt like other cheeses. Has a mild, milky appearance."
        },
        "similar_to": [
            {"name": "Tofu", "how_to_differentiate": "Tofu is soy-based, softer, and more bland. Paneer is dairy-based and richer."},
            {"name": "Halloumi", "how_to_differentiate": "Halloumi is saltier and squeakier. Can substitute in some dishes."}
        ],
        "confused_with": [
            {"name": "Feta", "warning": "Feta is salty and crumbly. Paneer is mild and firm. They're not interchangeable!"}
        ],
        "aroma": "Mild, fresh milk smell",
        "taste": "Mild, milky, slightly sweet, absorbs flavors well",
        "common_uses": ["Palak paneer", "Paneer tikka", "Matar paneer", "Kadai paneer", "Grilled/fried as snack"],
        "cuisines": ["Indian", "South Asian"],
        "preparation_tips": [
            "Fry cubes until golden for better texture",
            "Soak in warm water to soften if too firm",
            "Doesn't melt - holds shape in curries",
            "Can be made at home with milk and lemon"
        ],
        "storage": {"method": "Refrigerator, submerged in water", "shelf_life": "1 week (change water daily)", "signs_of_spoilage": ["Sour smell", "Slimy texture", "Yellow color"]},
        "substitutes": [
            {"name": "Halloumi", "ratio": "1:1", "notes": "Saltier, good for grilling"},
            {"name": "Extra-firm tofu", "ratio": "1:1", "notes": "Vegan option, press well first"}
        ],
        "nutritional_highlights": ["High protein", "Good calcium source", "Complete protein"],
        "beginner_notes": "Paneer doesn't melt - that's the whole point! It holds its shape in hot curries. For best results, fry the cubes in oil until golden before adding to curry. This gives them a nice outer texture.",
        "difficulty_level": "beginner",
        "where_to_find": "Indian grocery stores, some regular grocery stores",
        "what_to_look_for": "Fresh, white color, firm texture. Avoid if yellowing or slimy.",
        "featured": True,
        "popularity": 85
    },
    
    {
        "name": "milk",
        "display_name": "Milk",
        "alternate_names": ["doodh", "whole milk", "full cream milk"],
        "category": "dairy",
        "images": {
            "primary": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "White, opaque",
            "shape": "Liquid",
            "size": "N/A",
            "texture": "Thin, pourable liquid",
            "visual_description": "White, opaque liquid. Whole milk is slightly more opaque than skim milk."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Fresh, slightly sweet",
        "taste": "Mild, slightly sweet, creamy",
        "common_uses": ["Chai", "Baking", "Curries", "Desserts", "Drinking"],
        "cuisines": ["Universal"],
        "preparation_tips": [
            "Don't boil directly in curries - can curdle",
            "Whole milk gives richest results",
            "Warm milk before adding to hot dishes",
            "Scald milk for bread recipes"
        ],
        "storage": {"method": "Refrigerator", "shelf_life": "5-7 days after opening", "signs_of_spoilage": ["Sour smell", "Curdling", "Off taste"]},
        "substitutes": [
            {"name": "Plant milk", "ratio": "1:1", "notes": "Oat milk is creamiest"},
            {"name": "Cream + water", "ratio": "1/2 cup cream + 1/2 cup water = 1 cup milk", "notes": "For cooking"}
        ],
        "nutritional_highlights": ["Calcium", "Vitamin D", "Protein"],
        "beginner_notes": "For Indian cooking, whole milk (full cream) gives best results. When adding milk to hot dishes, warm it first and add slowly to prevent curdling.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Check expiration date. Whole milk for cooking, any type for drinking.",
        "featured": True,
        "popularity": 95
    },
    
    {
        "name": "egg",
        "display_name": "Eggs",
        "alternate_names": ["anda", "eggs", "chicken egg"],
        "category": "other",
        "images": {
            "primary": "https://images.unsplash.com/photo-1491524062933-cb0289261700?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "White or brown shell, yellow yolk, clear white",
            "shape": "Oval",
            "size": "About 5cm long",
            "texture": "Hard shell, liquid inside that sets when cooked",
            "visual_description": "Oval with hard outer shell. Inside has yellow yolk and clear white (albumen) that turns opaque white when cooked."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Mild when fresh, sulfurous when old",
        "taste": "Mild, rich yolk, neutral white",
        "common_uses": ["Scrambled/fried/boiled", "Baking", "Binding agent", "Egg curry", "Coating for frying"],
        "cuisines": ["Universal"],
        "preparation_tips": [
            "Room temperature eggs beat better for baking",
            "Fresh eggs sink in water, old eggs float",
            "Crack into separate bowl first to check freshness",
            "Add salt after cooking scrambled eggs (not before)"
        ],
        "storage": {"method": "Refrigerator", "shelf_life": "3-5 weeks", "signs_of_spoilage": ["Float in water", "Bad smell when cracked", "Runny/watery white"]},
        "substitutes": [
            {"name": "Flax egg", "ratio": "1 tbsp ground flax + 3 tbsp water = 1 egg", "notes": "For baking only"},
            {"name": "Banana", "ratio": "1/4 mashed banana = 1 egg", "notes": "For baking, adds sweetness"}
        ],
        "nutritional_highlights": ["Complete protein", "Vitamin B12", "Choline"],
        "beginner_notes": "The freshness test: Put egg in water. If it sinks flat, it's very fresh. If it stands upright, use soon. If it floats, throw it away! Brown and white eggs taste the same - color depends on the hen breed.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Check for cracks. Large eggs are standard in recipes.",
        "featured": True,
        "popularity": 95
    },
    
    # ════════════════════════════════════════════════════════
    # MORE VEGETABLES
    # ════════════════════════════════════════════════════════
    
    {
        "name": "potato",
        "display_name": "Potato",
        "alternate_names": ["aloo", "potatoes", "russet potato", "yukon gold"],
        "category": "vegetable",
        "images": {
            "primary": "https://images.unsplash.com/photo-1518977676601-b53f82ber633?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Brown/tan skin, white/yellow flesh",
            "shape": "Round to oval, irregular",
            "size": "5-10cm",
            "texture": "Firm, starchy flesh",
            "visual_description": "Round to oval tubers with thin brown skin. Flesh is white to yellow depending on variety. Should be firm without sprouts."
        },
        "similar_to": [
            {"name": "Sweet potato", "how_to_differentiate": "Sweet potatoes are orange inside, sweeter, and have different texture when cooked."}
        ],
        "confused_with": [],
        "aroma": "Earthy",
        "taste": "Mild, starchy, earthy",
        "common_uses": ["Aloo curry", "Fries", "Mashed", "Roasted", "In stews"],
        "cuisines": ["Indian", "Universal"],
        "preparation_tips": [
            "Store in cool, dark place (not fridge)",
            "Green parts are toxic - cut them off",
            "Soak cut potatoes in water to prevent browning",
            "Waxy potatoes hold shape, starchy potatoes mash well"
        ],
        "storage": {"method": "Cool, dark, dry place (not fridge)", "shelf_life": "2-3 weeks", "signs_of_spoilage": ["Sprouts", "Green color", "Soft spots", "Wrinkled skin"]},
        "substitutes": [
            {"name": "Sweet potato", "ratio": "1:1", "notes": "Different flavor and texture"},
            {"name": "Cauliflower", "ratio": "1:1", "notes": "Low-carb substitute for mashed"}
        ],
        "nutritional_highlights": ["Good source of potassium", "Vitamin C", "Fiber when eaten with skin"],
        "beginner_notes": "Green potatoes contain solanine (toxic) - don't eat the green parts! Sprouted potatoes are safe if you remove the sprouts, but very sprouted ones should be discarded. Store away from onions - they make each other spoil faster.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Firm, no sprouts, no green patches, no soft spots.",
        "featured": True,
        "popularity": 100
    },
    
    {
        "name": "carrot",
        "display_name": "Carrot",
        "alternate_names": ["gajar", "carrots"],
        "category": "vegetable",
        "images": {
            "primary": "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Orange (also purple, yellow, white varieties)",
            "shape": "Long, tapered root",
            "size": "15-20cm long",
            "texture": "Crisp, firm when raw; soft when cooked",
            "visual_description": "Long, tapered orange root vegetable. Should be firm and bright in color. Green tops indicate freshness."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Sweet, earthy",
        "taste": "Sweet, earthy, becomes sweeter when cooked",
        "common_uses": ["Gajar halwa", "Salads", "Stir-fries", "Soups", "Juicing"],
        "cuisines": ["Indian", "Universal"],
        "preparation_tips": [
            "Peel or scrub well before using",
            "Thin end cooks faster than thick end",
            "Cut uniformly for even cooking",
            "Roasting caramelizes natural sugars"
        ],
        "storage": {"method": "Refrigerator in plastic bag", "shelf_life": "2-3 weeks", "signs_of_spoilage": ["Bendy/limp", "Slimy", "Black spots"]},
        "substitutes": [
            {"name": "Parsnip", "ratio": "1:1", "notes": "Similar texture, sweeter"},
            {"name": "Sweet potato", "ratio": "1:1", "notes": "For soups/stews"}
        ],
        "nutritional_highlights": ["Very high in vitamin A (beta-carotene)", "Good for eye health", "Fiber"],
        "beginner_notes": "Carrots are naturally sweet - they're great for adding sweetness to savory dishes without sugar. Baby carrots are just regular carrots cut small, not a different variety!",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Firm, bright orange, no cracks. Avoid bendy carrots.",
        "featured": True,
        "popularity": 90
    },
    
    {
        "name": "spinach",
        "display_name": "Spinach",
        "alternate_names": ["palak", "baby spinach", "spinach leaves"],
        "category": "vegetable",
        "images": {
            "primary": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Dark green",
            "shape": "Oval leaves with stems",
            "size": "Varies - baby spinach smaller",
            "texture": "Tender, wilts quickly when cooked",
            "visual_description": "Dark green leafy vegetable with tender leaves. Baby spinach has smaller, more tender leaves. Regular spinach has larger leaves with thicker stems."
        },
        "similar_to": [
            {"name": "Swiss chard", "how_to_differentiate": "Swiss chard has thicker stems (often colorful) and more bitter taste."}
        ],
        "confused_with": [],
        "aroma": "Fresh, green, grassy",
        "taste": "Mild, slightly earthy, becomes sweeter when cooked",
        "common_uses": ["Palak paneer", "Saag", "Salads", "Smoothies", "Pasta"],
        "cuisines": ["Indian", "Mediterranean", "Universal"],
        "preparation_tips": [
            "Wash very thoroughly - can be sandy",
            "Wilts dramatically - use more than you think",
            "Cook briefly to retain color and nutrients",
            "Remove thick stems for smoother texture"
        ],
        "storage": {"method": "Refrigerator in dry paper towel", "shelf_life": "5-7 days", "signs_of_spoilage": ["Yellow leaves", "Slimy", "Bad smell"]},
        "substitutes": [
            {"name": "Kale", "ratio": "1:1", "notes": "Tougher, more bitter, needs longer cooking"},
            {"name": "Swiss chard", "ratio": "1:1", "notes": "Similar but slightly bitter"}
        ],
        "nutritional_highlights": ["Iron", "Vitamin K", "Folate", "Very low calorie"],
        "beginner_notes": "Spinach shrinks A LOT when cooked - a huge bag will become a tiny amount! For palak paneer, you need way more spinach than you'd think. Always wash thoroughly - spinach can hide a lot of sand in the leaves.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Bright green, crisp leaves. Avoid yellow or slimy leaves.",
        "featured": True,
        "popularity": 85
    },
    
    {
        "name": "cauliflower",
        "display_name": "Cauliflower",
        "alternate_names": ["gobhi", "phool gobhi"],
        "category": "vegetable",
        "images": {
            "primary": "https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "White (also purple, orange, green varieties)",
            "shape": "Round head made of tight florets",
            "size": "15-20cm diameter",
            "texture": "Firm, dense florets",
            "visual_description": "White, compact head made of many small florets. Surrounded by green leaves. Should be firm and bright white without brown spots."
        },
        "similar_to": [
            {"name": "Broccoli", "how_to_differentiate": "Broccoli is green with looser florets on long stems. Cauliflower is white and more compact."}
        ],
        "confused_with": [],
        "aroma": "Mild, slightly sulfurous when cooked",
        "taste": "Mild, slightly nutty, absorbs flavors well",
        "common_uses": ["Gobhi curry", "Aloo gobhi", "Roasted", "Cauliflower rice", "Paratha stuffing"],
        "cuisines": ["Indian", "Universal"],
        "preparation_tips": [
            "Cut into similar-sized florets for even cooking",
            "Don't overcook - becomes mushy",
            "Roasting brings out sweetness",
            "Core is edible - don't waste it"
        ],
        "storage": {"method": "Refrigerator", "shelf_life": "1 week", "signs_of_spoilage": ["Brown spots", "Soft", "Bad smell"]},
        "substitutes": [
            {"name": "Broccoli", "ratio": "1:1", "notes": "Different flavor but similar texture"},
            {"name": "Romanesco", "ratio": "1:1", "notes": "Similar but more nutty"}
        ],
        "nutritional_highlights": ["Vitamin C", "Vitamin K", "Low carb alternative to rice/potato"],
        "beginner_notes": "Cauliflower is incredibly versatile - you can rice it, mash it, roast it, or use it in curries. It absorbs flavors really well, which is why it's great in spiced dishes like aloo gobhi.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Firm, white, compact head. Avoid brown spots or soft areas.",
        "featured": True,
        "popularity": 80
    },
    
    {
        "name": "peas",
        "display_name": "Green Peas",
        "alternate_names": ["matar", "green peas", "frozen peas", "garden peas"],
        "category": "vegetable",
        "images": {
            "primary": "https://images.unsplash.com/photo-1587735243475-46f39636076a?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Bright green",
            "shape": "Small round spheres",
            "size": "5-8mm diameter",
            "texture": "Firm, slightly starchy",
            "visual_description": "Small, bright green spheres. Fresh peas come in pods. Frozen peas are loose and slightly darker green."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Fresh, sweet, grassy",
        "taste": "Sweet, slightly starchy, fresh",
        "common_uses": ["Matar paneer", "Pulao", "Samosas", "Mixed vegetables", "Soups"],
        "cuisines": ["Indian", "Universal"],
        "preparation_tips": [
            "Frozen peas are often better than 'fresh' (frozen at peak)",
            "Don't overcook - they turn mushy and grey",
            "Add at end of cooking to keep color",
            "Fresh peas need shelling from pods"
        ],
        "storage": {"method": "Freezer (frozen), Refrigerator (fresh)", "shelf_life": "6 months frozen, 3-4 days fresh", "signs_of_spoilage": ["Yellowing", "Wrinkled", "Slimy"]},
        "substitutes": [
            {"name": "Edamame", "ratio": "1:1", "notes": "Firmer, more protein"},
            {"name": "Green beans", "ratio": "1:1", "notes": "Different texture"}
        ],
        "nutritional_highlights": ["Good protein for a vegetable", "Fiber", "Vitamin C"],
        "beginner_notes": "Frozen peas are actually better than fresh for most uses - they're frozen right after picking so they retain more sweetness and nutrients. No need to thaw before using, just add directly to your dish!",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store (frozen section for best quality)",
        "what_to_look_for": "Frozen: no ice crystals (sign of thawing). Fresh: bright green, firm pods.",
        "featured": True,
        "popularity": 85
    },
    
    {
        "name": "bell pepper",
        "display_name": "Bell Pepper (Capsicum)",
        "alternate_names": ["capsicum", "shimla mirch", "sweet pepper", "green pepper", "red pepper"],
        "category": "vegetable",
        "images": {
            "primary": "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Green, red, yellow, orange",
            "shape": "Blocky, hollow with seeds inside",
            "size": "8-12cm",
            "texture": "Crisp, crunchy flesh",
            "visual_description": "Large, blocky peppers with glossy skin. Green is unripe (slightly bitter), red/yellow/orange are ripe and sweeter. Hollow inside with white membrane and seeds."
        },
        "similar_to": [],
        "confused_with": [
            {"name": "Hot peppers", "warning": "Bell peppers are NOT spicy at all! Don't confuse with hot peppers that might look similar."}
        ],
        "aroma": "Fresh, slightly sweet",
        "taste": "Sweet (red/yellow), slightly bitter (green), crisp",
        "common_uses": ["Stir-fries", "Salads", "Stuffed peppers", "Fajitas", "Kadai dishes"],
        "cuisines": ["Indian", "Mexican", "Chinese", "Mediterranean"],
        "preparation_tips": [
            "Remove seeds and white membrane",
            "Red/yellow are sweeter than green",
            "Cut against the grain for crispier texture",
            "Roast to remove skin and sweeten"
        ],
        "storage": {"method": "Refrigerator", "shelf_life": "1-2 weeks", "signs_of_spoilage": ["Soft spots", "Wrinkled skin", "Mold"]},
        "substitutes": [
            {"name": "Poblano pepper", "ratio": "1:1", "notes": "Slightly spicy, good for roasting"}
        ],
        "nutritional_highlights": ["Very high in vitamin C", "Vitamin A (red peppers)", "Low calorie"],
        "beginner_notes": "Bell peppers are NOT spicy - they're sweet! Green ones are just unripe red peppers, which is why they're slightly bitter. Red and yellow peppers cost more because they take longer to grow.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Firm, glossy skin, no wrinkles or soft spots.",
        "featured": True,
        "popularity": 80
    },
    
    {
        "name": "cabbage",
        "display_name": "Cabbage",
        "alternate_names": ["patta gobhi", "band gobhi", "green cabbage"],
        "category": "vegetable",
        "images": {
            "primary": "https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Green or purple",
            "shape": "Round, compact head of layered leaves",
            "size": "15-25cm diameter",
            "texture": "Crisp, crunchy, densely layered",
            "visual_description": "Tight, round head made of many layered leaves. Green cabbage is most common. Red/purple cabbage is sweeter. Should feel heavy for its size."
        },
        "similar_to": [
            {"name": "Lettuce", "how_to_differentiate": "Lettuce is much looser and more delicate. Cabbage is dense and crunchy."}
        ],
        "confused_with": [],
        "aroma": "Mild, slightly sulfurous when cooked",
        "taste": "Mild, slightly sweet, peppery when raw",
        "common_uses": ["Coleslaw", "Stir-fries", "Stuffed cabbage", "Soups", "Fermented (sauerkraut, kimchi)"],
        "cuisines": ["Indian", "Chinese", "German", "Korean", "Universal"],
        "preparation_tips": [
            "Remove outer leaves if damaged",
            "Cut in half, remove core, then slice",
            "Massage raw cabbage with salt for salads",
            "Don't overcook - becomes smelly and mushy"
        ],
        "storage": {"method": "Refrigerator", "shelf_life": "2-3 weeks", "signs_of_spoilage": ["Outer leaves wilted", "Slimy", "Bad smell"]},
        "substitutes": [
            {"name": "Napa cabbage", "ratio": "1:1", "notes": "More delicate, better for Asian dishes"},
            {"name": "Brussels sprouts (shredded)", "ratio": "1:1", "notes": "Similar flavor"}
        ],
        "nutritional_highlights": ["Vitamin C", "Vitamin K", "Very low calorie"],
        "beginner_notes": "Cabbage lasts forever in the fridge - it's a great economical vegetable. Shred it for quick stir-fries, or cut into wedges and roast for a different texture. The outer leaves protect the inner ones, so just peel and discard damaged ones.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Heavy for size, tight leaves, no brown spots.",
        "featured": True,
        "popularity": 75
    },
    
    {
        "name": "eggplant",
        "display_name": "Eggplant (Brinjal/Aubergine)",
        "alternate_names": ["brinjal", "baingan", "aubergine"],
        "category": "vegetable",
        "images": {
            "primary": "https://images.unsplash.com/photo-1528826007177-f38517ce9a8a?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Deep purple (also white, striped varieties)",
            "shape": "Oval to elongated",
            "size": "10-25cm long",
            "texture": "Firm, spongy flesh",
            "visual_description": "Glossy, deep purple skin with green stem cap. Flesh is white/cream with small seeds. Should be firm but give slightly when pressed."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Mild, earthy",
        "taste": "Mild, slightly bitter when raw, creamy when cooked",
        "common_uses": ["Baingan bharta", "Baba ganoush", "Grilled", "Curries", "Stir-fries"],
        "cuisines": ["Indian", "Mediterranean", "Middle Eastern", "Italian"],
        "preparation_tips": [
            "Salt and rest to remove bitterness (optional for fresh ones)",
            "Absorbs oil like a sponge - use less than you think",
            "Roasting over flame adds smoky flavor",
            "Skin is edible but can be tough"
        ],
        "storage": {"method": "Refrigerator", "shelf_life": "1 week", "signs_of_spoilage": ["Soft spots", "Brown flesh", "Wrinkled skin"]},
        "substitutes": [
            {"name": "Zucchini", "ratio": "1:1", "notes": "Different flavor, similar texture when cooked"},
            {"name": "Portobello mushroom", "ratio": "1:1", "notes": "For grilling/roasting"}
        ],
        "nutritional_highlights": ["Low calorie", "Fiber", "Antioxidants in skin"],
        "beginner_notes": "Eggplant acts like a sponge with oil - it will absorb a lot! Either use very little oil, or salt and press the eggplant first to reduce absorption. For baingan bharta, roast directly over a flame for smoky flavor.",
        "difficulty_level": "intermediate",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Firm, glossy skin, no soft spots. Light ones are younger and less bitter.",
        "featured": True,
        "popularity": 75
    },
    
    {
        "name": "cucumber",
        "display_name": "Cucumber",
        "alternate_names": ["kheera", "kakdi"],
        "category": "vegetable",
        "images": {
            "primary": "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Green skin, pale green flesh",
            "shape": "Long, cylindrical",
            "size": "15-25cm long",
            "texture": "Crisp, watery",
            "visual_description": "Long, green vegetable with watery, crunchy flesh. English cucumbers are longer with thin skin. Persian cucumbers are smaller. Regular cucumbers have thicker, waxy skin."
        },
        "similar_to": [
            {"name": "Zucchini", "how_to_differentiate": "Zucchini is a squash, darker green, and must be cooked. Cucumber is eaten raw."}
        ],
        "confused_with": [],
        "aroma": "Fresh, light, watery",
        "taste": "Mild, refreshing, slightly sweet",
        "common_uses": ["Raita", "Salads", "Pickles", "Sandwiches", "Cooling side dish"],
        "cuisines": ["Indian", "Universal"],
        "preparation_tips": [
            "Peel if skin is thick/waxy",
            "Salt to draw out water for salads",
            "Seeds can be scooped out if watery",
            "English cucumbers don't need peeling"
        ],
        "storage": {"method": "Refrigerator", "shelf_life": "1 week", "signs_of_spoilage": ["Soft spots", "Slimy", "Yellow color"]},
        "substitutes": [
            {"name": "Zucchini (raw)", "ratio": "1:1", "notes": "Firmer, less watery"}
        ],
        "nutritional_highlights": ["Very hydrating", "Low calorie", "Vitamin K"],
        "beginner_notes": "Cucumbers are mostly water, making them super refreshing. For raita, salt the cucumber and squeeze out water first, or your raita will become watery. English (seedless) cucumbers are less watery.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Firm all over, no soft spots or yellowing.",
        "featured": True,
        "popularity": 80
    },
    
    {
        "name": "lemon",
        "display_name": "Lemon",
        "alternate_names": ["nimbu", "lime", "lemon juice"],
        "category": "fruit",
        "images": {
            "primary": "https://images.unsplash.com/photo-1582087463261-ddea03f80e5d?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Bright yellow (lemon) or green (lime)",
            "shape": "Oval with pointed ends",
            "size": "5-8cm",
            "texture": "Firm, thick skin, juicy interior",
            "visual_description": "Yellow citrus fruit with thick, dimpled skin. Limes are smaller and green. In India, 'nimbu' often refers to small limes/key limes."
        },
        "similar_to": [
            {"name": "Lime", "how_to_differentiate": "Limes are smaller, green, and more tart. Lemons are yellow and slightly sweeter."}
        ],
        "confused_with": [],
        "aroma": "Bright, citrusy, fresh",
        "taste": "Sour, tangy, bright",
        "common_uses": ["Finishing dishes", "Marinades", "Lemonade", "Salad dressings", "Preserving color"],
        "cuisines": ["Universal"],
        "preparation_tips": [
            "Room temperature lemons yield more juice",
            "Roll on counter before juicing",
            "Zest before juicing",
            "Add lemon juice at end of cooking to preserve flavor"
        ],
        "storage": {"method": "Room temperature or refrigerator", "shelf_life": "1 week room temp, 3-4 weeks fridge", "signs_of_spoilage": ["Soft spots", "Mold", "Dried out"]},
        "substitutes": [
            {"name": "Lime", "ratio": "1:1", "notes": "Slightly more tart"},
            {"name": "Vinegar", "ratio": "1/2 amount", "notes": "For acidity only, different flavor"}
        ],
        "nutritional_highlights": ["Very high in vitamin C", "Citric acid aids digestion"],
        "beginner_notes": "Always add lemon/lime juice at the END of cooking - heat destroys the fresh flavor. A squeeze of lemon can brighten up almost any savory dish. In India, the small limes (nimbu) are interchangeable with lemons.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Heavy for size (more juice), firm, bright color.",
        "featured": True,
        "popularity": 90
    },
    
    # ════════════════════════════════════════════════════════
    # MORE SPICES
    # ════════════════════════════════════════════════════════
    
    {
        "name": "fennel seeds",
        "display_name": "Fennel Seeds",
        "alternate_names": ["saunf", "anise seeds"],
        "category": "spice_whole",
        "images": {
            "primary": "https://images.unsplash.com/photo-1599909533601-fc71c5c8c8b9?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Greenish-yellow to pale green",
            "shape": "Elongated oval, ridged",
            "size": "4-8mm long",
            "texture": "Smooth with ridges",
            "visual_description": "Pale green, elongated seeds with visible ridges. Larger and lighter colored than cumin. Often served after Indian meals as a mouth freshener."
        },
        "similar_to": [
            {"name": "Cumin seeds", "how_to_differentiate": "Cumin is darker brown and smaller. Fennel is greenish and larger. Fennel tastes like licorice, cumin is earthy."},
            {"name": "Anise seeds", "how_to_differentiate": "Anise seeds are smaller and star-shaped. Similar licorice flavor but more intense."}
        ],
        "confused_with": [],
        "aroma": "Sweet, licorice-like, aromatic",
        "taste": "Sweet, licorice/anise flavor, slightly cooling",
        "common_uses": ["Indian sweets", "Mouth freshener after meals", "Bengali five-spice (panch phoron)", "Sausages", "Fish dishes"],
        "cuisines": ["Indian", "Italian", "Mediterranean"],
        "preparation_tips": [
            "Dry roast to bring out flavor",
            "Can be chewed raw after meals",
            "Use sparingly - strong flavor",
            "Pairs well with fish"
        ],
        "storage": {"method": "Airtight container", "shelf_life": "1-2 years", "signs_of_spoilage": ["Loss of aroma", "Faded color"]},
        "substitutes": [
            {"name": "Anise seeds", "ratio": "Use less - more intense", "notes": "Similar licorice flavor"},
            {"name": "Caraway seeds", "ratio": "1:1", "notes": "Different but similar family"}
        ],
        "nutritional_highlights": ["Aids digestion", "Freshens breath naturally"],
        "beginner_notes": "Fennel has a distinctive licorice flavor that's polarizing - people either love it or hate it. In Indian restaurants, you'll often find a bowl of saunf (sometimes sugar-coated) at the exit as a digestive and breath freshener.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store, Indian markets",
        "what_to_look_for": "Pale green color, strong sweet aroma.",
        "featured": True,
        "popularity": 70
    },
    
    {
        "name": "fenugreek seeds",
        "display_name": "Fenugreek Seeds",
        "alternate_names": ["methi seeds", "methi dana"],
        "category": "spice_whole",
        "images": {
            "primary": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Yellow-brown to tan",
            "shape": "Small, hard, angular stones",
            "size": "3-4mm",
            "texture": "Very hard, stone-like",
            "visual_description": "Small, hard, yellowish-brown seeds that look like tiny stones. Very angular/irregular shape. Extremely hard - can break teeth if bitten!"
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Strong, maple-like, slightly bitter",
        "taste": "Bitter when raw, maple-like when cooked, potent",
        "common_uses": ["Indian pickles", "Curry powders", "South Indian sambar", "Tempering"],
        "cuisines": ["Indian", "Ethiopian", "Middle Eastern"],
        "preparation_tips": [
            "Use VERY sparingly - extremely potent",
            "Add to hot oil at start (temper)",
            "Don't burn - becomes very bitter",
            "Soak overnight to soften"
        ],
        "storage": {"method": "Airtight container", "shelf_life": "2-3 years", "signs_of_spoilage": ["Loss of aroma"]},
        "substitutes": [
            {"name": "Maple syrup + mustard", "ratio": "Tiny amount for flavor approximation", "notes": "Not exact but captures essence"}
        ],
        "nutritional_highlights": ["May help blood sugar control", "High in fiber"],
        "beginner_notes": "Fenugreek is EXTREMELY potent and bitter - use only a tiny amount (like 5-10 seeds). Too much will make your dish taste medicinal and bitter. It smells like maple syrup, which is actually used to detect fenugreek!",
        "difficulty_level": "intermediate",
        "where_to_find": "Indian grocery stores",
        "what_to_look_for": "Hard, intact seeds. Should smell like maple syrup.",
        "featured": True,
        "popularity": 65
    },
    
    {
        "name": "fenugreek leaves",
        "display_name": "Fenugreek Leaves (Kasuri Methi)",
        "alternate_names": ["kasuri methi", "dried fenugreek", "methi leaves"],
        "category": "herb_dried",
        "images": {
            "primary": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Dried green, olive-brown",
            "shape": "Small, crumbled dried leaves",
            "size": "Crumbled pieces",
            "texture": "Dry, crumbly, papery",
            "visual_description": "Dried, crumbled green-brown leaves. Much milder than fenugreek seeds. Has a distinctive sweet, hay-like aroma."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Sweet, hay-like, aromatic, slightly bitter",
        "taste": "Slightly bitter, aromatic, mellows when cooked",
        "common_uses": ["Indian curries (butter chicken!)", "Naan bread", "Finishing spice", "Parathas"],
        "cuisines": ["Indian", "Pakistani"],
        "preparation_tips": [
            "Crush between palms before adding to release aroma",
            "Add at end of cooking or just before serving",
            "A little goes a long way",
            "Essential for authentic butter chicken flavor"
        ],
        "storage": {"method": "Airtight container away from light", "shelf_life": "6 months - 1 year", "signs_of_spoilage": ["Loss of aroma", "Dusty smell"]},
        "substitutes": [
            {"name": "Fresh fenugreek leaves", "ratio": "1 tbsp dried = 3 tbsp fresh", "notes": "If available"}
        ],
        "nutritional_highlights": ["Iron", "Fiber", "Vitamins"],
        "beginner_notes": "Kasuri methi is the SECRET ingredient in restaurant-style butter chicken and many Indian curries! It adds that distinctive flavor you can't quite place. Always crush it between your palms before adding to release the aroma.",
        "difficulty_level": "beginner",
        "where_to_find": "Indian grocery stores",
        "what_to_look_for": "Strong aroma when crushed. Avoid if smells dusty or stale.",
        "featured": True,
        "popularity": 80
    },
    
    {
        "name": "asafoetida",
        "display_name": "Asafoetida (Hing)",
        "alternate_names": ["hing", "heeng", "devil's dung"],
        "category": "spice_ground",
        "images": {
            "primary": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Yellow powder (compounded), brown resin (pure)",
            "shape": "Fine powder",
            "size": "N/A",
            "texture": "Fine powder, sticky resin in pure form",
            "visual_description": "Yellow powder (mixed with flour for stability). Pure form is brown-yellow resin. Has an extremely pungent smell raw that transforms when cooked."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "EXTREMELY pungent raw (sulfurous), onion-garlic-like when cooked",
        "taste": "Pungent raw, savory/umami when cooked, onion-garlic flavor",
        "common_uses": ["South Indian cooking", "Dals and lentils", "Vegetarian cooking (replaces onion/garlic)", "Tempering"],
        "cuisines": ["Indian", "South Indian"],
        "preparation_tips": [
            "Use TINY amount - a pinch is enough",
            "Must be cooked in oil/fat to transform flavor",
            "Add to hot oil at start of tempering",
            "Store in airtight container - smell spreads!"
        ],
        "storage": {"method": "Airtight container (double bagged!)", "shelf_life": "Years if sealed", "signs_of_spoilage": ["Loss of pungency"]},
        "substitutes": [
            {"name": "Onion + garlic powder", "ratio": "1/4 tsp each per pinch hing", "notes": "For similar savory depth"}
        ],
        "nutritional_highlights": ["Aids digestion", "Anti-bloating", "Traditional Ayurvedic medicine"],
        "beginner_notes": "Hing smells TERRIBLE raw - like sulfur and rotten garlic. Don't panic! When cooked in hot oil, it transforms into a wonderful savory flavor. Use just a tiny pinch. Store it sealed or your whole kitchen will smell!",
        "difficulty_level": "intermediate",
        "where_to_find": "Indian grocery stores only",
        "what_to_look_for": "Yellow compounded powder is easier to use. Keep sealed tightly!",
        "featured": True,
        "popularity": 70
    },
    
    {
        "name": "curry leaves",
        "display_name": "Curry Leaves",
        "alternate_names": ["kadi patta", "meetha neem", "karivepaku"],
        "category": "herb_fresh",
        "images": {
            "primary": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Dark green, glossy",
            "shape": "Small, pointed oval leaves on a stem",
            "size": "2-4cm each leaf",
            "texture": "Glossy, slightly thick leaves",
            "visual_description": "Small, dark green, glossy leaves attached to thin stems. Look similar to small bay leaves but are shiny and more delicate. Highly aromatic."
        },
        "similar_to": [
            {"name": "Bay leaves", "how_to_differentiate": "Bay leaves are much larger, stiffer, and pale green. Curry leaves are small, dark, glossy, and on stems. Completely different flavor!"}
        ],
        "confused_with": [
            {"name": "Curry powder", "warning": "Curry LEAVES are a fresh herb. Curry POWDER is a spice blend. They're completely different things and not interchangeable!"}
        ],
        "aroma": "Distinctive, aromatic, citrusy, unique",
        "taste": "Unique aromatic flavor, slightly citrusy, essential to South Indian food",
        "common_uses": ["South Indian curries", "Tempering/tadka", "Rasam and sambar", "Upma"],
        "cuisines": ["South Indian", "Sri Lankan", "Malaysian"],
        "preparation_tips": [
            "Add to hot oil until they crackle",
            "Can be eaten or removed (edible)",
            "Fresh is MUCH better than dried",
            "Freeze fresh leaves to preserve"
        ],
        "storage": {"method": "Refrigerator (paper towel lined) or freezer", "shelf_life": "1-2 weeks fresh, months frozen", "signs_of_spoilage": ["Yellow leaves", "Dry and brittle", "Loss of aroma"]},
        "substitutes": [
            {"name": "None", "ratio": "N/A", "notes": "Unique flavor - no real substitute. Skip if unavailable rather than substituting."}
        ],
        "nutritional_highlights": ["Iron", "Antioxidants", "Traditional hair growth remedy"],
        "beginner_notes": "Curry leaves have NO substitute - their flavor is unique. If you can't find them, it's better to skip them than substitute. Freeze fresh curry leaves - they last for months and work almost as well as fresh!",
        "difficulty_level": "beginner",
        "where_to_find": "Indian grocery stores, some Asian markets",
        "what_to_look_for": "Fresh, glossy, dark green leaves. Avoid yellow or dried out leaves.",
        "featured": True,
        "popularity": 80
    },
    
    {
        "name": "cumin powder",
        "display_name": "Cumin Powder (Ground Cumin)",
        "alternate_names": ["jeera powder", "ground cumin"],
        "category": "spice_ground",
        "images": {
            "primary": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Brown to tan",
            "shape": "Fine powder",
            "size": "N/A",
            "texture": "Fine, slightly gritty powder",
            "visual_description": "Brown to tan fine powder. Slightly darker than coriander powder. Should smell strongly aromatic."
        },
        "similar_to": [
            {"name": "Cumin seeds", "how_to_differentiate": "Powder is ground form. Use 3/4 tsp powder for 1 tsp seeds."}
        ],
        "confused_with": [],
        "aroma": "Warm, earthy, distinctive cumin smell",
        "taste": "Earthy, warm, slightly bitter",
        "common_uses": ["Curries", "Raita", "Chaat masala", "Spice rubs"],
        "cuisines": ["Indian", "Mexican", "Middle Eastern"],
        "preparation_tips": [
            "Can be added during or after cooking",
            "Fresh ground has much more flavor",
            "Loses potency quickly once ground",
            "Toast whole seeds before grinding"
        ],
        "storage": {"method": "Airtight container", "shelf_life": "6 months", "signs_of_spoilage": ["Loss of aroma", "Faded color"]},
        "substitutes": [
            {"name": "Cumin seeds (freshly ground)", "ratio": "3/4 tsp powder = 1 tsp seeds", "notes": "Much better flavor"}
        ],
        "nutritional_highlights": ["Iron", "Aids digestion"],
        "beginner_notes": "Ground cumin loses flavor fast - buy small quantities. Even better: buy whole cumin seeds, toast them, and grind fresh in a spice grinder. The flavor difference is dramatic!",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Check date, buy small quantities. Should smell strongly of cumin.",
        "featured": True,
        "popularity": 90
    },
    
    {
        "name": "coriander powder",
        "display_name": "Coriander Powder (Ground Coriander)",
        "alternate_names": ["dhania powder", "ground coriander"],
        "category": "spice_ground",
        "images": {
            "primary": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Light brown to tan",
            "shape": "Fine powder",
            "size": "N/A",
            "texture": "Fine powder",
            "visual_description": "Light brown, fine powder. Lighter than cumin powder. Should have a citrusy, slightly sweet aroma."
        },
        "similar_to": [
            {"name": "Coriander seeds", "how_to_differentiate": "Powder is ground form. Seeds are whole."}
        ],
        "confused_with": [],
        "aroma": "Citrusy, sweet, floral",
        "taste": "Mild, citrusy, slightly sweet and nutty",
        "common_uses": ["Indian curries", "Spice blends", "Marinades", "Almost always paired with cumin"],
        "cuisines": ["Indian", "Middle Eastern", "Thai"],
        "preparation_tips": [
            "Almost always used with cumin powder",
            "Add during cooking, not at end",
            "Toast seeds before grinding for better flavor",
            "Common ratio: 2 parts coriander to 1 part cumin"
        ],
        "storage": {"method": "Airtight container", "shelf_life": "6 months", "signs_of_spoilage": ["Loss of citrus aroma", "Musty smell"]},
        "substitutes": [
            {"name": "Coriander seeds (freshly ground)", "ratio": "1 tbsp seeds = 1 tsp powder", "notes": "Fresher flavor"}
        ],
        "nutritional_highlights": ["Aids digestion", "Iron", "Vitamin C"],
        "beginner_notes": "Coriander powder and cumin powder are the dynamic duo of Indian cooking - they're almost always used together! A classic ratio is 2:1 (coriander to cumin). They complement each other perfectly.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Fresh citrusy smell. Avoid if it smells dusty.",
        "featured": True,
        "popularity": 85
    },
    
    # ════════════════════════════════════════════════════════
    # GRAINS & FLOUR
    # ════════════════════════════════════════════════════════
    
    {
        "name": "rice",
        "display_name": "Rice",
        "alternate_names": ["chawal", "basmati", "white rice", "long grain rice"],
        "category": "grain",
        "images": {
            "primary": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "White (polished), brown (whole grain)",
            "shape": "Long grains (basmati) or short grains",
            "size": "4-8mm depending on variety",
            "texture": "Hard when dry, fluffy when cooked",
            "visual_description": "Small grains that are hard when dry. Basmati is long and slender. Short grain is rounder. Should be clean without debris."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Mild, slightly nutty (basmati has distinctive aroma)",
        "taste": "Mild, slightly sweet, neutral base for dishes",
        "common_uses": ["Biryani", "Plain rice", "Pulao", "Khichdi", "Fried rice"],
        "cuisines": ["Indian", "Asian", "Universal"],
        "preparation_tips": [
            "Rinse until water runs clear",
            "Soak basmati 30 min for fluffier grains",
            "1:1.5 rice to water ratio for most types",
            "Don't stir while cooking"
        ],
        "storage": {"method": "Cool, dry place", "shelf_life": "Indefinite if dry", "signs_of_spoilage": ["Bugs", "Musty smell", "Discoloration"]},
        "substitutes": [
            {"name": "Quinoa", "ratio": "1:1", "notes": "More protein, nuttier taste"},
            {"name": "Cauliflower rice", "ratio": "1:1", "notes": "Low carb alternative"}
        ],
        "nutritional_highlights": ["Carbohydrates for energy", "Some B vitamins", "Gluten-free"],
        "beginner_notes": "The key to perfect rice: RINSE until water is clear (removes excess starch), soak if using basmati, and don't lift the lid while cooking! Let it rest 5 minutes after cooking before fluffing.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "For Indian cooking, basmati is best. Look for long, unbroken grains.",
        "featured": True,
        "popularity": 100
    },
    
    {
        "name": "wheat flour",
        "display_name": "Wheat Flour (Atta)",
        "alternate_names": ["atta", "whole wheat flour", "chapati flour", "roti flour"],
        "category": "flour",
        "images": {
            "primary": "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Off-white to light brown",
            "shape": "Fine powder",
            "size": "N/A",
            "texture": "Fine, soft powder",
            "visual_description": "Fine powder, slightly darker than all-purpose flour. Indian atta is whole wheat and has more texture than refined flour."
        },
        "similar_to": [
            {"name": "All-purpose flour", "how_to_differentiate": "All-purpose is white and refined. Atta is whole wheat and slightly darker/coarser."}
        ],
        "confused_with": [],
        "aroma": "Mild, wheaty",
        "taste": "Mild, slightly nutty",
        "common_uses": ["Roti/chapati", "Paratha", "Puri", "Naan (with maida)"],
        "cuisines": ["Indian"],
        "preparation_tips": [
            "Knead well for soft rotis",
            "Rest dough for 30 min",
            "Add water gradually when kneading",
            "Dough should be soft, not sticky or stiff"
        ],
        "storage": {"method": "Airtight container, cool place", "shelf_life": "3-6 months", "signs_of_spoilage": ["Bugs", "Rancid smell", "Lumps"]},
        "substitutes": [
            {"name": "All-purpose flour", "ratio": "1:1", "notes": "Softer but less nutritious"},
            {"name": "White whole wheat flour", "ratio": "1:1", "notes": "Milder whole wheat flavor"}
        ],
        "nutritional_highlights": ["Fiber", "B vitamins", "Iron"],
        "beginner_notes": "Indian atta (chapati flour) is finely ground whole wheat - it's different from regular whole wheat flour which can be coarser. For soft rotis, knead the dough well and let it rest!",
        "difficulty_level": "beginner",
        "where_to_find": "Indian grocery stores for atta, any store for whole wheat flour",
        "what_to_look_for": "Look for 'chakki atta' or 'chapati flour' at Indian stores.",
        "featured": True,
        "popularity": 85
    },
    
    {
        "name": "chickpea flour",
        "display_name": "Chickpea Flour (Besan)",
        "alternate_names": ["besan", "gram flour", "garbanzo flour"],
        "category": "flour",
        "images": {
            "primary": "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Pale yellow",
            "shape": "Fine powder",
            "size": "N/A",
            "texture": "Fine, slightly gritty powder",
            "visual_description": "Pale yellow, fine powder made from ground chickpeas. Has a distinctive nutty smell."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Nutty, earthy, distinctive",
        "taste": "Slightly nutty, earthy, can be bitter if raw",
        "common_uses": ["Pakoras (fritters)", "Kadhi", "Besan ladoo", "Binding agent", "Thickener"],
        "cuisines": ["Indian"],
        "preparation_tips": [
            "Must be cooked - raw besan is bitter",
            "Mix with water gradually to avoid lumps",
            "Toast dry in pan to remove raw taste",
            "Makes crispy batters"
        ],
        "storage": {"method": "Airtight container", "shelf_life": "6 months", "signs_of_spoilage": ["Bugs", "Rancid smell", "Clumping"]},
        "substitutes": [
            {"name": "Rice flour + regular flour", "ratio": "Mix 50:50", "notes": "For pakora batter"}
        ],
        "nutritional_highlights": ["High protein", "High fiber", "Gluten-free"],
        "beginner_notes": "Besan has a distinctive raw taste that must be cooked out. For pakoras, make sure your batter isn't too thick or too thin. For kadhi, toast the besan first in a dry pan to remove the raw taste.",
        "difficulty_level": "beginner",
        "where_to_find": "Indian grocery stores, health food stores",
        "what_to_look_for": "Pale yellow color, nutty smell, no lumps.",
        "featured": True,
        "popularity": 75
    },
    
    # ════════════════════════════════════════════════════════
    # NUTS & SEEDS
    # ════════════════════════════════════════════════════════
    
    {
        "name": "cashews",
        "display_name": "Cashews",
        "alternate_names": ["kaju", "cashew nuts"],
        "category": "nut",
        "images": {
            "primary": "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Cream to pale yellow",
            "shape": "Kidney/crescent shaped",
            "size": "2-3cm",
            "texture": "Smooth, slightly soft",
            "visual_description": "Cream-colored, kidney-shaped nuts. Should be uniform in color without dark spots. Pieces are cheaper but whole look better in dishes."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Mild, slightly sweet",
        "taste": "Creamy, sweet, buttery",
        "common_uses": ["Korma curries (cashew paste)", "Indian sweets", "Garnish", "Snacking"],
        "cuisines": ["Indian", "Thai", "Chinese"],
        "preparation_tips": [
            "Soak 2 hours and blend for creamy curry paste",
            "Fry in ghee for garnish until golden",
            "Raw cashews work best for pastes",
            "Don't over-roast - they burn easily"
        ],
        "storage": {"method": "Refrigerator or freezer", "shelf_life": "6 months fridge, 1 year freezer", "signs_of_spoilage": ["Rancid smell", "Soft texture", "Dark spots"]},
        "substitutes": [
            {"name": "Almonds", "ratio": "1:1", "notes": "Different texture but works"},
            {"name": "Sunflower seeds", "ratio": "1:1", "notes": "Budget-friendly, nut-free"}
        ],
        "nutritional_highlights": ["Healthy fats", "Protein", "Magnesium"],
        "beginner_notes": "Soaked and blended cashews make the creamiest curry sauces - this is the secret to restaurant-style korma! Use RAW cashews, not roasted or salted. Soak for at least 2 hours (or boil for 15 min) before blending.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Raw, unsalted for cooking. Uniform cream color.",
        "featured": True,
        "popularity": 80
    },
    
    {
        "name": "almonds",
        "display_name": "Almonds",
        "alternate_names": ["badam", "almond nuts"],
        "category": "nut",
        "images": {
            "primary": "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Tan/brown skin, white inside",
            "shape": "Oval with pointed end",
            "size": "2-3cm",
            "texture": "Hard, crunchy",
            "visual_description": "Oval nuts with tan skin and white flesh. Blanched almonds have no skin. Sliced/slivered varieties also available."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Mild, slightly sweet",
        "taste": "Mildly sweet, nutty, crunchy",
        "common_uses": ["Indian sweets (kheer, barfi)", "Garnish", "Almond milk", "Badam milk drink"],
        "cuisines": ["Indian", "Middle Eastern", "Mediterranean"],
        "preparation_tips": [
            "Soak and peel for white garnish (blanching)",
            "Sliver for garnishing",
            "Toast for more flavor",
            "Grind for almond meal/flour"
        ],
        "storage": {"method": "Refrigerator or freezer", "shelf_life": "6 months fridge, 1 year freezer", "signs_of_spoilage": ["Rancid smell", "Shriveled", "Bitter taste"]},
        "substitutes": [
            {"name": "Cashews", "ratio": "1:1", "notes": "Softer, creamier"},
            {"name": "Pistachios", "ratio": "1:1", "notes": "Different but complementary"}
        ],
        "nutritional_highlights": ["Vitamin E", "Healthy fats", "Protein", "Fiber"],
        "beginner_notes": "To blanch (remove skin): soak in boiling water for 1 minute, drain, and squeeze each almond - the skin slips right off! This gives you pretty white almonds for garnishing Indian sweets.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Uniform size, no discoloration or mold.",
        "featured": True,
        "popularity": 80
    },
    
    {
        "name": "coconut",
        "display_name": "Coconut",
        "alternate_names": ["nariyal", "coconut milk", "desiccated coconut", "shredded coconut"],
        "category": "nut",
        "images": {
            "primary": "https://images.unsplash.com/photo-1580984969071-a8da8c93faa0?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "Brown husk, white flesh",
            "shape": "Round (whole), shredded or flaked (processed)",
            "size": "Whole: 10-15cm diameter",
            "texture": "Hard shell, firm white flesh",
            "visual_description": "Whole coconuts have brown, hairy shells. Inside is white flesh. Available as fresh, desiccated (dried), flaked, or as coconut milk/cream in cans."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Sweet, tropical",
        "taste": "Sweet, rich, creamy (milk/cream), nutty (dried)",
        "common_uses": ["South Indian curries", "Chutneys", "Sweets", "Rice dishes"],
        "cuisines": ["South Indian", "Thai", "Caribbean", "Southeast Asian"],
        "preparation_tips": [
            "Fresh: grate flesh for cooking",
            "Coconut milk: shake can well before opening",
            "Cream rises to top - mix or use separately",
            "Toast desiccated coconut for more flavor"
        ],
        "storage": {"method": "Fresh: refrigerator. Canned: pantry", "shelf_life": "Fresh flesh: 1 week. Canned: years", "signs_of_spoilage": ["Mold", "Sour smell", "Slimy texture"]},
        "substitutes": [
            {"name": "Coconut cream", "ratio": "Use as is", "notes": "For richness"},
            {"name": "Heavy cream", "ratio": "1:1", "notes": "Different flavor but similar richness"}
        ],
        "nutritional_highlights": ["Healthy fats (MCTs)", "Manganese", "Copper"],
        "beginner_notes": "Canned coconut milk has two parts: thick cream on top and thin water below. For curries, use both. For whipping, use only the solid cream (refrigerate can overnight first). Shake well if you want it mixed!",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store (canned), Indian stores (fresh)",
        "what_to_look_for": "Canned: full-fat, no additives. Fresh: heavy with sloshing water inside.",
        "featured": True,
        "popularity": 85
    },
    
    {
        "name": "sesame seeds",
        "display_name": "Sesame Seeds",
        "alternate_names": ["til", "gingelly seeds", "white sesame", "black sesame"],
        "category": "seed",
        "images": {
            "primary": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400",
            "comparison": [],
            "closeup": ""
        },
        "appearance": {
            "color": "White, cream, or black",
            "shape": "Tiny, flat, teardrop",
            "size": "2-3mm",
            "texture": "Tiny, crunchy",
            "visual_description": "Tiny, flat, teardrop-shaped seeds. White sesame is most common. Black sesame has a slightly stronger flavor. Should be dry and separate, not clumped."
        },
        "similar_to": [],
        "confused_with": [],
        "aroma": "Nutty, especially when toasted",
        "taste": "Mild nutty, sweet when toasted",
        "common_uses": ["Til ladoo", "Garnishing", "Tahini (sesame paste)", "Bread toppings"],
        "cuisines": ["Indian", "Middle Eastern", "Asian"],
        "preparation_tips": [
            "Toast in dry pan to bring out flavor",
            "Stir constantly when toasting - burn easily",
            "Use raw for grinding into paste",
            "Black sesame for visual contrast"
        ],
        "storage": {"method": "Airtight container, refrigerator", "shelf_life": "6 months", "signs_of_spoilage": ["Rancid smell", "Bitter taste"]},
        "substitutes": [
            {"name": "Poppy seeds", "ratio": "1:1", "notes": "For texture/garnish"}
        ],
        "nutritional_highlights": ["Calcium", "Iron", "Healthy fats"],
        "beginner_notes": "Sesame seeds go from perfectly toasted to burnt in seconds - watch them carefully! They're ready when golden and fragrant. The nutty flavor only comes out when they're toasted.",
        "difficulty_level": "beginner",
        "where_to_find": "Any grocery store",
        "what_to_look_for": "Dry, separate seeds. No clumping or off smell.",
        "featured": True,
        "popularity": 70
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
