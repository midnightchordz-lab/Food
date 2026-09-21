import { Button } from '@/components/ui/button';

const MOODS = [
  { id: 'happy', label: 'Happy', emoji: '😊', color: 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/30', description: 'Vibrant, fresh, colorful dishes' },
  { id: 'sad', label: 'Sad', emoji: '😔', color: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/30', description: 'Comforting, warm, nostalgic dishes' },
  { id: 'angry', label: 'Angry', emoji: '😠', color: 'bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/30', description: 'Spicy, bold, intense flavors' },
  { id: 'excited', label: 'Excited', emoji: '🎉', color: 'bg-pink-500/10 text-pink-600 hover:bg-pink-500/20 border-pink-500/30', description: 'Fun, creative, adventurous dishes' },
  { id: 'calm', label: 'Calm', emoji: '😌', color: 'bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 border-teal-500/30', description: 'Light, balanced, zen-like dishes' },
  { id: 'stressed', label: 'Stressed', emoji: '😰', color: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-orange-500/30', description: 'Easy, quick, stress-free meals' },
  { id: 'romantic', label: 'Romantic', emoji: '😍', color: 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-500/30', description: 'Elegant, intimate, special dishes' },
  { id: 'cozy', label: 'Cozy', emoji: '🤗', color: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/30', description: 'Warm, hearty, snuggly dishes' },
];

const MoodSelector = ({ onSelect, selectedMood }) => {
  return (
    <div className="mood-selector" data-testid="mood-selector">
      <p className="text-lg font-serif mb-4 text-foreground">How are you feeling today?</p>
      <div className="grid grid-cols-4 gap-3">
        {MOODS.map((mood) => {
          const isSelected = selectedMood === mood.id;
          return (
            <Button
              key={mood.id}
              variant="outline"
              onClick={() => onSelect(mood.id, mood.label, mood.description)}
              className={`rounded-xl px-3 py-4 h-auto border-2 transition-all duration-300 flex flex-col items-center gap-1 ${
                isSelected 
                  ? `${mood.color} ring-2 ring-offset-2 scale-105` 
                  : mood.color
              }`}
              data-testid={`mood-${mood.id}`}
            >
              <span className="text-2xl">{mood.emoji}</span>
              <span className="font-medium text-xs">{mood.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default MoodSelector;
export { MOODS };
