/**
 * AI Recipe Image Service
 * Handles fetching recipe images - Google Images (fast) with AI fallback
 */

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Cache for storing images in memory
const imageCache = new Map();

/**
 * Get a recipe image quickly using Google Images (with AI fallback)
 * This is the preferred method - much faster than pure AI generation
 * @param {string} recipeName - Name of the recipe
 * @param {string} cuisine - Cuisine type (optional)
 * @param {boolean} useAIFallback - Fall back to AI if no images found (default: true)
 * @returns {Promise<{url: string, source: string, alternatives: Array}>}
 */
export async function getFastRecipeImage(recipeName, cuisine = '', useAIFallback = true) {
  const cacheKey = `fast-${recipeName.toLowerCase()}-${cuisine.toLowerCase()}`;
  
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }
  
  try {
    const response = await fetch(`${API_URL}/api/recipe-image/fast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipe_name: recipeName,
        cuisine: cuisine,
        use_ai_fallback: useAIFallback
      })
    });
    
    if (!response.ok) {
      throw new Error('Image fetch failed');
    }
    
    const data = await response.json();
    
    const result = {
      url: data.image_url,
      thumbnailUrl: data.thumbnail_url || data.image_url,
      source: data.source,
      sourceWebsite: data.source_website || '',
      alternatives: data.alternatives || []
    };
    
    if (result.url) {
      imageCache.set(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching fast recipe image:', error);
    return { url: null, source: 'error', alternatives: [] };
  }
}

/**
 * Generate an AI image for a recipe (slower but higher quality)
 * @param {string} recipeName - Name of the recipe
 * @param {string} cuisine - Cuisine type (optional)
 * @param {string[]} ingredients - List of ingredients (optional)
 * @returns {Promise<string>} - Image URL (data URL or fallback)
 */
export async function generateRecipeImage(recipeName, cuisine = '', ingredients = []) {
  // Check memory cache first
  const cacheKey = `${recipeName.toLowerCase()}-${cuisine.toLowerCase()}`;
  
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }
  
  try {
    const response = await fetch(`${API_URL}/api/recipe-image/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipe_name: recipeName,
        cuisine: cuisine,
        ingredients: ingredients
      })
    });
    
    if (!response.ok) {
      throw new Error('Image generation failed');
    }
    
    const data = await response.json();
    
    if (data.image_url) {
      // Cache the result
      imageCache.set(cacheKey, data.image_url);
      return data.image_url;
    }
    
    return null;
  } catch (error) {
    console.error('Error generating recipe image:', error);
    return null;
  }
}

/**
 * Get a cached image or generate a new one
 * @param {string} recipeName - Name of the recipe
 * @param {string} cuisine - Cuisine type (optional)
 * @returns {Promise<string>} - Image URL
 */
export async function getRecipeImage(recipeName, cuisine = '') {
  const cacheKey = `${recipeName.toLowerCase()}-${cuisine.toLowerCase()}`;
  
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }
  
  try {
    const encodedName = encodeURIComponent(recipeName);
    const response = await fetch(
      `${API_URL}/api/recipe-image/cached/${encodedName}?cuisine=${encodeURIComponent(cuisine)}`
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.image_url) {
        imageCache.set(cacheKey, data.image_url);
        return data.image_url;
      }
    }
  } catch (error) {
    console.error('Error fetching cached image:', error);
  }
  
  return null;
}

/**
 * Generate images for multiple recipes in batch
 * @param {Array<{name: string, cuisine?: string}>} recipes - Array of recipes
 * @returns {Promise<Map<string, string>>} - Map of recipe name to image URL
 */
export async function batchGenerateImages(recipes) {
  const results = new Map();
  
  // Filter out recipes we already have cached
  const uncachedRecipes = recipes.filter(r => {
    const cacheKey = `${r.name.toLowerCase()}-${(r.cuisine || '').toLowerCase()}`;
    if (imageCache.has(cacheKey)) {
      results.set(r.name, imageCache.get(cacheKey));
      return false;
    }
    return true;
  });
  
  if (uncachedRecipes.length === 0) {
    return results;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/recipe-image/generate-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipes: uncachedRecipes.map(r => ({
          recipe_name: r.name,
          cuisine: r.cuisine || '',
          ingredients: r.ingredients || []
        }))
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      for (const result of data.results) {
        if (result.image_url) {
          const cacheKey = `${result.recipe_name.toLowerCase()}-${(result.cuisine || '').toLowerCase()}`;
          imageCache.set(cacheKey, result.image_url);
          results.set(result.recipe_name, result.image_url);
        }
      }
    }
  } catch (error) {
    console.error('Error batch generating images:', error);
  }
  
  return results;
}

/**
 * Clear the image cache
 */
export function clearImageCache() {
  imageCache.clear();
}

/**
 * Check if AI image service is available
 * @returns {Promise<boolean>}
 */
export async function checkImageServiceStatus() {
  try {
    const response = await fetch(`${API_URL}/api/recipe-image/status`);
    if (response.ok) {
      const data = await response.json();
      return data.status === 'operational';
    }
    return false;
  } catch {
    return false;
  }
}

export default {
  generateRecipeImage,
  getRecipeImage,
  batchGenerateImages,
  clearImageCache,
  checkImageServiceStatus
};
