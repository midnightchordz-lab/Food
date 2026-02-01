import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { 
  Calendar, Sparkles, ChevronLeft, ChevronRight, Loader2,
  Coffee, Sun, Moon, AlertCircle, Activity, RefreshCw, Settings,
  Heart, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import RecipeDetailModal from '@/components/RecipeDetailModal';
import PlannerMealCard from '@/components/PlannerMealCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: Coffee, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { id: 'lunch', label: 'Lunch', icon: Sun, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  { id: 'dinner', label: 'Dinner', icon: Moon, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
];

const DIABETES_TYPES = [
  { id: 'type1', label: 'Type 1', description: 'Insulin-dependent' },
  { id: 'type2', label: 'Type 2', description: 'Insulin resistance' },
  { id: 'gestational', label: 'Gestational', description: 'Pregnancy-related' },
  { id: 'prediabetes', label: 'Pre-Diabetes', description: 'At risk' },
];

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Non-Vegetarian', 'Pescatarian'];

const CUISINE_OPTIONS = [
  { name: 'Indian', emoji: '🍛' },
  { name: 'Mediterranean', emoji: '🥙' },
  { name: 'Asian', emoji: '🍜' },
  { name: 'Mexican', emoji: '🌮' },
  { name: 'American', emoji: '🥗' },
  { name: 'Italian', emoji: '🍝' },
];

// Recipe image mapping
const RECIPE_IMAGES = {
  'omelette': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
  'yogurt': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800',
  'smoothie': 'https://images.unsplash.com/photo-1502741224143-90386d7f8c82?w=800',
  'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  'salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800',
  'chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'fish': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
  'tofu': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
  'stir-fry': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800',
  'quinoa': 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=800',
  'wrap': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800',
  'bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'breakfast': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
  'lunch': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'dinner': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800',
  'default': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
};

const getRecipeImage = (recipeName) => {
  const nameLower = recipeName.toLowerCase();
  for (const [key, url] of Object.entries(RECIPE_IMAGES)) {
    if (nameLower.includes(key)) return url;
  }
  return RECIPE_IMAGES.default;
};

// Extract carbs from meal name like "Meal name (~30g carbs)"
const extractCarbs = (mealName) => {
  const match = mealName?.match(/\(~?(\d+)g?\s*carbs?\)/i);
  return match ? match[1] : null;
};

// Parse recipe for modal
const parseRecipeForModal = (recipeName, mealType, day) => {
  const carbs = extractCarbs(recipeName);
  const cleanName = recipeName?.replace(/\s*\([^)]*carbs?\)/gi, '').trim();
  
  return {
    title: cleanName || recipeName,
    description: `A diabetes-friendly ${mealType} dish designed for blood sugar control. ${carbs ? `Approximately ${carbs}g of carbohydrates.` : ''}`,
    cookingTime: mealType === 'breakfast' ? '15-20 min' : mealType === 'lunch' ? '25-30 min' : '35-45 min',
    difficulty: mealType === 'breakfast' ? 'Easy' : 'Medium',
    cuisineHint: 'Diabetes-Friendly',
    imageUrl: getRecipeImage(recipeName),
    mealType,
    day,
    diabetesInfo: carbs ? `~${carbs}g carbs` : 'Low glycemic',
  };
};

const DiabetesWeeklyPlannerPage = () => {
  const [plans, setPlans] = useState([]);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const { isAuthenticated, user, loading } = useAuth();
  
  // Recipe detail modal state
  const [showRecipeDetail, setShowRecipeDetail] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  
  // User exclusions
  const [userExclusions, setUserExclusions] = useState([]);
  
  // Preferences state
  const [preferences, setPreferences] = useState(null);
  const [settingsDiabetesType, setSettingsDiabetesType] = useState('type2');
  const [settingsDietary, setSettingsDietary] = useState(['Non-Vegetarian']);
  const [settingsCuisines, setSettingsCuisines] = useState(['Indian', 'Mediterranean']);
  const [settingsCalories, setSettingsCalories] = useState(1800);
  const [settingsDayPrefs, setSettingsDayPrefs] = useState({});  // Day-specific opt-outs
  const [savingSettings, setSavingSettings] = useState(false);
  
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
  
  useEffect(() => {
    if (isAuthenticated) {
      loadPlans();
      loadPreferences();
      loadExclusions();
    }
  }, [isAuthenticated]);
  
  const loadExclusions = async () => {
    try {
      const response = await axios.get(`${API}/exclusions`);
      if (response.data.excluded_ingredients) {
        setUserExclusions(response.data.excluded_ingredients.map(e => e.name));
      }
    } catch (error) {
      console.error('Error loading exclusions:', error);
    }
  };
  
  const loadPreferences = async () => {
    try {
      const response = await axios.get(`${API}/diabetes/meal-preferences`);
      if (response.data.preferences) {
        const prefs = response.data.preferences;
        setPreferences(prefs);
        setSettingsDiabetesType(prefs.diabetes_type || 'type2');
        setSettingsDietary(Array.isArray(prefs.dietary_preference) ? prefs.dietary_preference : [prefs.dietary_preference || 'Non-Vegetarian']);
        setSettingsCuisines(prefs.cuisine_preferences || ['Indian', 'Mediterranean']);
        setSettingsCalories(prefs.calorie_target || 1800);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };
  
  const loadPlans = async () => {
    try {
      const response = await axios.get(`${API}/diabetes/weekly-plan`);
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('Error loading plans:', error);
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
  
  const getMealForDayAndType = (dayIndex, mealType) => {
    const currentPlan = getCurrentPlan();
    if (!currentPlan) return null;
    
    const day = DAYS[dayIndex];
    return currentPlan.meals?.[day]?.[mealType] || null;
  };
  
  const handleMealClick = (recipeName, mealType, day) => {
    if (recipeName) {
      const recipe = parseRecipeForModal(recipeName, mealType, day);
      setSelectedRecipe(recipe);
      setShowRecipeDetail(true);
    }
  };
  
  const savePreferences = async () => {
    setSavingSettings(true);
    try {
      // Filter out null/undefined values from day preferences
      const filteredDayPrefs = Object.fromEntries(
        Object.entries(settingsDayPrefs).filter(([_, v]) => v)
      );
      
      await axios.post(`${API}/diabetes/meal-preferences`, {
        diabetes_type: settingsDiabetesType,
        dietary_preference: settingsDietary,
        cuisine_preferences: settingsCuisines,
        calorie_target: settingsCalories,
        day_specific_preferences: Object.keys(filteredDayPrefs).length > 0 ? filteredDayPrefs : null
      });
      
      setPreferences({
        diabetes_type: settingsDiabetesType,
        dietary_preference: settingsDietary,
        cuisine_preferences: settingsCuisines,
        calorie_target: settingsCalories,
        day_specific_preferences: filteredDayPrefs
      });
      
      toast.success('Preferences saved!');
      setShowSettingsModal(false);
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSavingSettings(false);
    }
  };
  
  const generatePlan = async () => {
    if (!preferences) {
      toast.info('Please set your preferences first');
      setShowSettingsModal(true);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/diabetes/weekly-plan/generate`, {
        diabetes_type: preferences.diabetes_type || 'type2',
        dietary_preference: preferences.dietary_preference || 'non-vegetarian',
        cuisine_preferences: preferences.cuisine_preferences || [],
        calorie_target: preferences.calorie_target,
        day_specific_preferences: preferences.day_specific_preferences || null
      });
      
      toast.success('Diabetes meal plan generated!');
      if (response.data.exclusions_applied?.length > 0) {
        toast.info(`Applied exclusions: ${response.data.exclusions_applied.join(', ')}`);
      }
      loadPlans();
    } catch (error) {
      console.error('Error generating plan:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate plan');
    } finally {
      setIsLoading(false);
    }
  };
  
  const generateForWeek = async (offset) => {
    if (!preferences) {
      toast.info('Please set your preferences first');
      setShowSettingsModal(true);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/diabetes/weekly-plan/generate-for-week`, {
        week_offset: offset
      });
      
      if (response.data.already_exists) {
        toast.info('Plan already exists for this week');
      } else {
        toast.success('Meal plan generated!');
      }
      loadPlans();
    } catch (error) {
      console.error('Error generating plan:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate plan');
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleCuisine = (cuisine) => {
    setSettingsCuisines(prev =>
      prev.includes(cuisine)
        ? prev.filter(c => c !== cuisine)
        : [...prev, cuisine]
    );
  };
  
  const handleSaveRecipe = async (recipe) => {
    try {
      await axios.post(`${API}/recipes/save`, { recipe });
      toast.success('Recipe saved!');
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error('Failed to save recipe');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" data-testid="diabetes-planner-loading">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="diabetes-planner-page">
        <div className="max-w-6xl mx-auto text-center py-20">
          <Activity className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-serif mb-2">Please log in to access diabetes meal planning</h3>
          <p className="text-muted-foreground mb-4">Get personalized blood sugar-friendly meal plans</p>
        </div>
      </div>
    );
  }
  
  const currentPlan = getCurrentPlan();
  
  return (
    <>
      <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="diabetes-planner-page">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
                  <Activity className="text-white" size={20} />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-serif font-bold" data-testid="page-title">
                    MOOD FOOD
                  </h1>
                  <p className="text-primary font-medium text-sm">When Feelings Need Feeding</p>
                </div>
              </div>
              <p className="text-muted-foreground">
                Diabetes-optimized weekly plans based on your mood
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowSettingsModal(true)}
                variant="outline"
                className="rounded-full"
                data-testid="settings-button"
              >
                <Settings className="mr-2" size={18} />
                Settings
              </Button>
              <Button
                onClick={generatePlan}
                disabled={isLoading}
                className="rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700"
                data-testid="generate-plan-button"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 animate-spin" size={18} />
                ) : (
                  <Sparkles className="mr-2" size={18} />
                )}
                Generate Plan
              </Button>
            </div>
          </div>
          
          {/* Exclusions Banner */}
          {userExclusions.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-amber-500 flex-shrink-0" size={20} />
                <div>
                  <p className="font-medium text-amber-700">Active Food Exclusions</p>
                  <p className="text-sm text-amber-600">
                    Excluding: {userExclusions.join(', ')}
                  </p>
                </div>
                <Link to="/profile" className="ml-auto">
                  <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700">
                    Manage
                  </Button>
                </Link>
              </div>
            </div>
          )}
          
          {/* Preferences Banner */}
          {preferences && (
            <div className="bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border border-teal-500/20 rounded-xl p-4 mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Check className="text-teal-500" size={18} />
                  <span className="font-medium">
                    {DIABETES_TYPES.find(d => d.id === preferences.diabetes_type)?.label || 'Type 2'}
                  </span>
                </div>
                <span className="text-muted-foreground">•</span>
                <span>{preferences.dietary_preference}</span>
                <span className="text-muted-foreground">•</span>
                <span>{preferences.calorie_target || 1800} cal/day</span>
                {preferences.cuisine_preferences?.length > 0 && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span>{preferences.cuisine_preferences.join(', ')}</span>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeekOffset(prev => prev - 1)}
              className="rounded-full"
            >
              <ChevronLeft size={18} className="mr-1" />
              Previous
            </Button>
            
            <div className="text-center">
              <h2 className="font-medium">
                {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h2>
              {currentWeekOffset === 0 && (
                <span className="text-sm text-teal-500 font-medium">This Week</span>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeekOffset(prev => prev + 1)}
              className="rounded-full"
            >
              Next
              <ChevronRight size={18} className="ml-1" />
            </Button>
          </div>
          
          {/* Meal Plan Grid */}
          {currentPlan ? (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              {/* Header Row */}
              <div className="grid grid-cols-8 bg-muted/50 border-b border-border">
                <div className="p-3 font-medium text-muted-foreground text-sm">Meal</div>
                {DAYS.map((day, idx) => (
                  <div key={day} className="p-3 text-center border-l border-border">
                    <div className="font-medium text-sm">{day.slice(0, 3)}</div>
                    <div className="text-xs text-muted-foreground">
                      {weekDates[idx].getDate()}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Meal Rows */}
              {MEAL_TYPES.map(mealType => (
                <div key={mealType.id} className="grid grid-cols-8 border-b border-border last:border-b-0">
                  <div className={`p-3 ${mealType.bgColor} flex items-center gap-2`}>
                    <mealType.icon className={mealType.color} size={18} />
                    <span className="font-medium text-sm">{mealType.label}</span>
                  </div>
                  {DAYS.map((day, dayIdx) => {
                    const meal = getMealForDayAndType(dayIdx, mealType.id);
                    const carbs = extractCarbs(meal);
                    
                    return (
                      <div
                        key={`${day}-${mealType.id}`}
                        className="p-1 border-l border-border min-h-[100px]"
                      >
                        <PlannerMealCard
                          mealName={meal}
                          mealType={mealType.id}
                          carbs={carbs}
                          onClick={() => meal && handleMealClick(meal, mealType.id, day)}
                          compact={false}
                          enableAI={true}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border p-12 text-center">
              <Calendar className="mx-auto mb-4 text-muted-foreground" size={48} />
              <h3 className="text-xl font-serif mb-2">No meal plan for this week</h3>
              <p className="text-muted-foreground mb-6">
                Generate a diabetes-optimized meal plan with carb tracking
              </p>
              <Button
                onClick={() => generateForWeek(currentWeekOffset)}
                disabled={isLoading}
                className="rounded-full bg-gradient-to-r from-teal-500 to-emerald-600"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 animate-spin" size={18} />
                ) : (
                  <Sparkles className="mr-2" size={18} />
                )}
                Generate This Week&apos;s Plan
              </Button>
            </div>
          )}
          
          {/* Diabetes Tips */}
          <div className="mt-8 bg-gradient-to-r from-teal-500/5 to-emerald-500/5 rounded-2xl p-6 border border-teal-500/10">
            <h3 className="font-serif text-lg mb-4 flex items-center gap-2">
              <Heart className="text-teal-500" size={20} />
              Blood Sugar Tips
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white/50 rounded-xl p-4">
                <h4 className="font-medium mb-1">🍽️ Meal Timing</h4>
                <p className="text-sm text-muted-foreground">Eat at consistent times daily to help regulate blood sugar levels</p>
              </div>
              <div className="bg-white/50 rounded-xl p-4">
                <h4 className="font-medium mb-1">🥗 Portion Control</h4>
                <p className="text-sm text-muted-foreground">Use the plate method: 1/2 vegetables, 1/4 protein, 1/4 carbs</p>
              </div>
              <div className="bg-white/50 rounded-xl p-4">
                <h4 className="font-medium mb-1">💧 Stay Hydrated</h4>
                <p className="text-sm text-muted-foreground">Drink water with meals to help with digestion and blood sugar control</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Settings Modal */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Settings size={20} />
              Diabetes Meal Preferences
            </DialogTitle>
          </DialogHeader>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
            {/* Diabetes Type */}
            <div>
              <label className="text-sm font-medium mb-2 block">Diabetes Type</label>
              <div className="grid grid-cols-2 gap-2">
                {DIABETES_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSettingsDiabetesType(type.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      settingsDiabetesType === type.id
                        ? 'border-teal-500 bg-teal-500/10'
                        : 'border-border hover:border-teal-500/50'
                    }`}
                  >
                    <div className="font-medium text-sm">{type.label}</div>
                    <div className="text-xs text-muted-foreground">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Dietary Preference - Multi-select */}
            <div>
              <label className="text-sm font-medium mb-2 block">Dietary Preference (Select Multiple)</label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map(diet => (
                  <button
                    key={diet}
                    onClick={() => {
                      setSettingsDietary(prev => 
                        prev.includes(diet) 
                          ? prev.filter(d => d !== diet)
                          : [...prev, diet]
                      );
                    }}
                    className={`px-4 py-2 rounded-full text-sm transition-all ${
                      settingsDietary.includes(diet)
                        ? 'bg-teal-500 text-white'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {diet}
                  </button>
                ))}
              </div>
              {settingsDietary.length > 1 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Meals will include a mix of: {settingsDietary.join(' + ')}
                </p>
              )}
            </div>
            
            {/* Cuisines */}
            <div>
              <label className="text-sm font-medium mb-2 block">Preferred Cuisines</label>
              <div className="flex flex-wrap gap-2">
                {CUISINE_OPTIONS.map(cuisine => (
                  <button
                    key={cuisine.name}
                    onClick={() => toggleCuisine(cuisine.name)}
                    className={`px-3 py-2 rounded-full text-sm transition-all ${
                      settingsCuisines.includes(cuisine.name)
                        ? 'bg-teal-500 text-white'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {cuisine.emoji} {cuisine.name}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Calories */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Daily Calorie Target: {settingsCalories} cal
              </label>
              <input
                type="range"
                min="1200"
                max="2500"
                step="100"
                value={settingsCalories}
                onChange={(e) => setSettingsCalories(parseInt(e.target.value))}
                className="w-full accent-teal-500"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1200</span>
                <span>2500</span>
              </div>
            </div>
            
            {/* Day-Specific Dietary Opt-Out */}
            {settingsDietary.length > 1 && settingsDietary.includes('Non-Vegetarian') && (
              <div>
                <label className="text-sm font-medium mb-2 block">🗓️ Day-Specific Opt-Out</label>
                <p className="text-xs text-muted-foreground mb-3">Select days where you prefer vegetarian-only meals</p>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      onClick={() => {
                        setSettingsDayPrefs(prev => ({
                          ...prev,
                          [day]: prev[day] === 'Vegetarian' ? null : 'Vegetarian'
                        }));
                      }}
                      className={`p-2 rounded-lg text-xs text-center transition-all ${
                        settingsDayPrefs[day] === 'Vegetarian'
                          ? 'bg-green-500 text-white'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <div className="font-medium">{day.slice(0, 3)}</div>
                      {settingsDayPrefs[day] === 'Vegetarian' && (
                        <div className="text-[10px]">🥗 Veg</div>
                      )}
                    </button>
                  ))}
                </div>
                {Object.keys(settingsDayPrefs).filter(d => settingsDayPrefs[d]).length > 0 && (
                  <p className="text-xs text-green-600 mt-2">
                    Vegetarian days: {Object.keys(settingsDayPrefs).filter(d => settingsDayPrefs[d]).join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Fixed Footer with Save Button */}
          <div className="border-t px-6 py-4 bg-background">
            <Button
              onClick={savePreferences}
              disabled={savingSettings}
              className="w-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-600"
            >
              {savingSettings ? (
                <Loader2 className="mr-2 animate-spin" size={18} />
              ) : (
                <Check className="mr-2" size={18} />
              )}
              Save Preferences
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          isOpen={showRecipeDetail}
          onClose={() => {
            setShowRecipeDetail(false);
            setSelectedRecipe(null);
          }}
          onSave={() => handleSaveRecipe(selectedRecipe)}
        />
      )}
    </>
  );
};

export default DiabetesWeeklyPlannerPage;
