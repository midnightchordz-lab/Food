/**
 * AIRecipeImage Component
 * Displays a recipe image with option to generate AI-accurate image
 */

import React, { useState, useCallback } from 'react';
import { Sparkles, RefreshCw, Image, AlertCircle } from 'lucide-react';
import { generateRecipeImage } from '../services/aiImageService';

const AIRecipeImage = ({ 
  recipeName, 
  cuisine = '', 
  fallbackUrl,
  className = '',
  showGenerateButton = true,
  onImageGenerated = null,
  alt = ''
}) => {
  const [imageUrl, setImageUrl] = useState(fallbackUrl);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false);
  
  const handleGenerateAI = useCallback(async (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (isGenerating) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const aiImageUrl = await generateRecipeImage(recipeName, cuisine);
      
      if (aiImageUrl) {
        setImageUrl(aiImageUrl);
        setIsAIGenerated(true);
        setImageError(false);
        
        if (onImageGenerated) {
          onImageGenerated(aiImageUrl);
        }
      } else {
        setError('Could not generate image');
      }
    } catch (err) {
      setError('Generation failed');
      console.error('AI image generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [recipeName, cuisine, isGenerating, onImageGenerated]);
  
  const handleImageError = () => {
    setImageError(true);
    // Fall back to a generic food image
    setImageUrl('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800');
  };
  
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Main Image */}
      {!imageError ? (
        <img
          src={imageUrl}
          alt={alt || recipeName}
          className="w-full h-full object-cover"
          onError={handleImageError}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
          <Image className="w-12 h-12 text-amber-400" />
        </div>
      )}
      
      {/* Loading Overlay */}
      {isGenerating && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="text-center text-white">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p className="text-sm font-medium">Generating AI Image...</p>
            <p className="text-xs text-white/70">This may take a moment</p>
          </div>
        </div>
      )}
      
      {/* AI Generated Badge */}
      {isAIGenerated && !isGenerating && (
        <div className="absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
          <Sparkles className="w-3 h-3" />
          <span>AI Generated</span>
        </div>
      )}
      
      {/* Generate Button */}
      {showGenerateButton && !isAIGenerated && !isGenerating && (
        <button
          onClick={handleGenerateAI}
          className="absolute bottom-2 right-2 bg-white/90 hover:bg-white text-gray-800 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg transition-all hover:scale-105"
          title="Generate accurate AI image for this recipe"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>Generate AI Image</span>
        </button>
      )}
      
      {/* Error Message */}
      {error && !isGenerating && (
        <div className="absolute bottom-2 left-2 bg-red-500/90 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default AIRecipeImage;
