import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DIETARY_OPTIONS = [
  'Non-Vegetarian',
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Halal',
  'Kosher',
  'Low-Carb',
  'Keto',
  'Paleo'
];

const CUISINE_OPTIONS = [
  { name: 'Indian', flag: '🇮🇳', regional: ['North Indian', 'South Indian', 'Bengali', 'Punjabi', 'Gujarati'] },
  { name: 'Chinese', flag: '🇨🇳', regional: ['Cantonese', 'Sichuan', 'Hunan', 'Shanghai'] },
  { name: 'Italian', flag: '🇮🇹', regional: ['Tuscan', 'Sicilian', 'Roman', 'Neapolitan'] },
  { name: 'Mexican', flag: '🇲🇽', regional: ['Tex-Mex', 'Yucatan', 'Oaxacan'] },
  { name: 'Japanese', flag: '🇯🇵', regional: ['Sushi', 'Ramen', 'Tempura'] },
  { name: 'Thai', flag: '🇹🇭', regional: ['Central Thai', 'Northern Thai', 'Southern Thai'] },
  { name: 'Mediterranean', flag: '🌊', regional: ['Greek', 'Lebanese', 'Turkish', 'Moroccan'] },
  { name: 'American', flag: '🇺🇸', regional: ['Southern', 'BBQ', 'Cajun', 'Soul Food'] },
  { name: 'French', flag: '🇫🇷', regional: ['Provençal', 'Burgundy', 'Alsatian'] },
  { name: 'Korean', flag: '🇰🇷', regional: ['Seoul', 'Jeju', 'Traditional'] },
  { name: 'Middle Eastern', flag: '🌍', regional: ['Persian', 'Arabian', 'Israeli'] },
  { name: 'Southeast Asian', flag: '🌴', regional: ['Vietnamese', 'Filipino', 'Indonesian', 'Malaysian'] },
  { name: 'African', flag: '🌍', regional: ['Ethiopian', 'Nigerian', 'North African'] },
  { name: 'Latin American', flag: '🌎', regional: ['Brazilian', 'Argentinian', 'Peruvian', 'Caribbean'] },
];

const AuthModal = ({ open, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState([]);
  const [cuisinePreferences, setCuisinePreferences] = useState([]);
  const [loading, setLoading] = useState(false);
  const { register, login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let success;
    if (isLogin) {
      success = await login(email, password);
    } else {
      success = await register(email, password, name, dietaryRestrictions, cuisinePreferences);
    }

    setLoading(false);
    if (success) {
      onClose();
      resetForm();
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setDietaryRestrictions([]);
    setCuisinePreferences([]);
  };

  const toggleDietary = (option) => {
    setDietaryRestrictions(prev =>
      prev.includes(option)
        ? prev.filter(item => item !== option)
        : [...prev, option]
    );
  };

  const toggleCuisine = (cuisine) => {
    setCuisinePreferences(prev =>
      prev.includes(cuisine)
        ? prev.filter(item => item !== cuisine)
        : [...prev, cuisine]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="auth-modal">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-2">
          <DialogTitle className="text-3xl font-serif">
            {isLogin ? 'Welcome Back' : 'Join Chef Feels'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-xl"
                data-testid="name-input"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-xl"
              data-testid="email-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-xl"
              data-testid="password-input"
            />
          </div>

          {!isLogin && (
            <>
              <div className="space-y-3">
                <Label>Dietary Restrictions (Optional)</Label>
                <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto p-2 border rounded-xl">
                  {DIETARY_OPTIONS.map((option) => (
                    <div key={option} className="flex items-center gap-2">
                      <Checkbox
                        id={option}
                        checked={dietaryRestrictions.includes(option)}
                        onCheckedChange={() => toggleDietary(option)}
                        data-testid={`dietary-${option}`}
                      />
                      <Label htmlFor={option} className="text-sm cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Cuisine Preferences (Optional)</Label>
                <p className="text-xs text-muted-foreground">Select your favorite cuisines for personalized meal suggestions</p>
                <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto p-2 border rounded-xl">
                  {CUISINE_OPTIONS.map((cuisine) => (
                    <div key={cuisine.name} className="flex items-center gap-2">
                      <Checkbox
                        id={`cuisine-${cuisine.name}`}
                        checked={cuisinePreferences.includes(cuisine.name)}
                        onCheckedChange={() => toggleCuisine(cuisine.name)}
                        data-testid={`cuisine-${cuisine.name}`}
                      />
                      <Label htmlFor={`cuisine-${cuisine.name}`} className="text-sm cursor-pointer flex items-center gap-1">
                        <span>{cuisine.flag}</span>
                        <span>{cuisine.name}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary hover:bg-primary/90 active:scale-95 transition-all"
            data-testid="auth-submit-button"
          >
            {loading ? 'Please wait...' : isLogin ? 'Log In' : 'Sign Up'}
          </Button>
        </form>

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              resetForm();
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="toggle-auth-mode"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;