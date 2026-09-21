import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, Clock, ChefHat, ShoppingCart, Star, Download, Loader2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useShoppingCart } from '@/context/ShoppingCartContext';
import { toast } from 'sonner';
import RecipeSearchFilter from '@/components/RecipeSearchFilter';
import RecipeDetailModal from '@/components/RecipeDetailModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SavedRecipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [filteredRecipes, setFilteredRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeRatings, setRecipeRatings] = useState({});
  const { isAuthenticated, loading } = useAuth();
  const { addAllToCart } = useShoppingCart();
  
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
  
  const addToShoppingList = (recipe) => {
    if (recipe?.ingredients && addAllToCart) {
      // Use the frontend ShoppingCartContext for immediate updates
      addAllToCart(recipe.ingredients, recipe.title || 'Saved Recipe');
    }
  };
  
  // Show loading state while auth is being verified
  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" data-testid="saved-recipes-loading">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }
  
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
          <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-1" data-testid="page-title">
            MOOD FOOD
          </h1>
          <p className="text-primary font-medium mb-2">When Feelings Need Feeding</p>
          <p className="text-muted-foreground mb-6" data-testid="page-description">
            Your saved recipes, organized by mood and occasion.
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredRecipes.map((recipe, idx) => (
              <div
                key={recipe.id}
                className="recipe-card bg-card rounded-2xl border border-border/40 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                onClick={() => setSelectedRecipe(recipe)}
                data-testid={`recipe-card-${recipe.id}`}
              >
                {/* Book-style header */}
                <div className="bg-gradient-to-br from-primary/10 to-accent/10 px-6 py-4 border-b border-border/20">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-wider text-accent font-semibold mb-2">
                        {recipe.complexity || 'Standard'}
                      </p>
                      <h3 className="text-xl font-serif leading-tight group-hover:text-primary transition-colors">
                        {recipe.title}
                      </h3>
                    </div>
                    {recipe.image_url && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden ml-4 ring-2 ring-background shadow-lg">
                        <img
                          src={recipe.image_url}
                          alt={recipe.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                  {recipe.cuisine_type && (
                    <div className="mt-3">
                      <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium">
                        {recipe.cuisine_type}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3 leading-relaxed">
                    {recipe.description}
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>{recipe.prep_time}</span>
                    </div>
                    {recipeRatings[recipe.id]?.average_rating > 0 && (
                      <div className="flex items-center gap-1 text-accent">
                        <Star size={14} className="fill-accent" />
                        <span className="font-medium">{recipeRatings[recipe.id].average_rating}</span>
                      </div>
                    )}
                  </div>

                  {/* Mood tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {recipe.mood_tags?.slice(0, 2).map((tag, idx) => (
                      <span
                        key={idx}
                        className="mood-badge px-2 py-1 bg-accent/10 text-accent rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Nutritional highlight */}
                  <div className="bg-secondary/50 rounded-lg p-3 mb-4">
                    <p className="text-xs font-medium text-muted-foreground line-clamp-2">
                      {recipe.nutritional_highlights}
                    </p>
                  </div>

                  {/* Action */}
                  <Button
                    className="w-full rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRecipe(recipe);
                    }}
                  >
                    View Full Recipe
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Recipe Detail Modal - Using the unified new design */}
      <RecipeDetailModal
        recipe={selectedRecipe ? {
          ...selectedRecipe,
          title: selectedRecipe.title,
          imageUrl: selectedRecipe.image_url,
          cookTime: selectedRecipe.cook_time,
          prepTime: selectedRecipe.prep_time,
          servings: selectedRecipe.servings,
          cuisine: selectedRecipe.cuisine_type,
          cuisineHint: selectedRecipe.cuisine_type,
          description: selectedRecipe.description,
          ingredients: selectedRecipe.ingredients,
          instructions: selectedRecipe.instructions,
        } : null}
        isOpen={!!selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        onSave={(recipe) => {
          toast.success('Recipe already saved!');
        }}
        onAddToShoppingList={(recipe) => addToShoppingList(recipe)}
      />
    </div>
  );
};

export default SavedRecipes;
