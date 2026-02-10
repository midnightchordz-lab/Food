import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Scan, ChefHat, Clock, Utensils, X, Loader2, RefreshCw, Apple, Carrot, Milk, Beef, Fish, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import axios from 'axios';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

const API = process.env.REACT_APP_BACKEND_URL;

const categoryIcons = {
  vegetable: Carrot,
  fruit: Apple,
  dairy: Milk,
  meat: Beef,
  seafood: Fish,
  other: Package
};

const categoryColors = {
  vegetable: 'bg-green-100 text-green-700 border-green-200',
  fruit: 'bg-orange-100 text-orange-700 border-orange-200',
  dairy: 'bg-blue-100 text-blue-700 border-blue-200',
  meat: 'bg-red-100 text-red-700 border-red-200',
  seafood: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  beverage: 'bg-purple-100 text-purple-700 border-purple-200',
  condiment: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  grain: 'bg-amber-100 text-amber-700 border-amber-200',
  snack: 'bg-pink-100 text-pink-700 border-pink-200',
  leftover: 'bg-gray-100 text-gray-700 border-gray-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200'
};

const FridgeScanner = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setScanResult(null);
    }
  };

  const handleCameraCapture = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setScanResult(null);
    }
  };

  const handleScan = async () => {
    if (!selectedImage) {
      toast.error('Please select or capture an image first');
      return;
    }

    setScanning(true);
    const formData = new FormData();
    formData.append('file', selectedImage);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/api/fridge-scanner/scan`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });

      setScanResult(response.data);
      toast.success(`Found ${response.data.ingredients.length} ingredients!`);
    } catch (error) {
      console.error('Scan error:', error);
      toast.error(error.response?.data?.detail || 'Failed to scan image');
    } finally {
      setScanning(false);
    }
  };

  const resetScanner = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setScanResult(null);
  };

  const getCategoryIcon = (category) => {
    const Icon = categoryIcons[category] || Package;
    return Icon;
  };

  return (
    <div className="min-h-screen bg-background pb-24 pt-20">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
            <Scan className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Fridge Scanner</h1>
          <p className="text-muted-foreground">Take a photo of your fridge and get instant recipe suggestions</p>
        </div>

        {/* Scanner Section */}
        {!scanResult ? (
          <Card className="mb-6">
            <CardContent className="p-6">
              {!previewUrl ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-muted rounded-xl">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Camera className="w-10 h-10 text-primary" />
                  </div>
                  <p className="text-lg font-medium mb-2">Capture Your Fridge</p>
                  <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                    Take a photo or upload an image of your open refrigerator
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-2"
                      data-testid="camera-btn"
                    >
                      <Camera className="w-4 h-4" />
                      Take Photo
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2"
                      data-testid="upload-btn"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Image
                    </Button>
                  </div>

                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleCameraCapture}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden">
                    <img
                      src={previewUrl}
                      alt="Fridge preview"
                      className="w-full h-64 sm:h-80 object-cover"
                    />
                    <button
                      onClick={resetScanner}
                      className="absolute top-3 right-3 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      onClick={handleScan}
                      disabled={scanning}
                      className="flex items-center gap-2"
                      size="lg"
                      data-testid="scan-btn"
                    >
                      {scanning ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Scan className="w-5 h-5" />
                          Scan Ingredients
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetScanner}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retake
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Scan Result Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Scan Results</h2>
                <p className="text-sm text-muted-foreground">
                  Found {scanResult.ingredients.length} ingredients
                </p>
              </div>
              <Button variant="outline" onClick={resetScanner} className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                New Scan
              </Button>
            </div>

            {/* Ingredients Grid */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Detected Ingredients
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {scanResult.ingredients.map((ingredient, index) => {
                    const Icon = getCategoryIcon(ingredient.category);
                    const colorClass = categoryColors[ingredient.category] || categoryColors.other;
                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full border ${colorClass}`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{ingredient.name}</span>
                        {ingredient.quantity && (
                          <span className="text-xs opacity-70">({ingredient.quantity})</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recipe Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChefHat className="w-5 h-5" />
                  Recipe Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {scanResult.suggested_recipes.map((recipe, index) => (
                    <div
                      key={index}
                      className="p-4 bg-secondary/30 rounded-xl border border-border hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg">{recipe.title}</h3>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          recipe.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                          recipe.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {recipe.difficulty}
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">{recipe.description}</p>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {recipe.cooking_time}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Utensils className="w-4 h-4" />
                          {recipe.ingredients_used?.length || 0} ingredients
                        </div>
                      </div>

                      {recipe.ingredients_used && recipe.ingredients_used.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">Uses from your fridge:</p>
                          <div className="flex flex-wrap gap-1">
                            {recipe.ingredients_used.map((ing, i) => (
                              <span key={i} className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs">
                                {ing}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground mb-1">Optional additions:</p>
                          <div className="flex flex-wrap gap-1">
                            {recipe.missing_ingredients.map((ing, i) => (
                              <span key={i} className="px-2 py-1 bg-orange-50 text-orange-700 rounded-full text-xs">
                                {ing}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tips Section */}
        {!scanResult && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className="text-xl">💡</span> Tips for Best Results
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Open your fridge wide and ensure good lighting
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Capture all shelves and door compartments if possible
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Move items forward so labels are visible
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Take the photo from a slight angle to show depth
                </li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default FridgeScanner;
