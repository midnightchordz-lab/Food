/**
 * PHASE-1 HANDS-FREE FEATURE GATE
 * 
 * This file controls which hands-free features are active.
 * 
 * PHASE-1 MODE (PHASE_1_MODE = true):
 * ✓ Voice Narration (TTS) - Read/stop/resume/repeat steps
 * ✓ Voice Commands - "next step", "previous step", "repeat", "pause", "resume"
 * ✓ Large On-Screen Controls - Play/Pause, Next, Previous buttons
 * ✗ Camera Preview - DORMANT (code exists but not executed)
 * ✗ Gesture Detection - DORMANT (code exists but not executed)
 * ✗ AI Observer - DORMANT (code exists but not executed)
 * ✗ Motion Tracking - DORMANT (code exists but not executed)
 * 
 * To enable all features in future, set PHASE_1_MODE = false
 */

// ==========================================
// MAIN FEATURE GATE
// ==========================================
export const PHASE_1_MODE = true;

// ==========================================
// INDIVIDUAL FEATURE FLAGS (controlled by PHASE_1_MODE)
// ==========================================

/**
 * Camera features - DORMANT in Phase-1
 * When false: No camera permission requests, no video stream
 */
export const ENABLE_CAMERA_PREVIEW = !PHASE_1_MODE;

/**
 * Gesture detection - DORMANT in Phase-1
 * When false: No hand gesture listeners, no swipe detection
 */
export const ENABLE_GESTURE_DETECTION = !PHASE_1_MODE;

/**
 * AI Observer - DORMANT in Phase-1
 * When false: No motion analysis, no AI overlay UI
 */
export const ENABLE_AI_OBSERVER = !PHASE_1_MODE;

/**
 * Voice narration (TTS) - ENABLED in Phase-1
 * Text-to-speech for step reading
 */
export const ENABLE_VOICE_NARRATION = true;

/**
 * Voice commands - ENABLED in Phase-1
 * Speech recognition for "next", "previous", "repeat", "pause", "resume"
 */
export const ENABLE_VOICE_COMMANDS = true;

/**
 * Large UI controls - ENABLED in Phase-1
 * Play/Pause, Next, Previous buttons
 */
export const ENABLE_UI_CONTROLS = true;

// ==========================================
// PHASE-1 VOICE COMMANDS (Limited Set)
// ==========================================
export const PHASE_1_VOICE_COMMANDS = {
  next: ['next step', 'next', 'forward'],
  previous: ['previous step', 'previous', 'back', 'go back'],
  repeat: ['repeat', 'repeat step', 'again', 'say again'],
  pause: ['pause', 'stop'],
  resume: ['resume', 'play', 'continue'],
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Check if a feature is enabled
 * @param {string} feature - Feature name
 * @returns {boolean}
 */
export function isFeatureEnabled(feature) {
  switch (feature) {
    case 'camera':
      return ENABLE_CAMERA_PREVIEW;
    case 'gesture':
      return ENABLE_GESTURE_DETECTION;
    case 'ai_observer':
      return ENABLE_AI_OBSERVER;
    case 'voice_narration':
      return ENABLE_VOICE_NARRATION;
    case 'voice_commands':
      return ENABLE_VOICE_COMMANDS;
    case 'ui_controls':
      return ENABLE_UI_CONTROLS;
    default:
      return false;
  }
}

/**
 * Get current mode description
 * @returns {string}
 */
export function getModeDescription() {
  if (PHASE_1_MODE) {
    return 'Phase-1: Basic Voice Hands-Free (Camera/Gestures Dormant)';
  }
  return 'Full: All Features Enabled';
}

/**
 * Log feature status (for debugging)
 */
export function logFeatureStatus() {
  console.log('[HandsFree Phase-1] Feature Status:');
  console.log('  - Voice Narration:', ENABLE_VOICE_NARRATION ? '✓ ENABLED' : '✗ DISABLED');
  console.log('  - Voice Commands:', ENABLE_VOICE_COMMANDS ? '✓ ENABLED' : '✗ DISABLED');
  console.log('  - UI Controls:', ENABLE_UI_CONTROLS ? '✓ ENABLED' : '✗ DISABLED');
  console.log('  - Camera Preview:', ENABLE_CAMERA_PREVIEW ? '✓ ENABLED' : '○ DORMANT');
  console.log('  - Gesture Detection:', ENABLE_GESTURE_DETECTION ? '✓ ENABLED' : '○ DORMANT');
  console.log('  - AI Observer:', ENABLE_AI_OBSERVER ? '✓ ENABLED' : '○ DORMANT');
}

export default {
  PHASE_1_MODE,
  ENABLE_CAMERA_PREVIEW,
  ENABLE_GESTURE_DETECTION,
  ENABLE_AI_OBSERVER,
  ENABLE_VOICE_NARRATION,
  ENABLE_VOICE_COMMANDS,
  ENABLE_UI_CONTROLS,
  PHASE_1_VOICE_COMMANDS,
  isFeatureEnabled,
  getModeDescription,
  logFeatureStatus,
};
