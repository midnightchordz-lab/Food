/**
 * Usage Limit Service
 * Handles all API calls related to usage limits and tracking
 */
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

/**
 * Get current usage status for the authenticated user
 * Call this on app load and after any limit-consuming action
 * 
 * @returns {Promise<{
 *   tier: 'free' | 'premium' | 'chef_pro',
 *   recipes: {
 *     used_today: number,
 *     limit: number,
 *     remaining: number,
 *     reset_at: string
 *   },
 *   meal_plans: {
 *     used_this_week: number,
 *     limit: number,
 *     remaining: number,
 *     reset_at: string
 *   }
 * }>}
 */
export const getUsageStatus = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await axios.get(`${API}/usage/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.data.success) {
    return response.data.usage;
  }

  throw new Error('Failed to get usage status');
};

/**
 * Quick check if user can view more recipes
 * 
 * @returns {Promise<{
 *   allowed: boolean,
 *   used: number,
 *   limit: number,
 *   remaining: number
 * }>}
 */
export const checkRecipeLimit = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await axios.get(`${API}/usage/check/recipes`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.data.success) {
    return {
      allowed: response.data.allowed,
      used: response.data.used,
      limit: response.data.limit,
      remaining: response.data.remaining
    };
  }

  throw new Error('Failed to check recipe limit');
};

/**
 * Quick check if user can create more meal plans
 * 
 * @returns {Promise<{
 *   allowed: boolean,
 *   used: number,
 *   limit: number,
 *   remaining: number
 * }>}
 */
export const checkMealPlanLimit = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await axios.get(`${API}/usage/check/meal-plans`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.data.success) {
    return {
      allowed: response.data.allowed,
      used: response.data.used,
      limit: response.data.limit,
      remaining: response.data.remaining
    };
  }

  throw new Error('Failed to check meal plan limit');
};

/**
 * Format remaining time until reset
 * 
 * @param {string} resetAt - ISO timestamp
 * @returns {string} Human-readable time (e.g., "6 hours", "Tomorrow")
 */
export const formatTimeUntilReset = (resetAt) => {
  if (!resetAt) return '';
  
  const reset = new Date(resetAt);
  const now = new Date();
  const diffMs = reset - now;
  
  if (diffMs <= 0) return 'Now';
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return days === 1 ? 'Tomorrow' : `${days} days`;
  }
  
  if (hours > 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  
  return minutes <= 1 ? '1 minute' : `${minutes} minutes`;
};

export default {
  getUsageStatus,
  checkRecipeLimit,
  checkMealPlanLimit,
  formatTimeUntilReset
};
