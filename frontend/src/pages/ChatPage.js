import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Heart, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import useVoiceControls from '@/hooks/useVoiceControls';
import VoiceButton from '@/components/VoiceButton';
import LanguageSelector from '@/components/LanguageSelector';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [showRecipeDialog, setShowRecipeDialog] = useState(false);
  const [recipeToSave, setRecipeToSave] = useState(null);
  const [currentMood, setCurrentMood] = useState(null);
  const messagesEndRef = useRef(null);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    // Load chat history
    const loadHistory = async () => {
      try {
        const response = await axios.get(`${API}/chat/history/${sessionId}`);
        if (response.data.messages && response.data.messages.length > 0) {
          setMessages(response.data.messages);
        } else {
          // Show initial greeting only in UI, don't save to backend
          setMessages([{
            role: 'assistant',
            content: 'Hello! I\'m ready to help with meal planning based on how you\'re feeling. Tell me about your mood today, and I\'ll suggest meals that will nourish both your body and mind.',
            timestamp: new Date().toISOString()
          }]);
        }
      } catch (error) {
        console.error('Error loading history:', error);
        // Show initial greeting on error too
        setMessages([{
          role: 'assistant',
          content: 'Hello! I\'m ready to help with meal planning based on how you\'re feeling. Tell me about your mood today, and I\'ll suggest meals that will nourish both your body and mind.',
          timestamp: new Date().toISOString()
        }]);
      }
    };
    loadHistory();
  }, [isAuthenticated]);
  
  const sendMessage = async (messageText) => {
    if (!messageText.trim()) return;
    
    const userMsg = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);
    
    try {
      const response = await axios.post(`${API}/chat/send`, {
        session_id: sessionId,
        message: messageText
      });
      
      const assistantMsg = {
        role: 'assistant',
        content: response.data.response,
        timestamp: response.data.timestamp
      };
      setMessages(prev => [...prev, assistantMsg]);
      
      // Auto-play voice response if not muted
      if (voiceControls && !voiceControls.isMuted) {
        voiceControls.playResponse(response.data.response, currentMood);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleVoiceTranscription = (text, detectedMood) => {
    // Update current mood
    if (detectedMood) {
      setCurrentMood(detectedMood);
    }
    
    // Send the transcribed text
    sendMessage(text);
  };
  
  // Voice controls - now defined after handleVoiceTranscription
  const voiceControls = useVoiceControls({
    onTranscription: handleVoiceTranscription,
    autoPlayResponse: true
  });
  
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
  
  const extractRecipeFromMessage = (message) => {
    // Simple recipe extraction - looks for common patterns
    const lines = message.split('\n');
    let title = '';
    let description = '';
    let ingredients = [];
    let instructions = [];
    let prepTime = '30 min';
    let cookTime = '30 min';
    let complexity = 'standard';
    
    // Try to find title (often in bold or first line)
    const titleMatch = message.match(/\*\*(.+?)\*\*/);
    if (titleMatch) {
      title = titleMatch[1];
    } else {
      // Use first substantial line
      const firstLine = lines.find(l => l.trim().length > 10);
      if (firstLine) title = firstLine.trim().substring(0, 100);
    }
    
    // Extract ingredients (lines with measurements)
    const ingredientSection = message.match(/Ingredients?:?\s*([\s\S]*?)(?=Instructions?|Directions?|Steps?|$)/i);
    if (ingredientSection) {
      ingredients = ingredientSection[1]
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.match(/^[#*]/))
        .slice(0, 20);
    }
    
    // Extract instructions
    const instructionSection = message.match(/(?:Instructions?|Directions?|Steps?):?\s*([\s\S]*?)$/i);
    if (instructionSection) {
      instructions = instructionSection[1]
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.match(/^[#*]/))
        .slice(0, 15);
    }
    
    // Extract times
    const prepMatch = message.match(/(?:prep|preparation)\s*time:?\s*(\d+[-\s]*\d*\s*(?:min|minutes|hour|hours))/i);
    if (prepMatch) prepTime = prepMatch[1];
    
    const cookMatch = message.match(/(?:cook|cooking)\s*time:?\s*(\d+[-\s]*\d*\s*(?:min|minutes|hour|hours))/i);
    if (cookMatch) cookTime = cookMatch[1];
    
    // Determine complexity
    if (message.match(/quick|easy|simple|15[-\s]*20\s*min/i)) {
      complexity = 'quick';
    } else if (message.match(/involved|complex|hour|therapeutic/i)) {
      complexity = 'involved';
    }
    
    // Get description (first paragraph)
    description = lines.find(l => l.length > 30)?.substring(0, 200) || 'A delicious mood-based meal';
    
    return {
      title: title || 'Mood-Based Recipe',
      description,
      ingredients: ingredients.length > 0 ? ingredients : ['See chat for details'],
      instructions: instructions.length > 0 ? instructions : ['See chat for details'],
      mood_tags: ['comfort', 'nourishing'],
      prep_time: prepTime,
      cook_time: cookTime,
      complexity,
      nutritional_highlights: 'Rich in mood-boosting nutrients',
      dietary_info: []
    };
  };
  
  const handleSaveRecipe = (message) => {
    const recipe = extractRecipeFromMessage(message);
    setRecipeToSave(recipe);
    setShowRecipeDialog(true);
  };
  
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
          <div className="mb-8">
            <div className="text-center mb-4">
              <h1 className="text-4xl sm:text-5xl font-serif mb-3" data-testid="chat-title">
                How are you feeling today?
              </h1>
              <p className="text-muted-foreground" data-testid="chat-subtitle">
                Share your mood, and I'll suggest meals that nourish both body and mind.
              </p>
              {currentMood && (
                <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent rounded-full text-sm">
                  <span>Current mood: {currentMood}</span>
                </div>
              )}
            </div>
            
            {/* Language Selector for Voice */}
            {voiceControls && (
              <div className="flex justify-center">
                <LanguageSelector
                  selectedLanguage={voiceControls.currentLanguage}
                  onLanguageChange={voiceControls.setCurrentLanguage}
                />
              </div>
            )}
          </div>
          
          {/* Messages Container */}
          <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-6 mb-6 chat-container" data-testid="messages-container">
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx}>
                  <div
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    data-testid={`message-${msg.role}-${idx}`}
                  >
                    <div
                      className={`message-bubble max-w-[80%] rounded-2xl px-5 py-3 ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-secondary text-secondary-foreground rounded-bl-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                  
                  {/* Show save button for AI messages with recipes */}
                  {msg.role === 'assistant' && msg.content.length > 200 && (
                    msg.content.match(/ingredient|recipe|meal/i) && (
                      <div className="flex justify-start mt-2 ml-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSaveRecipe(msg.content)}
                          className="rounded-full text-xs"
                          data-testid={`save-recipe-${idx}`}
                        >
                          <Heart size={14} className="mr-1" />
                          Save Recipe
                        </Button>
                      </div>
                    )
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start" data-testid="loading-indicator">
                  <div className="bg-secondary rounded-2xl rounded-bl-sm px-5 py-3 flex items-center gap-2">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* Input Form */}
          <div className="flex gap-3 items-end" data-testid="message-form">
            {voiceControls && (
              <VoiceButton
                isRecording={voiceControls.isRecording}
                isProcessing={voiceControls.isProcessing}
                isMuted={voiceControls.isMuted}
                onStartRecording={voiceControls.startRecording}
                onStopRecording={voiceControls.stopRecording}
                onToggleMute={voiceControls.toggleMute}
                size="lg"
              />
            )}
            
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Tell me how you're feeling..."
              className="flex-1 rounded-2xl resize-none min-h-[60px] max-h-[120px] bg-card border-border/60 focus:border-primary"
              disabled={isLoading || (voiceControls && voiceControls.isRecording)}
              data-testid="message-input"
            />
            <Button
              onClick={handleSubmit}
              size="lg"
              disabled={isLoading || !inputMessage.trim() || (voiceControls && voiceControls.isRecording)}
              className="rounded-full px-6 bg-primary hover:bg-primary/90 active:scale-95 transition-all"
              data-testid="send-button"
            >
              <Send size={20} />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Recipe Save Confirmation Dialog */}
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
