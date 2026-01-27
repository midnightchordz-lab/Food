import { Heart, Clock, ChefHat, Timer, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Curated high-quality food images from Unsplash
const FOOD_IMAGES = {
  // Indian
  'butter chicken': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800',
  'palak paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
  'chicken biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
  'biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
  'dal': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800',
  'curry': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
  'tikka': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800',
  'samosa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
  'naan': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800',
  'paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
  'chana': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
  'masala': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
  'korma': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800',
  
  // Chinese
  'kung pao': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800',
  'mapo tofu': 'https://images.unsplash.com/photo-1582452919408-80d02cb4cf45?w=800',
  'dim sum': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
  'dumplings': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
  'fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
  'stir fry': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800',
  'noodles': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
  'chow mein': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800',
  'tofu': 'https://images.unsplash.com/photo-1582452919408-80d02cb4cf45?w=800',
  'lo mein': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800',
  
  // Italian
  'spaghetti': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
  'carbonara': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
  'pasta': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800',
  'pizza': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
  'risotto': 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800',
  'tiramisu': 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
  'lasagna': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800',
  'penne': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800',
  'alfredo': 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=800',
  'gnocchi': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800',
  
  // Mexican
  'tacos': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800',
  'burrito': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800',
  'guacamole': 'https://images.unsplash.com/photo-1604132061973-c90de135f2a4?w=800',
  'enchiladas': 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800',
  'quesadilla': 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800',
  'nachos': 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=800',
  'fajitas': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800',
  
  // Japanese
  'ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
  'sushi': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
  'teriyaki': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'tempura': 'https://images.unsplash.com/photo-1581781870027-04212e231e96?w=800',
  'miso soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
  'udon': 'https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?w=800',
  'donburi': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
  'edamame': 'https://images.unsplash.com/photo-1564093497595-593b96d80180?w=800',
  
  // Thai
  'pad thai': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
  'green curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  'tom yum': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
  'thai curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  'massaman': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  'satay': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
  
  // Mediterranean
  'falafel': 'https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?w=800',
  'shakshuka': 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=800',
  'hummus': 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800',
  'kebab': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
  'gyro': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
  'pita': 'https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?w=800',
  'greek salad': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
  
  // Korean
  'bibimbap': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800',
  'bulgogi': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
  'kimchi': 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800',
  'korean bbq': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
  'japchae': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
  
  // French
  'croissant': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
  'ratatouille': 'https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=800',
  'quiche': 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800',
  'crepe': 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=800',
  'coq au vin': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  
  // General / Comfort Foods
  'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
  'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  'sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
  'smoothie': 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=800',
  'oatmeal': 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=800',
  'pancakes': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
  'avocado toast': 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=800',
  'chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800',
  'steak': 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
  'burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
  'grilled': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800',
  'roasted': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'baked': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
  'bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'breakfast': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
  'dessert': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800',
  'chocolate': 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800',
  'wrap': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800',
  'veggie': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  'vegetable': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800',
  'shrimp': 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800',
  'fish': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800',
  'egg': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
  'omelet': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
  'quinoa': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'rice bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'grain bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
};

// Cuisine fallbacks
const CUISINE_FALLBACKS = {
  'indian': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
  'chinese': 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800',
  'italian': 'https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=800',
  'mexican': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800',
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
  'Easy': 'bg-green-500/10 text-green-600 border-green-500/30',
  'Medium': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  'Hard': 'bg-red-500/10 text-red-600 border-red-500/30',
};

// Time category badges
const TIME_CATEGORY_COLORS = {
  'quick': 'bg-emerald-500/10 text-emerald-600',
  'moderate': 'bg-blue-500/10 text-blue-600',
  'elaborate': 'bg-purple-500/10 text-purple-600',
};

// Parse recipes with time categories
const parseRecipesWithCategories = (message) => {
  const categories = {
    quick: { title: 'Quick Option (15-20 min)', icon: '⚡', recipes: [] },
    moderate: { title: 'Moderate Option (20-40 min)', icon: '🍳', recipes: [] },
    elaborate: { title: 'Elaborate Option (40-60 min)', icon: '👨‍🍳', recipes: [] },
  };
  
  // Check for time category headers
  const quickMatch = message.match(/###?\s*Quick\s*Option[^#]*(?=###|$)/is);
  const moderateMatch = message.match(/###?\s*Moderate\s*Option[^#]*(?=###|$)/is);
  const elaborateMatch = message.match(/###?\s*Elaborate\s*Option[^#]*(?=###|$)/is);
  
  // Parse recipes from each section
  if (quickMatch) {
    categories.quick.recipes = parseRecipesFromSection(quickMatch[0], 'quick');
  }
  if (moderateMatch) {
    categories.moderate.recipes = parseRecipesFromSection(moderateMatch[0], 'moderate');
  }
  if (elaborateMatch) {
    categories.elaborate.recipes = parseRecipesFromSection(elaborateMatch[0], 'elaborate');
  }
  
  // If no categories found, try general parsing
  if (categories.quick.recipes.length === 0 && 
      categories.moderate.recipes.length === 0 && 
      categories.elaborate.recipes.length === 0) {
    const allRecipes = parseRecipesGeneral(message);
    // Distribute recipes by their cooking time
    allRecipes.forEach(recipe => {
      const time = extractTimeMinutes(recipe.cookingTime);
      if (time <= 20) {
        categories.quick.recipes.push(recipe);
      } else if (time <= 40) {
        categories.moderate.recipes.push(recipe);
      } else {
        categories.elaborate.recipes.push(recipe);
      }
    });
  }
  
  return categories;
};

// Extract time in minutes from string
const extractTimeMinutes = (timeStr) => {
  if (!timeStr) return 30;
  const match = timeStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 30;
};

// Parse recipes from a section
const parseRecipesFromSection = (section, category) => {
  const recipes = [];
  const recipePattern = /\*\*([^*]+)\*\*([^*]*?)(?=\*\*|$)/gs;
  let match;
  
  // Skip patterns
  const skipPatterns = [
    /^(option|tip|note|step|ingredient|instruction|direction|nutritional|sensory|description|serving|highlight|benefit|why this|quick|moderate|elaborate)/i,
    /^\d+\./,
    /^(prep|cook|total)\s+time/i,
  ];
  
  while ((match = recipePattern.exec(section)) !== null) {
    const title = match[1].trim();
    const content = match[2].trim();
    
    if (title.length < 3 || title.length > 100) continue;
    if (skipPatterns.some(pattern => pattern.test(title))) continue;
    
    // Extract time from title or content
    const titleTimeMatch = title.match(/\((\d+[-–]?\d*\s*(?:min|minutes?))\)/i);
    const contentTimeMatch = content.match(/(\d+[-–]?\d*)\s*(min|minutes|hour|hours)/i);
    let cookingTime = titleTimeMatch ? titleTimeMatch[1] : (contentTimeMatch ? contentTimeMatch[0] : getCategoryDefaultTime(category));
    
    // Clean title (remove time from it)
    const cleanTitle = title.replace(/\s*\(\d+[-–]?\d*\s*(?:min|minutes?)\)/i, '').trim();
    
    // Determine difficulty
    let difficulty = 'Medium';
    if (category === 'quick' || content.match(/quick|easy|simple|fast/i)) difficulty = 'Easy';
    else if (category === 'elaborate' || content.match(/involved|complex|advanced/i)) difficulty = 'Hard';
    
    // Get description
    const descMatch = content.match(/^([^.!?]*[.!?]){1,2}/);
    const description = descMatch ? descMatch[0].trim() : content.substring(0, 150).trim();
    
    // Detect cuisine
    const cuisineHint = detectCuisine(cleanTitle + ' ' + content);
    
    recipes.push({
      title: cleanTitle,
      description: description || 'A delicious mood-boosting recipe',
      cookingTime,
      difficulty,
      cuisineHint,
      category,
      imageUrl: getRecipeImage(cleanTitle, cuisineHint),
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
    /^(option|tip|note|step|ingredient|instruction|direction|nutritional|sensory|description|serving|highlight|benefit|why this)/i,
    /^(quick|standard|involved|moderate|elaborate)\s+(option|recipe)/i,
    /^\d+\./,
    /^(prep|cook|total)\s+time/i,
  ];
  
  while ((match = recipePattern.exec(message)) !== null) {
    const title = match[1].trim();
    const content = match[2].trim();
    
    if (title.length < 3 || title.length > 100) continue;
    if (skipPatterns.some(pattern => pattern.test(title))) continue;
    
    // Must look like a food/recipe name
    const looksLikeRecipe = 
      title.match(/chicken|beef|pork|fish|salmon|shrimp|tofu|vegetable|soup|salad|curry|pasta|rice|noodle|stew|roast|grilled|baked|fried|steamed|bowl|wrap|taco|pizza/i) ||
      title.match(/^[A-Z][a-z]+(\s+[A-Za-z]+)*$/) ||
      title.match(/\b(dal|paneer|tikka|biryani|ramen|sushi|burrito|risotto|pad thai|pho|kebab|falafel|hummus|bibimbap|bulgogi|quesadilla)\b/i);
    
    if (!looksLikeRecipe && !content.match(/ingredient|prep time|cook time|serves/i)) {
      continue;
    }
    
    const titleTimeMatch = title.match(/\((\d+[-–]?\d*\s*(?:min|minutes?))\)/i);
    const contentTimeMatch = content.match(/(\d+[-–]?\d*)\s*(min|minutes|hour|hours)/i);
    const cookingTime = titleTimeMatch ? titleTimeMatch[1] : (contentTimeMatch ? contentTimeMatch[0] : '30 min');
    
    const cleanTitle = title.replace(/\s*\(\d+[-–]?\d*\s*(?:min|minutes?)\)/i, '').trim();
    
    let difficulty = 'Medium';
    if (content.match(/quick|easy|simple|fast|15[-\s]*min/i) || title.match(/quick|easy/i)) difficulty = 'Easy';
    else if (content.match(/involved|complex|hour|advanced/i) || title.match(/involved/i)) difficulty = 'Hard';
    
    const descMatch = content.match(/^([^.!?]*[.!?]){1,2}/);
    const description = descMatch ? descMatch[0].trim() : content.substring(0, 150).trim();
    
    const cuisineHint = detectCuisine(cleanTitle + ' ' + content);
    
    recipes.push({
      title: cleanTitle,
      description: description || 'A delicious mood-boosting recipe',
      cookingTime,
      difficulty,
      cuisineHint,
      imageUrl: getRecipeImage(cleanTitle, cuisineHint),
      fullContent: content
    });
  }
  
  return recipes;
};

// Detect cuisine from text
const detectCuisine = (text) => {
  const searchText = text.toLowerCase();
  if (searchText.match(/indian|curry|masala|paneer|dal|tikka|biryani|naan|tandoor|chana/i)) return 'Indian';
  if (searchText.match(/chinese|wok|stir.?fry|soy sauce|dumpling|dim sum|szechuan|cantonese|lo mein/i)) return 'Chinese';
  if (searchText.match(/italian|pasta|risotto|pizza|parmesan|marinara|pesto|lasagna|penne|gnocchi/i)) return 'Italian';
  if (searchText.match(/mexican|taco|salsa|cilantro|lime|avocado|burrito|enchilada|quesadilla|fajita/i)) return 'Mexican';
  if (searchText.match(/japanese|miso|sushi|ramen|teriyaki|tempura|udon|sake|donburi/i)) return 'Japanese';
  if (searchText.match(/thai|coconut milk|lemongrass|fish sauce|pad thai|tom yum|basil|massaman/i)) return 'Thai';
  if (searchText.match(/korean|gochujang|kimchi|sesame|bulgogi|bibimbap|korean bbq|japchae/i)) return 'Korean';
  if (searchText.match(/french|butter|wine|cream|provence|bistro|croissant|coq au vin/i)) return 'French';
  if (searchText.match(/mediterranean|olive oil|feta|hummus|falafel|greek|lebanese|pita/i)) return 'Mediterranean';
  if (searchText.match(/american|burger|bbq|southern|cajun/i)) return 'American';
  return '';
};

// Check if message contains recipes
export const hasRecipes = (message) => {
  return message.includes('**') && 
    message.match(/ingredient|recipe|cook|prep|serve|meal/i) &&
    message.length > 200;
};

// Recipe Card Component
const RecipeCard = ({ recipe, onSave }) => {
  return (
    <div 
      className="recipe-visual-card flex flex-col md:flex-row bg-card rounded-2xl border border-border/40 overflow-hidden hover:shadow-xl transition-all duration-300"
      data-testid="recipe-visual-card"
    >
      {/* Recipe Text - Left Side (50-60%) */}
      <div className="flex-1 p-5 order-2 md:order-1 flex flex-col justify-between">
        <div>
          {/* Title with Time */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-xl font-serif text-foreground leading-tight flex-1">
              {recipe.title}
              {recipe.cookingTime && (
                <span className="text-muted-foreground text-base font-normal ml-2">
                  ({recipe.cookingTime})
                </span>
              )}
            </h3>
          </div>
          
          {/* Difficulty Badge */}
          <div className="mb-3">
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${DIFFICULTY_COLORS[recipe.difficulty] || DIFFICULTY_COLORS['Medium']}`}>
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
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-primary" />
              <span>{recipe.cookingTime || '30 min'}</span>
            </div>
            {recipe.cuisineHint && (
              <div className="flex items-center gap-1.5">
                <Utensils size={14} className="text-accent" />
                <span className="capitalize">{recipe.cuisineHint}</span>
              </div>
            )}
          </div>
          
          {onSave && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSave(recipe)}
              className="rounded-full text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Heart size={14} className="mr-1.5" />
              Save Recipe
            </Button>
          )}
        </div>
      </div>
      
      {/* Recipe Image - Right Side (40-50%) */}
      <div className="md:w-[45%] h-52 md:h-auto order-1 md:order-2 relative overflow-hidden">
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          onError={(e) => {
            e.target.src = GENERIC_FOOD_IMAGES[0];
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-background/10" />
      </div>
    </div>
  );
};

// Time Category Section
const TimeCategorySection = ({ category, categoryData, onSaveRecipe }) => {
  if (categoryData.recipes.length === 0) return null;
  
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{categoryData.icon}</span>
        <h3 className="text-lg font-serif text-foreground">{categoryData.title}</h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIME_CATEGORY_COLORS[category]}`}>
          {categoryData.recipes.length} {categoryData.recipes.length === 1 ? 'recipe' : 'recipes'}
        </span>
      </div>
      <div className="space-y-4">
        {categoryData.recipes.map((recipe, idx) => (
          <RecipeCard 
            key={idx} 
            recipe={recipe} 
            onSave={onSaveRecipe}
          />
        ))}
      </div>
    </div>
  );
};

// Main component
const RecipeMessageDisplay = ({ message, onSaveRecipe }) => {
  const categories = parseRecipesWithCategories(message);
  const hasAnyRecipes = Object.values(categories).some(cat => cat.recipes.length > 0);
  
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
        onSaveRecipe={onSaveRecipe}
      />
      <TimeCategorySection 
        category="moderate" 
        categoryData={categories.moderate} 
        onSaveRecipe={onSaveRecipe}
      />
      <TimeCategorySection 
        category="elaborate" 
        categoryData={categories.elaborate} 
        onSaveRecipe={onSaveRecipe}
      />
    </div>
  );
};

export { RecipeMessageDisplay, RecipeCard, parseRecipesWithCategories, getRecipeImage };
export default RecipeMessageDisplay;
