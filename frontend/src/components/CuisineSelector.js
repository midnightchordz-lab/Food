import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

const CUISINES = [
  { id: 'mexican', label: 'Mexican', emoji: '🌮', color: 'bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/30' },
  { id: 'italian', label: 'Italian', emoji: '🍝', color: 'bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/30' },
  { id: 'chinese', label: 'Chinese', emoji: '🍜', color: 'bg-red-600/10 text-red-700 hover:bg-red-600/20 border-red-600/30' },
  { id: 'indian', label: 'Indian', emoji: '🍛', color: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-orange-500/30' },
  { id: 'japanese', label: 'Japanese', emoji: '🍱', color: 'bg-pink-500/10 text-pink-600 hover:bg-pink-500/20 border-pink-500/30' },
  { id: 'thai', label: 'Thai', emoji: '🍜', color: 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30' },
  { id: 'mediterranean', label: 'Mediterranean', emoji: '🥙', color: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/30' },
  { id: 'american', label: 'American', emoji: '🍔', color: 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/30' },
  { id: 'korean', label: 'Korean', emoji: '🍲', color: 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-500/30' },
  { id: 'middleeastern', label: 'Middle Eastern', emoji: '🥘', color: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/30' },
  { id: 'any', label: 'Surprise Me', emoji: '🌍', color: 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-500/30', isSpecial: true },
];

const CuisineSelector = ({ onSelect, selectedCuisines = [], allowMultiple = true }) => {
  const [selected, setSelected] = useState(selectedCuisines);

  const handleCuisineClick = (cuisineId) => {
    if (cuisineId === 'any') {
      // "Surprise Me" clears other selections and submits immediately
      setSelected(['any']);
      onSelect(['any'], 'Surprise Me');
      return;
    }

    if (allowMultiple) {
      // Toggle selection for multiple choice
      const newSelected = selected.includes(cuisineId)
        ? selected.filter(id => id !== cuisineId && id !== 'any')
        : [...selected.filter(id => id !== 'any'), cuisineId];
      setSelected(newSelected);
    } else {
      // Single selection
      setSelected([cuisineId]);
      const cuisine = CUISINES.find(c => c.id === cuisineId);
      onSelect([cuisineId], cuisine.label);
    }
  };

  const handleConfirm = () => {
    if (selected.length > 0) {
      const labels = selected.map(id => CUISINES.find(c => c.id === id)?.label).join(', ');
      onSelect(selected, labels);
    }
  };

  return (
    <div className="cuisine-selector" data-testid="cuisine-selector">
      <p className="text-lg font-serif mb-4 text-foreground">What cuisine are you in the mood for?</p>
      <p className="text-sm text-muted-foreground mb-4">
        {allowMultiple ? 'Select one or more cuisines' : 'Select a cuisine'}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {CUISINES.map((cuisine) => {
          const isSelected = selected.includes(cuisine.id);
          return (
            <Button
              key={cuisine.id}
              variant="outline"
              onClick={() => handleCuisineClick(cuisine.id)}
              className={`rounded-full px-4 py-2 h-auto border-2 transition-all duration-300 ${
                isSelected 
                  ? `${cuisine.color} ring-2 ring-offset-1 scale-105` 
                  : cuisine.color
              } ${cuisine.isSpecial ? 'border-dashed' : ''}`}
              data-testid={`cuisine-${cuisine.id}`}
            >
              <span className="text-lg mr-2">{cuisine.emoji}</span>
              <span className="font-medium text-sm">{cuisine.label}</span>
            </Button>
          );
        })}
      </div>
      
      {allowMultiple && selected.length > 0 && !selected.includes('any') && (
        <Button 
          onClick={handleConfirm}
          className="rounded-full px-6 py-2 bg-primary hover:bg-primary/90"
          data-testid="cuisine-confirm"
        >
          <Sparkles size={16} className="mr-2" />
          Show {selected.length > 1 ? `${selected.length} Cuisines` : 'Recipes'}
        </Button>
      )}
    </div>
  );
};

export default CuisineSelector;
export { CUISINES };
