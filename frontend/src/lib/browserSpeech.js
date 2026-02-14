/**
 * Browser Speech API - FREE Narration + Hands-Free Control
 * 
 * Phase 1: Hands-Free Speech Control + Free Narration (Web + Mobile)
 * STRICT RULE: Does NOT modify existing recipe logic or UI.
 * It only LISTENS for commands and CALLS already-existing handlers.
 * 
 * PHASE-1 VOICE RELIABILITY IMPROVEMENTS:
 * 1. Strict vocabulary filter - Only exact phrases trigger actions
 * 2. Continuous listening loop - Auto-restart via onend event
 * 3. Command confirmation delay - 400ms buffer before action
 * 4. TTS/Mic mutual exclusion - Stop TTS before listening starts
 * 5. Visual feedback callbacks - For UI state updates
 */

// --------------------------------------------------
// PHASE-1 STRICT VOCABULARY - Only these exact phrases work
// --------------------------------------------------
const STRICT_COMMANDS = {
  next: ['next', 'next step', 'forward'],
  back: ['back', 'previous', 'go back', 'previous step'],
  repeat: ['repeat', 'again', 'say again', 'repeat step'],
  pause: ['pause', 'stop'],
  resume: ['resume', 'play', 'continue'],
};

// --------------------------------------------------
// CONFIG: map voice commands → existing app functions
// Handlers are set via setHandlers() from LiveCookingModal
// --------------------------------------------------

let handlers = {
  next: () => window?.moodfood?.onNextStep?.(),
  prev: () => window?.moodfood?.onPrevStep?.(),
  pause: () => {
    stopSpeech();
    window?.moodfood?.onTogglePlay?.();
  },
  play: () => window?.moodfood?.onTogglePlay?.(),
  repeat: () => window?.moodfood?.onRepeatStep?.(),
};

// Visual feedback callbacks
let visualCallbacks = {
  onListeningStart: null,
  onListeningStop: null,
  onCommandReceived: null,
};

/**
 * Set custom handlers (called from LiveCookingModal)
 */
export function setHandlers(customHandlers) {
  handlers = {
    next: customHandlers.onNext || handlers.next,
    prev: customHandlers.onPrev || handlers.prev,
    pause: () => {
      stopSpeech();
      customHandlers.onTogglePlay?.();
    },
    play: customHandlers.onTogglePlay || handlers.play,
    repeat: customHandlers.onRepeat || handlers.repeat,
  };
}

/**
 * Set visual feedback callbacks for UI state
 */
export function setVisualCallbacks(callbacks) {
  visualCallbacks = {
    onListeningStart: callbacks.onListeningStart || null,
    onListeningStop: callbacks.onListeningStop || null,
    onCommandReceived: callbacks.onCommandReceived || null,
  };
}

// --------------------------------------------------
// FREE NARRATION using browser SpeechSynthesis (Web + Mobile)
// --------------------------------------------------

/**
 * Stop any current speech immediately
 * CRITICAL: Always call before starting new speech
 */
export function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// Alias for backwards compatibility
export const stopSpeaking = stopSpeech;

/**
 * Speak text using browser's built-in TTS (FREE)
 * @param {string} text - Text to speak
 */
export function speakText(text) {
  if (!('speechSynthesis' in window) || !text) return;

  // Always stop previous speech first (CRITICAL FIX)
  stopSpeech();

  const utterance = new SpeechSynthesisUtterance(text);

  // Natural pacing (non-robotic but still free)
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  // Try to use a natural-sounding voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => 
    v.name.includes('Google') || 
    v.name.includes('Samantha') || 
    v.name.includes('Alex') ||
    (v.lang.startsWith('en') && v.localService)
  );
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.speak(utterance);
}

// --------------------------------------------------
// VOICE COMMAND RECOGNITION (Web + Mobile Support)
// PHASE-1 RELIABILITY: Strict vocabulary + continuous loop
// --------------------------------------------------

let recognition = null;
let isListening = false;
let shouldBeListening = false; // Intent flag for auto-restart
let lastCommandTime = 0;
const COMMAND_COOLDOWN_MS = 800; // Prevent rapid double-triggers
const COMMAND_CONFIRMATION_DELAY_MS = 400; // Delay before executing command
let pendingCommandTimeout = null;

/**
 * Check if currently listening
 * @returns {boolean}
 */
export function isVoiceListening() {
  return isListening;
}

/**
 * Start listening for voice commands
 * PHASE-1: Implements continuous listening with auto-restart
 */
export function startVoiceControl() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  // If not supported (some iOS browsers), silently skip
  if (!SpeechRecognition) {
    console.log('[BrowserSpeech] Speech recognition not supported');
    return false;
  }
  
  // Already actively listening
  if (isListening && recognition) {
    console.log('[BrowserSpeech] Already listening');
    return true;
  }
  
  // If TTS is currently speaking, don't start recognition yet
  // The onend handler will start it when TTS finishes
  if (isSpeaking()) {
    console.log('[BrowserSpeech] TTS speaking, will start listening when done');
    shouldBeListening = true;
    
    // Set up a check to start when TTS finishes
    const checkAndStart = () => {
      if (!isSpeaking() && shouldBeListening && !isListening) {
        startVoiceControl();
      } else if (isSpeaking() && shouldBeListening) {
        setTimeout(checkAndStart, 500);
      }
    };
    setTimeout(checkAndStart, 500);
    return true;
  }

  // Clean up existing recognition if any
  if (recognition) {
    try {
      recognition.abort();
    } catch {}
    recognition = null;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    console.log('[BrowserSpeech] Voice commands active');
    visualCallbacks.onListeningStart?.();
  };

  recognition.onresult = (event) => {
    const transcript =
      event.results[event.results.length - 1][0].transcript
        .trim()
        .toLowerCase();

    console.log('[BrowserSpeech] Heard:', transcript);
    
    // PHASE-1: Use strict command matching with confirmation delay
    handleStrictCommand(transcript);
  };

  recognition.onerror = (event) => {
    console.log('[BrowserSpeech] Error:', event.error);
    isListening = false;
    visualCallbacks.onListeningStop?.();
    
    // Don't auto-restart on "aborted" or "not-allowed" errors
    if (event.error === 'aborted' || event.error === 'not-allowed') {
      shouldBeListening = false;
      return;
    }
    
    // For recoverable errors (network, no-speech), try restart
    if (shouldBeListening) {
      setTimeout(() => {
        if (shouldBeListening) {
          startVoiceControl();
        }
      }, 500);
    }
  };

  recognition.onend = () => {
    isListening = false;
    visualCallbacks.onListeningStop?.();
    console.log('[BrowserSpeech] Recognition ended');
    
    // PHASE-1: Continuous listening loop - auto-restart
    // BUT only if TTS is not currently speaking (mutual exclusion)
    if (shouldBeListening) {
      console.log('[BrowserSpeech] Auto-restarting for continuous listening');
      setTimeout(() => {
        if (shouldBeListening && !isListening) {
          // Check if TTS is speaking - if so, delay restart
          if (isSpeaking()) {
            console.log('[BrowserSpeech] TTS speaking, delaying restart');
            // Wait for TTS to finish, then restart
            const checkAndRestart = () => {
              if (!isSpeaking() && shouldBeListening && !isListening) {
                try {
                  recognition?.start();
                } catch (e) {
                  console.log('[BrowserSpeech] Restart failed:', e.message);
                  setTimeout(() => {
                    if (shouldBeListening) startVoiceControl();
                  }, 300);
                }
              } else if (shouldBeListening && isSpeaking()) {
                setTimeout(checkAndRestart, 500);
              }
            };
            setTimeout(checkAndRestart, 500);
            return;
          }
          
          try {
            recognition?.start();
          } catch (e) {
            console.log('[BrowserSpeech] Restart failed, will retry:', e.message);
            // Retry after a brief delay
            setTimeout(() => {
              if (shouldBeListening) startVoiceControl();
            }, 300);
          }
        }
      }, 100);
    }
  };

  // Start listening
  shouldBeListening = true;
  try {
    recognition.start();
    console.log('[BrowserSpeech] Starting voice control...');
    return true;
  } catch (e) {
    console.log('[BrowserSpeech] Start failed:', e.message);
    shouldBeListening = false;
    return false;
  }
}

/**
 * Stop listening for voice commands
 */
export function stopVoiceControl() {
  shouldBeListening = false;
  isListening = false;
  
  // Clear any pending command
  if (pendingCommandTimeout) {
    clearTimeout(pendingCommandTimeout);
    pendingCommandTimeout = null;
  }
  
  if (!recognition) return;

  try {
    recognition.abort();
  } catch {}
  recognition = null;
  
  visualCallbacks.onListeningStop?.();
  console.log('[BrowserSpeech] Voice commands stopped');
}

/**
 * Pause recognition temporarily (for TTS playback)
 * Use before starting TTS narration
 */
export function pauseVoiceControl() {
  if (!recognition || !isListening) return;
  
  try {
    recognition.stop(); // This triggers onend which auto-restarts
    // Temporarily prevent auto-restart
    const wasListening = shouldBeListening;
    shouldBeListening = false;
    
    // Resume after a short delay (let TTS start)
    setTimeout(() => {
      if (wasListening) {
        shouldBeListening = true;
      }
    }, 200);
  } catch {}
}

/**
 * Resume recognition after TTS ends
 */
export function resumeVoiceControl() {
  if (!shouldBeListening || isListening) return;
  
  // Small delay to ensure TTS has stopped
  setTimeout(() => {
    if (shouldBeListening && !isListening) {
      startVoiceControl();
    }
  }, 300);
}

// --------------------------------------------------
// COMMAND PARSING (PHASE-1: Strict vocabulary matching)
// --------------------------------------------------

/**
 * PHASE-1 STRICT COMMAND MATCHING
 * Only exact phrases from STRICT_COMMANDS trigger actions
 * Includes confirmation delay to prevent accidental triggers
 */
function handleStrictCommand(transcript) {
  if (!transcript) return;

  // Check cooldown to prevent rapid double-triggers
  const now = Date.now();
  if (now - lastCommandTime < COMMAND_COOLDOWN_MS) {
    console.log('[BrowserSpeech] Command ignored (cooldown)');
    return;
  }

  // Normalize transcript - remove punctuation, extra spaces
  const normalized = transcript
    .replace(/[.,!?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Find matching command using strict vocabulary
  let matchedAction = null;
  let matchedCommand = null;

  for (const [action, phrases] of Object.entries(STRICT_COMMANDS)) {
    for (const phrase of phrases) {
      // Check if transcript matches exactly OR ends with the phrase
      // This handles "okay next" matching "next"
      if (normalized === phrase || normalized.endsWith(phrase)) {
        matchedAction = action;
        matchedCommand = phrase;
        break;
      }
    }
    if (matchedAction) break;
  }

  if (!matchedAction) {
    console.log('[BrowserSpeech] No matching command for:', normalized);
    return;
  }

  console.log('[BrowserSpeech] Matched command:', matchedAction, 'from phrase:', matchedCommand);
  
  // Visual feedback: command received
  visualCallbacks.onCommandReceived?.(matchedAction);

  // Clear any pending command
  if (pendingCommandTimeout) {
    clearTimeout(pendingCommandTimeout);
  }

  // PHASE-1: Confirmation delay before executing
  pendingCommandTimeout = setTimeout(() => {
    lastCommandTime = Date.now();
    
    // Execute the matched action
    switch (matchedAction) {
      case 'next':
        handlers.next();
        break;
      case 'back':
        handlers.prev();
        break;
      case 'repeat':
        handlers.repeat();
        break;
      case 'pause':
        handlers.pause();
        break;
      case 'resume':
        handlers.play();
        break;
      default:
        break;
    }
    
    pendingCommandTimeout = null;
  }, COMMAND_CONFIRMATION_DELAY_MS);
}

/**
 * Legacy command handler (kept for backwards compatibility)
 * @deprecated Use handleStrictCommand for Phase-1
 */
function handleCommand(text) {
  if (!text) return;

  console.log('[BrowserSpeech] Heard:', text);

  if (text.includes('next')) return handlers.next();
  if (text.includes('previous') || text.includes('back')) return handlers.prev();
  if (text.includes('pause') || text.includes('stop')) return handlers.pause();
  if (text.includes('play') || text.includes('resume')) return handlers.play();
  if (text.includes('repeat') || text.includes('again')) return handlers.repeat();
}

// --------------------------------------------------
// STEP NARRATION SYNC
// --------------------------------------------------

let narrationTimeout = null;

/**
 * Narrate current step with sync protection
 * @param {string} stepText - The step instruction text
 * @param {boolean} isPlaying - Whether cooking is actively playing
 */
export function narrateCurrentStep(stepText, isPlaying = true) {
  // If video/recipe paused → stop narration immediately
  if (!isPlaying) {
    stopSpeech();
    return;
  }

  if (!stepText) return;

  // Clear any pending narration (CRITICAL for sync)
  if (narrationTimeout) clearTimeout(narrationTimeout);

  // Small delay for natural feel (no logic change)
  narrationTimeout = setTimeout(() => {
    speakText(stepText);
  }, 150);
}

/**
 * Narrate a cooking step with context
 * @param {string} stepText - The step instruction text
 * @param {number} stepNumber - Current step number (1-based)
 * @param {number} totalSteps - Total number of steps
 * @param {Function} onEnd - Optional callback when narration ends (not reliable with browser TTS)
 */
export function narrateStep(stepText, stepNumber, totalSteps, onEnd) {
  if (!stepText) return Promise.resolve(false);

  // Build the narration text with step context
  let narrationText = '';
  
  if (stepNumber === 1) {
    narrationText = `Let's begin. Step ${stepNumber} of ${totalSteps}. ${stepText}`;
  } else if (stepNumber === totalSteps) {
    narrationText = `Final step. ${stepText}`;
  } else {
    narrationText = `Step ${stepNumber}. ${stepText}`;
  }

  // Clear pending and speak
  if (narrationTimeout) clearTimeout(narrationTimeout);
  
  return new Promise((resolve) => {
    narrationTimeout = setTimeout(() => {
      speakText(narrationText);
      // Note: Browser SpeechSynthesis doesn't reliably fire 'end' events
      // so we resolve immediately after starting
      resolve(true);
      onEnd?.();
    }, 150);
  });
}

// --------------------------------------------------
// BASIC HAND-GESTURE FALLBACK (Web Only Safe Stub)
// --------------------------------------------------
// This does NOT implement AI vision.
// It safely connects existing gesture events (if present) to handlers.
// Prevents "gesture UI shows but nothing happens" issue.

/**
 * Connect simple swipe gesture events to an element
 * @param {HTMLElement} element - Element to attach gesture events to
 */
export function connectGestureEvents(element) {
  if (!element) return;

  let startX = 0;

  element.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  });

  element.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX;
    const diff = endX - startX;

    // Simple swipe detection with threshold
    if (Math.abs(diff) < 50) return;

    if (diff < 0) handlers.next();
    if (diff > 0) handlers.prev();
  });
}

// --------------------------------------------------
// UTILITY FUNCTIONS
// --------------------------------------------------

/**
 * Check if browser supports SpeechSynthesis
 * @returns {boolean}
 */
export function isSpeechSupported() {
  return 'speechSynthesis' in window;
}

/**
 * Check if currently speaking
 * @returns {boolean}
 */
export function isSpeaking() {
  return 'speechSynthesis' in window && window.speechSynthesis.speaking;
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
  stopSpeech,
  stopSpeaking,
  startVoiceControl,
  stopVoiceControl,
  pauseVoiceControl,
  resumeVoiceControl,
  narrateCurrentStep,
  narrateStep,
  connectGestureEvents,
  setHandlers,
  setVisualCallbacks,
  isVoiceListening,
  isSpeechSupported,
  isSpeaking,
};
