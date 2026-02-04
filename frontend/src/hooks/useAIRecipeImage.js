/**
 * useAIRecipeImage Hook
 * React hook for loading recipe images with Google Images (fast) + AI fallback
 */

import { useState, useEffect, useCallback } from 'react';
import { getFastRecipeImage, generateRecipeImage, getRecipeImage } from '../services/aiImageService';

/**
 * Hook to get a recipe image - uses Google Images for speed, with AI fallback
 * @param {string} recipeName - Name of the recipe
 * @param {string} cuisine - Cuisine type
 * @param {string} fallbackUrl - Fallback image URL if all methods fail
 * @param {boolean} autoLoad - Whether to auto-load on mount (default: true for fast loading)
 * @param {boolean} preferAI - Whether to prefer AI generation over Google Images (default: false)
 */
export function useAIRecipeImage(recipeName, cuisine = '', fallbackUrl = '', autoLoad = true, preferAI = false) {
  const [imageUrl, setImageUrl] = useState(fallbackUrl);
  const [thumbnailUrl, setThumbnailUrl] = useState(fallbackUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState('fallback');
  const [error, setError] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  
  // Function to load image (fast method - Google Images with AI fallback)
  const loadFast = useCallback(async () => {
    if (!recipeName) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getFastRecipeImage(recipeName, cuisine, true);
      
      if (result.url) {
        setImageUrl(result.url);
        setThumbnailUrl(result.thumbnailUrl || result.url);
        setSource(result.source);
        setAlternatives(result.alternatives || []);
      } else {
        setImageUrl(fallbackUrl);
        setThumbnailUrl(fallbackUrl);
        setSource('fallback');
      }
    } catch (err) {
      console.error('Error in useAIRecipeImage:', err);
      setError(err.message);
      setImageUrl(fallbackUrl);
      setSource('error');
    } finally {
      setIsLoading(false);
    }
  }, [recipeName, cuisine, fallbackUrl]);
  
  // Function to force AI generation (slower but more accurate)
  const generateAI = useCallback(async () => {
    if (!recipeName) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // First try to get cached image
      let url = await getRecipeImage(recipeName, cuisine);
      
      if (!url) {
        // Generate new AI image
        url = await generateRecipeImage(recipeName, cuisine);
      }
      
      if (url) {
        setImageUrl(url);
        setThumbnailUrl(url);
        setSource('ai_generated');
        setAlternatives([]);
      } else {
        setImageUrl(fallbackUrl);
        setSource('fallback');
      }
    } catch (err) {
      console.error('Error generating AI image:', err);
      setError(err.message);
      setImageUrl(fallbackUrl);
      setSource('error');
    } finally {
      setIsLoading(false);
    }
  }, [recipeName, cuisine, fallbackUrl]);
  
  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && recipeName) {
      if (preferAI) {
        generateAI();
      } else {
        loadFast();
      }
    }
  }, [autoLoad, recipeName, preferAI, loadFast, generateAI]);
  
  return {
    imageUrl,
    thumbnailUrl,
    isLoading,
    source,  // 'google_images', 'ai_generated', 'cached', 'fallback', 'error'
    error,
    alternatives, // Alternative images from Google (can switch if user doesn't like current)
    loadFast, // Quick load using Google Images
    generateAI, // Force AI generation (slower)
    refresh: loadFast, // Alias for refreshing
    switchToAlternative: (index) => {
      if (alternatives[index]) {
        setImageUrl(alternatives[index].url);
        setThumbnailUrl(alternatives[index].thumbnail || alternatives[index].url);
      }
    }
  };
}

/**
 * Hook for batch loading AI images for multiple recipes
 * @param {Array<{name: string, cuisine?: string, imageUrl?: string}>} recipes
 */
export function useAIRecipeImages(recipes) {
  const [images, setImages] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  const loadImages = useCallback(async () => {
    if (!recipes || recipes.length === 0) return;
    
    setIsLoading(true);
    
    const newImages = {};
    
    for (const recipe of recipes) {
      const name = recipe.name || recipe.title;
      if (!name) continue;
      
      try {
        // Try to get cached/generated image
        const url = await getRecipeImage(name, recipe.cuisine || recipe.cuisineHint || '');
        
        if (url) {
          newImages[name] = url;
        } else {
          // Keep fallback
          newImages[name] = recipe.imageUrl || '';
        }
      } catch {
        newImages[name] = recipe.imageUrl || '';
      }
    }
    
    setImages(newImages);
    setIsLoading(false);
  }, [recipes]);
  
  return {
    images,
    isLoading,
    loadImages,
    getImage: (name) => images[name] || ''
  };
}

export default useAIRecipeImage;
