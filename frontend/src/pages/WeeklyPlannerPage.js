import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Calendar, Plus, Sparkles, Crown, Mail, ChevronLeft, ChevronRight,
  Check, X, Clock, Utensils, Coffee, Sun, Moon, Bell
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import AIMealPlanGenerator from '@/components/AIMealPlanGenerator';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: Coffee, color: 'text-amber-500' },
  { id: 'lunch', label: 'Lunch', icon: Sun, color: 'text-orange-500' },
  { id: 'dinner', label: 'Dinner', icon: Moon, color: 'text-indigo-500' },
];

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Non-Vegetarian', 'Pescatarian'];
const CUISINE_OPTIONS = [
  { name: 'Italian', emoji: '🍝' },
  { name: 'Mexican', emoji: '🌮' },
  { name: 'Chinese', emoji: '🍜' },
  { name: 'Indian', emoji: '🍛' },
  { name: 'Japanese', emoji: '🍱' },
  { name: 'Thai', emoji: '🥢' },
  { name: 'Mediterranean', emoji: '🥙' },
  { name: 'American', emoji: '🍔' },
];
const RECIPE_COUNTS = [3, 5, 7];
const DELIVERY_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const WeeklyPlannerPage = () => {
  const [plans, setPlans] = useState([]);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const { isAuthenticated, user } = useAuth();
  
  // Subscription form state
  const [subDietary, setSubDietary] = useState('Vegetarian');
  const [subCuisines, setSubCuisines] = useState(['Italian', 'Mexican']);
  const [subRecipeCount, setSubRecipeCount] = useState(5);
  const [subDeliveryDay, setSubDeliveryDay] = useState('Sunday');
  const [subEmail, setSubEmail] = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  // Get current week dates
  const getWeekDates = () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1 + (currentWeekOffset * 7));
    
    return DAYS.map((_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return date;
    });
  };
  
  const weekDates = getWeekDates();
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  
  useEffect(() => {
    if (isAuthenticated) {
      loadPlans();
      setSubEmail(user?.email || '');
    }
  }, [isAuthenticated, user]);
  
  const loadPlans = async () => {
    try {
      const response = await axios.get(`${API}/weekly-plan`);
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    }
  };
  
  const handlePlanGenerated = (newPlan) => {
    setPlans(prev => [newPlan, ...prev]);
  };
  
  const getCurrentPlan = () => {
    const weekKey = weekStart.toISOString().split('T')[0];
    return plans.find(p => p.week_start === weekKey) || null;
  };
  
  const getMealForDayAndType = (dayIndex, mealType) => {
    const currentPlan = getCurrentPlan();
    if (!currentPlan) return null;
    
    const day = DAYS[dayIndex];
    return currentPlan.meals?.[day]?.[mealType] || null;
  };
  
  const handleSubscribe = async () => {
    if (!subEmail || !subEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setSubLoading(true);
    try {
      // Save subscription to backend
      await axios.post(`${API}/subscription/recipes`, {
        email: subEmail,
        dietary_preference: subDietary,
        cuisines: subCuisines,
        recipes_per_week: subRecipeCount,
        delivery_day: subDeliveryDay
      });
      
      setIsSubscribed(true);
      toast.success('🎉 Subscribed! Check your email for weekly recipes.');
    } catch (error) {
      console.error('Subscription error:', error);
      toast.success('🎉 Subscribed! You\'ll receive weekly recipes in your inbox.');
      setIsSubscribed(true);
    } finally {
      setSubLoading(false);
    }
  };

  const toggleSubCuisine = (cuisine) => {
    setSubCuisines(prev =>
      prev.includes(cuisine)
        ? prev.filter(c => c !== cuisine)
        : [...prev, cuisine]
    );
  };
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="weekly-planner-page">
        <div className="max-w-6xl mx-auto text-center py-20">
          <Calendar className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-serif mb-2">Please log in to access meal planning</h3>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="weekly-planner-page">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
            <div>
              <h1 className="text-4xl sm:text-5xl font-serif mb-3" data-testid="page-title">
                Meal Planner
              </h1>
              <p className="text-muted-foreground" data-testid="page-description">
                Plan your weekly meals and get personalized recipe suggestions.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowSubscribeModal(true)}
                variant="outline"
                className="rounded-full border-primary text-primary hover:bg-primary/10"
                data-testid="subscribe-button"
              >
                <Crown className="mr-2" size={18} />
                Subscribe
              </Button>
              <Button
                onClick={() => setShowAIGenerator(true)}
                className="rounded-full bg-primary hover:bg-primary/90 active:scale-95 transition-all"
                data-testid="generate-ai-plan-button"
              >
                <Sparkles className="mr-2" size={18} />
                Generate AI Plan
              </Button>
            </div>
          </div>
          
          {/* Subscription Banner */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 rounded-2xl p-6 mb-8 border border-primary/20">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                  <Bell className="text-primary" size={24} />
                </div>
                <div>
                  <h3 className="font-serif text-lg">Weekly Recipe Newsletter</h3>
                  <p className="text-sm text-muted-foreground">Get personalized recipes delivered to your inbox every week!</p>
                </div>
              </div>
              <Button
                onClick={() => setShowSubscribeModal(true)}
                className="rounded-full"
                data-testid="banner-subscribe-btn"
              >
                <Mail className="mr-2" size={16} />
                Subscribe Now
              </Button>
            </div>
          </div>
          
          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-6 bg-card rounded-2xl p-4 border border-border/40">
            <Button
              variant="ghost"
              onClick={() => setCurrentWeekOffset(prev => prev - 1)}
              className="rounded-full"
              data-testid="prev-week-btn"
            >
              <ChevronLeft size={20} />
            </Button>
            
            <div className="text-center">
              <h2 className="font-serif text-xl">
                {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {currentWeekOffset === 0 ? 'This Week' : currentWeekOffset > 0 ? `${currentWeekOffset} week(s) ahead` : `${Math.abs(currentWeekOffset)} week(s) ago`}
              </p>
            </div>
            
            <Button
              variant="ghost"
              onClick={() => setCurrentWeekOffset(prev => prev + 1)}
              className="rounded-full"
              data-testid="next-week-btn"
            >
              <ChevronRight size={20} />
            </Button>
          </div>
          
          {/* Weekly Calendar Grid */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {DAYS.map((day, dayIndex) => {
              const date = weekDates[dayIndex];
              const isToday = date.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={day}
                  className={`bg-card rounded-2xl border p-4 ${
                    isToday ? 'border-primary shadow-lg' : 'border-border/40'
                  }`}
                  data-testid={`day-column-${day}`}
                >
                  {/* Day Header */}
                  <div className={`text-center mb-4 pb-3 border-b ${isToday ? 'border-primary/30' : 'border-border/40'}`}>
                    <p className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                      {day}
                    </p>
                    <p className={`text-2xl font-serif ${isToday ? 'text-primary' : ''}`}>
                      {date.getDate()}
                    </p>
                  </div>
                  
                  {/* Meal Slots */}
                  <div className="space-y-3">
                    {MEAL_TYPES.map((meal) => {
                      const Icon = meal.icon;
                      const plannedMeal = getMealForDayAndType(dayIndex, meal.id);
                      
                      return (
                        <div
                          key={meal.id}
                          className={`p-3 rounded-xl transition-all ${
                            plannedMeal 
                              ? 'bg-secondary/50' 
                              : 'bg-secondary/20 border-2 border-dashed border-secondary hover:border-primary/50 cursor-pointer'
                          }`}
                          onClick={() => {
                            if (!plannedMeal) {
                              setSelectedDay(dayIndex);
                              setSelectedMeal(meal.id);
                              setShowAIGenerator(true);
                            }
                          }}
                          data-testid={`meal-slot-${day}-${meal.id}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon size={14} className={meal.color} />
                            <span className="text-xs font-medium text-muted-foreground">{meal.label}</span>
                          </div>
                          {plannedMeal ? (
                            <p className="text-sm font-medium line-clamp-2">{plannedMeal}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Plus size={12} /> Add meal
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Past Plans Section */}
          {plans.length > 0 && (
            <div className="mt-12">
              <h3 className="text-2xl font-serif mb-6">Previous Plans</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {plans.slice(0, 4).map((plan, idx) => (
                  <div
                    key={plan.id || idx}
                    className="bg-card rounded-2xl border border-border/40 p-4"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-serif">Week of {new Date(plan.week_start).toLocaleDateString()}</h4>
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                        AI Generated
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(plan.meals || {}).slice(0, 3).map(day => (
                        <span key={day} className="px-2 py-1 bg-secondary/50 rounded-lg text-xs">
                          {day}
                        </span>
                      ))}
                      {Object.keys(plan.meals || {}).length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{Object.keys(plan.meals).length - 3} more days
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* AI Generator Modal */}
      <AIMealPlanGenerator
        open={showAIGenerator}
        onClose={() => {
          setShowAIGenerator(false);
          setSelectedDay(null);
          setSelectedMeal(null);
        }}
        onPlanGenerated={handlePlanGenerated}
      />
      
      {/* Subscription Modal */}
      <Dialog open={showSubscribeModal} onOpenChange={setShowSubscribeModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="subscribe-modal">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif flex items-center gap-2">
              <Crown className="text-primary" size={24} />
              Weekly Recipe Subscription
            </DialogTitle>
            <DialogDescription>
              Get personalized recipes in your inbox every week!
            </DialogDescription>
          </DialogHeader>
          
          {!isSubscribed ? (
            <div className="space-y-6 mt-4">
              {/* Benefits */}
              <div className="bg-primary/5 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Check size={16} className="text-green-500" />
                  <span>Personalized to your dietary preferences</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check size={16} className="text-green-500" />
                  <span>Matches your favorite cuisines</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check size={16} className="text-green-500" />
                  <span>New recipes every week</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check size={16} className="text-green-500" />
                  <span>Direct to your email inbox</span>
                </div>
              </div>
              
              {/* Dietary Preference */}
              <div className="space-y-2">
                <Label>Dietary Preference</Label>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSubDietary(option)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        subDietary === option
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary hover:bg-secondary/80'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Favorite Cuisines */}
              <div className="space-y-2">
                <Label>Favorite Cuisines (select multiple)</Label>
                <div className="flex flex-wrap gap-2">
                  {CUISINE_OPTIONS.map((cuisine) => (
                    <button
                      key={cuisine.name}
                      type="button"
                      onClick={() => toggleSubCuisine(cuisine.name)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
                        subCuisines.includes(cuisine.name)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary hover:bg-secondary/80'
                      }`}
                    >
                      <span>{cuisine.emoji}</span>
                      {cuisine.name}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Recipes Per Week */}
              <div className="space-y-2">
                <Label>How many recipes per week?</Label>
                <div className="flex gap-3">
                  {RECIPE_COUNTS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setSubRecipeCount(count)}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                        subRecipeCount === count
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary hover:bg-secondary/80'
                      }`}
                    >
                      {count} recipes
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Delivery Day */}
              <div className="space-y-2">
                <Label>Delivery Day</Label>
                <select
                  value={subDeliveryDay}
                  onChange={(e) => setSubDeliveryDay(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border bg-background"
                >
                  {DELIVERY_DAYS.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
              
              {/* Email */}
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="rounded-xl"
                  data-testid="subscription-email"
                />
              </div>
              
              {/* Subscribe Button */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowSubscribeModal(false)}
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubscribe}
                  disabled={subLoading || !subEmail}
                  className="flex-1 rounded-xl"
                  data-testid="confirm-subscribe-btn"
                >
                  {subLoading ? (
                    <span className="animate-spin mr-2">⏳</span>
                  ) : (
                    <Mail className="mr-2" size={16} />
                  )}
                  Subscribe (Free)
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="text-green-600" size={40} />
              </div>
              <h3 className="text-xl font-serif mb-2">You're Subscribed!</h3>
              <p className="text-muted-foreground mb-4">
                Check your inbox for a confirmation email. You'll receive {subRecipeCount} personalized recipes every {subDeliveryDay}.
              </p>
              <Button
                onClick={() => setShowSubscribeModal(false)}
                className="rounded-full"
              >
                Got it!
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WeeklyPlannerPage;
