import { useState, useEffect, useRef } from 'react';
import { 
  Heart, Clock, ChefHat, Utensils, Users, Flame, Printer, 
  Share2, Star, ShoppingCart, BookOpen, X, ChevronRight, ChevronLeft,
  Timer, Leaf, AlertCircle, Check, Plus, Loader2, RefreshCw,
  Thermometer, Package, Info, AlertTriangle, Wine, GlassWater, Sparkles,
  DollarSign, Volume2, HelpCircle, Play, Settings, ChevronDown
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
    
    const stepMatches = instructionText.matchAll(/\*\*(?:Step\s*)?(\d+)(?:\*\*\s*\(([^)]+)\)|\s*\(([^)]+)\)\*\*)\s*([\s\S]*?)(?=\*\*(?:Step|Final)|$)/gi);
    for (const match of stepMatches) {
      const stepNum = parseInt(match[1]);
      const time = (match[2] || match[3] || '').trim();
      let text = (match[4] || '').trim();
      
      const visualCue = text.match(/\*Visual Cue:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      const audioCue = text.match(/\*Audio Cue:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      const important = text.match(/\*Important:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      const technique = text.match(/\*Technique[^:]*:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      const servingSuggestion = text.match(/\*Serving Suggestion:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      
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
        visualCue: visualCue || audioCue,
        important,
        technique,
        servingSuggestion
      });
    }
    
    // Fallbacks for different formats
    if (sections.instructions.length === 0) {
      const numberedMatches = instructionText.matchAll(/(\d+)\.\s*\*?\*?([^*\n][^\n]*)/g);
      for (const match of numberedMatches) {
        const stepNum = parseInt(match[1]);
        let text = match[2].trim();
        const timeMatch = text.match(/\((\d+[-–]?\d*\s*(?:min|minutes?|sec|seconds?))\)/i);
        const time = timeMatch ? timeMatch[1] : '';
        text = text.replace(/\(\d+[-–]?\d*\s*(?:min|minutes?|sec|seconds?)\)/gi, '').trim();
        if (text.length > 5) {
          sections.instructions.push({ step: stepNum, time: time || '2-3 min', text, visualCue: '', important: '', technique: '', servingSuggestion: '' });
        }
      }
    }
    
    if (sections.instructions.length === 0) {
      const bulletSteps = instructionText.split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
        .map(line => line.replace(/^[-•]\s*/, '').trim())
        .filter(text => text.length > 10);
      bulletSteps.forEach((text, idx) => {
        sections.instructions.push({ step: idx + 1, time: '2-3 min', text, visualCue: '', important: '', technique: '', servingSuggestion: '' });
      });
    }
    
    // Final step
    const finalMatch = instructionText.match(/\*\*Final Step\*\*\s*\(([^)]+)\)\s*([\s\S]*?)$/i) ||
                       instructionText.match(/\*\*Final Step\s*\(([^)]+)\)\*\*\s*([\s\S]*?)$/i);
    if (finalMatch) {
      const time = finalMatch[1].trim();
      let text = finalMatch[2].trim();
      const servingSuggestion = text.match(/\*Serving Suggestion:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      const visualCue = text.match(/\*Visual Cue:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      text = text.replace(/\*Serving Suggestion:\*[^\n]*/gi, '').replace(/\*Visual Cue:\*[^\n]*/gi, '').trim();
      sections.instructions.push({ step: sections.instructions.length + 1, time, text, visualCue, important: '', technique: '', servingSuggestion, isFinal: true });
    }
  }
  
  // Extract Chef's Tips
  const tipsSection = markdown.match(/## 💡 Chef's Tips([\s\S]*?)(?=##|$)/i) || markdown.match(/## Chef's Tips([\s\S]*?)(?=##|$)/i);
  if (tipsSection) {
    sections.tips = tipsSection[1].split('\n').filter(line => line.trim().match(/^\d+\./)).map(line => line.replace(/^\d+\.\s*/, '').trim());
  }
  
  // Extract Nutritional Information
  const nutritionSection = markdown.match(/## 📊 Nutritional Information([\s\S]*?)(?=##|$)/i) || markdown.match(/## Nutrition([\s\S]*?)(?=##|$)/i);
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
  const drinkSection = markdown.match(/## 🍷 Drink Pairings([\s\S]*?)(?=##|$)/i) || markdown.match(/## Drink Pairings([\s\S]*?)(?=##|$)/i);
  if (drinkSection) {
    const drinkText = drinkSection[1];
    sections.drinkPairings = { nonAlcoholic: [], alcoholic: [] };
    
    const nonAlcInlineMatch = drinkText.match(/\*\*Non-Alcoholic:\*\*\s*([^\n*]+)/i);
    if (nonAlcInlineMatch) {
      nonAlcInlineMatch[1].split(/,\s*/).filter(d => d.trim()).forEach(drink => {
        sections.drinkPairings.nonAlcoholic.push({ name: drink.trim(), description: 'A refreshing complement to this dish' });
      });
    }
    
    const alcInlineMatch = drinkText.match(/\*\*Alcoholic[^:]*:\*\*\s*([^\n*]+)/i);
    if (alcInlineMatch) {
      alcInlineMatch[1].split(/,\s*/).filter(d => d.trim()).forEach(drink => {
        sections.drinkPairings.alcoholic.push({ name: drink.trim(), description: 'Pairs well with the flavors of this dish' });
      });
    }
  }
  
  // Extract Storage
  const storageSection = markdown.match(/## 🥡 Storage & Reheating([\s\S]*?)(?=##|$)/i) || markdown.match(/## Storage([\s\S]*?)(?=##|$)/i);
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
      sections.variations.push({ name: match[1].trim(), description: match[2].trim() });
    }
  }
  
  // Extract Common Mistakes
  const mistakesSection = markdown.match(/## ⚠️ Common Mistakes to Avoid([\s\S]*?)(?=##|$)/i);
  if (mistakesSection) {
    sections.mistakes = mistakesSection[1].split('\n').filter(line => line.trim().match(/^\d+\./)).map(line => line.replace(/^\d+\.\s*/, '').trim());
  }
  
  return sections;
};

// Star Rating Component
const StarRating = ({ rating, onRate, size = 20 }) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onRate && onRate(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={`transition-colors ${onRate ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
        >
          <Star size={size} className={`transition-all ${star <= (hover || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  );
};

// Recipe Detail Modal Component - NEW Two-Column Layout
const RecipeDetailModal = ({ recipe, isOpen, onClose, onSave, onAddToShoppingList, fromPlanner = false }) => {
  const [userRating, setUserRating] = useState(0);
  const [checkedSteps, setCheckedSteps] = useState({});
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [addedIngredients, setAddedIngredients] = useState({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailedContent, setDetailedContent] = useState(null);
  const [parsedRecipe, setParsedRecipe] = useState(null);
  const [aiImageUrl, setAiImageUrl] = useState(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showCookingMode, setShowCookingMode] = useState(false);
  const [selectedVoiceLanguage, setSelectedVoiceLanguage] = useState('en');
  const [isBuySheetOpen, setIsBuySheetOpen] = useState(false);
  const [selectedIngredientName, setSelectedIngredientName] = useState(null);
  const [showIngredientPopup, setShowIngredientPopup] = useState(false);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    drinks: false,
    tips: false,
    nutrition: false,
    storage: false
  });
  
  const openLiveCooking = useLiveCooking((s) => s.openModal);
  const shoppingCart = useShoppingCart();
  const contentRef = useRef(null);

  const handleIngredientInfoClick = (ingredientItem) => {
    const name = ingredientItem.item || ingredientItem.name || ingredientItem;
    setSelectedIngredientName(name);
    setShowIngredientPopup(true);
  };

  const generateAIImage = async (title, cuisine) => {
    try {
      setIsGeneratingImage(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/recipe-image/generate`, {
        recipe_name: title,
        cuisine: cuisine || 'International'
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data?.image_url) setAiImageUrl(response.data.image_url);
    } catch (error) {
      console.error('Error generating AI image:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const fetchDetailedRecipe = async () => {
    if (!recipe?.title) return;
    
    // Check if recipe already has detailed instructions (from saved recipes)
    if (recipe.instructions && Array.isArray(recipe.instructions) && recipe.instructions.length > 0) {
      // Use existing recipe data - no need to call AI
      const existingParsed = {
        title: recipe.title,
        info: {
          cuisine: recipe.cuisine || recipe.cuisineHint || '',
          servings: recipe.servings || '4',
          prepTime: recipe.prepTime || '15 min',
          cookTime: recipe.cookTime || '30 min',
          totalTime: recipe.totalTime || '45 min',
          difficulty: recipe.difficulty || 'Medium',
        },
        description: recipe.description || '',
        ingredients: (recipe.ingredients || []).map((ing, idx) => {
          if (typeof ing === 'string') {
            return { amount: '', item: ing, category: 'Ingredients' };
          }
          return { amount: ing.amount || '', item: ing.name || ing.item || ing, category: ing.category || 'Ingredients' };
        }),
        instructions: recipe.instructions.map((inst, idx) => ({
          step: idx + 1,
          time: '2-3 min',
          text: typeof inst === 'string' ? inst : inst.text || inst,
          visualCue: '',
          important: '',
          technique: '',
          servingSuggestion: ''
        })),
        tips: recipe.tips || [],
        equipment: recipe.equipment || [],
        drinkPairings: { nonAlcoholic: [], alcoholic: [] },
        nutrition: recipe.nutrition || {},
        storage: {},
        variations: [],
        mistakes: []
      };
      setParsedRecipe(existingParsed);
      setIsLoadingDetails(false);
      // Still generate AI image if not present
      if (!recipe.imageUrl && !recipe.image_url) {
        generateAIImage(recipe.title, recipe.cuisineHint || recipe.cuisine);
      } else {
        setAiImageUrl(recipe.imageUrl || recipe.image_url);
      }
      return;
    }
    
    // Fetch detailed recipe from AI if no existing instructions
    setIsLoadingDetails(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/recipes/detailed`, {
        recipe_title: recipe.title,
        cuisine: recipe.cuisineHint || recipe.cuisine || 'International',
        meal_type: recipe.mealType || 'Dinner',
        dietary_pref: recipe.dietaryPref || 'Any'
      }, { headers: { Authorization: `Bearer ${token}` } });
      setDetailedContent(response.data.recipe);
      const parsed = parseDetailedRecipe(response.data.recipe);
      setParsedRecipe(parsed);
      generateAIImage(recipe.title, recipe.cuisineHint || recipe.cuisine);
    } catch (error) {
      console.error('Error fetching detailed recipe:', error);
      toast.error('Could not load detailed recipe');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (isOpen && recipe?.title) {
      setAiImageUrl(null);
      fetchDetailedRecipe();
    }
  }, [isOpen, recipe?.title]);

  const handleStepCheck = (stepNum) => setCheckedSteps(prev => ({ ...prev, [stepNum]: !prev[stepNum] }));
  const handleIngredientCheck = (idx) => setCheckedIngredients(prev => ({ ...prev, [idx]: !prev[idx] }));
  
  const handleAddIngredient = (ingredient, idx) => {
    if (shoppingCart?.addToCart) {
      shoppingCart.addToCart({ name: ingredient.item, quantity: ingredient.amount || '1', recipeName: recipe?.title || 'Recipe' });
      setAddedIngredients(prev => ({ ...prev, [idx]: true }));
      toast.success(`Added ${ingredient.item} to cart`);
    }
  };

  const handleAddAllIngredients = () => {
    if (parsedRecipe?.ingredients && shoppingCart?.addAllToCart) {
      shoppingCart.addAllToCart(parsedRecipe.ingredients, recipe?.title || 'Recipe');
      const allAdded = {};
      parsedRecipe.ingredients.forEach((_, idx) => { allAdded[idx] = true; });
      setAddedIngredients(allAdded);
    }
  };

  const handlePrint = () => window.print();
  
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: recipe?.title, text: `Check out this recipe: ${recipe?.title}`, url: window.location.href });
      } catch (err) { console.log('Share cancelled'); }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (!recipe) return null;

  const displayTitle = parsedRecipe?.title || recipe.title;
  const info = parsedRecipe?.info || {};

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        fullScreenMobile={true}
        className="p-0 border-0 max-w-5xl overflow-hidden"
        data-testid="recipe-detail-modal"
        hideCloseButton={true}
      >
        <DialogTitle className="sr-only">{displayTitle || 'Recipe Details'}</DialogTitle>
        <DialogDescription className="sr-only">Detailed recipe for {displayTitle}</DialogDescription>

        {/* Loading State */}
        {isLoadingDetails && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 px-4 min-h-[400px]">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground text-center">Loading detailed recipe...</p>
            <p className="text-sm text-muted-foreground text-center">Generating professional cooking instructions...</p>
          </div>
        )}

        {/* Main Content */}
        {!isLoadingDetails && (
          <div className="flex flex-col lg:flex-row max-h-[90vh] lg:max-h-[85vh] overflow-hidden">
            
            {/* LEFT COLUMN - Recipe Content (scrollable on both mobile and desktop) */}
            <div className="flex-1 overflow-y-auto" ref={contentRef}>
              {/* Close Button - Mobile */}
              <div className="lg:hidden absolute top-3 right-3 z-30">
                <Button variant="ghost" size="icon" onClick={onClose} className="bg-white/90 hover:bg-white rounded-full shadow-md">
                  <X size={20} />
                </Button>
              </div>
              
              {/* Mobile: Hero Image */}
              <div className="lg:hidden relative h-56 sm:h-64 overflow-hidden flex-shrink-0">
                {isGeneratingImage && !aiImageUrl && (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center z-10">
                    <div className="text-center text-white">
                      <Sparkles className="w-8 h-8 animate-pulse mx-auto mb-2" />
                      <p className="text-sm">Generating image...</p>
                    </div>
                  </div>
                )}
                <img
                  src={aiImageUrl || recipe.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                />
                {aiImageUrl && (
                  <div className="absolute top-3 left-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /><span>AI</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>

              {/* Content Container */}
              <div className="p-5 sm:p-6 lg:p-8">
                {/* Desktop: Close Button */}
                <div className="hidden lg:block absolute top-4 right-4 z-30">
                  <Button variant="ghost" size="icon" onClick={onClose} className="bg-muted/80 hover:bg-muted rounded-full">
                    <X size={20} />
                  </Button>
                </div>

                {/* Recipe Title */}
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-foreground leading-tight mb-3">
                  {displayTitle}
                </h1>

                {/* Source & Meta Info Row */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1.5">
                    <ChefHat size={16} className="text-primary" />
                    <span>MOOD FOOD</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users size={16} />
                    <span>{info.servings || '4'}</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1">
                    <Clock size={14} />
                    <span className="text-xs">{info.prepTime || '15min'}</span>
                    <span className="text-xs text-muted-foreground/50">PREP</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1">
                    <Flame size={14} />
                    <span className="text-xs">{info.cookTime || '30min'}</span>
                    <span className="text-xs text-muted-foreground/50">COOK</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Timer size={14} />
                    <span className="text-xs font-medium">{info.totalTime || '45min'}</span>
                    <span className="text-xs text-muted-foreground/50">TOTAL</span>
                  </div>
                </div>

                {/* Action Buttons Row */}
                <div className="flex flex-wrap gap-2 mb-5">
                  <Button
                    onClick={() => { onClose(); setTimeout(() => { openLiveCooking(aiImageUrl || recipe?.image, parsedRecipe?.instructions); }, 100); }}
                    className="bg-rose-500 hover:bg-rose-600 text-white gap-2"
                    size="sm"
                    disabled={!parsedRecipe?.instructions?.length}
                    data-testid="start-cooking-mode-btn"
                  >
                    <Play size={14} fill="white" /> Cook
                  </Button>
                  <Button onClick={() => setIsBuySheetOpen(true)} variant="outline" size="sm" className="gap-2">
                    <ShoppingCart size={14} /> Groceries
                  </Button>
                  <Button onClick={() => onSave && onSave(recipe)} variant="outline" size="sm" className="gap-2">
                    <Heart size={14} /> Save
                  </Button>
                  <Button onClick={handleShare} variant="ghost" size="sm" className="gap-1">
                    <Share2 size={14} />
                  </Button>
                  <Button onClick={handlePrint} variant="ghost" size="sm" className="gap-1">
                    <Printer size={14} />
                  </Button>
                </div>

                {/* Description */}
                {parsedRecipe?.description && (
                  <p className="text-muted-foreground leading-relaxed mb-6 text-sm sm:text-base">
                    {parsedRecipe.description}
                  </p>
                )}

                {/* Voice Player (compact) */}
                <div className="mb-6 p-3 bg-muted/30 rounded-xl">
                  {showCookingMode ? (
                    <CookingModePlayer
                      recipe={{ ...recipe, id: recipe.id || recipe._id || recipe.recipe_id, instructions: parsedRecipe?.instructions?.map(i => i.text) || [] }}
                      language={selectedVoiceLanguage}
                      onClose={() => setShowCookingMode(false)}
                    />
                  ) : (
                    <RecipeVoicePlayer
                      recipe={{
                        ...recipe,
                        id: recipe.id || recipe._id || recipe.recipe_id,
                        name: parsedRecipe?.title || recipe.title,
                        cuisine: parsedRecipe?.info?.cuisine || recipe.cuisine,
                        totalTime: parsedRecipe?.info?.totalTime || recipe.cookTime || '30',
                        servings: parsedRecipe?.info?.servings || recipe.servings || '4',
                        ingredients: parsedRecipe?.ingredients?.map(i => ({ name: i.item, amount: i.amount })) || [],
                        instructions: parsedRecipe?.instructions?.map(i => i.text) || [],
                        tips: parsedRecipe?.tips || []
                      }}
                    />
                  )}
                </div>

                {/* Divider */}
                <hr className="border-border mb-6" />

                {/* Instructions Section */}
                <div className="space-y-4">
                  {parsedRecipe?.instructions?.map((inst, idx) => (
                    <div key={idx} className="flex gap-4">
                      {/* Step Number */}
                      <button
                        onClick={() => handleStepCheck(inst.step)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold transition-all ${
                          checkedSteps[inst.step]
                            ? 'bg-green-500 text-white'
                            : 'bg-primary/10 text-primary hover:bg-primary/20'
                        }`}
                      >
                        {checkedSteps[inst.step] ? <Check size={14} /> : inst.step}
                      </button>
                      
                      {/* Step Content */}
                      <div className="flex-1 pb-4 border-b border-border/50 last:border-0">
                        {/* Section Header if exists */}
                        {inst.isFinal && (
                          <h4 className="font-semibold text-foreground mb-2">Final Step</h4>
                        )}
                        
                        {/* Time Badge */}
                        {inst.time && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-2">
                            <Clock size={10} /> {inst.time}
                          </span>
                        )}
                        
                        {/* Instruction Text */}
                        <p className={`text-foreground leading-relaxed ${checkedSteps[inst.step] ? 'line-through text-muted-foreground' : ''}`}>
                          {inst.text}
                        </p>
                        
                        {/* Visual Cue */}
                        {inst.visualCue && (
                          <div className="mt-3 p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900">
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                              <strong>👁 Visual Cue:</strong> {inst.visualCue}
                            </p>
                          </div>
                        )}
                        
                        {/* Important Note */}
                        {inst.important && (
                          <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-100 dark:border-amber-900">
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                              <strong>⚠️ Important:</strong> {inst.important}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {(!parsedRecipe?.instructions || parsedRecipe.instructions.length === 0) && (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-sm text-amber-800">
                        <strong>Note:</strong> Detailed cooking instructions are being prepared. Use the Voice Cooking Guide above for step-by-step guidance.
                      </p>
                    </div>
                  )}
                </div>

                {/* Common Mistakes */}
                {parsedRecipe?.mistakes?.length > 0 && (
                  <div className="mt-6 p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900">
                    <h4 className="font-semibold text-red-800 dark:text-red-300 flex items-center gap-2 mb-3 text-sm">
                      <AlertTriangle size={16} /> Common Mistakes to Avoid
                    </h4>
                    <ul className="space-y-1.5">
                      {parsedRecipe.mistakes.map((mistake, idx) => (
                        <li key={idx} className="text-xs text-red-700 dark:text-red-400 flex items-start gap-2">
                          <span className="text-red-500">•</span><span>{mistake}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Collapsible Sections */}
                <div className="mt-8 space-y-3">
                  {/* Chef's Tips */}
                  {parsedRecipe?.tips?.length > 0 && (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <button onClick={() => toggleSection('tips')} className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors">
                        <span className="font-semibold flex items-center gap-2"><ChefHat size={18} className="text-amber-500" /> Chef's Tips</span>
                        <ChevronDown size={18} className={`transition-transform ${expandedSections.tips ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedSections.tips && (
                        <div className="p-4 space-y-2">
                          {parsedRecipe.tips.map((tip, idx) => (
                            <p key={idx} className="text-sm text-muted-foreground"><span className="font-semibold text-amber-600">{idx + 1}.</span> {tip}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Drink Pairings */}
                  {(parsedRecipe?.drinkPairings?.nonAlcoholic?.length > 0 || parsedRecipe?.drinkPairings?.alcoholic?.length > 0) && (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <button onClick={() => toggleSection('drinks')} className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors">
                        <span className="font-semibold flex items-center gap-2"><Wine size={18} className="text-purple-500" /> Drink Pairings</span>
                        <ChevronDown size={18} className={`transition-transform ${expandedSections.drinks ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedSections.drinks && (
                        <div className="p-4 space-y-3">
                          {parsedRecipe.drinkPairings.nonAlcoholic?.map((drink, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <GlassWater size={14} className="text-teal-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm"><strong>{drink.name}</strong> - {drink.description}</span>
                            </div>
                          ))}
                          {parsedRecipe.drinkPairings.alcoholic?.map((drink, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <Wine size={14} className="text-purple-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm"><strong>{drink.name}</strong> - {drink.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Nutrition */}
                  {parsedRecipe?.nutrition?.calories && (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <button onClick={() => toggleSection('nutrition')} className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors">
                        <span className="font-semibold flex items-center gap-2"><Leaf size={18} className="text-green-500" /> Nutrition Info</span>
                        <ChevronDown size={18} className={`transition-transform ${expandedSections.nutrition ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedSections.nutrition && (
                        <div className="p-4 grid grid-cols-3 gap-3">
                          {[
                            { label: 'Calories', value: parsedRecipe.nutrition.calories },
                            { label: 'Protein', value: parsedRecipe.nutrition.protein },
                            { label: 'Carbs', value: parsedRecipe.nutrition.carbs },
                            { label: 'Fat', value: parsedRecipe.nutrition.fat },
                            { label: 'Fiber', value: parsedRecipe.nutrition.fiber },
                            { label: 'Sodium', value: parsedRecipe.nutrition.sodium },
                          ].filter(n => n.value).map(n => (
                            <div key={n.label} className="text-center p-2 bg-muted/50 rounded-lg">
                              <p className="text-lg font-bold">{n.value}</p>
                              <p className="text-xs text-muted-foreground">{n.label}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Storage */}
                  {(parsedRecipe?.storage?.storage || parsedRecipe?.storage?.reheating) && (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <button onClick={() => toggleSection('storage')} className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors">
                        <span className="font-semibold flex items-center gap-2"><Package size={18} className="text-blue-500" /> Storage & Reheating</span>
                        <ChevronDown size={18} className={`transition-transform ${expandedSections.storage ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedSections.storage && (
                        <div className="p-4 space-y-2 text-sm">
                          {parsedRecipe.storage.storage && <p><strong>📦 Storage:</strong> {parsedRecipe.storage.storage}</p>}
                          {parsedRecipe.storage.reheating && <p><strong>🔥 Reheating:</strong> {parsedRecipe.storage.reheating}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Rating Section */}
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Rate this recipe</p>
                      <StarRating rating={userRating} onRate={setUserRating} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN - Image & Ingredients (Desktop) */}
            <div className="hidden lg:flex flex-col w-[380px] xl:w-[420px] border-l border-border bg-muted/20">
              {/* Recipe Image */}
              <div className="relative h-72 xl:h-80 flex-shrink-0 overflow-hidden">
                {isGeneratingImage && !aiImageUrl && (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center z-10">
                    <div className="text-center text-white">
                      <Sparkles className="w-8 h-8 animate-pulse mx-auto mb-2" />
                      <p className="text-sm">Generating image...</p>
                    </div>
                  </div>
                )}
                <img
                  src={aiImageUrl || recipe.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                />
                {aiImageUrl && (
                  <div className="absolute top-3 left-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /><span>AI Generated</span>
                  </div>
                )}
              </div>

              {/* Ingredients List */}
              <div className="flex-1 overflow-y-auto p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Ingredients</h3>
                  <Button onClick={handleAddAllIngredients} variant="ghost" size="sm" className="text-xs text-primary hover:text-primary">
                    <Plus size={14} className="mr-1" /> Add All
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {parsedRecipe?.ingredients?.map((ing, idx) => (
                    <div 
                      key={idx}
                      className={`flex items-start gap-3 group ${checkedIngredients[idx] ? 'opacity-50' : ''}`}
                    >
                      <button
                        onClick={() => handleIngredientCheck(idx)}
                        className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          checkedIngredients[idx]
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-muted-foreground/30 hover:border-primary'
                        }`}
                      >
                        {checkedIngredients[idx] && <Check size={10} />}
                      </button>
                      <div className={`flex-1 ${checkedIngredients[idx] ? 'line-through' : ''}`}>
                        <span className="font-semibold text-primary text-sm">{ing.amount}</span>
                        {ing.amount && ' '}
                        <button
                          onClick={() => handleIngredientInfoClick(ing)}
                          className="text-sm text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors"
                        >
                          {ing.item}
                        </button>
                      </div>
                      <button
                        onClick={() => handleAddIngredient(ing, idx)}
                        className={`opacity-0 group-hover:opacity-100 transition-opacity ${addedIngredients[idx] ? 'text-green-500' : 'text-muted-foreground hover:text-primary'}`}
                      >
                        {addedIngredients[idx] ? <Check size={14} /> : <Plus size={14} />}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Equipment */}
                {parsedRecipe?.equipment?.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-border">
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Utensils size={14} /> Equipment Needed
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {parsedRecipe.equipment.map((item, idx) => (
                        <span key={idx} className="px-2 py-1 bg-muted rounded-full text-xs">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile: Ingredients Section (shown below instructions) */}
            <div className="lg:hidden border-t border-border bg-muted/20 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Utensils size={18} className="text-primary" /> Ingredients
                </h3>
                <Button onClick={handleAddAllIngredients} variant="outline" size="sm" className="text-xs">
                  <Plus size={14} className="mr-1" /> Add All
                </Button>
              </div>

              <div className="space-y-2.5">
                {parsedRecipe?.ingredients?.map((ing, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-start gap-3 ${checkedIngredients[idx] ? 'opacity-50' : ''}`}
                  >
                    <button
                      onClick={() => handleIngredientCheck(idx)}
                      className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        checkedIngredients[idx]
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-muted-foreground/30 hover:border-primary'
                      }`}
                    >
                      {checkedIngredients[idx] && <Check size={10} />}
                    </button>
                    <div className={`flex-1 ${checkedIngredients[idx] ? 'line-through' : ''}`}>
                      <span className="font-semibold text-primary text-sm">{ing.amount}</span>
                      {ing.amount && ' '}
                      <button
                        onClick={() => handleIngredientInfoClick(ing)}
                        className="text-sm text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors"
                      >
                        {ing.item}
                      </button>
                    </div>
                    <button
                      onClick={() => handleAddIngredient(ing, idx)}
                      className={`${addedIngredients[idx] ? 'text-green-500' : 'text-muted-foreground'}`}
                    >
                      {addedIngredients[idx] ? <Check size={14} /> : <Plus size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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
      </DialogContent>
    </Dialog>
  );
};

export default RecipeDetailModal;
