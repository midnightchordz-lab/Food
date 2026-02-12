import { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart, Check, MapPin, ExternalLink, Loader2, 
  BookmarkPlus, ChevronRight, Store, Clock, Globe, DollarSign,
  TrendingDown, ChevronDown, Plus, Trash2, Copy, Download,
  ListPlus, FolderOpen, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { hapticFeedback } from '../capacitor';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Currency symbols mapping
const CURRENCY_SYMBOLS = {
  'USD': '$', 'INR': '₹', 'GBP': '£', 'EUR': '€', 'CAD': 'C$', 'AUD': 'A$', 'SGD': 'S$', 'AED': 'AED '
};

// Available countries for manual selection
const AVAILABLE_COUNTRIES = [
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'GB', name: 'UK', flag: '🇬🇧' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
];

// Category definitions with emojis
const INGREDIENT_CATEGORIES = {
  'SEAFOOD': { emoji: '🦐', keywords: ['salmon', 'fish', 'shrimp', 'prawn', 'tuna', 'crab', 'lobster', 'cod', 'tilapia', 'seafood', 'anchov', 'sardine', 'mackerel', 'halibut', 'trout', 'squid', 'octopus', 'mussel', 'clam', 'oyster', 'scallop'] },
  'MEAT & POULTRY': { emoji: '🍗', keywords: ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'meat', 'bacon', 'ham', 'sausage', 'steak', 'mince', 'ground', 'mutton', 'veal'] },
  'DAIRY & EGGS': { emoji: '🥛', keywords: ['milk', 'cheese', 'yogurt', 'cream', 'butter', 'egg', 'paneer', 'curd', 'ghee', 'cottage', 'mozzarella', 'parmesan', 'cheddar', 'feta', 'ricotta'] },
  'VEGETABLES': { emoji: '🥬', keywords: ['onion', 'tomato', 'potato', 'garlic', 'ginger', 'carrot', 'spinach', 'lettuce', 'cabbage', 'broccoli', 'cauliflower', 'pepper', 'capsicum', 'cucumber', 'zucchini', 'eggplant', 'mushroom', 'celery', 'leek', 'asparagus', 'corn', 'peas', 'beans', 'okra', 'beetroot', 'radish', 'turnip', 'squash', 'pumpkin'] },
  'FRUITS': { emoji: '🍎', keywords: ['apple', 'banana', 'orange', 'lemon', 'lime', 'mango', 'grape', 'strawberry', 'blueberry', 'raspberry', 'peach', 'pear', 'plum', 'cherry', 'watermelon', 'pineapple', 'papaya', 'kiwi', 'avocado', 'coconut', 'pomegranate', 'fig', 'date'] },
  'GRAINS & PASTA': { emoji: '🍚', keywords: ['rice', 'pasta', 'noodle', 'bread', 'flour', 'oat', 'quinoa', 'barley', 'wheat', 'couscous', 'spaghetti', 'penne', 'macaroni', 'fettuccine', 'roti', 'naan', 'tortilla', 'cereal', 'cracker'] },
  'SPICES & HERBS': { emoji: '🌿', keywords: ['salt', 'pepper', 'cumin', 'coriander', 'turmeric', 'paprika', 'cinnamon', 'cardamom', 'clove', 'nutmeg', 'oregano', 'basil', 'thyme', 'rosemary', 'parsley', 'cilantro', 'mint', 'bay leaf', 'chili', 'masala', 'curry', 'garam', 'saffron', 'fennel', 'mustard seed'] },
  'OILS & SAUCES': { emoji: '🫒', keywords: ['oil', 'olive', 'vegetable', 'sesame', 'coconut oil', 'sauce', 'soy', 'vinegar', 'ketchup', 'mayonnaise', 'mustard', 'honey', 'maple', 'sriracha', 'hot sauce', 'worcestershire', 'fish sauce', 'oyster sauce', 'hoisin'] },
  'LEGUMES & NUTS': { emoji: '🥜', keywords: ['lentil', 'dal', 'chickpea', 'bean', 'peanut', 'almond', 'cashew', 'walnut', 'pistachio', 'pecan', 'hazelnut', 'tofu', 'tempeh', 'soy', 'hummus', 'tahini'] },
  'OTHER': { emoji: '📦', keywords: [] }
};

// Categorize an ingredient
const categorizeIngredient = (ingredientText) => {
  const text = ingredientText.toLowerCase();
  
  for (const [category, { keywords }] of Object.entries(INGREDIENT_CATEGORIES)) {
    if (category === 'OTHER') continue;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }
  return 'OTHER';
};

// Extract clean ingredient name (without quantity)
const extractIngredientName = (ing) => {
  let text = typeof ing === 'string' ? ing : (ing.item || ing.name || '');
  // Remove leading numbers, fractions, and units
  text = text.replace(/^[\d\s\/½¼¾⅓⅔⅛⅜⅝⅞]+/, '').trim();
  text = text.replace(/^(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|lb|pound|pounds|g|gram|grams|kg|ml|liter|liters|pinch|dash|bunch|clove|cloves|piece|pieces|slice|slices|can|cans|package|packages|head|heads|stalk|stalks)\s*/i, '').trim();
  // Capitalize first letter
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * BuyIngredientsSheet - Smart Shopping Cart Component (Redesigned)
 * 
 * Features:
 * 1. Categorized ingredient display with emoji icons
 * 2. Clean item cards with recipe source
 * 3. Copy list and download functionality
 * 4. Regional delivery app integration
 * 5. Save to multiple shopping lists
 */
const BuyIngredientsSheet = ({ 
  isOpen, 
  onClose, 
  ingredients = [], 
  recipeName = 'Recipe'
}) => {
  // State for ingredient selection (checked = crossed off / already have)
  const [checkedIngredients, setCheckedIngredients] = useState({});
  
  // State for delivery apps
  const [deliveryApps, setDeliveryApps] = useState([]);
  const [countryInfo, setCountryInfo] = useState(null);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [isSavingToList, setIsSavingToList] = useState(false);
  
  // State for shopping lists
  const [shoppingLists, setShoppingLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [showListSelector, setShowListSelector] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  
  // State for delivery app selection
  const [showDeliveryOptions, setShowDeliveryOptions] = useState(false);

  // Categorized ingredients
  const categorizedIngredients = useMemo(() => {
    const categories = {};
    
    ingredients.forEach((ing, idx) => {
      const text = typeof ing === 'string' ? ing : (ing.item || ing.name || '');
      const category = categorizeIngredient(text);
      
      if (!categories[category]) {
        categories[category] = [];
      }
      
      categories[category].push({
        idx,
        original: ing,
        name: extractIngredientName(ing),
        fullText: typeof ing === 'string' ? ing : `${ing.amount || ''} ${ing.item || ing.name || ''}`.trim()
      });
    });
    
    // Sort categories in preferred order
    const orderedCategories = {};
    const categoryOrder = ['SEAFOOD', 'MEAT & POULTRY', 'DAIRY & EGGS', 'VEGETABLES', 'FRUITS', 'GRAINS & PASTA', 'SPICES & HERBS', 'OILS & SAUCES', 'LEGUMES & NUTS', 'OTHER'];
    
    categoryOrder.forEach(cat => {
      if (categories[cat] && categories[cat].length > 0) {
        orderedCategories[cat] = categories[cat];
      }
    });
    
    return orderedCategories;
  }, [ingredients]);

  // Initialize when sheet opens
  useEffect(() => {
    if (isOpen && ingredients.length > 0) {
      setCheckedIngredients({}); // Start with nothing checked
      fetchDeliveryApps();
      fetchShoppingLists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ingredients]);

  // Fetch user's shopping lists
  const fetchShoppingLists = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/shopping/lists`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setShoppingLists(response.data.lists || []);
        if (response.data.lists?.length > 0 && !selectedListId) {
          setSelectedListId(response.data.lists[0].list_id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch shopping lists:', error);
    }
  };

  // Get browser timezone-based country hint
  const getBrowserCountryHint = () => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tzCountryMap = {
        'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Mumbai': 'IN',
        'America/New_York': 'US', 'America/Los_Angeles': 'US', 'America/Chicago': 'US',
        'Europe/London': 'GB', 'Europe/Dublin': 'GB',
        'Asia/Dubai': 'AE', 'Asia/Abu_Dhabi': 'AE',
        'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU',
        'Asia/Singapore': 'SG',
        'America/Toronto': 'CA', 'America/Vancouver': 'CA',
      };
      return tzCountryMap[timezone] || null;
    } catch {
      return null;
    }
  };

  // Fetch delivery apps based on user's region
  const fetchDeliveryApps = async (countryCode = null) => {
    setIsLoadingApps(true);
    try {
      const token = localStorage.getItem('token');
      const countryHint = countryCode || getBrowserCountryHint();
      const params = new URLSearchParams();
      if (countryHint) params.append('country_hint', countryHint);
      
      const response = await axios.get(`${API}/shopping/delivery-apps${params.toString() ? '?' + params.toString() : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setDeliveryApps(response.data.apps || []);
        setCountryInfo({
          country: response.data.country,
          countryCode: response.data.country_code,
          currencySymbol: response.data.currency_symbol,
        });
      }
    } catch (error) {
      console.error('Failed to fetch delivery apps:', error);
      setDeliveryApps([{
        id: 'amazon', name: 'Amazon',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/1200px-Amazon_logo.svg.png',
        color: '#FF9900', delivery_time: '2 days'
      }]);
      setCountryInfo({ country: 'Global', countryCode: 'DEFAULT' });
    } finally {
      setIsLoadingApps(false);
    }
  };

  // Handle country/region change
  const handleCountryChange = (countryCode) => {
    hapticFeedback('medium');
    const country = AVAILABLE_COUNTRIES.find(c => c.code === countryCode);
    if (country) {
      // Optimistically update UI
      setCountryInfo({
        country: country.name,
        countryCode: country.code,
        currencySymbol: CURRENCY_SYMBOLS[country.code === 'IN' ? 'INR' : country.code === 'GB' ? 'GBP' : country.code === 'AE' ? 'AED' : country.code === 'AU' ? 'AUD' : country.code === 'SG' ? 'SGD' : country.code === 'CA' ? 'CAD' : 'USD']
      });
      // Fetch delivery apps for the new country
      fetchDeliveryApps(countryCode);
      toast.success(`Region changed to ${country.flag} ${country.name}`);
    }
  };

  // Toggle ingredient check (checked = already have / crossed off)
  const toggleCheck = (idx) => {
    hapticFeedback('light');
    setCheckedIngredients(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Remove ingredient from list temporarily
  const removeIngredient = (idx) => {
    hapticFeedback('medium');
    setCheckedIngredients(prev => ({
      ...prev,
      [idx]: true // Mark as checked (already have)
    }));
  };

  // Clear all checked items
  const clearAllChecked = () => {
    hapticFeedback('medium');
    setCheckedIngredients({});
  };

  // Count checked items
  const checkedCount = Object.values(checkedIngredients).filter(Boolean).length;
  const totalCount = ingredients.length;

  // Get unchecked ingredients (the ones user needs to buy)
  const getUncheckedIngredients = () => {
    return ingredients
      .filter((_, idx) => !checkedIngredients[idx])
      .map(ing => ({
        name: typeof ing === 'string' ? ing : (ing.item || ing.name || ''),
        amount: typeof ing === 'string' ? '' : (ing.amount || ''),
        unit: typeof ing === 'string' ? '' : (ing.unit || '')
      }));
  };

  // Copy list to clipboard
  const handleCopyList = () => {
    const unchecked = getUncheckedIngredients();
    const text = `Shopping List for ${recipeName}:\n\n${unchecked.map(i => `• ${i.name}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    toast.success('List copied to clipboard!');
    hapticFeedback('success');
  };

  // Download list as text file
  const handleDownload = () => {
    const unchecked = getUncheckedIngredients();
    const text = `Shopping List for ${recipeName}\n${'='.repeat(40)}\n\n${unchecked.map(i => `[ ] ${i.name}`).join('\n')}\n\nGenerated by MoodFood`;
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopping-list-${recipeName.toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('List downloaded!');
    hapticFeedback('success');
  };

  // Open delivery options panel
  const handleOrderNowClick = () => {
    const unchecked = getUncheckedIngredients();
    if (unchecked.length === 0) {
      toast.error('No items to order');
      return;
    }
    
    if (deliveryApps.length === 0) {
      toast.error('No delivery apps available for your region');
      return;
    }
    
    // Show delivery options for user to choose
    setShowDeliveryOptions(true);
    hapticFeedback('medium');
  };

  // Handle delivery app click - build URL and open
  const handleSelectDeliveryApp = async (app) => {
    const unchecked = getUncheckedIngredients();
    if (unchecked.length === 0) {
      toast.error('No items to order');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/shopping/build-url`, {
        app_id: app?.id || deliveryApps[0]?.id,
        ingredients: unchecked,
        country_code: countryInfo?.countryCode || 'DEFAULT'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.url) {
        window.open(response.data.url, '_blank');
        toast.success(`Opening ${app?.name || 'delivery app'}...`);
        setShowDeliveryOptions(false);
        onClose();
      }
    } catch (error) {
      console.error('Failed to build URL:', error);
      toast.error('Failed to open delivery app');
    }
  };

  // Save to shopping list
  const handleSaveToGroceryList = async () => {
    const unchecked = getUncheckedIngredients();
    if (unchecked.length === 0) {
      toast.error('No items to save');
      return;
    }

    if (!selectedListId && shoppingLists.length > 0) {
      setShowListSelector(true);
      return;
    }

    if (shoppingLists.length === 0) {
      setShowListSelector(true);
      return;
    }

    setIsSavingToList(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/shopping/lists/${selectedListId}/items`, {
        ingredients: unchecked,
        recipe_name: recipeName
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const listName = shoppingLists.find(l => l.list_id === selectedListId)?.name || 'your list';
      toast.success(`${unchecked.length} items saved to "${listName}"!`);
      onClose();
    } catch (error) {
      console.error('Failed to save to list:', error);
      toast.error('Failed to save to grocery list');
    } finally {
      setIsSavingToList(false);
    }
  };

  // Create new list and save ingredients
  const handleCreateListAndSave = async () => {
    if (!newListName.trim()) {
      toast.error('Please enter a list name');
      return;
    }

    const unchecked = getUncheckedIngredients();
    setIsCreatingList(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/shopping/lists`, {
        name: newListName.trim(),
        ingredients: unchecked
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success(`Created "${newListName}" with ${unchecked.length} items!`);
        setShowListSelector(false);
        setNewListName('');
        onClose();
      }
    } catch (error) {
      console.error('Failed to create list:', error);
      toast.error('Failed to create list');
    } finally {
      setIsCreatingList(false);
    }
  };

  // Save to selected list
  const handleSaveToSelectedList = async (listId) => {
    const unchecked = getUncheckedIngredients();
    if (unchecked.length === 0) return;

    setIsSavingToList(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/shopping/lists/${listId}/items`, {
        ingredients: unchecked,
        recipe_name: recipeName
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const listName = shoppingLists.find(l => l.list_id === listId)?.name || 'your list';
      toast.success(`${unchecked.length} items saved to "${listName}"!`);
      setShowListSelector(false);
      onClose();
    } catch (error) {
      console.error('Failed to save to list:', error);
      toast.error('Failed to save to grocery list');
    } finally {
      setIsSavingToList(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] rounded-t-3xl px-0 pb-0"
        data-testid="buy-ingredients-sheet"
      >
        <div className="flex flex-col h-full bg-[#FAF9F6]">
          {/* Header */}
          <SheetHeader className="px-6 py-4 bg-white border-b flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[#5D7A5D]" />
              <SheetTitle className="text-xl font-semibold">My Shopping Cart</SheetTitle>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{totalCount} items</span>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </SheetHeader>

          {/* Content - Categorized Ingredients */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {Object.entries(categorizedIngredients).map(([category, items]) => (
              <div key={category} className="mb-6">
                {/* Category Header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{INGREDIENT_CATEGORIES[category]?.emoji}</span>
                  <span className="text-sm font-semibold text-gray-600 tracking-wide">{category}</span>
                </div>
                
                {/* Items in Category */}
                <div className="space-y-2">
                  {items.map(({ idx, name, fullText }) => {
                    const isChecked = checkedIngredients[idx];
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-xl bg-white border transition-all ${
                          isChecked ? 'opacity-50 border-gray-200' : 'border-gray-100 shadow-sm'
                        }`}
                        data-testid={`ingredient-item-${idx}`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleCheck(idx)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isChecked 
                              ? 'bg-[#5D7A5D] border-[#5D7A5D] text-white' 
                              : 'border-gray-300 hover:border-[#5D7A5D]'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </button>
                        
                        {/* Item Info */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-gray-800 ${isChecked ? 'line-through text-gray-400' : ''}`}>
                            {name}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            From: {recipeName}
                          </p>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button 
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            onClick={() => {/* Add quantity - future feature */}}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button 
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            onClick={() => removeIngredient(idx)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t bg-white px-6 py-4 safe-area-inset-bottom">
            {/* Checked Counter & Clear */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">
                {checkedCount} of {totalCount} items checked
              </span>
              {checkedCount > 0 && (
                <button 
                  onClick={clearAllChecked}
                  className="text-sm font-medium text-red-500 hover:text-red-600"
                >
                  Clear All
                </button>
              )}
            </div>
            
            {/* Copy & Download Buttons */}
            <div className="flex gap-3 mb-4">
              <Button
                variant="outline"
                className="flex-1 rounded-xl border-gray-200"
                onClick={handleCopyList}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy List
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-xl border-gray-200"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
            
            {/* Region Selector */}
            <div className="mb-4">
              <Select
                value={countryInfo?.countryCode || ''}
                onValueChange={handleCountryChange}
              >
                <SelectTrigger 
                  className="w-full rounded-xl border-gray-200"
                  data-testid="region-selector"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#5D7A5D]" />
                    <SelectValue placeholder="Select Region">
                      {countryInfo?.country 
                        ? `${AVAILABLE_COUNTRIES.find(c => c.code === countryInfo.countryCode)?.flag || '🌍'} ${countryInfo.country}`
                        : 'Select Region'
                      }
                    </SelectValue>
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {AVAILABLE_COUNTRIES.map((country) => (
                    <SelectItem
                      key={country.code}
                      value={country.code}
                      className="cursor-pointer"
                      data-testid={`region-option-${country.code}`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{country.flag}</span>
                        {country.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {deliveryApps.length > 0 && (
                <p className="text-xs text-gray-400 mt-1 px-1">
                  {deliveryApps.length} delivery app{deliveryApps.length > 1 ? 's' : ''} available in {countryInfo?.country || 'your region'}
                </p>
              )}
            </div>
            
            {/* Main Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={handleSaveToGroceryList}
                disabled={isSavingToList || checkedCount === totalCount}
              >
                {isSavingToList ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <BookmarkPlus className="w-4 h-4 mr-2" />
                )}
                Save to Grocery List
              </Button>
              <Button
                className="flex-1 rounded-xl bg-[#5D7A5D] hover:bg-[#4D6A4D] text-white"
                onClick={handleOrderNowClick}
                disabled={checkedCount === totalCount || isLoadingApps}
                data-testid="order-now-btn"
              >
                {isLoadingApps ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShoppingCart className="w-4 h-4 mr-2" />
                )}
                Order Now
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>

      {/* List Selector Dialog */}
      <Dialog open={showListSelector} onOpenChange={setShowListSelector}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen size={20} className="text-[#5D7A5D]" />
              Save to Grocery List
            </DialogTitle>
            <DialogDescription>
              Select an existing list or create a new one
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Existing lists */}
            {shoppingLists.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-2">Choose a list:</p>
                {shoppingLists.map((list) => (
                  <button
                    key={list.list_id}
                    onClick={() => handleSaveToSelectedList(list.list_id)}
                    disabled={isSavingToList}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-secondary/50 transition-all text-left"
                    data-testid={`list-option-${list.list_id}`}
                  >
                    <ListPlus className="w-5 h-5 text-[#5D7A5D] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{list.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {list.items?.length || 0} items
                      </p>
                    </div>
                    {isSavingToList && selectedListId === list.list_id && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </button>
                ))}
              </div>
            )}
            
            {/* Create new list */}
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-2">Or create a new list:</p>
              <div className="flex gap-2">
                <Input
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateListAndSave()}
                  placeholder="e.g., Weekly Groceries"
                  className="flex-1 rounded-xl"
                  data-testid="new-list-input"
                />
                <Button
                  onClick={handleCreateListAndSave}
                  disabled={!newListName.trim() || isCreatingList}
                  className="rounded-xl bg-[#5D7A5D] hover:bg-[#4D6A4D]"
                >
                  {isCreatingList ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delivery App Selector Dialog */}
      <Dialog open={showDeliveryOptions} onOpenChange={setShowDeliveryOptions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store size={20} className="text-[#5D7A5D]" />
              Choose Delivery Service
            </DialogTitle>
            <DialogDescription>
              {countryInfo?.country 
                ? `Available delivery apps in ${countryInfo.country}`
                : 'Select your preferred delivery service'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            {deliveryApps.map((app) => (
              <button
                key={app.id}
                onClick={() => handleSelectDeliveryApp(app)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border hover:bg-secondary/50 hover:border-[#5D7A5D]/30 transition-all text-left group"
                data-testid={`delivery-app-${app.id}`}
              >
                {/* App Logo */}
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
                  style={{ backgroundColor: app.color ? `${app.color}15` : '#f3f4f6' }}
                >
                  {app.logo ? (
                    <img 
                      src={app.logo} 
                      alt={app.name} 
                      className="w-8 h-8 object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <Store 
                    className="w-6 h-6" 
                    style={{ color: app.color || '#5D7A5D', display: app.logo ? 'none' : 'block' }} 
                  />
                </div>
                
                {/* App Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 group-hover:text-[#5D7A5D] transition-colors">
                    {app.name}
                  </p>
                  {app.delivery_time && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {app.delivery_time}
                    </p>
                  )}
                </div>
                
                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#5D7A5D] transition-colors" />
              </button>
            ))}
            
            {deliveryApps.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Store className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No delivery apps available</p>
                <p className="text-sm mt-1">Try selecting a different region</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
};

export default BuyIngredientsSheet;
