/**
 * Feature Gating Component and Utilities
 * Handles feature access checks and displays upgrade prompts for locked features
 * 
 * ARCHITECTURE:
 * - SubscriptionContext is the SINGLE SOURCE OF TRUTH for subscription state
 * - All feature checks go through useFeatureAccess hook
 * - When payment succeeds, call refreshSubscription() and dispatch 'subscription-updated' event
 * - All components listening will automatically re-check access
 */
import { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Lock, Crown, ChefHat, Sparkles, ArrowRight, X } from 'lucide-react';
import { Button } from './ui/button';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Custom event name for subscription updates - all components listen to this
const SUBSCRIPTION_UPDATED_EVENT = 'subscription-updated';

// Context for subscription state
const SubscriptionContext = createContext(null);

export const SubscriptionProvider = ({ children }) => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0); // Increment to force re-renders across app

  const loadSubscription = useCallback(async (forceRefresh = false) => {
    const token = localStorage.getItem('token');
    if (!token) {
      const freeSub = { plan_id: 'free', features: {}, status: 'active' };
      setSubscription(freeSub);
      setLoading(false);
      return freeSub;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${API}/subscription/current`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const sub = response.data.subscription;
        setSubscription(sub);
        console.log('[FeatureGate] Subscription loaded:', sub?.plan_id, 'features:', JSON.stringify(sub?.features));
        
        // If force refresh, increment version to notify all listeners
        if (forceRefresh) {
          setVersion(v => v + 1);
          // Dispatch custom event for any component that needs to know
          window.dispatchEvent(new CustomEvent(SUBSCRIPTION_UPDATED_EVENT, { detail: sub }));
        }
        return sub;
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      const freeSub = { plan_id: 'free', features: {}, status: 'active' };
      setSubscription(freeSub);
      return freeSub;
    } finally {
      setLoading(false);
    }
    return { plan_id: 'free', features: {}, status: 'active' };
  }, []);

  // Load on mount
  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  // Listen for token changes (login/logout) and subscription update events
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        loadSubscription(true);
      }
    };
    
    // Listen for manual refresh triggers from other parts of the app
    const handleSubscriptionRefresh = () => {
      loadSubscription(true);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('trigger-subscription-refresh', handleSubscriptionRefresh);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('trigger-subscription-refresh', handleSubscriptionRefresh);
    };
  }, [loadSubscription]);

  // Refresh function that returns a Promise and notifies all listeners
  const refreshSubscription = useCallback(async () => {
    console.log('[FeatureGate] Manual refresh triggered');
    return loadSubscription(true);
  }, [loadSubscription]);

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, refreshSubscription, version }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    return { subscription: null, loading: true, refreshSubscription: async () => {}, version: 0 };
  }
  return context;
};

// Feature names to display names mapping
const FEATURE_DISPLAY_NAMES = {
  'diabetes_module': 'Diabetes Meals Module',
  'recipe_import': 'Recipe Import',
  'video_import': 'Video Import',
  'ai_photo_recognition': 'AI Photo Recognition',
  'fridge_scanner': 'Fridge Scanner',
  'ai_image_generation': 'AI Image Generation',
  'voice_cooking': 'Voice-Guided Cooking',
  'export_pdf': 'PDF Export',
  'premium_recipes': 'Premium Recipes',
  'recipe_search': 'Recipe Searches',
  'meal_planner_extended': 'Extended Meal Planner',
  'advanced_filters': 'Advanced Filters',
};

// Plan display information
const PLAN_INFO = {
  'premium_monthly': {
    name: 'Premium',
    icon: Crown,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    price: '$9.99/mo'
  },
  'premium_annual': {
    name: 'Premium Annual',
    icon: Crown,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    price: '$79.99/yr'
  },
  'chef_pro_monthly': {
    name: 'Chef Pro',
    icon: ChefHat,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    price: '$19.99/mo'
  },
  'chef_pro_annual': {
    name: 'Chef Pro Annual',
    icon: ChefHat,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    price: '$179.99/yr'
  },
};

/**
 * Modal shown when a feature is locked
 */
export const FeatureLockedModal = ({ 
  isOpen, 
  onClose, 
  feature, 
  upgradeTo, 
  currentPlan,
  usedLimit,
  maxLimit 
}) => {
  const navigate = useNavigate();
  
  if (!isOpen) return null;

  const planInfo = PLAN_INFO[upgradeTo] || PLAN_INFO['premium_monthly'];
  const PlanIcon = planInfo.icon;
  const featureName = FEATURE_DISPLAY_NAMES[feature] || feature;
  const isLimitReached = feature === 'recipe_search' && usedLimit !== undefined;

  const handleUpgrade = () => {
    onClose();
    navigate('/pricing');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      data-testid="feature-locked-modal"
    >
      <div 
        className="bg-white rounded-2xl max-w-md w-full mx-4 overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${planInfo.bgColor} px-6 py-8 text-center relative`}>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-stone-400 hover:text-stone-600"
          >
            <X size={20} />
          </button>
          
          <div className={`inline-flex p-4 rounded-full ${planInfo.bgColor} mb-4`}>
            <Lock size={32} className={planInfo.color} />
          </div>
          
          <h2 className="text-xl font-bold text-stone-800">
            {isLimitReached ? 'Daily Limit Reached' : 'Feature Locked'}
          </h2>
          
          <p className="text-stone-600 mt-2">
            {isLimitReached 
              ? `You've used all ${maxLimit} recipes for today`
              : `${featureName} requires an upgraded plan`
            }
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-stone-50 mb-4">
            <PlanIcon size={24} className={planInfo.color} />
            <div>
              <p className="font-semibold text-stone-800">
                Upgrade to {planInfo.name}
              </p>
              <p className="text-sm text-stone-500">
                Starting at {planInfo.price}
              </p>
            </div>
          </div>

          <ul className="space-y-2 mb-6">
            <li className="flex items-center gap-2 text-sm text-stone-600">
              <Sparkles size={16} className="text-amber-500" />
              {isLimitReached ? 'Unlimited recipes daily' : `Unlock ${featureName}`}
            </li>
            <li className="flex items-center gap-2 text-sm text-stone-600">
              <Sparkles size={16} className="text-amber-500" />
              Access to 2,000+ premium recipes
            </li>
            <li className="flex items-center gap-2 text-sm text-stone-600">
              <Sparkles size={16} className="text-amber-500" />
              Ad-free experience
            </li>
          </ul>

          <Button 
            onClick={handleUpgrade}
            className="w-full rounded-full bg-primary hover:bg-primary/90"
            data-testid="upgrade-button"
          >
            View Plans
            <ArrowRight size={16} className="ml-2" />
          </Button>

          <p className="text-center text-xs text-stone-400 mt-4">
            7-day free trial available
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to check if a feature is accessible
 * Automatically re-checks when subscription updates via the version counter
 */
export const useFeatureAccess = (feature) => {
  const { subscription, loading, version } = useSubscription();
  const [allowed, setAllowed] = useState(true); // Optimistic default
  
  // Re-evaluate access whenever subscription or version changes
  useEffect(() => {
    if (loading || !subscription) {
      setAllowed(true); // Optimistic while loading
      return;
    }

    const features = subscription.features || {};
    
    // Log for debugging
    console.log(`[useFeatureAccess] Checking '${feature}' (version ${version}):`, {
      plan: subscription.plan_id,
      features: Object.keys(features).filter(k => features[k] === true || features[k] > 0)
    });
    
    // Check specific features based on plan features from backend
    let hasAccess = false;
    
    switch (feature) {
      case 'diabetes_module':
        hasAccess = features.diabetes_module === true;
        break;
      case 'recipe_import':
        hasAccess = features.recipe_import === true;
        break;
      case 'video_import':
        hasAccess = features.video_import === true;
        break;
      case 'ai_photo_recognition':
      case 'fridge_scanner':
        hasAccess = features.ai_photo_recognition_enabled === true;
        break;
      case 'ai_image_generation':
        hasAccess = features.ai_image_generation_enabled === true;
        break;
      case 'voice_cooking':
        hasAccess = features.voice_guided_cooking === true;
        break;
      case 'export_pdf':
        hasAccess = features.export_to_pdf === true;
        break;
      case 'premium_recipes':
        hasAccess = features.premium_recipes_access === true;
        break;
      case 'meal_planner_extended':
        hasAccess = (features.meal_planner_weeks || 1) > 1;
        break;
      case 'advanced_filters':
        hasAccess = features.advanced_filters === true;
        break;
      case 'priority_support':
        hasAccess = features.priority_support === true;
        break;
      case 'ad_free':
        hasAccess = features.ad_free === true;
        break;
      default:
        hasAccess = true; // Unknown features default to allowed
    }
    
    setAllowed(hasAccess);
  }, [subscription, loading, feature, version]);
  
  return { allowed, loading };
};

/**
 * Handle API errors that are feature-locked
 */
export const handleFeatureLockedError = (error, setModalState) => {
  console.log('handleFeatureLockedError called with:', error?.response?.status, error?.response?.data);
  
  // Check for 403 status
  if (error.response?.status === 403 || error.response?.status === 520) {
    const detail = error.response.data?.detail;
    console.log('Feature lock detail:', detail);
    
    // Check if it's a feature_locked error
    if (detail?.error === 'feature_locked' || (typeof detail === 'string' && detail.includes('feature_locked'))) {
      let errorData = detail;
      
      // Parse string format if needed
      if (typeof detail === 'string' && detail.includes('feature_locked')) {
        try {
          const jsonStr = detail.replace(/^403: /, '').replace(/'/g, '"');
          errorData = JSON.parse(jsonStr);
        } catch (e) {
          console.error('Error parsing feature locked response:', e);
        }
      }
      
      setModalState({
        isOpen: true,
        feature: errorData.feature || 'recipe_search',
        upgradeTo: errorData.upgrade_to || 'premium_monthly',
        currentPlan: errorData.current_plan || 'free',
        usedLimit: errorData.used,
        maxLimit: errorData.limit
      });
      
      return true; // Error was handled
    }
  }
  
  // Also check for the error in the response data itself (in case status is 200 but contains error)
  if (error.response?.data?.detail?.error === 'feature_locked') {
    const errorData = error.response.data.detail;
    setModalState({
      isOpen: true,
      feature: errorData.feature || 'recipe_search',
      upgradeTo: errorData.upgrade_to || 'premium_monthly',
      currentPlan: errorData.current_plan || 'free',
      usedLimit: errorData.used,
      maxLimit: errorData.limit
    });
    return true;
  }
  
  return false; // Error was not a feature lock
};

/**
 * Wrapper component that shows upgrade prompt for locked features
 */
export const FeatureGateWrapper = ({ feature, children, fallback }) => {
  const { allowed, loading } = useFeatureAccess(feature);
  const navigate = useNavigate();
  
  if (loading) {
    return children; // Show content while loading
  }
  
  if (!allowed) {
    if (fallback) {
      return fallback;
    }
    
    // Default fallback: show upgrade prompt
    const planInfo = PLAN_INFO['premium_monthly'];
    const featureName = FEATURE_DISPLAY_NAMES[feature] || feature;
    
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-stone-50 rounded-2xl">
        <Lock size={48} className="text-stone-400 mb-4" />
        <h3 className="text-lg font-semibold text-stone-800 mb-2">
          {featureName} is a Premium Feature
        </h3>
        <p className="text-stone-500 mb-4 max-w-md">
          Upgrade your plan to unlock this feature and more.
        </p>
        <Button 
          onClick={() => navigate('/pricing')}
          className="rounded-full"
        >
          View Plans
          <ArrowRight size={16} className="ml-2" />
        </Button>
      </div>
    );
  }
  
  return children;
};

export default FeatureLockedModal;
