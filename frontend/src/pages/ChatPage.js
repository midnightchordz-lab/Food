import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Heart, BookOpen, Home, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import RecipeMessageDisplay, { hasRecipes } from '@/components/RecipeMessageDisplay';
import MoodCarousel, { MOOD_IMAGES } from '@/components/MoodCarousel';
import MealTypeSelector, { MEAL_TYPES } from '@/components/MealTypeSelector';
import FoodPreferenceSelector, { FOOD_PREFERENCES } from '@/components/FoodPreferenceSelector';
import CuisineSelector, { CUISINES } from '@/components/CuisineSelector';
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

// Chat state persistence key
const CHAT_STORAGE_KEY = 'moodfood_chat_state';

const ChatPage = () => {
  // Core state
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.sessionId || `session-${Date.now()}`;
    }
    return `session-${Date.now()}`;
  });
  
  // Recipe dialog state
  const [showRecipeDialog, setShowRecipeDialog] = useState(false);
  const [recipeToSave, setRecipeToSave] = useState(null);
  
  // Flow state - tracks where user is in the conversation
  const [flowStep, setFlowStep] = useState('greeting'); // greeting, mood, mealType, dietaryPref, cuisine, recipes
  const [selectedMood, setSelectedMood] = useState(null);
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [selectedDietaryPref, setSelectedDietaryPref] = useState(null);
  const [selectedCuisines, setSelectedCuisines] = useState([]);
  
  const messagesEndRef = useRef(null);
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  
  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);
  
  // Save chat state to localStorage for persistence
  useEffect(() => {
    if (messages.length > 0) {
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
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(stateToSave));
    }
  }, [messages, flowStep, selectedMood, selectedMealType, selectedDietaryPref, selectedCuisines, sessionId]);
  
  // Load saved chat state on mount
  useEffect(() => {
    // Wait for auth loading to complete
    if (loading) {
      return;
    }
    
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    // Try to restore previous chat state
    const savedState = localStorage.getItem(CHAT_STORAGE_KEY);
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
            return;
          }
        }
      } catch (e) {
        console.error('Error parsing saved chat state:', e);
      }
    }
    
    // Show initial greeting with mood selector
    setMessages([{
      role: 'assistant',
      content: `Hi${user?.name ? ` ${user.name}` : ''}! 👋\n\nWelcome to MoodFood! I'm here to suggest delicious meals that match your mood, preferences, and cravings.\n\nLet's start by understanding how you're feeling today:`,
      timestamp: new Date().toISOString(),
      showMoodSelector: true
    }]);
    setFlowStep('mood');
  }, [isAuthenticated, user, navigate, loading]);
  
  // Handle mood selection
  const handleMoodSelect = (moodId, moodLabel, moodDescription) => {
    setSelectedMood(moodId);
    
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
      content: `${mood?.emoji} ${moodLabel}! ${moodDescription}\n\nPerfect! Let's find some delicious meals to match that mood.\n\nWhat meal are you planning?`,
      timestamp: new Date().toISOString(),
      showMealTypeSelector: true
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
    setSelectedDietaryPref(prefId);
    
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
  
  // Handle cuisine selection
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
  
  // Fetch recipes based on all selections
  const fetchRecipes = async (cuisineIds) => {
    setIsLoading(true);
    
    const mood = MOOD_IMAGES.find(m => m.id === selectedMood);
    const mealType = MEAL_TYPES.find(m => m.id === selectedMealType);
    const dietaryPref = FOOD_PREFERENCES.find(p => p.id === selectedDietaryPref);
    const cuisineLabels = cuisineIds.includes('any') 
      ? 'any cuisine' 
      : cuisineIds.map(id => CUISINES.find(c => c.id === id)?.label).join(', ');
    
    const enhancedMessage = `
[User Preferences]
- Mood: ${mood?.label} (${mood?.description})
- Meal Type: ${mealType?.label}
- Dietary Preference: ${dietaryPref?.label}
- Cuisine(s): ${cuisineLabels}

Please suggest 6 delicious ${mealType?.label?.toLowerCase()} recipes that:
1. Match the ${mood?.label?.toLowerCase()} mood (${mood?.description})
2. Are appropriate for ${mealType?.label?.toLowerCase()} time
3. Are ${dietaryPref?.label?.toLowerCase()} friendly
4. Feature ${cuisineLabels} style cooking

For EACH recipe provide:
- Recipe name with cooking time in parentheses
- Difficulty level (Easy/Medium/Hard)
- Brief appetizing description (2-3 sentences)
- Key mood-boosting benefits

Format each recipe clearly with the name as a header.
`;

    try {
      const response = await axios.post(`${API}/chat/send`, {
        session_id: sessionId,
        message: enhancedMessage
      });
      
      const aiMsg = {
        role: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Error fetching recipes:', error);
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
  
  // Handle mood change from user input
  const handleMoodChange = async (newMoodId) => {
    const mood = MOODS.find(m => m.id === newMoodId);
    const previousMood = MOODS.find(m => m.id === selectedMood);
    
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
      
      const isMoodChange = moodChangeIndicators.some(indicator => lowerText.includes(indicator));
      const detectedMoodFromUser = detectMoodFromText(messageText);
      
      // If user just types a mood word directly (like "cozy"), treat it as a mood change
      const isDirectMoodStatement = detectedMoodFromUser && messageText.trim().split(/\s+/).length <= 5;
      
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
      
      // Update mood ONLY from user's message, never from AI response
      const shouldUpdateMood = (isMoodChange || isDirectMoodStatement) && detectedMoodFromUser;
      if (shouldUpdateMood) {
        const newMoodObj = MOODS.find(m => m.id === detectedMoodFromUser);
        if (newMoodObj) {
          setSelectedMood(detectedMoodFromUser);
        }
      }
      
      const aiMsg = {
        role: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp,
        isMoodChange: isMoodChange || isDirectMoodStatement || isAIMoodChangeResponse,
        showMoodChangeRecipeOption: (shouldUpdateMood || isAIMoodChangeResponse) && selectedMealType && selectedDietaryPref,
        newMood: detectedMoodFromUser  // Only use mood detected from USER message
      };
      setMessages(prev => [...prev, aiMsg]);
      
      // Update flow step if mood changed
      if (shouldUpdateMood) {
        setFlowStep('mood_changed');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
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
    localStorage.removeItem(CHAT_STORAGE_KEY);
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
                <h1 className="text-3xl sm:text-4xl font-serif" data-testid="chat-title">
                  MoodFood Chat
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Personalized recipes based on how you feel
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
                        {MOODS.find(m => m.id === selectedMood)?.emoji} {MOODS.find(m => m.id === selectedMood)?.label}
                        <RefreshCw size={12} className="ml-1 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Change Mood</div>
                      {MOODS.map((mood) => (
                        <DropdownMenuItem 
                          key={mood.id}
                          onClick={() => handleMoodChange(mood.id)}
                          className={`cursor-pointer ${selectedMood === mood.id ? 'bg-primary/10' : ''}`}
                        >
                          <span className="mr-2">{mood.emoji}</span>
                          {mood.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {selectedMealType && (
                  <span className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium">
                    {MEAL_TYPES.find(m => m.id === selectedMealType)?.emoji} {MEAL_TYPES.find(m => m.id === selectedMealType)?.label}
                  </span>
                )}
                {selectedDietaryPref && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    🍽️ {FOOD_PREFERENCES.find(p => p.id === selectedDietaryPref)?.label}
                  </span>
                )}
                {selectedCuisines.length > 0 && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                    🌍 {selectedCuisines.includes('any') ? 'Any Cuisine' : selectedCuisines.map(id => CUISINES.find(c => c.id === id)?.label).join(', ')}
                  </span>
                )}
              </div>
            )}
          </div>
          
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
                      {msg.role === 'assistant' && hasRecipes(msg.content) ? (
                        <RecipeMessageDisplay 
                          message={msg.content} 
                          onSaveRecipe={(recipe) => {
                            setRecipeToSave({
                              title: recipe.title,
                              description: recipe.description,
                              ingredients: ['See recipe details'],
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
                    <div className="mt-4 ml-2">
                      <MoodSelector 
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
                        Yes, that's right
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
                  {msg.showMoodChangeRecipeOption && msg.isMoodChange && (
                    <div className="mt-4 ml-2 p-4 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-2xl border border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <Sparkles size={20} className="text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Ready for new suggestions?</p>
                          <p className="text-xs text-muted-foreground">Get recipes matching your new {MOODS.find(m => m.id === selectedMood)?.label?.toLowerCase()} mood</p>
                        </div>
                      </div>
                      <Button
                        onClick={getRecipesForNewMood}
                        className="rounded-full w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                        data-testid="get-new-recipes-button"
                      >
                        <Sparkles size={16} className="mr-2" />
                        Show {MOODS.find(m => m.id === selectedMood)?.label} Recipes
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
          
          {/* Input Form - show for recipes, mood changes, or follow-up questions */}
          {(flowStep === 'recipes' || flowStep === 'mood_changed' || messages.some(m => hasRecipes(m.content))) && (
            <form onSubmit={handleSubmit} className="flex gap-3 items-end" data-testid="message-form">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask follow-up questions or request more recipes..."
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
    </>
  );
};

export default ChatPage;
