/**
 * Checkout Success Page
 * Displayed after successful payment
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  CheckCircle2, Crown, ChefHat, Users, Sparkles, 
  ArrowRight, Loader2, Gift, Star, Calendar
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useUsageLimit } from '../hooks/useUsageLimit';
import confetti from 'canvas-confetti';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Plan display configuration
const PLAN_CONFIG = {
  'premium_monthly': {
    name: 'Premium Monthly',
    icon: Crown,
    color: 'text-amber-600',
    bgGradient: 'from-amber-50 to-amber-100'
  },
  'premium_annual': {
    name: 'Premium Annual',
    icon: Crown,
    color: 'text-amber-600',
    bgGradient: 'from-amber-50 to-amber-100'
  },
  'chef_pro_monthly': {
    name: 'Chef Pro Monthly',
    icon: ChefHat,
    color: 'text-primary',
    bgGradient: 'from-primary/10 to-primary/20'
  },
  'chef_pro_annual': {
    name: 'Chef Pro Annual',
    icon: ChefHat,
    color: 'text-primary',
    bgGradient: 'from-primary/10 to-primary/20'
  },
  'family_annual': {
    name: 'Family Plan',
    icon: Users,
    color: 'text-blue-600',
    bgGradient: 'from-blue-50 to-blue-100'
  }
};

const CheckoutSuccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [error, setError] = useState(null);
  
  // Get refreshUsage to update global usage state after payment
  const { refreshUsage } = useUsageLimit();

  const planId = searchParams.get('plan') || '';
  const orderId = searchParams.get('order_id') || '';

  useEffect(() => {
    // Trigger confetti on mount
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }, 300);

    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/');
        return;
      }

      const response = await axios.get(`${API}/subscription/current`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSubscription(response.data.subscription);
      }
    } catch (err) {
      console.error('Error loading subscription:', err);
      setError('Could not load subscription details');
    } finally {
      setLoading(false);
    }
  };

  const planConfig = PLAN_CONFIG[subscription?.plan_id || planId] || PLAN_CONFIG['premium_monthly'];
  const PlanIcon = planConfig?.icon || Crown;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-green-600" size={48} />
          <p className="text-stone-600">Activating your subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white" data-testid="checkout-success-page">
      <div className="max-w-lg mx-auto px-4 py-16">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-25"></div>
            <div className="relative bg-green-100 rounded-full p-6">
              <CheckCircle2 size={64} className="text-green-600" />
            </div>
          </div>
        </div>

        {/* Success Message */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-stone-800 mb-3">
            Welcome to {planConfig.name}!
          </h1>
          <p className="text-stone-600 text-lg">
            Your subscription is now active. Get ready to unlock premium features!
          </p>
        </div>

        {/* Plan Card */}
        <div className={`bg-gradient-to-br ${planConfig.bgGradient} rounded-2xl p-6 mb-8 border border-stone-200`}>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white rounded-full shadow-sm">
              <PlanIcon className={planConfig.color} size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-800">{planConfig.name}</h2>
              <p className="text-stone-500">Subscription Active</p>
            </div>
          </div>

          {subscription && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white/60 rounded-xl p-3">
                <div className="text-xs text-stone-500 mb-1">Started</div>
                <div className="font-semibold text-stone-800">
                  {new Date(subscription.current_period_start).toLocaleDateString()}
                </div>
              </div>
              <div className="bg-white/60 rounded-xl p-3">
                <div className="text-xs text-stone-500 mb-1">Next Billing</div>
                <div className="font-semibold text-stone-800">
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Features Unlocked */}
        <div className="bg-white rounded-2xl p-6 mb-8 border border-stone-200">
          <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
            <Gift size={20} className="text-primary" />
            Features Unlocked
          </h3>
          <div className="space-y-3">
            {[
              'Unlimited recipe searches',
              'Access to 2,000+ premium recipes',
              'Ad-free experience',
              'AI photo recognition',
              'Extended meal planner',
              'PDF export',
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="p-1 bg-green-100 rounded-full">
                  <CheckCircle2 size={16} className="text-green-600" />
                </div>
                <span className="text-stone-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={() => navigate('/chat')}
            className="w-full rounded-full bg-primary hover:bg-primary/90 h-12 text-lg"
            data-testid="start-cooking-button"
          >
            <Sparkles size={20} className="mr-2" />
            Start Cooking
            <ArrowRight size={20} className="ml-2" />
          </Button>
          
          <Button 
            onClick={() => navigate('/subscription')}
            variant="outline"
            className="w-full rounded-full h-12"
            data-testid="view-subscription-button"
          >
            <Calendar size={20} className="mr-2" />
            View Subscription Details
          </Button>
        </div>

        {/* Receipt Info */}
        <p className="text-center text-sm text-stone-400 mt-8">
          A receipt has been sent to your email address.
          <br />
          Order ID: {orderId || subscription?.id || 'N/A'}
        </p>
      </div>
    </div>
  );
};

export default CheckoutSuccessPage;
