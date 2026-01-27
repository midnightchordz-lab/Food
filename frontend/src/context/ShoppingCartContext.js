import { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';

const ShoppingCartContext = createContext(null);

// Grocery categories for organization
const GROCERY_CATEGORIES = {
  produce: ['tomato', 'onion', 'garlic', 'ginger', 'pepper', 'basil', 'cilantro', 'lime', 'lemon', 'spinach', 'lettuce', 'cucumber', 'carrot', 'broccoli', 'mushroom', 'avocado', 'jalapeño', 'scallion', 'green onion', 'chili', 'bell pepper', 'zucchini', 'eggplant', 'potato', 'bean sprout', 'bok choy', 'kale', 'parsley', 'mint', 'thyme', 'rosemary', 'pineapple', 'mango'],
  dairy: ['milk', 'cream', 'cheese', 'mozzarella', 'parmesan', 'butter', 'yogurt', 'sour cream', 'egg', 'paneer', 'feta', 'ricotta', 'pecorino', 'mascarpone'],
  meat: ['chicken', 'beef', 'pork', 'lamb', 'bacon', 'sausage', 'ground', 'steak', 'thigh', 'breast', 'guanciale', 'pancetta', 'prosciutto'],
  seafood: ['fish', 'shrimp', 'salmon', 'tuna', 'cod', 'tilapia', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'anchovy'],
  pantry: ['rice', 'pasta', 'quinoa', 'flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'soy sauce', 'fish sauce', 'honey', 'maple', 'stock', 'broth', 'can', 'tomato paste', 'coconut milk', 'beans', 'lentils', 'chickpea', 'noodle', 'bread', 'tortilla', 'peanut', 'sesame', 'cornstarch', 'baking', 'yeast', 'oat'],
  spices: ['cumin', 'coriander', 'turmeric', 'paprika', 'cayenne', 'oregano', 'thyme', 'basil', 'cinnamon', 'nutmeg', 'clove', 'cardamom', 'curry', 'garam masala', 'chili powder', 'red pepper flake', 'black pepper', 'white pepper', 'bay leaf', 'star anise', 'fennel seed'],
  condiments: ['ketchup', 'mustard', 'mayonnaise', 'sriracha', 'hot sauce', 'worcestershire', 'tahini', 'miso', 'gochujang', 'sambal', 'hoisin', 'oyster sauce', 'teriyaki', 'tamarind'],
};

// Categorize an ingredient
const categorizeIngredient = (ingredient) => {
  const lower = ingredient.toLowerCase();
  
  for (const [category, keywords] of Object.entries(GROCERY_CATEGORIES)) {
    if (keywords.some(keyword => lower.includes(keyword))) {
      return category;
    }
  }
  return 'other';
};

// Category display names
const CATEGORY_LABELS = {
  produce: '🥬 Produce',
  dairy: '🥛 Dairy & Eggs',
  meat: '🥩 Meat & Poultry',
  seafood: '🦐 Seafood',
  pantry: '🥫 Pantry',
  spices: '🧂 Spices & Seasonings',
  condiments: '🫙 Condiments & Sauces',
  other: '📦 Other',
};

// Shopping partners
const SHOPPING_PARTNERS = [
  { id: 'amazon', name: 'Amazon Fresh', logo: '🛒', color: 'bg-orange-500' },
  { id: 'instacart', name: 'Instacart', logo: '🥕', color: 'bg-green-500' },
  { id: 'walmart', name: 'Walmart Grocery', logo: '🏪', color: 'bg-blue-500' },
  { id: 'target', name: 'Target (Shipt)', logo: '🎯', color: 'bg-red-500' },
  { id: 'wholeFoods', name: 'Whole Foods', logo: '🌿', color: 'bg-emerald-600' },
  { id: 'kroger', name: 'Kroger', logo: '🛍️', color: 'bg-blue-600' },
  { id: 'safeway', name: 'Safeway', logo: '🏬', color: 'bg-red-600' },
  { id: 'other', name: 'Other Store', logo: '📋', color: 'bg-gray-500' },
];

export const ShoppingCartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [groceryList, setGroceryList] = useState([]);
  const [preferredPartner, setPreferredPartner] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('shoppingCart');
    const savedList = localStorage.getItem('groceryList');
    const savedPartner = localStorage.getItem('preferredPartner');
    
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (e) {
        console.error('Error parsing shoppingCart from localStorage:', e);
      }
    }
    if (savedList) {
      try {
        setGroceryList(JSON.parse(savedList));
      } catch (e) {
        console.error('Error parsing groceryList from localStorage:', e);
      }
    }
    if (savedPartner) setPreferredPartner(savedPartner);
    
    // Mark as initialized after loading
    setIsInitialized(true);
  }, []);

  // Save to localStorage on changes - only after initial load is complete
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('shoppingCart', JSON.stringify(cartItems));
    }
  }, [cartItems, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('groceryList', JSON.stringify(groceryList));
    }
  }, [groceryList, isInitialized]);

  useEffect(() => {
    if (preferredPartner && isInitialized) {
      localStorage.setItem('preferredPartner', preferredPartner);
    }
  }, [preferredPartner, isInitialized]);

  // Add single ingredient to cart
  const addToCart = (ingredient, recipeName) => {
    const existingIndex = cartItems.findIndex(
      item => item.item.toLowerCase() === ingredient.item.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Update existing item
      const updated = [...cartItems];
      if (!updated[existingIndex].recipes.includes(recipeName)) {
        updated[existingIndex].recipes.push(recipeName);
      }
      setCartItems(updated);
      toast.success(`Updated ${ingredient.item} in cart`);
    } else {
      // Add new item
      const newItem = {
        id: Date.now(),
        ...ingredient,
        category: categorizeIngredient(ingredient.item),
        recipes: [recipeName],
        checked: false,
        addedAt: new Date().toISOString(),
      };
      setCartItems(prev => [...prev, newItem]);
      toast.success(`Added ${ingredient.item} to cart`);
    }
  };

  // Add multiple ingredients to cart
  const addAllToCart = (ingredients, recipeName) => {
    const newItems = [];
    const updatedCart = [...cartItems];

    ingredients.forEach(ing => {
      const existingIndex = updatedCart.findIndex(
        item => item.item.toLowerCase() === ing.item.toLowerCase()
      );

      if (existingIndex >= 0) {
        if (!updatedCart[existingIndex].recipes.includes(recipeName)) {
          updatedCart[existingIndex].recipes.push(recipeName);
        }
      } else {
        newItems.push({
          id: Date.now() + Math.random(),
          ...ing,
          category: categorizeIngredient(ing.item),
          recipes: [recipeName],
          checked: false,
          addedAt: new Date().toISOString(),
        });
      }
    });

    setCartItems([...updatedCart, ...newItems]);
    toast.success(`Added ${ingredients.length} ingredients to cart`);
  };

  // Remove item from cart
  const removeFromCart = (itemId) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
    toast.success('Item removed from cart');
  };

  // Update item quantity
  const updateQuantity = (itemId, newAmount) => {
    setCartItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, amount: newAmount } : item
    ));
  };

  // Toggle item checked state
  const toggleItemChecked = (itemId) => {
    setCartItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    ));
  };

  // Clear entire cart
  const clearCart = () => {
    setCartItems([]);
    toast.success('Cart cleared');
  };

  // Save cart to grocery list
  const saveToGroceryList = () => {
    const timestamp = new Date().toISOString();
    const listName = `Shopping List - ${new Date().toLocaleDateString()}`;
    
    const newList = {
      id: Date.now(),
      name: listName,
      items: cartItems.map(item => ({ ...item, purchased: false })),
      createdAt: timestamp,
      totalItems: cartItems.length,
    };

    setGroceryList(prev => [newList, ...prev]);
    toast.success('Saved to grocery list!');
    return newList;
  };

  // Get items organized by category
  const getItemsByCategory = () => {
    const organized = {};
    
    cartItems.forEach(item => {
      const cat = item.category || 'other';
      if (!organized[cat]) {
        organized[cat] = [];
      }
      organized[cat].push(item);
    });

    return organized;
  };

  // Export cart as text
  const exportAsText = () => {
    const organized = getItemsByCategory();
    let text = `🛒 Shopping List\n`;
    text += `Generated: ${new Date().toLocaleString()}\n\n`;

    Object.entries(organized).forEach(([category, items]) => {
      text += `${CATEGORY_LABELS[category] || category.toUpperCase()}\n`;
      items.forEach(item => {
        text += `  ☐ ${item.amount} ${item.item}\n`;
      });
      text += '\n';
    });

    return text;
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    const text = exportAsText();
    await navigator.clipboard.writeText(text);
    toast.success('Shopping list copied to clipboard!');
  };

  // Download as file
  const downloadList = () => {
    const text = exportAsText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopping-list-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Shopping list downloaded!');
  };

  // Check if ingredient is in cart
  const isInCart = (ingredientItem) => {
    return cartItems.some(item => 
      item.item.toLowerCase() === ingredientItem.toLowerCase()
    );
  };

  const value = {
    cartItems,
    groceryList,
    preferredPartner,
    isCartOpen,
    setIsCartOpen,
    addToCart,
    addAllToCart,
    removeFromCart,
    updateQuantity,
    toggleItemChecked,
    clearCart,
    saveToGroceryList,
    setPreferredPartner,
    getItemsByCategory,
    exportAsText,
    copyToClipboard,
    downloadList,
    isInCart,
    cartCount: cartItems.length,
    CATEGORY_LABELS,
    SHOPPING_PARTNERS,
  };

  return (
    <ShoppingCartContext.Provider value={value}>
      {children}
    </ShoppingCartContext.Provider>
  );
};

export const useShoppingCart = () => {
  const context = useContext(ShoppingCartContext);
  if (!context) {
    throw new Error('useShoppingCart must be used within ShoppingCartProvider');
  }
  return context;
};

export default ShoppingCartContext;
