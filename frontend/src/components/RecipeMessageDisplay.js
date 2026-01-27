import { useState } from 'react';
import { Heart, Clock, ChefHat, Utensils, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RecipeDetailModal from './RecipeDetailModal';

// Curated high-quality food images from Unsplash
const FOOD_IMAGES = {
  // Indian
  'butter chicken': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800',
  'palak paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
  'chicken biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
  'biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
  'dal': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800',
  'curry': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
  'tikka masala': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800',
  'tikka': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800',
  'samosa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
  'naan': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800',
  'paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
  'chana masala': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
  'korma': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800',
  'vindaloo': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
  
  // Italian
  'caprese': 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=800',
  'quinoa salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  'spaghetti': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
  'carbonara': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
  'pasta': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800',
  'pizza': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
  'margherita': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
  'risotto': 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800',
  'tiramisu': 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
  'lasagna': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800',
  'penne': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800',
  'alfredo': 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=800',
  'gnocchi': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800',
  'bruschetta': 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=800',
  'minestrone': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
  
  // Mexican
  'tacos': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800',
  'burrito': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800',
  'guacamole': 'https://images.unsplash.com/photo-1604132061973-c90de135f2a4?w=800',
  'enchiladas': 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800',
  'quesadilla': 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800',
  'nachos': 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=800',
  'fajitas': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800',
  'burrito bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'chilaquiles': 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800',
  
  // Chinese
  'kung pao': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800',
  'mapo tofu': 'https://images.unsplash.com/photo-1582452919408-80d02cb4cf45?w=800',
  'dim sum': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
  'dumplings': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
  'fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
  'stir fry': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800',
  'noodles': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
  'chow mein': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800',
  'lo mein': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800',
  'orange chicken': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800',
  'general tso': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800',
  'sweet and sour': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800',
  
  // Japanese
  'ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
  'sushi': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
  'teriyaki': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'tempura': 'https://images.unsplash.com/photo-1581781870027-04212e231e96?w=800',
  'miso soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
  'udon': 'https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?w=800',
  'donburi': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
  'edamame': 'https://images.unsplash.com/photo-1564093497595-593b96d80180?w=800',
  'katsu': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800',
  'onigiri': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
  
  // Thai
  'pad thai': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
  'green curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  'tom yum': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
  'thai curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  'massaman': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  'satay': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
  'tom kha': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
  'thai basil': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  
  // Mediterranean
  'falafel': 'https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?w=800',
  'shakshuka': 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=800',
  'hummus': 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800',
  'kebab': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
  'gyro': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
  'pita': 'https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?w=800',
  'greek salad': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
  'moussaka': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800',
  'tabbouleh': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  
  // Korean
  'bibimbap': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800',
  'bulgogi': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
  'kimchi': 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800',
  'korean bbq': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
  'japchae': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
  'korean fried chicken': 'https://images.unsplash.com/photo-1575932444877-5106bee2a599?w=800',
  
  // French
  'croissant': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
  'ratatouille': 'https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=800',
  'quiche': 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800',
  'crepe': 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=800',
  'coq au vin': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'bouillabaisse': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
  'beef bourguignon': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
  
  // General Foods
  'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
  'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  'sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
  'smoothie': 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=800',
  'smoothie bowl': 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=800',
  'oatmeal': 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=800',
  'pancakes': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
  'avocado toast': 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=800',
  'chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800',
  'steak': 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
  'burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
  'grilled chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'roasted vegetables': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800',
  'baked salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800',
  'bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'grain bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'buddha bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'wrap': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800',
  'veggie wrap': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800',
  'tofu': 'https://images.unsplash.com/photo-1582452919408-80d02cb4cf45?w=800',
  'egg': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
  'omelet': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
  'frittata': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
  'shrimp': 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800',
  'fish': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800',
  'dessert': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800',
  'chocolate': 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800',
  'cake': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
};

// Cuisine fallbacks
const CUISINE_FALLBACKS = {
  'indian': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
  'italian': 'https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=800',
  'mexican': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800',
  'chinese': 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800',
  'japanese': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
  'thai': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
  'mediterranean': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
  'korean': 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800',
  'french': 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800',
  'american': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
  'vegetarian': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  'vegan': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800',
};

// Generic food images
const GENERIC_FOOD_IMAGES = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
];

// Get appropriate image for a recipe
const getRecipeImage = (title, cuisineHint = '') => {
  const searchTerms = (title + ' ' + cuisineHint).toLowerCase();
  
  // Try exact matches first
  for (const [key, url] of Object.entries(FOOD_IMAGES)) {
    if (searchTerms.includes(key)) {
      return url;
    }
  }
  
  // Try partial word matches
  const words = searchTerms.split(/\s+/);
  for (const word of words) {
    if (word.length > 3) {
      for (const [key, url] of Object.entries(FOOD_IMAGES)) {
        if (key.includes(word) || word.includes(key)) {
          return url;
        }
      }
    }
  }
  
  // Try cuisine fallbacks
  for (const [cuisine, url] of Object.entries(CUISINE_FALLBACKS)) {
    if (searchTerms.includes(cuisine)) {
      return url;
    }
  }
  
  // Return a consistent generic image based on title hash
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return GENERIC_FOOD_IMAGES[hash % GENERIC_FOOD_IMAGES.length];
};

// Difficulty badge colors
const DIFFICULTY_COLORS = {
  'Easy': 'bg-green-500/15 text-green-700 border-green-500/40',
  'Medium': 'bg-amber-500/15 text-amber-700 border-amber-500/40',
  'Hard': 'bg-red-500/15 text-red-700 border-red-500/40',
};

// Time category icons and colors
const TIME_CATEGORIES = {
  quick: { icon: '⚡', title: 'Quick Option (15-20 min)', color: 'text-emerald-600' },
  moderate: { icon: '🍳', title: 'Moderate Option (20-40 min)', color: 'text-blue-600' },
  elaborate: { icon: '👨‍🍳', title: 'Elaborate Option (40-60 min)', color: 'text-purple-600' },
};

// Parse recipes with better title extraction
const parseRecipesWithCategories = (message) => {
  const categories = {
    quick: { ...TIME_CATEGORIES.quick, recipes: [] },
    moderate: { ...TIME_CATEGORIES.moderate, recipes: [] },
    elaborate: { ...TIME_CATEGORIES.elaborate, recipes: [] },
  };
  
  // Check for time category headers
  const quickMatch = message.match(/###?\s*Quick\s*Option[^#]*(?=###|$)/is);
  const moderateMatch = message.match(/###?\s*Moderate\s*Option[^#]*(?=###|$)/is);
  const elaborateMatch = message.match(/###?\s*Elaborate\s*Option[^#]*(?=###|$)/is);
  
  if (quickMatch) categories.quick.recipes = parseRecipesFromSection(quickMatch[0], 'quick');
  if (moderateMatch) categories.moderate.recipes = parseRecipesFromSection(moderateMatch[0], 'moderate');
  if (elaborateMatch) categories.elaborate.recipes = parseRecipesFromSection(elaborateMatch[0], 'elaborate');
  
  // If no categories found, try general parsing
  if (!categories.quick.recipes.length && !categories.moderate.recipes.length && !categories.elaborate.recipes.length) {
    const allRecipes = parseRecipesGeneral(message);
    allRecipes.forEach(recipe => {
      const time = extractTimeMinutes(recipe.cookingTime);
      if (time <= 20) categories.quick.recipes.push(recipe);
      else if (time <= 40) categories.moderate.recipes.push(recipe);
      else categories.elaborate.recipes.push(recipe);
    });
  }
  
  return categories;
};

// Extract time in minutes
const extractTimeMinutes = (timeStr) => {
  if (!timeStr) return 30;
  const match = timeStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 30;
};

// Parse recipes from a section with improved title detection
const parseRecipesFromSection = (section, category) => {
  const recipes = [];
  
  // Skip patterns - things that are NOT recipe names
  const skipPatterns = [
    /^(option|tip|note|step|ingredient|instruction|direction|nutritional|sensory|description|serving|highlight|benefit|why|quick|moderate|elaborate|cooking time|difficulty|cuisine type|cuisine|name|total time|prep time)/i,
    /^\d+\.\s*$/,
    /^[:\s]*\(\d+/,
  ];
  
  // PATTERN 1: Try to extract recipe title from ### header line
  // Format: "### Quick Option (15-20 min): Recipe Title Name Here"
  const headerMatch = section.match(/###?\s*(?:Quick|Moderate|Elaborate)\s*Option\s*\([^)]+\)\s*[:\-–]\s*(.+?)(?:\n|$)/i);
  if (headerMatch) {
    const title = headerMatch[1].trim();
    if (title.length >= 3 && title.length <= 120 && !skipPatterns.some(p => p.test(title))) {
      const recipe = parseRecipeContent(title, section, category);
      if (recipe) recipes.push(recipe);
      return recipes; // One recipe per section in this format
    }
  }
  
  // PATTERN 2: Original pattern - look for **Recipe Title**
  const recipePattern = /\*\*([^*]+)\*\*([^*]*?)(?=\*\*|$)/gs;
  let match;
  
  while ((match = recipePattern.exec(section)) !== null) {
    let title = match[1].trim();
    const content = match[2].trim();
    
    // Skip if it matches skip patterns
    if (skipPatterns.some(pattern => pattern.test(title))) continue;
    if (title.length < 3 || title.length > 120) continue;
    
    // Clean title - remove parenthetical time if present
    const titleTimeMatch = title.match(/^(.+?)\s*\((\d+[-–]?\d*\s*(?:min|minutes?))\)$/i);
    let cookingTime = null;
    if (titleTimeMatch) {
      title = titleTimeMatch[1].trim();
      cookingTime = titleTimeMatch[2];
    }
    
    // Get cooking time from content if not in title
    if (!cookingTime) {
      const contentTimeMatch = content.match(/(\d+[-–]?\d*)\s*(min|minutes|hour|hours)/i);
      cookingTime = contentTimeMatch ? contentTimeMatch[0] : getCategoryDefaultTime(category);
    }
    
    // Skip if title still looks like a label
    if (title.match(/^(name|time|difficulty|type|cuisine):/i)) continue;
    
    // Determine difficulty
    let difficulty = 'Medium';
    if (category === 'quick' || content.match(/\b(quick|easy|simple|fast)\b/i)) difficulty = 'Easy';
    else if (category === 'elaborate' || content.match(/\b(involved|complex|advanced|elaborate)\b/i)) difficulty = 'Hard';
    
    // Get description - clean it up
    let description = '';
    const descLines = content.split('\n').filter(l => l.trim() && !l.match(/^[-*•]/));
    if (descLines.length > 0) {
      description = descLines[0].replace(/^[:\s]+/, '').trim();
      // Get up to 2 sentences
      const sentences = description.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 0) {
        description = sentences.slice(0, 2).join(' ').trim();
      }
    }
    if (!description || description.length < 10) {
      description = `A delicious ${category === 'quick' ? 'quick and easy' : category === 'elaborate' ? 'gourmet' : 'satisfying'} dish perfect for any occasion.`;
    }
    
    // Detect cuisine
    const cuisineHint = detectCuisine(title + ' ' + content);
    
    recipes.push({
      title,
      description,
      cookingTime,
      difficulty,
      cuisineHint,
      category,
      imageUrl: getRecipeImage(title, cuisineHint),
      fullContent: content
    });
  }
  
  return recipes;
};

// Parse recipe content helper for header-based recipes
const parseRecipeContent = (title, section, category) => {
  // Extract cooking time from section
  const timeMatch = section.match(/\*\*Cooking\s*Time:?\*\*\s*(\d+[-–]?\d*\s*(?:min|minutes|hours?))/i) ||
                    section.match(/(\d+[-–]?\d*)\s*(min|minutes)/i);
  const cookingTime = timeMatch ? timeMatch[1] || timeMatch[0] : getCategoryDefaultTime(category);
  
  // Extract difficulty
  const diffMatch = section.match(/\*\*Difficulty(?:\s*Level)?:?\*\*\s*(Easy|Medium|Hard|Moderate)/i);
  let difficulty = diffMatch ? diffMatch[1] : 'Medium';
  if (difficulty === 'Moderate') difficulty = 'Medium';
  if (category === 'quick') difficulty = 'Easy';
  if (category === 'elaborate') difficulty = 'Hard';
  
  // Extract description
  const descMatch = section.match(/\*\*Description:?\*\*\s*([^*\n]+)/i);
  let description = descMatch ? descMatch[1].trim() : '';
  if (!description) {
    // Try to get first paragraph after header
    const paragraphs = section.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('*') && !l.startsWith('-'));
    if (paragraphs.length > 0) {
      description = paragraphs[0].trim().substring(0, 200);
    }
  }
  if (!description || description.length < 10) {
    description = `A delicious ${category === 'quick' ? 'quick and easy' : category === 'elaborate' ? 'gourmet' : 'satisfying'} dish perfect for any occasion.`;
  }
  
  const cuisineHint = detectCuisine(title + ' ' + section);
  
  return {
    title,
    description,
    cookingTime,
    difficulty,
    cuisineHint,
    category,
    imageUrl: getRecipeImage(title, cuisineHint),
    fullContent: section
  };
};
    
    recipes.push({
      title,
      description,
      cookingTime,
      difficulty,
      cuisineHint,
      category,
      imageUrl: getRecipeImage(title, cuisineHint),
      fullContent: content
    });
  }
  
  return recipes;
};

// Get default time for category
const getCategoryDefaultTime = (category) => {
  switch (category) {
    case 'quick': return '15-20 min';
    case 'moderate': return '25-35 min';
    case 'elaborate': return '45-60 min';
    default: return '30 min';
  }
};

// General recipe parsing (fallback)
const parseRecipesGeneral = (message) => {
  const recipes = [];
  const recipePattern = /\*\*([^*]+)\*\*([^*]*?)(?=\*\*|$)/gs;
  let match;
  
  const skipPatterns = [
    /^(option|tip|note|step|ingredient|instruction|direction|nutritional|sensory|description|serving|highlight|benefit|why|quick|moderate|elaborate|cooking time|difficulty|cuisine type|cuisine|name)/i,
  ];
  
  while ((match = recipePattern.exec(message)) !== null) {
    let title = match[1].trim();
    const content = match[2].trim();
    
    if (skipPatterns.some(pattern => pattern.test(title))) continue;
    if (title.length < 3 || title.length > 120) continue;
    
    // Must look like actual food
    const looksLikeRecipe = title.match(/\b(chicken|beef|pork|fish|salmon|shrimp|tofu|vegetable|soup|salad|curry|pasta|rice|noodle|stew|roast|grilled|baked|fried|steamed|bowl|wrap|taco|pizza|burger|sandwich|quinoa|lentil|bean|egg|mushroom|eggplant|zucchini|spinach|kale)\b/i) ||
      title.match(/^[A-Z][a-z]+(\s+[A-Za-z]+)*$/) ||
      title.match(/\b(dal|paneer|tikka|biryani|ramen|sushi|burrito|risotto|pad thai|pho|kebab|falafel|hummus|bibimbap|bulgogi|quesadilla|enchilada|carbonara|alfredo|teriyaki|tempura|korma|vindaloo|masala)\b/i);
    
    if (!looksLikeRecipe && !content.match(/ingredient|prep time|cook time|serves/i)) continue;
    
    const titleTimeMatch = title.match(/^(.+?)\s*\((\d+[-–]?\d*\s*(?:min|minutes?))\)$/i);
    let cookingTime = null;
    if (titleTimeMatch) {
      title = titleTimeMatch[1].trim();
      cookingTime = titleTimeMatch[2];
    }
    if (!cookingTime) {
      const contentTimeMatch = content.match(/(\d+[-–]?\d*)\s*(min|minutes|hour|hours)/i);
      cookingTime = contentTimeMatch ? contentTimeMatch[0] : '30 min';
    }
    
    let difficulty = 'Medium';
    if (content.match(/\b(quick|easy|simple|fast|15[-\s]*min)\b/i)) difficulty = 'Easy';
    else if (content.match(/\b(involved|complex|hour|advanced)\b/i)) difficulty = 'Hard';
    
    let description = content.split('\n')[0].replace(/^[:\s]+/, '').trim();
    const sentences = description.match(/[^.!?]+[.!?]+/g);
    if (sentences) description = sentences.slice(0, 2).join(' ').trim();
    if (!description || description.length < 10) description = 'A delicious mood-boosting recipe.';
    
    const cuisineHint = detectCuisine(title + ' ' + content);
    
    recipes.push({
      title,
      description,
      cookingTime,
      difficulty,
      cuisineHint,
      imageUrl: getRecipeImage(title, cuisineHint),
      fullContent: content
    });
  }
  
  return recipes;
};

// Detect cuisine from text
const detectCuisine = (text) => {
  const searchText = text.toLowerCase();
  if (searchText.match(/\b(indian|curry|masala|paneer|dal|tikka|biryani|naan|tandoor|chana|korma|vindaloo)\b/i)) return 'Indian';
  if (searchText.match(/\b(italian|pasta|risotto|pizza|parmesan|marinara|pesto|lasagna|penne|gnocchi|carbonara|alfredo|bruschetta)\b/i)) return 'Italian';
  if (searchText.match(/\b(mexican|taco|salsa|cilantro|burrito|enchilada|quesadilla|fajita|guacamole|nachos)\b/i)) return 'Mexican';
  if (searchText.match(/\b(chinese|wok|stir.?fry|soy sauce|dumpling|dim sum|szechuan|cantonese|lo mein|kung pao|orange chicken)\b/i)) return 'Chinese';
  if (searchText.match(/\b(japanese|miso|sushi|ramen|teriyaki|tempura|udon|sake|donburi|katsu)\b/i)) return 'Japanese';
  if (searchText.match(/\b(thai|coconut milk|lemongrass|fish sauce|pad thai|tom yum|basil|massaman|tom kha)\b/i)) return 'Thai';
  if (searchText.match(/\b(korean|gochujang|kimchi|sesame|bulgogi|bibimbap|korean bbq|japchae)\b/i)) return 'Korean';
  if (searchText.match(/\b(french|butter|wine|cream|provence|bistro|croissant|coq au vin|bourguignon)\b/i)) return 'French';
  if (searchText.match(/\b(mediterranean|olive oil|feta|hummus|falafel|greek|lebanese|pita|tabbouleh|moussaka)\b/i)) return 'Mediterranean';
  if (searchText.match(/\b(american|burger|bbq|southern|cajun)\b/i)) return 'American';
  return '';
};

// Check if message contains recipes
export const hasRecipes = (message) => {
  return message.includes('**') && 
    message.match(/\b(ingredient|recipe|cook|prep|serve|meal|dish)\b/i) &&
    message.length > 200;
};

// Clickable Recipe Card Component
const RecipeCard = ({ recipe, onSave, onViewDetails }) => {
  return (
    <div 
      className="recipe-visual-card group flex flex-col md:flex-row bg-card rounded-2xl border border-border/40 overflow-hidden hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-pointer"
      onClick={() => onViewDetails(recipe)}
      data-testid="recipe-visual-card"
    >
      {/* Recipe Text - Left Side (50-55%) */}
      <div className="flex-1 p-5 order-2 md:order-1 flex flex-col justify-between">
        <div>
          {/* Title */}
          <h3 className="text-xl font-serif text-foreground leading-tight mb-2 group-hover:text-primary transition-colors">
            {recipe.title}
          </h3>
          
          {/* Difficulty Badge */}
          <div className="mb-3">
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${DIFFICULTY_COLORS[recipe.difficulty] || DIFFICULTY_COLORS['Medium']}`}>
              {recipe.difficulty}
            </span>
          </div>
          
          {/* Description */}
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {recipe.description}
          </p>
        </div>
        
        {/* Metadata & Actions */}
        <div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <div className="flex items-center gap-1.5">
              <Clock size={15} className="text-primary" />
              <span>{recipe.cookingTime || '30 min'}</span>
            </div>
            {recipe.cuisineHint && (
              <div className="flex items-center gap-1.5">
                <Utensils size={15} className="text-primary" />
                <span className="capitalize">{recipe.cuisineHint}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onSave && onSave(recipe);
              }}
              className="rounded-full text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Heart size={14} className="mr-1.5" />
              Save Recipe
            </Button>
            <span className="text-xs text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              View Full Recipe <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </div>
      
      {/* Recipe Image - Right Side (45-50%) */}
      <div className="md:w-[48%] h-56 md:h-auto order-1 md:order-2 relative overflow-hidden">
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            e.target.src = GENERIC_FOOD_IMAGES[0];
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-background/5" />
        
        {/* View Recipe overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all duration-300">
          <span className="px-4 py-2 bg-white/90 rounded-full text-sm font-medium opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 flex items-center gap-2">
            View Recipe <ChevronRight size={16} />
          </span>
        </div>
      </div>
    </div>
  );
};

// Time Category Section
const TimeCategorySection = ({ category, categoryData, onSaveRecipe, onViewRecipe }) => {
  if (categoryData.recipes.length === 0) return null;
  
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{categoryData.icon}</span>
        <h3 className={`text-lg font-serif ${categoryData.color}`}>{categoryData.title}</h3>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary">
          {categoryData.recipes.length} {categoryData.recipes.length === 1 ? 'recipe' : 'recipes'}
        </span>
      </div>
      <div className="space-y-4">
        {categoryData.recipes.map((recipe, idx) => (
          <RecipeCard 
            key={idx} 
            recipe={recipe} 
            onSave={onSaveRecipe}
            onViewDetails={onViewRecipe}
          />
        ))}
      </div>
    </div>
  );
};

// Main component
const RecipeMessageDisplay = ({ message, onSaveRecipe }) => {
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const categories = parseRecipesWithCategories(message);
  const hasAnyRecipes = Object.values(categories).some(cat => cat.recipes.length > 0);
  
  const handleViewRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setShowDetailModal(true);
  };
  
  const handleSaveRecipe = (recipe) => {
    onSaveRecipe && onSaveRecipe(recipe);
  };
  
  if (!hasAnyRecipes) {
    return <p className="whitespace-pre-wrap">{message}</p>;
  }
  
  // Get intro text (before first ### or **)
  const introMatch = message.match(/^([\s\S]*?)(?=###|\*\*)/);
  const introText = introMatch ? introMatch[1].trim() : '';
  
  return (
    <div className="recipe-visual-display space-y-6">
      {/* Intro text */}
      {introText && (
        <p className="text-foreground whitespace-pre-wrap mb-4">{introText}</p>
      )}
      
      {/* Recipe Categories */}
      <TimeCategorySection 
        category="quick" 
        categoryData={categories.quick} 
        onSaveRecipe={handleSaveRecipe}
        onViewRecipe={handleViewRecipe}
      />
      <TimeCategorySection 
        category="moderate" 
        categoryData={categories.moderate} 
        onSaveRecipe={handleSaveRecipe}
        onViewRecipe={handleViewRecipe}
      />
      <TimeCategorySection 
        category="elaborate" 
        categoryData={categories.elaborate} 
        onSaveRecipe={handleSaveRecipe}
        onViewRecipe={handleViewRecipe}
      />
      
      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onSave={handleSaveRecipe}
      />
    </div>
  );
};

export { RecipeMessageDisplay, RecipeCard, parseRecipesWithCategories, getRecipeImage };
export default RecipeMessageDisplay;
