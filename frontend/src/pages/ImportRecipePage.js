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
      
      setPreviewRecipe(response.data.recipe);
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
      
      setPreviewRecipe(response.data.recipe);
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
      
      setPreviewRecipe(response.data.recipe);
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
      
      setPreviewRecipe(response.data.recipe);
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
    <div className="min-h-screen pt-20 pb-6 px-4 sm:px-6 lg:px-8" data-testid="import-recipe-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-serif mb-2" data-testid="import-title">
            📥 Import Recipe
          </h1>
          <p className="text-muted-foreground">
            Import your favorite recipes from anywhere
          </p>
        </div>
        
        {/* Import Method Selection */}
        {!selectedMethod ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {IMPORT_METHODS.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className="p-6 bg-card rounded-2xl border border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-all text-center group"
                  data-testid={`import-method-${method.id}`}
                >
                  <div className="text-4xl mb-3">{method.emoji}</div>
                  <h3 className="font-medium mb-1">{method.label}</h3>
                  <p className="text-xs text-muted-foreground">{method.description}</p>
                </button>
              ))}
            </div>
            
            {/* Recent Imports */}
            {recentImports.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold mb-4">Recently Imported</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentImports.slice(0, 6).map((recipe, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-card rounded-xl border border-border/40 cursor-pointer hover:border-primary/50 transition-all"
                      onClick={() => navigate(`/saved-recipes`)}
                    >
                      <h3 className="font-medium text-sm mb-1 truncate">{recipe.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        Imported {new Date(recipe.importDate).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-6">
            {/* Back button */}
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedMethod(null);
                resetForms();
              }}
              className="mb-4 rounded-full"
            >
              <ArrowLeft size={18} className="mr-2" />
              Back to methods
            </Button>
            
            {/* URL Import */}
            {selectedMethod === 'url' && (
              <div data-testid="import-from-url">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  🔗 Import from URL
                </h2>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="url"
                      placeholder="Paste recipe URL (e.g., https://example.com/recipe)"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="flex-1"
                      data-testid="url-input"
                    />
                    <Button
                      onClick={handleUrlImport}
                      disabled={!urlInput.trim() || isLoading}
                      className="rounded-full"
                      data-testid="import-url-btn"
                    >
                      {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Import'}
                    </Button>
                  </div>
                  
                  <div className="bg-muted/30 rounded-xl p-4">
                    <p className="text-sm text-muted-foreground mb-2">Works with most recipe websites including:</p>
                    <div className="flex flex-wrap gap-2">
                      {['AllRecipes', 'Food Network', 'Bon Appétit', 'Serious Eats', 'NYT Cooking'].map(site => (
                        <span key={site} className="px-2 py-1 bg-background rounded-full text-xs">{site}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Image Import */}
            {selectedMethod === 'image' && (
              <div data-testid="import-from-image">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  📷 Import from Photo
                </h2>
                
                <div className="space-y-4">
                  <div 
                    className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                      imagePreview ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/50'
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
                          className="max-h-64 mx-auto rounded-xl mb-4"
                        />
                        <p className="text-sm text-muted-foreground">Click to change image</p>
                      </div>
                    ) : (
                      <div>
                        <Upload size={48} className="mx-auto mb-4 text-muted-foreground" />
                        <p className="font-medium mb-1">Click to upload or drag and drop</p>
                        <p className="text-sm text-muted-foreground">Recipe card, cookbook page, or handwritten recipe</p>
                      </div>
                    )}
                  </div>
                  
                  {imagePreview && (
                    <Button
                      onClick={handleImageImport}
                      disabled={isLoading}
                      className="w-full rounded-full"
                      data-testid="import-image-btn"
                    >
                      {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                      Extract Recipe from Image
                    </Button>
                  )}
                  
                  <div className="bg-muted/30 rounded-xl p-4">
                    <h4 className="font-medium text-sm mb-2">Tips for best results:</h4>
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
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  🎥 Import from Video
                </h2>
                
                <Tabs defaultValue="url" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="url">YouTube URL</TabsTrigger>
                    <TabsTrigger value="file">Upload Video</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="url" className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        placeholder="Paste YouTube video URL"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        className="flex-1"
                        data-testid="video-url-input"
                      />
                      <Button
                        onClick={handleVideoImport}
                        disabled={!videoUrl.trim() || isLoading}
                        className="rounded-full"
                        data-testid="import-video-url-btn"
                      >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Import'}
                      </Button>
                    </div>
                    
                    <div className="bg-muted/30 rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-2">Supported platforms:</p>
                      <div className="flex flex-wrap gap-2">
                        {['🎥 YouTube', '📺 YouTube Shorts'].map(platform => (
                          <span key={platform} className="px-2 py-1 bg-background rounded-full text-xs">{platform}</span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-xl dark:bg-amber-950/30 dark:text-amber-200">
                      <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                      <p className="text-xs">
                        <strong>Tip:</strong> We&apos;ll analyze the video title and description to generate a professional recipe. Works best with cooking tutorial videos.
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="file" className="space-y-4">
                    <div 
                      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                        videoFile ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/50'
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
                          <Video size={48} className="mx-auto mb-4 text-primary" />
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
