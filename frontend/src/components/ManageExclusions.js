import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  AlertTriangle, Plus, X, Search, Edit2, Check, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ExclusionOnboarding from './ExclusionOnboarding';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ManageExclusions = ({ className }) => {
  const [exclusions, setExclusions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    loadExclusions();
  }, []);

  const loadExclusions = async () => {
    try {
      const response = await axios.get(`${API}/exclusions`);
      setExclusions(response.data.excluded_ingredients || []);
    } catch (error) {
      console.error('Error loading exclusions:', error);
      toast.error('Failed to load exclusions');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveExclusion = async (ingredientName) => {
    setRemoving(ingredientName);
    try {
      await axios.delete(`${API}/exclusions/${encodeURIComponent(ingredientName)}`);
      setExclusions(prev => prev.filter(e => e.name !== ingredientName));
      toast.success(`Removed "${ingredientName}" from exclusions`);
    } catch (error) {
      console.error('Error removing exclusion:', error);
      toast.error('Failed to remove exclusion');
    } finally {
      setRemoving(null);
    }
  };

  const handleSaveExclusions = async (newExclusions) => {
    try {
      await axios.post(`${API}/exclusions`, {
        excluded_ingredients: newExclusions
      });
      setExclusions(newExclusions);
      setShowEditModal(false);
      toast.success('Exclusions updated successfully');
    } catch (error) {
      console.error('Error saving exclusions:', error);
      toast.error('Failed to save exclusions');
    }
  };

  const hasSevereAllergies = exclusions.some(e => 
    e.severity === 'severe-allergy' || e.category === 'allergy'
  );

  if (loading) {
    return (
      <div className={`bg-card rounded-2xl border border-border/40 p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card rounded-2xl border border-border/40 p-6 ${className}`} data-testid="manage-exclusions">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Food Allergies & Exclusions</h3>
          <p className="text-sm text-muted-foreground">
            Ingredients to exclude from all recipe suggestions
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowEditModal(true)}
          className="rounded-xl"
          data-testid="edit-exclusions-btn"
        >
          <Edit2 size={16} className="mr-2" />
          Edit
        </Button>
      </div>

      {/* Severe allergy warning */}
      {hasSevereAllergies && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl p-3 mb-4">
          <div className="flex gap-2">
            <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0" size={18} />
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>Severe allergies detected.</strong> Always verify ingredients before cooking.
            </p>
          </div>
        </div>
      )}

      {/* Exclusions List */}
      {exclusions.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="text-muted-foreground" size={32} />
          </div>
          <p className="text-muted-foreground mb-4">No ingredients excluded</p>
          <Button 
            onClick={() => setShowEditModal(true)}
            variant="outline"
            className="rounded-xl"
          >
            <Plus size={16} className="mr-2" />
            Add Exclusions
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {exclusions.map((exclusion, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-3 rounded-xl border ${
                exclusion.category === 'allergy' || exclusion.severity === 'severe-allergy'
                  ? 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20'
                  : 'border-border/40 bg-secondary/30'
              }`}
              data-testid={`exclusion-item-${exclusion.name}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">
                  {getIngredientIcon(exclusion.name)}
                </span>
                <div>
                  <span className="font-medium">{exclusion.name}</span>
                  {(exclusion.category === 'allergy' || exclusion.severity?.includes('allergy')) && (
                    <span className="ml-2 text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">
                      Allergy
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveExclusion(exclusion.name)}
                disabled={removing === exclusion.name}
                className="text-muted-foreground hover:text-destructive"
                data-testid={`remove-${exclusion.name}`}
              >
                {removing === exclusion.name ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <X size={16} />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-xl">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          ℹ️ Recipes with these ingredients will not be suggested in Chat, Diabetes Meals, or the Meal Planner.
        </p>
      </div>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Food Exclusions</DialogTitle>
          </DialogHeader>
          <ExclusionOnboarding
            onComplete={handleSaveExclusions}
            onSkip={() => setShowEditModal(false)}
            initialExclusions={exclusions}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Helper function to get icon for ingredient
const getIngredientIcon = (name) => {
  const icons = {
    eggs: '🥚', milk: '🥛', peanuts: '🥜', 'tree nuts': '🌰', 'tree_nuts': '🌰',
    soy: '🫘', wheat: '🌾', fish: '🐟', shellfish: '🦐', sesame: '🌱',
    beef: '🥩', pork: '🥓', lamb: '🍖', chicken: '🍗', shrimp: '🦐',
    tuna: '🐟', salmon: '🐠', avocado: '🥑', olives: '🫒', kale: '🥬',
    ginger: '🫚', honey: '🍯', 'bell pepper': '🫑', 'bell_pepper': '🫑',
    mushroom: '🍄', garlic: '🧄', onion: '🧅', tomato: '🍅',
    coconut: '🥥', dairy: '🧀', gluten: '🌾', corn: '🌽'
  };
  return icons[name.toLowerCase()] || '🚫';
};

export default ManageExclusions;
