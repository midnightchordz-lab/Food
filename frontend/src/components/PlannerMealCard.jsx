import { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Simple in-memory cache
const imageCache = new Map();

// Default food images
const DEFAULT_IMAGES = {
  breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400',
  lunch: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
  dinner: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400',
  default: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
};

const PlannerMealCard = ({ 
  mealName, 
  mealType = 'default',
  carbs = null,
  onClick,
  compact = false,
  enableAI = true 
}) => {
  const defaultImg = DEFAULT_IMAGES[mealType] || DEFAULT_IMAGES.default;
  const [imageUrl, setImageUrl] = useState(defaultImg);
  const [isLoading, setIsLoading] = useState(false);
  const [imageSource, setImageSource] = useState('default');
  const [errorCount, setErrorCount] = useState(0);
  const hasFetched = useRef(false);

  const cleanName = mealName?.replace(/\s*\(\d+g?\s*carbs?\)/gi, '').trim() || '';

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

        if (response.data?.image_url) {
          imageCache.set(cacheKey, { url: response.data.image_url, source: response.data.source });
          setImageUrl(response.data.image_url);
          setImageSource(response.data.source || 'google');
        }
      } catch {
        // Just use default image on error
      } finally {
        setIsLoading(false);
      }
    };

    const delay = Math.random() * 500;
    setTimeout(fetchImage, delay);
  }, [cleanName, enableAI]);

  // Handle broken images - try AI fallback on error
  const handleImgError = async () => {
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

        if (response.data?.image_url && response.data.source !== 'none') {
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
