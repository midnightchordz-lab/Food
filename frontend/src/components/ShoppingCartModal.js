import { useState } from 'react';
import { 
  ShoppingCart, X, Trash2, Plus, Minus, Check, Copy, Download, 
  Mail, ExternalLink, ChevronRight, Package, Store
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useShoppingCart } from '@/context/ShoppingCartContext';
import { toast } from 'sonner';

const ShoppingCartModal = () => {
  const {
    cartItems,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    toggleItemChecked,
    clearCart,
    saveToGroceryList,
    getItemsByCategory,
    copyToClipboard,
    downloadList,
    preferredPartner,
    setPreferredPartner,
    CATEGORY_LABELS,
    SHOPPING_PARTNERS,
  } = useShoppingCart();

  const [showPartnerSelection, setShowPartnerSelection] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const organizedItems = getItemsByCategory();
  const checkedCount = cartItems.filter(item => item.checked).length;

  const handleOrderNow = () => {
    if (cartItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    setShowPartnerSelection(true);
  };

  const handleSelectPartner = (partnerId) => {
    setPreferredPartner(partnerId);
    const partner = SHOPPING_PARTNERS.find(p => p.id === partnerId);
    
    // For now, just copy to clipboard and show instructions
    copyToClipboard();
    toast.success(
      `Shopping list copied! Open ${partner.name} and paste your list.`,
      { duration: 5000 }
    );
    setShowPartnerSelection(false);
  };

  const handleSaveToList = () => {
    if (cartItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    saveToGroceryList();
  };

  return (
    <>
      {/* Floating Cart Button */}
      <button
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
        data-testid="floating-cart-btn"
      >
        <ShoppingCart size={20} />
        {cartItems.length > 0 && (
          <span className="bg-white text-primary font-bold px-2 py-0.5 rounded-full text-sm">
            {cartItems.length}
          </span>
        )}
      </button>

      {/* Cart Modal */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-2xl">
                <ShoppingCart className="text-primary" />
                My Shopping Cart
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {cartItems.length} items
              </span>
            </DialogTitle>
          </DialogHeader>

          {cartItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <Package size={64} className="text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">Your cart is empty</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Add ingredients from recipes to start building your shopping list
              </p>
              <Button variant="outline" onClick={() => setIsCartOpen(false)}>
                Browse Recipes
              </Button>
            </div>
          ) : (
            <>
              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-6">
                {Object.entries(organizedItems).map(([category, items]) => (
                  <div key={category} className="mb-6">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      {CATEGORY_LABELS[category] || category}
                    </h3>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            item.checked ? 'bg-green-50/50 border-green-200' : 'bg-card hover:bg-secondary/30'
                          }`}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleItemChecked(item.id)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              item.checked 
                                ? 'bg-green-500 border-green-500 text-white' 
                                : 'border-gray-300 hover:border-primary'
                            }`}
                          >
                            {item.checked && <Check size={14} />}
                          </button>

                          {/* Item Details - ONLY show clean ingredient name */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${item.checked ? 'line-through text-muted-foreground' : ''}`}>
                              {item.item}
                            </p>
                            {item.recipes && item.recipes.length > 0 && (
                              <p className="text-xs text-muted-foreground truncate">
                                From: {item.recipes.join(', ')}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingItem(item.id === editingItem ? null : item.id)}
                              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                              title="Edit quantity"
                            >
                              <Plus size={16} />
                            </button>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"
                              title="Remove"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Cart Summary & Actions */}
              <div className="border-t p-6 bg-secondary/20">
                <div className="flex items-center justify-between mb-4 text-sm">
                  <span className="text-muted-foreground">
                    {checkedCount} of {cartItems.length} items checked
                  </span>
                  <button
                    onClick={clearCart}
                    className="text-red-500 hover:text-red-600 text-sm"
                  >
                    Clear All
                  </button>
                </div>

                {/* Export Options */}
                <div className="flex gap-2 mb-4">
                  <Button variant="outline" size="sm" onClick={copyToClipboard} className="flex-1">
                    <Copy size={14} className="mr-1" /> Copy List
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadList} className="flex-1">
                    <Download size={14} className="mr-1" /> Download
                  </Button>
                </div>

                {/* Main Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleSaveToList} className="flex-1">
                    💾 Save to Grocery List
                  </Button>
                  <Button onClick={handleOrderNow} className="flex-1">
                    🛍️ Order Now
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Partner Selection Modal */}
      <Dialog open={showPartnerSelection} onOpenChange={setShowPartnerSelection}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="text-primary" />
              Choose Your Shopping Partner
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground mb-4">
            Select your preferred grocery delivery service. Your shopping list will be copied to clipboard for easy ordering.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {SHOPPING_PARTNERS.map((partner) => (
              <button
                key={partner.id}
                onClick={() => handleSelectPartner(partner.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] hover:shadow-md ${
                  preferredPartner === partner.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="text-2xl mb-2 block">{partner.logo}</span>
                <span className="font-medium block">{partner.name}</span>
                {preferredPartner === partner.id && (
                  <span className="text-xs text-primary">✓ Preferred</span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            💡 <strong>Tip:</strong> After selecting a partner, your list will be copied. 
            Open their app or website and paste your shopping list!
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ShoppingCartModal;
