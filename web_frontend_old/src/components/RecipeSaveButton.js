import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RecipeSaveButton = ({ recipe, size = 'default', variant = 'default' }) => {
  const [saving, setSaving] = useState(false);
  const { isAuthenticated } = useAuth();

  const handleSave = async (e) => {
    e.stopPropagation();
    
    if (!isAuthenticated) {
      toast.error('Please log in to save recipes');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/recipes/save`, { recipe });
      toast.success('Recipe saved to your collection!');
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error('Failed to save recipe');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      onClick={handleSave}
      disabled={saving}
      size={size}
      variant={variant}
      className="rounded-full active:scale-95 transition-all"
      data-testid="save-recipe-button"
    >
      <Heart size={18} className="mr-2" />
      {saving ? 'Saving...' : 'Save Recipe'}
    </Button>
  );
};

export default RecipeSaveButton;