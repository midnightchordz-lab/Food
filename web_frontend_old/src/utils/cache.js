/**
 * API Response Cache Utility
 * Caches API responses in memory and localStorage for faster subsequent loads
 */

const CACHE_PREFIX = 'moodfood_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default TTL

// In-memory cache for fastest access
const memoryCache = new Map();

/**
 * Get cached data
 * @param {string} key - Cache key
 * @returns {any|null} - Cached data or null if expired/missing
 */
export const getCached = (key) => {
  const cacheKey = CACHE_PREFIX + key;
  
  // Check memory cache first (fastest)
  if (memoryCache.has(cacheKey)) {
    const { data, expiry } = memoryCache.get(cacheKey);
    if (Date.now() < expiry) {
      return data;
    }
    memoryCache.delete(cacheKey);
  }
  
  // Check localStorage
  try {
    const stored = localStorage.getItem(cacheKey);
    if (stored) {
      const { data, expiry } = JSON.parse(stored);
      if (Date.now() < expiry) {
        // Restore to memory cache
        memoryCache.set(cacheKey, { data, expiry });
        return data;
      }
      localStorage.removeItem(cacheKey);
    }
  } catch (e) {
    // localStorage might be full or disabled
  }
  
  return null;
};

/**
 * Set cached data
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttl - Time to live in milliseconds
 */
export const setCached = (key, data, ttl = DEFAULT_TTL) => {
  const cacheKey = CACHE_PREFIX + key;
  const expiry = Date.now() + ttl;
  
  // Store in memory
  memoryCache.set(cacheKey, { data, expiry });
  
  // Store in localStorage for persistence
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ data, expiry }));
  } catch (e) {
    // localStorage might be full - clear old cache entries
    clearExpiredCache();
  }
};

/**
 * Clear specific cache entry
 */
export const clearCache = (key) => {
  const cacheKey = CACHE_PREFIX + key;
  memoryCache.delete(cacheKey);
  localStorage.removeItem(cacheKey);
};

/**
 * Clear all expired cache entries
 */
export const clearExpiredCache = () => {
  const now = Date.now();
  
  // Clear expired memory cache
  for (const [key, { expiry }] of memoryCache.entries()) {
    if (now >= expiry) {
      memoryCache.delete(key);
    }
  }
  
  // Clear expired localStorage cache
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      try {
        const { expiry } = JSON.parse(localStorage.getItem(key));
        if (now >= expiry) {
          keysToRemove.push(key);
        }
      } catch (e) {
        keysToRemove.push(key);
      }
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
};

/**
 * Clear all cache
 */
export const clearAllCache = () => {
  memoryCache.clear();
  
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
};

/**
 * Cached fetch wrapper
 * @param {string} url - API URL
 * @param {object} options - Fetch options
 * @param {string} cacheKey - Cache key (defaults to URL)
 * @param {number} ttl - Cache TTL
 */
export const cachedFetch = async (url, options = {}, cacheKey = null, ttl = DEFAULT_TTL) => {
  const key = cacheKey || url;
  
  // Check cache first
  const cached = getCached(key);
  if (cached) {
    return { data: cached, fromCache: true };
  }
  
  // Fetch fresh data
  const response = await fetch(url, options);
  const data = await response.json();
  
  // Cache successful responses
  if (response.ok) {
    setCached(key, data, ttl);
  }
  
  return { data, fromCache: false };
};

// Cache TTL constants for different data types
export const CACHE_TTL = {
  RECIPES: 10 * 60 * 1000,      // 10 minutes for recipes
  USER_DATA: 2 * 60 * 1000,     // 2 minutes for user data
  STATIC_DATA: 60 * 60 * 1000,  // 1 hour for static data
  IMAGES: 30 * 60 * 1000,       // 30 minutes for images
};

export default {
  getCached,
  setCached,
  clearCache,
  clearExpiredCache,
  clearAllCache,
  cachedFetch,
  CACHE_TTL,
};
