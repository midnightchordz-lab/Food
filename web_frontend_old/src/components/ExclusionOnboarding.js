import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, Plus, X, AlertTriangle, Check, ChevronRight, 
  Egg, Milk, Fish, Wheat, Shell, Leaf, Beef
} from 'lucide-react';
import { toast } from 'sonner';

// Common allergens with icons
const COMMON_ALLERGIES = [
  { id: 'eggs', name: 'Eggs', icon: '🥚', category: 'allergy', severity: 'severe-allergy' },
  { id: 'milk', name: 'Milk', icon: '🥛', category: 'allergy', severity: 'severe-allergy' },
  { id: 'peanuts', name: 'Peanuts', icon: '🥜', category: 'allergy', severity: 'severe-allergy' },
  { id: 'tree_nuts', name: 'Tree Nuts', icon: '🌰', category: 'allergy', severity: 'severe-allergy' },
  { id: 'soy', name: 'Soy', icon: '🫘', category: 'allergy', severity: 'severe-allergy' },
  { id: 'wheat', name: 'Wheat', icon: '🌾', category: 'allergy', severity: 'severe-allergy' },
  { id: 'fish', name: 'Fish', icon: '🐟', category: 'allergy', severity: 'severe-allergy' },
  { id: 'shellfish', name: 'Shellfish', icon: '🦐', category: 'allergy', severity: 'severe-allergy' },
];

// Popular exclusions
const POPULAR_EXCLUSIONS = [
  { id: 'beef', name: 'Beef', icon: '🥩', category: 'preference' },
  { id: 'pork', name: 'Pork', icon: '🥓', category: 'preference' },
  { id: 'lamb', name: 'Lamb', icon: '🍖', category: 'preference' },
  { id: 'chicken', name: 'Chicken', icon: '🍗', category: 'preference' },
  { id: 'shrimp', name: 'Shrimp', icon: '🦐', category: 'preference' },
  { id: 'tuna', name: 'Tuna', icon: '🐟', category: 'preference' },
  { id: 'salmon', name: 'Salmon', icon: '🐠', category: 'preference' },
  { id: 'avocado', name: 'Avocado', icon: '🥑', category: 'preference' },
  { id: 'olives', name: 'Olives', icon: '🫒', category: 'preference' },
  { id: 'kale', name: 'Kale', icon: '🥬', category: 'preference' },
  { id: 'ginger', name: 'Ginger', icon: '🫚', category: 'preference' },
  { id: 'honey', name: 'Honey', icon: '🍯', category: 'preference' },
  { id: 'bell_pepper', name: 'Bell Pepper', icon: '🫑', category: 'preference' },
  { id: 'brussel_sprout', name: 'Brussels Sprouts', icon: '🥬', category: 'preference' },
  { id: 'mustard', name: 'Mustard', icon: '🌭', category: 'preference' },
  { id: 'sesame', name: 'Sesame', icon: '🌱', category: 'preference' },
  { id: 'turnips', name: 'Turnips', icon: '🥕', category: 'preference' },
  { id: 'red_beet', name: 'Red Beet', icon: '🥕', category: 'preference' },
];

// Other common ingredients
const OTHER_INGREDIENTS = [
  { id: 'garlic', name: 'Garlic', category: 'preference' },
  { id: 'onion', name: 'Onion', category: 'preference' },
  { id: 'cilantro', name: 'Cilantro', category: 'preference' },
  { id: 'mushroom', name: 'Mushroom', category: 'preference' },
  { id: 'coconut', name: 'Coconut', category: 'preference' },
  { id: 'tomato', name: 'Tomato', category: 'preference' },
  { id: 'spinach', name: 'Spinach', category: 'preference' },
  { id: 'broccoli', name: 'Broccoli', category: 'preference' },
  { id: 'gluten', name: 'Gluten', category: 'allergy' },
  { id: 'dairy', name: 'Dairy', category: 'allergy' },
  { id: 'corn', name: 'Corn', category: 'preference' },
  { id: 'celery', name: 'Celery', category: 'preference' },
];

const ExclusionOnboarding = ({ onComplete, onSkip }) => {
  const [selectedExclusions, setSelectedExclusions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customIngredient, setCustomIngredient] = useState('');

  const toggleExclusion = (item) => {
    const isSelected = selectedExclusions.find(e => e.id === item.id);
    if (isSelected) {
      setSelectedExclusions(prev => prev.filter(e => e.id !== item.id));
    } else {
      setSelectedExclusions(prev => [...prev, {
        ...item,
        severity: item.severity || 'preference'
      }]);
    }
  };

  const addCustomIngredient = () => {
    if (!customIngredient.trim()) return;
    
    const exists = selectedExclusions.find(
      e => e.name.toLowerCase() === customIngredient.toLowerCase()
    );
    
    if (exists) {
      toast.error('This ingredient is already added');
      return;
    }
    
    const newItem = {
      id: `custom_${Date.now()}`,
      name: customIngredient.trim(),
      icon: '🚫',
      category: 'preference',
      severity: 'preference',
      custom: true
    };
    
    setSelectedExclusions(prev => [...prev, newItem]);
    setCustomIngredient('');
    toast.success(`Added "${newItem.name}" to exclusions`);
  };

  const removeExclusion = (id) => {
    setSelectedExclusions(prev => prev.filter(e => e.id !== id));
  };

  const selectAllInCategory = (category) => {
    const items = category === 'allergies' ? COMMON_ALLERGIES : POPULAR_EXCLUSIONS;
    const allSelected = items.every(item => 
      selectedExclusions.find(e => e.id === item.id)
    );
    
    if (allSelected) {
      // Deselect all in category
      setSelectedExclusions(prev => 
        prev.filter(e => !items.find(item => item.id === e.id))
      );
    } else {
      // Select all in category
      const newItems = items.filter(item => 
        !selectedExclusions.find(e => e.id === item.id)
      ).map(item => ({
        ...item,
        severity: item.severity || 'preference'
      }));
      setSelectedExclusions(prev => [...prev, ...newItems]);
    }
  };

  const handleSave = () => {
    const exclusionsToSave = selectedExclusions.map(e => ({
      name: e.name,
      category: e.category,
      severity: e.severity || 'preference',
      reason: e.custom ? 'Custom exclusion' : null
    }));
    
    onComplete(exclusionsToSave);
  };

  // Filter ingredients based on search
  const filterBySearch = (items) => {
    if (!searchQuery) return items;
    return items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filteredAllergies = filterBySearch(COMMON_ALLERGIES);
  const filteredPopular = filterBySearch(POPULAR_EXCLUSIONS);
  const filteredOther = filterBySearch(OTHER_INGREDIENTS);

  return (
    <div className="space-y-6" data-testid="exclusion-onboarding">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-serif font-semibold mb-2">Exclude Ingredients</h2>
        <p className="text-muted-foreground">What ingredients would you like to avoid?</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input
          type="search"
          placeholder="Search ingredients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 rounded-xl"
          data-testid="exclusion-search"
        />
      </div>

      {/* Common Allergies */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">
            Allergies (Common)
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => selectAllInCategory('allergies')}
            className="text-xs"
          >
            Select All
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {filteredAllergies.map(item => (
            <IngredientButton
              key={item.id}
              item={item}
              selected={selectedExclusions.find(e => e.id === item.id)}
              onClick={() => toggleExclusion(item)}
              isAllergy={true}
            />
          ))}
        </div>
      </div>

      {/* Popular Exclusions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">
            Popular Exclusions
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => selectAllInCategory('popular')}
            className="text-xs"
          >
            Select All
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {filteredPopular.map(item => (
            <IngredientButton
              key={item.id}
              item={item}
              selected={selectedExclusions.find(e => e.id === item.id)}
              onClick={() => toggleExclusion(item)}
            />
          ))}
        </div>
      </div>

      {/* Other Ingredients */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">
          Other Ingredients
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {filteredOther.map(item => (
            <label
              key={item.id}
              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                selectedExclusions.find(e => e.id === item.id)
                  ? 'border-primary bg-primary/10'
                  : 'border-border/40 hover:border-primary/50'
              }`}
              data-testid={`other-${item.id}`}
            >
              <input
                type="checkbox"
                checked={!!selectedExclusions.find(e => e.id === item.id)}
                onChange={() => toggleExclusion(item)}
                className="rounded"
              />
              <span className="text-sm">{item.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Custom Ingredient */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">
          Add Custom Ingredient
        </h3>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Type ingredient name..."
            value={customIngredient}
            onChange={(e) => setCustomIngredient(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomIngredient()}
            className="flex-1 rounded-xl"
            data-testid="custom-ingredient-input"
          />
          <Button
            onClick={addCustomIngredient}
            disabled={!customIngredient.trim()}
            className="rounded-xl"
            data-testid="add-custom-btn"
          >
            <Plus size={18} className="mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Selected Summary */}
      {selectedExclusions.length > 0 && (
        <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Selected Exclusions</h4>
            <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs font-medium">
              {selectedExclusions.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedExclusions.map(item => (
              <span
                key={item.id}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
                  item.category === 'allergy' 
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                <span>{item.icon || '🚫'}</span>
                {item.name}
                <button
                  onClick={() => removeExclusion(item.id)}
                  className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Important Notice */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
        <div className="flex gap-3">
          <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-200 mb-1">Important:</p>
            <ul className="text-amber-700 dark:text-amber-300 space-y-1">
              <li>• Recipes with these ingredients will <strong>never</strong> be suggested</li>
              <li>• You can update this list anytime in Settings</li>
              <li>• This applies to Chat, Diabetes Meals, and Meal Planner</li>
              <li>• Always verify ingredients if you have severe allergies</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onSkip}
          className="flex-1 rounded-xl py-6"
          data-testid="skip-exclusions-btn"
        >
          Skip for Now
        </Button>
        <Button
          onClick={handleSave}
          className="flex-1 rounded-xl py-6"
          data-testid="save-exclusions-btn"
        >
          {selectedExclusions.length > 0 ? (
            <>
              <Check size={18} className="mr-2" />
              Save & Continue
            </>
          ) : (
            <>
              No Exclusions
              <ChevronRight size={18} className="ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

// Individual ingredient button
const IngredientButton = ({ item, selected, onClick, isAllergy }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
      selected
        ? isAllergy
          ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
          : 'border-primary bg-primary/10'
        : 'border-border/40 hover:border-primary/50 hover:bg-secondary/50'
    }`}
    data-testid={`ingredient-${item.id}`}
  >
    <span className="text-2xl mb-1">{item.icon}</span>
    <span className="text-xs font-medium text-center leading-tight">{item.name}</span>
    {selected && (
      <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
        isAllergy ? 'bg-red-500' : 'bg-primary'
      } text-white`}>
        <Check size={12} />
      </div>
    )}
  </button>
);

export default ExclusionOnboarding;
