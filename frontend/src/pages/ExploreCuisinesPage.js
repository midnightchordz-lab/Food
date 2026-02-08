import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Globe, ChefHat, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CUISINE_REGIONS = [
  {
    name: 'Indian Cuisine',
    flag: '🇮🇳',
    description: 'Aromatic spices, rich curries, and diverse regional flavors from the subcontinent',
    color: 'from-orange-400 to-amber-600',
    image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400',
    collections: ['North Indian Classics', 'South Indian Delights', 'Street Food Favorites']
  },
  {
    name: 'Chinese Cuisine',
    flag: '🇨🇳',
    description: 'Wok-fired delicacies, dumplings, and the art of balance in every bite',
    color: 'from-red-500 to-yellow-500',
    image: 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=400',
    collections: ['Sichuan Spice', 'Dim Sum Collection', 'Noodle Mastery']
  },
  {
    name: 'Italian Cuisine',
    flag: '🇮🇹',
    description: 'Pasta perfection, wood-fired pizzas, and Mediterranean freshness',
    color: 'from-green-500 to-red-500',
    image: 'https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=400',
    collections: ['Pasta Paradiso', 'Pizza & Flatbreads', 'Tuscan Treasures']
  },
  {
    name: 'Mexican Cuisine',
    flag: '🇲🇽',
    description: 'Vibrant flavors, bold spices, and corn-based comfort from ancient traditions',
    color: 'from-green-600 to-red-600',
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400',
    collections: ['Taco Tuesday', 'Mole Magic', 'Street Tacos']
  },
  {
    name: 'Japanese Cuisine',
    flag: '🇯🇵',
    description: 'Precision, minimalism, and umami-rich dishes celebrating seasonal ingredients',
    color: 'from-red-400 to-pink-500',
    image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400',
    collections: ['Ramen Heaven', 'Sushi Artistry', 'Donburi Bowls']
  },
  {
    name: 'Thai Cuisine',
    flag: '🇹🇭',
    description: 'Sweet, sour, salty, and spicy - a harmonious dance of flavors',
    color: 'from-blue-500 to-purple-600',
    image: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=400',
    collections: ['Curry Collection', 'Street Food Stars', 'Tom Yum Variations']
  },
  {
    name: 'Mediterranean',
    flag: '🌊',
    description: 'Olive oil, fresh herbs, and sun-soaked flavors from Greece to Morocco',
    color: 'from-blue-400 to-teal-500',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400',
    collections: ['Greek Mezze', 'Lebanese Feast', 'Moroccan Spice']
  },
  {
    name: 'Korean Cuisine',
    flag: '🇰🇷',
    description: 'Fermented flavors, BBQ excellence, and the power of kimchi',
    color: 'from-red-600 to-blue-600',
    image: 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=400',
    collections: ['BBQ Classics', 'Kimchi Kingdom', 'Korean Comfort']
  },
  {
    name: 'French Cuisine',
    flag: '🇫🇷',
    description: 'Elegance, technique, and the foundation of modern gastronomy',
    color: 'from-blue-600 to-red-600',
    image: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=400',
    collections: ['Bistro Favorites', 'Provence Classics', 'French Pastries']
  },
  // Latin American Cuisines
  {
    name: 'Brazilian Cuisine',
    flag: '🇧🇷',
    description: 'Vibrant flavors from churrasco to feijoada, a tropical culinary paradise',
    color: 'from-green-500 to-yellow-500',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400',
    collections: ['Churrasco Classics', 'Street Food', 'Tropical Treats']
  },
  {
    name: 'Peruvian Cuisine',
    flag: '🇵🇪',
    description: 'World-renowned fusion of indigenous and global influences',
    color: 'from-red-500 to-white',
    image: 'https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=400',
    collections: ['Ceviche Masters', 'Anticuchos', 'Lomo Saltado']
  },
  {
    name: 'Argentinian Cuisine',
    flag: '🇦🇷',
    description: 'World-class beef, empanadas, and the art of the asado',
    color: 'from-sky-400 to-white',
    image: 'https://images.unsplash.com/photo-1558030006-450675393462?w=400',
    collections: ['Asado Perfection', 'Empanadas', 'Dulce de Leche Desserts']
  },
  {
    name: 'Cuban Cuisine',
    flag: '🇨🇺',
    description: 'Savory slow-roasted meats, beans, rice, and Caribbean soul',
    color: 'from-blue-600 to-red-500',
    image: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=400',
    collections: ['Ropa Vieja', 'Cuban Sandwiches', 'Mojo Marinades']
  },
  {
    name: 'Colombian Cuisine',
    flag: '🇨🇴',
    description: 'Hearty soups, arepas, and flavors from coast to mountains',
    color: 'from-yellow-400 to-blue-600',
    image: 'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=400',
    collections: ['Bandeja Paisa', 'Arepa Varieties', 'Colombian Soups']
  },
  {
    name: 'Chilean Cuisine',
    flag: '🇨🇱',
    description: 'Fresh seafood, hearty stews, and world-class wines',
    color: 'from-red-600 to-white',
    image: 'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=400',
    collections: ['Seafood Delights', 'Pastel de Choclo', 'Chilean Wines']
  },
  {
    name: 'Caribbean Cuisine',
    flag: '🌴',
    description: 'Jerk spices, tropical fruits, and island flavors',
    color: 'from-cyan-400 to-orange-500',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
    collections: ['Jerk Chicken', 'Island Rice & Peas', 'Tropical Cocktails']
  },
  // African & Middle Eastern
  {
    name: 'Moroccan Cuisine',
    flag: '🇲🇦',
    description: 'Tagines, couscous, and the intoxicating spices of North Africa',
    color: 'from-orange-500 to-red-600',
    image: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=400',
    collections: ['Tagine Masters', 'Couscous Varieties', 'Moroccan Pastries']
  },
  {
    name: 'Ethiopian Cuisine',
    flag: '🇪🇹',
    description: 'Injera bread, spiced stews, and communal dining traditions',
    color: 'from-green-500 to-yellow-500',
    image: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=400',
    collections: ['Doro Wat', 'Vegetarian Feast', 'Injera Combos']
  },
  // Southeast Asian
  {
    name: 'Vietnamese Cuisine',
    flag: '🇻🇳',
    description: 'Fresh herbs, pho perfection, and the balance of flavors',
    color: 'from-red-500 to-yellow-400',
    image: 'https://images.unsplash.com/photo-1503764654157-72d979d9af2f?w=400',
    collections: ['Pho Mastery', 'Banh Mi Sandwiches', 'Fresh Rolls']
  },
];

const ExploreCuisinesPage = () => {
  const [selectedCuisine, setSelectedCuisine] = useState(null);
  const [collections, setCollections] = useState([]);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="explore-cuisines-page">
        <div className="max-w-7xl mx-auto text-center py-20">
          <Globe className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-serif mb-2">Please log in to explore cuisines</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="explore-cuisines-page">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-full mb-6">
            <Globe className="text-accent" size={20} />
            <span className="text-sm font-medium text-accent">Culinary Journey Around the World</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-serif mb-6" data-testid="page-title">
            Explore Regional
            <span className="block italic text-primary mt-2">Cuisines</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover authentic recipes from around the globe, curated by mood and cultural heritage
          </p>
        </div>

        {/* Cuisine Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {CUISINE_REGIONS.map((cuisine) => (
            <div
              key={cuisine.name}
              className="group cursor-pointer"
              onClick={() => {
                setSelectedCuisine(cuisine);
                navigate(`/recipes/cuisine/${cuisine.name.toLowerCase().split(' ')[0]}`);
              }}
              data-testid={`cuisine-card-${cuisine.name}`}
            >
              <div className="bg-card rounded-3xl overflow-hidden border border-border/40 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                {/* Image with Gradient Overlay - NO COUNTRY CODES */}
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={cuisine.image}
                    alt={cuisine.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${cuisine.color} opacity-60 group-hover:opacity-40 transition-opacity`}></div>
                  {/* Removed country code overlay for clean presentation */}
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-2xl font-serif mb-3 group-hover:text-primary transition-colors">
                    {cuisine.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {cuisine.description}
                  </p>

                  {/* Collections Preview */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Collections</p>
                    <div className="flex flex-wrap gap-2">
                      {cuisine.collections.slice(0, 3).map((collection, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-secondary rounded-full text-xs font-medium"
                        >
                          {collection}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Explore Button */}
                  <Button
                    className="w-full mt-6 rounded-full bg-primary hover:bg-primary/90 group-hover:scale-105 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/discover-recipes/${cuisine.name.toLowerCase().split(' ')[0]}`);
                    }}
                  >
                    <ChefHat size={18} className="mr-2" />
                    Explore Recipes
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="mt-20 text-center bg-gradient-to-r from-primary/10 to-accent/10 rounded-3xl p-12">
          <Sparkles className="mx-auto mb-4 text-primary" size={48} />
          <h2 className="text-3xl font-serif mb-4">Can't Decide?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Let our AI chef create a personalized global meal plan based on your mood and preferences
          </p>
          <Button
            size="lg"
            onClick={() => navigate('/weekly-planner')}
            className="rounded-full bg-accent hover:bg-accent/90"
          >
            <Sparkles className="mr-2" size={20} />
            Generate AI Meal Plan
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExploreCuisinesPage;