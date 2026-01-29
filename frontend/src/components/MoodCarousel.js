import { useState } from 'react';

// Mood data with 3D emoji images
const MOOD_IMAGES = [
  { 
    id: 'happy', 
    label: 'Happy', 
    image: 'https://static.prod-images.emergentagent.com/jobs/1c9eafc2-7ba2-4847-90bc-b5d296506d02/images/0b2eae7422977e16a85d3efac05dafbad6454ff4724ea4f49ef70b4b36b8d77f.png',
    description: 'Vibrant, fresh, colorful dishes that match your joyful energy',
    color: 'from-yellow-400 to-orange-400'
  },
  { 
    id: 'sad', 
    label: 'Sad', 
    image: 'https://static.prod-images.emergentagent.com/jobs/1c9eafc2-7ba2-4847-90bc-b5d296506d02/images/b1137cb1a5f0ea002c7d2def203d8d98820f99315799a25f7fce7c0e88aeb250.png',
    description: 'Comforting, warm soul food to lift your spirits',
    color: 'from-blue-400 to-indigo-400'
  },
  { 
    id: 'stressed', 
    label: 'Stressed', 
    image: 'https://static.prod-images.emergentagent.com/jobs/1c9eafc2-7ba2-4847-90bc-b5d296506d02/images/89311301f4e1b6ed8c9b3ec0068a511e31b94937cf50e22d58160b6e4061ebfc.png',
    description: 'Easy, calming meals with stress-reducing ingredients',
    color: 'from-orange-400 to-red-400'
  },
  { 
    id: 'tired', 
    label: 'Tired', 
    image: 'https://static.prod-images.emergentagent.com/jobs/1c9eafc2-7ba2-4847-90bc-b5d296506d02/images/504c83712111d53e0b61a86de44fa49e6c43f7ab30310d22ac07f21f456e1016.png',
    description: 'Quick, energizing meals to recharge your body',
    color: 'from-purple-400 to-pink-400'
  },
  { 
    id: 'cozy', 
    label: 'Cozy', 
    image: 'https://static.prod-images.emergentagent.com/jobs/1c9eafc2-7ba2-4847-90bc-b5d296506d02/images/c8bf05aef5a8330453085e69a155dfb6d788f4aa92905e35896d50f04cb2195e.png',
    description: 'Warm, hearty comfort food for snuggly moments',
    color: 'from-amber-400 to-yellow-400'
  },
  { 
    id: 'energetic', 
    label: 'Energetic', 
    image: 'https://static.prod-images.emergentagent.com/jobs/1c9eafc2-7ba2-4847-90bc-b5d296506d02/images/0a5a86fff7be614b6944db0c0d392400bed033fe494311628ccb8242220948dd.png',
    description: 'High-protein, power-packed meals for peak performance',
    color: 'from-green-400 to-emerald-400'
  },
  { 
    id: 'anxious', 
    label: 'Anxious', 
    image: 'https://static.prod-images.emergentagent.com/jobs/1c9eafc2-7ba2-4847-90bc-b5d296506d02/images/6f5d6f5e00719f75912fbdb8e176dfb2b1e6cf9dc76ea4de17b099d5c8657e93.png',
    description: 'Soothing meals with anxiety-calming nutrients',
    color: 'from-cyan-400 to-blue-400'
  },
  { 
    id: 'angry', 
    label: 'Angry', 
    image: 'https://static.prod-images.emergentagent.com/jobs/1c9eafc2-7ba2-4847-90bc-b5d296506d02/images/ad4e1dc87541d4a8c083a3b50805c12710a107cc4de64d96477027b6495b8340.png',
    description: 'Bold, spicy dishes to channel that fiery energy',
    color: 'from-red-500 to-orange-500'
  },
  { 
    id: 'romantic', 
    label: 'Romantic', 
    image: 'https://static.prod-images.emergentagent.com/jobs/1c9eafc2-7ba2-4847-90bc-b5d296506d02/images/bd256d6e9e67476b129ff860bc2c6b1d748c2b1ee6f75484723e88634f882e23.png',
    description: 'Elegant, intimate dishes perfect for date night',
    color: 'from-rose-400 to-pink-400'
  },
  { 
    id: 'focused', 
    label: 'Focused', 
    image: 'https://static.prod-images.emergentagent.com/jobs/1c9eafc2-7ba2-4847-90bc-b5d296506d02/images/66e7c16ece9f3b6f73e7c69c8cadd2e79d6d61371627cbcf6eb3f944b0eb68b4.png',
    description: 'Brain-boosting meals for concentration and clarity',
    color: 'from-indigo-400 to-purple-400'
  },
  { 
    id: 'bored', 
    label: 'Bored', 
    image: 'https://static.prod-images.emergentagent.com/jobs/1c9eafc2-7ba2-4847-90bc-b5d296506d02/images/e3cb8376e4250faedba06651c8def0ef09a83b306c5199b09054b79c59511229.png',
    description: 'Exciting, adventurous recipes to spark your interest',
    color: 'from-slate-400 to-gray-400'
  },
  { 
    id: 'celebratory', 
    label: 'Celebratory', 
    image: 'https://static.prod-images.emergentagent.com/jobs/1c9eafc2-7ba2-4847-90bc-b5d296506d02/images/1647b63f85d645439bfe1eab09b235d2e9972b92d574e7448b3b93aa9f2761b4.png',
    description: 'Festive, party-worthy dishes for special occasions',
    color: 'from-fuchsia-400 to-pink-400'
  },
];

const MoodCarousel = ({ onSelect, selectedMood }) => {
  const [hoveredMood, setHoveredMood] = useState(null);

  const handleMoodSelect = (mood) => {
    onSelect(mood.id, mood.label, mood.description);
  };

  return (
    <div className="mood-carousel w-full" data-testid="mood-carousel">
      <p className="text-xl font-serif mb-2 text-foreground text-center">How are you feeling today?</p>
      <p className="text-sm text-muted-foreground mb-6 text-center">Select your mood and we&apos;ll find the perfect recipe</p>
      
      {/* 2-Row Grid Layout */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 px-2">
        {MOOD_IMAGES.map((mood) => {
          const isSelected = selectedMood === mood.id;
          const isHovered = hoveredMood === mood.id;
          
          return (
            <div
              key={mood.id}
              className={`cursor-pointer transition-all duration-300 ease-out transform ${
                isSelected ? 'scale-105 z-10' : isHovered ? 'scale-102' : 'hover:scale-105'
              }`}
              onClick={() => handleMoodSelect(mood)}
              onMouseEnter={() => setHoveredMood(mood.id)}
              onMouseLeave={() => setHoveredMood(null)}
              data-testid={`mood-card-${mood.id}`}
            >
              <div 
                className={`relative rounded-2xl overflow-hidden transition-all duration-300 ease-out ${
                  isSelected 
                    ? 'ring-4 ring-primary ring-offset-2 shadow-xl shadow-primary/20' 
                    : 'hover:shadow-lg border border-border/30'
                }`}
              >
                {/* Mood Image */}
                <div className="aspect-square bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-2">
                  <img 
                    src={mood.image} 
                    alt={`${mood.label} mood`}
                    className={`w-full h-full object-contain transition-transform duration-300 ${
                      isSelected ? 'scale-110' : ''
                    }`}
                    loading="lazy"
                  />
                </div>
                
                {/* Selection Indicator */}
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg animate-in zoom-in duration-200">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                
                {/* Mood Label */}
                <div className={`py-2 px-1 bg-gradient-to-r ${mood.color} text-white text-center transition-all duration-300`}>
                  <p className="font-semibold text-xs truncate">{mood.label}</p>
                </div>
              </div>
              
              {/* Description tooltip on hover/select */}
              {(isHovered || isSelected) && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-1 z-20 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="bg-popover border border-border shadow-lg rounded-lg px-3 py-2 max-w-[180px]">
                    <p className="text-xs text-muted-foreground leading-snug text-center">
                      {mood.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Selected mood indicator */}
      {selectedMood && (
        <div className="mt-5 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
            <img 
              src={MOOD_IMAGES.find(m => m.id === selectedMood)?.image} 
              alt="" 
              className="w-6 h-6 rounded-full"
            />
            <p className="text-sm text-primary font-medium">
              You&apos;re feeling <span className="font-bold">{MOOD_IMAGES.find(m => m.id === selectedMood)?.label}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoodCarousel;
export { MOOD_IMAGES };
