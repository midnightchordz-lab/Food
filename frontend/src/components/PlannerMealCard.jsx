import { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// In-memory cache for images
const imageCache = new Map();

// Get fast image using Google Images (with AI fallback)
const getFastImage = async (recipeName, cuisine = '') => {
  console.log(`[PlannerMealCard] Fetching image for: "${recipeName}"`);
  try {
    const response = await axios.post(`${API}/recipe-image/fast`, {
      recipe_name: recipeName,
      cuisine: cuisine,
      use_ai_fallback: true
    }, {
      timeout: 30000 // 30 second timeout to allow AI fallback time
    });
    console.log(`[PlannerMealCard] Image response for "${recipeName}":`, response.data?.source);
    return {
      url: response.data.image_url,
      source: response.data.source,
      alternatives: response.data.alternatives || []
    };
  } catch (error) {
    console.error(`[PlannerMealCard] Error fetching image for "${recipeName}":`, error.message);
    return null;
  }
};

// Generate AI image for a recipe (slower but higher quality)
const generateAIImage = async (recipeName, cuisine = '') => {
  try {
    const response = await axios.post(`${API}/recipe-image/generate`, {
      recipe_name: recipeName,
      cuisine: cuisine
    });
    return response.data.image_url;
  } catch (error) {
    console.error('Error generating AI image:', error);
    return null;
  }
};

// Default food images for fallback
const DEFAULT_IMAGES = {
  breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400',
  lunch: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
  dinner: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400',
  default: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
};

/**
 * Meal Card Component with Fast Image Loading (Google Images + AI Fallback)
 * Used in Weekly Planners (regular and diabetes)
 */
const PlannerMealCard = ({ 
  mealName, 
  mealType = 'default',
  carbs = null,
  onClick,
  compact = false,
  enableAI = true 
}) => {
  const [imageUrl, setImageUrl] = useState(DEFAULT_IMAGES[mealType] || DEFAULT_IMAGES.default);
  const [isLoading, setIsLoading] = useState(false);
  const [imageSource, setImageSource] = useState('static'); // 'google_images', 'ai_generated', 'static', 'error'
  const [retryCount, setRetryCount] = useState(0);
  const hasTriedFetch = useRef(false);

  // Clean up meal name (remove carbs info if present)
  const cleanName = mealName?.replace(/\s*\(\d+g?\s*carbs?\)/gi, '').trim() || '';

  // Function to fetch image
  const fetchImage = async (forceRetry = false) => {
    if (!cleanName) return;
    if (!forceRetry && hasTriedFetch.current) return;
    
    hasTriedFetch.current = true;
    
    // Check cache first
    const cacheKey = cleanName.toLowerCase();
    if (!forceRetry && imageCache.has(cacheKey)) {
      const cached = imageCache.get(cacheKey);
      setImageUrl(cached.url);
      setImageSource(cached.source);
      return;
    }
    
    setIsLoading(true);
    setImageSource('loading');
    
    try {
      const result = await getFastImage(cleanName);
      if (result && result.url) {
        imageCache.set(cacheKey, result);
        setImageUrl(result.url);
        setImageSource(result.source || 'google_images');
      } else {
        // No image found - try AI generation directly
        console.log(`No fast image found for "${cleanName}", trying AI directly...`);
        const aiUrl = await generateAIImage(cleanName);
        if (aiUrl) {
          imageCache.set(cacheKey, { url: aiUrl, source: 'ai_generated' });
          setImageUrl(aiUrl);
          setImageSource('ai_generated');
        } else {
          setImageSource('error');
        }
      }
    } catch (err) {
      console.error('Image fetch failed:', err);
      setImageSource('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle manual retry
  const handleRetry = async (e) => {
    e?.stopPropagation();
    e?.preventDefault();
    setRetryCount(prev => prev + 1);
    hasTriedFetch.current = false;
    await fetchImage(true);
  };

  // Auto-fetch fast image on mount
  useEffect(() => {
    if (!enableAI || !cleanName) return;
    
    // Longer stagger to avoid rate limiting (500ms - 2500ms random delay)
    const delay = 500 + Math.random() * 2000;
    const timer = setTimeout(() => fetchImage(), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanName, enableAI]);

  if (!mealName) {
    return (
      <div className={`bg-muted/30 rounded-xl flex items-center justify-center text-muted-foreground/50 ${compact ? 'h-20' : 'h-24'}`}>
        <span className="text-xs">No meal</span>
      </div>
    );
  }

  if (compact) {
    // Compact view - shows image and full recipe name
    return (
      <div 
        onClick={onClick}
        className="bg-card rounded-xl p-2 border border-border/50 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
      >
        <div className="flex gap-2">
          {/* Image thumbnail */}
          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
            <img 
              src={imageUrl} 
              alt={cleanName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {isLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <RefreshCw className="w-3 h-3 text-white animate-spin" />
              </div>
            )}
            {imageSource === 'error' && !isLoading && (
              <button
                onClick={handleRetry}
                className="absolute inset-0 bg-black/50 flex items-center justify-center"
                title="Retry loading image"
              >
                <RefreshCw className="w-3 h-3 text-white" />
              </button>
            )}
            {imageSource === 'google_images' && !isLoading && (
              <div className="absolute bottom-0 right-0 bg-blue-600 rounded-tl-md p-0.5">
                <span className="text-white text-[8px]">⚡</span>
              </div>
            )}
            {imageSource === 'ai_generated' && !isLoading && (
              <div className="absolute bottom-0 right-0 bg-purple-600 rounded-tl-md p-0.5">
                <Sparkles className="w-2 h-2 text-white" />
              </div>
            )}
          </div>
          {/* Recipe name - full text */}
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

  // Full card view with image
  return (
    <div 
      onClick={onClick}
      className="bg-card rounded-xl border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer group overflow-hidden"
    >
      {/* Image Section */}
      <div className="relative h-20 w-full overflow-hidden">
        <img 
          src={imageUrl} 
          alt={cleanName}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Source Badge */}
        {imageSource === 'google_images' && !isLoading && (
          <div className="absolute top-1 left-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <span>⚡</span>
            <span>Fast</span>
          </div>
        )}
        {imageSource === 'ai_generated' && !isLoading && (
          <div className="absolute top-1 left-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Sparkles className="w-2 h-2" />
            <span>AI</span>
          </div>
        )}
        
        {/* Error/Retry Overlay */}
        {imageSource === 'error' && !isLoading && (
          <button
            onClick={handleRetry}
            className="absolute inset-0 bg-gradient-to-br from-gray-900/70 to-gray-800/70 flex items-center justify-center z-10"
            title="Retry loading image"
          >
            <div className="text-center text-white">
              <RefreshCw className="w-4 h-4 mx-auto" />
              <p className="text-[10px] mt-1">Retry</p>
            </div>
          </button>
        )}
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/60 to-cyan-900/60 flex items-center justify-center">
            <div className="text-center text-white">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
              <p className="text-[10px] mt-1">Loading...</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Text Section */}
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
