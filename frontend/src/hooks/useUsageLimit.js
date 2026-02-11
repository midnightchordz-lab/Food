/**
 * useUsageLimit Hook
 * Provides usage limit state and actions for components
 */
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { getUsageStatus, checkRecipeLimit, checkMealPlanLimit } from '../services/usageLimitService';
import { useAuth } from '../context/AuthContext';

// Context for global usage state
const UsageLimitContext = createContext(null);

/**
 * Usage Limit Provider
 * Wraps the app to provide global usage state
 */
export const UsageLimitProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalData, setUpgradeModalData] = useState({
    feature: 'recipes',
    used: 0,
    limit: 5
  });

  /**
   * Fetch usage status from server
   */
  const refreshUsage = useCallback(async () => {
    if (!isAuthenticated) {
      setUsage(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const status = await getUsageStatus();
      setUsage(status);
      setError(null);
    } catch (err) {
      console.error('Error fetching usage:', err);
      setError(err.message);
      // Set default free tier limits on error
      setUsage({
        tier: 'free',
        recipes: { used_today: 0, limit: 5, remaining: 5, reset_at: null },
        meal_plans: { used_this_week: 0, limit: 3, remaining: 3, reset_at: null }
      });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Load usage on mount and when auth changes
  useEffect(() => {
    refreshUsage();
  }, [refreshUsage, user?.id]);

  /**
   * Check if user can generate recipes
   * Returns true if allowed, false if at limit
   */
  const canGenerateRecipes = useCallback(() => {
    if (!usage) return true; // Optimistic while loading
    if (usage.tier !== 'free') return true; // Paid users have unlimited
    return usage.recipes.remaining > 0;
  }, [usage]);

  /**
   * Check if user can create meal plans
   */
  const canCreateMealPlan = useCallback(() => {
    if (!usage) return true;
    if (usage.tier !== 'free') return true;
    return usage.meal_plans.remaining > 0;
  }, [usage]);

  /**
   * Show upgrade modal for recipe limit
   */
  const showRecipeLimitModal = useCallback(() => {
    if (usage) {
      setUpgradeModalData({
        feature: 'recipes',
        used: usage.recipes.used_today,
        limit: usage.recipes.limit,
        resetAt: usage.recipes.reset_at
      });
      setShowUpgradeModal(true);
    }
  }, [usage]);

  /**
   * Show upgrade modal for meal plan limit
   */
  const showMealPlanLimitModal = useCallback(() => {
    if (usage) {
      setUpgradeModalData({
        feature: 'meal_plans',
        used: usage.meal_plans.used_this_week,
        limit: usage.meal_plans.limit,
        resetAt: usage.meal_plans.reset_at
      });
      setShowUpgradeModal(true);
    }
  }, [usage]);

  /**
   * Handle API error that might be a limit error
   * Returns true if it was a limit error and modal was shown
   */
  const handleLimitError = useCallback((error) => {
    if (error.response?.status === 403) {
      const detail = error.response.data?.detail;
      if (detail?.error === 'feature_locked' || detail?.error === 'limit_exceeded') {
        // Refresh usage to get accurate counts
        refreshUsage();
        
        // Show appropriate modal
        const feature = detail.feature || 'recipe_search';
        if (feature === 'recipe_search' || feature === 'recipes') {
          setUpgradeModalData({
            feature: 'recipes',
            used: detail.used || usage?.recipes?.used_today || 5,
            limit: detail.limit || 5,
            resetAt: usage?.recipes?.reset_at
          });
        } else if (feature === 'meal_plan') {
          setUpgradeModalData({
            feature: 'meal_plans',
            used: detail.used || usage?.meal_plans?.used_this_week || 3,
            limit: detail.limit || 3,
            resetAt: usage?.meal_plans?.reset_at
          });
        }
        
        setShowUpgradeModal(true);
        return true;
      }
    }
    return false;
  }, [refreshUsage, usage]);

  /**
   * Close upgrade modal
   */
  const closeUpgradeModal = useCallback(() => {
    setShowUpgradeModal(false);
  }, []);

  const value = {
    usage,
    loading,
    error,
    refreshUsage,
    canGenerateRecipes,
    canCreateMealPlan,
    showUpgradeModal,
    upgradeModalData,
    showRecipeLimitModal,
    showMealPlanLimitModal,
    handleLimitError,
    closeUpgradeModal,
    isFreeTier: usage?.tier === 'free'
  };

  return (
    <UsageLimitContext.Provider value={value}>
      {children}
    </UsageLimitContext.Provider>
  );
};

/**
 * Hook to access usage limit state and actions
 */
export const useUsageLimit = () => {
  const context = useContext(UsageLimitContext);
  if (!context) {
    // Return default values if used outside provider
    return {
      usage: null,
      loading: true,
      error: null,
      refreshUsage: () => {},
      canGenerateRecipes: () => true,
      canCreateMealPlan: () => true,
      showUpgradeModal: false,
      upgradeModalData: {},
      showRecipeLimitModal: () => {},
      showMealPlanLimitModal: () => {},
      handleLimitError: () => false,
      closeUpgradeModal: () => {},
      isFreeTier: true
    };
  }
  return context;
};

export default useUsageLimit;
