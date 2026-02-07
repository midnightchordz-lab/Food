import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Check, X, Sparkles, Crown, Star, Zap, Users, Shield,
  ChefHat, Utensils, Camera, Clock, Heart, Download,
  Mic, Calendar, Lock, ArrowRight, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Feature icons mapping
const FEATURE_ICONS = {
  recipe_search: Utensils,
  premium_recipes: Star,
  ad_free: Shield,
  ai_photo: Camera,
  ai_image: Sparkles,
  diabetes: Heart,
  meal_planner: Calendar,
  export_pdf: Download,
  voice_cooking: Mic,
  family: Users,
  priority_support: Zap,
  recipe_import: ArrowRight,
};

const PricingPage = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [billingCycle, setBillingCycle] = useState('annual');
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    loadPlans();
    checkAuth();
  }, []);

  const checkAuth = () => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
    if (token) {
      loadCurrentSubscription();
    }
  };

  const loadPlans = async () => {
    try {
      const response = await axios.get(`${API}/subscription/plans`);
      if (response.data.success) {
        setPlans(response.data.plans);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
      toast.error('Failed to load pricing plans');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentSubscription = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/subscription/current`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setCurrentPlan(response.data.subscription.plan_id);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const handleSelectPlan = async (plan) => {
    if (!isAuthenticated) {
      toast.info('Please sign in to subscribe');
      navigate('/');
      return;
    }

    if (plan.plan_id === 'free') {
      toast.info("You're already on the Free plan!");
      return;
    }

    if (plan.plan_id === currentPlan) {
      toast.info("You're already subscribed to this plan!");
      return;
    }

    setSubscribing(plan.plan_id);

    try {
      const token = localStorage.getItem('token');
      
      // Create Razorpay order
      const orderResponse = await axios.post(
        `${API}/subscription/razorpay/create-order`,
        { plan_id: plan.plan_id, currency: 'INR' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!orderResponse.data.success) {
        throw new Error('Failed to create order');
      }

      const { order, user } = orderResponse.data;

      // Load Razorpay script if not already loaded
      if (!window.Razorpay) {
        await loadRazorpayScript();
      }

      // Open Razorpay checkout
      const options = {
        key: order.key_id,
        amount: order.amount_in_paise,
        currency: order.currency,
        name: 'MoodFood',
        description: `${plan.display_name} Subscription`,
        order_id: order.id,
        prefill: {
          name: user.name || '',
          email: user.email || '',
        },
        theme: {
          color: '#6b7c5e'
        },
        handler: async function (response) {
          // Verify payment on backend
          try {
            const verifyResponse = await axios.post(
              `${API}/subscription/razorpay/verify-payment`,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_id: plan.plan_id
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (verifyResponse.data.success) {
              toast.success(verifyResponse.data.message);
              setCurrentPlan(plan.plan_id);
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            }
          } catch (verifyError) {
            console.error('Payment verification failed:', verifyError);
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        modal: {
          ondismiss: function() {
            setSubscribing(null);
            toast.info('Payment cancelled');
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
      
    } catch (error) {
      console.error('Error initiating payment:', error);
      toast.error(error.response?.data?.detail || 'Failed to initiate payment');
      setSubscribing(null);
    }
  };

  // Load Razorpay script dynamically
  const loadRazorpayScript = () => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

      if (response.data.success) {
        toast.success(response.data.message);
        setCurrentPlan(plan.plan_id);
        
        // Refresh the page after short delay
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      toast.error(error.response?.data?.detail || 'Failed to process subscription');
    } finally {
      setSubscribing(null);
    }
  };

  const filteredPlans = plans.filter(plan => 
    plan.billing_cycle === billingCycle || plan.plan_id === 'free'
  );

  // Group plans for display
  const displayPlans = billingCycle === 'monthly' 
    ? filteredPlans.filter(p => ['free', 'premium_monthly', 'chef_pro_monthly'].includes(p.plan_id))
    : filteredPlans.filter(p => ['free', 'premium_annual', 'chef_pro_annual', 'family_annual'].includes(p.plan_id));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-stone-50 to-white">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin text-primary" size={32} />
          <span className="text-lg text-muted-foreground">Loading plans...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50">
      {/* Header */}
      <div className="pt-12 pb-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            <Sparkles size={14} className="mr-1" />
            Choose Your Plan
          </Badge>
          
          <h1 className="text-4xl sm:text-5xl font-bold text-stone-800 mb-4">
            Unlock Your
            <span className="text-primary"> Culinary Potential</span>
          </h1>
          
          <p className="text-lg text-stone-600 max-w-2xl mx-auto mb-8">
            From mood-based recipes to AI-powered meal planning. 
            Choose the plan that fits your cooking journey.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-stone-100 rounded-full p-1.5 gap-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              data-testid="billing-monthly-btn"
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billingCycle === 'annual'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              data-testid="billing-annual-btn"
            >
              Annual
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                Save 33%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayPlans.map((plan) => (
            <PricingCard
              key={plan.plan_id}
              plan={plan}
              isCurrentPlan={currentPlan === plan.plan_id}
              isPopular={plan.badge === 'popular'}
              isBestValue={plan.badge === 'best_value'}
              onSelect={() => handleSelectPlan(plan)}
              subscribing={subscribing === plan.plan_id}
              billingCycle={billingCycle}
            />
          ))}
        </div>
      </div>

      {/* Feature Comparison */}
      <FeatureComparison plans={plans} currentPlan={currentPlan} />

      {/* FAQ Section */}
      <FAQSection />

      {/* CTA Section */}
      <div className="bg-primary/5 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-stone-800 mb-4">
            Still have questions?
          </h2>
          <p className="text-stone-600 mb-6">
            Our team is here to help you find the perfect plan for your needs.
          </p>
          <Button 
            variant="outline" 
            className="rounded-full"
            onClick={() => toast.info('Contact support@moodfood.app')}
          >
            Contact Support
          </Button>
        </div>
      </div>
    </div>
  );
};

// Pricing Card Component
const PricingCard = ({ plan, isCurrentPlan, isPopular, isBestValue, onSelect, subscribing, billingCycle }) => {
  const features = plan.features || {};
  const isFree = plan.plan_id === 'free';

  const getFeatureList = () => {
    const list = [];
    
    if (features.recipe_search_limit === -1) {
      list.push({ text: 'Unlimited recipe searches', included: true });
    } else {
      list.push({ text: `${features.recipe_search_limit} searches/day`, included: true });
    }

    if (features.premium_recipes_access) {
      list.push({ text: '2,000+ premium recipes', included: true });
    } else {
      list.push({ text: '50+ basic recipes', included: true });
    }

    list.push({ text: 'Ad-free experience', included: features.ad_free });

    if (features.ai_photo_recognition_enabled) {
      const limit = features.ai_photo_recognition_limit;
      list.push({ 
        text: limit === -1 ? 'Unlimited AI photo scans' : `${limit} AI photo scans/month`, 
        included: true 
      });
    } else {
      list.push({ text: 'AI photo recognition', included: false });
    }

    list.push({ text: 'Diabetes meals module', included: features.diabetes_module });

    if (features.meal_planner_weeks > 1) {
      list.push({ text: `${features.meal_planner_weeks}-week meal planner`, included: true });
    } else {
      list.push({ text: 'Basic meal planner', included: true });
    }

    list.push({ text: 'Export recipes to PDF', included: features.export_to_pdf });
    list.push({ text: 'Voice-guided cooking', included: features.voice_guided_cooking });

    if (features.family_members > 1) {
      list.push({ text: `Up to ${features.family_members} family members`, included: true });
    }

    list.push({ text: 'Priority support', included: features.priority_support });

    return list;
  };

  const featureList = getFeatureList();

  return (
    <div 
      className={`relative rounded-2xl p-6 transition-all duration-300 ${
        isPopular 
          ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-105 z-10' 
          : isBestValue
            ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200'
            : 'bg-white border border-stone-200 hover:border-primary/30 hover:shadow-lg'
      }`}
      data-testid={`pricing-card-${plan.plan_id}`}
    >
      {/* Badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-white text-primary text-xs font-bold px-3 py-1 rounded-full shadow-md">
            MOST POPULAR
          </span>
        </div>
      )}
      {isBestValue && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
            BEST VALUE
          </span>
        </div>
      )}
      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
            CURRENT
          </span>
        </div>
      )}

      {/* Plan Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          {isFree ? (
            <Utensils size={20} className={isPopular ? 'text-white' : 'text-primary'} />
          ) : plan.plan_id.includes('chef') ? (
            <ChefHat size={20} className={isPopular ? 'text-white' : 'text-primary'} />
          ) : plan.plan_id.includes('family') ? (
            <Users size={20} className={isPopular ? 'text-white' : 'text-primary'} />
          ) : (
            <Crown size={20} className={isPopular ? 'text-white' : 'text-primary'} />
          )}
          <h3 className={`text-xl font-bold ${isPopular ? 'text-white' : 'text-stone-800'}`}>
            {plan.display_name}
          </h3>
        </div>
        <p className={`text-sm ${isPopular ? 'text-white/80' : 'text-stone-500'}`}>
          {plan.description}
        </p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className={`text-4xl font-bold ${isPopular ? 'text-white' : 'text-stone-800'}`}>
            ${plan.pricing_usd}
          </span>
          {!isFree && (
            <span className={`text-sm ${isPopular ? 'text-white/70' : 'text-stone-500'}`}>
              /{plan.billing_cycle === 'annual' ? 'year' : 'month'}
            </span>
          )}
        </div>
        {plan.billing_cycle === 'annual' && !isFree && (
          <p className={`text-sm mt-1 ${isPopular ? 'text-white/70' : 'text-stone-500'}`}>
            ${(plan.pricing_usd / 12).toFixed(2)}/month billed annually
          </p>
        )}
        {plan.savings_percent && (
          <Badge className="mt-2 bg-green-100 text-green-700 border-green-200">
            Save {plan.savings_percent}%
          </Badge>
        )}
      </div>

      {/* Features List */}
      <ul className="space-y-3 mb-6">
        {featureList.slice(0, 8).map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            {feature.included ? (
              <Check size={18} className={`mt-0.5 flex-shrink-0 ${isPopular ? 'text-white' : 'text-green-500'}`} />
            ) : (
              <X size={18} className={`mt-0.5 flex-shrink-0 ${isPopular ? 'text-white/40' : 'text-stone-300'}`} />
            )}
            <span className={`text-sm ${
              feature.included 
                ? isPopular ? 'text-white' : 'text-stone-700'
                : isPopular ? 'text-white/40' : 'text-stone-400'
            }`}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <Button
        onClick={onSelect}
        disabled={isCurrentPlan || subscribing}
        className={`w-full rounded-full font-semibold ${
          isPopular
            ? 'bg-white text-primary hover:bg-white/90'
            : isCurrentPlan
              ? 'bg-stone-100 text-stone-400'
              : 'bg-primary text-white hover:bg-primary/90'
        }`}
        data-testid={`select-plan-${plan.plan_id}`}
      >
        {subscribing ? (
          <>
            <Loader2 size={16} className="mr-2 animate-spin" />
            Processing...
          </>
        ) : isCurrentPlan ? (
          'Current Plan'
        ) : isFree ? (
          'Get Started Free'
        ) : (
          <>
            {plan.trial_period_days > 0 ? `Start ${plan.trial_period_days}-Day Trial` : 'Subscribe Now'}
            <ArrowRight size={16} className="ml-2" />
          </>
        )}
      </Button>

      {plan.trial_period_days > 0 && !isCurrentPlan && (
        <p className={`text-xs text-center mt-3 ${isPopular ? 'text-white/60' : 'text-stone-400'}`}>
          No credit card required for trial
        </p>
      )}
    </div>
  );
};

// Feature Comparison Table
const FeatureComparison = ({ plans, currentPlan }) => {
  const allFeatures = [
    { key: 'recipe_search_limit', label: 'Daily Recipe Searches', format: (v) => v === -1 ? 'Unlimited' : v },
    { key: 'premium_recipes_access', label: 'Premium Recipes (2,000+)', format: (v) => v },
    { key: 'ad_free', label: 'Ad-Free Experience', format: (v) => v },
    { key: 'ai_photo_recognition_enabled', label: 'AI Photo Recognition', format: (v) => v },
    { key: 'ai_image_generation_enabled', label: 'AI Image Generation', format: (v) => v },
    { key: 'diabetes_module', label: 'Diabetes Meals Module', format: (v) => v },
    { key: 'meal_planner_weeks', label: 'Meal Planner (weeks)', format: (v) => v },
    { key: 'export_to_pdf', label: 'Export to PDF', format: (v) => v },
    { key: 'voice_guided_cooking', label: 'Voice-Guided Cooking', format: (v) => v },
    { key: 'recipe_import', label: 'Import Recipes from URL', format: (v) => v },
    { key: 'family_members', label: 'Family Members', format: (v) => v === 1 ? '1' : `Up to ${v}` },
    { key: 'priority_support', label: 'Priority Support', format: (v) => v },
  ];

  const displayPlans = plans.filter(p => 
    ['free', 'premium_annual', 'chef_pro_annual', 'family_annual'].includes(p.plan_id)
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <h2 className="text-3xl font-bold text-center text-stone-800 mb-8">
        Compare All Features
      </h2>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" data-testid="feature-comparison-table">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left py-4 px-4 text-stone-600 font-medium">Feature</th>
              {displayPlans.map(plan => (
                <th key={plan.plan_id} className="text-center py-4 px-4">
                  <div className="flex flex-col items-center">
                    <span className={`font-bold ${currentPlan === plan.plan_id ? 'text-primary' : 'text-stone-800'}`}>
                      {plan.display_name}
                    </span>
                    <span className="text-sm text-stone-500">
                      ${plan.pricing_usd}{plan.billing_cycle !== 'free' && `/${plan.billing_cycle === 'annual' ? 'yr' : 'mo'}`}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allFeatures.map((feature, idx) => (
              <tr key={feature.key} className={idx % 2 === 0 ? 'bg-stone-50' : 'bg-white'}>
                <td className="py-3 px-4 text-stone-700">{feature.label}</td>
                {displayPlans.map(plan => {
                  const value = plan.features?.[feature.key];
                  const formatted = feature.format(value);
                  
                  return (
                    <td key={plan.plan_id} className="text-center py-3 px-4">
                      {typeof formatted === 'boolean' ? (
                        formatted ? (
                          <Check size={20} className="mx-auto text-green-500" />
                        ) : (
                          <X size={20} className="mx-auto text-stone-300" />
                        )
                      ) : (
                        <span className="text-stone-700 font-medium">{formatted}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// FAQ Section
const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes, you can cancel your subscription at any time. Your access will continue until the end of your current billing period."
    },
    {
      question: "Is there a free trial?",
      answer: "Yes! Premium and Chef Pro plans come with a 7-14 day free trial. No credit card required to start your trial."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards (Visa, Mastercard, American Express) and digital wallets. For users in India, we also support UPI and net banking through Razorpay."
    },
    {
      question: "Can I switch plans later?",
      answer: "Absolutely! You can upgrade or downgrade your plan at any time. When upgrading, you'll get immediate access to new features. When downgrading, the change takes effect at the end of your billing period."
    },
    {
      question: "What's included in the Family Plan?",
      answer: "The Family Plan includes all Premium Annual features for up to 5 family members. Each member gets their own profile with individual dietary preferences, allergies, and saved recipes."
    },
    {
      question: "Do you offer refunds?",
      answer: "We offer a 30-day money-back guarantee for all paid plans. If you're not satisfied, contact our support team for a full refund."
    }
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h2 className="text-3xl font-bold text-center text-stone-800 mb-8">
        Frequently Asked Questions
      </h2>
      
      <div className="space-y-4" data-testid="faq-section">
        {faqs.map((faq, idx) => (
          <div 
            key={idx}
            className="border border-stone-200 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="w-full px-6 py-4 flex items-center justify-between text-left bg-white hover:bg-stone-50 transition-colors"
            >
              <span className="font-medium text-stone-800">{faq.question}</span>
              <span className={`transform transition-transform ${openIndex === idx ? 'rotate-180' : ''}`}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </button>
            {openIndex === idx && (
              <div className="px-6 py-4 bg-stone-50 border-t border-stone-200">
                <p className="text-stone-600">{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PricingPage;
