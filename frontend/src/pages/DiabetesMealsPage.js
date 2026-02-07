import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, Loader2, Heart, Home, Sparkles, AlertCircle, 
  Activity, Droplets, Search, CheckCircle2, Info, Settings, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import RecipeMessageDisplay, { hasRecipes } from '@/components/RecipeMessageDisplay';
import MoodCarousel, { MOOD_IMAGES } from '@/components/MoodCarousel';
import MealTypeSelector, { MEAL_TYPES } from '@/components/MealTypeSelector';
import FoodPreferenceSelector, { FOOD_PREFERENCES } from '@/components/FoodPreferenceSelector';
import CuisineSelector, { CUISINES } from '@/components/CuisineSelector';
import { FeatureLockedModal, handleFeatureLockedError } from '@/components/FeatureGate';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Diabetes types
const DIABETES_TYPES = [
  { 
    id: 'type1', 
    label: 'Type 1 Diabetes',
    icon: '💉',
    description: 'Insulin-dependent diabetes'
  },
  { 
    id: 'type2', 
    label: 'Type 2 Diabetes',
    icon: '🩺',
    description: 'Insulin resistance diabetes'
  },
  { 
    id: 'gestational', 
    label: 'Gestational Diabetes',
    icon: '🤰',
    description: 'Pregnancy-related diabetes'
  },
  { 
    id: 'prediabetes', 
    label: 'Pre-Diabetes',
    icon: '⚠️',
    description: 'At risk of diabetes'
  },
];

// Chat state persistence key - user-specific
const DIABETES_CHAT_STORAGE_KEY_PREFIX = 'moodfood_diabetes_chat_state_';

const getDiabetesStorageKey = (userId) => {
  return userId ? `${DIABETES_CHAT_STORAGE_KEY_PREFIX}${userId}` : null;
};

const DiabetesMealsPage = () => {
  // Core state
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [sessionId, setSessionId] = useState(`diabetes-session-${Date.now()}`);
  
  // Recipe dialog state
  const [showRecipeDialog, setShowRecipeDialog] = useState(false);
  const [recipeToSave, setRecipeToSave] = useState(null);
  
  // Feature lock modal state
  const [featureLockedModal, setFeatureLockedModal] = useState({
    isOpen: false,
    feature: '',
    upgradeTo: '',
    currentPlan: ''
  });
  
  // Flow state
  const [flowStep, setFlowStep] = useState('greeting');
  const [selectedMood, setSelectedMood] = useState(null);
  const [selectedDiabetesType, setSelectedDiabetesType] = useState(null);
  const [diabetesResearch, setDiabetesResearch] = useState(null);
  const [selectedDietaryPref, setSelectedDietaryPref] = useState(null);
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [selectedCuisines, setSelectedCuisines] = useState([]);
  
  // Food exclusions state
  const [userExclusions, setUserExclusions] = useState([]);
  const [showExclusionsBanner, setShowExclusionsBanner] = useState(true);
  
  // Track previous user to detect user changes
  const [previousUserId, setPreviousUserId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  
  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  
  // Track if this is the initial load
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  useEffect(() => {
    // Don't scroll to bottom on initial load - keep greeting visible at top
    if (!isInitialLoad && messages.length > 1) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, isInitialLoad]);
  
  // Clear and reset chat when user changes
  useEffect(() => {
    if (user?.id && previousUserId && user.id !== previousUserId) {
      // User has changed - clear all chat state
      console.log('User changed in Diabetes page, clearing state');
      setMessages([]);
      setFlowStep('greeting');
      setSelectedMood(null);
      setSelectedDiabetesType(null);
      setDiabetesResearch(null);
      setSelectedDietaryPref(null);
      setSelectedMealType(null);
      setSelectedCuisines([]);
      setSessionId(`diabetes-session-${Date.now()}`);
      setUserExclusions([]);
    }
    if (user?.id) {
      setPreviousUserId(user.id);
    }
  }, [user?.id, previousUserId]);
  
  // Save chat state (user-specific)
  useEffect(() => {
    if (messages.length > 0 && user?.id) {
      const storageKey = getDiabetesStorageKey(user.id);
      if (storageKey) {
        const stateToSave = {
          sessionId,
          messages,
          flowStep,
          selectedMood,
          selectedDiabetesType,
          diabetesResearch,
          selectedDietaryPref,
          selectedMealType,
          selectedCuisines,
          timestamp: Date.now()
        };
        localStorage.setItem(storageKey, JSON.stringify(stateToSave));
      }
    }
  }, [messages, flowStep, selectedMood, selectedDiabetesType, diabetesResearch, selectedDietaryPref, selectedMealType, selectedCuisines, sessionId, user?.id]);
  
  // Load saved state or show initial greeting (user-specific)
  useEffect(() => {
    if (loading) return;
    
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    const storageKey = getDiabetesStorageKey(user?.id);
    if (storageKey) {
      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          if (parsed.timestamp && (Date.now() - parsed.timestamp) < 24 * 60 * 60 * 1000) {
            if (parsed.messages && parsed.messages.length > 0) {
              setMessages(parsed.messages);
              setFlowStep(parsed.flowStep || 'greeting');
              setSelectedMood(parsed.selectedMood);
              setSelectedDiabetesType(parsed.selectedDiabetesType);
              setDiabetesResearch(parsed.diabetesResearch);
              setSelectedDietaryPref(parsed.selectedDietaryPref);
              setSelectedMealType(parsed.selectedMealType);
              setSelectedCuisines(parsed.selectedCuisines || []);
              if (parsed.sessionId) {
                setSessionId(parsed.sessionId);
              }
              return;
            }
          }
        } catch (e) {
          console.error('Error parsing saved diabetes chat state:', e);
        }
      }
    }
    
    // Show initial greeting
    setMessages([{
      role: 'assistant',
      content: `Welcome to Diabetes-Friendly Meals! 🩺\n\nI'm here to help you find delicious meals that support your blood sugar control while matching your mood.\n\nLet's start by understanding how you're feeling today:`,
      timestamp: new Date().toISOString(),
      showMoodSelector: true
    }]);
    setFlowStep('mood');
  }, [isAuthenticated, user, navigate, loading]);
  
  // Load user exclusions on mount
  useEffect(() => {
    const loadExclusions = async () => {
      if (!isAuthenticated) return;
      try {
        const response = await axios.get(`${API}/exclusions`);
        if (response.data?.excluded_ingredients) {
          setUserExclusions(response.data.excluded_ingredients);
        }
      } catch (error) {
        console.error('Error loading exclusions:', error);
      }
    };
    loadExclusions();
  }, [isAuthenticated]);
  
  // Handle mood selection
  const handleMoodSelect = (moodId, moodLabel, moodDescription) => {
    setSelectedMood(moodId);
    setIsInitialLoad(false); // User has interacted, enable scroll to bottom
    
    const userMsg = {
      role: 'user',
      content: `I'm feeling ${moodLabel?.toLowerCase()}`,
      timestamp: new Date().toISOString()
    };
    
    const aiMsg = {
      role: 'assistant',
      content: `${moodLabel}! ${moodDescription}\n\nGreat to know how you're feeling. To provide the best meal suggestions for your blood sugar control, I need to understand your diabetes type.\n\nWhat type of diabetes do you have?`,
      timestamp: new Date().toISOString(),
      showDiabetesTypeSelector: true
    };
    
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setFlowStep('diabetesType');
  };
  
  // Handle diabetes type selection
  const handleDiabetesTypeSelect = async (typeId) => {
    setSelectedDiabetesType(typeId);
    const diabetesType = DIABETES_TYPES.find(t => t.id === typeId);
    
    const userMsg = {
      role: 'user',
      content: `I have ${diabetesType?.label}`,
      timestamp: new Date().toISOString()
    };
    
    const researchMsg = {
      role: 'assistant',
      content: `Let me research ${diabetesType?.label} dietary guidelines to ensure my suggestions are safe and effective for you...`,
      timestamp: new Date().toISOString(),
      isResearching: true
    };
    
    setMessages(prev => [...prev, userMsg, researchMsg]);
    setIsResearching(true);
    
    // Call backend to research diabetes type
    try {
      const response = await axios.post(`${API}/diabetes/research`, {
        diabetes_type: typeId,
        session_id: sessionId
      });
      
      const research = response.data;
      setDiabetesResearch(research);
      
      const researchSummaryMsg = {
        role: 'assistant',
        content: research.summary,
        timestamp: new Date().toISOString(),
        researchComplete: true,
        guidelines: research.guidelines,
        showDietarySelector: true
      };
      
      setMessages(prev => {
        // Remove the "researching" message and add summary
        const filtered = prev.filter(m => !m.isResearching);
        return [...filtered, researchSummaryMsg];
      });
      setFlowStep('dietaryPref');
      
    } catch (error) {
      console.error('Error researching diabetes type:', error);
      
      // Check if it's a feature locked error
      if (handleFeatureLockedError(error, setFeatureLockedModal)) {
        setMessages(prev => prev.filter(m => !m.isResearching));
        setFlowStep('greeting');
        return;
      }
      
      // Fallback with pre-built guidelines
      const fallbackGuidelines = getFallbackGuidelines(typeId);
      setDiabetesResearch(fallbackGuidelines);
      
      const fallbackMsg = {
        role: 'assistant',
        content: fallbackGuidelines.summary,
        timestamp: new Date().toISOString(),
        researchComplete: true,
        guidelines: fallbackGuidelines.guidelines,
        showDietarySelector: true
      };
      
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isResearching);
        return [...filtered, fallbackMsg];
      });
      setFlowStep('dietaryPref');
    } finally {
      setIsResearching(false);
    }
  };
  
  // Fallback guidelines if API fails
  const getFallbackGuidelines = (typeId) => {
    const guidelines = {
      type1: {
        summary: `I've prepared guidelines for Type 1 Diabetes management:\n\n**Key Principles:**\n✅ Carbohydrate counting is critical\n✅ Balance carbs with insulin doses\n✅ Consistent meal timing\n✅ Low glycemic index foods preferred\n✅ 45-60g carbs per meal typical\n\n**Foods I'll Recommend:**\n• Complex carbs (whole grains, legumes)\n• High-fiber vegetables\n• Lean proteins\n• Healthy fats (nuts, avocado)\n\n**Foods I'll Avoid:**\n• Simple sugars\n• Refined carbs\n• High-GI foods\n\nAll my suggestions will include carb counts for insulin calculations!\n\nWhat's your dietary preference?`,
        guidelines: {
          maxCarbsPerMeal: 60,
          minFiberPerMeal: 8,
          maxGlycemicIndex: 55,
          emphasis: ['carb-counting', 'insulin-balance', 'consistent-timing']
        }
      },
      type2: {
        summary: `I've prepared guidelines for Type 2 Diabetes management:\n\n**Key Principles:**\n✅ Lower carbohydrate intake (30-40% of calories)\n✅ Emphasis on non-starchy vegetables\n✅ Lean proteins for satiety\n✅ Healthy fats for insulin sensitivity\n✅ Low glycemic index foods (GI < 55)\n✅ Portion control\n\n**Foods I'll Recommend:**\n• Non-starchy vegetables (unlimited)\n• Lean proteins (chicken, fish, tofu)\n• Whole grains in moderation\n• Legumes and beans\n• Foods with cinnamon, turmeric\n\n**Foods I'll Avoid:**\n• Simple carbohydrates\n• Sugary drinks\n• Trans fats\n• Processed foods\n\nAll my suggestions will follow these evidence-based guidelines!\n\nWhat's your dietary preference?`,
        guidelines: {
          maxCarbsPerMeal: 45,
          minFiberPerMeal: 10,
          maxGlycemicIndex: 55,
          emphasis: ['low-carb', 'portion-control', 'insulin-sensitivity']
        }
      },
      gestational: {
        summary: `I've prepared guidelines for Gestational Diabetes management:\n\n**Key Principles:**\n✅ Cannot skip meals (harmful to baby)\n✅ Smaller, frequent meals\n✅ Protein at every meal/snack\n✅ Adequate nutrition for baby\n✅ Morning blood sugar focus\n\n**Foods I'll Recommend:**\n• Complex carbs in moderation\n• Protein at every meal\n• Greek yogurt, nuts, seeds\n• Plenty of vegetables\n• Whole grains (small portions)\n\n**Foods I'll Avoid:**\n• Simple sugars\n• Fruit juice\n• Large portions of carbs\n• Skipping meals\n\nI'll ensure adequate nutrition for you and baby!\n\nWhat's your dietary preference?`,
        guidelines: {
          maxCarbsPerMeal: 45,
          minFiberPerMeal: 8,
          maxGlycemicIndex: 55,
          emphasis: ['frequent-meals', 'protein-pairing', 'baby-nutrition']
        }
      },
      prediabetes: {
        summary: `I've prepared guidelines for Pre-Diabetes management:\n\n**Key Principles:**\n✅ Focus on preventing progression\n✅ Moderate carbohydrate intake\n✅ Weight management support\n✅ Increase fiber intake\n✅ Regular meal timing\n\n**Foods I'll Recommend:**\n• Whole grains over refined\n• Lots of vegetables\n• Lean proteins\n• Healthy fats\n• Low-GI fruits\n\n**Foods I'll Avoid:**\n• Sugary drinks and snacks\n• Refined carbohydrates\n• Processed foods\n• Large portions\n\nLet's find delicious meals that help prevent progression!\n\nWhat's your dietary preference?`,
        guidelines: {
          maxCarbsPerMeal: 50,
          minFiberPerMeal: 8,
          maxGlycemicIndex: 60,
          emphasis: ['prevention', 'weight-management', 'fiber-rich']
        }
      }
    };
    
    return guidelines[typeId] || guidelines.type2;
  };
  
  // Handle dietary preference selection
  const handleDietaryPrefSelect = (prefId, prefLabel) => {
    const previousPref = selectedDietaryPref;
    setSelectedDietaryPref(prefId);
    const pref = FOOD_PREFERENCES.find(p => p.id === prefId);
    
    // If we're already showing recipes and preference changed, regenerate recipes
    if (flowStep === 'recipes' && previousPref !== prefId && selectedCuisines.length > 0) {
      const userMsg = {
        role: 'user',
        content: `I'd like to change to ${pref?.label} recipes please`,
        timestamp: new Date().toISOString()
      };
      
      const aiMsg = {
        role: 'assistant',
        content: `Switching to ${pref?.label} recipes! 🍽️ Let me find some delicious diabetes-friendly options for you...`,
        timestamp: new Date().toISOString(),
        isLoading: true
      };
      
      setMessages(prev => [...prev, userMsg, aiMsg]);
      fetchRecipesWithParams(selectedCuisines, prefId, selectedMealType);
      return;
    }
    
    // Normal flow - first time selecting
    const userMsg = {
      role: 'user',
      content: `I'm ${pref?.label}`,
      timestamp: new Date().toISOString()
    };
    
    const aiMsg = {
      role: 'assistant',
      content: `Perfect! ${pref?.label} diets can work great for diabetes management.\n\nWhat meal are you planning?`,
      timestamp: new Date().toISOString(),
      showMealTypeSelector: true
    };
    
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setFlowStep('mealType');
  };
  
  // Handle meal type selection
  const handleMealTypeSelect = (mealTypeId) => {
    setSelectedMealType(mealTypeId);
    const mealType = MEAL_TYPES.find(m => m.id === mealTypeId);
    
    const userMsg = {
      role: 'user',
      content: `I'm planning ${mealType?.label.toLowerCase()}`,
      timestamp: new Date().toISOString()
    };
    
    const aiMsg = {
      role: 'assistant',
      content: `${mealType?.emoji} Great choice!\n\nWould you like specific cuisines, or shall I surprise you with diabetes-friendly options from around the world?`,
      timestamp: new Date().toISOString(),
      showCuisineSelector: true
    };
    
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setFlowStep('cuisine');
  };
  
  // Handle cuisine selection
  const handleCuisineSelect = async (cuisineIds, cuisineLabels) => {
    setSelectedCuisines(cuisineIds);
    
    const userMsg = {
      role: 'user',
      content: cuisineIds.includes('any') 
        ? `Surprise me!` 
        : `I'd like ${cuisineLabels}`,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setFlowStep('recipes');
    
    await fetchDiabetesRecipes(cuisineIds);
  };
  
  // Handle meal type change from dropdown (after recipes are shown)
  const handleMealTypeChange = async (mealTypeId) => {
    const previousMealType = selectedMealType;
    if (mealTypeId === previousMealType) return;
    
    const newMealType = MEAL_TYPES.find(m => m.id === mealTypeId);
    setSelectedMealType(mealTypeId);
    
    if (flowStep === 'recipes' && selectedCuisines.length > 0) {
      const userMsg = {
        role: 'user',
        content: `I'd like ${newMealType?.label?.toLowerCase()} recipes instead`,
        timestamp: new Date().toISOString()
      };
      
      const aiMsg = {
        role: 'assistant',
        content: `Switching to ${newMealType?.label} recipes! ${newMealType?.emoji} Let me find some delicious diabetes-friendly options...`,
        timestamp: new Date().toISOString(),
        isLoading: true
      };
      
      setMessages(prev => [...prev, userMsg, aiMsg]);
      await fetchRecipesWithParams(selectedCuisines, selectedDietaryPref, mealTypeId);
    }
  };
  
  // Handle cuisine change from dropdown (after recipes are shown)
  const handleCuisineChange = async (cuisineId) => {
    if (selectedCuisines.includes(cuisineId) && selectedCuisines.length === 1) return;
    
    const newCuisine = CUISINES.find(c => c.id === cuisineId);
    setSelectedCuisines([cuisineId]);
    
    if (flowStep === 'recipes' || flowStep === 'cuisine_changed') {
      const userMsg = {
        role: 'user',
        content: `I'd like ${newCuisine?.label} recipes instead`,
        timestamp: new Date().toISOString()
      };
      
      const aiMsg = {
        role: 'assistant',
        content: `Switching to ${newCuisine?.label} cuisine! ${newCuisine?.flag} Let me find some delicious diabetes-friendly options...`,
        timestamp: new Date().toISOString(),
        isLoading: true
      };
      
      setMessages(prev => [...prev, userMsg, aiMsg]);
      setFlowStep('recipes');
      await fetchRecipesWithParams([cuisineId], selectedDietaryPref, selectedMealType);
    }
  };
  
  // Generic recipe fetch with specific params (used when any preference changes)
  const fetchRecipesWithParams = async (cuisineIds, dietaryPrefId, mealTypeId) => {
    setIsLoading(true);
    
    const mood = MOOD_IMAGES.find(m => m.id === selectedMood);
    const diabetesType = DIABETES_TYPES.find(t => t.id === selectedDiabetesType);
    const mealType = MEAL_TYPES.find(m => m.id === mealTypeId);
    const dietaryPref = FOOD_PREFERENCES.find(p => p.id === dietaryPrefId);
    
    const cuisineArray = Array.isArray(cuisineIds) ? cuisineIds : [cuisineIds];
    const cuisineLabels = cuisineArray.includes('any') || cuisineArray.length === 0
      ? 'any cuisine' 
      : cuisineArray.map(id => CUISINES.find(c => c.id === id)?.label).filter(Boolean).join(', ');
    
    try {
      const response = await axios.post(`${API}/diabetes/recipes`, {
        session_id: sessionId,
        mood: mood?.label,
        mood_description: mood?.description,
        diabetes_type: selectedDiabetesType,
        diabetes_label: diabetesType?.label,
        dietary_pref: dietaryPref?.label,
        meal_type: mealType?.label,
        cuisines: cuisineLabels,
        guidelines: diabetesResearch?.guidelines
      });
      
      const aiMsg = {
        role: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp || new Date().toISOString(),
        isDiabetesRecipes: true,
        structuredRecipes: response.data.structured_recipes
      };
      
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        return [...filtered, aiMsg];
      });
    } catch (error) {
      console.error('Error fetching diabetes recipes:', error);
      toast.error('Failed to get recipes. Please try again.');
      
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        return [...filtered, {
          role: 'assistant',
          content: `I'm sorry, I had trouble finding recipes. Let me try again...`,
          timestamp: new Date().toISOString(),
          showRetryButton: true
        }];
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch diabetes-safe recipes
  const fetchDiabetesRecipes = async (cuisineIds) => {
    setIsLoading(true);
    
    console.log('fetchDiabetesRecipes called with cuisineIds:', cuisineIds);
    console.log('Current selectedCuisines state:', selectedCuisines);
    
    const mood = MOOD_IMAGES.find(m => m.id === selectedMood);
    const diabetesType = DIABETES_TYPES.find(t => t.id === selectedDiabetesType);
    const mealType = MEAL_TYPES.find(m => m.id === selectedMealType);
    const dietaryPref = FOOD_PREFERENCES.find(p => p.id === selectedDietaryPref);
    
    // Ensure cuisineIds is an array
    const cuisineArray = Array.isArray(cuisineIds) ? cuisineIds : [cuisineIds];
    const cuisineLabels = cuisineArray.includes('any') || cuisineArray.length === 0
      ? 'any cuisine' 
      : cuisineArray.map(id => CUISINES.find(c => c.id === id)?.label).filter(Boolean).join(', ');
    
    console.log('Sending cuisine labels to backend:', cuisineLabels);
    
    try {
      const response = await axios.post(`${API}/diabetes/recipes`, {
        session_id: sessionId,
        mood: mood?.label,
        mood_description: mood?.description,
        diabetes_type: selectedDiabetesType,
        diabetes_label: diabetesType?.label,
        dietary_pref: dietaryPref?.label,
        meal_type: mealType?.label,
        cuisines: cuisineLabels,
        guidelines: diabetesResearch?.guidelines
      });
      
      const aiMsg = {
        role: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp || new Date().toISOString(),
        isDiabetesRecipes: true
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Error fetching diabetes recipes:', error);
      toast.error('Failed to get recipes. Please try again.');
      
      const errorMsg = {
        role: 'assistant',
        content: `I'm sorry, I had trouble finding recipes. Let me try again...`,
        timestamp: new Date().toISOString(),
        showRetryButton: true
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle free-form message
  const sendMessage = async (messageText) => {
    if (!messageText.trim() || isLoading) return;
    
    const userMsg = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);
    
    try {
      const response = await axios.post(`${API}/diabetes/chat`, {
        session_id: sessionId,
        message: messageText,
        context: {
          mood: selectedMood,
          diabetesType: selectedDiabetesType,
          dietaryPref: selectedDietaryPref,
          mealType: selectedMealType,
          cuisines: selectedCuisines
        }
      });
      
      // Check if mood change was detected
      if (response.data.mood_change_detected && response.data.new_mood) {
        setSelectedMood(response.data.new_mood);
        toast.success(`Mood updated to ${response.data.new_mood}!`);
      }
      
      const aiMsg = {
        role: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp || new Date().toISOString(),
        // Show mood selector if mood changed so user can regenerate recipes
        showMoodChange: response.data.mood_change_detected,
        // Store the current cuisines so we can use them when regenerating
        previousCuisines: response.data.mood_change_detected ? [...selectedCuisines] : undefined,
        // Include structured recipes from backend
        structuredRecipes: response.data.structured_recipes
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', error.response?.data || error.message);
      toast.error(error.response?.data?.detail || 'Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  // Start new conversation
  const handleNewConversation = () => {
    // Remove user-specific storage
    const storageKey = getDiabetesStorageKey(user?.id);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
    setSessionId(`diabetes-session-${Date.now()}`);
    setMessages([{
      role: 'assistant',
      content: `Welcome to Diabetes-Friendly Meals! 🩺\n\nI'm here to help you find delicious meals that support your blood sugar control while matching your mood.\n\nLet's start by understanding how you're feeling today:`,
      timestamp: new Date().toISOString(),
      showMoodSelector: true
    }]);
    setFlowStep('mood');
    setSelectedMood(null);
    setSelectedDiabetesType(null);
    setDiabetesResearch(null);
    setSelectedDietaryPref(null);
    setSelectedMealType(null);
    setSelectedCuisines([]);
  };
  
  // Save recipe
  const confirmSaveRecipe = async () => {
    if (!recipeToSave) return;
    
    try {
      await axios.post(`${API}/recipes/save`, { recipe: recipeToSave });
      toast.success('Recipe saved to your collection!');
      setShowRecipeDialog(false);
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error('Failed to save recipe');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" data-testid="diabetes-loading">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <>
      <div className="min-h-screen pt-20 pb-6 px-4 sm:px-6 lg:px-8" data-testid="diabetes-meals-page">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-serif font-bold flex items-center gap-3" data-testid="diabetes-title">
                  <Activity className="text-primary" />
                  MOOD FOOD
                </h1>
                <p className="text-primary font-medium text-sm mt-1">When Feelings Need Feeding</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Diabetes-friendly recipes tailored to how you feel
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/')}
                  className="rounded-full"
                  data-testid="home-button"
                >
                  <Home size={16} className="mr-1" />
                  Home
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewConversation}
                  className="rounded-full"
                  data-testid="new-chat-button"
                >
                  New Chat
                </Button>
              </div>
            </div>
            
            {/* Medical Disclaimer Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
              <AlertCircle className="text-amber-600 mt-0.5 flex-shrink-0" size={18} />
              <p className="text-xs text-amber-800">
                <strong>Important:</strong> This app provides general dietary guidance. Always consult your healthcare provider before making dietary changes. Individual needs vary based on medications and health conditions.
              </p>
            </div>
            
            {/* Current selections indicator with dropdowns for meal type and cuisine */}
            {(selectedMood || selectedDiabetesType || selectedDietaryPref) && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {selectedMood && (
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium" data-testid="mood-indicator">
                    <img src={MOOD_IMAGES.find(m => m.id === selectedMood)?.image} alt="" className="w-4 h-4 inline rounded-full mr-1" /> {MOOD_IMAGES.find(m => m.id === selectedMood)?.label}
                  </span>
                )}
                {selectedDiabetesType && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium" data-testid="diabetes-type-indicator">
                    {DIABETES_TYPES.find(t => t.id === selectedDiabetesType)?.icon} {DIABETES_TYPES.find(t => t.id === selectedDiabetesType)?.label}
                  </span>
                )}
                {selectedDietaryPref && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-medium hover:bg-green-200 transition-colors cursor-pointer flex items-center gap-1 border border-green-200"
                        data-testid="dietary-indicator"
                      >
                        🍽️ {FOOD_PREFERENCES.find(p => p.id === selectedDietaryPref)?.label}
                        <RefreshCw size={12} className="ml-1 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Change Dietary Preference</div>
                      {FOOD_PREFERENCES.map((pref) => {
                        const Icon = pref.icon;
                        return (
                          <DropdownMenuItem 
                            key={pref.id}
                            onClick={() => handleDietaryPrefSelect(pref.id, pref.label)}
                            className={`cursor-pointer ${selectedDietaryPref === pref.id ? 'bg-green-50' : ''}`}
                          >
                            <Icon size={16} className="mr-2" />
                            {pref.label}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {selectedMealType && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-full text-xs font-medium hover:bg-secondary/80 transition-colors cursor-pointer flex items-center gap-1 border border-border"
                        data-testid="meal-type-indicator"
                      >
                        {MEAL_TYPES.find(m => m.id === selectedMealType)?.emoji} {MEAL_TYPES.find(m => m.id === selectedMealType)?.label}
                        <RefreshCw size={12} className="ml-1 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Change Meal Type</div>
                      {MEAL_TYPES.map((meal) => (
                        <DropdownMenuItem 
                          key={meal.id}
                          onClick={() => handleMealTypeChange(meal.id)}
                          className={`cursor-pointer ${selectedMealType === meal.id ? 'bg-secondary' : ''}`}
                        >
                          <span className="mr-2">{meal.emoji}</span>
                          {meal.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {selectedCuisines.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium hover:bg-orange-200 transition-colors cursor-pointer flex items-center gap-1 border border-orange-200"
                        data-testid="cuisine-indicator"
                      >
                        🌍 {selectedCuisines.includes('any') ? 'Any Cuisine' : selectedCuisines.map(id => CUISINES.find(c => c.id === id)?.label).join(', ')}
                        <RefreshCw size={12} className="ml-1 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 max-h-64 overflow-y-auto">
                      <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Change Cuisine</div>
                      {CUISINES.map((cuisine) => (
                        <DropdownMenuItem 
                          key={cuisine.id}
                          onClick={() => handleCuisineChange(cuisine.id)}
                          className={`cursor-pointer ${selectedCuisines.includes(cuisine.id) ? 'bg-orange-50' : ''}`}
                        >
                          <span className="mr-2">{cuisine.flag}</span>
                          {cuisine.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
          
          {/* Exclusions Banner */}
          {userExclusions.length > 0 && showExclusionsBanner && (
            <div className="mb-4 p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center justify-between" data-testid="diabetes-exclusions-banner">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-600 dark:text-amber-400" />
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Excluding:</strong> {userExclusions.slice(0, 3).map(e => e.name).join(', ')}
                  {userExclusions.length > 3 && ` +${userExclusions.length - 3} more`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/profile">
                  <Button variant="ghost" size="sm" className="text-amber-700 dark:text-amber-300 h-7 px-2">
                    <Settings size={14} className="mr-1" />
                    Edit
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExclusionsBanner(false)}
                  className="text-amber-700 dark:text-amber-300 h-7 px-2"
                >
                  Hide
                </Button>
              </div>
            </div>
          )}

          {/* Messages Container */}
          <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-6 mb-6 min-h-[400px] max-h-[60vh] overflow-y-auto" data-testid="diabetes-messages-container">
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx}>
                  <div
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    data-testid={`message-${msg.role}-${idx}`}
                  >
                    <div
                      className={`message-bubble ${msg.role === 'user' ? 'max-w-[80%]' : 'max-w-[95%] w-full'} rounded-2xl px-5 py-4 ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : msg.isResearching
                          ? 'bg-blue-50 text-blue-900 rounded-bl-sm border border-blue-200'
                          : msg.researchComplete
                          ? 'bg-green-50 text-green-900 rounded-bl-sm border border-green-200'
                          : 'bg-secondary/50 text-secondary-foreground rounded-bl-sm'
                      }`}
                    >
                      {/* Research loading indicator */}
                      {msg.isResearching && (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Search className="animate-pulse" size={20} />
                            <Loader2 className="animate-spin" size={18} />
                          </div>
                          <div>
                            <p className="font-medium">{msg.content}</p>
                            <p className="text-xs mt-1 opacity-70">Searching medical databases and dietary guidelines...</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Research complete indicator */}
                      {msg.researchComplete && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="text-green-600" size={20} />
                            <span className="font-medium text-green-700">Research Complete</span>
                          </div>
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      )}
                      
                      {/* Recipe display for AI messages */}
                      {msg.role === 'assistant' && !msg.isResearching && !msg.researchComplete && (hasRecipes(msg.content) || msg.structuredRecipes) ? (
                        <RecipeMessageDisplay 
                          message={msg.content}
                          structuredRecipes={msg.structuredRecipes}
                          onSaveRecipe={(recipe) => {
                            setRecipeToSave({
                              title: recipe.title,
                              description: recipe.description,
                              ingredients: recipe.ingredients || ['See recipe details'],
                              instructions: ['See recipe details'],
                              mood_tags: [selectedMood || 'diabetes-friendly'],
                              prep_time: recipe.cookingTime || '30 min',
                              cook_time: recipe.cookingTime || '30 min',
                              complexity: recipe.difficulty?.toLowerCase() || 'medium',
                              nutritional_highlights: 'Diabetes-friendly, blood sugar safe',
                              dietary_info: [selectedDietaryPref, 'diabetes-safe'],
                              image_url: recipe.imageUrl,
                              cuisine_type: recipe.cuisineHint,
                              diabetes_info: {
                                type: selectedDiabetesType,
                                bloodSugarSafe: true
                              }
                            });
                            setShowRecipeDialog(true);
                          }}
                        />
                      ) : !msg.isResearching && !msg.researchComplete ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : null}
                    </div>
                  </div>
                  
                  {/* Interactive selectors */}
                  {msg.showMoodSelector && flowStep === 'mood' && (
                    <div className="mt-4 ml-2">
                      <MoodCarousel 
                        onSelect={handleMoodSelect}
                        selectedMood={selectedMood}
                      />
                    </div>
                  )}
                  
                  {msg.showDiabetesTypeSelector && flowStep === 'diabetesType' && (
                    <div className="mt-4 ml-2">
                      <DiabetesTypeSelector 
                        onSelect={handleDiabetesTypeSelect}
                        selectedType={selectedDiabetesType}
                        disabled={isResearching}
                      />
                    </div>
                  )}
                  
                  {msg.showDietarySelector && flowStep === 'dietaryPref' && (
                    <div className="mt-4 ml-2">
                      <FoodPreferenceSelector 
                        onSelect={handleDietaryPrefSelect}
                        selectedPreference={selectedDietaryPref}
                      />
                    </div>
                  )}
                  
                  {msg.showMealTypeSelector && flowStep === 'mealType' && (
                    <div className="mt-4 ml-2">
                      <MealTypeSelector 
                        onSelect={handleMealTypeSelect}
                        selectedMealType={selectedMealType}
                      />
                    </div>
                  )}
                  
                  {msg.showCuisineSelector && flowStep === 'cuisine' && (
                    <div className="mt-4 ml-2">
                      <CuisineSelector 
                        onSelect={handleCuisineSelect}
                        selectedCuisines={selectedCuisines}
                        allowMultiple={true}
                      />
                    </div>
                  )}
                  
                  {msg.showRetryButton && (
                    <div className="mt-4 ml-2">
                      <Button
                        onClick={() => fetchDiabetesRecipes(selectedCuisines)}
                        className="rounded-full"
                        data-testid="retry-button"
                      >
                        Try Again
                      </Button>
                    </div>
                  )}
                  
                  {/* Show Recipes button when mood changes */}
                  {msg.showMoodChange && (
                    <div className="mt-4 ml-2">
                      <Button
                        onClick={() => {
                          // Use the cuisines that were stored with the message, or fall back to selected
                          const cuisinesToUse = msg.previousCuisines && msg.previousCuisines.length > 0 
                            ? msg.previousCuisines 
                            : (selectedCuisines.length > 0 ? selectedCuisines : ['any']);
                          console.log('Button clicked - previousCuisines:', msg.previousCuisines);
                          console.log('Button clicked - selectedCuisines:', selectedCuisines);
                          console.log('Button clicked - using cuisines:', cuisinesToUse);
                          fetchDiabetesRecipes(cuisinesToUse);
                        }}
                        className="rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600"
                        data-testid="show-recipes-mood-change"
                      >
                        <Sparkles className="mr-2" size={18} />
                        Show {msg.previousCuisines && msg.previousCuisines.length > 0 && !msg.previousCuisines.includes('any') 
                          ? `${msg.previousCuisines.map(id => CUISINES.find(c => c.id === id)?.label || id).join(', ')} ` 
                          : ''}Recipes for New Mood
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && !isResearching && (
                <div className="flex justify-start" data-testid="loading-indicator">
                  <div className="bg-secondary rounded-2xl rounded-bl-sm px-5 py-3 flex items-center gap-2">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Finding diabetes-friendly recipes...</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* Input Form */}
          {(flowStep === 'recipes' || messages.some(m => hasRecipes(m.content))) && (
            <form onSubmit={handleSubmit} className="flex gap-3 items-end" data-testid="diabetes-message-form">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about nutrition, alternatives, or request more recipes..."
                className="flex-1 rounded-2xl resize-none min-h-[60px] max-h-[120px] bg-card border-border/60 focus:border-primary"
                disabled={isLoading}
                data-testid="diabetes-message-input"
              />
              <Button
                type="submit"
                size="lg"
                disabled={isLoading || !inputMessage.trim()}
                className="rounded-full px-6 bg-primary hover:bg-primary/90"
                data-testid="diabetes-send-button"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={22} />
                ) : (
                  <Send size={22} />
                )}
              </Button>
            </form>
          )}
          
          {/* Bottom Disclaimer */}
          <div className="mt-4 p-3 bg-muted/30 rounded-xl">
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              Nutritional information is approximate. Individual blood sugar responses vary. Test 2 hours after eating to see how meals affect you. Consult your healthcare team about portion sizes appropriate for you.
            </p>
          </div>
        </div>
      </div>
      
      {/* Save Recipe Dialog */}
      <Dialog open={showRecipeDialog} onOpenChange={setShowRecipeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Recipe</DialogTitle>
          </DialogHeader>
          <p className="mb-4">Save &quot;{recipeToSave?.title}&quot; to your collection?</p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowRecipeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSaveRecipe}>
              <Heart size={16} className="mr-2" />
              Save Recipe
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Feature Locked Modal */}
      <FeatureLockedModal
        isOpen={featureLockedModal.isOpen}
        onClose={() => setFeatureLockedModal(prev => ({ ...prev, isOpen: false }))}
        feature={featureLockedModal.feature}
        upgradeTo={featureLockedModal.upgradeTo}
        currentPlan={featureLockedModal.currentPlan}
      />
    </>
  );
};

// Diabetes Type Selector Component
const DiabetesTypeSelector = ({ onSelect, selectedType, disabled }) => {
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="diabetes-type-selector">
      {DIABETES_TYPES.map((type) => (
        <button
          key={type.id}
          onClick={() => !disabled && onSelect(type.id)}
          disabled={disabled}
          className={`p-4 rounded-xl border-2 transition-all text-left ${
            selectedType === type.id
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          data-testid={`diabetes-type-${type.id}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{type.icon}</span>
            <span className="font-medium text-sm">{type.label}</span>
          </div>
          <p className="text-xs text-muted-foreground">{type.description}</p>
        </button>
      ))}
    </div>
  );
};

export default DiabetesMealsPage;
