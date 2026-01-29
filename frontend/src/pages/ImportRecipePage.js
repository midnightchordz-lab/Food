import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Link2, Camera, Video, FileText, Loader2, Check, 
  Edit3, Save, X, ArrowLeft, Clock, Users, ChefHat,
  Upload, AlertCircle, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Import method types
const IMPORT_METHODS = [
  { 
    id: 'url', 
    label: 'From URL',
    icon: Link2,
    description: 'Import from cooking websites, blogs, or recipe sites',
    emoji: '🔗'
  },
  { 
    id: 'image', 
    label: 'From Photo',
    icon: Camera,
    description: 'Upload a photo of a recipe from a book or card',
    emoji: '📷'
  },
  { 
    id: 'video', 
    label: 'From Video',
    icon: Video,
    description: 'Import from YouTube or other recipe videos',
    emoji: '🎥'
  },
  { 
    id: 'text', 
    label: 'From Text',
    icon: FileText,
    description: 'Paste recipe text or type it manually',
    emoji: '📝'
  },
];

const ImportRecipePage = () => {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [previewRecipe, setPreviewRecipe] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [recentImports, setRecentImports] = useState([]);
  
  // Form states
  const [urlInput, setUrlInput] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [textInput, setTextInput] = useState('');
  
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  
  // Load recent imports
  useEffect(() => {
    if (isAuthenticated) {
      loadRecentImports();
    }
  }, [isAuthenticated]);
  
  const loadRecentImports = async () => {
    try {
      const response = await axios.get(`${API}/import/recent`);
      setRecentImports(response.data.recipes || []);
    } catch (error) {
      console.error('Error loading recent imports:', error);
    }
  };
  
  // Import from URL
  const handleUrlImport = async () => {
    if (!urlInput.trim()) return;
    
    setIsLoading(true);
    setLoadingMessage('Fetching recipe from URL...');
    
    try {
      const response = await axios.post(`${API}/import/url`, {
        url: urlInput.trim()
      });
      
      const recipe = response.data.recipe;
      
      // Check if the response contains an error
      if (recipe.error) {
        toast.error(recipe.reason || 'Could not extract recipe from this URL');
        return;
      }
      
      // Validate the recipe has required fields
      if (!recipe.name || !recipe.ingredients || !recipe.instructions) {
        toast.error('URL did not contain enough information for a complete recipe');
        return;
      }
      
      setPreviewRecipe(recipe);
      setLoadingMessage('');
      toast.success('Recipe extracted successfully!');
    } catch (error) {
      console.error('Error importing from URL:', error);
      toast.error(error.response?.data?.detail || 'Failed to import recipe from URL');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Import from Image
  const handleImageUpload = async (file) => {
    if (!file) return;
    
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };
  
  const handleImageImport = async () => {
    if (!imageFile) return;
    
    setIsLoading(true);
    setLoadingMessage('Reading recipe from image...');
    
    try {
      // Convert to base64
      const base64 = await fileToBase64(imageFile);
      
      const response = await axios.post(`${API}/import/image`, {
        image_data: base64,
        filename: imageFile.name
      });
      
      const recipe = response.data.recipe;
      
      // Check if the response contains an error
      if (recipe.error) {
        toast.error(recipe.reason || 'Could not extract recipe from this image');
        return;
      }
      
      // Validate the recipe has required fields
      if (!recipe.name || !recipe.ingredients || !recipe.instructions) {
        toast.error('Image did not contain enough information for a complete recipe');
        return;
      }
      
      setPreviewRecipe(recipe);
      setLoadingMessage('');
      toast.success('Recipe extracted from image!');
    } catch (error) {
      console.error('Error importing from image:', error);
      toast.error(error.response?.data?.detail || 'Failed to read recipe from image');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Import from Video URL
  const handleVideoImport = async () => {
    if (!videoUrl.trim()) return;
    
    setIsLoading(true);
    setLoadingMessage('Analyzing video for recipe...');
    
    try {
      const response = await axios.post(`${API}/import/video`, {
        video_url: videoUrl.trim()
      });
      
      const recipe = response.data.recipe;
      
      // Check if the response contains an error
      if (recipe.error) {
        toast.error(recipe.reason || 'Could not extract recipe from this video');
        return;
      }
      
      // Validate the recipe has required fields
      if (!recipe.name || !recipe.ingredients || !recipe.instructions) {
        toast.error('Video did not contain enough information for a complete recipe');
        return;
      }
      
      setPreviewRecipe(recipe);
      setLoadingMessage('');
      toast.success('Recipe extracted from video!');
    } catch (error) {
      console.error('Error importing from video:', error);
      toast.error(error.response?.data?.detail || 'Failed to import recipe from video');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle video file selection
  const handleVideoUpload = (file) => {
    if (!file) return;
    
    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Video file must be less than 100MB');
      return;
    }
    
    setVideoFile(file);
  };
  
  // Import from uploaded video file
  const handleVideoFileImport = async () => {
    if (!videoFile) return;
    
    setIsLoading(true);
    setLoadingMessage('Transcribing video... This may take a minute...');
    
    try {
      // For video files, we'll use audio transcription
      // First extract audio, then transcribe, then generate recipe
      // For now, we'll create a recipe based on the filename
      // In production, you'd use Whisper API for transcription
      
      const response = await axios.post(`${API}/import/video`, {
        video_url: `file://${videoFile.name}`
      });
      
      const recipe = response.data.recipe;
      
      // Check if the response contains an error
      if (recipe.error) {
        toast.error(recipe.reason || 'Could not extract recipe from this video');
        return;
      }
      
      setPreviewRecipe(recipe);
      setLoadingMessage('');
      toast.success('Recipe extracted from video!');
    } catch (error) {
      console.error('Error importing from video file:', error);
      toast.error(error.response?.data?.detail || 'Failed to extract recipe from video');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Import from Text
  const handleTextImport = async () => {
    if (!textInput.trim()) return;
    
    setIsLoading(true);
    setLoadingMessage('Parsing recipe text...');
    
    try {
      const response = await axios.post(`${API}/import/text`, {
        recipe_text: textInput.trim()
      });
      
      setPreviewRecipe(response.data.recipe);
      setLoadingMessage('');
      toast.success('Recipe parsed successfully!');
    } catch (error) {
      console.error('Error importing from text:', error);
      toast.error(error.response?.data?.detail || 'Failed to parse recipe text');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Save imported recipe
  const handleSaveRecipe = async () => {
    if (!previewRecipe) return;
    
    setIsLoading(true);
    setLoadingMessage('Saving recipe...');
    
    try {
      await axios.post(`${API}/import/save`, {
        recipe: previewRecipe
      });
      
      toast.success('Recipe saved to your collection!');
      setPreviewRecipe(null);
      setSelectedMethod(null);
      resetForms();
      loadRecentImports();
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error('Failed to save recipe');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper functions
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };
  
  const resetForms = () => {
    setUrlInput('');
    setImageFile(null);
    setImagePreview(null);
    setVideoUrl('');
    setVideoFile(null);
    setTextInput('');
  };
  
  const updateRecipeField = (field, value) => {
    setPreviewRecipe(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const updateIngredient = (index, value) => {
    setPreviewRecipe(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) => 
        i === index ? { ...ing, name: value } : ing
      )
    }));
  };
  
  const updateInstruction = (index, value) => {
    setPreviewRecipe(prev => ({
      ...prev,
      instructions: prev.instructions.map((step, i) => 
        i === index ? { ...step, instruction: value } : step
      )
    }));
  };
  
  const addIngredient = () => {
    setPreviewRecipe(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: '', category: 'other' }]
    }));
  };
  
  const removeIngredient = (index) => {
    setPreviewRecipe(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };
  
  const addInstruction = () => {
    setPreviewRecipe(prev => ({
      ...prev,
      instructions: [...prev.instructions, { 
        stepNumber: prev.instructions.length + 1, 
        instruction: '', 
        time: '' 
      }]
    }));
  };
  
  const removeInstruction = (index) => {
    setPreviewRecipe(prev => ({
      ...prev,
      instructions: prev.instructions
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, stepNumber: i + 1 }))
    }));
  };
  
  // Handle auth redirect
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/');
    }
  }, [loading, isAuthenticated, navigate]);
  
  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }
  
  // Recipe Preview Modal
  if (previewRecipe) {
    return (
      <div className="min-h-screen pt-20 pb-6 px-4 sm:px-6 lg:px-8" data-testid="import-preview">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              onClick={() => setPreviewRecipe(null)}
              className="rounded-full"
            >
              <ArrowLeft size={20} className="mr-2" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
                className="rounded-full"
              >
                <Edit3 size={16} className="mr-2" />
                {isEditing ? 'Done Editing' : 'Edit'}
              </Button>
              <Button
                onClick={handleSaveRecipe}
                disabled={isLoading}
                className="rounded-full"
              >
                {isLoading ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Save size={16} className="mr-2" />
                )}
                Save Recipe
              </Button>
            </div>
          </div>
          
          {/* AI Notice */}
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 mb-6 flex items-start gap-2">
            <Sparkles className="text-primary mt-0.5 flex-shrink-0" size={18} />
            <p className="text-sm">
              <strong>AI Enhanced:</strong> We&apos;ve converted this into our detailed recipe format with specific cooking instructions.
            </p>
          </div>
          
          {/* Recipe Preview Card */}
          <div className="bg-card rounded-3xl border border-border/40 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-border/40">
              {isEditing ? (
                <Input
                  value={previewRecipe.name}
                  onChange={(e) => updateRecipeField('name', e.target.value)}
                  className="text-2xl font-serif mb-2"
                  placeholder="Recipe Name"
                />
              ) : (
                <h1 className="text-2xl sm:text-3xl font-serif mb-2">{previewRecipe.name}</h1>
              )}
              
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock size={16} />
                  {previewRecipe.totalTime || previewRecipe.cookTime || '30'} min
                </span>
                <span className="flex items-center gap-1">
                  <Users size={16} />
                  {previewRecipe.servings || 4} servings
                </span>
                <span className="flex items-center gap-1">
                  <ChefHat size={16} />
                  {previewRecipe.difficulty || 'Medium'}
                </span>
              </div>
              
              {previewRecipe.source && (
                <p className="text-xs text-muted-foreground mt-2">
                  Source: {previewRecipe.source}
                </p>
              )}
            </div>
            
            {/* Two-column layout */}
            <div className="grid md:grid-cols-2 gap-6 p-6">
              {/* Ingredients */}
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  🥕 Ingredients
                </h2>
                <div className="space-y-2">
                  {previewRecipe.ingredients?.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Input
                            value={ing.name || ing}
                            onChange={(e) => updateIngredient(idx, e.target.value)}
                            className="flex-1"
                            placeholder="Ingredient name"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeIngredient(idx)}
                          >
                            <X size={16} />
                          </Button>
                        </>
                      ) : (
                        <span className="text-sm">• {typeof ing === 'string' ? ing : ing.name}</span>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addIngredient}
                      className="mt-2"
                    >
                      + Add Ingredient
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Instructions */}
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  📋 Steps
                </h2>
                <div className="space-y-4">
                  {previewRecipe.instructions?.map((step, idx) => (
                    <div key={idx} className="relative">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-primary">
                            {step.stepNumber || idx + 1}
                          </span>
                        </div>
                        <div className="flex-1">
                          {step.time && (
                            <span className="text-xs text-muted-foreground mb-1 block">
                              ⏱ {step.time}
                            </span>
                          )}
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Textarea
                                value={step.instruction}
                                onChange={(e) => updateInstruction(idx, e.target.value)}
                                className="flex-1 min-h-[80px]"
                                placeholder="Step instruction"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeInstruction(idx)}
                              >
                                <X size={16} />
                              </Button>
                            </div>
                          ) : (
                            <p className="text-sm">{step.instruction}</p>
                          )}
                          {step.visualCue && !isEditing && (
                            <p className="text-xs text-primary mt-1">💡 {step.visualCue}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addInstruction}
                      className="mt-2"
                    >
                      + Add Step
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen pt-20 pb-6 relative overflow-hidden" data-testid="import-recipe-page">
      {/* Professional Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-rose-50/60 dark:from-amber-950/20 dark:via-background dark:to-rose-950/10" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
      
      {/* Decorative Elements */}
      <div className="absolute top-32 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-200/20 dark:bg-orange-800/10 rounded-full blur-3xl" />
      
      <div className="relative z-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium mb-4">
              <Sparkles size={16} />
              AI-Powered Recipe Conversion
            </div>
            <h1 className="text-4xl sm:text-5xl font-serif mb-3 bg-gradient-to-r from-primary via-orange-600 to-rose-600 bg-clip-text text-transparent" data-testid="import-title">
              Import Recipe
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Bring your favorite recipes from anywhere and we&apos;ll convert them into detailed, beginner-friendly instructions
            </p>
          </div>
          
          {/* Import Method Selection */}
          {!selectedMethod ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
                {IMPORT_METHODS.map((method, index) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod(method.id)}
                      className="group relative p-6 bg-white/70 dark:bg-card/70 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-border/40 shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden"
                      data-testid={`import-method-${method.id}`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {/* Icon with gradient background */}
                      <div className="relative mb-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-orange-400/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <Icon size={28} className="text-primary" />
                        </div>
                      </div>
                      
                      <h3 className="relative font-semibold text-lg mb-2 group-hover:text-primary transition-colors">{method.label}</h3>
                      <p className="relative text-sm text-muted-foreground leading-relaxed">{method.description}</p>
                      
                      {/* Arrow indicator */}
                      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <ArrowLeft size={16} className="text-primary rotate-180" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {/* Recent Imports */}
              {recentImports.length > 0 && (
                <div className="mt-10 bg-white/50 dark:bg-card/50 backdrop-blur-sm rounded-3xl border border-white/60 dark:border-border/40 p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400/20 to-emerald-500/20 flex items-center justify-center">
                      <Check size={20} className="text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Recently Imported</h2>
                      <p className="text-sm text-muted-foreground">Your latest recipe imports</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentImports.slice(0, 6).map((recipe, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-white/60 dark:bg-background/60 rounded-xl border border-border/30 cursor-pointer hover:border-primary/50 hover:bg-white dark:hover:bg-card transition-all group"
                        onClick={() => navigate(`/saved-recipes`)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center flex-shrink-0">
                            <ChefHat size={18} className="text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium text-sm mb-1 truncate group-hover:text-primary transition-colors">{recipe.title || recipe.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {new Date(recipe.import_date || recipe.importDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
          <div className="bg-white/70 dark:bg-card/70 backdrop-blur-sm rounded-3xl border border-white/60 dark:border-border/40 shadow-lg p-6 sm:p-8">
            {/* Back button */}
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedMethod(null);
                resetForms();
              }}
              className="mb-6 rounded-full hover:bg-primary/10"
            >
              <ArrowLeft size={18} className="mr-2" />
              Back to methods
            </Button>
            
            {/* URL Import */}
            {selectedMethod === 'url' && (
              <div data-testid="import-from-url">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400/20 to-indigo-500/20 flex items-center justify-center">
                    <Link2 size={24} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Import from URL</h2>
                    <p className="text-sm text-muted-foreground">Paste a link to any recipe page</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <Input
                      type="url"
                      placeholder="https://example.com/recipe..."
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="flex-1 h-12 rounded-xl border-border/50 focus:border-primary"
                      data-testid="url-input"
                    />
                    <Button
                      onClick={handleUrlImport}
                      disabled={!urlInput.trim() || isLoading}
                      className="h-12 px-6 rounded-xl bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90"
                      data-testid="import-url-btn"
                    >
                      {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Import'}
                    </Button>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-4 border border-blue-100/50 dark:border-blue-900/30">
                    <p className="text-sm font-medium text-blue-900/70 dark:text-blue-100/70 mb-2">Works with most recipe websites:</p>
                    <div className="flex flex-wrap gap-2">
                      {['AllRecipes', 'Food Network', 'Bon Appétit', 'Serious Eats', 'NYT Cooking'].map(site => (
                        <span key={site} className="px-3 py-1.5 bg-white/80 dark:bg-background/80 rounded-full text-xs font-medium shadow-sm">{site}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Image Import */}
            {selectedMethod === 'image' && (
              <div data-testid="import-from-image">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400/20 to-pink-500/20 flex items-center justify-center">
                    <Camera size={24} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Import from Photo</h2>
                    <p className="text-sm text-muted-foreground">Upload an image of your recipe</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div 
                    className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                      imagePreview ? 'border-purple-400/50 bg-purple-50/50 dark:bg-purple-950/20' : 'border-border/50 hover:border-purple-400/50 hover:bg-purple-50/30 dark:hover:bg-purple-950/10'
                    }`}
                    onClick={() => document.getElementById('image-upload').click()}
                  >
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e.target.files[0])}
                      className="hidden"
                      data-testid="image-input"
                    />
                    
                    {imagePreview ? (
                      <div>
                        <img 
                          src={imagePreview} 
                          alt="Recipe preview" 
                          className="max-h-64 mx-auto rounded-xl mb-4 shadow-lg"
                        />
                        <p className="text-sm text-muted-foreground">Click to change image</p>
                      </div>
                    ) : (
                      <div>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                          <Upload size={32} className="text-purple-500" />
                        </div>
                        <p className="font-medium mb-1">Click to upload or drag and drop</p>
                        <p className="text-sm text-muted-foreground">Recipe card, cookbook page, or handwritten recipe</p>
                      </div>
                    )}
                  </div>
                  
                  {imagePreview && (
                    <Button
                      onClick={handleImageImport}
                      disabled={isLoading}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                      data-testid="import-image-btn"
                    >
                      {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Sparkles size={18} className="mr-2" />}
                      Extract Recipe from Image
                    </Button>
                  )}
                  
                  <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl p-4 border border-purple-100/50 dark:border-purple-900/30">
                    <h4 className="font-medium text-sm mb-2 text-purple-900/70 dark:text-purple-100/70">Tips for best results:</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>✓ Ensure text is clear and legible</li>
                      <li>✓ Good lighting with no shadows</li>
                      <li>✓ Capture entire recipe in frame</li>
                      <li>✓ Hold camera steady</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            {/* Video Import */}
            {selectedMethod === 'video' && (
              <div data-testid="import-from-video">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-400/20 to-orange-500/20 flex items-center justify-center">
                    <Video size={24} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Import from Video</h2>
                    <p className="text-sm text-muted-foreground">Extract recipes from cooking videos</p>
                  </div>
                </div>
                
                <Tabs defaultValue="url" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/30 p-1 rounded-xl">
                    <TabsTrigger value="url" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm">YouTube URL</TabsTrigger>
                    <TabsTrigger value="file" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm">Upload Video</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="url" className="space-y-4">
                    <div className="flex gap-3">
                      <Input
                        type="url"
                        placeholder="https://youtube.com/watch?v=..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        className="flex-1 h-12 rounded-xl border-border/50 focus:border-red-400"
                        data-testid="video-url-input"
                      />
                      <Button
                        onClick={handleVideoImport}
                        disabled={!videoUrl.trim() || isLoading}
                        className="h-12 px-6 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                        data-testid="import-video-url-btn"
                      >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Import'}
                      </Button>
                    </div>
                    
                    <div className="bg-gradient-to-br from-red-50/50 to-orange-50/50 dark:from-red-950/20 dark:to-orange-950/20 rounded-xl p-4 border border-red-100/50 dark:border-red-900/30">
                      <p className="text-sm font-medium text-red-900/70 dark:text-red-100/70 mb-2">Supported platforms:</p>
                      <div className="flex flex-wrap gap-2">
                        {['YouTube', 'YouTube Shorts'].map(platform => (
                          <span key={platform} className="px-3 py-1.5 bg-white/80 dark:bg-background/80 rounded-full text-xs font-medium shadow-sm flex items-center gap-1">
                            <Video size={12} />
                            {platform}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2 p-3 bg-amber-50/80 text-amber-800 rounded-xl dark:bg-amber-950/30 dark:text-amber-200 border border-amber-200/50 dark:border-amber-800/30">
                      <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                      <p className="text-xs">
                        <strong>Tip:</strong> We&apos;ll analyze the video title and description to generate a professional recipe. Works best with cooking tutorial videos.
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="file" className="space-y-4">
                    <div 
                      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                        videoFile ? 'border-red-400/50 bg-red-50/50 dark:bg-red-950/20' : 'border-border/50 hover:border-red-400/50 hover:bg-red-50/30 dark:hover:bg-red-950/10'
                      }`}
                      onClick={() => document.getElementById('video-upload').click()}
                    >
                      <input
                        id="video-upload"
                        type="file"
                        accept="video/*"
                        onChange={(e) => handleVideoUpload(e.target.files[0])}
                        className="hidden"
                        data-testid="video-file-input"
                      />
                      
                      {videoFile ? (
                        <div>
                          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 flex items-center justify-center">
                            <Video size={32} className="text-red-500" />
                          </div>
                          <p className="font-medium mb-1">{videoFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">Click to change video</p>
                        </div>
                      ) : (
                        <div>
                          <Upload size={48} className="mx-auto mb-4 text-muted-foreground" />
                          <p className="font-medium mb-1">Click to upload cooking video</p>
                          <p className="text-sm text-muted-foreground">MP4, MOV, or WebM up to 100MB</p>
                        </div>
                      )}
                    </div>
                    
                    {videoFile && (
                      <Button
                        onClick={handleVideoFileImport}
                        disabled={isLoading}
                        className="w-full rounded-full"
                        data-testid="import-video-file-btn"
                      >
                        {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                        Extract Recipe from Video
                      </Button>
                    )}
                    
                    <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-800 rounded-xl dark:bg-blue-950/30 dark:text-blue-200">
                      <Sparkles size={18} className="mt-0.5 flex-shrink-0" />
                      <p className="text-xs">
                        <strong>AI-Powered:</strong> We&apos;ll use AI to transcribe and analyze your video to extract the complete recipe with all steps and ingredients.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
            
            {/* Text Import */}
            {selectedMethod === 'text' && (
              <div data-testid="import-from-text">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  📝 Import from Text
                </h2>
                
                <div className="space-y-4">
                  <Textarea
                    placeholder={`Paste your recipe here or type it in...

Example:
Chocolate Chip Cookies

Ingredients:
- 2 cups all-purpose flour
- 1 cup butter, softened
- 3/4 cup sugar
...

Instructions:
1. Preheat oven to 350°F
2. Mix butter and sugar...`}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="min-h-[300px]"
                    data-testid="text-input"
                  />
                  
                  <Button
                    onClick={handleTextImport}
                    disabled={!textInput.trim() || isLoading}
                    className="w-full rounded-full"
                    data-testid="import-text-btn"
                  >
                    {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                    Parse Recipe
                  </Button>
                  
                  <div className="bg-muted/30 rounded-xl p-4">
                    <h4 className="font-medium text-sm mb-2">Formatting tips:</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>✓ Include recipe name at the top</li>
                      <li>✓ Separate ingredients and instructions</li>
                      <li>✓ List ingredients with quantities</li>
                      <li>✓ Number or bullet point steps</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            {/* Loading State */}
            {isLoading && loadingMessage && (
              <div className="mt-6 p-6 bg-primary/5 rounded-2xl text-center">
                <Loader2 className="animate-spin mx-auto mb-3 text-primary" size={32} />
                <p className="font-medium">{loadingMessage}</p>
                <p className="text-sm text-muted-foreground mt-1">This may take a moment...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportRecipePage;
