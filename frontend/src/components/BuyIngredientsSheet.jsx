import { useState, useEffect } from 'react';
import {
  ShoppingCart, Check, MapPin, ExternalLink, Loader2, 
  BookmarkPlus, ChevronRight, Store, Clock, Globe, DollarSign,
  TrendingDown, ChevronDown, Plus, ListPlus, FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
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
import { toast } from 'sonner';
import axios from 'axios';

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

/**
 * BuyIngredientsSheet - Smart Shopping Flow Component
 * 
 * Features:
 * 1. Bottom sheet with ingredient selection (uncheck what you have)
 * 2. Regional delivery app detection based on user's IP/country
 * 3. Direct deep links to delivery apps with pre-filled search
 * 4. Save to shopping list option
 * 5. Price comparison before clicking through
 */
const BuyIngredientsSheet = ({ 
  isOpen, 
  onClose, 
  ingredients = [], 
  recipeName = 'Recipe'
}) => {
  // State for ingredient selection
  const [selectedIngredients, setSelectedIngredients] = useState({});
  
  // State for delivery apps
  const [deliveryApps, setDeliveryApps] = useState([]);
  const [countryInfo, setCountryInfo] = useState(null);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [isSavingToList, setIsSavingToList] = useState(false);
  
  // State for price estimation
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  
  // State for shopping lists
  const [shoppingLists, setShoppingLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [showListSelector, setShowListSelector] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  
  // Step state: 'select' (ingredients) or 'apps' (delivery apps)
  const [step, setStep] = useState('select');

  // Initialize selected ingredients when sheet opens
  useEffect(() => {
    if (isOpen && ingredients.length > 0) {
      const initial = {};
      ingredients.forEach((ing, idx) => {
        initial[idx] = true; // All selected by default
      });
      setSelectedIngredients(initial);
      setStep('select');
      setPriceEstimate(null);
      fetchDeliveryApps();
      fetchShoppingLists();
    }
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
        // Auto-select first list if available
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
      // Map common timezones to country codes
      const tzCountryMap = {
        'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Mumbai': 'IN',
        'America/New_York': 'US', 'America/Los_Angeles': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
        'Europe/London': 'GB', 'Europe/Dublin': 'GB',
        'Asia/Dubai': 'AE', 'Asia/Abu_Dhabi': 'AE',
        'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Perth': 'AU',
        'Asia/Singapore': 'SG',
        'America/Toronto': 'CA', 'America/Vancouver': 'CA',
        'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Rome': 'IT',
        'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN'
      };
      return tzCountryMap[timezone] || null;
    } catch {
      return null;
    }
  };

  // Fetch delivery apps based on user's region
  const fetchDeliveryApps = async () => {
    setIsLoadingApps(true);
    try {
      const token = localStorage.getItem('token');
      
      // Get browser country hint from timezone
      const countryHint = getBrowserCountryHint();
      
      const params = new URLSearchParams();
      if (countryHint) {
        params.append('country_hint', countryHint);
      }
      
      const response = await axios.get(`${API}/shopping/delivery-apps${params.toString() ? '?' + params.toString() : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setDeliveryApps(response.data.apps || []);
        setCountryInfo({
          country: response.data.country,
          countryCode: response.data.country_code,
          currencySymbol: response.data.currency_symbol,
          detectedFrom: response.data.detected_from
        });
      }
    } catch (error) {
      console.error('Failed to fetch delivery apps:', error);
      // Fallback to default apps
      setDeliveryApps([{
        id: 'amazon',
        name: 'Amazon',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/1200px-Amazon_logo.svg.png',
        color: '#FF9900',
        text_color: '#000000',
        delivery_time: '2 days'
      }]);
      setCountryInfo({ country: 'Global', countryCode: 'DEFAULT' });
    } finally {
      setIsLoadingApps(false);
    }
  };

  // Fetch price estimates for selected ingredients
  const fetchPriceEstimate = async () => {
    const selected = getSelectedIngredients();
    if (selected.length === 0) return;

    setIsLoadingPrices(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/shopping/price-estimate`, {
        ingredients: selected,
        country_code: countryInfo?.countryCode || 'US'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setPriceEstimate({
          min: response.data.estimated_total?.min || 0,
          max: response.data.estimated_total?.max || 0,
          currency: response.data.currency || 'USD',
          ingredients: response.data.ingredients || {}
        });
      }
    } catch (error) {
      console.error('Failed to fetch price estimate:', error);
      // Don't show error to user, just skip price display
    } finally {
      setIsLoadingPrices(false);
    }
  };

  // Toggle ingredient selection
  const toggleIngredient = (idx) => {
    setSelectedIngredients(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
    // Clear price estimate when selection changes
    setPriceEstimate(null);
  };

  // Select/Deselect all
  const toggleAll = (select) => {
    const updated = {};
    ingredients.forEach((_, idx) => {
      updated[idx] = select;
    });
    setSelectedIngredients(updated);
    setPriceEstimate(null);
  };

  // Get selected ingredients list
  const getSelectedIngredients = () => {
    return ingredients
      .filter((_, idx) => selectedIngredients[idx])
      .map(ing => ({
        name: typeof ing === 'string' ? ing : (ing.item || ing.name || ''),
        amount: typeof ing === 'string' ? '' : (ing.amount || ''),
        unit: typeof ing === 'string' ? '' : (ing.unit || '')
      }));
  };

  // Count selected
  const selectedCount = Object.values(selectedIngredients).filter(Boolean).length;

  // Get currency symbol
  const getCurrencySymbol = (currency) => CURRENCY_SYMBOLS[currency] || '$';

  // Handle country change
  const handleCountryChange = async (countryCode) => {
    setIsLoadingApps(true);
    try {
      const token = localStorage.getItem('token');
      
      // Save preference to backend
      await axios.post(`${API}/shopping/set-country`, {
        country_code: countryCode
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refetch delivery apps with new country
      const response = await axios.get(`${API}/shopping/delivery-apps?country_hint=${countryCode}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setDeliveryApps(response.data.apps || []);
        setCountryInfo({
          country: response.data.country,
          countryCode: response.data.country_code,
          currencySymbol: response.data.currency_symbol,
          detectedFrom: 'user_preference'
        });
        setPriceEstimate(null); // Clear old prices
        toast.success(`Switched to ${response.data.country}`);
      }
    } catch (error) {
      console.error('Failed to change country:', error);
      toast.error('Failed to change region');
    } finally {
      setIsLoadingApps(false);
    }
  };

  // Handle continue to apps - fetch prices first
  const handleContinueToApps = async () => {
    setStep('apps');
    // Fetch price estimate in the background
    fetchPriceEstimate();
  };

  // Handle delivery app click - build URL and open
  const handleDeliveryAppClick = async (app) => {
    const selected = getSelectedIngredients();
    if (selected.length === 0) {
      toast.error('Please select at least one ingredient');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/shopping/build-url`, {
        app_id: app.id,
        ingredients: selected,
        country_code: countryInfo?.countryCode || 'DEFAULT'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.url) {
        // Open in new tab
        window.open(response.data.url, '_blank');
        toast.success(`Opening ${app.name}...`);
        onClose();
      }
    } catch (error) {
      console.error('Failed to build URL:', error);
      toast.error('Failed to open delivery app');
    }
  };

  // Save to shopping list
  const handleSaveToList = async () => {
    const selected = getSelectedIngredients();
    if (selected.length === 0) {
      toast.error('Please select at least one ingredient');
      return;
    }

    // If no list selected, show list selector
    if (!selectedListId && shoppingLists.length > 0) {
      setShowListSelector(true);
      return;
    }

    // If no lists exist, create a new one
    if (shoppingLists.length === 0) {
      setShowListSelector(true);
      return;
    }

    setIsSavingToList(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/shopping/lists/${selectedListId}/items`, {
        ingredients: selected,
        recipe_name: recipeName
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const listName = shoppingLists.find(l => l.list_id === selectedListId)?.name || 'your list';
      toast.success(`${selected.length} ingredients saved to "${listName}"!`);
      onClose();
    } catch (error) {
      console.error('Failed to save to list:', error);
      toast.error('Failed to save to shopping list');
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

    const selected = getSelectedIngredients();
    setIsCreatingList(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/shopping/lists`, {
        name: newListName.trim(),
        ingredients: selected
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success(`Created "${newListName}" with ${selected.length} ingredients!`);
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

  // Save to selected list from selector
  const handleSaveToSelectedList = async (listId) => {
    const selected = getSelectedIngredients();
    if (selected.length === 0) return;

    setIsSavingToList(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/shopping/lists/${listId}/items`, {
        ingredients: selected,
        recipe_name: recipeName
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const listName = shoppingLists.find(l => l.list_id === listId)?.name || 'your list';
      toast.success(`${selected.length} ingredients saved to "${listName}"!`);
      setShowListSelector(false);
      onClose();
    } catch (error) {
      console.error('Failed to save to list:', error);
      toast.error('Failed to save to shopping list');
    } finally {
      setIsSavingToList(false);
    }
  };

  // Parse ingredient display name
  const getIngredientDisplay = (ing) => {
    if (typeof ing === 'string') return ing;
    const amount = ing.amount ? `${ing.amount} ` : '';
    const item = ing.item || ing.name || '';
    return `${amount}${item}`.trim();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] rounded-t-3xl px-0 pb-0"
        data-testid="buy-ingredients-sheet"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Buy Ingredients
            </SheetTitle>
            <SheetDescription>
              {recipeName}
            </SheetDescription>
          </SheetHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {step === 'select' ? (
              /* Step 1: Ingredient Selection */
              <div className="p-6">
                {/* Selection Controls */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">
                    {selectedCount} of {ingredients.length} selected
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => toggleAll(true)}
                    >
                      Select All
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => toggleAll(false)}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Ingredients List */}
                <div className="space-y-2" data-testid="ingredients-selection-list">
                  {ingredients.map((ing, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleIngredient(idx)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        selectedIngredients[idx]
                          ? 'bg-primary/5 border-primary/30'
                          : 'bg-muted/30 border-transparent opacity-60'
                      }`}
                      data-testid={`ingredient-item-${idx}`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        selectedIngredients[idx]
                          ? 'bg-primary border-primary text-white'
                          : 'border-muted-foreground/30'
                      }`}>
                        {selectedIngredients[idx] && <Check className="w-4 h-4" />}
                      </div>
                      <span className={`text-left flex-1 ${
                        selectedIngredients[idx] ? '' : 'line-through text-muted-foreground'
                      }`}>
                        {getIngredientDisplay(ing)}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Tip */}
                <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-sm text-blue-700">
                    💡 <strong>Tip:</strong> Uncheck ingredients you already have at home
                  </p>
                </div>
              </div>
            ) : (
              /* Step 2: Delivery App Selection */
              <div className="p-6">
                {/* Price Estimate Banner */}
                {(isLoadingPrices || priceEstimate) && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-500/10">
                        {isLoadingPrices ? (
                          <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-800">
                          {isLoadingPrices ? 'Calculating prices...' : 'Estimated Total'}
                        </p>
                        {priceEstimate && priceEstimate.max > 0 ? (
                          <p className="text-lg font-bold text-green-700">
                            {getCurrencySymbol(priceEstimate.currency)}{priceEstimate.min.toFixed(2)} - {getCurrencySymbol(priceEstimate.currency)}{priceEstimate.max.toFixed(2)}
                          </p>
                        ) : priceEstimate ? (
                          <p className="text-sm text-green-600">Prices vary by store</p>
                        ) : null}
                      </div>
                      <DollarSign className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                )}

                {/* Region Info with Country Selector */}
                <div className="flex items-center gap-2 mb-6 p-3 bg-muted/50 rounded-xl">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm flex-1">
                    Showing apps for
                  </span>
                  
                  {/* Country Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-2 font-medium"
                        data-testid="country-selector"
                      >
                        {AVAILABLE_COUNTRIES.find(c => c.code === countryInfo?.countryCode)?.flag || '🌍'}{' '}
                        <strong>{countryInfo?.country || 'Select'}</strong>
                        <ChevronDown className="w-4 h-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {AVAILABLE_COUNTRIES.map((country) => (
                        <DropdownMenuItem
                          key={country.code}
                          onClick={() => handleCountryChange(country.code)}
                          className={countryInfo?.countryCode === country.code ? 'bg-primary/10' : ''}
                          data-testid={`country-option-${country.code}`}
                        >
                          <span className="mr-2">{country.flag}</span>
                          {country.name}
                          {countryInfo?.countryCode === country.code && (
                            <Check className="w-4 h-4 ml-auto text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Loading State */}
                {isLoadingApps ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                    <p className="text-muted-foreground">Finding delivery apps...</p>
                  </div>
                ) : (
                  /* Delivery Apps Grid */
                  <div className="grid grid-cols-2 gap-3" data-testid="delivery-apps-grid">
                    {deliveryApps.map((app) => (
                      <button
                        key={app.id}
                        onClick={() => handleDeliveryAppClick(app)}
                        className="flex flex-col items-center p-4 rounded-2xl border-2 border-border hover:border-primary/50 transition-all hover:shadow-md group"
                        style={{ backgroundColor: `${app.color}15` }}
                        data-testid={`delivery-app-${app.id}`}
                      >
                        <div className="w-16 h-16 rounded-xl bg-white shadow-sm flex items-center justify-center mb-3 overflow-hidden">
                          <img 
                            src={app.logo} 
                            alt={app.name}
                            className="w-12 h-12 object-contain"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <Store 
                            className="w-8 h-8 text-muted-foreground hidden items-center justify-center" 
                          />
                        </div>
                        <span className="font-medium text-sm mb-1">{app.name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {app.delivery_time}
                        </span>
                        <ExternalLink className="w-4 h-4 text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected Ingredients Summary */}
                <div className="mt-6 p-4 bg-muted/30 rounded-xl">
                  <p className="text-sm font-medium mb-2">
                    Shopping for {selectedCount} ingredient{selectedCount !== 1 ? 's' : ''}:
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {getSelectedIngredients().map(i => i.name).join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t bg-background p-4 safe-area-inset-bottom">
            {step === 'select' ? (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleSaveToList}
                  disabled={selectedCount === 0 || isSavingToList}
                  data-testid="save-to-list-btn"
                >
                  {isSavingToList ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <BookmarkPlus className="w-4 h-4 mr-2" />
                  )}
                  Save to List
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  onClick={handleContinueToApps}
                  disabled={selectedCount === 0}
                  data-testid="continue-to-apps-btn"
                >
                  Continue
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setStep('select'); setPriceEstimate(null); }}
                  className="flex-1"
                >
                  Back to Ingredients
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveToList}
                  disabled={selectedCount === 0 || isSavingToList}
                  className="flex-1"
                >
                  {isSavingToList ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <BookmarkPlus className="w-4 h-4 mr-2" />
                  )}
                  Save to List Instead
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>

      {/* List Selector Dialog */}
      <Dialog open={showListSelector} onOpenChange={setShowListSelector}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen size={20} className="text-primary" />
              Save to Shopping List
            </DialogTitle>
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
                    <ListPlus className="w-5 h-5 text-primary flex-shrink-0" />
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
                  className="rounded-xl"
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
    </Sheet>
  );
};

export default BuyIngredientsSheet;
