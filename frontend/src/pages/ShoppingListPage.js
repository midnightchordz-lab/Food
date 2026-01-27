import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Trash2, Plus, ShoppingCart, Download, Copy, CheckCircle2, 
  Package, ChevronDown, ChevronUp, X, Store
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useShoppingCart } from '@/context/ShoppingCartContext';

const ShoppingListPage = () => {
  const [newItem, setNewItem] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const { isAuthenticated } = useAuth();
  
  // Use the unified shopping cart context - THIS IS THE SINGLE SOURCE OF TRUTH
  const {
    cartItems,
    addToCart,
    removeFromCart,
    toggleItemChecked,
    clearCart,
    getItemsByCategory,
    copyToClipboard,
    downloadList,
    preferredPartner,
    setPreferredPartner,
    CATEGORY_LABELS,
    SHOPPING_PARTNERS,
  } = useShoppingCart();
  
  const organizedItems = getItemsByCategory();
  const checkedCount = cartItems.filter(item => item.checked).length;
  
  // Add custom item to shopping list
  const addCustomItem = () => {
    if (!newItem.trim()) return;
    
    const ingredient = {
      amount: newAmount.trim() || '1',
      item: newItem.trim()
    };
    
    addToCart(ingredient, 'Custom Item');
    setNewItem('');
    setNewAmount('');
  };
  
  // Toggle category expansion
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };
  
  // Check all items in a category
  const checkAllInCategory = (category) => {
    const categoryItems = organizedItems[category] || [];
    categoryItems.forEach(item => {
      if (!item.checked) {
        toggleItemChecked(item.id);
      }
    });
  };
  
  // Remove all items in a category
  const removeAllInCategory = (category) => {
    const categoryItems = organizedItems[category] || [];
    categoryItems.forEach(item => {
      removeFromCart(item.id);
    });
  };
  
  // Handle partner selection
  const handleSelectPartner = (partnerId) => {
    setPreferredPartner(partnerId);
    const partner = SHOPPING_PARTNERS.find(p => p.id === partnerId);
    copyToClipboard();
    toast.success(
      `Shopping list copied! Open ${partner.name} and paste your list.`,
      { duration: 5000 }
    );
    setShowPartnerModal(false);
  };
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="shopping-list-page">
        <div className="max-w-3xl mx-auto text-center py-20">
          <ShoppingCart className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-serif mb-2">Please log in to access your shopping list</h3>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="shopping-list-page">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-4xl sm:text-5xl font-serif mb-3" data-testid="page-title">
              Shopping List
            </h1>
            <p className="text-muted-foreground" data-testid="page-description">
              Keep track of ingredients you need for your mood-based meals.
            </p>
          </div>
          {cartItems.length > 0 && (
            <div className="flex gap-2">
              <Button
                onClick={clearCart}
                variant="outline"
                size="sm"
                className="rounded-full text-destructive hover:bg-destructive/10"
                data-testid="clear-all-button"
              >
                <Trash2 size={16} className="mr-1.5" />
                Clear All
              </Button>
              <Button
                onClick={() => setShowPartnerModal(true)}
                className="rounded-full"
                data-testid="order-now-button"
              >
                <Store size={16} className="mr-1.5" />
                Order Now
              </Button>
            </div>
          )}
        </div>
        
        {/* Add Item Form */}
        <div className="flex gap-2 mb-8" data-testid="add-item-form">
          <Input
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="Qty"
            className="w-20 rounded-xl bg-card border-border/60"
            data-testid="new-amount-input"
          />
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomItem()}
            placeholder="Add an ingredient..."
            className="flex-1 rounded-xl bg-card border-border/60"
            data-testid="new-item-input"
          />
          <Button
            onClick={addCustomItem}
            className="rounded-full px-4 bg-primary hover:bg-primary/90 active:scale-95 transition-all"
            data-testid="add-item-button"
          >
            <Plus size={20} />
          </Button>
        </div>
        
        {/* Shopping List */}
        {cartItems.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-border/40" data-testid="empty-state">
            <Package className="mx-auto mb-4 text-muted-foreground/40" size={64} />
            <h3 className="text-xl font-serif mb-2">Your list is empty</h3>
            <p className="text-muted-foreground mb-6">Add ingredients from recipes to start shopping!</p>
            <Button variant="outline" onClick={() => window.location.href = '/chat'}>
              Browse Recipes
            </Button>
          </div>
        ) : (
          <div className="space-y-4" data-testid="shopping-list-container">
            {/* Category Sections */}
            {Object.entries(organizedItems).map(([category, items]) => (
              <div 
                key={category} 
                className="bg-card rounded-2xl border border-border/40 overflow-hidden"
                data-testid={`category-${category}`}
              >
                {/* Category Header */}
                <div 
                  className="flex items-center justify-between p-4 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => toggleCategory(category)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{CATEGORY_LABELS[category]?.split(' ')[0] || '📦'}</span>
                    <h3 className="font-semibold uppercase tracking-wide text-sm">
                      {CATEGORY_LABELS[category]?.split(' ').slice(1).join(' ') || category}
                    </h3>
                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        checkAllInCategory(category);
                      }}
                      className="text-xs h-7 px-2"
                    >
                      Check All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAllInCategory(category);
                      }}
                      className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                    >
                      Remove All
                    </Button>
                    {expandedCategories[category] === false ? (
                      <ChevronDown size={20} className="text-muted-foreground" />
                    ) : (
                      <ChevronUp size={20} className="text-muted-foreground" />
                    )}
                  </div>
                </div>
                
                {/* Category Items */}
                {expandedCategories[category] !== false && (
                  <div className="p-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
                          item.checked 
                            ? 'bg-green-50/50 dark:bg-green-950/20' 
                            : 'hover:bg-secondary/30'
                        }`}
                        data-testid={`shopping-item-${item.id}`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleItemChecked(item.id)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            item.checked 
                              ? 'bg-green-500 border-green-500 text-white' 
                              : 'border-gray-300 hover:border-primary'
                          }`}
                          data-testid={`checkbox-${item.id}`}
                        >
                          {item.checked && <CheckCircle2 size={14} />}
                        </button>
                        
                        {/* Item Details - ONLY show clean ingredient name */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${item.checked ? 'line-through text-muted-foreground' : ''}`}>
                            {item.item}
                          </p>
                          {item.recipes && item.recipes.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              From: {item.recipes.join(', ')}
                            </p>
                          )}
                        </div>
                        
                        {/* Delete Button */}
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-all"
                          data-testid={`delete-${item.id}`}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {/* Summary Footer */}
            <div className="bg-card rounded-2xl border border-border/40 p-6">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Items:</span>
                    <span className="font-semibold ml-2">{cartItems.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Checked Off:</span>
                    <span className="font-semibold ml-2 text-green-600">{checkedCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Remaining:</span>
                    <span className="font-semibold ml-2">{cartItems.length - checkedCount}</span>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button 
                  variant="outline" 
                  onClick={copyToClipboard}
                  className="flex-1 sm:flex-none rounded-full"
                  data-testid="copy-list-button"
                >
                  <Copy size={16} className="mr-2" />
                  Copy List
                </Button>
                <Button 
                  variant="outline" 
                  onClick={downloadList}
                  className="flex-1 sm:flex-none rounded-full"
                  data-testid="download-button"
                >
                  <Download size={16} className="mr-2" />
                  Download
                </Button>
                <Button 
                  onClick={() => setShowPartnerModal(true)}
                  className="flex-1 sm:flex-none rounded-full"
                  data-testid="order-button"
                >
                  <Store size={16} className="mr-2" />
                  Order Now
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Shopping Partner Selection Modal */}
      {showPartnerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-serif flex items-center gap-2">
                <Store className="text-primary" />
                Choose Your Shopping Partner
              </h2>
              <button 
                onClick={() => setShowPartnerModal(false)}
                className="p-2 hover:bg-secondary rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6">
              Select your preferred grocery delivery service. Your shopping list will be copied to clipboard for easy ordering.
            </p>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              {SHOPPING_PARTNERS.map((partner) => (
                <button
                  key={partner.id}
                  onClick={() => handleSelectPartner(partner.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] hover:shadow-md ${
                    preferredPartner === partner.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  data-testid={`partner-${partner.id}`}
                >
                  <span className="text-2xl mb-2 block">{partner.logo}</span>
                  <span className="font-medium block">{partner.name}</span>
                  {preferredPartner === partner.id && (
                    <span className="text-xs text-primary">✓ Preferred</span>
                  )}
                </button>
              ))}
            </div>
            
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm text-blue-700 dark:text-blue-300">
              💡 <strong>Tip:</strong> After selecting a partner, your list will be copied. 
              Open their app or website and paste your shopping list!
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShoppingListPage;
