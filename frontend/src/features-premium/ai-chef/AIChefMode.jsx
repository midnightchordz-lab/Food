/**
 * AI Chef Mode - Main Component
 * Premium feature: AI-powered conversational cooking assistant
 * Production-ready with robust error handling
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { conversationEngine } from './ConversationEngine';
import { emotionalNarrator } from './EmotionalNarrator';
import { voiceRecognition } from './VoiceRecognition';
import platformDetector from './PlatformDetector';
import './AIChef.css';

// Error types for better user feedback
const ERROR_TYPES = {
  NOT_FOUND: 'not_found',
  NETWORK: 'network',
  SERVER: 'server',
  UNKNOWN: 'unknown'
};

function AIChefMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // State
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceState, setVoiceState] = useState('idle'); // idle, listening, hearing, restarting, paused, reconnecting
  const [lastTranscript, setLastTranscript] = useState('');
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [handsFreeMode, setHandsFreeMode] = useState(true); // Default to hands-free
  const [voiceNotification, setVoiceNotification] = useState(null); // Transient notifications
  
  const hasInitialized = useRef(false);
  const messagesEndRef = useRef(null);
  const loadAttempts = useRef(0);
  const MAX_LOAD_ATTEMPTS = 2;

  /**
   * Production-grade recipe loader with comprehensive error handling
   */
  const loadRecipe = useCallback(async (recipeId) => {
    if (!recipeId) {
      setError('No recipe ID provided');
      setErrorType(ERROR_TYPES.NOT_FOUND);
      setLoading(false);
      return;
    }

    loadAttempts.current += 1;
    console.log(`[AIChef] Loading recipe: ${recipeId} (attempt ${loadAttempts.current})`);
    
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || '';
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Please log in to use AI Chef mode');
        setErrorType(ERROR_TYPES.NOT_FOUND);
        setLoading(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      const response = await fetch(`${API_URL}/api/chat/ai-chef/recipe/${recipeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const status = response.status;
        
        if (status === 404) {
          console.error(`[AIChef] Recipe not found: ${recipeId}`);
          setError('This recipe was not found. It may have been deleted or the link is invalid.');
          setErrorType(ERROR_TYPES.NOT_FOUND);
        } else if (status === 401 || status === 403) {
          setError('Please log in again to continue');
          setErrorType(ERROR_TYPES.NOT_FOUND);
        } else if (status >= 500) {
          setError('Our servers are having trouble. Please try again in a moment.');
          setErrorType(ERROR_TYPES.SERVER);
        } else {
          setError(`Unable to load recipe (Error ${status})`);
          setErrorType(ERROR_TYPES.UNKNOWN);
        }
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      
      // Validate recipe data
      if (!data || !data.title) {
        console.error('[AIChef] Invalid recipe data:', data);
        setError('Recipe data is incomplete or corrupted');
        setErrorType(ERROR_TYPES.SERVER);
        setLoading(false);
        return;
      }
      
      // Ensure instructions exist
      if (!data.instructions || data.instructions.length === 0) {
        console.warn('[AIChef] Recipe has no instructions, using fallback');
        data.instructions = [
          `Let's cook ${data.title} together!`,
          'Follow the recipe description to prepare this dish.',
          'Enjoy your meal!'
        ];
      }
      
      console.log(`[AIChef] Recipe loaded successfully: ${data.title} (${data.instructions.length} steps)`);
      setRecipe(data);
      conversationEngine.setRecipe(data);
      setError(null);
      setErrorType(null);
      
    } catch (err) {
      console.error('[AIChef] Failed to fetch recipe:', err);
      
      if (err.name === 'AbortError') {
        setError('Request timed out. Please check your connection and try again.');
        setErrorType(ERROR_TYPES.NETWORK);
      } else if (err.message?.includes('fetch') || err.message?.includes('network') || !navigator.onLine) {
        setError('Network connection issue. Please check your internet and try again.');
        setErrorType(ERROR_TYPES.NETWORK);
      } else {
        setError('Something went wrong. Please try again.');
        setErrorType(ERROR_TYPES.UNKNOWN);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch recipe on mount
  useEffect(() => {
    loadRecipe(id);
  }, [id, loadRecipe]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add message to chat
  const addMessage = useCallback((role, text) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      role,
      text,
      timestamp: new Date()
    }]);
  }, []);

  // Show transient voice notification (auto-dismisses)
  const showVoiceNotification = useCallback((text, duration = 5000) => {
    setVoiceNotification(text);
    setTimeout(() => setVoiceNotification(null), duration);
  }, []);

  // Setup callbacks
  useEffect(() => {
    emotionalNarrator.setOnSpeakingChange((speaking) => {
      setIsSpeaking(speaking);
      // Pause listening while AI is speaking to avoid feedback
      if (speaking && handsFreeMode) {
        voiceRecognition.pause();
      } else if (!speaking && handsFreeMode && isReady) {
        // Resume continuous listening after AI finishes speaking
        setTimeout(() => {
          voiceRecognition.resume().catch(console.error);
        }, 500);
      }
    });
    
    voiceRecognition.setOnResult((transcript) => {
      setLastTranscript(transcript);
      handleUserMessage(transcript);
    });
    
    voiceRecognition.setOnStateChange((state) => {
      setVoiceState(state);
      setIsListening(state === 'listening' || state === 'hearing' || state === 'restarting' || state === 'reconnecting');
      
      // Clear notification when successfully listening
      if (state === 'listening') {
        setVoiceNotification(null);
      }
      // Show reconnecting notification
      if (state === 'reconnecting') {
        setVoiceNotification('Reconnecting to voice service...');
      }
    });
    
    voiceRecognition.setOnError((error) => {
      if (error === 'permission-denied') {
        addMessage('system', 'Microphone permission denied. Please enable it in settings.');
        setHandsFreeMode(false);
      } else if (error === 'network-error') {
        // Use transient notification instead of permanent message
        showVoiceNotification('Voice connection issue. Tap mic or type below.', 8000);
      } else if (error === 'audio-capture-error') {
        showVoiceNotification('Microphone not available. Check audio settings.', 8000);
      } else if (error === 'service-blocked') {
        addMessage('system', 'Speech recognition service is not available. Please try again later.');
        setHandsFreeMode(false);
      }
    });

    return () => {
      emotionalNarrator.stop();
      voiceRecognition.destroy();
      conversationEngine.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handsFreeMode, isReady, showVoiceNotification, addMessage]);

  // Handle user message (voice or text)
  const handleUserMessage = useCallback(async (message) => {
    if (!message.trim() || isProcessing) return;
    
    // Pause listening while processing (don't fully stop in hands-free mode)
    voiceRecognition.pause();
    setIsProcessing(true);
    
    // Add user message
    addMessage('user', message);
    
    try {
      // Get AI response
      const response = await conversationEngine.chat(message);
      
      // Update step
      setCurrentStep(response.step);
      
      // Add AI response
      addMessage('assistant', response.text);
      
      // Speak response
      await emotionalNarrator.speak(response.text, response.emotion);
      
    } catch (err) {
      console.error('[AIChef] Error processing message:', err);
      addMessage('system', 'Sorry, I had trouble understanding. Please try again.');
    } finally {
      setIsProcessing(false);
      
      // Resume continuous listening in hands-free mode
      if (isReady && handsFreeMode) {
        setTimeout(() => {
          voiceRecognition.resume().catch(console.error);
        }, 500);
      }
    }
  }, [addMessage, isProcessing, isReady, handsFreeMode]);

  // Start AI Chef mode
  const handleStart = async () => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    try {
      // Welcome message
      const welcomeText = `Welcome! I'm your AI chef assistant. Let's cook ${recipe.title} together! 
        We have ${recipe.instructions?.length || 0} steps. Say "next" to continue, "back" to go back, 
        or ask me any cooking questions. Ready? Let's start with step 1!`;
      
      addMessage('assistant', welcomeText);
      await emotionalNarrator.speak(welcomeText, 'encouraging');
      
      // Speak first step
      const firstStep = recipe.instructions?.[0];
      if (firstStep) {
        const stepText = `Step 1: ${firstStep}`;
        addMessage('assistant', stepText);
        await emotionalNarrator.speak(stepText, 'informative');
      }
      
      // Start CONTINUOUS listening for hands-free mode
      if (handsFreeMode) {
        await voiceRecognition.startContinuous();
        addMessage('system', '🎤 Hands-free mode active - Just speak naturally!');
      } else {
        await voiceRecognition.start();
      }
      setIsReady(true);
      
    } catch (err) {
      console.error('[AIChef] Start failed:', err);
      addMessage('system', 'Failed to start voice mode. Please try again.');
      hasInitialized.current = false;
    }
  };

  // Handle manual input
  const handleManualSend = (e) => {
    e.preventDefault();
    const input = e.target.elements.message;
    if (input.value.trim()) {
      handleUserMessage(input.value.trim());
      input.value = '';
    }
  };

  // Navigation buttons
  const handleNext = () => handleUserMessage('next');
  const handleBack = () => handleUserMessage('back');
  const handleRepeat = () => handleUserMessage('repeat');

  // Close and go back
  const handleClose = () => {
    emotionalNarrator.stop();
    voiceRecognition.stop();
    navigate(-1);
  };

  // Retry loading recipe
  const handleRetry = () => {
    if (loadAttempts.current < MAX_LOAD_ATTEMPTS) {
      setLoading(true);
      setError(null);
      setErrorType(null);
      loadRecipe(id);
    } else {
      // Reset attempts and go back
      loadAttempts.current = 0;
      navigate(-1);
    }
  };

  // Toggle listening
  const toggleListening = async () => {
    // Clear any notification when user taps
    setVoiceNotification(null);
    
    if (isListening) {
      voiceRecognition.pause();
    } else {
      try {
        if (handsFreeMode) {
          await voiceRecognition.resume();
        } else {
          await voiceRecognition.start();
        }
      } catch (err) {
        showVoiceNotification('Could not start listening. Tap to retry.', 5000);
      }
    }
  };

  // Toggle hands-free mode
  const toggleHandsFreeMode = async () => {
    const newMode = !handsFreeMode;
    setHandsFreeMode(newMode);
    
    if (isReady) {
      voiceRecognition.stop();
      if (newMode) {
        await voiceRecognition.startContinuous();
        addMessage('system', '🎤 Hands-free mode enabled - Just speak naturally!');
      } else {
        addMessage('system', '🎤 Tap-to-speak mode enabled');
      }
    }
  };

  // Get voice status text
  const getVoiceStatusText = () => {
    if (isSpeaking) return '🔊 AI Speaking...';
    if (isProcessing) return '⏳ Processing...';
    
    switch (voiceState) {
      case 'listening':
        return handsFreeMode ? '🎤 Listening... (hands-free)' : '🎤 Listening...';
      case 'hearing':
        return '🎤 Hearing you...';
      case 'restarting':
        return '🎤 Ready to listen...';
      case 'reconnecting':
        return '🔄 Reconnecting...';
      case 'paused':
        return '⏸️ Paused';
      case 'waiting':
        return '🎤 Waiting for voice...';
      default:
        // If there's a notification, show tap to retry
        if (voiceNotification) {
          return '🎤 Tap to retry';
        }
        return handsFreeMode ? '🎤 Speak anytime' : '🎤 Tap to speak';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="ai-chef-container" data-testid="ai-chef-loading">
        <div className="ai-chef-loading">
          <div className="loading-spinner"></div>
          <p>Loading recipe...</p>
          <p className="loading-hint">Preparing your cooking assistant</p>
        </div>
      </div>
    );
  }

  // Error state with specific error screens
  if (error || !recipe) {
    const getErrorIcon = () => {
      switch (errorType) {
        case ERROR_TYPES.NOT_FOUND:
          return '🔍';
        case ERROR_TYPES.NETWORK:
          return '📡';
        case ERROR_TYPES.SERVER:
          return '🔧';
        default:
          return '⚠️';
      }
    };

    const getErrorTitle = () => {
      switch (errorType) {
        case ERROR_TYPES.NOT_FOUND:
          return 'Recipe Not Found';
        case ERROR_TYPES.NETWORK:
          return 'Connection Issue';
        case ERROR_TYPES.SERVER:
          return 'Server Error';
        default:
          return 'Something Went Wrong';
      }
    };

    const canRetry = errorType === ERROR_TYPES.NETWORK || errorType === ERROR_TYPES.SERVER;

    return (
      <div className="ai-chef-container" data-testid="ai-chef-error">
        <div className="ai-chef-error-screen">
          <div className="error-icon">{getErrorIcon()}</div>
          <h2 className="error-title">{getErrorTitle()}</h2>
          <p className="error-message">{error || 'Recipe not found'}</p>
          
          {errorType === ERROR_TYPES.NOT_FOUND && (
            <p className="error-hint">
              Try generating a new recipe from the chat page, then use AI Chef mode.
            </p>
          )}
          
          <div className="error-actions">
            {canRetry && loadAttempts.current < MAX_LOAD_ATTEMPTS && (
              <button 
                className="error-btn retry-btn" 
                onClick={handleRetry}
                data-testid="ai-chef-retry-btn"
              >
                Try Again
              </button>
            )}
            <button 
              className="error-btn back-btn" 
              onClick={() => navigate(-1)}
              data-testid="ai-chef-back-btn"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-chef-container" data-testid="ai-chef-main">
      {/* Header */}
      <header className="ai-chef-header">
        <button className="close-btn" onClick={handleClose} data-testid="ai-chef-close-btn">
          <span>&times;</span>
        </button>
        <h1>AI Chef Assistant</h1>
        <div className="recipe-title">{recipe.title}</div>
      </header>

      {/* Start Screen */}
      {!isReady && (
        <div className="ai-chef-start" data-testid="ai-chef-start-screen">
          <div className="start-content">
            <div className="chef-icon">👨‍🍳</div>
            <h2>AI Chef Mode</h2>
            <p>Your personal cooking assistant</p>
            
            <div className="feature-list">
              <div className="feature">🎙️ Voice commands</div>
              <div className="feature">💬 Ask questions</div>
              <div className="feature">✨ Get cooking tips</div>
            </div>
            
            <button 
              className="start-btn" 
              onClick={handleStart}
              data-testid="ai-chef-start-btn"
            >
              Start Cooking with AI
            </button>
            
            <p className="platform-info">
              Platform: {platformDetector.getPlatform()}
            </p>
          </div>
        </div>
      )}

      {/* Active Mode */}
      {isReady && (
        <>
          {/* Progress */}
          <div className="step-progress">
            <span>Step {currentStep + 1} of {recipe.instructions?.length || 0}</span>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ 
                  width: `${((currentStep + 1) / (recipe.instructions?.length || 1)) * 100}%` 
                }}
              />
            </div>
          </div>

          {/* Current Step Card */}
          <div className={`step-card ${isSpeaking ? 'speaking' : ''}`}>
            <h3>Step {currentStep + 1}</h3>
            <p>{recipe.instructions?.[currentStep]}</p>
            
            {isSpeaking && (
              <div className="audio-waves">
                <span className="wave"></span>
                <span className="wave"></span>
                <span className="wave"></span>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="messages-container">
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-content">{msg.text}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice Notification (transient) */}
          {voiceNotification && (
            <div className="voice-notification" onClick={() => setVoiceNotification(null)}>
              <span className="notification-icon">ℹ️</span>
              <span className="notification-text">{voiceNotification}</span>
              <span className="notification-dismiss">×</span>
            </div>
          )}

          {/* Last Transcript */}
          {lastTranscript && (
            <div className="transcript-bubble">
              🎤 "{lastTranscript}"
            </div>
          )}

          {/* Hands-Free Mode Toggle */}
          <div className="hands-free-toggle" data-testid="hands-free-toggle">
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={handsFreeMode}
                onChange={toggleHandsFreeMode}
                data-testid="hands-free-checkbox"
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">
              {handsFreeMode ? 'Hands-Free Mode' : 'Tap-to-Speak Mode'}
            </span>
          </div>

          {/* Listening Indicator */}
          <div 
            className={`listening-indicator ${isListening ? 'active' : ''} ${handsFreeMode ? 'hands-free' : ''} ${voiceState}`}
            onClick={toggleListening}
            data-testid="ai-chef-mic-btn"
          >
            <div className="mic-icon-container">
              {isListening && handsFreeMode && (
                <div className="pulse-ring"></div>
              )}
              <span className="mic-icon">{isListening ? '🎤' : '🎙️'}</span>
            </div>
            <span className="status-text">{getVoiceStatusText()}</span>
          </div>

          {/* Controls */}
          <div className="ai-chef-controls">
            <button 
              onClick={handleBack}
              disabled={currentStep === 0 || isProcessing}
              className="control-btn"
              data-testid="ai-chef-back-step-btn"
            >
              ⏮ Back
            </button>
            
            <button 
              onClick={handleRepeat}
              disabled={isProcessing || isSpeaking}
              className="control-btn"
              data-testid="ai-chef-repeat-btn"
            >
              🔊 Repeat
            </button>
            
            <button 
              onClick={handleNext}
              disabled={currentStep >= (recipe.instructions?.length || 0) - 1 || isProcessing}
              className="control-btn"
              data-testid="ai-chef-next-step-btn"
            >
              Next ⏭
            </button>
          </div>

          {/* Manual Input */}
          <form className="manual-input" onSubmit={handleManualSend}>
            <input 
              type="text" 
              name="message"
              placeholder="Type a message or question..."
              disabled={isProcessing}
              data-testid="ai-chef-input"
            />
            <button type="submit" disabled={isProcessing} data-testid="ai-chef-send-btn">
              Send
            </button>
          </form>

          {/* Voice Commands Help */}
          <div className="commands-help">
            <p>Voice Commands:</p>
            <div className="commands-grid">
              <span>"Next"</span>
              <span>"Back"</span>
              <span>"Repeat"</span>
              <span>Ask questions!</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AIChefMode;
