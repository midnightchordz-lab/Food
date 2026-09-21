// Shared data for the mood-based recipe flow.
// Images use Unsplash source URLs (from the original MoodFood design guidelines).

export type Mood = {
  id: string;
  label: string;
  description: string;
  icon: string; // material-design-icon name
  color: string;
  image: string;
};

export const MOODS: Mood[] = [
  { id: 'happy', label: 'Happy', description: 'bright, vibrant flavors', icon: 'emoticon-happy-outline', color: '#E6B89C', image: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=400&q=80' },
  { id: 'cozy', label: 'Cozy', description: 'warm & comforting dishes', icon: 'home-heart', color: '#D4A373', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80' },
  { id: 'stressed', label: 'Stressed', description: 'simple, calming meals', icon: 'weather-cloudy', color: '#9FB8AD', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80' },
  { id: 'sad', label: 'Low', description: 'soul-soothing comfort food', icon: 'weather-rainy', color: '#D4CCC4', image: 'https://images.unsplash.com/photo-1493770348161-369560ae357d?w=400&q=80' },
  { id: 'energetic', label: 'Energetic', description: 'fresh, protein-packed fuel', icon: 'lightning-bolt', color: '#E6B89C', image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&q=80' },
  { id: 'calm', label: 'Calm', description: 'light & zen-like plates', icon: 'meditation', color: '#9FB8AD', image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&q=80' },
  { id: 'romantic', label: 'Romantic', description: 'elegant, intimate dishes', icon: 'heart-outline', color: '#C66B3D', image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=80' },
  { id: 'excited', label: 'Excited', description: 'fun, adventurous plates', icon: 'party-popper', color: '#E6B89C', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80' },
];

export type MealType = { id: string; label: string; icon: string };
export const MEAL_TYPES: MealType[] = [
  { id: 'breakfast', label: 'Breakfast', icon: 'coffee-outline' },
  { id: 'lunch', label: 'Lunch', icon: 'food-outline' },
  { id: 'dinner', label: 'Dinner', icon: 'silverware-fork-knife' },
  { id: 'snack', label: 'Snack', icon: 'cookie-outline' },
  { id: 'dessert', label: 'Dessert', icon: 'cupcake' },
];

export type DietaryPref = { id: string; label: string; icon: string };
export const DIETARY_PREFS: DietaryPref[] = [
  { id: 'vegetarian', label: 'Vegetarian', icon: 'leaf' },
  { id: 'vegan', label: 'Vegan', icon: 'sprout' },
  { id: 'non-vegetarian', label: 'Non-Veg', icon: 'food-drumstick' },
  { id: 'pescatarian', label: 'Pescatarian', icon: 'fish' },
  { id: 'keto', label: 'Keto', icon: 'food-steak' },
  { id: 'gluten-free', label: 'Gluten-Free', icon: 'barley-off' },
];

export type Cuisine = { id: string; label: string; flag: string };
export const CUISINES: Cuisine[] = [
  { id: 'any', label: 'Surprise Me', flag: '✨' },
  { id: 'indian', label: 'Indian', flag: '🇮🇳' },
  { id: 'italian', label: 'Italian', flag: '🇮🇹' },
  { id: 'mexican', label: 'Mexican', flag: '🇲🇽' },
  { id: 'chinese', label: 'Chinese', flag: '🇨🇳' },
  { id: 'japanese', label: 'Japanese', flag: '🇯🇵' },
  { id: 'thai', label: 'Thai', flag: '🇹🇭' },
  { id: 'korean', label: 'Korean', flag: '🇰🇷' },
  { id: 'mediterranean', label: 'Mediterranean', flag: '🫒' },
  { id: 'american', label: 'American', flag: '🇺🇸' },
  { id: 'french', label: 'French', flag: '🇫🇷' },
];

export type StructuredRecipe = {
  id?: string;
  title: string;
  description: string;
  cooking_time?: string;
  difficulty?: string;
  cuisine?: string;
  ingredients?: string[];
  full_content?: string;
};
