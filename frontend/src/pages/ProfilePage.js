import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { User, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ManageExclusions from '@/components/ManageExclusions';

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
  { name: 'Indian', flag: '🇮🇳' },
  { name: 'Chinese', flag: '🇨🇳' },
  { name: 'Italian', flag: '🇮🇹' },
  { name: 'Mexican', flag: '🇲🇽' },
  { name: 'Japanese', flag: '🇯🇵' },
  { name: 'Thai', flag: '🇹🇭' },
  { name: 'Mediterranean', flag: '🌊' },
  { name: 'American', flag: '🇺🇸' },
  { name: 'French', flag: '🇫🇷' },
  { name: 'Korean', flag: '🇰🇷' },
  { name: 'Middle Eastern', flag: '🌍' },
  { name: 'Southeast Asian', flag: '🌴' },
  { name: 'African', flag: '🌍' },
  { name: 'Latin American', flag: '🌎' },
];

const ProfilePage = () => {
  const { user, updateProfile, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [dietaryRestrictions, setDietaryRestrictions] = useState(user?.dietary_restrictions || []);
  const [cuisinePreferences, setCuisinePreferences] = useState(user?.cuisine_preferences || []);
  const [saving, setSaving] = useState(false);

  // Wait for loading to complete before redirecting
  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/');
    return null;
  }

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

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await updateProfile({
      name,
      dietary_restrictions: dietaryRestrictions,
      cuisine_preferences: cuisinePreferences
    });
    setSaving(false);
  };

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="profile-page">
      <div className="max-w-2xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-serif mb-3" data-testid="page-title">
            Your Profile
          </h1>
          <p className="text-muted-foreground" data-testid="page-description">
            Manage your preferences and dietary restrictions.
          </p>
        </div>

        <div className="bg-card rounded-3xl border border-border/40 p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <User size={32} className="text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-serif">{user?.name}</h2>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl"
                data-testid="name-input"
              />
            </div>

            <div className="space-y-3">
              <Label>Dietary Restrictions</Label>
              <p className="text-sm text-muted-foreground">
                Select your dietary preferences to get personalized meal suggestions.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {DIETARY_OPTIONS.map((option) => (
                  <div key={option} className="flex items-center gap-2">
                    <Checkbox
                      id={`profile-${option}`}
                      checked={dietaryRestrictions.includes(option)}
                      onCheckedChange={() => toggleDietary(option)}
                      data-testid={`dietary-${option}`}
                    />
                    <Label htmlFor={`profile-${option}`} className="text-sm cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Favorite Cuisines</Label>
              <p className="text-sm text-muted-foreground">
                Select cuisines you enjoy. AI will prioritize these in meal suggestions.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {CUISINE_OPTIONS.map((cuisine) => (
                  <div key={cuisine.name} className="flex items-center gap-2">
                    <Checkbox
                      id={`profile-cuisine-${cuisine.name}`}
                      checked={cuisinePreferences.includes(cuisine.name)}
                      onCheckedChange={() => toggleCuisine(cuisine.name)}
                      data-testid={`cuisine-${cuisine.name}`}
                    />
                    <Label htmlFor={`profile-cuisine-${cuisine.name}`} className="text-sm cursor-pointer flex items-center gap-1">
                      <span>{cuisine.flag}</span>
                      <span>{cuisine.name}</span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-primary hover:bg-primary/90 active:scale-95 transition-all"
              data-testid="save-profile-button"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </div>

        {/* Food Exclusions Section */}
        <ManageExclusions className="mt-8" />
      </div>
    </div>
  );
};

export default ProfilePage;