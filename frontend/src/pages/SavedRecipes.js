import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, Clock, ChefHat, ShoppingCart, Star, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import RecipeSearchFilter from '@/components/RecipeSearchFilter';
import RecipeRating from '@/components/RecipeRating';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SavedRecipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [filteredRecipes, setFilteredRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeRatings, setRecipeRatings] = useState({});
  const { isAuthenticated } = useAuth();
  
  useEffect(() => {
    if (isAuthenticated) {
      loadRecipes();
    }
  }, [isAuthenticated]);
  
  const loadRecipes = async () => {
    try {
      const response = await axios.get(`${API}/recipes/saved`);
      const loadedRecipes = response.data.recipes || [];
      setRecipes(loadedRecipes);
      setFilteredRecipes(loadedRecipes);
      
      // Load ratings for each recipe
      loadedRecipes.forEach(recipe => loadRecipeRating(recipe.id));
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  };
  
  const loadRecipeRating = async (recipeId) => {
    try {
      const response = await axios.get(`${API}/recipes/${recipeId}/ratings`);
      setRecipeRatings(prev => ({
        ...prev,
        [recipeId]: response.data
      }));
    } catch (error) {
      console.error('Error loading rating:', error);
    }
  };
  
  const handleSearch = async (searchParams) => {
    try {
      const response = await axios.post(`${API}/recipes/search`, searchParams);
      setFilteredRecipes(response.data.recipes || []);
    } catch (error) {
      console.error('Error searching recipes:', error);
      toast.error('Failed to search recipes');
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
          <p className="text-muted-foreground mb-6" data-testid="page-description">
            Meals you've saved for later, organized by mood and occasion.
          </p>
          
          <RecipeSearchFilter onSearch={handleSearch} />
        </div>
        
        {filteredRecipes.length === 0 ? (
          <div className="text-center py-20" data-testid="empty-state">
            <Heart className="mx-auto mb-4 text-muted-foreground" size={48} />
            <h3 className="text-xl font-serif mb-2">
              {recipes.length === 0 ? 'No saved recipes yet' : 'No recipes match your search'}
            </h3>
            <p className="text-muted-foreground">
              {recipes.length === 0 ? 'Start chatting to discover mood-based meals!' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="recipe-card bg-card rounded-2xl border border-border/40 overflow-hidden hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedRecipe(recipe)}
                data-testid={`recipe-card-${recipe.id}`}
              >
                <div className="h-48 bg-gradient-to-br from-primary/20 to-accent/20 relative overflow-hidden">
                  {recipe.image_url ? (
                    <img 
                      src={recipe.image_url} 
                      alt={recipe.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="absolute inset-0 flex items-center justify-center" style={{display: recipe.image_url ? 'none' : 'flex'}}>
                    <ChefHat size={64} className="text-primary/40" />
                  </div>
                  {recipe.cuisine_type && (
                    <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                      {recipe.cuisine_type}
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-serif flex-1">{recipe.title}</h3>
                    {recipeRatings[recipe.id]?.average_rating > 0 && (
                      <div className="flex items-center gap-1 text-accent">
                        <Star size={16} className="fill-accent" />
                        <span className="text-sm font-medium">
                          {recipeRatings[recipe.id].average_rating}
                        </span>
                      </div>
                    )}
                  </div>
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
                <div className="flex justify-between items-start">
                  <DialogTitle className="text-3xl font-serif flex-1">{selectedRecipe.title}</DialogTitle>
                  {recipeRatings[selectedRecipe.id]?.average_rating > 0 && (
                    <div className="flex items-center gap-2 bg-accent/10 px-3 py-1 rounded-full">
                      <Star size={18} className="fill-accent text-accent" />
                      <span className="font-medium text-accent">
                        {recipeRatings[selectedRecipe.id].average_rating} ({recipeRatings[selectedRecipe.id].total_ratings})
                      </span>
                    </div>
                  )}
                </div>
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
                
                <RecipeRating recipeId={selectedRecipe.id} />
                
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
