/**
 * AI Chef Mode - Main Component
 * Premium feature: AI-powered conversational cooking assistant
 * 100% isolated - no dependencies on existing code
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { conversationEngine } from './ConversationEngine';
import { emotionalNarrator } from './EmotionalNarrator';
import { voiceRecognition } from './VoiceRecognition';
import platformDetector from './PlatformDetector';
import './AIChef.css';

function AIChefMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // State
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const hasInitialized = useRef(false);
  const messagesEndRef = useRef(null);

  // Fetch recipe on mount
  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const API_URL = process.env.REACT_APP_BACKEND_URL || '';
        const token = localStorage.getItem('token');
        
        const response = await fetch(`${API_URL}/api/chat/ai-chef/recipe/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Recipe not found');
        }
        
        const data = await response.json();
        setRecipe(data);
        conversationEngine.setRecipe(data);
        
      } catch (err) {
        console.error('[AIChef] Failed to fetch recipe:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [id]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Setup callbacks
  useEffect(() => {
    emotionalNarrator.setOnSpeakingChange(setIsSpeaking);
    
    voiceRecognition.setOnResult((transcript) => {
      setLastTranscript(transcript);
      handleUserMessage(transcript);
    });
    
    voiceRecognition.setOnStateChange((state) => {
      setIsListening(state === 'listening');
    });
    
    voiceRecognition.setOnError((error) => {
      if (error === 'permission-denied') {
        addMessage('system', 'Microphone permission denied. Please enable it in settings.');
      }
    });

    return () => {
      emotionalNarrator.stop();
      voiceRecognition.destroy();
      conversationEngine.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add message to chat
  const addMessage = useCallback((role, text) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      role,
      text,
      timestamp: new Date()
    }]);
  }, []);

  // Handle user message (voice or text)
  const handleUserMessage = useCallback(async (message) => {
    if (!message.trim() || isProcessing) return;
    
    // Stop listening while processing
    voiceRecognition.stop();
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
      
      // Resume listening if ready
      if (isReady) {
        setTimeout(() => {
          voiceRecognition.start().catch(console.error);
        }, 500);
      }
    }
  }, [addMessage, isProcessing, isReady]);

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
      
      // Start listening
      await voiceRecognition.start();
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

  // Toggle listening
  const toggleListening = async () => {
    if (isListening) {
      voiceRecognition.stop();
    } else {
      try {
        await voiceRecognition.start();
      } catch (err) {
        addMessage('system', 'Could not start listening: ' + err.message);
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="ai-chef-container">
        <div className="ai-chef-loading">
          <div className="loading-spinner"></div>
          <p>Loading recipe...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !recipe) {
    return (
      <div className="ai-chef-container">
        <div className="ai-chef-error">
          <h2>Oops!</h2>
          <p>{error || 'Recipe not found'}</p>
          <button onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-chef-container">
      {/* Header */}
      <header className="ai-chef-header">
        <button className="close-btn" onClick={handleClose}>
          <span>&times;</span>
        </button>
        <h1>AI Chef Assistant</h1>
        <div className="recipe-title">{recipe.title}</div>
      </header>

      {/* Start Screen */}
      {!isReady && (
        <div className="ai-chef-start">
          <div className="start-content">
            <div className="chef-icon">👨‍🍳</div>
            <h2>AI Chef Mode</h2>
            <p>Your personal cooking assistant</p>
            
            <div className="feature-list">
              <div className="feature">🎙️ Voice commands</div>
              <div className="feature">💬 Ask questions</div>
              <div className="feature">✨ Get cooking tips</div>
            </div>
            
            <button className="start-btn" onClick={handleStart}>
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

          {/* Last Transcript */}
          {lastTranscript && (
            <div className="transcript-bubble">
              🎤 "{lastTranscript}"
            </div>
          )}

          {/* Listening Indicator */}
          <div 
            className={`listening-indicator ${isListening ? 'active' : ''}`}
            onClick={toggleListening}
          >
            {isListening ? '🎤 Listening...' : '🎤 Tap to speak'}
          </div>

          {/* Controls */}
          <div className="ai-chef-controls">
            <button 
              onClick={handleBack}
              disabled={currentStep === 0 || isProcessing}
              className="control-btn"
            >
              ⏮ Back
            </button>
            
            <button 
              onClick={handleRepeat}
              disabled={isProcessing || isSpeaking}
              className="control-btn"
            >
              🔊 Repeat
            </button>
            
            <button 
              onClick={handleNext}
              disabled={currentStep >= (recipe.instructions?.length || 0) - 1 || isProcessing}
              className="control-btn"
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
            />
            <button type="submit" disabled={isProcessing}>
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
