import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChefHat, Heart, Sparkles } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1761662826410-3218852da3bf"
            alt="Cozy kitchen"
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 to-background"></div>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-full mb-8" data-testid="hero-badge">
            <Sparkles className="text-accent" size={20} />
            <span className="text-sm font-medium">Nourish Your Body & Mind</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif font-light tracking-tight mb-6" data-testid="hero-title">
            Cook What You
            <span className="block italic text-primary">Feel</span>
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12" data-testid="hero-description">
            A compassionate AI chef who understands your mood and suggests meals that heal, comfort, and energize. 
            Because food is more than fuel—it's therapy.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="rounded-full px-8 py-6 text-lg bg-primary hover:bg-primary/90 active:scale-95 transition-all"
              onClick={() => navigate('/chat')}
              data-testid="start-cooking-btn"
            >
              <ChefHat className="mr-2" size={24} />
              Start Cooking
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full px-8 py-6 text-lg border-2 active:scale-95 transition-all"
              onClick={() => navigate('/chat')}
              data-testid="how-it-works-btn"
            >
              How It Works
            </Button>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-serif text-center mb-16" data-testid="features-title">
            Mood-Responsive Cooking
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card rounded-2xl p-8 border border-border/40 hover:shadow-md transition-all" data-testid="feature-card-1">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <Heart className="text-primary" size={24} />
              </div>
              <h3 className="text-xl font-serif mb-3">Empathetic AI Chef</h3>
              <p className="text-muted-foreground">
                Share how you're feeling, and receive personalized meal suggestions that address your emotional and physical needs.
              </p>
            </div>
            
            <div className="bg-card rounded-2xl p-8 border border-border/40 hover:shadow-md transition-all" data-testid="feature-card-2">
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="text-accent" size={24} />
              </div>
              <h3 className="text-xl font-serif mb-3">Science-Backed Recipes</h3>
              <p className="text-muted-foreground">
                Every suggestion is rooted in nutritional science and the proven connection between food and mood.
              </p>
            </div>
            
            <div className="bg-card rounded-2xl p-8 border border-border/40 hover:shadow-md transition-all" data-testid="feature-card-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <ChefHat className="text-primary" size={24} />
              </div>
              <h3 className="text-xl font-serif mb-3">Your Energy Level</h3>
              <p className="text-muted-foreground">
                Choose from quick 15-minute meals or therapeutic hour-long recipes based on your current motivation.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Visual Showcase */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl sm:text-5xl font-serif mb-6" data-testid="showcase-title">
                From Stressed to
                <span className="block italic text-accent">Soothed</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                When life feels overwhelming, your body needs specific nutrients—magnesium for calm, complex carbs for serotonin, omega-3s for clarity. Our AI chef knows exactly what will help.
              </p>
              <Button
                size="lg"
                className="rounded-full bg-accent hover:bg-accent/90 active:scale-95 transition-all"
                onClick={() => navigate('/chat')}
                data-testid="tell-me-more-btn"
              >
                Tell Me How You Feel
              </Button>
            </div>
            <div className="rounded-3xl overflow-hidden shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1678831654422-f4f8f22e0cd6"
                alt="Healthy comfort food"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;