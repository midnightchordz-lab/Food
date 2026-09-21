import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChefHat, ArrowLeft, Star, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import RecipeRating from '@/components/RecipeRating';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CuisineRecipesPage = () => {
  const { cuisine } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadCuisineRecipes();
    }
  }, [cuisine, isAuthenticated]);

  const loadCuisineRecipes = async () => {
    try {
      setLoading(true);
      // Get all saved recipes and filter by cuisine
      const response = await axios.get(`${API}/recipes/saved`);
      const allRecipes = response.data.recipes || [];
      
      // Filter by cuisine type
      const filtered = allRecipes.filter(recipe => 
        recipe.cuisine_type?.toLowerCase().includes(cuisine.toLowerCase())
      );
      
      setRecipes(filtered);
    } catch (error) {
      console.error('Error loading cuisine recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const cuisineName = cuisine.charAt(0).toUpperCase() + cuisine.slice(1);

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="cuisine-recipes-page">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <Button
          variant="ghost"
          onClick={() => navigate('/explore-cuisines')}
          className="mb-6 rounded-full"
        >
          <ArrowLeft size={18} className="mr-2" />
          Back to Explore
        </Button>

        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-serif mb-3">
            {cuisineName} Cuisine
          </h1>
          <p className="text-muted-foreground">
            A curated collection of {cuisineName} recipes from your saved collection
          </p>
        </div>

        {/* Book-Style Recipe Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-border/40">
            <ChefHat className="mx-auto mb-4 text-muted-foreground" size={48} />
            <h3 className="text-xl font-serif mb-2">No {cuisineName} recipes yet</h3>
            <p className="text-muted-foreground mb-6">
              Chat with our AI chef to discover and save {cuisineName} recipes!
            </p>
            <Button
              onClick={() => navigate('/chat')}
              className="rounded-full bg-primary hover:bg-primary/90"
            >
              Start Cooking
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {recipes.map((recipe, idx) => (
              <div
                key={recipe.id}
                className="bg-card rounded-2xl border border-border/40 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                onClick={() => setSelectedRecipe(recipe)}
                data-testid={`recipe-card-${idx}`}
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
                    {recipe.mood_tags && recipe.mood_tags.length > 0 && (
                      <span className="px-2 py-1 bg-accent/10 text-accent rounded-full">
                        {recipe.mood_tags[0]}
                      </span>
                    )}
                  </div>

                  {/* Nutritional highlight */}
                  <div className="bg-secondary/50 rounded-lg p-3 mb-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      {recipe.nutritional_highlights?.substring(0, 80)}...
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

      {/* Recipe Detail Dialog */}
      <Dialog open={!!selectedRecipe} onOpenChange={() => setSelectedRecipe(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedRecipe && (
            <>
              <DialogHeader>
                <DialogTitle className="text-3xl font-serif">{selectedRecipe.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 mt-4">
                {selectedRecipe.image_url && (
                  <div className="rounded-2xl overflow-hidden">
                    <img
                      src={selectedRecipe.image_url}
                      alt={selectedRecipe.title}
                      className="w-full h-64 object-cover"
                    />
                  </div>
                )}
                <p className="text-muted-foreground">{selectedRecipe.description}</p>
                <RecipeRating recipeId={selectedRecipe.id} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CuisineRecipesPage;