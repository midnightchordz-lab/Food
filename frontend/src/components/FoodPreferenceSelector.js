import { Leaf, Fish, Drumstick, Salad, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FOOD_PREFERENCES = [
  { id: 'vegetarian', label: 'Vegetarian', icon: Leaf, color: 'bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/30' },
  { id: 'vegan', label: 'Vegan', icon: Salad, color: 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30' },
  { id: 'non-vegetarian', label: 'Non-Vegetarian', icon: Drumstick, color: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-orange-500/30' },
  { id: 'pescatarian', label: 'Pescatarian', icon: Fish, color: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/30' },
  { id: 'any', label: 'Any', icon: Sparkles, color: 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-500/30' },
];

const FoodPreferenceSelector = ({ onSelect, selectedPreference }) => {
  return (
    <div className="food-preference-selector" data-testid="food-preference-selector">
      <p className="text-lg font-serif mb-4 text-foreground">What's your food preference today?</p>
      <div className="flex flex-wrap gap-3">
        {FOOD_PREFERENCES.map((pref) => {
          const Icon = pref.icon;
          const isSelected = selectedPreference === pref.id;
          return (
            <Button
              key={pref.id}
              variant="outline"
              onClick={() => onSelect(pref.id, pref.label)}
              className={`rounded-full px-5 py-2 h-auto border-2 transition-all duration-300 ${
                isSelected 
                  ? `${pref.color} ring-2 ring-offset-2 ring-${pref.color.split('-')[1]}-500/50` 
                  : pref.color
              }`}
              data-testid={`preference-${pref.id}`}
            >
              <Icon size={18} className="mr-2" />
              {pref.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default FoodPreferenceSelector;
export { FOOD_PREFERENCES };
