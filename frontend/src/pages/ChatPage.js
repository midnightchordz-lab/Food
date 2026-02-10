import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Heart, BookOpen, Home, RefreshCw, Sparkles, AlertCircle, Settings } from 'lucide-react';
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

// Chat state persistence key - will be made user-specific
const CHAT_STORAGE_KEY_PREFIX = 'moodfood_chat_state_';

const getChatStorageKey = (userId) => {
  return userId ? `${CHAT_STORAGE_KEY_PREFIX}${userId}` : null;
};

const ChatPage = () => {
  // Core state
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(`session-${Date.now()}`);
  
  // Recipe dialog state
  const [showRecipeDialog, setShowRecipeDialog] = useState(false);
  const [recipeToSave, setRecipeToSave] = useState(null);
  
  // Feature lock modal state
  const [featureLockedModal, setFeatureLockedModal] = useState({
    isOpen: false,
    feature: '',
    upgradeTo: '',
    currentPlan: '',
    usedLimit: 0,
    maxLimit: 0
  });
  
  // Flow state - tracks where user is in the conversation
  const [flowStep, setFlowStep] = useState('greeting'); // greeting, mood, mealType, dietaryPref, cuisine, recipes
  const [selectedMood, setSelectedMood] = useState(null);
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [selectedDietaryPref, setSelectedDietaryPref] = useState(null);
  const [selectedCuisines, setSelectedCuisines] = useState([]);
  
  // Food exclusions state
  const [userExclusions, setUserExclusions] = useState([]);
  const [showExclusionsBanner, setShowExclusionsBanner] = useState(true);
  
  // Track previous user to detect user changes
  const [previousUserId, setPreviousUserId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  
  // Scroll to bottom when messages change
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
      console.log('User changed, clearing chat state');
      setMessages([]);
      setFlowStep('greeting');
      setSelectedMood(null);
      setSelectedMealType(null);
      setSelectedDietaryPref(null);
      setSelectedCuisines([]);
      setSessionId(`session-${Date.now()}`);
      setUserExclusions([]);
    }
    if (user?.id) {
      setPreviousUserId(user.id);
    }
  }, [user?.id, previousUserId]);
  
  // Save chat state to localStorage for persistence (user-specific)
  useEffect(() => {
    if (messages.length > 0 && user?.id) {
      const storageKey = getChatStorageKey(user.id);
      if (storageKey) {
        const stateToSave = {
          sessionId,
          messages,
          flowStep,
          selectedMood,
          selectedMealType,
          selectedDietaryPref,
          selectedCuisines,
          timestamp: Date.now()
        };
        localStorage.setItem(storageKey, JSON.stringify(stateToSave));
      }
    }
  }, [messages, flowStep, selectedMood, selectedMealType, selectedDietaryPref, selectedCuisines, sessionId, user?.id]);
  
  // Load saved chat state on mount (user-specific)
  useEffect(() => {
    // Wait for auth loading to complete
    if (loading) {
      return;
    }
    
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    // Try to restore previous chat state for THIS user
    const storageKey = getChatStorageKey(user?.id);
    if (storageKey) {
      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          // Only restore if less than 24 hours old
          if (parsed.timestamp && (Date.now() - parsed.timestamp) < 24 * 60 * 60 * 1000) {
            if (parsed.messages && parsed.messages.length > 0) {
              setMessages(parsed.messages);
              setFlowStep(parsed.flowStep || 'greeting');
              setSelectedMood(parsed.selectedMood);
              setSelectedMealType(parsed.selectedMealType);
              setSelectedDietaryPref(parsed.selectedDietaryPref);
              setSelectedCuisines(parsed.selectedCuisines || []);
              if (parsed.sessionId) {
                setSessionId(parsed.sessionId);
              }
              return;
            }
          }
        } catch (e) {
          console.error('Error parsing saved chat state:', e);
        }
      }
    }
    
    // Show initial greeting with mood selector
    setMessages([{
      role: 'assistant',
      content: `Hi${user?.name ? ` ${user.name}` : ''}! 👋\n\nWelcome to MOOD FOOD! I'm here to suggest delicious meals that match your mood, preferences, and cravings.\n\nLet's start by understanding how you're feeling today:`,
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
    
    // Add user's mood as a message
    const userMsg = {
      role: 'user',
      content: `I'm feeling ${moodLabel.toLowerCase()} today`,
      timestamp: new Date().toISOString()
    };
    
    // AI response asking for meal type
    const mood = MOOD_IMAGES.find(m => m.id === moodId);
    const aiMsg = {
      role: 'assistant',
      content: `${moodLabel}! ${moodDescription}\n\nPerfect! Let's find some delicious meals to match that mood.\n\nWhat meal are you planning?`,
      timestamp: new Date().toISOString(),
      showMealTypeSelector: true,
      moodImage: mood?.image
    };
    
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setFlowStep('mealType');
  };
  
  // Handle meal type selection
  const handleMealTypeSelect = (mealTypeId, mealTypeLabel) => {
    setSelectedMealType(mealTypeId);
    
    const userMsg = {
      role: 'user',
      content: `I'm looking for ${mealTypeLabel.toLowerCase()}`,
      timestamp: new Date().toISOString()
    };
    
    // Check if user has dietary preference saved
    const savedPref = user?.dietary_preferences || null;
    
    let aiMsg;
    if (savedPref) {
      // Confirm saved preference
      const prefLabel = FOOD_PREFERENCES.find(p => p.id === savedPref)?.label || savedPref;
      aiMsg = {
        role: 'assistant',
        content: `Great choice for ${mealTypeLabel.toLowerCase()}! 🍽️\n\nJust to confirm, you're ${prefLabel}, right?`,
        timestamp: new Date().toISOString(),
        showDietaryConfirm: true,
        savedPref: savedPref
      };
      setSelectedDietaryPref(savedPref);
    } else {
      // Ask for dietary preference
      aiMsg = {
        role: 'assistant',
        content: `Great choice for ${mealTypeLabel.toLowerCase()}! 🍽️\n\nWhat's your dietary preference?`,
        timestamp: new Date().toISOString(),
        showDietarySelector: true
      };
    }
    
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setFlowStep('dietaryPref');
  };
  
  // Handle dietary preference selection
  const handleDietaryPrefSelect = (prefId, prefLabel) => {
    const previousPref = selectedDietaryPref;
    setSelectedDietaryPref(prefId);
    
    // If we're already showing recipes and preference changed, regenerate recipes
    if (flowStep === 'recipes' && previousPref !== prefId && selectedCuisines.length > 0) {
      const userMsg = {
        role: 'user',
        content: `I'd like to change to ${prefLabel} recipes please`,
        timestamp: new Date().toISOString()
      };
      
      const aiMsg = {
        role: 'assistant',
        content: `Switching to ${prefLabel} recipes! 🍽️ Let me find some delicious options for you...`,
        timestamp: new Date().toISOString(),
        isLoading: true
      };
      
      setMessages(prev => [...prev, userMsg, aiMsg]);
      
      // Trigger recipe fetch with the new dietary preference
      // Need to pass prefId directly since state update is async
      fetchRecipesWithDietary(selectedCuisines, prefId);
      return;
    }
    
    // Normal flow - first time selecting
    const userMsg = {
      role: 'user',
      content: `I prefer ${prefLabel} food`,
      timestamp: new Date().toISOString()
    };
    
    const aiMsg = {
      role: 'assistant',
      content: `${prefLabel} it is! 🌟\n\nNow, what cuisine are you in the mood for?`,
      timestamp: new Date().toISOString(),
      showCuisineSelector: true
    };
    
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setFlowStep('cuisine');
  };
  
  // Fetch recipes with specific dietary preference (used when preference changes)
  const fetchRecipesWithDietary = async (cuisineIds, dietaryPrefId) => {
    setIsLoading(true);
    
    const mood = MOOD_IMAGES.find(m => m.id === selectedMood);
    const mealType = MEAL_TYPES.find(m => m.id === selectedMealType);
    const dietaryPref = FOOD_PREFERENCES.find(p => p.id === dietaryPrefId);
    const cuisineLabels = cuisineIds.includes('any') 
      ? 'any cuisine' 
      : cuisineIds.map(id => CUISINES.find(c => c.id === id)?.label).join(', ');
    
    const enhancedMessage = `
[User Preferences]
- Mood: ${mood?.label} (${mood?.description})
- Meal Type: ${mealType?.label}
- Dietary Preference: ${dietaryPref?.label}
- Cuisine(s): ${cuisineLabels}

Create 6 ORIGINAL ${mealType?.label?.toLowerCase()} recipes that:
1. Match the ${mood?.label?.toLowerCase()} mood perfectly
2. Are ${dietaryPref?.label?.toLowerCase()} friendly
3. Feature authentic ${cuisineLabels} flavors and techniques
4. Have creative, appetizing names

For EACH recipe provide:
### [Creative Recipe Name] (XX min)
**Difficulty:** Easy/Medium/Hard
**Description:** 2-3 sentences describing the dish, its flavors, and why it matches the ${mood?.label?.toLowerCase()} mood.
**Key Ingredients:** List 4-6 main ingredients

Make each recipe name unique and appetizing - avoid generic names like "Vegetable Curry" or "Pasta Dish".
`;

    try {
      const response = await axios.post(`${API}/chat/send`, {
        session_id: sessionId,
        message: enhancedMessage
      });
      
      const aiMsg = {
        role: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp,
        structuredRecipes: response.data.structured_recipes
      };
      
      setMessages(prev => {
        // Remove the loading message we added
        const filtered = prev.filter(m => !m.isLoading);
        return [...filtered, aiMsg];
      });
    } catch (error) {
      console.error('Error fetching recipes:', error);
      
      // Check if it's a feature lock error (search limit reached)
      if (handleFeatureLockedError(error, setFeatureLockedModal)) {
        setMessages(prev => prev.filter(m => !m.isLoading));
      } else {
        toast.error('Failed to get recipes. Please try again.');
        
        setMessages(prev => {
          const filtered = prev.filter(m => !m.isLoading);
          return [...filtered, {
            role: 'assistant',
            content: `I'm sorry, I had trouble finding ${dietaryPref?.label} recipes. Let me try again...`,
            timestamp: new Date().toISOString(),
            showRetryButton: true
          }];
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle dietary confirmation
  const handleDietaryConfirm = (confirmed, savedPref) => {
    if (confirmed) {
      const prefLabel = FOOD_PREFERENCES.find(p => p.id === savedPref)?.label || savedPref;
      const userMsg = {
        role: 'user',
        content: `Yes, I'm ${prefLabel}`,
        timestamp: new Date().toISOString()
      };
      
      const aiMsg = {
        role: 'assistant',
        content: `Perfect! 🌟\n\nNow, what cuisine are you in the mood for?`,
        timestamp: new Date().toISOString(),
        showCuisineSelector: true
      };
      
      setMessages(prev => [...prev, userMsg, aiMsg]);
      setFlowStep('cuisine');
    } else {
      // Show dietary selector to change
      const userMsg = {
        role: 'user',
        content: `I'd like to change my preference`,
        timestamp: new Date().toISOString()
      };
      
      const aiMsg = {
        role: 'assistant',
        content: `No problem! What's your dietary preference today?`,
        timestamp: new Date().toISOString(),
        showDietarySelector: true
      };
      
      setSelectedDietaryPref(null);
      setMessages(prev => [...prev, userMsg, aiMsg]);
    }
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
        content: `Switching to ${newMealType?.label} recipes! ${newMealType?.emoji} Let me find some delicious options...`,
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
        content: `Switching to ${newCuisine?.label} cuisine! ${newCuisine?.flag} Let me find some delicious options...`,
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
    const mealType = MEAL_TYPES.find(m => m.id === mealTypeId);
    const dietaryPref = FOOD_PREFERENCES.find(p => p.id === dietaryPrefId);
    const cuisineLabels = cuisineIds.includes('any') 
      ? 'any cuisine' 
      : cuisineIds.map(id => CUISINES.find(c => c.id === id)?.label).join(', ');
    
    const enhancedMessage = `
[User Preferences]
- Mood: ${mood?.label} (${mood?.description})
- Meal Type: ${mealType?.label}
- Dietary Preference: ${dietaryPref?.label}
- Cuisine(s): ${cuisineLabels}

Create 6 ORIGINAL ${mealType?.label?.toLowerCase()} recipes that:
1. Match the ${mood?.label?.toLowerCase()} mood perfectly
2. Are ${dietaryPref?.label?.toLowerCase()} friendly
3. Feature authentic ${cuisineLabels} flavors and techniques
4. Have creative, appetizing names

For EACH recipe provide:
### [Creative Recipe Name] (XX min)
**Difficulty:** Easy/Medium/Hard
**Description:** 2-3 sentences describing the dish.
**Key Ingredients:** List 4-6 main ingredients
`;

    try {
      const response = await axios.post(`${API}/chat/send`, {
        session_id: sessionId,
        message: enhancedMessage
      });
      
      const aiMsg = {
        role: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp,
        structuredRecipes: response.data.structured_recipes
      };
      
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        return [...filtered, aiMsg];
      });
    } catch (error) {
      console.error('Error fetching recipes:', error);
      
      // Check if it's a feature locked error (recipe search limit)
      if (handleFeatureLockedError(error, setFeatureLockedModal)) {
        setMessages(prev => prev.filter(m => !m.isLoading));
        return;
      }
      
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
  
  // Handle cuisine selection (initial flow)
  const handleCuisineSelect = async (cuisineIds, cuisineLabels) => {
    setSelectedCuisines(cuisineIds);
    
    const userMsg = {
      role: 'user',
      content: cuisineIds.includes('any') 
        ? `Surprise me with something delicious!` 
        : `I'm in the mood for ${cuisineLabels}`,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setFlowStep('recipes');
    
    // Now fetch recipes
    await fetchRecipes(cuisineIds);
  };
  
  // Fetch recipes - AI-generated ORIGINAL recipes (authentic content)
  // Uses SerpAPI only for food images, not recipe content
  const fetchRecipes = async (cuisineIds) => {
    setIsLoading(true);
    
    const mood = MOOD_IMAGES.find(m => m.id === selectedMood);
    const mealType = MEAL_TYPES.find(m => m.id === selectedMealType);
    const dietaryPref = FOOD_PREFERENCES.find(p => p.id === selectedDietaryPref);
    const cuisineLabels = cuisineIds.includes('any') 
      ? 'any cuisine' 
      : cuisineIds.map(id => CUISINES.find(c => c.id === id)?.label).join(', ');
    
    // Enhanced prompt for high-quality, original AI recipes
    const enhancedMessage = `
[User Preferences]
- Mood: ${mood?.label} (${mood?.description})
- Meal Type: ${mealType?.label}
- Dietary Preference: ${dietaryPref?.label}
- Cuisine(s): ${cuisineLabels}

Create 6 ORIGINAL ${mealType?.label?.toLowerCase()} recipes that:
1. Match the ${mood?.label?.toLowerCase()} mood perfectly
2. Are ${dietaryPref?.label?.toLowerCase()} friendly
3. Feature authentic ${cuisineLabels} flavors and techniques
4. Have creative, appetizing names

For EACH recipe provide:
### [Creative Recipe Name] (XX min)
**Difficulty:** Easy/Medium/Hard
**Description:** 2-3 sentences describing the dish, its flavors, and why it matches the ${mood?.label?.toLowerCase()} mood.
**Key Ingredients:** List 4-6 main ingredients

Make each recipe name unique and appetizing - avoid generic names like "Vegetable Curry" or "Pasta Dish".
`;

    try {
      const response = await axios.post(`${API}/chat/send`, {
        session_id: sessionId,
        message: enhancedMessage
      });
      
      const aiMsg = {
        role: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp,
        structuredRecipes: response.data.structured_recipes
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      
      // Check if it's a feature lock error (search limit reached)
      if (!handleFeatureLockedError(error, setFeatureLockedModal)) {
        toast.error('Failed to get recipes. Please try again.');
        
        const errorMsg = {
          role: 'assistant',
          content: `I'm sorry, I had trouble creating recipes. Let me try again...`,
          timestamp: new Date().toISOString(),
          showRetryButton: true
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Detect mood from text
  const detectMoodFromText = (text) => {
    const moodKeywords = {
      happy: ['happy', 'joyful', 'cheerful', 'pleased', 'delighted', 'great', 'wonderful'],
      sad: ['sad', 'down', 'blue', 'melancholy', 'upset', 'depressed'],
      angry: ['angry', 'mad', 'furious', 'irritated', 'frustrated', 'annoyed'],
      excited: ['excited', 'thrilled', 'pumped', 'enthusiastic', 'hyped'],
      calm: ['calm', 'peaceful', 'relaxed', 'tranquil', 'serene', 'chill'],
      stressed: ['stressed', 'anxious', 'tense', 'overwhelmed', 'worried'],
      cozy: ['cozy', 'comfortable', 'snug', 'warm', 'content', 'homey'],
      romantic: ['romantic', 'loving', 'amorous', 'intimate'],
      energetic: ['energetic', 'lively', 'active', 'vibrant', 'dynamic']
    };
    
    const lowerText = text.toLowerCase();
    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return mood;
      }
    }
    return null;
  };
  
  // Detect cuisine from text
  const detectCuisineFromText = (text) => {
    const cuisineKeywords = {
      italian: ['italian', 'italy', 'pasta', 'pizza', 'risotto', 'lasagna', 'spaghetti'],
      indian: ['indian', 'india', 'curry', 'masala', 'biryani', 'tandoori', 'naan', 'dal'],
      mexican: ['mexican', 'mexico', 'taco', 'burrito', 'enchilada', 'quesadilla', 'salsa'],
      chinese: ['chinese', 'china', 'stir-fry', 'dim sum', 'kung pao', 'lo mein', 'wonton'],
      japanese: ['japanese', 'japan', 'sushi', 'ramen', 'teriyaki', 'tempura', 'miso', 'udon', 'katsu'],
      thai: ['thai', 'thailand', 'pad thai', 'green curry', 'red curry', 'tom yum', 'satay'],
      mediterranean: ['mediterranean', 'greek', 'hummus', 'falafel', 'shawarma', 'pita', 'tzatziki'],
      american: ['american', 'america', 'burger', 'bbq', 'barbecue', 'wings', 'mac and cheese'],
      korean: ['korean', 'korea', 'kimchi', 'bibimbap', 'bulgogi', 'korean bbq', 'gochujang'],
      vietnamese: ['vietnamese', 'vietnam', 'pho', 'banh mi', 'spring rolls', 'bun']
    };
    
    const lowerText = text.toLowerCase();
    const detectedCuisines = [];
    
    for (const [cuisine, keywords] of Object.entries(cuisineKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        detectedCuisines.push(cuisine);
      }
    }
    
    return detectedCuisines.length > 0 ? detectedCuisines : null;
  };
  
  // Handle mood change from user input
  const handleMoodChange = async (newMoodId) => {
    const mood = MOOD_IMAGES.find(m => m.id === newMoodId);
    const previousMood = MOOD_IMAGES.find(m => m.id === selectedMood);
    
    setSelectedMood(newMoodId);
    
    const userMsg = {
      role: 'user',
      content: `My mood has changed. I'm feeling ${mood?.label.toLowerCase()} now.`,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    
    try {
      const contextMessage = `[Context: Mood=${selectedMood || 'not set'}, MealType=${selectedMealType || 'not set'}, Dietary=${selectedDietaryPref || 'not set'}, Cuisines=${selectedCuisines.join(',') || 'not set'}]\n\nMy mood has changed from ${previousMood?.label || 'unknown'} to ${mood?.label}. I'm feeling ${mood?.label.toLowerCase()} now.`;
      
      const response = await axios.post(`${API}/chat/send`, {
        session_id: sessionId,
        message: contextMessage
      });
      
      const aiMsg = {
        role: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp,
        isMoodChange: true,
        showMoodChangeRecipeOption: true,
        newMood: newMoodId
      };
      setMessages(prev => [...prev, aiMsg]);
      
      // Keep in recipes flow step to allow getting new recipes
      setFlowStep('mood_changed');
    } catch (error) {
      console.error('Error handling mood change:', error);
      toast.error('Failed to process mood change');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Get new recipes for changed mood
  const getRecipesForNewMood = async () => {
    setFlowStep('recipes');
    await fetchRecipes(selectedCuisines);
  };
  
  // Get new recipes for changed cuisine (kept for backwards compatibility)
  const getRecipesForNewCuisine = async () => {
    setFlowStep('recipes');
    await fetchRecipes(selectedCuisines);
  };
  
  // Handle free-form message sending
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
      // Check if user is mentioning a mood change
      const lowerText = messageText.toLowerCase();
      // Check if user is mentioning a mood change or stating a new mood
      const moodChangeIndicators = [
        'mood has changed', 'mood changed', 'feeling different',
        'not in that mood', 'changed my mind', 'actually feeling',
        'now feeling', "i'm feeling", 'i feel', 'feeling now', 'feeling'
      ];
      
      // Check if user is mentioning a cuisine change
      const cuisineChangeIndicators = [
        'change cuisine', 'switch cuisine', 'different cuisine',
        'want to try', 'how about', 'let\'s try', 'switch to',
        'change to', 'prefer', 'in the mood for', 'craving',
        'want some', 'like some', 'give me', 'show me'
      ];
      
      const isMoodChange = moodChangeIndicators.some(indicator => lowerText.includes(indicator));
      const isCuisineChangeRequest = cuisineChangeIndicators.some(indicator => lowerText.includes(indicator));
      const detectedMoodFromUser = detectMoodFromText(messageText);
      const detectedCuisinesFromUser = detectCuisineFromText(messageText);
      
      // If user just types a mood word directly (like "cozy"), treat it as a mood change
      const isDirectMoodStatement = detectedMoodFromUser && messageText.trim().split(/\s+/).length <= 5;
      
      // Check if user is requesting a different cuisine
      const isCuisineChange = (isCuisineChangeRequest || detectedCuisinesFromUser) && 
                              detectedCuisinesFromUser && 
                              Array.isArray(detectedCuisinesFromUser) &&
                              detectedCuisinesFromUser.length > 0;
      
      // Update mood ONLY from user's message, never from AI response
      const shouldUpdateMood = (isMoodChange || isDirectMoodStatement) && detectedMoodFromUser;
      
      // If cuisine change detected, skip AI call and show clean transition
      if (isCuisineChange && !shouldUpdateMood) {
        // Update cuisines immediately
        setSelectedCuisines(detectedCuisinesFromUser);
        
        // Get cuisine labels for display
        const cuisineLabels = (detectedCuisinesFromUser || []).map(c => {
          const cuisine = CUISINES.find(cu => cu.id === c);
          return cuisine?.label || c;
        }).join(', ') || 'new';
        
        // Create a clean acknowledgment message (no recipe text)
        const aiMsg = {
          role: 'assistant',
          content: `Great choice! I'll find you some delicious ${cuisineLabels} recipes. 🍽️`,
          timestamp: new Date().toISOString(),
          isCuisineChange: true,
          showCuisineChangeRecipeOption: selectedMealType && selectedDietaryPref,
          newCuisines: detectedCuisinesFromUser
        };
        setMessages(prev => [...prev, aiMsg]);
        setFlowStep('cuisine_changed');
        setIsLoading(false);
        return;
      }
      
      // Include context in the message
      let contextMessage = messageText;
      if (selectedMood || selectedMealType || selectedDietaryPref) {
        contextMessage = `[Context: Mood=${selectedMood || 'not set'}, MealType=${selectedMealType || 'not set'}, Dietary=${selectedDietaryPref || 'not set'}, Cuisines=${selectedCuisines.join(',') || 'not set'}]\n\n${messageText}`;
      }
      
      const response = await axios.post(`${API}/chat/send`, {
        session_id: sessionId,
        message: contextMessage
      });
      
      // Check if the response indicates a mood change acknowledgment
      const responseText = response.data.response.toLowerCase();
      const isAIMoodChangeResponse = responseText.includes('mood has shifted') || 
                                      responseText.includes('mood has changed') ||
                                      (responseText.includes("you're feeling") && responseText.includes('looking for'));
      
      // Update mood if detected from user's message
      if (shouldUpdateMood) {
        const newMoodObj = MOOD_IMAGES.find(m => m.id === detectedMoodFromUser);
        if (newMoodObj) {
          setSelectedMood(detectedMoodFromUser);
        }
      }
      
      const aiMsg = {
        role: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp,
        // Mood change tracking
        isMoodChange: isMoodChange || isDirectMoodStatement || isAIMoodChangeResponse,
        showMoodChangeRecipeOption: (shouldUpdateMood || isAIMoodChangeResponse) && selectedMealType && selectedDietaryPref,
        newMood: detectedMoodFromUser
      };
      setMessages(prev => [...prev, aiMsg]);
      
      // Update flow step if mood changed
      if (shouldUpdateMood) {
        setFlowStep('mood_changed');
      }
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
    // Remove user-specific chat storage
    const storageKey = getChatStorageKey(user?.id);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
    setSessionId(`session-${Date.now()}`);
    setMessages([{
      role: 'assistant',
      content: `Hi${user?.name ? ` ${user.name}` : ''}! 👋\n\nLet's find you some delicious meals!\n\nHow are you feeling today?`,
      timestamp: new Date().toISOString(),
      showMoodSelector: true
    }]);
    setFlowStep('mood');
    setSelectedMood(null);
    setSelectedMealType(null);
    setSelectedDietaryPref(null);
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
  
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <>
      <div className="min-h-screen pt-20 pb-6 px-4 sm:px-6 lg:px-8" data-testid="chat-page">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-serif font-bold" data-testid="chat-title">
                  MOOD FOOD
                </h1>
                <p className="text-primary text-sm mt-1 font-medium">
                  When Feelings Need Feeding
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
            
            {/* Current selections indicator with mood change option */}
            {(selectedMood || selectedMealType || selectedDietaryPref) && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {selectedMood && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium hover:bg-primary/20 transition-colors cursor-pointer flex items-center gap-1 border border-primary/20"
                        data-testid="mood-indicator"
                      >
                        <img src={MOOD_IMAGES.find(m => m.id === selectedMood)?.image} alt="" className="w-4 h-4 rounded-full" /> {MOOD_IMAGES.find(m => m.id === selectedMood)?.label}
                        <RefreshCw size={12} className="ml-1 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Change Mood</div>
                      {MOOD_IMAGES.map((mood) => (
                        <DropdownMenuItem 
                          key={mood.id}
                          onClick={() => handleMoodChange(mood.id)}
                          className={`cursor-pointer ${selectedMood === mood.id ? 'bg-primary/10' : ''}`}
                        >
                          <img src={mood.image} alt="" className="w-6 h-6 rounded-full mr-2" />
                          {mood.label}
                        </DropdownMenuItem>
                      ))}
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
            <div className="mb-4 p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center justify-between" data-testid="exclusions-banner">
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
          <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-6 mb-6 min-h-[400px] max-h-[60vh] overflow-y-auto" data-testid="messages-container">
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
                          : 'bg-secondary/50 text-secondary-foreground rounded-bl-sm'
                      }`}
                    >
                      {/* Recipe display for AI messages */}
                      {msg.role === 'assistant' && (hasRecipes(msg.content) || msg.structuredRecipes) ? (
                        <RecipeMessageDisplay 
                          message={msg.content}
                          structuredRecipes={msg.structuredRecipes}
                          onSaveRecipe={(recipe) => {
                            setRecipeToSave({
                              title: recipe.title,
                              description: recipe.description,
                              ingredients: recipe.ingredients || ['See recipe details'],
                              instructions: ['See recipe details'],
                              mood_tags: [selectedMood || 'comfort'],
                              prep_time: recipe.cookingTime || '30 min',
                              cook_time: recipe.cookingTime || '30 min',
                              complexity: recipe.difficulty?.toLowerCase() || 'medium',
                              nutritional_highlights: 'Mood-boosting nutrients',
                              dietary_info: [selectedDietaryPref],
                              image_url: recipe.imageUrl,
                              cuisine_type: recipe.cuisineHint
                            });
                            setShowRecipeDialog(true);
                          }}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Interactive selectors based on message flags */}
                  {msg.showMoodSelector && flowStep === 'mood' && (
                    <div className="mt-4 -ml-2 -mr-2 md:ml-2 md:mr-0">
                      <MoodCarousel 
                        onSelect={handleMoodSelect}
                        selectedMood={selectedMood}
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
                  
                  {msg.showDietarySelector && flowStep === 'dietaryPref' && (
                    <div className="mt-4 ml-2">
                      <FoodPreferenceSelector 
                        onSelect={handleDietaryPrefSelect}
                        selectedPreference={selectedDietaryPref}
                      />
                    </div>
                  )}
                  
                  {msg.showDietaryConfirm && flowStep === 'dietaryPref' && (
                    <div className="mt-4 ml-2 flex gap-3">
                      <Button
                        onClick={() => handleDietaryConfirm(true, msg.savedPref)}
                        className="rounded-full bg-green-600 hover:bg-green-700"
                        data-testid="confirm-dietary-yes"
                      >
                        Yes, that&apos;s right
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDietaryConfirm(false, msg.savedPref)}
                        className="rounded-full"
                        data-testid="confirm-dietary-change"
                      >
                        No, I want to change
                      </Button>
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
                        onClick={() => fetchRecipes(selectedCuisines)}
                        className="rounded-full"
                        data-testid="retry-button"
                      >
                        Try Again
                      </Button>
                    </div>
                  )}
                  
                  {/* Mood change recipe suggestion button */}
                  {msg.showMoodChangeRecipeOption && msg.isMoodChange && !msg.isCuisineChange && (
                    <div className="mt-4 ml-2 p-4 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-2xl border border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                          <img src={MOOD_IMAGES.find(m => m.id === selectedMood)?.image} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Ready for new suggestions?</p>
                          <p className="text-xs text-muted-foreground">Get recipes matching your new {MOOD_IMAGES.find(m => m.id === selectedMood)?.label?.toLowerCase()} mood</p>
                        </div>
                      </div>
                      <Button
                        onClick={getRecipesForNewMood}
                        className="rounded-full w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                        data-testid="get-new-recipes-button"
                      >
                        <Sparkles size={16} className="mr-2" />
                        Show {MOOD_IMAGES.find(m => m.id === selectedMood)?.label} Recipes
                      </Button>
                    </div>
                  )}
                  
                  {/* Cuisine change recipe suggestion button */}
                  {msg.showCuisineChangeRecipeOption && msg.isCuisineChange && !msg.isMoodChange && (
                    <div className="mt-4 ml-2 p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-2xl border border-orange-500/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-xl">
                          🌍
                        </div>
                        <div>
                          <p className="font-medium text-sm">New cuisine selected!</p>
                          <p className="text-xs text-muted-foreground">
                            Get recipes from {selectedCuisines.map(id => CUISINES.find(c => c.id === id)?.label).join(', ')} cuisine{selectedCuisines.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={getRecipesForNewCuisine}
                        className="rounded-full w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-500/90 hover:to-amber-500/90 text-white"
                        data-testid="get-new-cuisine-recipes-button"
                      >
                        <Sparkles size={16} className="mr-2" />
                        Show {selectedCuisines.map(id => CUISINES.find(c => c.id === id)?.label).join(', ')} Recipes
                      </Button>
                    </div>
                  )}
                  
                  {/* Combined mood and cuisine change recipe suggestion button */}
                  {msg.showPreferenceChangeRecipeOption && msg.isMoodChange && msg.isCuisineChange && (
                    <div className="mt-4 ml-2 p-4 bg-gradient-to-r from-primary/10 via-purple-500/10 to-orange-500/10 rounded-2xl border border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-orange-500/20 flex items-center justify-center overflow-hidden">
                          <img src={MOOD_IMAGES.find(m => m.id === selectedMood)?.image} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">New preferences set!</p>
                          <p className="text-xs text-muted-foreground">
                            {MOOD_IMAGES.find(m => m.id === selectedMood)?.label} mood + {selectedCuisines.map(id => CUISINES.find(c => c.id === id)?.label).join(', ')}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={getRecipesForNewCuisine}
                        className="rounded-full w-full bg-gradient-to-r from-primary via-purple-600 to-orange-500 hover:opacity-90 text-white"
                        data-testid="get-new-preference-recipes-button"
                      >
                        <Sparkles size={16} className="mr-2" />
                        Show Matching Recipes
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start" data-testid="loading-indicator">
                  <div className="bg-secondary rounded-2xl rounded-bl-sm px-5 py-3 flex items-center gap-2">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Finding delicious recipes...</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* Input Form - show for recipes, mood changes, cuisine changes, or follow-up questions */}
          {(flowStep === 'recipes' || flowStep === 'mood_changed' || flowStep === 'cuisine_changed' || flowStep === 'preferences_changed' || messages.some(m => hasRecipes(m.content))) && (
            <form onSubmit={handleSubmit} className="flex gap-3 items-end" data-testid="message-form">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask follow-up questions, request different cuisines, or change your mood..."
                className="flex-1 rounded-2xl resize-none min-h-[60px] max-h-[120px] bg-card border-border/60 focus:border-primary"
                disabled={isLoading}
                data-testid="message-input"
              />
              <Button
                type="submit"
                size="lg"
                disabled={isLoading || !inputMessage.trim()}
                className="rounded-full px-6 bg-primary hover:bg-primary/90 active:scale-95 transition-all"
                data-testid="send-button"
              >
                <Send size={20} />
              </Button>
            </form>
          )}
        </div>
      </div>
      
      {/* Recipe Save Dialog */}
      <Dialog open={showRecipeDialog} onOpenChange={setShowRecipeDialog}>
        <DialogContent className="max-w-md" data-testid="recipe-save-dialog">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif flex items-center gap-2">
              <BookOpen size={24} className="text-primary" />
              Save This Recipe?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {recipeToSave && (
              <>
                <div>
                  <h3 className="font-serif text-lg mb-2">{recipeToSave.title}</h3>
                  <p className="text-sm text-muted-foreground">{recipeToSave.description}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 bg-secondary rounded-full">{recipeToSave.complexity}</span>
                  <span className="px-2 py-1 bg-secondary rounded-full">{recipeToSave.prep_time}</span>
                </div>
              </>
            )}
            <div className="flex gap-3">
              <Button
                onClick={confirmSaveRecipe}
                className="flex-1 rounded-full bg-primary hover:bg-primary/90"
                data-testid="confirm-save-recipe"
              >
                <Heart size={18} className="mr-2" />
                Save Recipe
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRecipeDialog(false)}
                className="flex-1 rounded-full"
                data-testid="cancel-save-recipe"
              >
                Cancel
              </Button>
            </div>
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
        usedLimit={featureLockedModal.usedLimit}
        maxLimit={featureLockedModal.maxLimit}
      />
    </>
  );
};

export default ChatPage;
