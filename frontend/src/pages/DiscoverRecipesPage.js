import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChefHat, ArrowLeft, Clock, Search, Filter, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DIFFICULTY_COLORS = {
  'Easy': 'bg-green-500/10 text-green-600',
  'Medium': 'bg-yellow-500/10 text-yellow-600',
  'Hard': 'bg-red-500/10 text-red-600',
};

const DiscoverRecipesPage = () => {
  const { cuisine } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [cuisineFilter, setCuisineFilter] = useState(cuisine || 'all');

  useEffect(() => {
    if (isAuthenticated) {
      discoverRecipes();
    }
  }, [cuisineFilter, isAuthenticated]);

  const discoverRecipes = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API}/recipes/discover`, {
        cuisine: cuisineFilter !== 'all' ? cuisineFilter : null,
        count: 12
      });
      setRecipes(response.data.recipes || []);
    } catch (error) {
      console.error('Error discovering recipes:', error);
      toast.error('Failed to load recipes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = difficultyFilter === 'all' || recipe.difficulty === difficultyFilter;
    return matchesSearch && matchesDifficulty;
  });

  const groupedRecipes = filteredRecipes.reduce((acc, recipe) => {
    const region = recipe.cuisine || 'Other';
    if (!acc[region]) {
      acc[region] = [];
    }
    acc[region].push(recipe);
    return acc;
  }, {});

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center py-20">
          <ChefHat className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-serif mb-2">Please log in to discover recipes</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="discover-recipes-page">
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

        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-3">
            Discover MOOD FOOD
          </h1>
          <p className="text-muted-foreground">
            Explore curated recipes from around the world, organized by regional cuisine
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 bg-card p-6 rounded-2xl border border-border/40">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
          
          <Select value={cuisineFilter} onValueChange={setCuisineFilter}>
            <SelectTrigger className="w-full md:w-[200px] rounded-xl">
              <SelectValue placeholder="All Cuisines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cuisines</SelectItem>
              <SelectItem value="Indian">Indian</SelectItem>
              <SelectItem value="Chinese">Chinese</SelectItem>
              <SelectItem value="Italian">Italian</SelectItem>
              <SelectItem value="Mexican">Mexican</SelectItem>
              <SelectItem value="Japanese">Japanese</SelectItem>
              <SelectItem value="Thai">Thai</SelectItem>
              <SelectItem value="Mediterranean">Mediterranean</SelectItem>
              <SelectItem value="Korean">Korean</SelectItem>
              <SelectItem value="French">French</SelectItem>
            </SelectContent>
          </Select>

          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-full md:w-[200px] rounded-xl">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="animate-spin mx-auto mb-4 text-primary" size={48} />
            <p className="text-muted-foreground">Discovering delicious recipes...</p>
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-border/40">
            <ChefHat className="mx-auto mb-4 text-muted-foreground" size={48} />
            <h3 className="text-xl font-serif mb-2">No recipes found</h3>
            <p className="text-muted-foreground mb-6">Try adjusting your filters or search query</p>
            <Button onClick={() => { setSearchQuery(''); setDifficultyFilter('all'); }} className="rounded-full">
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            {/* Recipes Grouped by Region */}
            {Object.entries(groupedRecipes).map(([region, regionRecipes]) => (
              <div key={region} className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <h2 className="text-3xl font-serif text-primary">{region} Cuisine</h2>
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                    {regionRecipes.length} {regionRecipes.length === 1 ? 'recipe' : 'recipes'}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {regionRecipes.map((recipe, idx) => (
                    <div
                      key={idx}
                      className="bg-card rounded-2xl border border-border/40 overflow-hidden hover:shadow-xl transition-all duration-300 group"
                      data-testid={`recipe-card-${idx}`}
                    >
                      {/* Clean Image - NO COUNTRY CODES */}
                      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10">
                        <img
                          src={recipe.image_url}
                          alt={recipe.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>

                      {/* Recipe Info */}
                      <div className="p-6">
                        <h3 className="text-xl font-serif mb-2 group-hover:text-primary transition-colors">
                          {recipe.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {recipe.description}
                        </p>

                        {/* Metadata */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock size={16} />
                            <span>{recipe.cooking_time}</span>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${DIFFICULTY_COLORS[recipe.difficulty] || 'bg-secondary'}`}>
                            {recipe.difficulty}
                          </span>
                        </div>

                        {/* CTA Button */}
                        <Button
                          className="w-full rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                          onClick={() => window.open(recipe.source_url, '_blank')}
                        >
                          View Full Recipe
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default DiscoverRecipesPage;
