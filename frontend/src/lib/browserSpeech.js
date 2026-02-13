/**
 * Browser Speech API - FREE Narration Fallback
 * 
 * Uses browser's built-in SpeechSynthesis for narration when ElevenLabs is unavailable.
 * Works on Chrome Android, Safari iOS, and desktop browsers.
 * 
 * STRICT RULE: Does NOT modify existing recipe logic or UI.
 * It only provides speech functions that can be called by existing handlers.
 */

// --------------------------------------------------
// FREE NARRATION using browser SpeechSynthesis
// Works on Web + Mobile (Chrome, Safari, Firefox)
// --------------------------------------------------

let currentUtterance = null;
let onEndCallback = null;

/**
 * Speak text using browser's built-in TTS (FREE)
 * @param {string} text - Text to speak
 * @param {Object} options - Optional settings
 * @param {number} options.rate - Speech rate (0.5-2, default 0.95)
 * @param {number} options.pitch - Voice pitch (0-2, default 1)
 * @param {Function} options.onEnd - Callback when speech ends
 * @returns {boolean} - Whether speech started successfully
 */
export function speakText(text, options = {}) {
  if (!('speechSynthesis' in window) || !text) {
    console.log('[BrowserSpeech] SpeechSynthesis not supported or no text');
    return false;
  }

  // Stop any current speech immediately (keeps sync correct)
  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(text);

  // Natural pacing settings (non-robotic but still free)
  utterance.rate = options.rate ?? 0.95;
  utterance.pitch = options.pitch ?? 1;
  utterance.volume = 1;

  // Try to use a natural-sounding voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => 
    v.name.includes('Google') || 
    v.name.includes('Samantha') || 
    v.name.includes('Alex') ||
    v.lang.startsWith('en')
  );
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  // Handle end callback
  if (options.onEnd) {
    onEndCallback = options.onEnd;
    utterance.onend = () => {
      currentUtterance = null;
      onEndCallback?.();
    };
  } else {
    utterance.onend = () => {
      currentUtterance = null;
    };
  }

  utterance.onerror = (e) => {
    console.log('[BrowserSpeech] Speech error:', e.error);
    currentUtterance = null;
  };

  currentUtterance = utterance;
  
  try {
    window.speechSynthesis.speak(utterance);
    console.log('[BrowserSpeech] Speaking:', text.substring(0, 50) + '...');
    return true;
  } catch (e) {
    console.error('[BrowserSpeech] Failed to speak:', e);
    return false;
  }
}

/**
 * Stop any currently playing speech
 */
export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
}

/**
 * Check if currently speaking
 * @returns {boolean}
 */
export function isSpeaking() {
  return 'speechSynthesis' in window && window.speechSynthesis.speaking;
}

/**
 * Check if browser supports SpeechSynthesis
 * @returns {boolean}
 */
export function isSpeechSupported() {
  return 'speechSynthesis' in window;
}

// --------------------------------------------------
// STEP NARRATION HELPER
// Adds natural timing for cooking step narration
// --------------------------------------------------

/**
 * Narrate a cooking step with natural pacing
 * @param {string} stepText - The step instruction text
 * @param {number} stepNumber - Current step number (1-based)
 * @param {number} totalSteps - Total number of steps
 * @param {Function} onEnd - Optional callback when narration ends
 */
export function narrateStep(stepText, stepNumber, totalSteps, onEnd) {
  if (!stepText) return false;

  // Build the narration text with step context
  let narrationText = '';
  
  if (stepNumber === 1) {
    narrationText = `Let's begin. Step ${stepNumber} of ${totalSteps}. ${stepText}`;
  } else if (stepNumber === totalSteps) {
    narrationText = `Final step. ${stepText}`;
  } else {
    narrationText = `Step ${stepNumber}. ${stepText}`;
  }

  // Small warm-up delay for natural feel (like clearing throat)
  return new Promise((resolve) => {
    setTimeout(() => {
      const success = speakText(narrationText, {
        rate: 0.92, // Slightly slower for cooking instructions
        onEnd: () => {
          onEnd?.();
          resolve(true);
        }
      });
      if (!success) resolve(false);
    }, 150);
  });
}

// --------------------------------------------------
// EMOTIONAL PHRASES (simple additions for personality)
// --------------------------------------------------

const ENCOURAGEMENTS = [
  "You're doing great!",
  "Perfect, keep going.",
  "Nicely done.",
  "That looks wonderful.",
];

const TRANSITIONS = [
  "Moving on.",
  "Next up.",
  "Alright, let's continue.",
  "Great, now for the next step.",
];

/**
 * Speak a random encouragement phrase
 */
export function speakEncouragement() {
  const phrase = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
  speakText(phrase, { rate: 1.0 });
}

/**
 * Speak a random transition phrase
 */
export function speakTransition() {
  const phrase = TRANSITIONS[Math.floor(Math.random() * TRANSITIONS.length)];
  speakText(phrase, { rate: 1.0 });
}

// Load voices on page load (needed for some browsers)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  // Chrome needs this event to populate voices
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

export default {
  speakText,
  stopSpeaking,
  isSpeaking,
  isSpeechSupported,
  narrateStep,
  speakEncouragement,
  speakTransition,
};
