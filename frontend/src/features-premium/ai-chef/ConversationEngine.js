/**
 * Conversation Engine - Handles AI conversation via secure backend
 * 100% isolated - no dependencies on existing code
 * Uses backend API for AI calls (no frontend API keys exposed)
 */

import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

class ConversationEngine {
  constructor() {
    this.conversationHistory = [];
    this.currentRecipe = null;
    this.currentStep = 0;
  }

  setRecipe(recipe) {
    this.currentRecipe = recipe;
    this.currentStep = 0;
    this.conversationHistory = [];
  }

  getRecipeContext() {
    const recipe = this.currentRecipe;
    if (!recipe) return {};
    
    return {
      title: recipe.title || 'Unknown Recipe',
      servings: recipe.servings || 'Not specified',
      prepTime: recipe.prepTime || 'Not specified',
      cookTime: recipe.cookTime || 'Not specified',
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || []
    };
  }

  async chat(userMessage) {
    // Add user message to local history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API_URL}/api/chat/ai-chef/chat`,
        {
          message: userMessage,
          recipe_context: this.getRecipeContext(),
          conversation_history: this.conversationHistory.slice(-10),
          current_step: this.currentStep
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = response.data;
      
      // Update current step from response
      this.currentStep = result.step;
      
      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: result.text
      });

      return {
        text: result.text,
        step: result.step,
        emotion: result.emotion || 'neutral',
        navigation: result.navigation
      };

    } catch (error) {
      console.error('[ConversationEngine] API error:', error);
      return this.getFallbackResponse(userMessage);
    }
  }

  getFallbackResponse(userMessage) {
    const lower = userMessage.toLowerCase();
    const steps = this.currentRecipe?.instructions || [];
    const currentInstruction = steps[this.currentStep] || '';
    
    // Natural transition phrases
    const nextPhrases = [
      `Perfect! Alright, now we're gonna ${steps[this.currentStep + 1]?.toLowerCase() || 'move on'}`,
      `Nice work! Okay so next up - ${steps[this.currentStep + 1] || 'we continue'}`,
      `Awesome! Looking great! Now let's ${steps[this.currentStep + 1] || 'keep going'}`
    ];
    
    const backPhrases = [
      `No worries! Let's take it back. We were doing: ${steps[this.currentStep - 1] || 'the previous step'}`,
      `Of course! Here's where we were: ${steps[this.currentStep - 1] || 'going back'}`,
      `Got it! Let's rewind a bit: ${steps[this.currentStep - 1] || 'previous step'}`
    ];
    
    const repeatPhrases = [
      `Sure thing! So what we're doing is: ${currentInstruction}`,
      `Of course! Here it is again: ${currentInstruction}`,
      `No problem! We're at: ${currentInstruction}`
    ];
    
    const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
    
    // Handle basic navigation locally as fallback
    if (lower.includes('next') || lower.includes('continue') || lower.includes('done')) {
      if (this.currentStep < steps.length - 1) {
        this.currentStep++;
        return {
          text: randomChoice(nextPhrases),
          step: this.currentStep,
          emotion: 'encouraging',
          navigation: 'next'
        };
      } else {
        return {
          text: `And we're done! Your ${this.currentRecipe?.title || 'dish'} looks amazing! You crushed it!`,
          step: this.currentStep,
          emotion: 'celebratory',
          navigation: 'complete'
        };
      }
    }
    
    if (lower.includes('back') || lower.includes('previous')) {
      if (this.currentStep > 0) {
        this.currentStep--;
        return {
          text: randomChoice(backPhrases),
          step: this.currentStep,
          emotion: 'supportive',
          navigation: 'back'
        };
      }
    }
    
    if (lower.includes('repeat') || lower.includes('again')) {
      return {
        text: randomChoice(repeatPhrases),
        step: this.currentStep,
        emotion: 'patient',
        navigation: 'repeat'
      };
    }
    
    if (lower.includes('help') || lower.includes('stuck')) {
      return {
        text: `Hey, I got you! We're working on: ${currentInstruction}. What part is tricky? Just say "next" when you're ready, "back" to go back, or ask me anything!`,
        step: this.currentStep,
        emotion: 'helpful'
      };
    }
    
    // Default friendly response
    const defaultResponses = [
      "Got it! Let me know when you're ready to move on!",
      "Sounds good! Say 'next' when you're ready to continue!",
      "Alright! Take your time, I'm here when you need me!"
    ];
    
    return {
      text: randomChoice(defaultResponses),
      step: this.currentStep,
      emotion: 'friendly'
    };
  }

  getCurrentStep() {
    return this.currentStep;
  }

  getTotalSteps() {
    return this.currentRecipe?.instructions?.length || 0;
  }

  reset() {
    this.conversationHistory = [];
    this.currentRecipe = null;
    this.currentStep = 0;
  }
}

export const conversationEngine = new ConversationEngine();
export default conversationEngine;
