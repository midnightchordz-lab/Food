import { useState, useEffect } from 'react';
import { 
  ShoppingCart, DollarSign, ExternalLink, Loader2, Store, 
  ChevronDown, ChevronUp, Package, TrendingDown, Check, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Currency symbols
const CURRENCY_SYMBOLS = {
  'USD': '$', 'INR': '₹', 'GBP': '£', 'EUR': '€', 'CAD': 'C$', 'AUD': 'A$'
};

/**
 * Quick Buy Ingredients Button
 * One-click to search all recipe ingredients on Google Shopping
 */
export const BuyIngredientsButton = ({ ingredients, recipeName, location = "USA", onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const handleBuyIngredients = async () => {
    if (!ingredients || ingredients.length === 0) {
      toast.error('No ingredients to search');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Extract ingredient names from various formats
      const ingredientNames = ingredients.map(ing => {
        if (typeof ing === 'string') return ing;
        return ing.item || ing.name || '';
      }).filter(Boolean).slice(0, 15);

      const response = await axios.post(`${API}/search/buy-ingredients`, {
        ingredients: ingredientNames,
        location: location
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setResults(response.data);
      setShowResults(true);
      toast.success(`Found ${response.data.buy_links?.length || 0} ingredients!`);
      if (onComplete) onComplete(response.data);
    } catch (error) {
      console.error('Buy ingredients error:', error);
      toast.error('Failed to search ingredients');
    } finally {
      setIsLoading(false);
    }
  };

  const currency = results?.currency || 'USD';
  const symbol = CURRENCY_SYMBOLS[currency] || '$';

  return (
    <div className="w-full">
      <Button 
        onClick={handleBuyIngredients} 
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
        data-testid="buy-ingredients-btn"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Finding best prices...
          </>
        ) : (
          <>
            <ShoppingCart className="w-4 h-4 mr-2" />
            Buy Ingredients
          </>
        )}
      </Button>

      {/* Results Dropdown */}
      {showResults && results && (
        <div className="mt-3 bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowResults(!showResults)}
            className="w-full p-3 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
          >
            <span className="font-medium flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-green-600" />
              Estimated Total: {symbol}{results.estimated_total?.min || '0'} - {symbol}{results.estimated_total?.max || '0'}
            </span>
            <ChevronUp className="w-4 h-4" />
          </button>
          
          <div className="max-h-64 overflow-y-auto p-2 space-y-2">
            {results.buy_links?.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                {item.thumbnail && (
                  <img src={item.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.ingredient}</p>
                  <p className="text-xs text-muted-foreground">{item.source}</p>
                </div>
                <span className="text-sm font-bold text-green-600">{item.price}</span>
                <a 
                  href={item.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-primary" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


/**
 * Price Comparison Widget for Shopping List
 * Shows cheapest options for each ingredient
 */
export const PriceComparisonWidget = ({ ingredients, location = "USA" }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [priceData, setPriceData] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const fetchPrices = async () => {
    if (!ingredients || ingredients.length === 0) return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const ingredientNames = ingredients.map(ing => 
        typeof ing === 'string' ? ing : (ing.item || ing.name || '')
      ).filter(Boolean).slice(0, 15);

      const response = await axios.post(`${API}/search/batch-prices`, {
        ingredients: ingredientNames,
        location: location
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setPriceData(response.data);
    } catch (error) {
      console.error('Price comparison error:', error);
      toast.error('Failed to fetch prices');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (expanded && !priceData && !isLoading) {
      fetchPrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const currency = priceData?.currency || 'USD';
  const symbol = CURRENCY_SYMBOLS[currency] || '$';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        data-testid="price-comparison-toggle"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-blue-500/10">
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <h3 className="font-medium">Price Comparison</h3>
            <p className="text-sm text-muted-foreground">Find cheapest options</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {expanded && (
        <div className="border-t border-border p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Comparing prices...</span>
            </div>
          ) : priceData ? (
            <div className="space-y-4">
              {/* Total Estimate */}
              <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                <p className="text-sm text-muted-foreground">Estimated Total</p>
                <p className="text-xl font-bold text-green-600">
                  {symbol}{priceData.estimated_total?.min} - {symbol}{priceData.estimated_total?.max}
                </p>
              </div>

              {/* Individual Items */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(priceData.ingredients || {}).map(([ing, data], idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <span className="text-sm truncate flex-1">{ing}</span>
                    {data.success && data.cheapest ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-green-600">
                          {data.cheapest.price}
                        </span>
                        <a 
                          href={data.cheapest.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          {data.cheapest.source?.slice(0, 15)}
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No price found</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Click to load prices</p>
          )}
        </div>
      )}
    </div>
  );
};


/**
 * Shopping Cart Builder
 * Aggregate items from multiple recipes into a single shopping search
 */
export const ShoppingCartBuilder = ({ recipes = [], location = "USA", onCartBuilt }) => {
  const [isBuilding, setIsBuilding] = useState(false);
  const [cart, setCart] = useState(null);
  const [userLocation, setUserLocation] = useState(location);

  const buildCart = async () => {
    if (!recipes || recipes.length === 0) {
      toast.error('No recipes selected');
      return;
    }

    setIsBuilding(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/search/shopping-cart`, {
        recipes: recipes,
        location: userLocation
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCart(response.data);
      toast.success(`Cart built with ${response.data.total_items} items!`);
      if (onCartBuilt) onCartBuilt(response.data);
    } catch (error) {
      console.error('Cart building error:', error);
      toast.error('Failed to build shopping cart');
    } finally {
      setIsBuilding(false);
    }
  };

  const currency = cart?.currency || 'USD';
  const symbol = CURRENCY_SYMBOLS[currency] || '$';

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-purple-500/10">
          <Package className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-medium">Shopping Cart Builder</h3>
          <p className="text-sm text-muted-foreground">
            {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Your location"
            value={userLocation}
            onChange={(e) => setUserLocation(e.target.value)}
            className="h-9"
          />
        </div>
        <Button 
          onClick={buildCart} 
          disabled={isBuilding || recipes.length === 0}
          className="bg-purple-600 hover:bg-purple-700"
          data-testid="build-cart-btn"
        >
          {isBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Build Cart'}
        </Button>
      </div>

      {cart && (
        <div className="space-y-3 border-t border-border pt-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold">{cart.total_items}</p>
              <p className="text-xs text-muted-foreground">Items</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg text-center">
              <p className="text-lg font-bold text-green-600">
                {symbol}{cart.estimated_total?.min || '0'}
              </p>
              <p className="text-xs text-muted-foreground">Est. Total</p>
            </div>
          </div>

          {/* Cart Items */}
          <div className="max-h-48 overflow-y-auto space-y-2">
            {cart.cart_items?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.ingredient}</p>
                  <p className="text-xs text-muted-foreground">
                    Used in: {item.used_in?.slice(0, 2).join(', ')}
                    {item.used_in?.length > 2 && ` +${item.used_in.length - 2}`}
                  </p>
                </div>
                {item.buy_link ? (
                  <a 
                    href={item.buy_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs bg-green-600 text-white px-2 py-1 rounded-full hover:bg-green-700"
                  >
                    {item.cheapest_price} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


/**
 * Store Filter Dropdown
 * Filter shopping results by specific stores
 */
export const StoreFilterDropdown = ({ value, onChange }) => {
  const [stores, setStores] = useState([]);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const response = await axios.get(`${API}/search/supported-stores`);
        setStores(response.data.stores || []);
      } catch (error) {
        console.error('Failed to fetch stores:', error);
      }
    };
    fetchStores();
  }, []);

  return (
    <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? null : v)}>
      <SelectTrigger className="w-40" data-testid="store-filter-dropdown">
        <Store className="w-4 h-4 mr-2" />
        <SelectValue placeholder="All Stores" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Stores</SelectItem>
        {stores.map((store) => (
          <SelectItem key={store.id} value={store.id}>
            {store.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};


export default {
  BuyIngredientsButton,
  PriceComparisonWidget,
  ShoppingCartBuilder,
  StoreFilterDropdown
};
