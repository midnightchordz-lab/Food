import { useState, useEffect } from 'react';
import {
  ShoppingCart, Check, MapPin, ExternalLink, Loader2, 
  BookmarkPlus, ChevronRight, Store, Clock, Globe, DollarSign,
  TrendingDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Currency symbols mapping
const CURRENCY_SYMBOLS = {
  'USD': '$', 'INR': '₹', 'GBP': '£', 'EUR': '€', 'CAD': 'C$', 'AUD': 'A$', 'SGD': 'S$', 'AED': 'AED '
};

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
    }
  }, [isOpen, ingredients]);

  // Fetch delivery apps based on user's region
  const fetchDeliveryApps = async () => {
    setIsLoadingApps(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/shopping/delivery-apps`, {
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

    setIsSavingToList(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/shopping/list/add`, {
        ingredients: selected,
        recipe_name: recipeName
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`${selected.length} ingredients saved to your shopping list!`);
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
                {/* Region Info */}
                <div className="flex items-center gap-2 mb-6 p-3 bg-muted/50 rounded-xl">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-sm">
                    Showing apps for <strong>{countryInfo?.country || 'your region'}</strong>
                  </span>
                  {countryInfo?.detectedFrom === 'ip_detection' && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      (auto-detected)
                    </span>
                  )}
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
                  onClick={() => setStep('apps')}
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
                  onClick={() => setStep('select')}
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
    </Sheet>
  );
};

export default BuyIngredientsSheet;
