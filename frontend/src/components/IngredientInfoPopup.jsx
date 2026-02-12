/**
 * Ingredient Info Popup
 * Shows visual guide when user taps ingredient name in recipe
 */

import { useState, useEffect } from 'react';
import { 
  X, Info, AlertTriangle, Eye, Utensils, Store, 
  Package, RefreshCw, Loader2, ExternalLink, ChevronRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * IngredientInfoPopup - Visual guide popup for ingredients
 * Shows when user clicks on an ingredient name in recipe
 */
const IngredientInfoPopup = ({ ingredientName, isOpen, onClose }) => {
  const [ingredient, setIngredient] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && ingredientName) {
      loadIngredientInfo();
    }
    // Reset state when closed
    if (!isOpen) {
      setIngredient(null);
      setError(null);
    }
  }, [isOpen, ingredientName]);

  const loadIngredientInfo = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API}/ingredients/name/${encodeURIComponent(ingredientName)}`
      );

      if (response.data.success) {
        setIngredient(response.data.ingredient);
      } else {
        setError('No guide available for this ingredient yet.');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No visual guide available for this ingredient yet.');
      } else {
        setError('Failed to load ingredient info. Please try again.');
      }
      console.error('Failed to load ingredient info:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Category badge colors
  const getCategoryColor = (category) => {
    const colors = {
      'spice_whole': 'bg-amber-100 text-amber-800',
      'spice_ground': 'bg-orange-100 text-orange-800',
      'herb_fresh': 'bg-green-100 text-green-800',
      'herb_dried': 'bg-lime-100 text-lime-800',
      'pulse_lentil': 'bg-yellow-100 text-yellow-800',
      'pulse_bean': 'bg-amber-100 text-amber-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const formatCategory = (category) => {
    return category?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Ingredient';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0 overflow-hidden" data-testid="ingredient-info-popup">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="w-10 h-10 animate-spin text-[#5D7A5D] mb-4" />
            <p className="text-muted-foreground">Loading ingredient guide...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Info className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <p className="text-sm text-muted-foreground mb-4">
              Searched for: "{ingredientName}"
            </p>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )}

        {/* Content */}
        {ingredient && !isLoading && (
          <>
            {/* Header with Image */}
            <div className="relative">
              {/* Background Image */}
              <div className="h-48 bg-gradient-to-br from-[#5D7A5D]/20 to-[#5D7A5D]/5 relative overflow-hidden">
                {ingredient.images?.primary && (
                  <img
                    src={ingredient.images.primary}
                    alt={ingredient.display_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              </div>
              
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Title Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${getCategoryColor(ingredient.category)}`}>
                  {formatCategory(ingredient.category)}
                </span>
                <h2 className="text-2xl font-bold">{ingredient.display_name}</h2>
                {ingredient.alternate_names?.length > 0 && (
                  <p className="text-sm text-white/80 mt-1">
                    Also: {ingredient.alternate_names.slice(0, 3).join(', ')}
                  </p>
                )}
              </div>
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="h-[calc(85vh-12rem)]">
              <div className="p-4 space-y-5">
                
                {/* What it looks like */}
                <section>
                  <h3 className="flex items-center gap-2 font-semibold text-base mb-3">
                    <Eye className="w-4 h-4 text-[#5D7A5D]" />
                    What it looks like
                  </h3>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    {ingredient.appearance?.color && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground text-sm w-16 flex-shrink-0">Color:</span>
                        <span className="text-sm">{ingredient.appearance.color}</span>
                      </div>
                    )}
                    {ingredient.appearance?.shape && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground text-sm w-16 flex-shrink-0">Shape:</span>
                        <span className="text-sm">{ingredient.appearance.shape}</span>
                      </div>
                    )}
                    {ingredient.appearance?.size && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground text-sm w-16 flex-shrink-0">Size:</span>
                        <span className="text-sm">{ingredient.appearance.size}</span>
                      </div>
                    )}
                    {ingredient.appearance?.visual_description && (
                      <p className="text-sm text-muted-foreground pt-2 border-t">
                        {ingredient.appearance.visual_description}
                      </p>
                    )}
                  </div>
                </section>

                {/* Comparison Images */}
                {ingredient.images?.comparison?.length > 0 && (
                  <section>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {ingredient.images.comparison.filter(img => img.url).map((img, idx) => (
                        <div key={idx} className="flex-shrink-0 w-32">
                          <img
                            src={img.url}
                            alt={img.caption}
                            className="w-32 h-24 object-cover rounded-lg"
                          />
                          <p className="text-xs text-muted-foreground mt-1 text-center">{img.caption}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Don't Confuse With - Warning */}
                {ingredient.confused_with?.length > 0 && (
                  <section className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <h3 className="flex items-center gap-2 font-semibold text-base mb-2 text-amber-800">
                      <AlertTriangle className="w-4 h-4" />
                      Don't confuse with
                    </h3>
                    {ingredient.confused_with.map((item, idx) => (
                      <div key={idx} className="mb-2 last:mb-0">
                        <p className="font-medium text-amber-900">{item.name}</p>
                        <p className="text-sm text-amber-700">{item.warning}</p>
                      </div>
                    ))}
                  </section>
                )}

                {/* Similar To */}
                {ingredient.similar_to?.length > 0 && (
                  <section>
                    <h3 className="flex items-center gap-2 font-semibold text-base mb-3">
                      <RefreshCw className="w-4 h-4 text-[#5D7A5D]" />
                      Similar to
                    </h3>
                    <div className="space-y-2">
                      {ingredient.similar_to.map((item, idx) => (
                        <div key={idx} className="bg-muted/50 rounded-lg p-3">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.how_to_differentiate}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* How to Use */}
                {ingredient.preparation_tips?.length > 0 && (
                  <section>
                    <h3 className="flex items-center gap-2 font-semibold text-base mb-3">
                      <Utensils className="w-4 h-4 text-[#5D7A5D]" />
                      How to use
                    </h3>
                    <ul className="space-y-1.5">
                      {ingredient.preparation_tips.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <ChevronRight className="w-4 h-4 text-[#5D7A5D] flex-shrink-0 mt-0.5" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Substitutes */}
                {ingredient.substitutes?.length > 0 && (
                  <section>
                    <h3 className="flex items-center gap-2 font-semibold text-base mb-3">
                      <RefreshCw className="w-4 h-4 text-[#5D7A5D]" />
                      Can substitute with
                    </h3>
                    <div className="space-y-2">
                      {ingredient.substitutes.map((sub, idx) => (
                        <div key={idx} className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{sub.name}</p>
                            {sub.ratio && <p className="text-xs text-[#5D7A5D]">{sub.ratio}</p>}
                            {sub.notes && <p className="text-xs text-muted-foreground mt-1">{sub.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Beginner Tip - Highlighted */}
                {ingredient.beginner_notes && (
                  <section className="bg-[#5D7A5D]/10 border border-[#5D7A5D]/20 rounded-lg p-4">
                    <h3 className="flex items-center gap-2 font-semibold text-base mb-2 text-[#5D7A5D]">
                      💡 Beginner Tip
                    </h3>
                    <p className="text-sm">{ingredient.beginner_notes}</p>
                  </section>
                )}

                {/* Storage Info */}
                {(ingredient.storage?.method || ingredient.storage?.shelf_life) && (
                  <section>
                    <h3 className="flex items-center gap-2 font-semibold text-base mb-3">
                      <Package className="w-4 h-4 text-[#5D7A5D]" />
                      Storage
                    </h3>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                      {ingredient.storage.method && (
                        <p className="text-sm">
                          <span className="font-medium">How:</span> {ingredient.storage.method}
                        </p>
                      )}
                      {ingredient.storage.shelf_life && (
                        <p className="text-sm">
                          <span className="font-medium">Shelf life:</span> {ingredient.storage.shelf_life}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {/* Where to Buy */}
                {(ingredient.where_to_find || ingredient.what_to_look_for) && (
                  <section>
                    <h3 className="flex items-center gap-2 font-semibold text-base mb-3">
                      <Store className="w-4 h-4 text-[#5D7A5D]" />
                      Where to find it
                    </h3>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      {ingredient.where_to_find && (
                        <p className="text-sm">{ingredient.where_to_find}</p>
                      )}
                      {ingredient.what_to_look_for && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Tip:</span> {ingredient.what_to_look_for}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {/* Taste & Aroma */}
                {(ingredient.aroma || ingredient.taste) && (
                  <section className="pb-4">
                    <h3 className="font-semibold text-base mb-3">Taste & Aroma</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {ingredient.aroma && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Aroma</p>
                          <p className="text-sm">{ingredient.aroma}</p>
                        </div>
                      )}
                      {ingredient.taste && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Taste</p>
                          <p className="text-sm">{ingredient.taste}</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default IngredientInfoPopup;
