import { Heart, Clock, ChefHat, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Curated high-quality food images from Unsplash (matching backend image_service.py)
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
  
  // Chinese
  'kung pao': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800',
  'mapo tofu': 'https://images.unsplash.com/photo-1582452919408-80d02cb4cf45?w=800',
  'dim sum': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
  'dumplings': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
  'fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
  'stir fry': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800',
  'noodles': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
  'chow mein': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800',
  
  // Italian
  'spaghetti': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
  'carbonara': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
  'pasta': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800',
  'pizza': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
  'risotto': 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800',
  'tiramisu': 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
  'lasagna': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800',
  
  // Mexican
  'tacos': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800',
  'burrito': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800',
  'guacamole': 'https://images.unsplash.com/photo-1604132061973-c90de135f2a4?w=800',
  'enchiladas': 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800',
  'quesadilla': 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800',
  
  // Japanese
  'ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
  'sushi': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
  'teriyaki': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'tempura': 'https://images.unsplash.com/photo-1581781870027-04212e231e96?w=800',
  'miso soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
  'udon': 'https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?w=800',
  
  // Thai
  'pad thai': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
  'green curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  'tom yum': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
  'thai curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  
  // Mediterranean
  'falafel': 'https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?w=800',
  'shakshuka': 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=800',
  'hummus': 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800',
  'kebab': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
  'gyro': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
  
  // Korean
  'bibimbap': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800',
  'bulgogi': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
  'kimchi': 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800',
  'korean bbq': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
  
  // French
  'croissant': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
  'ratatouille': 'https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=800',
  'quiche': 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800',
  'crepe': 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=800',
  
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
  'steak': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800',
  'burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
  'grilled': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800',
  'roasted': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'baked': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
  'bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'breakfast': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
  'dessert': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800',
  'chocolate': 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800',
};

// Fallback images by cuisine type
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

// Parse recipe from message
const parseRecipes = (message) => {
  const recipes = [];
  
  // Look for recipe patterns with ** bold titles **
  const recipePattern = /\*\*([^*]+)\*\*([^*]*?)(?=\*\*|$)/gs;
  let match;
  
  // Section headers to skip (not actual recipe names)
  const skipPatterns = [
    /^(option|tip|note|step|ingredient|instruction|direction|nutritional|sensory|description|serving|highlight|benefit|why this)/i,
    /^(quick|standard|involved)\s+(option|recipe)/i,
    /^\d+\./,  // Numbered items
    /^(prep|cook|total)\s+time/i,
  ];
  
  while ((match = recipePattern.exec(message)) !== null) {
    const title = match[1].trim();
    const content = match[2].trim();
    
    // Skip if title is too short or too long
    if (title.length < 3 || title.length > 100) continue;
    
    // Skip section headers and non-recipe titles
    if (skipPatterns.some(pattern => pattern.test(title))) continue;
    
    // Must look like a food/recipe name (contains food-related words or is capitalized properly)
    const looksLikeRecipe = 
      title.match(/chicken|beef|pork|fish|salmon|shrimp|tofu|vegetable|soup|salad|curry|pasta|rice|noodle|stew|roast|grilled|baked|fried|steamed/i) ||
      title.match(/^[A-Z][a-z]+(\s+[A-Za-z]+)*$/) ||  // Proper case title
      title.match(/\b(dal|paneer|tikka|biryani|ramen|sushi|taco|burrito|pizza|risotto|pad thai|pho|kebab|falafel|hummus|bibimbap|bulgogi)/i);
    
    if (!looksLikeRecipe && !content.match(/ingredient|prep time|cook time|serves/i)) {
      continue;
    }
    
    // Extract cooking time
    const timeMatch = content.match(/(\d+[-–]?\d*)\s*(min|minutes|hour|hours)/i);
    const cookingTime = timeMatch ? timeMatch[0] : null;
    
    // Extract complexity/difficulty hints
    let difficulty = 'Medium';
    if (content.match(/quick|easy|simple|fast|15[-\s]*min/i) || title.match(/quick|easy/i)) difficulty = 'Easy';
    else if (content.match(/involved|complex|hour|advanced|therapeutic/i) || title.match(/involved/i)) difficulty = 'Hard';
    
    // Extract description (first sentence or two)
    const descMatch = content.match(/^([^.!?]*[.!?]){1,2}/);
    const description = descMatch ? descMatch[0].trim() : content.substring(0, 150).trim();
    
    // Detect cuisine type from title and content
    let cuisineHint = '';
    const searchText = (title + ' ' + content).toLowerCase();
    if (searchText.match(/indian|curry|masala|paneer|dal|tikka|biryani|naan|tandoor/i)) cuisineHint = 'indian';
    else if (searchText.match(/chinese|wok|stir.?fry|soy sauce|dumpling|dim sum|szechuan|cantonese/i)) cuisineHint = 'chinese';
    else if (searchText.match(/italian|pasta|risotto|pizza|parmesan|marinara|pesto|lasagna/i)) cuisineHint = 'italian';
    else if (searchText.match(/mexican|taco|salsa|cilantro|lime|avocado|burrito|enchilada|quesadilla/i)) cuisineHint = 'mexican';
    else if (searchText.match(/japanese|miso|sushi|ramen|teriyaki|tempura|udon|sake/i)) cuisineHint = 'japanese';
    else if (searchText.match(/thai|coconut milk|lemongrass|fish sauce|pad thai|tom yum|basil/i)) cuisineHint = 'thai';
    else if (searchText.match(/korean|gochujang|kimchi|sesame|bulgogi|bibimbap|korean bbq/i)) cuisineHint = 'korean';
    else if (searchText.match(/french|butter|wine|cream|provence|bistro|croissant/i)) cuisineHint = 'french';
    else if (searchText.match(/mediterranean|olive oil|feta|hummus|falafel|greek|lebanese/i)) cuisineHint = 'mediterranean';
    
    recipes.push({
      title,
      description: description || 'A delicious mood-boosting recipe',
      cookingTime: cookingTime || '30-45 min',
      difficulty,
      cuisineHint,
      imageUrl: getRecipeImage(title, cuisineHint),
      fullContent: content
    });
  }
  
  return recipes;
};

// Check if message contains recipe suggestions
export const hasRecipes = (message) => {
  // Must have bold titles and recipe-related keywords
  return message.includes('**') && 
    message.match(/ingredient|recipe|cook|prep|serve|meal/i) &&
    message.length > 200;
};

// Recipe Card Component - displays a single recipe with image
const RecipeCard = ({ recipe, onSave }) => {
  return (
    <div 
      className="recipe-visual-card flex flex-col md:flex-row gap-4 bg-card/50 rounded-2xl border border-border/30 overflow-hidden hover:shadow-lg transition-all duration-300"
      data-testid="recipe-visual-card"
    >
      {/* Recipe Text - Left Side (60-70%) */}
      <div className="flex-1 p-5 order-2 md:order-1">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xl font-serif text-foreground leading-tight">
            {recipe.title}
          </h3>
          <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${
            recipe.difficulty === 'Easy' ? 'bg-green-500/10 text-green-600' :
            recipe.difficulty === 'Hard' ? 'bg-red-500/10 text-red-600' :
            'bg-yellow-500/10 text-yellow-600'
          }`}>
            {recipe.difficulty}
          </span>
        </div>
        
        <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
          {recipe.description}
        </p>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          {recipe.cookingTime && (
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>{recipe.cookingTime}</span>
            </div>
          )}
          {recipe.cuisineHint && (
            <div className="flex items-center gap-1">
              <ChefHat size={14} />
              <span className="capitalize">{recipe.cuisineHint}</span>
            </div>
          )}
        </div>
        
        {onSave && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSave(recipe)}
            className="rounded-full text-xs"
          >
            <Heart size={14} className="mr-1" />
            Save Recipe
          </Button>
        )}
      </div>
      
      {/* Recipe Image - Right Side (30-40%) */}
      <div className="md:w-[35%] h-48 md:h-auto order-1 md:order-2 relative overflow-hidden">
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.src = GENERIC_FOOD_IMAGES[0];
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-background/20 md:bg-gradient-to-r" />
      </div>
    </div>
  );
};

// Main component that renders recipe message with visual cards
const RecipeMessageDisplay = ({ message, onSaveRecipe }) => {
  const recipes = parseRecipes(message);
  
  if (recipes.length === 0) {
    // No recipes found, return regular text
    return <p className="whitespace-pre-wrap">{message}</p>;
  }
  
  // Split message into intro and recipe sections
  const introMatch = message.match(/^([\s\S]*?)(?=\*\*)/);
  const introText = introMatch ? introMatch[1].trim() : '';
  
  // Get any closing text after recipes
  const lastRecipeEnd = message.lastIndexOf('**');
  const closingText = lastRecipeEnd > -1 ? 
    message.substring(lastRecipeEnd).replace(/\*\*[^*]+\*\*[\s\S]*$/, '').trim() : '';
  
  return (
    <div className="recipe-visual-display space-y-4">
      {/* Intro text */}
      {introText && (
        <p className="text-foreground whitespace-pre-wrap mb-4">{introText}</p>
      )}
      
      {/* Recipe Cards */}
      <div className="space-y-4">
        {recipes.map((recipe, idx) => (
          <RecipeCard 
            key={idx} 
            recipe={recipe} 
            onSave={onSaveRecipe ? () => onSaveRecipe(recipe) : null}
          />
        ))}
      </div>
      
      {/* Any closing notes */}
      {closingText && (
        <p className="text-muted-foreground text-sm mt-4 whitespace-pre-wrap">{closingText}</p>
      )}
    </div>
  );
};

export { RecipeMessageDisplay, RecipeCard, parseRecipes, getRecipeImage };
export default RecipeMessageDisplay;
