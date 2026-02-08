import { useState } from 'react';

// Mood data with 3D emoji images (no text overlays)
const MOOD_IMAGES = [
  { 
    id: 'happy', 
    label: 'Happy', 
    image: 'https://static.prod-images.emergentagent.com/jobs/9a88e347-8513-4a16-bfc5-752f26a867f9/images/16edf123b603f1805f07178ecee537a877467e7722f80ee97c9432d1ec8bf44b.png',
    description: 'Vibrant, fresh, colorful dishes that match your joyful energy',
    color: 'from-yellow-400 to-orange-400'
  },
  { 
    id: 'sad', 
    label: 'Sad', 
    image: 'https://static.prod-images.emergentagent.com/jobs/9a88e347-8513-4a16-bfc5-752f26a867f9/images/cd1a60e583b8853e1fdfabecbd885df6de6d1621222b72b07b49a9f90ac15812.png',
    description: 'Comforting, warm soul food to lift your spirits',
    color: 'from-blue-400 to-indigo-400'
  },
  { 
    id: 'stressed', 
    label: 'Stressed', 
    image: 'https://static.prod-images.emergentagent.com/jobs/9a88e347-8513-4a16-bfc5-752f26a867f9/images/376cca0afefcf763563217d023594ccad64ca98bf8837d6caccd30684dd8a4da.png',
    description: 'Easy, calming meals with stress-reducing ingredients',
    color: 'from-orange-400 to-red-400'
  },
  { 
    id: 'tired', 
    label: 'Tired', 
    image: 'https://static.prod-images.emergentagent.com/jobs/9a88e347-8513-4a16-bfc5-752f26a867f9/images/9b1ef716e24413c85652ff741d2097cf9903fb8c6da30ddda879f812a3a4cce1.png',
    description: 'Quick, energizing meals to recharge your body',
    color: 'from-purple-400 to-pink-400'
  },
  { 
    id: 'cozy', 
    label: 'Cozy', 
    image: 'https://static.prod-images.emergentagent.com/jobs/9a88e347-8513-4a16-bfc5-752f26a867f9/images/c321a0ee0ad88594d1f7550c3ecaf2cc901306fc71b7bc699952a210d702c79c.png',
    description: 'Warm, hearty comfort food for snuggly moments',
    color: 'from-amber-400 to-yellow-400'
  },
  { 
    id: 'energetic', 
    label: 'Energetic', 
    image: 'https://static.prod-images.emergentagent.com/jobs/9a88e347-8513-4a16-bfc5-752f26a867f9/images/989cbb722211ee4f601a69853c1c7298c131b6850c46e13feaafaac06aac003d.png',
    description: 'High-protein, power-packed meals for peak performance',
    color: 'from-green-400 to-emerald-400'
  },
  { 
    id: 'anxious', 
    label: 'Anxious', 
    image: 'https://static.prod-images.emergentagent.com/jobs/9a88e347-8513-4a16-bfc5-752f26a867f9/images/84548752c9ab46a1844824f39ac49d93ee1a96b11d837de71c3f53591fc4aca3.png',
    description: 'Soothing meals with anxiety-calming nutrients',
    color: 'from-cyan-400 to-blue-400'
  },
  { 
    id: 'angry', 
    label: 'Angry', 
    image: 'https://static.prod-images.emergentagent.com/jobs/9a88e347-8513-4a16-bfc5-752f26a867f9/images/bc76d6c0ba4c471e380f76f4613b85189d6c3bbbc26f74665ba80efde3165729.png',
    description: 'Bold, spicy dishes to channel that fiery energy',
    color: 'from-red-500 to-orange-500'
  },
  { 
    id: 'romantic', 
    label: 'Romantic', 
    image: 'https://static.prod-images.emergentagent.com/jobs/9a88e347-8513-4a16-bfc5-752f26a867f9/images/98331697bb2a250cf994e896dd73278b4a45f0bafc4fa1560701b5e69d47f476.png',
    description: 'Elegant, intimate dishes perfect for date night',
    color: 'from-rose-400 to-pink-400'
  },
  { 
    id: 'focused', 
    label: 'Focused', 
    image: 'https://static.prod-images.emergentagent.com/jobs/9a88e347-8513-4a16-bfc5-752f26a867f9/images/2ee22d27d81cab29f8ca5527fad1871d92a30ca9a311b8fabdc8dc159db26b39.png',
    description: 'Brain-boosting meals for concentration and clarity',
    color: 'from-indigo-400 to-purple-400'
  },
  { 
    id: 'bored', 
    label: 'Bored', 
    image: 'https://static.prod-images.emergentagent.com/jobs/9a88e347-8513-4a16-bfc5-752f26a867f9/images/bdc704d10d51d104d2d51a3076b02aa5f744b90e4c7add3c640ddcf958af0b4c.png',
    description: 'Exciting, adventurous recipes to spark your interest',
    color: 'from-slate-400 to-gray-400'
  },
  { 
    id: 'celebratory', 
    label: 'Celebratory', 
    image: 'https://static.prod-images.emergentagent.com/jobs/9a88e347-8513-4a16-bfc5-752f26a867f9/images/9dec4c45189ce30b55ed17c17a1c5bad433965c3561776d74b6cadd6feab240f.png',
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
        {MOOD_IMAGES.map((mood, index) => {
          const isSelected = selectedMood === mood.id;
          const isHovered = hoveredMood === mood.id;
          
          return (
            <div
              key={mood.id}
              className="relative cursor-pointer group"
              onClick={() => handleMoodSelect(mood)}
              onMouseEnter={() => setHoveredMood(mood.id)}
              onMouseLeave={() => setHoveredMood(null)}
              data-testid={`mood-card-${mood.id}`}
              style={{ 
                animationDelay: `${index * 50}ms`,
                animation: 'fadeInUp 0.5s ease-out forwards'
              }}
            >
              <div 
                className={`relative rounded-2xl overflow-hidden transition-all duration-300 ease-out transform
                  ${isSelected 
                    ? 'ring-4 ring-primary ring-offset-2 shadow-xl shadow-primary/30 scale-105' 
                    : isHovered 
                      ? 'shadow-lg shadow-stone-300/50 scale-105 -translate-y-1' 
                      : 'border border-border/30 hover:border-primary/30'
                  }`}
              >
                {/* Animated Background Glow on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${mood.color} opacity-0 transition-opacity duration-300
                  ${isHovered && !isSelected ? 'opacity-10' : ''}`} 
                />
                
                {/* Mood Image Container */}
                <div className={`aspect-square bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-2 relative overflow-hidden`}>
                  {/* Shimmer Effect on Hover */}
                  <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full transition-transform duration-700 ease-out
                    ${isHovered ? 'translate-x-full' : ''}`}
                  />
                  
                  {/* Mood Image with Bounce Animation */}
                  <img 
                    src={mood.image} 
                    alt={`${mood.label} mood`}
                    className={`w-full h-full object-contain transition-all duration-300 ease-out
                      ${isSelected ? 'scale-110' : ''}
                      ${isHovered && !isSelected ? 'scale-110 rotate-3' : ''}
                      group-hover:drop-shadow-lg`}
                    loading="lazy"
                  />
                  
                  {/* Floating Particles on Hover */}
                  {isHovered && !isSelected && (
                    <>
                      <div className="absolute top-2 left-2 w-1.5 h-1.5 bg-primary/40 rounded-full animate-ping" />
                      <div className="absolute bottom-3 right-3 w-1 h-1 bg-primary/30 rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
                      <div className="absolute top-4 right-4 w-1 h-1 bg-primary/20 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
                    </>
                  )}
                </div>
                
                {/* Selection Indicator with Pulse */}
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5">
                    <div className="absolute inset-0 w-5 h-5 bg-primary rounded-full animate-ping opacity-50" />
                    <div className="relative w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
                
                {/* Mood Label with Slide-up Animation */}
                <div className={`py-2 px-1 bg-gradient-to-r ${mood.color} text-white text-center transition-all duration-300 relative overflow-hidden`}>
                  {/* Label Shine Effect */}
                  <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full
                    ${isHovered ? 'animate-shine' : ''}`}
                  />
                  <p className={`font-semibold text-xs truncate relative z-10 transition-transform duration-200
                    ${isHovered ? 'scale-105' : ''}`}>
                    {mood.label}
                  </p>
                </div>
              </div>
              
              {/* Enhanced Description Tooltip */}
              {(isHovered || isSelected) && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-2 z-20">
                  <div className="relative">
                    {/* Tooltip Arrow */}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-l border-t border-border rotate-45" />
                    {/* Tooltip Content */}
                    <div className="bg-popover border border-border shadow-xl rounded-lg px-3 py-2 max-w-[180px] animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
                      <p className="text-xs text-muted-foreground leading-snug text-center">
                        {mood.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Add CSS animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes shine {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100%);
          }
        }
        
        .animate-shine {
          animation: shine 0.8s ease-out;
        }
      `}</style>
      
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
