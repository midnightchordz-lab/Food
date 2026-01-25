import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, ShoppingCart, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ShoppingListPage = () => {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const { isAuthenticated } = useAuth();
  
  useEffect(() => {
    if (isAuthenticated) {
      loadShoppingList();
    }
  }, [isAuthenticated]);
  
  const loadShoppingList = async () => {
    try {
      const response = await axios.get(`${API}/shopping-list`);
      setItems(response.data.items || []);
    } catch (error) {
      console.error('Error loading shopping list:', error);
    }
  };
  
  const saveShoppingList = async (updatedItems) => {
    try {
      await axios.post(`${API}/shopping-list`, {
        items: updatedItems
      });
      toast.success('Shopping list updated!');
    } catch (error) {
      console.error('Error saving shopping list:', error);
      toast.error('Failed to save shopping list');
    }
  };
  
  const addItem = () => {
    if (!newItem.trim()) return;
    
    const updatedItems = [...items, { name: newItem, checked: false }];
    setItems(updatedItems);
    setNewItem('');
    saveShoppingList(updatedItems);
  };
  
  const toggleItem = (index) => {
    const updatedItems = items.map((item, idx) =>
      idx === index ? { ...item, checked: !item.checked } : item
    );
    setItems(updatedItems);
    saveShoppingList(updatedItems);
  };
  
  const deleteItem = (index) => {
    const updatedItems = items.filter((_, idx) => idx !== index);
    setItems(updatedItems);
    saveShoppingList(updatedItems);
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
        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-serif mb-3" data-testid="page-title">
            Shopping List
          </h1>
          <p className="text-muted-foreground" data-testid="page-description">
            Keep track of ingredients you need for your mood-based meals.
          </p>
        </div>
        
        {/* Add Item Form */}
        <div className="flex gap-3 mb-8" data-testid="add-item-form">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addItem()}
            placeholder="Add an ingredient..."
            className="flex-1 rounded-2xl bg-card border-border/60"
            data-testid="new-item-input"
          />
          <Button
            onClick={addItem}
            className="rounded-full px-6 bg-primary hover:bg-primary/90 active:scale-95 transition-all"
            data-testid="add-item-button"
          >
            <Plus size={20} />
          </Button>
        </div>
        
        {/* Shopping List */}
        {items.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-border/40" data-testid="empty-state">
            <ShoppingCart className="mx-auto mb-4 text-muted-foreground" size={48} />
            <h3 className="text-xl font-serif mb-2">Your list is empty</h3>
            <p className="text-muted-foreground">Add ingredients to start shopping!</p>
          </div>
        ) : (
          <div className="bg-card rounded-3xl border border-border/40 p-6" data-testid="shopping-list-container">
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-4 rounded-xl hover:bg-secondary/50 transition-colors group"
                  data-testid={`shopping-item-${idx}`}
                >
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={() => toggleItem(idx)}
                    data-testid={`checkbox-${idx}`}
                  />
                  <span
                    className={`flex-1 ${
                      item.checked ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {item.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteItem(idx)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`delete-button-${idx}`}
                  >
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total items:</span>
                <span className="font-medium">{items.length}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted-foreground">Checked off:</span>
                <span className="font-medium">{items.filter(i => i.checked).length}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShoppingListPage;