import { useState, useEffect } from 'react';
import { 
  Heart, Clock, ChefHat, Utensils, Users, Flame, Printer, 
  Share2, Star, ShoppingCart, BookOpen, X, ChevronRight, ChevronLeft,
  Timer, Leaf, AlertCircle, Check, Plus, Loader2, RefreshCw,
  Thermometer, Package, Info, AlertTriangle, Wine, GlassWater
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
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Parse detailed recipe markdown into structured sections
const parseDetailedRecipe = (markdown) => {
  if (!markdown) return null;
  
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
  
  // Extract title
  const titleMatch = markdown.match(/^#\s+(.+?)$/m);
  if (titleMatch) sections.title = titleMatch[1].trim();
  
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
                              markdown.match(/## Instructions([\s\S]*?)(?=##|$)/i);
  if (instructionsSection) {
    const instructionText = instructionsSection[1];
    // Parse step format: **Step X** (Y minutes)
    const stepMatches = instructionText.matchAll(/\*\*(?:Step\s*)?(\d+)\*\*\s*\(([^)]+)\)\s*([\s\S]*?)(?=\*\*(?:Step|Final)|$)/gi);
    for (const match of stepMatches) {
      const stepNum = parseInt(match[1]);
      const time = match[2].trim();
      let text = match[3].trim();
      
      // Extract visual cue
      const visualCue = text.match(/\*Visual Cue:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      const important = text.match(/\*Important:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      const technique = text.match(/\*Technique[^:]*:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      const servingSuggestion = text.match(/\*Serving Suggestion:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      
      // Clean main text
      text = text
        .replace(/\*Visual Cue:\*[^\n]*/gi, '')
        .replace(/\*Important:\*[^\n]*/gi, '')
        .replace(/\*Technique[^:]*:\*[^\n]*/gi, '')
        .replace(/\*Serving Suggestion:\*[^\n]*/gi, '')
        .trim();
      
      sections.instructions.push({
        step: stepNum,
        time,
        text,
        visualCue,
        important,
        technique,
        servingSuggestion
      });
    }
    
    // Parse Final Step if exists
    const finalMatch = instructionText.match(/\*\*Final Step\*\*\s*\(([^)]+)\)\s*([\s\S]*?)$/i);
    if (finalMatch) {
      const time = finalMatch[1].trim();
      let text = finalMatch[2].trim();
      const servingSuggestion = text.match(/\*Serving Suggestion:\*\s*([^\n*]+)/i)?.[1]?.trim() || '';
      text = text.replace(/\*Serving Suggestion:\*[^\n]*/gi, '').trim();
      
      sections.instructions.push({
        step: sections.instructions.length + 1,
        time,
        text,
        visualCue: '',
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
    // Parse non-alcoholic section - handles both bullet format (- **Name:**) and inline format (**Name:**)
    const nonAlcSection = drinkText.match(/\*\*Non-Alcoholic:\*\*([\s\S]*?)(?=\*\*Alcoholic|$)/i);
    if (nonAlcSection) {
      // Match both formats: "- **Name:** Description" and "**Name:** Description"
      const nonAlcMatches = nonAlcSection[1].matchAll(/-?\s*\*\*([^*]+)\*\*:?\s*([^\n]+)/g);
      sections.drinkPairings = sections.drinkPairings || { nonAlcoholic: [], alcoholic: [] };
      for (const match of nonAlcMatches) {
        const name = match[1].trim();
        const desc = match[2].trim();
        if (name && desc) {
          sections.drinkPairings.nonAlcoholic.push({
            name: name,
            description: desc
          });
        }
      }
    }
    // Parse alcoholic section - handles both bullet format and inline format
    const alcSection = drinkText.match(/\*\*Alcoholic[^:]*:\*\*([\s\S]*?)$/i);
    if (alcSection) {
      // Match both formats: "- **Name:** Description" and "**Name:** Description"
      const alcMatches = alcSection[1].matchAll(/-?\s*\*\*([^*]+)\*\*:?\s*([^\n]+)/g);
      sections.drinkPairings = sections.drinkPairings || { nonAlcoholic: [], alcoholic: [] };
      for (const match of alcMatches) {
        const name = match[1].trim();
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
  
  const shoppingCart = useShoppingCart();
  
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
      setParsedRecipe(parsed);
      
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
    if (parsedRecipe?.ingredients && shoppingCart?.addToCart) {
      parsedRecipe.ingredients.forEach((ing, idx) => {
        shoppingCart.addToCart({
          name: ing.item,
          quantity: ing.amount || '1',
          recipeName: recipe?.title || 'Recipe'
        });
        setAddedIngredients(prev => ({ ...prev, [idx]: true }));
      });
      toast.success(`Added ${parsedRecipe.ingredients.length} ingredients to cart`);
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
        className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 bg-background"
        data-testid="recipe-detail-modal"
      >
        <DialogDescription className="sr-only">
          Detailed recipe for {displayTitle}
        </DialogDescription>
        
        {/* Loading State */}
        {isLoadingDetails && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading detailed recipe...</p>
            <p className="text-sm text-muted-foreground">Generating professional cooking instructions...</p>
          </div>
        )}
        
        {/* Recipe Content */}
        {!isLoadingDetails && (
          <>
            {/* Hero Section */}
            <div className="relative h-64 overflow-hidden">
              <img
                src={recipe.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}
                alt={displayTitle}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              
              {/* Back Button */}
              {fromPlanner && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="absolute top-4 left-4 bg-white/90 hover:bg-white text-foreground"
                  data-testid="back-to-planner-btn"
                >
                  <ChevronLeft size={16} className="mr-1" /> Back to Planner
                </Button>
              )}
              
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-full"
              >
                <X size={20} />
              </Button>
              
              {/* Title Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h1 className="text-3xl font-serif text-white font-bold mb-2">
                  {displayTitle}
                </h1>
                <div className="flex flex-wrap gap-2">
                  {info.dietaryTags && info.dietaryTags.split(',').map((tag, idx) => (
                    <span key={idx} className="px-2 py-1 bg-white/20 text-white text-xs rounded-full backdrop-blur-sm">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Recipe Info Bar */}
            <div className="px-6 py-4 bg-muted/30 border-b flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-primary" />
                  <span><strong>Total:</strong> {info.totalTime || recipe.cookingTime || '30 min'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Timer size={18} className="text-orange-500" />
                  <span><strong>Prep:</strong> {info.prepTime || '10 min'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-red-500" />
                  <span><strong>Cook:</strong> {info.cookTime || '20 min'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-blue-500" />
                  <span><strong>Serves:</strong> {info.servings || '4'}</span>
                </div>
                <DifficultyBadge difficulty={info.difficulty || recipe.difficulty || 'Medium'} />
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer size={16} className="mr-1" /> Print
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 size={16} className="mr-1" /> Share
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={() => onSave && onSave(recipe)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Heart size={16} className="mr-1" /> Save
                </Button>
              </div>
            </div>
            
            {/* Description */}
            {parsedRecipe?.description && (
              <div className="px-6 py-4 border-b">
                <p className="text-muted-foreground leading-relaxed">
                  {parsedRecipe.description}
                </p>
              </div>
            )}
            
            {/* Main Content Tabs */}
            <div className="px-6 py-2 border-b bg-background sticky top-0 z-20 shadow-sm">
              <div className="flex gap-1 overflow-x-auto">
                {['instructions', 'ingredients', 'drinks', 'tips', 'nutrition', 'storage'].map((tab) => (
                  <Button
                    key={tab}
                    variant={activeSection === tab ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveSection(tab)}
                    className="capitalize whitespace-nowrap"
                  >
                    {tab === 'instructions' && <BookOpen size={14} className="mr-1" />}
                    {tab === 'ingredients' && <Utensils size={14} className="mr-1" />}
                    {tab === 'drinks' && <Wine size={14} className="mr-1" />}
                    {tab === 'tips' && <AlertCircle size={14} className="mr-1" />}
                    {tab === 'nutrition' && <Leaf size={14} className="mr-1" />}
                    {tab === 'storage' && <Package size={14} className="mr-1" />}
                    {tab === 'drinks' ? 'Drink Pairings' : tab}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Content Sections */}
            <div className="p-6">
              {/* Instructions Section */}
              {activeSection === 'instructions' && (
                <div className="space-y-6">
                  {/* Equipment */}
                  {parsedRecipe?.equipment?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                        <Utensils size={20} className="text-primary" />
                        Equipment Needed
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {parsedRecipe.equipment.map((item, idx) => (
                          <span key={idx} className="px-3 py-1 bg-muted rounded-full text-sm">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <h3 className="text-xl font-serif font-semibold flex items-center gap-2">
                    <BookOpen size={22} className="text-primary" />
                    Step-by-Step Instructions
                  </h3>
                  
                  <div className="space-y-4">
                    {parsedRecipe?.instructions?.map((inst, idx) => (
                      <div 
                        key={idx}
                        className={`p-4 rounded-xl border transition-all ${
                          checkedSteps[inst.step] 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-card border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <button
                            onClick={() => handleStepCheck(inst.step)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                              checkedSteps[inst.step]
                                ? 'bg-green-500 text-white'
                                : 'bg-primary/10 text-primary hover:bg-primary/20'
                            }`}
                          >
                            {checkedSteps[inst.step] ? <Check size={20} /> : inst.step}
                          </button>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-foreground">
                                {inst.isFinal ? 'Final Step' : `Step ${inst.step}`}
                              </span>
                              {inst.time && (
                                <span className="flex items-center gap-1 text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                  <Clock size={12} /> {inst.time}
                                </span>
                              )}
                            </div>
                            
                            <p className={`text-foreground leading-relaxed ${checkedSteps[inst.step] ? 'line-through text-muted-foreground' : ''}`}>
                              {inst.text}
                            </p>
                            
                            {inst.visualCue && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <p className="text-sm text-blue-700">
                                  <strong>👁 Visual Cue:</strong> {inst.visualCue}
                                </p>
                              </div>
                            )}
                            
                            {inst.important && (
                              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                                <p className="text-sm text-amber-700">
                                  <strong>⚠️ Important:</strong> {inst.important}
                                </p>
                              </div>
                            )}
                            
                            {inst.technique && (
                              <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                                <p className="text-sm text-purple-700">
                                  <strong>📝 Technique Note:</strong> {inst.technique}
                                </p>
                              </div>
                            )}
                            
                            {inst.servingSuggestion && (
                              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-100">
                                <p className="text-sm text-green-700">
                                  <strong>🍽 Serving Suggestion:</strong> {inst.servingSuggestion}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Common Mistakes */}
                  {parsedRecipe?.mistakes?.length > 0 && (
                    <div className="mt-8 p-4 bg-red-50 rounded-xl border border-red-100">
                      <h4 className="font-semibold text-red-800 flex items-center gap-2 mb-3">
                        <AlertTriangle size={18} />
                        Common Mistakes to Avoid
                      </h4>
                      <ul className="space-y-2">
                        {parsedRecipe.mistakes.map((mistake, idx) => (
                          <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                            <span className="text-red-500">•</span>
                            {mistake}
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
                      <Utensils size={22} className="text-primary" />
                      Ingredients
                    </h3>
                    <Button onClick={handleAddAllIngredients} variant="default" size="sm">
                      <ShoppingCart size={16} className="mr-2" />
                      Add All to Cart
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
                              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                                checkedIngredients[ing.originalIdx]
                                  ? 'bg-muted/50 border-muted'
                                  : 'bg-card border-border hover:border-primary/30'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleIngredientCheck(ing.originalIdx)}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                    checkedIngredients[ing.originalIdx]
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : 'border-muted-foreground/30 hover:border-primary'
                                  }`}
                                >
                                  {checkedIngredients[ing.originalIdx] && <Check size={12} />}
                                </button>
                                <span className={checkedIngredients[ing.originalIdx] ? 'line-through text-muted-foreground' : ''}>
                                  {ing.amount && <span className="font-medium text-primary mr-2">{ing.amount}</span>}
                                  {ing.item}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAddIngredient(ing, ing.originalIdx)}
                                className={addedIngredients[ing.originalIdx] ? 'text-green-500' : ''}
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
                      {parsedRecipe?.drinkPairings?.nonAlcoholic?.length > 0 ? (
                        parsedRecipe.drinkPairings.nonAlcoholic.map((drink, idx) => (
                          <div key={idx} className="p-4 bg-teal-50 rounded-xl border border-teal-100">
                            <p className="font-semibold text-teal-800">{drink.name}</p>
                            <p className="text-sm text-teal-600 mt-1">{drink.description}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <p className="text-gray-500 italic">Click "View Full Recipe" to load specific drink pairings for this dish</p>
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
                      {parsedRecipe?.drinkPairings?.alcoholic?.length > 0 ? (
                        parsedRecipe.drinkPairings.alcoholic.map((drink, idx) => (
                          <div key={idx} className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                            <p className="font-semibold text-purple-800">{drink.name}</p>
                            <p className="text-sm text-purple-600 mt-1">{drink.description}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <p className="text-gray-500 italic">Click "View Full Recipe" to load specific drink pairings for this dish</p>
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
            
            {/* Rating Section */}
            <div className="px-6 py-4 border-t bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Rate this recipe</p>
                  <StarRating rating={userRating} onRate={setUserRating} />
                </div>
                <Button 
                  onClick={handleAddAllIngredients}
                  className="bg-primary hover:bg-primary/90"
                  data-testid="add-all-ingredients-btn"
                >
                  <ShoppingCart size={16} className="mr-2" />
                  Add All Ingredients
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RecipeDetailModal;
