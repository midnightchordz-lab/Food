import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, Leaf, Fish, Drumstick, Carrot, Egg } from 'lucide-react';
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
  const [focusAreas, setFocusAreas] = useState([]);
  const [cuisinePreferences, setCuisinePreferences] = useState([]);
  const [generating, setGenerating] = useState(false);

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
      const response = await axios.post(`${API}/weekly-plan/generate`, {
        mood: mood.trim(),
        dietary_preference: dietaryPreference,
        focus_areas: focusAreas,
        cuisine_preferences: cuisinePreferences
      });
      
      toast.success('AI meal plan generated successfully!');
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
    setFocusAreas([]);
    setCuisinePreferences([]);
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