import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  ChefHat, 
  Heart, 
  Sparkles, 
  MessageCircle, 
  Import, 
  Calendar, 
  ShoppingCart, 
  Activity, 
  Mic, 
  Camera, 
  Video, 
  FileText,
  Star,
  Globe,
  Utensils,
  Brain,
  Salad,
  Wine,
  Check
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/AuthModal';

const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  
  const handleStartCooking = () => {
    if (isAuthenticated) {
      navigate('/chat');
    } else {
      setShowAuthModal(true);
    }
  };
  
  const keyFeatures = [
    {
      icon: Brain,
      title: "Mood-Based Recipe Discovery",
      description: "Tell us how you're feeling - happy, stressed, tired, cozy - and get personalized recipes that match your emotional state.",
      highlight: "AI understands your mood",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10"
    },
    {
      icon: Activity,
      title: "Diabetes-Friendly Meal Planning",
      description: "Specialized tab with research-backed recipes. AI researches your diabetes type first, then suggests blood sugar-safe meals with Net Carbs & Glycemic Index.",
      highlight: "Evidence-based approach",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    },
    {
      icon: Import,
      title: "Import Recipes from Anywhere",
      description: "Paste a URL, upload a photo of a recipe, share a YouTube cooking video, or type plain text - AI converts ANY recipe into our detailed format.",
      highlight: "4 import methods",
      color: "text-green-500",
      bgColor: "bg-green-500/10"
    },
    {
      icon: Mic,
      title: "Voice-Enabled Cooking",
      description: "Talk to your AI chef hands-free! Ask questions, get recipe suggestions, and navigate the app using just your voice.",
      highlight: "Hands-free experience",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10"
    },
    {
      icon: Calendar,
      title: "Weekly Meal Planner",
      description: "Drag and drop recipes into your weekly schedule. Plan breakfast, lunch, and dinner for the entire week.",
      highlight: "Organized meal prep",
      color: "text-pink-500",
      bgColor: "bg-pink-500/10"
    },
    {
      icon: ShoppingCart,
      title: "Smart Shopping List",
      description: "Automatically generate shopping lists from your recipes. Ingredients are categorized by store section for easy shopping.",
      highlight: "One-tap grocery lists",
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10"
    }
  ];

  const importMethods = [
    { icon: Globe, label: "From URL", desc: "Paste any recipe website link" },
    { icon: Camera, label: "From Photo", desc: "Snap a recipe card or cookbook" },
    { icon: Video, label: "From Video", desc: "YouTube cooking tutorials" },
    { icon: FileText, label: "From Text", desc: "Paste plain text recipes" }
  ];

  const recipeFeatures = [
    "Step-by-step instructions with exact timings",
    "Precise temperatures (°F and °C)",
    "Visual cues for each cooking step",
    "Beginner-friendly technique explanations",
    "Cuisine-specific drink pairings",
    "Nutritional information per serving",
    "Chef's tips and variations",
    "Storage and reheating instructions"
  ];
  
  return (
    <>
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
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif font-bold tracking-tight mb-4" data-testid="hero-title">
              MOOD
              <span className="block italic text-primary">FOOD</span>
            </h1>
            
            <p className="text-xl sm:text-2xl font-medium text-muted-foreground mb-8" data-testid="hero-tagline">
              When Feelings Need Feeding
            </p>
            
            <p className="text-lg sm:text-xl text-muted-foreground/80 max-w-2xl mx-auto mb-12" data-testid="hero-description">
              A compassionate AI chef who understands your mood and suggests meals that heal, comfort, and energize. 
              Because food is more than fuel—it&apos;s therapy.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="rounded-full px-8 py-6 text-lg bg-primary hover:bg-primary/90 active:scale-95 transition-all"
                onClick={handleStartCooking}
                data-testid="start-cooking-btn"
              >
                <ChefHat className="mr-2" size={24} />
                Start Cooking
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8 py-6 text-lg border-2 active:scale-95 transition-all"
                onClick={() => setShowHowItWorks(true)}
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
                  Share how you&apos;re feeling, and receive personalized meal suggestions that address your emotional and physical needs.
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
                  onClick={handleStartCooking}
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
      
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      
      {/* How It Works Modal */}
      <Dialog open={showHowItWorks} onOpenChange={setShowHowItWorks}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-3xl font-serif text-white flex items-center gap-3">
                <Sparkles size={32} />
                Discover MOOD FOOD
              </DialogTitle>
              <p className="text-white/90 mt-2">
                When Feelings Need Feeding - Your AI-powered kitchen companion
              </p>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-8">
            {/* Key Features Grid */}
            <div>
              <h3 className="text-xl font-serif mb-4 flex items-center gap-2">
                <Star className="text-accent" size={24} />
                Key Features
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                {keyFeatures.map((feature, idx) => (
                  <div 
                    key={idx} 
                    className="bg-card border border-border/40 rounded-xl p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 ${feature.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <feature.icon className={feature.color} size={20} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">{feature.title}</h4>
                        <p className="text-sm text-muted-foreground mb-2">{feature.description}</p>
                        <span className={`inline-block px-2 py-1 ${feature.bgColor} ${feature.color} rounded-full text-xs font-medium`}>
                          {feature.highlight}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Import Recipe Highlight */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-2xl p-6 border border-green-200/50 dark:border-green-800/50">
              <h3 className="text-xl font-serif mb-4 flex items-center gap-2">
                <Import className="text-green-600" size={24} />
                Import Recipes from Anywhere
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {importMethods.map((method, idx) => (
                  <div key={idx} className="bg-white/80 dark:bg-background/80 rounded-xl p-3 text-center">
                    <method.icon className="mx-auto mb-2 text-green-600" size={24} />
                    <p className="font-medium text-sm">{method.label}</p>
                    <p className="text-xs text-muted-foreground">{method.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-green-800 dark:text-green-200 bg-green-100/50 dark:bg-green-900/30 rounded-lg p-3">
                <strong>AI Magic:</strong> Any recipe you import is automatically converted into our detailed, beginner-friendly format with exact timings, temperatures, and visual cues!
              </p>
            </div>
            
            {/* Recipe Quality */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 rounded-2xl p-6 border border-orange-200/50 dark:border-orange-800/50">
              <h3 className="text-xl font-serif mb-4 flex items-center gap-2">
                <Utensils className="text-orange-600" size={24} />
                Restaurant-Quality Recipes
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Every recipe includes detailed instructions that even complete beginners can follow:
              </p>
              <div className="grid md:grid-cols-2 gap-2">
                {recipeFeatures.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Check className="text-orange-600 flex-shrink-0" size={16} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Drink Pairings */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-2xl p-6 border border-purple-200/50 dark:border-purple-800/50">
              <h3 className="text-xl font-serif mb-3 flex items-center gap-2">
                <Wine className="text-purple-600" size={24} />
                Perfect Drink Pairings
              </h3>
              <p className="text-sm text-muted-foreground">
                Every recipe includes <strong>cuisine-specific</strong> drink suggestions - both alcoholic and non-alcoholic options. 
                Italian pasta? Get Chianti recommendations. Thai curry? Discover the perfect lemongrass cooler.
              </p>
            </div>
            
            {/* CTA */}
            <div className="text-center pt-4">
              <Button
                size="lg"
                className="rounded-full px-10 py-6 text-lg bg-primary hover:bg-primary/90"
                onClick={() => {
                  setShowHowItWorks(false);
                  handleStartCooking();
                }}
              >
                <ChefHat className="mr-2" size={24} />
                Start Your Culinary Journey
              </Button>
              <p className="text-sm text-muted-foreground mt-3">
                Free to use • No credit card required
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LandingPage;