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
    
    // Handle basic navigation locally as fallback
    if (lower.includes('next') || lower.includes('continue')) {
      if (this.currentStep < steps.length - 1) {
        this.currentStep++;
        return {
          text: `Step ${this.currentStep + 1}: ${steps[this.currentStep]}`,
          step: this.currentStep,
          emotion: 'encouraging',
          navigation: 'next'
        };
      }
    }
    
    if (lower.includes('back') || lower.includes('previous')) {
      if (this.currentStep > 0) {
        this.currentStep--;
        return {
          text: `Step ${this.currentStep + 1}: ${steps[this.currentStep]}`,
          step: this.currentStep,
          emotion: 'supportive',
          navigation: 'back'
        };
      }
    }
    
    if (lower.includes('repeat')) {
      return {
        text: `Step ${this.currentStep + 1}: ${steps[this.currentStep] || 'No step available'}`,
        step: this.currentStep,
        emotion: 'patient',
        navigation: 'repeat'
      };
    }
    
    if (lower.includes('help')) {
      return {
        text: "I'm here to help! Say 'next' to continue, 'back' to go back, or 'repeat' to hear the step again.",
        step: this.currentStep,
        emotion: 'helpful'
      };
    }
    
    return {
      text: "I understand. Let me know if you need help with this step!",
      step: this.currentStep,
      emotion: 'supportive'
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
