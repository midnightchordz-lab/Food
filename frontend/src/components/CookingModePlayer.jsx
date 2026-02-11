/**
 * Cooking Mode Player
 * Reads each step aloud as user cooks
 * Supports all 14 languages
 */
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Volume2, ChevronLeft, ChevronRight, RotateCcw, Loader2, Check, Play } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { useAuth } from '../context/AuthContext';
import { isNative, platform, hapticFeedback } from '../capacitor';

const API = process.env.REACT_APP_BACKEND_URL;

const CookingModePlayer = ({ recipe, language = 'en', onClose }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const audioRef = useRef(null);
  
  // Get instructions from recipe
  const steps = recipe?.instructions || recipe?.steps || recipe?.directions || [];
  
  const isPremium = user?.subscriptionTier !== 'free';

  const readCurrentStep = async (stepIndex) => {
    if (stepIndex >= steps.length || stepIndex < 0) return;
    
    // Check premium for non-English
    if (!isPremium && language !== 'en') {
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/audio/step`,
        {
          stepText: typeof steps[stepIndex] === 'string' ? steps[stepIndex] : steps[stepIndex].text || steps[stepIndex].instruction,
          stepNumber: stepIndex + 1,
          totalSteps: steps.length,
          language: language
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success && audioRef.current) {
        const fullUrl = response.data.audioUrl.startsWith('http')
          ? response.data.audioUrl
          : `${API}${response.data.audioUrl}`;
        
        audioRef.current.src = fullUrl;
        audioRef.current.play().catch(e => console.error('Play failed:', e));
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Step audio error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepComplete = () => {
    setIsPlaying(false);
    
    // Mark step as completed
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    
    // Auto-advance if enabled
    if (autoAdvance && currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setTimeout(() => readCurrentStep(nextStep), 1000);
    }
  };

  const goToStep = (index) => {
    if (index >= 0 && index < steps.length) {
      // Haptic feedback on step change
      if (isNative) {
        hapticFeedback('light');
      }
      setCurrentStep(index);
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const toggleStepCompletion = (index) => {
    // Haptic feedback on completion toggle
    if (isNative) {
      hapticFeedback('medium');
    }
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const getStepText = (step) => {
    if (typeof step === 'string') return step;
    return step.text || step.instruction || step.description || String(step);
  };

  if (!steps || steps.length === 0) {
    return (
      <div className="cooking-mode-player p-4 bg-stone-50 rounded-xl text-center">
        <p className="text-stone-500">No cooking instructions available</p>
      </div>
    );
  }

  return (
    <div className="cooking-mode-player bg-white rounded-xl border border-stone-200 shadow-lg overflow-hidden" data-testid="cooking-mode-player">
      {/* Audio Element */}
      <audio
        ref={audioRef}
        onEnded={handleStepComplete}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-amber-50 px-4 py-3 border-b border-stone-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-stone-800">Cooking Mode</h3>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <Switch
                checked={autoAdvance}
                onCheckedChange={setAutoAdvance}
              />
              Auto-advance
            </label>
            
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Exit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Step Progress */}
      <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-stone-700">
            Step {currentStep + 1} of {steps.length}
          </span>
          <span className="text-xs text-stone-500">
            {completedSteps.size} completed
          </span>
        </div>
        
        {/* Step dots/progress */}
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <button
              key={i}
              className={`flex-1 h-2 rounded-full transition-all ${
                i === currentStep 
                  ? 'bg-primary' 
                  : completedSteps.has(i)
                    ? 'bg-green-500'
                    : 'bg-stone-200'
              }`}
              onClick={() => goToStep(i)}
              data-testid={`step-dot-${i}`}
            />
          ))}
        </div>
      </div>

      {/* Current Step Card */}
      <div className="p-4">
        <div 
          className={`p-4 rounded-xl border-2 transition-all ${
            isPlaying 
              ? 'border-primary bg-primary/5 shadow-md' 
              : completedSteps.has(currentStep)
                ? 'border-green-200 bg-green-50'
                : 'border-stone-200 bg-white'
          }`}
        >
          <div className="flex items-start gap-3">
            <button
              className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                completedSteps.has(currentStep)
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-stone-300 hover:border-primary'
              }`}
              onClick={() => toggleStepCompletion(currentStep)}
            >
              {completedSteps.has(currentStep) && <Check className="w-4 h-4" />}
            </button>
            
            <p className={`text-stone-700 leading-relaxed ${
              completedSteps.has(currentStep) ? 'line-through text-stone-400' : ''
            }`}>
              {getStepText(steps[currentStep])}
            </p>
          </div>

          {/* Audio waves animation when playing */}
          {isPlaying && (
            <div className="flex items-center justify-center gap-1 mt-3">
              <span className="w-1 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-6 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              <span className="w-1 h-5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '450ms' }} />
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 pb-4">
        <Button
          variant="outline"
          size="sm"
          disabled={currentStep === 0}
          onClick={() => goToStep(currentStep - 1)}
          className="flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>

        <Button
          variant="default"
          size="sm"
          className={`flex items-center gap-2 ${isLoading ? 'bg-primary/80' : ''}`}
          onClick={() => readCurrentStep(currentStep)}
          disabled={isLoading}
          data-testid="read-step-btn"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </>
          ) : isPlaying ? (
            <>
              <RotateCcw className="w-4 h-4" />
              Re-read
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Read Step
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={currentStep === steps.length - 1}
          onClick={() => goToStep(currentStep + 1)}
          className="flex items-center gap-1"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default CookingModePlayer;
