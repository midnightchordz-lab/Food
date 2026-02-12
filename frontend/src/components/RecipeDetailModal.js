import { useState, useEffect } from 'react';
import { 
  Heart, Clock, ChefHat, Utensils, Users, Flame, Printer, 
  Share2, Star, ShoppingCart, BookOpen, X, ChevronRight, ChevronLeft,
  Timer, Leaf, AlertCircle, Check, Plus, Loader2, RefreshCw,
  Thermometer, Package, Info, AlertTriangle, Wine, GlassWater, Sparkles,
  DollarSign, Volume2, HelpCircle
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
import { useShoppingCart } from '@/context/ShoppingCartContext';
import BuyIngredientsSheet from './BuyIngredientsSheet';
import RecipeVoicePlayer from './RecipeVoicePlayer';
import CookingModePlayer from './CookingModePlayer';
import IngredientInfoPopup from './IngredientInfoPopup';
import { useLiveCooking } from '@/stores/useLiveCooking';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Parse detailed recipe markdown into structured sections
const parseDetailedRecipe = (markdown) => {
  if (!markdown) return null;
  
  // Clean up the markdown - remove mood-boosting sections before parsing
  let cleanedMarkdown = markdown
    .replace(/^#\s*Mood-?Boosting\s*Benefits?[\s\S]*?(?=^#[^#])/mi, '')
    .replace(/^##\s*Mood-?Boosting\s*Benefits?[\s\S]*?(?=^##|$)/gmi, '')
    .trim();
  
  const sections = {
    title: '',
    info: {},
    description: '',
    ingredients: [],
    equipment: [],
    instructions: [],
    tips: [],
    nutrition: {},
    storage: {},
    drinkPairings: { nonAlcoholic: [], alcoholic: [] },
    variations: [],
    mistakes: []
  };
  
  // Extract title - skip mood/benefit headers
  const titleMatch = cleanedMarkdown.match(/^#\s+(.+?)$/m);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    if (!/mood|benefits?|tips?|nutrition|storage|variation/i.test(title)) {
      sections.title = title;
    }
  }
  
  // Extract Recipe Information
  const infoSection = markdown.match(/## Recipe Information([\s\S]*?)(?=##|$)/i);
  if (infoSection) {
    const infoText = infoSection[1];
    sections.info.cuisine = infoText.match(/\*\*Cuisine:\*\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
    sections.info.mealType = infoText.match(/\*\*Meal Type:\*\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
    sections.info.difficulty = infoText.match(/\*\*Difficulty:\*\*\s*([^\n*]+)/i)?.[1]?.trim() || 'Medium';
    sections.info.servings = infoText.match(/\*\*Servings:\*\*\s*([^\n*]+)/i)?.[1]?.trim() || '4';
    sections.info.prepTime = infoText.match(/\*\*Prep Time:\*\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
    sections.info.cookTime = infoText.match(/\*\*Cook Time:\*\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
    sections.info.totalTime = infoText.match(/\*\*Total Time:\*\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
    sections.info.dietaryTags = infoText.match(/\*\*Dietary Tags:\*\*\s*([^\n]+)/i)?.[1]?.trim() || '';
  }
  
  // Extract Description
  const descSection = markdown.match(/## Description([\s\S]*?)(?=##|$)/i);
  if (descSection) {
    sections.description = descSection[1].trim().replace(/^\n+|\n+$/g, '');
  }
  
  // Extract Ingredients
  const ingredientsSection = markdown.match(/## 🥕 Ingredients([\s\S]*?)(?=##|$)/i) ||
                              markdown.match(/## Ingredients([\s\S]*?)(?=##|$)/i);
  if (ingredientsSection) {
    const ingredientText = ingredientsSection[1];
    // Parse ingredient categories
    const categoryMatches = ingredientText.matchAll(/\*\*([^*]+):\*\*([\s\S]*?)(?=\*\*|$)/g);
    for (const match of categoryMatches) {
      const category = match[1].trim();
      const items = match[2].split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => {
          const text = line.replace(/^-\s*/, '').trim();
          const amountMatch = text.match(/^([\d½¼¾⅓⅔\s\/]+(?:cup|cups|tbsp|tsp|oz|lb|lbs|g|kg|ml|large|medium|small|cloves?)?s?)\s+(.+)$/i);
          if (amountMatch) {
            return { amount: amountMatch[1].trim(), item: amountMatch[2].trim(), category };
          }
          return { amount: '', item: text, category };
        });
      sections.ingredients.push(...items);
    }
    // If no categories found, parse flat list
    if (sections.ingredients.length === 0) {
      sections.ingredients = ingredientText.split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => {
          const text = line.replace(/^-\s*/, '').trim();
          return { amount: '', item: text, category: 'Ingredients' };
        });
    }
  }
  
  // Extract Equipment
  const equipmentSection = markdown.match(/## 🔧 Equipment Needed([\s\S]*?)(?=##|$)/i) ||
                           markdown.match(/## Equipment([\s\S]*?)(?=##|$)/i);
  if (equipmentSection) {
    sections.equipment = equipmentSection[1].split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim());
  }
  
  // Extract Instructions
  const instructionsSection = markdown.match(/## 📋 Step-by-Step Instructions([\s\S]*?)(?=##|$)/i) ||
                              markdown.match(/## Step-by-Step Instructions([\s\S]*?)(?=##|$)/i) ||
                              markdown.match(/## Instructions([\s\S]*?)(?=##|$)/i);
  if (instructionsSection) {
    const instructionText = instructionsSection[1];
    
    // Parse step format: **Step X** (Y minutes) OR **Step X (Y minutes)**
    // Format 1: **Step 1** (10 minutes) - step number outside parens
    // Format 2: **Step 1 (10 minutes)** - time inside bold
    const stepMatches = instructionText.matchAll(/\*\*(?:Step\s*)?(\d+)(?:\*\*\s*\(([^)]+)\)|\s*\(([^)]+)\)\*\*)\s*([\s\S]*?)(?=\*\*(?:Step|Final)|$)/gi);
    for (const match of stepMatches) {
      const stepNum = parseInt(match[1]);
      const time = (match[2] || match[3] || '').trim();
      let text = (match[4] || '').trim();
      
      // Extract visual cue and audio cue
      const visualCue = text.match(/\*Visual Cue:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      const audioCue = text.match(/\*Audio Cue:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      const important = text.match(/\*Important:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      const technique = text.match(/\*Technique[^:]*:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      const servingSuggestion = text.match(/\*Serving Suggestion:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      
      // Clean main text
      text = text
        .replace(/\*Visual Cue:\*[^\n]*/gi, '')
        .replace(/\*Audio Cue:\*[^\n]*/gi, '')
        .replace(/\*Important:\*[^\n]*/gi, '')
        .replace(/\*Technique[^:]*:\*[^\n]*/gi, '')
        .replace(/\*Serving Suggestion:\*[^\n]*/gi, '')
        .trim();
      
      sections.instructions.push({
        step: stepNum,
        time,
        text,
        visualCue: visualCue || audioCue, // Use audio cue as fallback for visual
        important,
        technique,
        servingSuggestion
      });
    }
    
    // FALLBACK: Try numbered list format "1. Step text" if no instructions found
    if (sections.instructions.length === 0) {
      const numberedMatches = instructionText.matchAll(/(\d+)\.\s*\*?\*?([^*\n][^\n]*)/g);
      for (const match of numberedMatches) {
        const stepNum = parseInt(match[1]);
        let text = match[2].trim();
        
        // Extract time if in parentheses
        const timeMatch = text.match(/\((\d+[-–]?\d*\s*(?:min|minutes?|sec|seconds?))\)/i);
        const time = timeMatch ? timeMatch[1] : '';
        text = text.replace(/\(\d+[-–]?\d*\s*(?:min|minutes?|sec|seconds?)\)/gi, '').trim();
        
        if (text.length > 5) {
          sections.instructions.push({
            step: stepNum,
            time: time || '2-3 min',
            text,
            visualCue: '',
            important: '',
            technique: '',
            servingSuggestion: ''
          });
        }
      }
    }
    
    // FALLBACK 2: Try "**Step X:**" format
    if (sections.instructions.length === 0) {
      const stepColonMatches = instructionText.matchAll(/\*\*Step\s*(\d+):?\*\*\s*([\s\S]*?)(?=\*\*Step|\*\*Final|$)/gi);
      for (const match of stepColonMatches) {
        const stepNum = parseInt(match[1]);
        let text = match[2].trim();
        const timeMatch = text.match(/\((\d+[-–]?\d*\s*(?:min|minutes?))\)/i);
        const time = timeMatch ? timeMatch[1] : '2-3 min';
        
        sections.instructions.push({
          step: stepNum,
          time,
          text: text.replace(/\(\d+[-–]?\d*\s*(?:min|minutes?)\)/gi, '').trim(),
          visualCue: '',
          important: '',
          technique: '',
          servingSuggestion: ''
        });
      }
    }
    
    // FALLBACK 3: Simple dash/bullet list format "- Step text" or paragraph format
    if (sections.instructions.length === 0) {
      // Try bullet points first
      const bulletSteps = instructionText.split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
        .map(line => line.replace(/^[-•]\s*/, '').trim())
        .filter(text => text.length > 10);
      
      if (bulletSteps.length > 0) {
        bulletSteps.forEach((text, idx) => {
          sections.instructions.push({
            step: idx + 1,
            time: '2-3 min',
            text,
            visualCue: '',
            important: '',
            technique: '',
            servingSuggestion: ''
          });
        });
      }
    }
    
    // FALLBACK 4: Try to parse any meaningful paragraphs as steps
    if (sections.instructions.length === 0) {
      const paragraphs = instructionText
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 20 && !p.startsWith('*') && !p.startsWith('#'));
      
      if (paragraphs.length > 0) {
        paragraphs.forEach((text, idx) => {
          // Skip if it looks like a header or metadata
          if (/^(step|visual|important|technique|tip|note):/i.test(text)) return;
          
          sections.instructions.push({
            step: idx + 1,
            time: '2-3 min',
            text: text.replace(/\n/g, ' ').trim(),
            visualCue: '',
            important: '',
            technique: '',
            servingSuggestion: ''
          });
        });
      }
    }
    
    // Parse Final Step if exists - handle both formats
    const finalMatch = instructionText.match(/\*\*Final Step\*\*\s*\(([^)]+)\)\s*([\s\S]*?)$/i) ||
                       instructionText.match(/\*\*Final Step\s*\(([^)]+)\)\*\*\s*([\s\S]*?)$/i);
    if (finalMatch) {
      const time = finalMatch[1].trim();
      let text = finalMatch[2].trim();
      const servingSuggestion = text.match(/\*Serving Suggestion:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      const visualCue = text.match(/\*Visual Cue:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      text = text
        .replace(/\*Serving Suggestion:\*[^\n]*/gi, '')
        .replace(/\*Visual Cue:\*[^\n]*/gi, '')
        .trim();
      
      sections.instructions.push({
        step: sections.instructions.length + 1,
        time,
        text,
        visualCue,
        important: '',
        technique: '',
        servingSuggestion,
        isFinal: true
      });
    }
  }
  
  // Extract Chef's Tips
  const tipsSection = markdown.match(/## 💡 Chef's Tips([\s\S]*?)(?=##|$)/i) ||
                      markdown.match(/## Chef's Tips([\s\S]*?)(?=##|$)/i);
  if (tipsSection) {
    sections.tips = tipsSection[1].split('\n')
      .filter(line => line.trim().match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim());
  }
  
  // Extract Nutritional Information
  const nutritionSection = markdown.match(/## 📊 Nutritional Information([\s\S]*?)(?=##|$)/i) ||
                           markdown.match(/## Nutrition([\s\S]*?)(?=##|$)/i);
  if (nutritionSection) {
    const nutritionText = nutritionSection[1];
    sections.nutrition.calories = nutritionText.match(/Calories:\s*([^\n]+)/i)?.[1]?.trim() || '';
    sections.nutrition.protein = nutritionText.match(/Protein:\s*([^\n]+)/i)?.[1]?.trim() || '';
    sections.nutrition.carbs = nutritionText.match(/Carbohydrates:\s*([^\n]+)/i)?.[1]?.trim() || '';
    sections.nutrition.fat = nutritionText.match(/Fat:\s*([^\n]+)/i)?.[1]?.trim() || '';
    sections.nutrition.fiber = nutritionText.match(/Fiber:\s*([^\n]+)/i)?.[1]?.trim() || '';
    sections.nutrition.sodium = nutritionText.match(/Sodium:\s*([^\n]+)/i)?.[1]?.trim() || '';
  }
  
  // Extract Drink Pairings
  const drinkSection = markdown.match(/## 🍷 Drink Pairings([\s\S]*?)(?=##|$)/i) ||
                       markdown.match(/## Drink Pairings([\s\S]*?)(?=##|$)/i);
  if (drinkSection) {
    const drinkText = drinkSection[1];
    sections.drinkPairings = { nonAlcoholic: [], alcoholic: [] };
    
    // Try to match "**Non-Alcoholic:** drink1, drink2" format (inline list)
    const nonAlcInlineMatch = drinkText.match(/\*\*Non-Alcoholic:\*\*\s*([^\n*]+)/i);
    if (nonAlcInlineMatch) {
      const drinks = nonAlcInlineMatch[1].split(/,\s*/).filter(d => d.trim());
      drinks.forEach(drink => {
        sections.drinkPairings.nonAlcoholic.push({
          name: drink.trim(),
          description: 'A refreshing complement to this dish'
        });
      });
    }
    
    // Also try bullet format: "- **Name:** Description"
    const nonAlcSection = drinkText.match(/\*\*Non-Alcoholic:\*\*([\s\S]*?)(?=\*\*Alcoholic|$)/i);
    if (nonAlcSection && sections.drinkPairings.nonAlcoholic.length === 0) {
      const nonAlcMatches = nonAlcSection[1].matchAll(/-?\s*\*\*([^*]+)\*\*:?\s*([^\n]+)/g);
      for (const match of nonAlcMatches) {
        const name = match[1].trim().replace(/:$/, '');
        const desc = match[2].trim();
        if (name && desc) {
          sections.drinkPairings.nonAlcoholic.push({
            name: name,
            description: desc
          });
        }
      }
    }
    
    // Try to match "**Alcoholic (21+):** drink1, drink2" format (inline list)
    const alcInlineMatch = drinkText.match(/\*\*Alcoholic[^:]*:\*\*\s*([^\n*]+)/i);
    if (alcInlineMatch) {
      const drinks = alcInlineMatch[1].split(/,\s*/).filter(d => d.trim());
      drinks.forEach(drink => {
        sections.drinkPairings.alcoholic.push({
          name: drink.trim(),
          description: 'Pairs well with the flavors of this dish'
        });
      });
    }
    
    // Also try bullet format for alcoholic
    const alcSection = drinkText.match(/\*\*Alcoholic[^:]*:\*\*([\s\S]*?)$/i);
    if (alcSection && sections.drinkPairings.alcoholic.length === 0) {
      const alcMatches = alcSection[1].matchAll(/-?\s*\*\*([^*]+)\*\*:?\s*([^\n]+)/g);
      for (const match of alcMatches) {
        const name = match[1].trim().replace(/:$/, '');
        const desc = match[2].trim();
        if (name && desc) {
          sections.drinkPairings.alcoholic.push({
            name: name,
            description: desc
          });
        }
      }
    }
  }
  
  // Extract Storage
  const storageSection = markdown.match(/## 🥡 Storage & Reheating([\s\S]*?)(?=##|$)/i) ||
                         markdown.match(/## Storage([\s\S]*?)(?=##|$)/i);
  if (storageSection) {
    const storageText = storageSection[1];
    sections.storage.storage = storageText.match(/\*\*Storage:\*\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
    sections.storage.reheating = storageText.match(/\*\*Reheating:\*\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
  }
  
  // Extract Variations
  const variationsSection = markdown.match(/## 🔄 Variations([\s\S]*?)(?=##|$)/i);
  if (variationsSection) {
    const variationMatches = variationsSection[1].matchAll(/\d+\.\s*\*\*([^*]+)\*\*:\s*([^\n]+)/g);
    for (const match of variationMatches) {
      sections.variations.push({
        name: match[1].trim(),
        description: match[2].trim()
      });
    }
  }
  
  // Extract Common Mistakes
  const mistakesSection = markdown.match(/## ⚠️ Common Mistakes to Avoid([\s\S]*?)(?=##|$)/i);
  if (mistakesSection) {
    sections.mistakes = mistakesSection[1].split('\n')
      .filter(line => line.trim().match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim());
  }
  
  return sections;
};

// Star Rating Component
const StarRating = ({ rating, onRate, size = 24 }) => {
  const [hover, setHover] = useState(0);
  
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onRate && onRate(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={`transition-colors ${onRate ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
        >
          <Star
            size={size}
            className={`transition-all ${
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

// Difficulty Badge Component
const DifficultyBadge = ({ difficulty }) => {
  const colors = {
    'Easy': 'bg-green-100 text-green-700 border-green-200',
    'Medium': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'Hard': 'bg-red-100 text-red-700 border-red-200'
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${colors[difficulty] || colors['Medium']}`}>
      {difficulty}
    </span>
  );
};

// Recipe Detail Modal Component
const RecipeDetailModal = ({ recipe, isOpen, onClose, onSave, onAddToShoppingList, fromPlanner = false }) => {
  const [userRating, setUserRating] = useState(0);
  const [checkedSteps, setCheckedSteps] = useState({});
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [addedIngredients, setAddedIngredients] = useState({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailedContent, setDetailedContent] = useState(null);
  const [parsedRecipe, setParsedRecipe] = useState(null);
  const [activeSection, setActiveSection] = useState('instructions');
  const [aiImageUrl, setAiImageUrl] = useState(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showCookingMode, setShowCookingMode] = useState(false);
  const [selectedVoiceLanguage, setSelectedVoiceLanguage] = useState('en');
  const [isBuySheetOpen, setIsBuySheetOpen] = useState(false);
  
  // Ingredient Info Popup state
  const [selectedIngredientName, setSelectedIngredientName] = useState(null);
  const [showIngredientPopup, setShowIngredientPopup] = useState(false);
  
  // Live Cooking Modal - use global store
  const openLiveCooking = useLiveCooking((s) => s.openModal);
  
  const shoppingCart = useShoppingCart();
  
  // Handle ingredient click to show info popup
  const handleIngredientInfoClick = (ingredientItem) => {
    // Extract the ingredient name (without amount)
    const name = ingredientItem.item || ingredientItem.name || ingredientItem;
    setSelectedIngredientName(name);
    setShowIngredientPopup(true);
  };
  
  // Generate AI image for recipe
  const generateAIImage = async (title, cuisine) => {
    try {
      setIsGeneratingImage(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/recipe-image/generate`, {
        recipe_name: title,
        cuisine: cuisine || 'International'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data?.image_url) {
        setAiImageUrl(response.data.image_url);
      }
    } catch (error) {
      console.error('Error generating AI image:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };
  
  const fetchDetailedRecipe = async () => {
    if (!recipe?.title) return;
    
    setIsLoadingDetails(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/recipes/detailed`, {
        recipe_title: recipe.title,
        cuisine: recipe.cuisineHint || recipe.cuisine || 'International',
        meal_type: recipe.mealType || 'Dinner',
        dietary_pref: recipe.dietaryPref || 'Any'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setDetailedContent(response.data.recipe);
      const parsed = parseDetailedRecipe(response.data.recipe);
      console.log('[RecipeDetailModal] Parsed recipe:', {
        title: parsed?.title,
        instructionsCount: parsed?.instructions?.length || 0,
        ingredientsCount: parsed?.ingredients?.length || 0,
        equipmentCount: parsed?.equipment?.length || 0
      });
      setParsedRecipe(parsed);
      
      // Generate AI image for accurate representation
      generateAIImage(recipe.title, recipe.cuisineHint || recipe.cuisine);
      
      if (response.data.cached) {
        console.log('Using cached detailed recipe');
      }
    } catch (error) {
      console.error('Error fetching detailed recipe:', error);
      toast.error('Could not load detailed recipe');
    } finally {
      setIsLoadingDetails(false);
    }
  };
  
  // Fetch detailed recipe when modal opens
  useEffect(() => {
    if (isOpen && recipe?.title) {
      // Reset AI image when recipe changes
      setAiImageUrl(null);
      fetchDetailedRecipe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, recipe?.title]);
  
  const handleStepCheck = (stepNum) => {
    setCheckedSteps(prev => ({
      ...prev,
      [stepNum]: !prev[stepNum]
    }));
  };
  
  const handleIngredientCheck = (idx) => {
    setCheckedIngredients(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };
  
  const handleAddIngredient = (ingredient, idx) => {
    if (shoppingCart?.addToCart) {
      shoppingCart.addToCart({
        name: ingredient.item,
        quantity: ingredient.amount || '1',
        recipeName: recipe?.title || 'Recipe'
      });
      setAddedIngredients(prev => ({ ...prev, [idx]: true }));
      toast.success(`Added ${ingredient.item} to cart`);
    }
  };
  
  const handleAddAllIngredients = () => {
    if (parsedRecipe?.ingredients && shoppingCart?.addAllToCart) {
      // Use addAllToCart for batch adding (more efficient and reliable)
      shoppingCart.addAllToCart(parsedRecipe.ingredients, recipe?.title || 'Recipe');
      
      // Mark all as added for UI feedback
      const allAdded = {};
      parsedRecipe.ingredients.forEach((_, idx) => {
        allAdded[idx] = true;
      });
      setAddedIngredients(allAdded);
    }
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: recipe?.title,
          text: `Check out this recipe: ${recipe?.title}`,
          url: window.location.href
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };
  
  if (!recipe) return null;
  
  const displayTitle = parsedRecipe?.title || recipe.title;
  const info = parsedRecipe?.info || {};
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="fixed inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] max-w-4xl w-full min-h-full sm:min-h-0 sm:h-auto sm:max-h-[95vh] overflow-y-auto overflow-x-hidden p-0 bg-background rounded-none sm:rounded-lg border-0 sm:border flex flex-col"
        data-testid="recipe-detail-modal"
        hideCloseButton={true}
        style={{ 
          width: '100%',
          maxWidth: '100vw',
          height: '100dvh',
        }}
      >
        <DialogTitle className="sr-only">
          {displayTitle || 'Recipe Details'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Detailed recipe for {displayTitle}
        </DialogDescription>
        
        {/* Loading State */}
        {isLoadingDetails && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 px-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground text-center">Loading detailed recipe...</p>
            <p className="text-sm text-muted-foreground text-center">Generating professional cooking instructions...</p>
          </div>
        )}
        
        {/* Recipe Content */}
        {!isLoadingDetails && (
          <>
            {/* Hero Section - Reduced height on mobile */}
            <div className="relative h-48 sm:h-64 overflow-hidden">
              {/* AI Image with loading state */}
              {isGeneratingImage && !aiImageUrl && (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/70 to-blue-900/70 flex items-center justify-center z-10">
                  <div className="text-center text-white">
                    <Sparkles className="w-8 h-8 animate-pulse mx-auto mb-2" />
                    <p className="text-sm">Generating AI image...</p>
                  </div>
                </div>
              )}
              <img
                src={aiImageUrl || recipe.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}
                alt={displayTitle}
                className="w-full h-full object-cover transition-opacity duration-500"
              />
              {/* AI Badge */}
              {aiImageUrl && (
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 z-20">
                  <Sparkles className="w-3 h-3" />
                  <span>AI Generated</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              
              {/* Back Button */}
              {fromPlanner && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-white/90 hover:bg-white text-foreground z-20"
                  style={{ left: aiImageUrl ? '120px' : '12px' }}
                  data-testid="back-to-planner-btn"
                >
                  <ChevronLeft size={16} className="mr-1" /> Back
                </Button>
              )}
              
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-white/90 hover:bg-white rounded-full z-20"
              >
                <X size={20} />
              </Button>
              
              {/* Title Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                <h1 className="text-xl sm:text-3xl font-serif text-white font-bold mb-2 leading-tight">
                  {displayTitle}
                </h1>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {info.dietaryTags && info.dietaryTags.split(',').slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 sm:py-1 bg-white/20 text-white text-xs rounded-full backdrop-blur-sm">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Recipe Info Bar - Mobile optimized grid */}
            <div className="px-3 sm:px-6 py-3 sm:py-4 bg-muted/30 border-b">
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-6 text-xs sm:text-sm mb-3 sm:mb-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Clock size={16} className="text-primary flex-shrink-0" />
                  <span><strong>Total:</strong> {info.totalTime || recipe.cookingTime || '30 min'}</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Timer size={16} className="text-orange-500 flex-shrink-0" />
                  <span><strong>Prep:</strong> {info.prepTime || '10 min'}</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Flame size={16} className="text-red-500 flex-shrink-0" />
                  <span><strong>Cook:</strong> {info.cookTime || '20 min'}</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Users size={16} className="text-blue-500 flex-shrink-0" />
                  <span><strong>Serves:</strong> {info.servings || '4'}</span>
                </div>
              </div>
              
              {/* Action buttons - Full width on mobile */}
              <div className="flex gap-2 mt-3 sm:mt-0 sm:justify-end">
                <Button variant="outline" size="sm" onClick={handlePrint} className="flex-1 sm:flex-none text-xs sm:text-sm">
                  <Printer size={14} className="mr-1" /> Print
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare} className="flex-1 sm:flex-none text-xs sm:text-sm">
                  <Share2 size={14} className="mr-1" /> Share
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={() => onSave && onSave(recipe)}
                  className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-xs sm:text-sm"
                >
                  <Heart size={14} className="mr-1" /> Save
                </Button>
              </div>
            </div>
            
            {/* Description - Better mobile padding */}
            {parsedRecipe?.description && (
              <div className="px-3 sm:px-6 py-3 sm:py-4 border-b">
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {parsedRecipe.description}
                </p>
              </div>
            )}
            
            {/* Voice Cooking Guide */}
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b">
              {showCookingMode ? (
                <CookingModePlayer
                  recipe={{
                    ...recipe,
                    id: recipe.id || recipe._id || recipe.recipe_id,
                    instructions: parsedRecipe?.instructions?.map(i => i.text) || []
                  }}
                  language={selectedVoiceLanguage}
                  onClose={() => setShowCookingMode(false)}
                />
              ) : (
                <div className="space-y-3">
                  <RecipeVoicePlayer
                    recipe={{
                      ...recipe,
                      id: recipe.id || recipe._id || recipe.recipe_id,
                      name: parsedRecipe?.title || recipe.title,
                      cuisine: parsedRecipe?.info?.cuisine || recipe.cuisine,
                      totalTime: parsedRecipe?.info?.totalTime || recipe.cookTime || '30',
                      servings: parsedRecipe?.info?.servings || recipe.servings || '4',
                      ingredients: parsedRecipe?.ingredients?.map(i => ({ 
                        name: i.item, 
                        amount: i.amount 
                      })) || [],
                      instructions: parsedRecipe?.instructions?.map(i => i.text) || [],
                      tips: parsedRecipe?.tips || []
                    }}
                  />
                  
                  {/* Cooking Mode Toggle */}
                  {parsedRecipe?.instructions?.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full flex items-center justify-center gap-2"
                      onClick={() => openLiveCooking(aiImageUrl || recipe?.image, parsedRecipe?.instructions)}
                      data-testid="start-cooking-mode-btn"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span className="text-sm">Start Step-by-Step Cooking Mode</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            {/* Main Content Tabs - Scrollable on mobile with full width */}
            <div className="px-2 sm:px-6 py-2 border-b bg-background sticky top-0 z-20 shadow-sm w-full">
              <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1 -mx-2 px-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                {['instructions', 'ingredients', 'drinks', 'tips', 'nutrition', 'storage'].map((tab) => (
                  <Button
                    key={tab}
                    variant={activeSection === tab ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveSection(tab)}
                    className="capitalize whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9 flex-shrink-0"
                  >
                    {tab === 'instructions' && <BookOpen size={14} className="mr-1 hidden sm:inline" />}
                    {tab === 'ingredients' && <Utensils size={14} className="mr-1 hidden sm:inline" />}
                    {tab === 'drinks' && <Wine size={14} className="mr-1 hidden sm:inline" />}
                    {tab === 'tips' && <AlertCircle size={14} className="mr-1 hidden sm:inline" />}
                    {tab === 'nutrition' && <Leaf size={14} className="mr-1 hidden sm:inline" />}
                    {tab === 'storage' && <Package size={14} className="mr-1 hidden sm:inline" />}
                    {tab === 'drinks' ? 'Drinks' : tab}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Content Sections - Mobile optimized padding with safe scrolling */}
            <div className="px-3 sm:px-6 py-4 sm:py-6 pb-6 sm:pb-8 w-full overflow-x-hidden">
              {/* Instructions Section */}
              {activeSection === 'instructions' && (
                <div className="space-y-4 sm:space-y-6 w-full">
                  {/* Equipment */}
                  {parsedRecipe?.equipment?.length > 0 && (
                    <div className="mb-4 sm:mb-6">
                      <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 mb-2 sm:mb-3">
                        <Utensils size={18} className="text-primary flex-shrink-0" />
                        Equipment Needed
                      </h3>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {parsedRecipe.equipment.map((item, idx) => (
                          <span key={idx} className="px-2 sm:px-3 py-1 bg-muted rounded-full text-xs sm:text-sm">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <h3 className="text-lg sm:text-xl font-serif font-semibold flex items-center gap-2">
                    <BookOpen size={20} className="text-primary flex-shrink-0" />
                    Step-by-Step Instructions
                  </h3>
                  
                  {/* Mobile-optimized instruction cards - Full width, no clipping */}
                  <div className="space-y-3 sm:space-y-4 w-full">
                    {parsedRecipe?.instructions?.map((inst, idx) => (
                      <div 
                        key={idx}
                        className={`w-full p-3 sm:p-4 rounded-xl border transition-all ${
                          checkedSteps[inst.step] 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-card border-border hover:border-primary/30'
                        }`}
                        style={{ maxWidth: '100%' }}
                      >
                        <div className="flex items-start gap-2.5 sm:gap-4 w-full">
                          {/* Step number circle - smaller on mobile */}
                          <button
                            onClick={() => handleStepCheck(inst.step)}
                            className={`w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all text-xs sm:text-base font-medium ${
                              checkedSteps[inst.step]
                                ? 'bg-green-500 text-white'
                                : 'bg-primary/10 text-primary hover:bg-primary/20'
                            }`}
                          >
                            {checkedSteps[inst.step] ? <Check size={14} /> : inst.step}
                          </button>
                          
                          <div className="flex-1 min-w-0 overflow-hidden">
                            {/* Step header with time badge */}
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                              <span className="font-semibold text-sm sm:text-base text-foreground">
                                {inst.isFinal ? 'Final Step' : `Step ${inst.step}`}
                              </span>
                              {inst.time && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 sm:px-2 py-0.5 rounded-full">
                                  <Clock size={10} /> {inst.time}
                                </span>
                              )}
                            </div>
                            
                            {/* Instruction text - Mobile optimized with proper wrapping */}
                            <p className={`text-sm sm:text-base text-foreground leading-relaxed break-words ${checkedSteps[inst.step] ? 'line-through text-muted-foreground' : ''}`}
                               style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', hyphens: 'auto' }}>
                              {inst.text}
                            </p>
                            
                            {/* Visual Cue - Compact on mobile */}
                            {inst.visualCue && (
                              <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <p className="text-xs sm:text-sm text-blue-700 break-words">
                                  <strong>👁 Visual Cue:</strong> {inst.visualCue}
                                </p>
                              </div>
                            )}
                            
                            {/* Important note - Compact on mobile */}
                            {inst.important && (
                              <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-amber-50 rounded-lg border border-amber-100">
                                <p className="text-xs sm:text-sm text-amber-700 break-words">
                                  <strong>⚠️ Important:</strong> {inst.important}
                                </p>
                              </div>
                            )}
                            
                            {/* Technique note */}
                            {inst.technique && (
                              <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-purple-50 rounded-lg border border-purple-100">
                                <p className="text-xs sm:text-sm text-purple-700 break-words">
                                  <strong>📝 Technique:</strong> {inst.technique}
                                </p>
                              </div>
                            )}
                            
                            {/* Serving suggestion */}
                            {inst.servingSuggestion && (
                              <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-green-50 rounded-lg border border-green-100">
                                <p className="text-xs sm:text-sm text-green-700 break-words">
                                  <strong>🍽 Serving:</strong> {inst.servingSuggestion}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Fallback if no instructions parsed */}
                    {(!parsedRecipe?.instructions || parsedRecipe.instructions.length === 0) && (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                        <p className="text-amber-700 text-sm">
                          <strong>Note:</strong> Instructions are being prepared. Please check back in a moment or view the raw recipe text above.
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Common Mistakes */}
                  {parsedRecipe?.mistakes?.length > 0 && (
                    <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-red-50 rounded-xl border border-red-100">
                      <h4 className="font-semibold text-red-800 flex items-center gap-2 mb-2 sm:mb-3 text-sm sm:text-base">
                        <AlertTriangle size={16} />
                        Common Mistakes to Avoid
                      </h4>
                      <ul className="space-y-1.5 sm:space-y-2">
                        {parsedRecipe.mistakes.map((mistake, idx) => (
                          <li key={idx} className="text-xs sm:text-sm text-red-700 flex items-start gap-2">
                            <span className="text-red-500 flex-shrink-0">•</span>
                            <span>{mistake}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              {/* Ingredients Section */}
              {activeSection === 'ingredients' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-serif font-semibold flex items-center gap-2">
                      <Utensils size={22} className="text-primary flex-shrink-0" />
                      Ingredients
                    </h3>
                    <Button onClick={handleAddAllIngredients} variant="default" size="sm" className="flex-shrink-0">
                      <ShoppingCart size={16} className="mr-2" />
                      <span className="hidden sm:inline">Add All to Cart</span>
                      <span className="sm:hidden">Add All</span>
                    </Button>
                  </div>
                  
                  {/* Group by category */}
                  {(() => {
                    const categories = {};
                    parsedRecipe?.ingredients?.forEach((ing, idx) => {
                      const cat = ing.category || 'Ingredients';
                      if (!categories[cat]) categories[cat] = [];
                      categories[cat].push({ ...ing, originalIdx: idx });
                    });
                    
                    return Object.entries(categories).map(([category, items]) => (
                      <div key={category} className="mb-4">
                        <h4 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide mb-2">
                          {category}
                        </h4>
                        <div className="space-y-2">
                          {items.map((ing) => (
                            <div 
                              key={ing.originalIdx}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-all gap-2 ${
                                checkedIngredients[ing.originalIdx]
                                  ? 'bg-muted/50 border-muted'
                                  : 'bg-card border-border hover:border-primary/30'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <button
                                  onClick={() => handleIngredientCheck(ing.originalIdx)}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                    checkedIngredients[ing.originalIdx]
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : 'border-muted-foreground/30 hover:border-primary'
                                  }`}
                                >
                                  {checkedIngredients[ing.originalIdx] && <Check size={12} />}
                                </button>
                                <span className={`break-words flex-1 ${checkedIngredients[ing.originalIdx] ? 'line-through text-muted-foreground' : ''}`}>
                                  {ing.amount && <span className="font-medium text-primary mr-2">{ing.amount}</span>}
                                  <button
                                    onClick={() => handleIngredientInfoClick(ing)}
                                    className="text-left hover:text-[#5D7A5D] hover:underline underline-offset-2 transition-colors inline"
                                    title="Tap to see what this looks like"
                                    data-testid={`ingredient-info-${ing.originalIdx}`}
                                  >
                                    {ing.item}
                                  </button>
                                </span>
                                <button
                                  onClick={() => handleIngredientInfoClick(ing)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-[#5D7A5D] hover:bg-[#5D7A5D]/10 transition-all flex-shrink-0"
                                  title="What does this look like?"
                                >
                                  <HelpCircle size={14} />
                                </button>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAddIngredient(ing, ing.originalIdx)}
                                className={`flex-shrink-0 ${addedIngredients[ing.originalIdx] ? 'text-green-500' : ''}`}
                              >
                                {addedIngredients[ing.originalIdx] ? (
                                  <Check size={16} />
                                ) : (
                                  <Plus size={16} />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
              
              {/* Drink Pairings Section */}
              {activeSection === 'drinks' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-serif font-semibold flex items-center gap-2">
                    <Wine size={22} className="text-primary" />
                    Drink Pairings
                  </h3>
                  
                  {/* Non-Alcoholic Section */}
                  <div className="space-y-3">
                    <h4 className="text-lg font-medium flex items-center gap-2 text-teal-700">
                      <GlassWater size={20} />
                      Non-Alcoholic Options
                    </h4>
                    <div className="grid gap-3">
                      {(parsedRecipe?.drinkPairings?.nonAlcoholic?.length > 0 || recipe?.drinkPairings?.nonAlcoholic?.length > 0) ? (
                        (parsedRecipe?.drinkPairings?.nonAlcoholic?.length > 0 
                          ? parsedRecipe.drinkPairings.nonAlcoholic 
                          : recipe?.drinkPairings?.nonAlcoholic || []
                        ).map((drink, idx) => (
                          <div key={idx} className="p-4 bg-teal-50 rounded-xl border border-teal-100">
                            <p className="font-semibold text-teal-800">{drink.name || drink}</p>
                            <p className="text-sm text-teal-600 mt-1">{drink.description || `A refreshing drink that complements this dish.`}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <p className="text-gray-500 italic">Click &quot;View Full Recipe&quot; to load specific drink pairings for this dish</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Alcoholic Section */}
                  <div className="space-y-3">
                    <h4 className="text-lg font-medium flex items-center gap-2 text-purple-700">
                      <Wine size={20} />
                      Alcoholic Options (21+)
                    </h4>
                    <div className="grid gap-3">
                      {(parsedRecipe?.drinkPairings?.alcoholic?.length > 0 || recipe?.drinkPairings?.alcoholic?.length > 0) ? (
                        (parsedRecipe?.drinkPairings?.alcoholic?.length > 0 
                          ? parsedRecipe.drinkPairings.alcoholic 
                          : recipe?.drinkPairings?.alcoholic || []
                        ).map((drink, idx) => (
                          <div key={idx} className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                            <p className="font-semibold text-purple-800">{drink.name || drink}</p>
                            <p className="text-sm text-purple-600 mt-1">{drink.description || `This beverage pairs well with the flavors of this dish.`}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <p className="text-gray-500 italic">Click &quot;View Full Recipe&quot; to load specific drink pairings for this dish</p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      🍷 Please drink responsibly. Must be 21+ to consume alcoholic beverages.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Chef's Tips Section */}
              {activeSection === 'tips' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-serif font-semibold flex items-center gap-2">
                    <ChefHat size={22} className="text-primary" />
                    Chef&apos;s Tips &amp; Pro Tricks
                  </h3>
                  
                  <div className="space-y-3">
                    {parsedRecipe?.tips?.map((tip, idx) => (
                      <div key={idx} className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                        <p className="text-amber-900">
                          <span className="font-semibold text-amber-700 mr-2">{idx + 1}.</span>
                          {tip}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Variations */}
                  {parsedRecipe?.variations?.length > 0 && (
                    <div className="mt-8">
                      <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <RefreshCw size={18} className="text-primary" />
                        Recipe Variations
                      </h4>
                      <div className="grid gap-3">
                        {parsedRecipe.variations.map((variation, idx) => (
                          <div key={idx} className="p-4 bg-muted/50 rounded-lg">
                            <p>
                              <strong className="text-primary">{variation.name}:</strong>{' '}
                              {variation.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Nutrition Section */}
              {activeSection === 'nutrition' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-serif font-semibold flex items-center gap-2">
                    <Leaf size={22} className="text-primary" />
                    Nutritional Information
                  </h3>
                  <p className="text-sm text-muted-foreground">Per serving</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Calories', value: parsedRecipe?.nutrition?.calories, icon: Flame, color: 'text-orange-500' },
                      { label: 'Protein', value: parsedRecipe?.nutrition?.protein, icon: Leaf, color: 'text-green-500' },
                      { label: 'Carbs', value: parsedRecipe?.nutrition?.carbs, icon: Leaf, color: 'text-blue-500' },
                      { label: 'Fat', value: parsedRecipe?.nutrition?.fat, icon: Leaf, color: 'text-yellow-500' },
                      { label: 'Fiber', value: parsedRecipe?.nutrition?.fiber, icon: Leaf, color: 'text-green-600' },
                      { label: 'Sodium', value: parsedRecipe?.nutrition?.sodium, icon: Thermometer, color: 'text-red-400' },
                    ].map((item) => item.value && (
                      <div key={item.label} className="p-4 bg-card rounded-xl border text-center">
                        <item.icon size={24} className={`mx-auto mb-2 ${item.color}`} />
                        <p className="text-2xl font-bold">{item.value}</p>
                        <p className="text-sm text-muted-foreground">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Storage Section */}
              {activeSection === 'storage' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-serif font-semibold flex items-center gap-2">
                    <Package size={22} className="text-primary" />
                    Storage &amp; Reheating
                  </h3>
                  
                  {parsedRecipe?.storage?.storage && (
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <h4 className="font-semibold text-blue-800 mb-2">📦 Storage</h4>
                      <p className="text-blue-700">{parsedRecipe.storage.storage}</p>
                    </div>
                  )}
                  
                  {parsedRecipe?.storage?.reheating && (
                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                      <h4 className="font-semibold text-orange-800 mb-2">🔥 Reheating</h4>
                      <p className="text-orange-700">{parsedRecipe.storage.reheating}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Rating & Actions Section - Safe bottom spacing for mobile */}
            <div className="px-4 sm:px-6 py-4 sm:py-4 border-t bg-muted/20 pb-safe" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <div className="flex flex-col gap-4">
                {/* Rating */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Rate this recipe</p>
                    <StarRating rating={userRating} onRate={setUserRating} />
                  </div>
                </div>
                
                {/* Single Buy Ingredients Button - Opens Smart Shopping Sheet */}
                {parsedRecipe?.ingredients && parsedRecipe.ingredients.length > 0 && (
                  <Button 
                    onClick={() => setIsBuySheetOpen(true)}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    data-testid="buy-ingredients-btn"
                  >
                    <ShoppingCart size={16} className="mr-2" />
                    Buy Ingredients
                  </Button>
                )}
              </div>
            </div>
            
            {/* Buy Ingredients Sheet */}
            <BuyIngredientsSheet
              isOpen={isBuySheetOpen}
              onClose={() => setIsBuySheetOpen(false)}
              ingredients={parsedRecipe?.ingredients || []}
              recipeName={displayTitle}
            />
            
            {/* Ingredient Info Popup */}
            <IngredientInfoPopup
              ingredientName={selectedIngredientName}
              isOpen={showIngredientPopup}
              onClose={() => setShowIngredientPopup(false)}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RecipeDetailModal;
