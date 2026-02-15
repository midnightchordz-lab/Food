/**
 * Conversation Engine - Handles AI conversation with OpenAI GPT
 * 100% isolated - no dependencies on existing code
 */

import axios from 'axios';

class ConversationEngine {
  constructor() {
    this.conversationHistory = [];
    this.currentRecipe = null;
    this.currentStep = 0;
    this.apiKey = process.env.REACT_APP_OPENAI_KEY;
  }

  setRecipe(recipe) {
    this.currentRecipe = recipe;
    this.currentStep = 0;
    this.conversationHistory = [];
    
    // Initialize with recipe context
    this.conversationHistory.push({
      role: 'system',
      content: this.buildSystemPrompt()
    });
  }

  buildSystemPrompt() {
    const recipe = this.currentRecipe;
    if (!recipe) return '';

    return `You are a warm, friendly AI chef assistant helping someone cook "${recipe.title}". 

RECIPE DETAILS:
- Title: ${recipe.title}
- Servings: ${recipe.servings || 'Not specified'}
- Prep Time: ${recipe.prepTime || 'Not specified'}
- Cook Time: ${recipe.cookTime || 'Not specified'}

INGREDIENTS:
${(recipe.ingredients || []).map(i => `- ${i}`).join('\n')}

INSTRUCTIONS:
${(recipe.instructions || []).map((step, i) => `Step ${i + 1}: ${step}`).join('\n')}

YOUR PERSONALITY:
- Be warm, encouraging, and patient
- Use casual, friendly language
- Add cooking tips when relevant
- Be enthusiastic about food
- Keep responses concise (2-3 sentences max)
- Guide through steps naturally

RESPOND TO:
- "next" → Move to next step
- "back" / "previous" → Go back a step
- "repeat" → Repeat current step
- Questions about ingredients, substitutions, techniques
- General cooking questions

Current step: ${this.currentStep + 1} of ${(recipe.instructions || []).length}`;
  }

  async chat(userMessage) {
    if (!this.apiKey) {
      console.error('[ConversationEngine] No API key configured');
      return this.getFallbackResponse(userMessage);
    }

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    // Handle navigation commands locally
    const navResponse = this.handleNavigationCommand(userMessage);
    if (navResponse) {
      this.conversationHistory.push({
        role: 'assistant',
        content: navResponse.text
      });
      return navResponse;
    }

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: this.conversationHistory,
          max_tokens: 150,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const assistantMessage = response.data.choices[0].message.content;
      
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage
      });

      return {
        text: assistantMessage,
        step: this.currentStep,
        emotion: this.detectEmotion(assistantMessage)
      };

    } catch (error) {
      console.error('[ConversationEngine] API error:', error);
      return this.getFallbackResponse(userMessage);
    }
  }

  handleNavigationCommand(message) {
    const lower = message.toLowerCase().trim();
    const steps = this.currentRecipe?.instructions || [];
    
    if (lower.includes('next') || lower.includes('continue')) {
      if (this.currentStep < steps.length - 1) {
        this.currentStep++;
        return {
          text: `Great job! Step ${this.currentStep + 1}: ${steps[this.currentStep]}`,
          step: this.currentStep,
          emotion: 'encouraging',
          navigation: 'next'
        };
      } else {
        return {
          text: "You've completed all the steps! Amazing work, chef! Your dish is ready!",
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
          text: `No problem, let's go back. Step ${this.currentStep + 1}: ${steps[this.currentStep]}`,
          step: this.currentStep,
          emotion: 'supportive',
          navigation: 'back'
        };
      } else {
        return {
          text: "We're already at the first step. Here it is again: " + steps[0],
          step: this.currentStep,
          emotion: 'helpful',
          navigation: 'stay'
        };
      }
    }
    
    if (lower.includes('repeat') || lower.includes('again')) {
      return {
        text: `Of course! Step ${this.currentStep + 1}: ${steps[this.currentStep]}`,
        step: this.currentStep,
        emotion: 'patient',
        navigation: 'repeat'
      };
    }

    return null; // Not a navigation command
  }

  getFallbackResponse(userMessage) {
    const lower = userMessage.toLowerCase();
    
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

  detectEmotion(text) {
    const lower = text.toLowerCase();
    
    if (lower.includes('great') || lower.includes('perfect') || lower.includes('excellent')) {
      return 'encouraging';
    }
    if (lower.includes('done') || lower.includes('complete') || lower.includes('finished')) {
      return 'celebratory';
    }
    if (lower.includes('tip') || lower.includes('trick') || lower.includes('try')) {
      return 'informative';
    }
    if (lower.includes('careful') || lower.includes('watch') || lower.includes('attention')) {
      return 'cautioning';
    }
    
    return 'neutral';
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
