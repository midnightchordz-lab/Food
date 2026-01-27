import { Sun, Coffee, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MEAL_TYPES = [
  { 
    id: 'breakfast', 
    label: 'Breakfast', 
    icon: Coffee, 
    emoji: '🌅',
    color: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/30',
    description: 'Start your day right'
  },
  { 
    id: 'lunch', 
    label: 'Lunch', 
    icon: Sun, 
    emoji: '🌞',
    color: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-orange-500/30',
    description: 'Midday fuel'
  },
  { 
    id: 'dinner', 
    label: 'Dinner', 
    icon: Moon, 
    emoji: '🌙',
    color: 'bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 border-indigo-500/30',
    description: 'Evening comfort'
  },
];

const MealTypeSelector = ({ onSelect, selectedMealType }) => {
  return (
    <div className="meal-type-selector" data-testid="meal-type-selector">
      <p className="text-lg font-serif mb-4 text-foreground">What meal are you planning?</p>
      <div className="flex flex-wrap gap-3">
        {MEAL_TYPES.map((meal) => {
          const Icon = meal.icon;
          const isSelected = selectedMealType === meal.id;
          return (
            <Button
              key={meal.id}
              variant="outline"
              onClick={() => onSelect(meal.id, meal.label)}
              className={`rounded-full px-5 py-3 h-auto border-2 transition-all duration-300 flex items-center gap-2 ${
                isSelected 
                  ? `${meal.color} ring-2 ring-offset-2` 
                  : meal.color
              }`}
              data-testid={`meal-type-${meal.id}`}
            >
              <span className="text-xl">{meal.emoji}</span>
              <span className="font-medium">{meal.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default MealTypeSelector;
export { MEAL_TYPES };
