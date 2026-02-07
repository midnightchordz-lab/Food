import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Calendar, Plus, Sparkles, Crown, Mail, ChevronLeft, ChevronRight,
  Check, X, Clock, Utensils, Coffee, Sun, Moon, Bell, ExternalLink, RefreshCw,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import AIMealPlanGenerator from '@/components/AIMealPlanGenerator';
import RecipeDetailModal from '@/components/RecipeDetailModal';
import PlannerMealCard from '@/components/PlannerMealCard';
import { useShoppingCart } from '@/context/ShoppingCartContext';

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

// Recipe image mapping for common recipes
const RECIPE_IMAGES = {
  'omelette': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
  'masala': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800',
  'curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  'caprese': 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=800',
  'pasta': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800',
  'chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'fish': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
  'tacos': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800',
  'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
  'stir-fry': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800',
  'rice': 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=800',
  'thai': 'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=800',
  'indian': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
  'breakfast': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
  'lunch': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'dinner': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800',
  'default': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
};

// Get image URL for a recipe based on its name
const getRecipeImage = (recipeName) => {
  const nameLower = recipeName.toLowerCase();
  for (const [key, url] of Object.entries(RECIPE_IMAGES)) {
    if (nameLower.includes(key)) {
      return url;
    }
  }
  return RECIPE_IMAGES.default;
};

// Parse recipe name to create a recipe object for the detail modal
const parseRecipeForModal = (recipeName, mealType, day) => {
  const cuisineMatch = recipeName.match(/^(Indian|Italian|Mexican|Chinese|Japanese|Thai|Mediterranean|American|Korean|French)/i);
  const cuisineHint = cuisineMatch ? cuisineMatch[1] : 'International';
  
  // Determine difficulty based on meal type
  let difficulty = 'Medium';
  let cookingTime = '30 min';
  if (mealType === 'breakfast') {
    difficulty = 'Easy';
    cookingTime = '15-20 min';
  } else if (mealType === 'dinner') {
    difficulty = 'Medium';
    cookingTime = '45-60 min';
  }
  
  return {
    title: recipeName,
    description: `A delicious ${mealType} dish perfect for ${day}. This ${cuisineHint.toLowerCase()} inspired recipe brings together fresh flavors and wholesome ingredients for a satisfying meal.`,
    cookingTime,
    difficulty,
    cuisineHint,
    imageUrl: getRecipeImage(recipeName),
    mealType,
    day,
    category: mealType,
  };
};

const WeeklyPlannerPage = () => {
  const [plans, setPlans] = useState([]);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const { isAuthenticated, user, loading } = useAuth();
  
  // Recipe detail modal state
  const [showRecipeDetail, setShowRecipeDetail] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  
  // Continuous meal planning state
  const [mealPreferences, setMealPreferences] = useState(null);
  const [isContinuousPlanningActive, setIsContinuousPlanningActive] = useState(false);
  const [generatingNextWeek, setGeneratingNextWeek] = useState(false);
  
  // Subscription form state
  const [subDietary, setSubDietary] = useState(['Vegetarian']);
  const [subCuisines, setSubCuisines] = useState(['Italian', 'Mexican']);
  const [subRecipeCount, setSubRecipeCount] = useState(5);
  const [subDeliveryDay, setSubDeliveryDay] = useState('Sunday');
  const [subEmail, setSubEmail] = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subDayPrefs, setSubDayPrefs] = useState({});  // Day-specific opt-outs
  const [generatingCurrentWeek, setGeneratingCurrentWeek] = useState(false);  // Track generation state
  
  // Shopping cart
  const shoppingCart = useShoppingCart();
  
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
      loadMealPreferences();
      setSubEmail(user?.email || '');
    }
  }, [isAuthenticated, user]);
  
  // Auto-generate plan when navigating to a new week in auto mode
  useEffect(() => {
    if (isAuthenticated && mealPreferences?.generation_mode === 'auto') {
      checkAndAutoGenerateForWeek(currentWeekOffset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeekOffset, mealPreferences?.generation_mode]);
  
  const loadMealPreferences = async () => {
    try {
      const response = await axios.get(`${API}/meal-preferences`);
      if (response.data.preferences) {
        setMealPreferences(response.data.preferences);
        setIsContinuousPlanningActive(response.data.preferences.is_active || false);
      }
    } catch (error) {
      console.error('Error loading meal preferences:', error);
    }
  };
  
  const checkAndAutoGenerateForWeek = async (weekOffset) => {
    try {
      // Calculate the week start date for the offset
      const today = new Date();
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
      const targetWeekStart = new Date(currentWeekStart);
      targetWeekStart.setDate(currentWeekStart.getDate() + (weekOffset * 7));
      const weekStartStr = targetWeekStart.toISOString().split('T')[0];
      
      // Check if we already have a plan for this week
      const existingPlan = plans.find(p => p.week_start === weekStartStr);
      if (existingPlan) return; // Already have a plan
      
      // Auto-generate plan for this week
      toast.info(`Auto-generating meal plan for week of ${targetWeekStart.toLocaleDateString()}...`);
      
      await axios.post(`${API}/weekly-plan/generate-for-week`, {
        week_offset: weekOffset
      });
      
      toast.success('Meal plan auto-generated!');
      loadPlans();
    } catch (error) {
      console.error('Error auto-generating plan for week:', error);
    }
  };
  
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
    // Reload preferences to get the updated state
    loadMealPreferences();
  };
  
  const generateNextWeekPlan = async () => {
    if (!mealPreferences?.is_active) {
      toast.error('Please set your meal preferences first');
      setShowAIGenerator(true);
      return;
    }
    
    setGeneratingNextWeek(true);
    try {
      const response = await axios.post(`${API}/weekly-plan/generate-next`);
      if (response.data.already_exists) {
        toast.info('Next week\'s plan already exists!');
      } else {
        toast.success('Next week\'s meal plan generated!');
        loadPlans();
      }
    } catch (error) {
      console.error('Error generating next week plan:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate next week\'s plan');
    } finally {
      setGeneratingNextWeek(false);
    }
  };
  
  // Generate plan for the currently viewed week
  const generateCurrentWeekPlan = async () => {
    if (!mealPreferences?.is_active) {
      toast.error('Please set your meal preferences first');
      setShowAIGenerator(true);
      return;
    }
    
    setGeneratingCurrentWeek(true);
    try {
      const response = await axios.post(`${API}/weekly-plan/generate-for-week`, {
        week_offset: currentWeekOffset
      });
      
      if (response.data.already_exists) {
        toast.info('This week\'s plan already exists!');
      } else {
        toast.success('Meal plan generated successfully!');
      }
      loadPlans();
    } catch (error) {
      console.error('Error generating current week plan:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate meal plan');
    } finally {
      setGeneratingCurrentWeek(false);
    }
  };
  
  const getCurrentPlan = () => {
    // Use local date format to match backend's week_start format
    const year = weekStart.getFullYear();
    const month = String(weekStart.getMonth() + 1).padStart(2, '0');
    const day = String(weekStart.getDate()).padStart(2, '0');
    const weekKey = `${year}-${month}-${day}`;
    
    return plans.find(p => p.week_start === weekKey) || null;
  };
  
  // Check if current week has any meals
  const currentWeekHasMeals = () => {
    const currentPlan = getCurrentPlan();
    if (!currentPlan || !currentPlan.meals) return false;
    
    // Check if any day has any meal
    for (const day of DAYS) {
      for (const meal of MEAL_TYPES) {
        if (currentPlan.meals[day]?.[meal.id]) {
          return true;
        }
      }
    }
    return false;
  };
  
  const getMealForDayAndType = (dayIndex, mealType) => {
    const currentPlan = getCurrentPlan();
    if (!currentPlan) return null;
    
    const day = DAYS[dayIndex];
    return currentPlan.meals?.[day]?.[mealType] || null;
  };
  
  // Handle clicking on a planned meal to view recipe details
  const handleMealClick = (recipeName, mealType, day, dayIndex) => {
    if (recipeName) {
      const recipe = parseRecipeForModal(recipeName, mealType, day);
      setSelectedRecipe(recipe);
      setShowRecipeDetail(true);
    } else {
      // Empty slot - open AI generator
      setSelectedDay(dayIndex);
      setSelectedMeal(mealType);
      setShowAIGenerator(true);
    }
  };
  
  // Handle saving recipe from planner
  const handleSaveRecipe = async (recipe) => {
    try {
      await axios.post(`${API}/recipes/save`, { recipe });
      toast.success('Recipe saved to your collection!');
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error('Failed to save recipe');
    }
  };
  
  const handleSubscribe = async () => {
    if (!subEmail || !subEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setSubLoading(true);
    try {
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
  
  // Show loading spinner while auth is being verified
  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" data-testid="weekly-planner-loading">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }
  
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
              <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-1" data-testid="page-title">
                MOOD FOOD
              </h1>
              <p className="text-primary font-medium mb-2">When Feelings Need Feeding</p>
              <p className="text-muted-foreground" data-testid="page-description">
                Plan your weekly meals based on how you feel.
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
          
          {/* Meal Planning Status Banner */}
          {mealPreferences && (
            <div className={`rounded-2xl p-4 mb-6 border ${
              mealPreferences.generation_mode === 'auto'
                ? 'bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-teal-500/10 border-green-500/20'
                : 'bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-sky-500/10 border-blue-500/20'
            }`}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    mealPreferences.generation_mode === 'auto' ? 'bg-green-500/20' : 'bg-blue-500/20'
                  }`}>
                    {mealPreferences.generation_mode === 'auto' ? (
                      <RefreshCw className="text-green-600" size={20} />
                    ) : (
                      <Check className="text-blue-600" size={20} />
                    )}
                  </div>
                  <div>
                    <h3 className={`font-medium ${
                      mealPreferences.generation_mode === 'auto' 
                        ? 'text-green-800 dark:text-green-200' 
                        : 'text-blue-800 dark:text-blue-200'
                    }`}>
                      {mealPreferences.generation_mode === 'auto' 
                        ? '🔄 Auto-Generation Active' 
                        : '👆 Manual Mode Active'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {Array.isArray(mealPreferences.dietary_preference) 
                        ? mealPreferences.dietary_preference.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
                        : mealPreferences.dietary_preference?.charAt(0).toUpperCase() + mealPreferences.dietary_preference?.slice(1)} • 
                      {mealPreferences.calorie_target ? ` ${mealPreferences.calorie_target} cal/day` : ''}
                      {mealPreferences.macro_targets?.protein_g ? ` • ${mealPreferences.macro_targets.protein_g}g P / ${mealPreferences.macro_targets.carbs_g}g C / ${mealPreferences.macro_targets.fat_g}g F` : ''}
                      {mealPreferences.cuisine_preferences?.length > 0 ? ` • ${mealPreferences.cuisine_preferences.join(', ')}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {mealPreferences.generation_mode === 'auto' 
                        ? 'New unique plans are generated automatically each week'
                        : 'Click "Generate Next Week" to create new plans'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAIGenerator(true)}
                    className="rounded-full"
                  >
                    Update Preferences
                  </Button>
                  {mealPreferences.generation_mode === 'manual' && (
                    <Button
                      onClick={generateNextWeekPlan}
                      disabled={generatingNextWeek}
                      className="rounded-full bg-blue-600 hover:bg-blue-700"
                      data-testid="generate-next-week-btn"
                    >
                      {generatingNextWeek ? (
                        <>Generating...</>
                      ) : (
                        <>
                          <Plus className="mr-1" size={16} />
                          Generate Next Week
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          
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
                      const plannedMeal = getMealForDayAndType(dayIndex, meal.id);
                      
                      return (
                        <div key={meal.id} className="relative">
                          <PlannerMealCard
                            mealName={plannedMeal}
                            mealType={meal.id}
                            onClick={() => handleMealClick(plannedMeal, meal.id, day, dayIndex)}
                            compact={true}
                            enableAI={true}
                          />
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
      
      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        isOpen={showRecipeDetail}
        onClose={() => {
          setShowRecipeDetail(false);
          setSelectedRecipe(null);
        }}
        onSave={() => selectedRecipe && handleSaveRecipe(selectedRecipe)}
        fromPlanner={true}
      />
      
      {/* Subscription Modal */}
      <Dialog open={showSubscribeModal} onOpenChange={setShowSubscribeModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden" data-testid="subscribe-modal">
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
            <>
              <div className="overflow-y-auto max-h-[45vh] space-y-4 pr-2">
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
                
                {/* Dietary Preference - Multi-select */}
                <div className="space-y-2">
                  <Label>Dietary Preference (Select Multiple)</Label>
                  <div className="flex flex-wrap gap-2">
                    {DIETARY_OPTIONS.map((option) => (
                      <button
                        key={option}
                      type="button"
                      onClick={() => {
                        setSubDietary(prev => 
                          prev.includes(option) 
                            ? prev.filter(d => d !== option)
                            : [...prev, option]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        subDietary.includes(option)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary hover:bg-secondary/80'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {subDietary.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Meals will include a mix of: {subDietary.join(' + ')}
                  </p>
                )}
              </div>
              
              {/* Day-Specific Opt-Out */}
              {subDietary.length > 1 && subDietary.includes('Non-Vegetarian') && (
                <div className="space-y-2">
                  <Label>🗓️ Day-Specific Opt-Out (Vegetarian Days)</Label>
                  <p className="text-xs text-muted-foreground">Select days for vegetarian-only meals</p>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setSubDayPrefs(prev => ({
                            ...prev,
                            [day]: prev[day] === 'Vegetarian' ? null : 'Vegetarian'
                          }));
                        }}
                        className={`p-2 rounded-lg text-xs text-center transition-all ${
                          subDayPrefs[day] === 'Vegetarian'
                            ? 'bg-green-500 text-white'
                            : 'bg-secondary hover:bg-secondary/80'
                        }`}
                      >
                        <div className="font-medium">{day.slice(0, 3)}</div>
                        {subDayPrefs[day] === 'Vegetarian' && (
                          <div className="text-[10px]">🥗</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
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
            </div>
            
            <DialogFooter className="flex gap-3">
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
            </DialogFooter>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="text-green-600" size={40} />
              </div>
              <h3 className="text-xl font-serif mb-2">You&apos;re Subscribed!</h3>
              <p className="text-muted-foreground mb-4">
                Check your inbox for a confirmation email. You&apos;ll receive {subRecipeCount} personalized recipes every {subDeliveryDay}.
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
