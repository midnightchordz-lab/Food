/**
 * useAIRecipeImage Hook
 * React hook for loading AI-generated recipe images with fallback
 */

import { useState, useEffect, useCallback } from 'react';
import { generateRecipeImage, getRecipeImage } from '../services/aiImageService';

/**
 * Hook to get an AI-generated image for a recipe
 * @param {string} recipeName - Name of the recipe
 * @param {string} cuisine - Cuisine type
 * @param {string} fallbackUrl - Fallback image URL if AI generation fails
 * @param {boolean} autoGenerate - Whether to auto-generate on mount (default: false)
 */
export function useAIRecipeImage(recipeName, cuisine = '', fallbackUrl = '', autoGenerate = false) {
  const [imageUrl, setImageUrl] = useState(fallbackUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  const [error, setError] = useState(null);
  
  // Function to generate the image
  const generate = useCallback(async () => {
    if (!recipeName) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // First try to get cached image
      let url = await getRecipeImage(recipeName, cuisine);
      
      if (!url) {
        // Generate new image
        url = await generateRecipeImage(recipeName, cuisine);
      }
      
      if (url) {
        setImageUrl(url);
        setIsAIGenerated(true);
      } else {
        // Fall back to static image
        setImageUrl(fallbackUrl);
        setIsAIGenerated(false);
      }
    } catch (err) {
      console.error('Error in useAIRecipeImage:', err);
      setError(err.message);
      setImageUrl(fallbackUrl);
      setIsAIGenerated(false);
    } finally {
      setIsLoading(false);
    }
  }, [recipeName, cuisine, fallbackUrl]);
  
  // Auto-generate on mount if enabled
  useEffect(() => {
    if (autoGenerate && recipeName) {
      generate();
    }
  }, [autoGenerate, recipeName, generate]);
  
  return {
    imageUrl,
    isLoading,
    isAIGenerated,
    error,
    generate, // Manual trigger function
    refresh: generate // Alias for regenerating
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
