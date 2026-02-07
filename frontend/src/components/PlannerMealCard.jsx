import { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Simple in-memory cache
const imageCache = new Map();

// Default food images - extended with more variety
const DEFAULT_IMAGES = {
  breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400',
  lunch: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
  dinner: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400',
  default: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
};

// Extended keyword-based image mapping for better fallbacks
const KEYWORD_IMAGES = {
  // Breakfast items
  'omelette': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400',
  'omelet': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400',
  'scrambled': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400',
  'fluffy': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400',
  'eggs': 'https://images.unsplash.com/photo-1582169296194-e4d644c48063?w=400',
  'pancake': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400',
  'french toast': 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=400',
  'toast': 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=400',
  'oats': 'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?w=400',
  'porridge': 'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?w=400',
  'smoothie': 'https://images.unsplash.com/photo-1502741224143-90386d7f8c82?w=400',
  'yogurt': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400',
  'greek': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400',
  'parfait': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400',
  'peanut butter': 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=400',
  'upma': 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=400',
  'idli': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400',
  'dosa': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400',
  'chia': 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=400',
  'pudding': 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=400',
  'buckwheat': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400',
  'burrito': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400',
  'breakfast burrito': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400',
  'quiche': 'https://images.unsplash.com/photo-1638816750779-ecd5324b92ab?w=400',
  'savory': 'https://images.unsplash.com/photo-1638816750779-ecd5324b92ab?w=400',
  // Lunch/Dinner proteins
  'chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400',
  'grilled chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400',
  'bbq chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400',
  'salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400',
  'baked salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400',
  'fish': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400',
  'shrimp': 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400',
  'prawn': 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400',
  'tofu': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
  'lamb': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400',
  'beef': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
  'steak': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
  // Asian dishes
  'teriyaki': 'https://images.unsplash.com/photo-1569058242567-93de6f36f8eb?w=400',
  'stir fry': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400',
  'stir-fry': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400',
  'thai': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=400',
  'thai green': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400',
  'pad thai': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=400',
  // Indian dishes
  'curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400',
  'dal': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400',
  'lentil': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400',
  'paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400',
  'biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400',
  'masala': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400',
  'tikka': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400',
  'tandoori': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400',
  // Mediterranean
  'mediterranean': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400',
  'hummus': 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=400',
  'falafel': 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=400',
  // Salads and bowls
  'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
  'chickpea': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
  'bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
  'quinoa': 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=400',
  'veggie': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
  'vegetable': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
  // Soups
  'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400',
  // Other
  'grilled': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400',
  'roasted': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400',
  'stuffed': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400',
  'stuffed bell': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400',
  'mushroom': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
  'pilaf': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400',
  'rice': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400',
  'spicy': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400',
};

// Get best matching image for a recipe name
const getKeywordImage = (recipeName, mealType) => {
  const nameLower = recipeName.toLowerCase();
  
  // Check keywords first
  for (const [keyword, url] of Object.entries(KEYWORD_IMAGES)) {
    if (nameLower.includes(keyword)) {
      return url;
    }
  }
  
  // Fall back to meal type default
  return DEFAULT_IMAGES[mealType] || DEFAULT_IMAGES.default;
};

const PlannerMealCard = ({ 
  mealName, 
  mealType = 'default',
  carbs = null,
  onClick,
  compact = false,
  enableAI = true 
}) => {
  const cleanName = mealName?.replace(/\s*\(\d+g?\s*carbs?\)/gi, '').trim() || '';
  // Use keyword-based image as initial default for better visual match
  const defaultImg = cleanName ? getKeywordImage(cleanName, mealType) : (DEFAULT_IMAGES[mealType] || DEFAULT_IMAGES.default);
  const [imageUrl, setImageUrl] = useState(defaultImg);
  const [isLoading, setIsLoading] = useState(false);
  const [imageSource, setImageSource] = useState('default');
  const [errorCount, setErrorCount] = useState(0);
  const hasFetched = useRef(false);
  const previousMealName = useRef(cleanName);

  // Reset image when mealName changes
  useEffect(() => {
    if (previousMealName.current !== cleanName) {
      previousMealName.current = cleanName;
      hasFetched.current = false;
      setErrorCount(0);
      
      // Check cache first
      const cacheKey = cleanName.toLowerCase();
      if (imageCache.has(cacheKey)) {
        const cached = imageCache.get(cacheKey);
        setImageUrl(cached.url);
        setImageSource(cached.source);
      } else {
        // Use keyword-based default immediately
        const newDefaultImg = cleanName ? getKeywordImage(cleanName, mealType) : (DEFAULT_IMAGES[mealType] || DEFAULT_IMAGES.default);
        setImageUrl(newDefaultImg);
        setImageSource('default');
      }
    }
  }, [cleanName, mealType]);

  useEffect(() => {
    if (!enableAI || !cleanName || hasFetched.current) return;
    hasFetched.current = true;

    const cacheKey = cleanName.toLowerCase();
    if (imageCache.has(cacheKey)) {
      const cached = imageCache.get(cacheKey);
      setImageUrl(cached.url);
      setImageSource(cached.source);
      return;
    }

    const fetchImage = async () => {
      setIsLoading(true);
      try {
        // First try without AI fallback for speed
        const response = await axios.post(`${API}/recipe-image/fast`, {
          recipe_name: cleanName,
          cuisine: '',
          use_ai_fallback: false
        }, { timeout: 8000 });

        // Only update if we got a valid image URL (not null, undefined, or empty string)
        if (response.data?.image_url && typeof response.data.image_url === 'string' && response.data.image_url.trim()) {
          imageCache.set(cacheKey, { url: response.data.image_url, source: response.data.source });
          setImageUrl(response.data.image_url);
          setImageSource(response.data.source || 'google');
        } else {
          // No valid image from API - try AI fallback immediately
          try {
            const aiResponse = await axios.post(`${API}/recipe-image/fast`, {
              recipe_name: cleanName,
              cuisine: '',
              use_ai_fallback: true
            }, { timeout: 25000 });
            
            if (aiResponse.data?.image_url && typeof aiResponse.data.image_url === 'string' && aiResponse.data.image_url.trim()) {
              imageCache.set(cacheKey, { url: aiResponse.data.image_url, source: aiResponse.data.source });
              setImageUrl(aiResponse.data.image_url);
              setImageSource(aiResponse.data.source || 'ai_generated');
            }
            // If still no valid image, keep the default (already set)
          } catch {
            // Keep default image
          }
        }
      } catch {
        // Just use default image on error - already set
      } finally {
        setIsLoading(false);
      }
    };

    const delay = Math.random() * 500;
    setTimeout(fetchImage, delay);
  }, [cleanName, enableAI]);

  // Handle broken images - try AI fallback on error
  const handleImgError = async () => {
    // If already using default, nothing more to do
    if (imageSource === 'default') {
      return;
    }
    
    // Only try AI fallback once to prevent infinite loops
    if (errorCount >= 1 || imageSource === 'ai_generated') {
      setImageUrl(defaultImg);
      setImageSource('default');
      return;
    }
    
    setErrorCount(prev => prev + 1);
    
    // Try to get AI-generated image as fallback
    if (enableAI && cleanName) {
      setIsLoading(true);
      try {
        const response = await axios.post(`${API}/recipe-image/fast`, {
          recipe_name: cleanName,
          cuisine: '',
          use_ai_fallback: true  // Enable AI fallback
        }, { timeout: 30000 });  // Longer timeout for AI generation

        if (response.data?.image_url && typeof response.data.image_url === 'string' && response.data.image_url.trim() && response.data.source !== 'none') {
          const cacheKey = cleanName.toLowerCase();
          imageCache.set(cacheKey, { url: response.data.image_url, source: response.data.source });
          setImageUrl(response.data.image_url);
          setImageSource(response.data.source || 'ai_generated');
          return;
        }
      } catch {
        // Fallback to default on error
      } finally {
        setIsLoading(false);
      }
    }
    
    // Final fallback to default image
    setImageUrl(defaultImg);
    setImageSource('default');
  };

  if (!mealName) {
    return (
      <div className={`bg-muted/30 rounded-xl flex items-center justify-center text-muted-foreground/50 ${compact ? 'h-20' : 'h-24'}`}>
        <span className="text-xs">No meal</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div 
        onClick={onClick}
        className="bg-card rounded-xl p-2 border border-border/50 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
      >
        <div className="flex gap-2">
          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
            <img 
              src={imageUrl} 
              alt={cleanName}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={handleImgError}
            />
            {isLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <RefreshCw className="w-3 h-3 text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <p className="text-xs font-medium leading-tight line-clamp-2" title={cleanName}>
              {cleanName}
            </p>
            {carbs && (
              <span className="text-[10px] text-teal-600 mt-0.5">{carbs}g carbs</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className="bg-card rounded-xl border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer group overflow-hidden"
    >
      <div className="relative h-20 w-full overflow-hidden">
        <img 
          src={imageUrl} 
          alt={cleanName}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={handleImgError}
        />
        {isLoading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <RefreshCw className="w-4 h-4 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-medium line-clamp-2">{cleanName}</p>
        {carbs && (
          <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-teal-500/10 text-teal-600">
            {carbs}g carbs
          </span>
        )}
      </div>
    </div>
  );
};

export default PlannerMealCard;
