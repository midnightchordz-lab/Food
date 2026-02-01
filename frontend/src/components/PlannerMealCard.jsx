import { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// In-memory cache for AI-generated images
const aiImageCache = new Map();

// Generate AI image for a recipe
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
 * Meal Card Component with ON-DEMAND AI Image Generation
 * Used in Weekly Planners (regular and diabetes)
 * AI images are generated only when user clicks the button (not on mount)
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAIGenerated, setIsAIGenerated] = useState(false);

  // Clean up meal name (remove carbs info if present)
  const cleanName = mealName?.replace(/\s*\(\d+g?\s*carbs?\)/gi, '').trim() || '';

  // Check cache on mount only - NO auto-generation for performance
  useEffect(() => {
    if (!cleanName) return;
    
    const cacheKey = cleanName.toLowerCase();
    if (aiImageCache.has(cacheKey)) {
      setImageUrl(aiImageCache.get(cacheKey));
      setIsAIGenerated(true);
    }
  }, [cleanName]);

  // Manual AI image generation - triggered by user click
  const handleGenerateAI = useCallback(async (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (isGenerating || !cleanName) return;
    
    setIsGenerating(true);
    try {
      const aiUrl = await generateAIImage(cleanName);
      if (aiUrl) {
        const cacheKey = cleanName.toLowerCase();
        aiImageCache.set(cacheKey, aiUrl);
        setImageUrl(aiUrl);
        setIsAIGenerated(true);
      }
    } catch (err) {
      console.error('AI image generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [cleanName, isGenerating]);

  if (!mealName) {
    return (
      <div className={`bg-muted/30 rounded-xl flex items-center justify-center text-muted-foreground/50 ${compact ? 'h-16' : 'h-24'}`}>
        <span className="text-xs">No meal</span>
      </div>
    );
  }

  if (compact) {
    // Compact view - just text with small image indicator
    return (
      <div 
        onClick={onClick}
        className="bg-card rounded-xl p-2 border border-border/50 hover:border-primary/30 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 relative">
            <img 
              src={imageUrl} 
              alt={cleanName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {isGenerating && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <RefreshCw className="w-3 h-3 text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium line-clamp-1">{cleanName}</p>
            {carbs && (
              <span className="text-[10px] text-teal-600">{carbs}g carbs</span>
            )}
          </div>
          {isAIGenerated && (
            <Sparkles className="w-3 h-3 text-purple-500 flex-shrink-0" />
          )}
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
        
        {/* AI Badge */}
        {isAIGenerated && !isGenerating && (
          <div className="absolute top-1 left-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Sparkles className="w-2 h-2" />
            <span>AI</span>
          </div>
        )}
        
        {/* Loading Overlay */}
        {isGenerating && (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/70 to-blue-900/70 flex items-center justify-center">
            <div className="text-center text-white">
              <Sparkles className="w-4 h-4 animate-pulse mx-auto" />
              <p className="text-[10px] mt-1">Creating...</p>
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
