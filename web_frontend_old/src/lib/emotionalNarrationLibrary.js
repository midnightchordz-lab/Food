/**
 * Emotional Narration Library
 * 
 * Text variations for emotional voice guidance throughout the cooking journey.
 * Each category has multiple variations to prevent repetition.
 * 
 * IMPORTANT: This is TEXT ONLY - no logic, no UI, no API changes.
 * Text is sent through the existing voice playback system.
 */

// Opening narration when cooking mode starts
export const OPENING_NARRATIONS = {
  happy: [
    "Welcome to your kitchen adventure! Let's create something wonderful together.",
    "What a perfect time to cook! I'm here with you every step of the way.",
    "Let's make something delicious! Your kitchen is about to smell amazing.",
  ],
  calm: [
    "Take a deep breath. We're going to cook together, one peaceful step at a time.",
    "Welcome. There's no rush here. Let's create something nourishing together.",
    "The kitchen is your sanctuary today. Let's begin this gentle journey.",
  ],
  stressed: [
    "I know things might feel overwhelming, but cooking can be meditative. Let's take it slow.",
    "One step at a time. Just follow my voice, and we'll create something comforting together.",
    "Leave your worries at the kitchen door. This is your time to breathe and create.",
  ],
  tired: [
    "I'll keep this simple and easy. Just follow along, and we'll have something delicious soon.",
    "No complicated techniques today. Let's make something satisfying without any fuss.",
    "Rest your mind and let me guide you. We've got this together.",
  ],
  excited: [
    "Oh, this is going to be amazing! Let's dive right in!",
    "I can feel the energy! Let's create something spectacular together!",
    "Your enthusiasm is contagious! Let's make cooking magic happen!",
  ],
  cozy: [
    "Let's fill your home with warmth and wonderful aromas.",
    "There's nothing quite like homemade comfort food. Let's begin.",
    "Wrap yourself in the joy of cooking something soul-warming.",
  ],
  romantic: [
    "Let's create something special for someone you love.",
    "Cooking with love makes everything taste better. Let's begin.",
    "Every dish tells a story. Let's make this one memorable.",
  ],
  default: [
    "Welcome! Let's cook something wonderful together.",
    "I'm here to guide you through every step. Let's begin!",
    "Your culinary adventure starts now. Let's make it delicious.",
  ],
};

// Step start guidance - played at the beginning of each step
export const STEP_START_GUIDANCE = {
  first_step: [
    "Let's begin with our first step.",
    "Here we go! Starting with step one.",
    "First things first.",
  ],
  middle_step: [
    "Moving along beautifully. Next up...",
    "You're doing great. Now...",
    "Wonderful progress. Let's continue...",
    "Perfect. Here's what's next...",
    "Nicely done. Moving on to...",
  ],
  near_end: [
    "We're getting close now.",
    "Almost there! Just a few more steps.",
    "The finish line is in sight.",
  ],
  final_step: [
    "This is our final step!",
    "One last thing, and we're done!",
    "The grand finale!",
  ],
};

// Sensory cues - subtle prompts during quiet moments
export const SENSORY_CUES = {
  visual: [
    "Notice how the colors are changing.",
    "Watch for that golden color.",
    "See how it's coming together beautifully.",
  ],
  aroma: [
    "Take a moment to enjoy that wonderful aroma.",
    "Breathe in that delicious smell.",
    "Your kitchen smells amazing right now.",
  ],
  sound: [
    "Listen for that gentle sizzle.",
    "Can you hear it cooking?",
    "That sound means it's working perfectly.",
  ],
  texture: [
    "Feel how the texture has changed.",
    "Notice the consistency now.",
    "It should feel just right.",
  ],
  general: [
    "Everything is coming together nicely.",
    "This is looking wonderful.",
    "You're doing beautifully.",
  ],
};

// Encouragement lines - after completing key actions
export const ENCOURAGEMENTS = {
  gentle: [
    "Lovely work.",
    "That's perfect.",
    "Beautifully done.",
    "Just right.",
    "Wonderful.",
  ],
  affirming: [
    "You've got this.",
    "Exactly as it should be.",
    "That's the way.",
    "Perfect technique.",
    "You're a natural.",
  ],
  supportive: [
    "Don't worry, you're doing great.",
    "Trust yourself, it looks perfect.",
    "See? You've got this.",
    "Your instincts are spot on.",
  ],
};

// Waiting/timer support - during waiting periods
export const WAITING_SUPPORT = {
  timer_start: [
    "Now we wait. This is a good moment to relax.",
    "Let it do its magic while you take a breather.",
    "The waiting is part of the process. Enjoy this moment.",
    "Time to let the heat do the work.",
    "A perfect pause in our cooking journey.",
  ],
  timer_middle: [
    "Still cooking away nicely.",
    "Patience makes perfect.",
    "It's working its magic.",
    "Just a bit longer now.",
  ],
  timer_near_end: [
    "Almost ready now.",
    "Just a few moments more.",
    "Get ready, we're nearly there.",
    "Time to prepare for the next step.",
  ],
};

// Reassurance for mistakes/repeats/pauses
export const MISTAKE_REASSURANCE = {
  repeat_requested: [
    "Of course, let me explain that again.",
    "No problem at all. Let's go through that once more.",
    "Happy to repeat that for you.",
    "Let me say that again, nice and clear.",
  ],
  pause_detected: [
    "Take your time. There's no rush.",
    "I'm here whenever you're ready.",
    "No worries, go at your own pace.",
    "I'll wait right here with you.",
  ],
  step_back: [
    "Let's go back and make sure we've got it right.",
    "Good thinking. Let's review that step.",
    "It's always better to double-check.",
    "No problem, let's revisit that.",
  ],
  general_mistake: [
    "Don't worry, cooking is about learning. Let's continue.",
    "Even the best chefs make adjustments. You're doing fine.",
    "It's all part of the journey. Let's keep going.",
    "No stress at all. We can work with this.",
  ],
};

// Completion transitions - between steps
export const COMPLETION_TRANSITIONS = {
  smooth: [
    "Perfect. Let's move on.",
    "Excellent. Ready for the next step.",
    "Done beautifully. Moving forward.",
    "That's complete. Here's what's next.",
  ],
  encouraging: [
    "You nailed it! Onto the next one.",
    "Wonderful work. Keep that momentum going.",
    "Fantastic! Let's continue.",
    "Brilliantly done. Next up...",
  ],
  calm: [
    "Gently moving to the next step.",
    "When you're ready, let's continue.",
    "Take a breath, and we'll proceed.",
  ],
};

// Final dish reveal and closing
export const FINAL_NARRATIONS = {
  reveal: [
    "And there it is! Look at what you've created.",
    "Behold your masterpiece! This looks absolutely wonderful.",
    "You did it! This dish is ready to be enjoyed.",
    "Take a moment to admire your creation. Beautiful!",
  ],
  closing: {
    happy: [
      "Enjoy every bite of your creation! Until next time, happy cooking!",
      "You brought joy into the kitchen today. Savor it!",
      "What a delicious success! See you in the kitchen again soon!",
    ],
    calm: [
      "May this meal bring you peace and nourishment. Until we cook again.",
      "You've created something truly special. Enjoy it mindfully.",
      "A gentle ending to our cooking journey. Bon appétit.",
    ],
    tired: [
      "You made it! Now sit down, relax, and enjoy what you've made.",
      "Well deserved rest is next. Enjoy your meal!",
      "Great job pushing through! Now enjoy the reward.",
    ],
    excited: [
      "Yes! You crushed it! Now dig in and enjoy every bite!",
      "That was amazing! Time to taste your incredible creation!",
      "What a journey! Now comes the best part - eating!",
    ],
    default: [
      "Congratulations on completing your dish! Enjoy your meal.",
      "Wonderful cooking session! Time to savor your creation.",
      "You did beautifully. Enjoy every bite!",
    ],
  },
};

/**
 * Helper function to get random variation from array
 * Ensures we don't repeat the same line consecutively
 */
let lastSelections = {};

export function getRandomVariation(category, subcategory = null, mood = 'default') {
  let variations;
  
  if (subcategory) {
    variations = category[subcategory]?.[mood] || 
                 category[subcategory]?.default || 
                 category[subcategory] ||
                 category.default ||
                 [];
  } else {
    variations = category[mood] || category.default || [];
  }
  
  if (!variations || variations.length === 0) {
    return null; // Silently skip if no text available
  }
  
  // Create a key for tracking last selection
  const trackingKey = `${JSON.stringify(category).substring(0, 20)}-${subcategory}-${mood}`;
  
  // Filter out the last selection to avoid repetition
  let availableVariations = variations;
  if (lastSelections[trackingKey] && variations.length > 1) {
    availableVariations = variations.filter(v => v !== lastSelections[trackingKey]);
  }
  
  // Pick random variation
  const selected = availableVariations[Math.floor(Math.random() * availableVariations.length)];
  
  // Track this selection
  lastSelections[trackingKey] = selected;
  
  return selected;
}

/**
 * Reset selection tracking (call when cooking session ends)
 */
export function resetSelectionTracking() {
  lastSelections = {};
}

/**
 * Get step position category based on step number and total
 */
export function getStepPosition(stepNumber, totalSteps) {
  if (stepNumber === 1) return 'first_step';
  if (stepNumber === totalSteps) return 'final_step';
  if (stepNumber >= totalSteps - 2) return 'near_end';
  return 'middle_step';
}
