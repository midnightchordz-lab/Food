/**
 * Authentication and Premium Status Utilities
 * 
 * This file provides a unified helper function to check premium status.
 * All premium access checks throughout the frontend should use this helper
 * to ensure consistent behavior across web and mobile (Capacitor) platforms.
 */

/**
 * Checks if a user has premium (non-free) subscription status.
 * 
 * This function consolidates all premium access checks to a single source of truth.
 * It supports multiple data structures that may contain subscription information:
 * - user.subscriptionTier !== 'free'
 * - user.plan_id !== 'free'
 * - user.subscription?.plan_id !== 'free'
 * - user.plan !== 'free'
 * 
 * @param {Object} user - The user object from AuthContext or subscription data
 * @returns {boolean} - True if user has premium access, false otherwise
 * 
 * @example
 * // In a component:
 * import { isUserPremium } from '../utils/auth';
 * const { user } = useAuth();
 * 
 * if (isUserPremium(user)) {
 *   // Show premium feature
 * }
 */
export const isUserPremium = (user) => {
  if (!user) return false;
  
  // Check subscriptionTier (primary field from AuthContext)
  if (user.subscriptionTier && user.subscriptionTier !== 'free') {
    return true;
  }
  
  // Check plan_id (from subscription object)
  if (user.plan_id && user.plan_id !== 'free') {
    return true;
  }
  
  // Check nested subscription object
  if (user.subscription?.plan_id && user.subscription.plan_id !== 'free') {
    return true;
  }
  
  // Check plan field (alternative naming)
  if (user.plan && user.plan !== 'free') {
    return true;
  }
  
  // Check for active premium status
  if (user.subscription?.status === 'active' && user.subscription?.plan_id !== 'free') {
    return true;
  }
  
  return false;
};

/**
 * Gets the user's current plan ID
 * 
 * @param {Object} user - The user object
 * @returns {string} - The plan ID or 'free' as default
 */
export const getUserPlanId = (user) => {
  if (!user) return 'free';
  
  return user.plan_id || 
         user.subscriptionTier || 
         user.subscription?.plan_id || 
         user.plan || 
         'free';
};

export default isUserPremium;
