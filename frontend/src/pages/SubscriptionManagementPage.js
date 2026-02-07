/**
 * Subscription Management Page
 * View current plan, billing history, upgrade/downgrade, cancel subscription
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Crown, ChefHat, Users, Shield, Calendar, CreditCard,
  Check, X, ArrowRight, Loader2, AlertCircle, RefreshCw,
  Download, Clock, Sparkles, Settings, ChevronRight,
  Receipt, History, Ban, Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Plan display configuration
const PLAN_CONFIG = {
  'free': {
    name: 'Free Forever',
    icon: Shield,
    color: 'text-stone-600',
    bgColor: 'bg-stone-100',
    borderColor: 'border-stone-200'
  },
  'premium_monthly': {
    name: 'Premium Monthly',
    icon: Crown,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200'
  },
  'premium_annual': {
    name: 'Premium Annual',
    icon: Crown,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200'
  },
  'chef_pro_monthly': {
    name: 'Chef Pro Monthly',
    icon: ChefHat,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30'
  },
  'chef_pro_annual': {
    name: 'Chef Pro Annual',
    icon: ChefHat,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30'
  },
  'family_annual': {
    name: 'Family Plan',
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  }
};

const SubscriptionManagementPage = () => {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [usageStats, setUsageStats] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      toast.error('Please sign in to view your subscription');
      return;
    }
    loadSubscriptionData();
  }, [navigate]);

  const loadSubscriptionData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Load current subscription
      const subResponse = await axios.get(`${API}/subscription/current`, { headers });
      if (subResponse.data.success) {
        setSubscription(subResponse.data.subscription);
        setUsageStats(subResponse.data.subscription.usage);
      }

      // Load billing history
      const historyResponse = await axios.get(`${API}/subscription/billing-history`, { headers });
      if (historyResponse.data.success) {
        setBillingHistory(historyResponse.data.transactions);
      }

    } catch (error) {
      console.error('Error loading subscription data:', error);
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/subscription/cancel`,
        { cancel_at_period_end: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success('Subscription will be cancelled at the end of your billing period');
        setCancelDialogOpen(false);
        loadSubscriptionData();
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error(error.response?.data?.detail || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/subscription/reactivate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success('Subscription reactivated successfully!');
        loadSubscriptionData();
      }
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      toast.error(error.response?.data?.detail || 'Failed to reactivate subscription');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getDaysRemaining = (endDate) => {
    if (!endDate) return 0;
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-primary" size={40} />
          <p className="text-stone-600">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  const planConfig = PLAN_CONFIG[subscription?.plan_id] || PLAN_CONFIG['free'];
  const PlanIcon = planConfig.icon;
  const isFreePlan = subscription?.plan_id === 'free';
  const isCancelling = subscription?.cancel_at_period_end;

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white" data-testid="subscription-management-page">
      {/* Header */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-800">Subscription Management</h1>
              <p className="text-stone-500">Manage your plan, billing, and usage</p>
            </div>
            <Link to="/">
              <Button variant="outline" className="rounded-full">
                Back to App
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Current Plan Card */}
        <Card className={`${planConfig.borderColor} border-2`} data-testid="current-plan-card">
          <CardHeader className={`${planConfig.bgColor} rounded-t-lg`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-full bg-white shadow-sm`}>
                  <PlanIcon className={planConfig.color} size={28} />
                </div>
                <div>
                  <CardTitle className="text-xl">{planConfig.name}</CardTitle>
                  <CardDescription>
                    {isFreePlan ? 'Basic features included' : `Started ${formatDate(subscription?.current_period_start)}`}
                  </CardDescription>
                </div>
              </div>
              <div className="text-right">
                {subscription?.status === 'active' && (
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    Active
                  </Badge>
                )}
                {subscription?.status === 'trialing' && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                    Trial
                  </Badge>
                )}
                {isCancelling && (
                  <Badge className="bg-orange-100 text-orange-700 border-orange-200 ml-2">
                    Cancelling
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {!isFreePlan && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-stone-50 rounded-xl">
                  <div className="flex items-center gap-2 text-stone-500 text-sm mb-1">
                    <Calendar size={16} />
                    <span>Billing Period</span>
                  </div>
                  <p className="font-semibold text-stone-800">
                    {subscription?.billing_cycle === 'monthly' ? 'Monthly' : 'Annual'}
                  </p>
                </div>
                <div className="p-4 bg-stone-50 rounded-xl">
                  <div className="flex items-center gap-2 text-stone-500 text-sm mb-1">
                    <Clock size={16} />
                    <span>{isCancelling ? 'Access Until' : 'Next Billing'}</span>
                  </div>
                  <p className="font-semibold text-stone-800">
                    {formatDate(subscription?.current_period_end)}
                  </p>
                  <p className="text-xs text-stone-400">
                    {getDaysRemaining(subscription?.current_period_end)} days remaining
                  </p>
                </div>
                <div className="p-4 bg-stone-50 rounded-xl">
                  <div className="flex items-center gap-2 text-stone-500 text-sm mb-1">
                    <CreditCard size={16} />
                    <span>Payment Method</span>
                  </div>
                  <p className="font-semibold text-stone-800 capitalize">
                    {subscription?.payment_provider || 'Razorpay'}
                  </p>
                </div>
              </div>
            )}

            {/* Usage Stats */}
            {usageStats && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-stone-600 mb-3 flex items-center gap-2">
                  <Zap size={16} />
                  Today's Usage
                </h3>
                <div className="flex gap-4">
                  <div className="flex-1 p-3 bg-stone-50 rounded-lg">
                    <div className="text-xs text-stone-500">Recipe Searches</div>
                    <div className="text-lg font-bold text-stone-800">
                      {usageStats.searches_today || 0} 
                      {isFreePlan && <span className="text-sm font-normal text-stone-400">/ 5</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {isFreePlan ? (
                <Button 
                  onClick={() => navigate('/pricing')}
                  className="rounded-full bg-primary hover:bg-primary/90"
                  data-testid="upgrade-button"
                >
                  <Sparkles size={16} className="mr-2" />
                  Upgrade Now
                </Button>
              ) : (
                <>
                  <Button 
                    onClick={() => navigate('/pricing')}
                    variant="outline"
                    className="rounded-full"
                    data-testid="change-plan-button"
                  >
                    <RefreshCw size={16} className="mr-2" />
                    Change Plan
                  </Button>
                  
                  {isCancelling ? (
                    <Button 
                      onClick={handleReactivate}
                      className="rounded-full bg-green-600 hover:bg-green-700"
                      data-testid="reactivate-button"
                    >
                      <Check size={16} className="mr-2" />
                      Reactivate Subscription
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => setCancelDialogOpen(true)}
                      variant="outline"
                      className="rounded-full text-red-600 border-red-200 hover:bg-red-50"
                      data-testid="cancel-button"
                    >
                      <Ban size={16} className="mr-2" />
                      Cancel Subscription
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Features Included */}
        <Card data-testid="features-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check size={20} className="text-green-500" />
              Features Included
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {subscription?.features && Object.entries(subscription.features).map(([key, value]) => {
                if (typeof value === 'boolean' && value) {
                  return (
                    <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-green-50">
                      <Check size={16} className="text-green-600" />
                      <span className="text-stone-700 capitalize">
                        {key.replace(/_/g, ' ')}
                      </span>
                    </div>
                  );
                }
                if (typeof value === 'number' && value > 0) {
                  return (
                    <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-blue-50">
                      <span className="text-blue-600 font-semibold">{value === -1 ? '∞' : value}</span>
                      <span className="text-stone-700 capitalize">
                        {key.replace(/_/g, ' ')}
                      </span>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </CardContent>
        </Card>

        {/* Billing History */}
        <Card data-testid="billing-history-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History size={20} />
              Billing History
            </CardTitle>
            <CardDescription>
              Your recent payments and invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {billingHistory.length === 0 ? (
              <div className="text-center py-8 text-stone-400">
                <Receipt size={40} className="mx-auto mb-3 opacity-50" />
                <p>No billing history yet</p>
                {isFreePlan && (
                  <p className="text-sm mt-2">Upgrade to a paid plan to see billing history</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {billingHistory.map((transaction, index) => (
                  <div 
                    key={transaction.id || index}
                    className="flex items-center justify-between p-4 bg-stone-50 rounded-xl hover:bg-stone-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        transaction.status === 'completed' ? 'bg-green-100' : 
                        transaction.status === 'pending' ? 'bg-yellow-100' : 'bg-red-100'
                      }`}>
                        {transaction.status === 'completed' ? (
                          <Check size={16} className="text-green-600" />
                        ) : transaction.status === 'pending' ? (
                          <Clock size={16} className="text-yellow-600" />
                        ) : (
                          <X size={16} className="text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-stone-800">
                          {transaction.description || 'Subscription Payment'}
                        </p>
                        <p className="text-sm text-stone-500">
                          {formatDate(transaction.created_at || transaction.paid_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-stone-800">
                        {formatCurrency(transaction.amount, transaction.currency)}
                      </p>
                      <Badge variant="outline" className="text-xs capitalize">
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings size={20} />
              Quick Links
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Link to="/pricing" className="flex items-center justify-between p-4 bg-stone-50 rounded-xl hover:bg-stone-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Crown size={20} className="text-amber-500" />
                  <span className="font-medium">View All Plans</span>
                </div>
                <ChevronRight size={20} className="text-stone-400" />
              </Link>
              <Link to="/chat" className="flex items-center justify-between p-4 bg-stone-50 rounded-xl hover:bg-stone-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Sparkles size={20} className="text-primary" />
                  <span className="font-medium">Start Cooking</span>
                </div>
                <ChevronRight size={20} className="text-stone-400" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent data-testid="cancel-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle size={24} />
              Cancel Subscription?
            </DialogTitle>
            <DialogDescription className="pt-4">
              <div className="space-y-3">
                <p>Are you sure you want to cancel your {planConfig.name} subscription?</p>
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-amber-800 font-medium">You'll keep access until:</p>
                  <p className="text-amber-700 text-lg font-bold">
                    {formatDate(subscription?.current_period_end)}
                  </p>
                </div>
                <p className="text-stone-500 text-sm">
                  After this date, you'll be moved to the Free plan with limited features.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={() => setCancelDialogOpen(false)}
              className="rounded-full"
            >
              Keep My Plan
            </Button>
            <Button 
              onClick={handleCancelSubscription}
              disabled={cancelling}
              className="rounded-full bg-red-600 hover:bg-red-700"
              data-testid="confirm-cancel-button"
            >
              {cancelling ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <Ban size={16} className="mr-2" />
                  Yes, Cancel
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionManagementPage;
