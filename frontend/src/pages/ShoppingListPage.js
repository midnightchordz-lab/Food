import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Trash2, Plus, ShoppingCart, Download, Copy, CheckCircle2, 
  Package, ChevronDown, ChevronUp, X, Store, Loader2, 
  ListPlus, MoreVertical, Edit2, FolderOpen, Check, ArrowLeft
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

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

const categorizeIngredient = (ingredient) => {
  if (!ingredient || typeof ingredient !== 'string') return 'other';
  const lower = ingredient.toLowerCase();
  for (const [category, keywords] of Object.entries(GROCERY_CATEGORIES)) {
    if (keywords.some(keyword => lower.includes(keyword))) {
      return category;
    }
  }
  return 'other';
};

const ShoppingListPage = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  // Lists state
  const [lists, setLists] = useState([]);
  const [activeList, setActiveList] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI state
  const [newItem, setNewItem] = useState('');
  const [newListName, setNewListName] = useState('');
  const [showNewListDialog, setShowNewListDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameListId, setRenameListId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [isCreating, setIsCreating] = useState(false);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });

  // Fetch all lists
  const fetchLists = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/shopping/lists`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setLists(response.data.lists || []);
        // Auto-select the most recent list if none selected
        if (!activeList && response.data.lists?.length > 0) {
          setActiveList(response.data.lists[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch lists:', error);
      toast.error('Failed to load shopping lists');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, activeList]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // Create new list
  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast.error('Please enter a list name');
      return;
    }
    
    setIsCreating(true);
    try {
      const response = await axios.post(`${API}/shopping/lists`, {
        name: newListName.trim(),
        ingredients: []
      }, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setLists(prev => [response.data.list, ...prev]);
        setActiveList(response.data.list);
        setNewListName('');
        setShowNewListDialog(false);
        toast.success(`Created "${response.data.list.name}"`);
      }
    } catch (error) {
      console.error('Failed to create list:', error);
      toast.error('Failed to create list');
    } finally {
      setIsCreating(false);
    }
  };

  // Delete list
  const handleDeleteList = async (listId) => {
    try {
      await axios.delete(`${API}/shopping/lists/${listId}`, {
        headers: getAuthHeaders()
      });
      
      setLists(prev => prev.filter(l => l.list_id !== listId));
      if (activeList?.list_id === listId) {
        setActiveList(lists.find(l => l.list_id !== listId) || null);
      }
      toast.success('List deleted');
    } catch (error) {
      console.error('Failed to delete list:', error);
      toast.error('Failed to delete list');
    }
  };

  // Clear list
  const handleClearList = async (listId) => {
    try {
      await axios.post(`${API}/shopping/lists/${listId}/clear`, {}, {
        headers: getAuthHeaders()
      });
      
      setLists(prev => prev.map(l => 
        l.list_id === listId ? { ...l, items: [] } : l
      ));
      if (activeList?.list_id === listId) {
        setActiveList(prev => ({ ...prev, items: [] }));
      }
      toast.success('List cleared');
    } catch (error) {
      console.error('Failed to clear list:', error);
      toast.error('Failed to clear list');
    }
  };

  // Rename list
  const handleRenameList = async () => {
    if (!renameValue.trim() || !renameListId) return;
    
    try {
      await axios.put(`${API}/shopping/lists/${renameListId}`, {
        name: renameValue.trim()
      }, {
        headers: getAuthHeaders()
      });
      
      setLists(prev => prev.map(l => 
        l.list_id === renameListId ? { ...l, name: renameValue.trim() } : l
      ));
      if (activeList?.list_id === renameListId) {
        setActiveList(prev => ({ ...prev, name: renameValue.trim() }));
      }
      setShowRenameDialog(false);
      setRenameListId(null);
      setRenameValue('');
      toast.success('List renamed');
    } catch (error) {
      console.error('Failed to rename list:', error);
      toast.error('Failed to rename list');
    }
  };

  // Add item to active list
  const handleAddItem = async () => {
    if (!newItem.trim() || !activeList) return;
    
    try {
      await axios.post(`${API}/shopping/lists/${activeList.list_id}/items`, {
        ingredients: [{ name: newItem.trim(), amount: '', unit: '' }]
      }, {
        headers: getAuthHeaders()
      });
      
      const newItemObj = {
        name: newItem.trim(),
        amount: '',
        unit: '',
        checked: false,
        added_at: new Date().toISOString()
      };
      
      setActiveList(prev => ({
        ...prev,
        items: [...(prev.items || []), newItemObj]
      }));
      
      setLists(prev => prev.map(l => 
        l.list_id === activeList.list_id 
          ? { ...l, items: [...(l.items || []), newItemObj] }
          : l
      ));
      
      setNewItem('');
      toast.success(`Added "${newItemObj.name}"`);
    } catch (error) {
      console.error('Failed to add item:', error);
      toast.error('Failed to add item');
    }
  };

  // Remove item from list
  const handleRemoveItem = async (itemName) => {
    if (!activeList) return;
    
    try {
      await axios.delete(`${API}/shopping/lists/${activeList.list_id}/items/${encodeURIComponent(itemName)}`, {
        headers: getAuthHeaders()
      });
      
      const updatedItems = activeList.items.filter(i => i.name.toLowerCase() !== itemName.toLowerCase());
      
      setActiveList(prev => ({ ...prev, items: updatedItems }));
      setLists(prev => prev.map(l => 
        l.list_id === activeList.list_id ? { ...l, items: updatedItems } : l
      ));
      
      toast.success('Item removed');
    } catch (error) {
      console.error('Failed to remove item:', error);
      toast.error('Failed to remove item');
    }
  };

  // Toggle item checked
  const handleToggleItem = async (itemName, currentChecked) => {
    if (!activeList) return;
    
    try {
      await axios.patch(`${API}/shopping/lists/${activeList.list_id}/items/toggle`, {
        item_name: itemName,
        checked: !currentChecked
      }, {
        headers: getAuthHeaders()
      });
      
      const updatedItems = activeList.items.map(i => 
        i.name.toLowerCase() === itemName.toLowerCase() ? { ...i, checked: !currentChecked } : i
      );
      
      setActiveList(prev => ({ ...prev, items: updatedItems }));
      setLists(prev => prev.map(l => 
        l.list_id === activeList.list_id ? { ...l, items: updatedItems } : l
      ));
    } catch (error) {
      console.error('Failed to toggle item:', error);
    }
  };

  // Get items organized by category
  const getItemsByCategory = () => {
    if (!activeList?.items) return {};
    
    const organized = {};
    activeList.items.forEach(item => {
      const cat = categorizeIngredient(item.name);
      if (!organized[cat]) organized[cat] = [];
      organized[cat].push(item);
    });
    return organized;
  };

  // Toggle category expansion
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: prev[category] === false ? true : false
    }));
  };

  // Copy list to clipboard
  const copyToClipboard = async () => {
    if (!activeList?.items?.length) return;
    
    let text = `🛒 ${activeList.name}\n\n`;
    const organized = getItemsByCategory();
    
    Object.entries(organized).forEach(([category, items]) => {
      text += `${CATEGORY_LABELS[category] || category}\n`;
      items.forEach(item => {
        const checkbox = item.checked ? '☑' : '☐';
        text += `  ${checkbox} ${item.name}\n`;
      });
      text += '\n';
    });
    
    await navigator.clipboard.writeText(text);
    toast.success('List copied to clipboard!');
  };

  // Download list
  const downloadList = () => {
    if (!activeList?.items?.length) return;
    
    let text = `🛒 ${activeList.name}\n`;
    text += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    const organized = getItemsByCategory();
    Object.entries(organized).forEach(([category, items]) => {
      text += `${CATEGORY_LABELS[category] || category}\n`;
      items.forEach(item => {
        const checkbox = item.checked ? '☑' : '☐';
        text += `  ${checkbox} ${item.name}\n`;
      });
      text += '\n';
    });
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeList.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('List downloaded!');
  };

  const organizedItems = getItemsByCategory();
  const checkedCount = activeList?.items?.filter(i => i.checked).length || 0;
  const totalItems = activeList?.items?.length || 0;

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" data-testid="shopping-list-loading">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="shopping-list-page">
        <div className="max-w-3xl mx-auto text-center py-20">
          <ShoppingCart className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-serif mb-2">Please log in to access your shopping lists</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" data-testid="shopping-list-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif mb-2" data-testid="page-title">
              Shopping Lists
            </h1>
            <p className="text-muted-foreground text-sm">
              Create and manage multiple shopping lists for your recipes
            </p>
          </div>
          <Button
            onClick={() => setShowNewListDialog(true)}
            className="rounded-full"
            data-testid="new-list-button"
          >
            <ListPlus size={18} className="mr-2" />
            New List
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lists Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-card rounded-2xl border border-border/40 p-4">
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <FolderOpen size={18} className="text-primary" />
                  Your Lists
                </h2>
                
                {lists.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="mx-auto mb-2 opacity-40" size={32} />
                    <p className="text-sm">No lists yet</p>
                    <Button 
                      variant="link" 
                      size="sm" 
                      onClick={() => setShowNewListDialog(true)}
                    >
                      Create your first list
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="lists-sidebar">
                    {lists.map((list) => (
                      <div
                        key={list.list_id}
                        className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all ${
                          activeList?.list_id === list.list_id
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-secondary/50'
                        }`}
                        onClick={() => setActiveList(list)}
                        data-testid={`list-item-${list.list_id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{list.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {list.items?.length || 0} items
                          </p>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setRenameListId(list.list_id);
                              setRenameValue(list.name);
                              setShowRenameDialog(true);
                            }}>
                              <Edit2 size={14} className="mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleClearList(list.list_id);
                            }}>
                              <Trash2 size={14} className="mr-2" />
                              Clear Items
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteList(list.list_id);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <X size={14} className="mr-2" />
                              Delete List
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Active List Content */}
            <div className="lg:col-span-2">
              {!activeList ? (
                <div className="bg-card rounded-2xl border border-border/40 p-8 text-center">
                  <ShoppingCart className="mx-auto mb-4 text-muted-foreground/40" size={48} />
                  <h3 className="font-serif text-lg mb-2">Select or create a list</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Choose a list from the sidebar or create a new one
                  </p>
                  <Button onClick={() => setShowNewListDialog(true)}>
                    <Plus size={18} className="mr-2" />
                    Create List
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Active List Header */}
                  <div className="bg-card rounded-2xl border border-border/40 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-serif">{activeList.name}</h2>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleClearList(activeList.list_id)}
                          disabled={totalItems === 0}
                          className="rounded-full"
                          data-testid="clear-list-button"
                        >
                          <Trash2 size={14} className="mr-1" />
                          Clear
                        </Button>
                      </div>
                    </div>
                    
                    {/* Add Item Form */}
                    <div className="flex gap-2" data-testid="add-item-form">
                      <Input
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
                        placeholder="Add an ingredient..."
                        className="flex-1 rounded-xl"
                        data-testid="new-item-input"
                      />
                      <Button
                        onClick={handleAddItem}
                        className="rounded-full px-4"
                        disabled={!newItem.trim()}
                        data-testid="add-item-button"
                      >
                        <Plus size={20} />
                      </Button>
                    </div>
                  </div>

                  {/* Items List */}
                  {totalItems === 0 ? (
                    <div className="bg-card rounded-2xl border border-border/40 p-8 text-center">
                      <Package className="mx-auto mb-4 text-muted-foreground/40" size={48} />
                      <h3 className="font-serif mb-2">This list is empty</h3>
                      <p className="text-muted-foreground text-sm">
                        Add ingredients using the form above or from recipe pages
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Category Sections */}
                      <div className="space-y-3" data-testid="shopping-list-container">
                        {Object.entries(organizedItems).map(([category, items]) => (
                          <div 
                            key={category} 
                            className="bg-card rounded-2xl border border-border/40 overflow-hidden"
                            data-testid={`category-${category}`}
                          >
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
                                  {items.length}
                                </span>
                              </div>
                              {expandedCategories[category] === false ? (
                                <ChevronDown size={20} className="text-muted-foreground" />
                              ) : (
                                <ChevronUp size={20} className="text-muted-foreground" />
                              )}
                            </div>
                            
                            {expandedCategories[category] !== false && (
                              <div className="p-2">
                                {items.map((item, idx) => (
                                  <div
                                    key={`${item.name}-${idx}`}
                                    className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
                                      item.checked 
                                        ? 'bg-green-50/50 dark:bg-green-950/20' 
                                        : 'hover:bg-secondary/30'
                                    }`}
                                    data-testid={`shopping-item-${item.name}`}
                                  >
                                    <button
                                      onClick={() => handleToggleItem(item.name, item.checked)}
                                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                        item.checked 
                                          ? 'bg-green-500 border-green-500 text-white' 
                                          : 'border-gray-300 hover:border-primary'
                                      }`}
                                    >
                                      {item.checked && <Check size={14} />}
                                    </button>
                                    
                                    <div className="flex-1 min-w-0">
                                      <p className={`font-medium ${item.checked ? 'line-through text-muted-foreground' : ''}`}>
                                        {item.name}
                                      </p>
                                      {item.recipe_name && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          From: {item.recipe_name}
                                        </p>
                                      )}
                                    </div>
                                    
                                    <button
                                      onClick={() => handleRemoveItem(item.name)}
                                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-all"
                                    >
                                      <X size={18} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Summary Footer */}
                      <div className="bg-card rounded-2xl border border-border/40 p-6">
                        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                          <div className="flex gap-6 text-sm">
                            <div>
                              <span className="text-muted-foreground">Total:</span>
                              <span className="font-semibold ml-2">{totalItems}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Done:</span>
                              <span className="font-semibold ml-2 text-green-600">{checkedCount}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Remaining:</span>
                              <span className="font-semibold ml-2">{totalItems - checkedCount}</span>
                            </div>
                          </div>
                        </div>
                        
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
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New List Dialog */}
      <Dialog open={showNewListDialog} onOpenChange={setShowNewListDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListPlus size={20} className="text-primary" />
              Create New List
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateList()}
              placeholder="e.g., Weekly Groceries, Party Supplies..."
              className="rounded-xl"
              autoFocus
              data-testid="new-list-name-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewListDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateList} disabled={isCreating || !newListName.trim()}>
              {isCreating ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              Create List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename List Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 size={20} className="text-primary" />
              Rename List
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleRenameList()}
              placeholder="Enter new name..."
              className="rounded-xl"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameList} disabled={!renameValue.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShoppingListPage;
