import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, Leaf, Fish, Drumstick, Carrot, Egg, Flame, Target, RefreshCw, MousePointer } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DIETARY_PREFERENCES = [
  { id: 'vegetarian', label: 'Vegetarian', icon: Leaf, description: 'No meat or fish', color: 'text-green-600 bg-green-50 border-green-200' },
  { id: 'vegan', label: 'Vegan', icon: Carrot, description: 'No animal products', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'non-vegetarian', label: 'Non-Vegetarian', icon: Drumstick, description: 'Includes meat & poultry', color: 'text-red-600 bg-red-50 border-red-200' },
  { id: 'pescatarian', label: 'Pescatarian', icon: Fish, description: 'Fish & seafood, no meat', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'eggetarian', label: 'Eggetarian', icon: Egg, description: 'Vegetarian + eggs', color: 'text-amber-600 bg-amber-50 border-amber-200' },
];

const CALORIE_PRESETS = [
  { label: 'Weight Loss', calories: 1500, description: '~1500 cal/day', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { label: 'Maintenance', calories: 2000, description: '~2000 cal/day', color: 'text-green-600 bg-green-50 border-green-200' },
  { label: 'Active', calories: 2500, description: '~2500 cal/day', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { label: 'Muscle Gain', calories: 3000, description: '~3000 cal/day', color: 'text-red-600 bg-red-50 border-red-200' },
];

const FOCUS_AREAS = [
  'Weight Management',
  'Energy Boost',
  'Stress Relief',
  'Better Sleep',
  'Gut Health',
  'Immune Support'
];

const CUISINES = [
  'Italian',
  'Mexican',
  'Chinese',
  'Japanese',
  'Indian',
  'Thai',
  'Mediterranean',
  'Middle Eastern',
  'French',
  'Korean',
  'Vietnamese',
  'Greek'
];

const AIMealPlanGenerator = ({ open, onClose, onPlanGenerated }) => {
  const [mood, setMood] = useState('');
  const [dietaryPreference, setDietaryPreference] = useState('');
  const [calorieTarget, setCalorieTarget] = useState(2000);
  const [enableCalorieTarget, setEnableCalorieTarget] = useState(false);
  const [focusAreas, setFocusAreas] = useState([]);
  const [cuisinePreferences, setCuisinePreferences] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [generationMode, setGenerationMode] = useState('manual'); // 'manual' or 'auto'
  
  // Macro tracking state
  const [enableMacros, setEnableMacros] = useState(false);
  const [proteinTarget, setProteinTarget] = useState(150);
  const [carbsTarget, setCarbsTarget] = useState(200);
  const [fatTarget, setFatTarget] = useState(65);

  const toggleFocus = (area) => {
    setFocusAreas(prev =>
      prev.includes(area)
        ? prev.filter(item => item !== area)
        : [...prev, area]
    );
  };

  const toggleCuisine = (cuisine) => {
    setCuisinePreferences(prev =>
      prev.includes(cuisine)
        ? prev.filter(item => item !== cuisine)
        : [...prev, cuisine]
    );
  };

  const handleCaloriePreset = (calories) => {
    setCalorieTarget(calories);
    setEnableCalorieTarget(true);
    // Auto-calculate macros based on calorie preset (40% carbs, 30% protein, 30% fat)
    setProteinTarget(Math.round((calories * 0.30) / 4)); // 4 cal per gram
    setCarbsTarget(Math.round((calories * 0.40) / 4));   // 4 cal per gram
    setFatTarget(Math.round((calories * 0.30) / 9));     // 9 cal per gram
  };

  const handleGenerate = async () => {
    if (!mood.trim()) {
      toast.error('Please describe how you\'re feeling');
      return;
    }
    
    if (!dietaryPreference) {
      toast.error('Please select your dietary preference');
      return;
    }

    setGenerating(true);
    try {
      // Build macro targets object if enabled
      const macroTargets = enableMacros ? {
        protein_g: proteinTarget,
        carbs_g: carbsTarget,
        fat_g: fatTarget
      } : null;
      
      // Save preferences with the chosen generation mode
      await axios.post(`${API}/meal-preferences`, {
        dietary_preference: dietaryPreference,
        calorie_target: enableCalorieTarget ? calorieTarget : null,
        macro_targets: macroTargets,
        focus_areas: focusAreas,
        cuisine_preferences: cuisinePreferences,
        mood: mood.trim(),
        is_active: true,
        generation_mode: generationMode  // 'manual' or 'auto'
      });
      
      // Generate the meal plan
      const response = await axios.post(`${API}/weekly-plan/generate`, {
        mood: mood.trim(),
        dietary_preference: dietaryPreference,
        calorie_target: enableCalorieTarget ? calorieTarget : null,
        macro_targets: macroTargets,
        focus_areas: focusAreas,
        cuisine_preferences: cuisinePreferences
      });
      
      const modeMsg = generationMode === 'auto' 
        ? 'Auto-generation enabled! Plans will be created automatically each week.'
        : 'Plan generated! Use "Generate Next Week" button for future weeks.';
      toast.success(modeMsg);
      onPlanGenerated(response.data.plan);
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error generating plan:', error);
      toast.error('Failed to generate meal plan');
    } finally {
      setGenerating(false);
    }
  };

  const resetForm = () => {
    setMood('');
    setDietaryPreference('');
    setCalorieTarget(2000);
    setEnableCalorieTarget(false);
    setEnableMacros(false);
    setProteinTarget(150);
    setCarbsTarget(200);
    setFatTarget(65);
    setFocusAreas([]);
    setCuisinePreferences([]);
    setGenerationMode('manual');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="ai-meal-plan-dialog">
        <DialogHeader>
          <DialogTitle className="text-3xl font-serif flex items-center gap-2">
            <Sparkles className="text-accent" size={28} />
            AI Weekly Meal Plan Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div>
            <Label htmlFor="mood" className="text-lg">How are you feeling this week?</Label>
            <Textarea
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="E.g., stressed and need comfort food, energized and want to try new things, tired and need quick meals..."
              className="mt-2 rounded-xl min-h-[100px]"
              data-testid="mood-input"
            />
          </div>

          {/* Dietary Preference Section */}
          <div>
            <Label className="text-lg mb-3 block">
              Dietary Preference <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {DIETARY_PREFERENCES.map((pref) => {
                const Icon = pref.icon;
                const isSelected = dietaryPreference === pref.id;
                return (
                  <button
                    key={pref.id}
                    type="button"
                    onClick={() => setDietaryPreference(pref.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? `${pref.color} border-current ring-2 ring-offset-2`
                        : 'bg-card border-border hover:border-primary/50'
                    }`}
                    data-testid={`dietary-${pref.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/50' : 'bg-muted'}`}>
                        <Icon size={20} className={isSelected ? '' : 'text-muted-foreground'} />
                      </div>
                      <div>
                        <p className="font-medium">{pref.label}</p>
                        <p className={`text-xs ${isSelected ? '' : 'text-muted-foreground'}`}>
                          {pref.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calorie Target Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-lg flex items-center gap-2">
                <Target size={20} className="text-primary" />
                Daily Calorie Target (Optional)
              </Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enable-calories"
                  checked={enableCalorieTarget}
                  onCheckedChange={(checked) => setEnableCalorieTarget(checked)}
                  data-testid="enable-calorie-target"
                />
                <Label htmlFor="enable-calories" className="text-sm cursor-pointer">
                  Enable
                </Label>
              </div>
            </div>
            
            {enableCalorieTarget && (
              <div className="space-y-4 p-4 bg-muted/30 rounded-xl border">
                {/* Preset buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CALORIE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleCaloriePreset(preset.calories)}
                      className={`p-3 rounded-lg border-2 transition-all text-center ${
                        calorieTarget === preset.calories
                          ? `${preset.color} border-current`
                          : 'bg-card border-border hover:border-primary/50'
                      }`}
                      data-testid={`calorie-preset-${preset.calories}`}
                    >
                      <p className="font-medium text-sm">{preset.label}</p>
                      <p className="text-xs text-muted-foreground">{preset.description}</p>
                    </button>
                  ))}
                </div>
                
                {/* Custom input */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label className="text-sm text-muted-foreground mb-2 block">
                      Or set custom target:
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={1000}
                        max={5000}
                        step={100}
                        value={calorieTarget}
                        onChange={(e) => setCalorieTarget(parseInt(e.target.value) || 2000)}
                        className="w-24"
                        data-testid="calorie-input"
                      />
                      <span className="text-sm text-muted-foreground">calories/day</span>
                    </div>
                  </div>
                  <div className="text-center p-3 bg-primary/10 rounded-lg">
                    <Flame className="w-6 h-6 text-orange-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-primary">{calorieTarget}</p>
                    <p className="text-xs text-muted-foreground">cal/day</p>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  💡 Tip: Breakfast ~25%, Lunch ~35%, Dinner ~40% of daily calories
                </p>
              </div>
            )}
          </div>

          <div>
            <Label className="text-lg mb-3 block">Focus Areas (Optional)</Label>
            <div className="grid grid-cols-2 gap-3">
              {FOCUS_AREAS.map((area) => (
                <div key={area} className="flex items-center gap-2">
                  <Checkbox
                    id={`focus-${area}`}
                    checked={focusAreas.includes(area)}
                    onCheckedChange={() => toggleFocus(area)}
                    data-testid={`focus-${area}`}
                  />
                  <Label htmlFor={`focus-${area}`} className="text-sm cursor-pointer">
                    {area}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-lg mb-3 block">Cuisine Preferences (Optional)</Label>
            <div className="grid grid-cols-3 gap-3">
              {CUISINES.map((cuisine) => (
                <div key={cuisine} className="flex items-center gap-2">
                  <Checkbox
                    id={`cuisine-${cuisine}`}
                    checked={cuisinePreferences.includes(cuisine)}
                    onCheckedChange={() => toggleCuisine(cuisine)}
                    data-testid={`cuisine-${cuisine}`}
                  />
                  <Label htmlFor={`cuisine-${cuisine}`} className="text-sm cursor-pointer">
                    {cuisine}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Generation Mode Selection */}
          <div>
            <Label className="text-lg mb-3 block">
              Plan Generation Mode <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGenerationMode('manual')}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  generationMode === 'manual'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-200'
                    : 'bg-card border-border hover:border-primary/50'
                }`}
                data-testid="mode-manual"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${generationMode === 'manual' ? 'bg-blue-100' : 'bg-muted'}`}>
                    <MousePointer size={20} className={generationMode === 'manual' ? 'text-blue-600' : 'text-muted-foreground'} />
                  </div>
                  <div>
                    <p className="font-semibold">Manual Generation</p>
                    <p className={`text-sm ${generationMode === 'manual' ? 'text-blue-600' : 'text-muted-foreground'}`}>
                      Click &quot;Generate Next Week&quot; button each time you want a new plan
                    </p>
                  </div>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setGenerationMode('auto')}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  generationMode === 'auto'
                    ? 'bg-green-50 border-green-500 text-green-700 ring-2 ring-green-200'
                    : 'bg-card border-border hover:border-primary/50'
                }`}
                data-testid="mode-auto"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${generationMode === 'auto' ? 'bg-green-100' : 'bg-muted'}`}>
                    <RefreshCw size={20} className={generationMode === 'auto' ? 'text-green-600' : 'text-muted-foreground'} />
                  </div>
                  <div>
                    <p className="font-semibold">Auto Generation</p>
                    <p className={`text-sm ${generationMode === 'auto' ? 'text-green-600' : 'text-muted-foreground'}`}>
                      Automatically generates unique plans every week
                    </p>
                  </div>
                </div>
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {generationMode === 'auto' 
                ? '✨ Auto mode: New plans appear automatically each week with unique, non-repeating recipes'
                : '👆 Manual mode: You control when new plans are generated'}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 rounded-full bg-primary hover:bg-primary/90"
              data-testid="generate-plan-button"
            >
              {generating ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2" size={18} />
                  Generate My Plan
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onClose();
                resetForm();
              }}
              className="flex-1 rounded-full"
              data-testid="cancel-generate-button"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIMealPlanGenerator;