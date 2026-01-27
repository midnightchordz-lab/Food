import { useState } from 'react';
import { 
  Heart, Clock, ChefHat, Utensils, Users, Flame, Printer, 
  Share2, Star, ShoppingCart, BookOpen, X, ChevronRight,
  Timer, Leaf, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Generate detailed recipe data from basic recipe info
const generateDetailedRecipe = (recipe) => {
  // Base ingredients and instructions based on recipe type
  const recipeTemplates = {
    salad: {
      ingredients: [
        { amount: '1 cup', item: 'quinoa, rinsed' },
        { amount: '2 cups', item: 'water or vegetable broth' },
        { amount: '1 cup', item: 'cherry tomatoes, halved' },
        { amount: '1', item: 'cucumber, diced' },
        { amount: '½ cup', item: 'red onion, finely diced' },
        { amount: '¼ cup', item: 'fresh herbs (basil, parsley)' },
        { amount: '3 tbsp', item: 'olive oil' },
        { amount: '2 tbsp', item: 'lemon juice' },
        { amount: '', item: 'Salt and pepper to taste' },
      ],
      instructions: [
        { step: 1, text: 'Rinse quinoa under cold water. Combine quinoa and water in a saucepan, bring to a boil.', time: '2 min' },
        { step: 2, text: 'Reduce heat to low, cover, and simmer until water is absorbed.', time: '15 min' },
        { step: 3, text: 'Fluff quinoa with a fork and let cool to room temperature.', time: '10 min' },
        { step: 4, text: 'In a large bowl, combine cooled quinoa with tomatoes, cucumber, and onion.' },
        { step: 5, text: 'Whisk together olive oil, lemon juice, salt, and pepper for the dressing.' },
        { step: 6, text: 'Pour dressing over salad, toss gently. Garnish with fresh herbs and serve.' },
      ],
      nutrition: { calories: 285, protein: 8, carbs: 32, fat: 14, fiber: 5 },
      tips: ['Make ahead: Store dressed salad up to 2 days', 'Add feta cheese for extra protein', 'Toast quinoa before cooking for nutty flavor'],
    },
    curry: {
      ingredients: [
        { amount: '1 lb', item: 'protein (chicken, tofu, or chickpeas)' },
        { amount: '1 can', item: 'coconut milk (400ml)' },
        { amount: '2 tbsp', item: 'curry paste or powder' },
        { amount: '1', item: 'onion, diced' },
        { amount: '3 cloves', item: 'garlic, minced' },
        { amount: '1 inch', item: 'ginger, grated' },
        { amount: '2 cups', item: 'vegetables (bell peppers, spinach)' },
        { amount: '2 tbsp', item: 'vegetable oil' },
        { amount: '', item: 'Fresh cilantro for garnish' },
      ],
      instructions: [
        { step: 1, text: 'Heat oil in a large pan over medium-high heat. Add onion and cook until softened.', time: '5 min' },
        { step: 2, text: 'Add garlic and ginger, sauté until fragrant.', time: '1 min' },
        { step: 3, text: 'Stir in curry paste/powder, coating the aromatics evenly.', time: '1 min' },
        { step: 4, text: 'Add protein and cook until browned on all sides.', time: '5-8 min' },
        { step: 5, text: 'Pour in coconut milk, bring to a simmer. Add vegetables.', time: '10 min' },
        { step: 6, text: 'Simmer until sauce thickens and protein is cooked through. Season to taste.' },
        { step: 7, text: 'Garnish with fresh cilantro. Serve over rice or with naan bread.' },
      ],
      nutrition: { calories: 420, protein: 28, carbs: 18, fat: 28, fiber: 4 },
      tips: ['Adjust spice level with more or less curry paste', 'Coconut cream makes it richer', 'Great for meal prep - freezes well'],
    },
    pasta: {
      ingredients: [
        { amount: '12 oz', item: 'pasta of choice' },
        { amount: '2 tbsp', item: 'olive oil' },
        { amount: '4 cloves', item: 'garlic, minced' },
        { amount: '1 can', item: 'crushed tomatoes (14 oz)' },
        { amount: '½ cup', item: 'fresh basil, chopped' },
        { amount: '½ cup', item: 'parmesan cheese, grated' },
        { amount: '¼ tsp', item: 'red pepper flakes' },
        { amount: '', item: 'Salt and pepper to taste' },
        { amount: '½ cup', item: 'pasta water (reserved)' },
      ],
      instructions: [
        { step: 1, text: 'Bring a large pot of salted water to boil. Cook pasta according to package directions.', time: '10-12 min' },
        { step: 2, text: 'Reserve ½ cup pasta water before draining.' },
        { step: 3, text: 'In a large skillet, heat olive oil over medium heat. Add garlic and red pepper flakes.', time: '1 min' },
        { step: 4, text: 'Add crushed tomatoes, simmer until slightly thickened.', time: '8 min' },
        { step: 5, text: 'Toss drained pasta with sauce. Add pasta water as needed for consistency.' },
        { step: 6, text: 'Remove from heat, stir in half the basil and parmesan. Season to taste.' },
        { step: 7, text: 'Serve topped with remaining basil and parmesan.' },
      ],
      nutrition: { calories: 380, protein: 14, carbs: 58, fat: 12, fiber: 4 },
      tips: ['Always salt your pasta water generously', 'Fresh pasta cooks in 2-3 minutes', 'Add pasta to sauce, not sauce to pasta'],
    },
    stir_fry: {
      ingredients: [
        { amount: '1 lb', item: 'protein (chicken, shrimp, or tofu), sliced' },
        { amount: '3 cups', item: 'mixed vegetables (broccoli, bell peppers, snap peas)' },
        { amount: '3 tbsp', item: 'soy sauce' },
        { amount: '1 tbsp', item: 'sesame oil' },
        { amount: '2 tbsp', item: 'vegetable oil' },
        { amount: '2 cloves', item: 'garlic, minced' },
        { amount: '1 tsp', item: 'ginger, grated' },
        { amount: '1 tbsp', item: 'cornstarch + 2 tbsp water (slurry)' },
        { amount: '', item: 'Sesame seeds and green onions for garnish' },
      ],
      instructions: [
        { step: 1, text: 'Prepare all ingredients - slice protein, chop vegetables, make cornstarch slurry.', time: '10 min' },
        { step: 2, text: 'Heat vegetable oil in wok or large skillet over high heat until smoking.' },
        { step: 3, text: 'Add protein in single layer, cook without stirring until seared.', time: '2-3 min' },
        { step: 4, text: 'Flip and cook other side. Remove and set aside.' },
        { step: 5, text: 'Add more oil if needed. Stir-fry vegetables until crisp-tender.', time: '3-4 min' },
        { step: 6, text: 'Add garlic and ginger, cook 30 seconds. Return protein to pan.' },
        { step: 7, text: 'Add soy sauce and sesame oil. Stir in cornstarch slurry to thicken.' },
        { step: 8, text: 'Garnish with sesame seeds and green onions. Serve over rice.' },
      ],
      nutrition: { calories: 340, protein: 32, carbs: 18, fat: 16, fiber: 4 },
      tips: ['High heat is essential for proper stir-frying', 'Don\'t overcrowd the pan', 'Prep everything before you start cooking'],
    },
    soup: {
      ingredients: [
        { amount: '2 tbsp', item: 'olive oil or butter' },
        { amount: '1', item: 'onion, diced' },
        { amount: '2', item: 'carrots, diced' },
        { amount: '2 stalks', item: 'celery, diced' },
        { amount: '4 cups', item: 'broth (chicken or vegetable)' },
        { amount: '1 can', item: 'diced tomatoes (optional)' },
        { amount: '2 cups', item: 'main ingredient (beans, lentils, or vegetables)' },
        { amount: '', item: 'Fresh herbs (thyme, bay leaf)' },
        { amount: '', item: 'Salt and pepper to taste' },
      ],
      instructions: [
        { step: 1, text: 'Heat oil in a large pot over medium heat. Add onion, carrots, and celery.', time: '5 min' },
        { step: 2, text: 'Cook until vegetables are softened, stirring occasionally.' },
        { step: 3, text: 'Add garlic and herbs, cook until fragrant.', time: '1 min' },
        { step: 4, text: 'Pour in broth and tomatoes. Bring to a boil.' },
        { step: 5, text: 'Add main ingredient (beans, lentils, etc.). Reduce heat to simmer.', time: '20-30 min' },
        { step: 6, text: 'Simmer until all ingredients are tender and flavors have melded.' },
        { step: 7, text: 'Season with salt and pepper. Remove bay leaf before serving.' },
      ],
      nutrition: { calories: 220, protein: 12, carbs: 28, fat: 8, fiber: 8 },
      tips: ['Soup tastes even better the next day', 'Freeze in portions for easy meals', 'Add a parmesan rind while simmering for extra flavor'],
    },
    default: {
      ingredients: [
        { amount: '1 lb', item: 'main protein or vegetable' },
        { amount: '2 tbsp', item: 'cooking oil' },
        { amount: '1', item: 'onion, diced' },
        { amount: '3 cloves', item: 'garlic, minced' },
        { amount: '1 cup', item: 'sauce or broth' },
        { amount: '2 cups', item: 'vegetables or grains' },
        { amount: '', item: 'Herbs and spices to taste' },
        { amount: '', item: 'Salt and pepper' },
      ],
      instructions: [
        { step: 1, text: 'Prepare all ingredients - wash, chop, and measure as needed.', time: '10 min' },
        { step: 2, text: 'Heat oil in a large pan over medium-high heat.' },
        { step: 3, text: 'Add aromatics (onion, garlic) and cook until fragrant.', time: '3-4 min' },
        { step: 4, text: 'Add main ingredient and cook according to type.', time: '5-10 min' },
        { step: 5, text: 'Add sauce or broth and remaining ingredients.' },
        { step: 6, text: 'Simmer until everything is cooked through and flavors meld.', time: '10-15 min' },
        { step: 7, text: 'Season to taste and garnish before serving.' },
      ],
      nutrition: { calories: 350, protein: 20, carbs: 30, fat: 15, fiber: 5 },
      tips: ['Taste as you cook and adjust seasonings', 'Let meat rest before slicing', 'Fresh ingredients make a difference'],
    }
  };

  // Determine recipe type based on title
  const title = recipe.title.toLowerCase();
  let template = recipeTemplates.default;
  
  if (title.includes('salad') || title.includes('bowl')) {
    template = recipeTemplates.salad;
  } else if (title.includes('curry') || title.includes('masala') || title.includes('tikka')) {
    template = recipeTemplates.curry;
  } else if (title.includes('pasta') || title.includes('spaghetti') || title.includes('penne') || title.includes('noodle')) {
    template = recipeTemplates.pasta;
  } else if (title.includes('stir') || title.includes('fry') || title.includes('wok')) {
    template = recipeTemplates.stir_fry;
  } else if (title.includes('soup') || title.includes('stew') || title.includes('chili')) {
    template = recipeTemplates.soup;
  }

  return {
    ...recipe,
    servings: 4,
    prepTime: '10 min',
    totalTime: recipe.cookingTime || '30 min',
    ingredients: template.ingredients,
    instructions: template.instructions,
    nutrition: template.nutrition,
    tips: template.tips,
    dietaryTags: getDietaryTags(recipe),
    pairings: getPairings(recipe),
    storage: 'Store in an airtight container in the refrigerator for up to 3-4 days. Reheat gently on stovetop or microwave.',
    substitutions: getSubstitutions(recipe),
  };
};

// Get dietary tags based on recipe
const getDietaryTags = (recipe) => {
  const tags = [];
  const title = (recipe.title + ' ' + recipe.description).toLowerCase();
  
  if (title.includes('vegan') || (!title.includes('chicken') && !title.includes('beef') && !title.includes('pork') && !title.includes('fish') && !title.includes('shrimp') && !title.includes('egg') && !title.includes('cheese') && !title.includes('cream'))) {
    tags.push('Vegan-Friendly');
  }
  if (!title.includes('meat') && !title.includes('chicken') && !title.includes('beef') && !title.includes('pork')) {
    tags.push('Vegetarian');
  }
  if (!title.includes('gluten') && !title.includes('bread') && !title.includes('pasta') && !title.includes('flour')) {
    tags.push('Gluten-Free Option');
  }
  if (title.includes('quick') || title.includes('easy') || title.includes('15 min')) {
    tags.push('Quick & Easy');
  }
  
  return tags.slice(0, 3);
};

// Get pairing suggestions
const getPairings = (recipe) => {
  const cuisine = (recipe.cuisineHint || '').toLowerCase();
  
  const pairings = {
    indian: ['Basmati rice', 'Naan bread', 'Raita (yogurt sauce)', 'Mango lassi'],
    italian: ['Crusty bread', 'Green salad', 'Red wine', 'Tiramisu for dessert'],
    mexican: ['Rice and beans', 'Tortilla chips', 'Margarita', 'Churros'],
    chinese: ['Steamed rice', 'Egg drop soup', 'Green tea', 'Fortune cookies'],
    japanese: ['Miso soup', 'Edamame', 'Sake or green tea', 'Mochi ice cream'],
    thai: ['Jasmine rice', 'Spring rolls', 'Thai iced tea', 'Fresh fruit'],
    mediterranean: ['Pita bread', 'Greek salad', 'Hummus', 'Baklava'],
    korean: ['Kimchi', 'Steamed rice', 'Soju or barley tea', 'Korean pancakes'],
    default: ['Fresh salad', 'Crusty bread', 'Your favorite beverage', 'Light dessert'],
  };
  
  return pairings[cuisine] || pairings.default;
};

// Get substitution suggestions
const getSubstitutions = (recipe) => {
  return [
    'Swap protein for tofu or tempeh for a vegetarian version',
    'Use gluten-free alternatives where applicable',
    'Replace dairy with coconut or oat-based alternatives',
    'Adjust spice levels to your preference',
  ];
};

// Star Rating Component
const StarRating = ({ rating, onRate }) => {
  const [hover, setHover] = useState(0);
  
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onRate && onRate(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={`transition-colors ${onRate ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <Star
            size={20}
            className={`${
              star <= (hover || rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

// Recipe Detail Modal Component
const RecipeDetailModal = ({ recipe, isOpen, onClose, onSave, onAddToShoppingList }) => {
  const [userRating, setUserRating] = useState(0);
  const [servings, setServings] = useState(4);
  
  // Early return if no recipe - must be before any hooks that depend on recipe
  if (!recipe) return null;
  
  const detailedRecipe = generateDetailedRecipe(recipe);
  
  const handlePrint = () => {
    window.print();
    toast.success('Print dialog opened');
  };
  
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: recipe.title,
          text: `Check out this recipe: ${recipe.title}`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(`${recipe.title} - ${window.location.href}`);
      toast.success('Recipe link copied to clipboard!');
    }
  };
  
  const handleAddToShoppingList = async () => {
    try {
      const ingredients = detailedRecipe.ingredients.map(i => `${i.amount} ${i.item}`);
      await axios.post(`${API}/shopping-list`, {
        recipe_name: recipe.title,
        items: ingredients
      });
      toast.success('Ingredients added to shopping list!');
      onAddToShoppingList && onAddToShoppingList(ingredients);
    } catch (error) {
      toast.error('Failed to add to shopping list');
    }
  };
  
  const handleRate = (rating) => {
    setUserRating(rating);
    toast.success(`Rated ${recipe.title} ${rating} stars!`);
  };
  
  // Scale ingredient amounts
  const scaleAmount = (amount, baseServings = 4) => {
    if (!amount) return '';
    const match = amount.match(/^([\d./]+)/);
    if (!match) return amount;
    
    const num = eval(match[1]);
    const scaled = (num * servings / baseServings).toFixed(1).replace(/\.0$/, '');
    return amount.replace(match[1], scaled);
  };

  if (!recipe) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0" data-testid="recipe-detail-modal">
        <DialogHeader className="sr-only">
          <DialogTitle>{recipe.title}</DialogTitle>
          <DialogDescription>Full recipe details for {recipe.title}</DialogDescription>
        </DialogHeader>
        
        {/* Hero Section */}
        <div className="relative h-64 md:h-80 overflow-hidden">
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X size={20} />
          </button>
          
          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <h1 className="text-3xl md:text-4xl font-serif mb-2">{recipe.title}</h1>
            <div className="flex flex-wrap gap-2">
              {detailedRecipe.dietaryTags.map((tag, idx) => (
                <span key={idx} className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {/* Quick Info Bar */}
          <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total Time</p>
                <p className="font-medium">{detailedRecipe.totalTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Timer size={18} className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Prep Time</p>
                <p className="font-medium">{detailedRecipe.prepTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Servings</p>
                <select 
                  value={servings} 
                  onChange={(e) => setServings(Number(e.target.value))}
                  className="font-medium bg-transparent border rounded px-2 py-0.5"
                >
                  {[2, 4, 6, 8].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ChefHat size={18} className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Difficulty</p>
                <p className="font-medium">{recipe.difficulty}</p>
              </div>
            </div>
            {recipe.cuisineHint && (
              <div className="flex items-center gap-2">
                <Utensils size={18} className="text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Cuisine</p>
                  <p className="font-medium capitalize">{recipe.cuisineHint}</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-8">
            <Button onClick={() => onSave && onSave(recipe)} className="rounded-full">
              <Heart size={16} className="mr-2" />
              Save Recipe
            </Button>
            <Button variant="outline" onClick={handleAddToShoppingList} className="rounded-full">
              <ShoppingCart size={16} className="mr-2" />
              Add to Shopping List
            </Button>
            <Button variant="outline" onClick={handleShare} className="rounded-full">
              <Share2 size={16} className="mr-2" />
              Share
            </Button>
            <Button variant="outline" onClick={handlePrint} className="rounded-full">
              <Printer size={16} className="mr-2" />
              Print
            </Button>
          </div>
          
          {/* Description */}
          <p className="text-muted-foreground mb-8">{recipe.description}</p>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Ingredients */}
            <div>
              <h2 className="text-xl font-serif mb-4 flex items-center gap-2">
                <Leaf size={20} className="text-green-600" />
                Ingredients
              </h2>
              <ul className="space-y-2">
                {detailedRecipe.ingredients.map((ing, idx) => (
                  <li key={idx} className="flex items-start gap-2 p-2 hover:bg-secondary/30 rounded-lg transition-colors">
                    <input type="checkbox" className="mt-1 rounded" />
                    <span>
                      <strong className="text-primary">{scaleAmount(ing.amount)}</strong> {ing.item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Nutrition */}
            <div>
              <h2 className="text-xl font-serif mb-4 flex items-center gap-2">
                <Flame size={20} className="text-orange-500" />
                Nutrition (per serving)
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(detailedRecipe.nutrition).map(([key, value]) => (
                  <div key={key} className="bg-secondary/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{value}{key === 'calories' ? '' : 'g'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{key}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Instructions */}
          <div className="mt-8">
            <h2 className="text-xl font-serif mb-4 flex items-center gap-2">
              <BookOpen size={20} className="text-blue-600" />
              Step-by-Step Instructions
            </h2>
            <ol className="space-y-4">
              {detailedRecipe.instructions.map((inst, idx) => (
                <li key={idx} className="flex gap-4 p-4 bg-secondary/20 rounded-xl hover:bg-secondary/30 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    {inst.step}
                  </div>
                  <div className="flex-1">
                    <p>{inst.text}</p>
                    {inst.time && (
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock size={14} /> {inst.time}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
          
          {/* Tips */}
          <div className="mt-8 p-4 bg-yellow-500/10 rounded-xl">
            <h2 className="text-lg font-serif mb-3 flex items-center gap-2">
              <AlertCircle size={18} className="text-yellow-600" />
              Chef's Tips
            </h2>
            <ul className="space-y-2">
              {detailedRecipe.tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <ChevronRight size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Pairings */}
          <div className="mt-8">
            <h2 className="text-lg font-serif mb-3">Perfect Pairings</h2>
            <div className="flex flex-wrap gap-2">
              {detailedRecipe.pairings.map((pairing, idx) => (
                <span key={idx} className="px-3 py-1.5 bg-secondary rounded-full text-sm">
                  {pairing}
                </span>
              ))}
            </div>
          </div>
          
          {/* Storage */}
          <div className="mt-8 p-4 bg-blue-500/10 rounded-xl">
            <h2 className="text-lg font-serif mb-2">Storage Instructions</h2>
            <p className="text-sm text-muted-foreground">{detailedRecipe.storage}</p>
          </div>
          
          {/* Rating */}
          <div className="mt-8 pt-6 border-t text-center">
            <h2 className="text-lg font-serif mb-3">Rate This Recipe</h2>
            <div className="flex justify-center mb-2">
              <StarRating rating={userRating} onRate={handleRate} />
            </div>
            <p className="text-sm text-muted-foreground">
              {userRating > 0 ? `You rated this ${userRating} stars` : 'Click to rate'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecipeDetailModal;
export { generateDetailedRecipe, StarRating };
