/**
 * Feature Gating Component and Utilities
 * Handles feature access checks and displays upgrade prompts for locked features
 */
import { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Lock, Crown, ChefHat, Sparkles, ArrowRight, X } from 'lucide-react';
import { Button } from './ui/button';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Context for subscription state
const SubscriptionContext = createContext(null);

export const SubscriptionProvider = ({ children }) => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSubscription = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setSubscription({ plan_id: 'free', features: {} });
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/subscription/current`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setSubscription(response.data.subscription);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      setSubscription({ plan_id: 'free', features: {} });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscription();
  }, []);

  const refreshSubscription = () => {
    loadSubscription();
  };

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, refreshSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    return { subscription: null, loading: true, refreshSubscription: () => {} };
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
              ? `You've used all ${maxLimit} recipe searches for today`
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
              {isLimitReached ? 'Unlimited recipe searches' : `Unlock ${featureName}`}
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
 */
export const useFeatureAccess = (feature) => {
  const { subscription, loading } = useSubscription();
  
  if (loading || !subscription) {
    return { allowed: true, loading: true }; // Optimistic loading
  }

  const features = subscription.features || {};
  
  // Check specific features
  switch (feature) {
    case 'diabetes_module':
      return { allowed: features.diabetes_module === true, loading: false };
    case 'recipe_import':
      return { allowed: features.recipe_import === true, loading: false };
    case 'video_import':
      return { allowed: features.video_import === true, loading: false };
    case 'ai_photo_recognition':
    case 'fridge_scanner':
      return { allowed: features.ai_photo_recognition_enabled === true, loading: false };
    case 'voice_cooking':
      return { allowed: features.voice_guided_cooking === true, loading: false };
    case 'export_pdf':
      return { allowed: features.export_to_pdf === true, loading: false };
    case 'premium_recipes':
      return { allowed: features.premium_recipes_access === true, loading: false };
    default:
      return { allowed: true, loading: false };
  }
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
