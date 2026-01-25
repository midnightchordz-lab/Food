import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, Clock, ChefHat, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SavedRecipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const { isAuthenticated } = useAuth();
  
  useEffect(() => {
    if (isAuthenticated) {
      loadRecipes();
    }
  }, [isAuthenticated]);
  
  const loadRecipes = async () => {
    try {
      const response = await axios.get(`${API}/recipes/saved`);
      setRecipes(response.data.recipes || []);
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  };
  
  const addToShoppingList = async (recipeId) => {
    try {
      const response = await axios.post(`${API}/recipes/${recipeId}/add-to-shopping-list`);
      toast.success(`${response.data.items_added} ingredients added to shopping list!`);
    } catch (error) {
      console.error('Error adding to shopping list:', error);
      toast.error('Failed to add to shopping list');
    }
  };
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="saved-recipes-page">
        <div className="max-w-7xl mx-auto text-center py-20">
          <Heart className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-serif mb-2">Please log in to view saved recipes</h3>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="saved-recipes-page">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-serif mb-3" data-testid="page-title">
            Your Recipe Collection
          </h1>
          <p className="text-muted-foreground" data-testid="page-description">
            Meals you've saved for later, organized by mood and occasion.
          </p>
        </div>
        
        {recipes.length === 0 ? (
          <div className="text-center py-20" data-testid="empty-state">
            <Heart className="mx-auto mb-4 text-muted-foreground" size={48} />
            <h3 className="text-xl font-serif mb-2">No saved recipes yet</h3>
            <p className="text-muted-foreground">Start chatting to discover mood-based meals!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="recipe-card bg-card rounded-2xl border border-border/40 overflow-hidden hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedRecipe(recipe)}
                data-testid={`recipe-card-${recipe.id}`}
              >
                <div className="h-48 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <ChefHat size={64} className="text-primary/40" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-serif mb-2">{recipe.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {recipe.description}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Clock size={16} />
                      <span>{recipe.prep_time}</span>
                    </div>
                    <span className="px-2 py-1 bg-secondary rounded-full text-xs">
                      {recipe.complexity}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recipe.mood_tags?.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="mood-badge px-2 py-1 bg-accent/10 text-accent rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Recipe Detail Dialog */}
      <Dialog open={!!selectedRecipe} onOpenChange={() => setSelectedRecipe(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="recipe-detail-dialog">
          {selectedRecipe && (
            <>
              <DialogHeader>
                <DialogTitle className="text-3xl font-serif">{selectedRecipe.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 mt-4">
                <p className="text-muted-foreground">{selectedRecipe.description}</p>
                
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={18} />
                    <span>Prep: {selectedRecipe.prep_time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={18} />
                    <span>Cook: {selectedRecipe.cook_time}</span>
                  </div>
                </div>
                
                {selectedRecipe.dietary_info && selectedRecipe.dietary_info.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedRecipe.dietary_info.map((info, idx) => (
                      <span key={idx} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                        {info}
                      </span>
                    ))}
                  </div>
                )}
                
                <div>
                  <h3 className="font-serif text-xl mb-3">Ingredients</h3>
                  <ul className="space-y-2">
                    {selectedRecipe.ingredients?.map((ingredient, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{ingredient}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-serif text-xl mb-3">Instructions</h3>
                  <ol className="space-y-3">
                    {selectedRecipe.instructions?.map((instruction, idx) => (
                      <li key={idx} className="flex gap-3">
                        <span className="font-medium text-primary">{idx + 1}.</span>
                        <span>{instruction}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                
                <div className="bg-secondary/50 rounded-xl p-4">
                  <h3 className="font-serif text-lg mb-2">Nutritional Highlights</h3>
                  <p className="text-sm text-muted-foreground">{selectedRecipe.nutritional_highlights}</p>
                </div>
                
                <Button
                  onClick={() => addToShoppingList(selectedRecipe.id)}
                  className="w-full rounded-full bg-primary hover:bg-primary/90"
                  data-testid="add-to-shopping-list-button"
                >
                  <ShoppingCart size={18} className="mr-2" />
                  Add Ingredients to Shopping List
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SavedRecipes;