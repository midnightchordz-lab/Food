import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

const CUISINES = [
  // Asian Cuisines
  { id: 'chinese', label: 'Chinese', emoji: '🥢', color: 'bg-red-600/10 text-red-700 hover:bg-red-600/20 border-red-600/30' },
  { id: 'indian', label: 'Indian', emoji: '🍛', color: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-orange-500/30' },
  { id: 'japanese', label: 'Japanese', emoji: '🍱', color: 'bg-pink-500/10 text-pink-600 hover:bg-pink-500/20 border-pink-500/30' },
  { id: 'thai', label: 'Thai', emoji: '🍜', color: 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30' },
  { id: 'korean', label: 'Korean', emoji: '🍲', color: 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-500/30' },
  { id: 'vietnamese', label: 'Vietnamese', emoji: '🍜', color: 'bg-lime-500/10 text-lime-600 hover:bg-lime-500/20 border-lime-500/30' },
  
  // European Cuisines
  { id: 'italian', label: 'Italian', emoji: '🍝', color: 'bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/30' },
  { id: 'french', label: 'French', emoji: '🥐', color: 'bg-blue-400/10 text-blue-500 hover:bg-blue-400/20 border-blue-400/30' },
  { id: 'spanish', label: 'Spanish', emoji: '🥘', color: 'bg-yellow-600/10 text-yellow-700 hover:bg-yellow-600/20 border-yellow-600/30' },
  { id: 'greek', label: 'Greek', emoji: '🫒', color: 'bg-blue-600/10 text-blue-700 hover:bg-blue-600/20 border-blue-600/30' },
  { id: 'mediterranean', label: 'Mediterranean', emoji: '🥙', color: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/30' },
  
  // Latin American Cuisines
  { id: 'mexican', label: 'Mexican', emoji: '🌮', color: 'bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/30' },
  { id: 'brazilian', label: 'Brazilian', emoji: '🇧🇷', color: 'bg-green-600/10 text-green-700 hover:bg-green-600/20 border-green-600/30' },
  { id: 'peruvian', label: 'Peruvian', emoji: '🥔', color: 'bg-red-400/10 text-red-500 hover:bg-red-400/20 border-red-400/30' },
  { id: 'argentinian', label: 'Argentinian', emoji: '🥩', color: 'bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 border-sky-500/30' },
  { id: 'cuban', label: 'Cuban', emoji: '🍹', color: 'bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 border-teal-500/30' },
  { id: 'colombian', label: 'Colombian', emoji: '🫓', color: 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/30' },
  { id: 'chilean', label: 'Chilean', emoji: '🍷', color: 'bg-rose-600/10 text-rose-700 hover:bg-rose-600/20 border-rose-600/30' },
  
  // Middle Eastern & African
  { id: 'middleeastern', label: 'Middle Eastern', emoji: '🧆', color: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/30' },
  { id: 'moroccan', label: 'Moroccan', emoji: '🫖', color: 'bg-orange-600/10 text-orange-700 hover:bg-orange-600/20 border-orange-600/30' },
  { id: 'ethiopian', label: 'Ethiopian', emoji: '🍲', color: 'bg-amber-600/10 text-amber-700 hover:bg-amber-600/20 border-amber-600/30' },
  
  // North American & Others
  { id: 'american', label: 'American', emoji: '🍔', color: 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/30' },
  { id: 'caribbean', label: 'Caribbean', emoji: '🌴', color: 'bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/20 border-cyan-500/30' },
  
  // Special Option
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
