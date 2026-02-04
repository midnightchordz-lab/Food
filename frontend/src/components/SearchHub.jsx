import { useState } from 'react';
import { Search, MapPin, DollarSign, ExternalLink, Star, Clock, ShoppingCart, Store, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

/**
 * SearchHub Component
 * Provides recipe search, grocery store finder, and ingredient price check features
 * powered by SerpAPI
 */
const SearchHub = ({ isOpen, onClose, initialIngredient = '', initialRecipe = '' }) => {
  const [activeTab, setActiveTab] = useState('recipes');
  
  // Recipe Search State
  const [recipeQuery, setRecipeQuery] = useState(initialRecipe);
  const [recipeCuisine, setRecipeCuisine] = useState('');
  const [recipeResults, setRecipeResults] = useState([]);
  const [isSearchingRecipes, setIsSearchingRecipes] = useState(false);
  
  // Grocery Store State
  const [storeLocation, setStoreLocation] = useState('');
  const [storeIngredient, setStoreIngredient] = useState(initialIngredient);
  const [storeResults, setStoreResults] = useState([]);
  const [isSearchingStores, setIsSearchingStores] = useState(false);
  
  // Price Check State
  const [priceIngredient, setPriceIngredient] = useState(initialIngredient);
  const [priceLocation, setPriceLocation] = useState('USA');
  const [priceResults, setPriceResults] = useState(null);
  const [isCheckingPrices, setIsCheckingPrices] = useState(false);

  // Search Recipes
  const searchRecipes = async () => {
    if (!recipeQuery.trim()) {
      toast.error('Please enter a recipe to search');
      return;
    }
    
    setIsSearchingRecipes(true);
    try {
      const response = await axios.post(`${API}/search/recipes`, {
        query: recipeQuery,
        cuisine: recipeCuisine || null,
        limit: 10
      });
      
      setRecipeResults(response.data.results || []);
      if (response.data.results?.length === 0) {
        toast.info('No recipes found. Try a different search term.');
      }
    } catch (error) {
      console.error('Recipe search error:', error);
      toast.error('Failed to search recipes');
    } finally {
      setIsSearchingRecipes(false);
    }
  };

  // Find Grocery Stores
  const findGroceryStores = async () => {
    if (!storeLocation.trim()) {
      toast.error('Please enter a location');
      return;
    }
    
    setIsSearchingStores(true);
    try {
      const response = await axios.post(`${API}/search/grocery-stores`, {
        location: storeLocation,
        ingredient: storeIngredient || null
      });
      
      setStoreResults(response.data.stores || []);
      if (response.data.stores?.length === 0) {
        toast.info('No stores found. Try a different location.');
      }
    } catch (error) {
      console.error('Store search error:', error);
      toast.error('Failed to find stores');
    } finally {
      setIsSearchingStores(false);
    }
  };

  // Check Ingredient Prices
  const checkPrices = async () => {
    if (!priceIngredient.trim()) {
      toast.error('Please enter an ingredient');
      return;
    }
    
    setIsCheckingPrices(true);
    try {
      const response = await axios.post(`${API}/search/ingredient-prices`, {
        ingredient: priceIngredient,
        location: priceLocation
      });
      
      setPriceResults(response.data);
      if (response.data.prices?.length === 0) {
        toast.info('No prices found. Try a different ingredient.');
      }
    } catch (error) {
      console.error('Price check error:', error);
      toast.error('Failed to check prices');
    } finally {
      setIsCheckingPrices(false);
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = `${position.coords.latitude},${position.coords.longitude}`;
          setStoreLocation(coords);
          toast.success('Location detected!');
        },
        (error) => {
          toast.error('Could not get location. Please enter manually.');
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Search className="w-5 h-5 text-primary" />
            Search Hub
          </DialogTitle>
          <DialogDescription>
            Search recipes, find grocery stores, and check ingredient prices
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="recipes" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Recipe Search</span>
              <span className="sm:hidden">Recipes</span>
            </TabsTrigger>
            <TabsTrigger value="stores" className="flex items-center gap-2">
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">Grocery Stores</span>
              <span className="sm:hidden">Stores</span>
            </TabsTrigger>
            <TabsTrigger value="prices" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">Price Check</span>
              <span className="sm:hidden">Prices</span>
            </TabsTrigger>
          </TabsList>

          {/* Recipe Search Tab */}
          <TabsContent value="recipes" className="flex-1 overflow-auto mt-4 space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search for recipes (e.g., 'chicken tikka masala')"
                value={recipeQuery}
                onChange={(e) => setRecipeQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchRecipes()}
                className="flex-1"
              />
              <Input
                placeholder="Cuisine (optional)"
                value={recipeCuisine}
                onChange={(e) => setRecipeCuisine(e.target.value)}
                className="w-32"
              />
              <Button onClick={searchRecipes} disabled={isSearchingRecipes}>
                {isSearchingRecipes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            <div className="space-y-3 overflow-auto max-h-[50vh]">
              {recipeResults.map((recipe, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded-lg border ${recipe.is_featured ? 'bg-primary/5 border-primary/30' : 'bg-card border-border'} hover:shadow-md transition-all`}
                >
                  <div className="flex gap-3">
                    {recipe.thumbnail && (
                      <img src={recipe.thumbnail} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-sm line-clamp-2">{recipe.title}</h3>
                        {recipe.is_featured && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full flex-shrink-0">
                            Featured
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{recipe.snippet}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">{recipe.source}</span>
                        <a 
                          href={recipe.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          View Recipe <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {recipeResults.length === 0 && !isSearchingRecipes && (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Search for recipes from across the web</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Grocery Stores Tab */}
          <TabsContent value="stores" className="flex-1 overflow-auto mt-4 space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="Enter location (city, address)"
                  value={storeLocation}
                  onChange={(e) => setStoreLocation(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && findGroceryStores()}
                  className="flex-1"
                />
                <Button variant="outline" size="icon" onClick={getCurrentLocation} title="Use my location">
                  <MapPin className="w-4 h-4" />
                </Button>
              </div>
              <Input
                placeholder="Ingredient (optional)"
                value={storeIngredient}
                onChange={(e) => setStoreIngredient(e.target.value)}
                className="w-32"
              />
              <Button onClick={findGroceryStores} disabled={isSearchingStores}>
                {isSearchingStores ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            <div className="space-y-3 overflow-auto max-h-[50vh]">
              {storeResults.map((store, idx) => (
                <div key={idx} className="p-3 rounded-lg border bg-card border-border hover:shadow-md transition-all">
                  <div className="flex gap-3">
                    {store.thumbnail && (
                      <img src={store.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium text-sm">{store.name}</h3>
                        {store.rating && store.rating !== 'N/A' && (
                          <div className="flex items-center gap-1 text-xs">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span>{store.rating}</span>
                            {store.reviews > 0 && <span className="text-muted-foreground">({store.reviews})</span>}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{store.address}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        {store.hours && (
                          <span className={store.open_now ? 'text-green-600' : 'text-muted-foreground'}>
                            <Clock className="w-3 h-3 inline mr-1" />
                            {store.open_now ? 'Open' : store.hours}
                          </span>
                        )}
                        {store.phone && <span>{store.phone}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {store.google_maps_url && (
                          <a 
                            href={store.google_maps_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full hover:bg-blue-600 flex items-center gap-1 transition-colors"
                            data-testid={`store-map-link-${idx}`}
                          >
                            <MapPin className="w-3 h-3" /> View on Map
                          </a>
                        )}
                        {store.directions_link && !store.google_maps_url && (
                          <a 
                            href={store.directions_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" /> Directions
                          </a>
                        )}
                        {store.website && (
                          <a 
                            href={store.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> Website
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {storeResults.length === 0 && !isSearchingStores && (
                <div className="text-center py-8 text-muted-foreground">
                  <Store className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Find grocery stores near you</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Price Check Tab */}
          <TabsContent value="prices" className="flex-1 overflow-auto mt-4 space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter ingredient (e.g., 'olive oil')"
                value={priceIngredient}
                onChange={(e) => setPriceIngredient(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && checkPrices()}
                className="flex-1"
              />
              <Input
                placeholder="Location"
                value={priceLocation}
                onChange={(e) => setPriceLocation(e.target.value)}
                className="w-24"
              />
              <Button onClick={checkPrices} disabled={isCheckingPrices}>
                {isCheckingPrices ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              </Button>
            </div>

            {/* Location & Currency Info */}
            {priceResults?.detected_location && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg flex items-center gap-2">
                <MapPin className="w-3 h-3" />
                <span>Showing prices for <strong>{priceResults.detected_location}</strong></span>
                {priceResults.currency && (
                  <span className="ml-auto bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {priceResults.currency}
                  </span>
                )}
              </div>
            )}

            {/* Price Stats */}
            {priceResults?.price_stats && Object.keys(priceResults.price_stats).length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                  <p className="text-xs text-muted-foreground">Lowest</p>
                  <p className="text-lg font-bold text-green-600">
                    {getCurrencySymbol(priceResults.price_stats.currency)}{priceResults.price_stats.min_price}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
                  <p className="text-xs text-muted-foreground">Average</p>
                  <p className="text-lg font-bold text-blue-600">
                    {getCurrencySymbol(priceResults.price_stats.currency)}{priceResults.price_stats.avg_price}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-center">
                  <p className="text-xs text-muted-foreground">Highest</p>
                  <p className="text-lg font-bold text-orange-600">
                    {getCurrencySymbol(priceResults.price_stats.currency)}{priceResults.price_stats.max_price}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3 overflow-auto max-h-[40vh]">
              {priceResults?.prices?.map((item, idx) => (
                <div key={idx} className="p-3 rounded-lg border bg-card border-border hover:shadow-md transition-all">
                  <div className="flex gap-3">
                    {item.thumbnail && (
                      <img src={item.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-sm line-clamp-2">{item.title}</h3>
                        <span className="text-lg font-bold text-primary flex-shrink-0">{item.price}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{item.source}</span>
                        {item.rating && (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            {item.rating}
                          </span>
                        )}
                      </div>
                      {item.delivery && (
                        <p className="text-xs text-muted-foreground mt-1">{item.delivery}</p>
                      )}
                      <a 
                        href={item.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                      >
                        <ShoppingCart className="w-3 h-3" /> View Deal
                      </a>
                    </div>
                  </div>
                </div>
              ))}
              {(!priceResults || priceResults?.prices?.length === 0) && !isCheckingPrices && (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Check prices for any ingredient</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SearchHub;
