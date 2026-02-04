import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, Heart, ShoppingCart, Calendar, User, LogOut, Home, Activity, Import, CalendarDays, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AuthModal from './AuthModal';
import SearchHub from './SearchHub';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Navigation = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const { user, isAuthenticated, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSearchHub, setShowSearchHub] = useState(false);
  
  if (isHome) return null;
  
  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/diabetes-meals', icon: Activity, label: 'Diabetes' },
    { path: '/diabetes-planner', icon: CalendarDays, label: 'D-Planner' },
    { path: '/import-recipe', icon: Import, label: 'Import' },
    { path: '/weekly-planner', icon: Calendar, label: 'Planner' },
  ];
  
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-serif font-bold tracking-wide text-primary" data-testid="nav-logo">
              MOOD FOOD
            </Link>
            
            <div className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    data-testid={`nav-${item.label.toLowerCase()}`}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary/50 hover:bg-secondary text-foreground'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
              
              {/* Search Hub Button */}
              {isAuthenticated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSearchHub(true)}
                  className="rounded-full px-3 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30 hover:border-blue-500/50"
                  data-testid="search-hub-button"
                >
                  <Search size={18} className="text-blue-500" />
                  <span className="hidden lg:inline ml-2">Search</span>
                </Button>
              )}
              
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="rounded-full px-4 py-2"
                      data-testid="user-menu-button"
                    >
                      <User size={18} className="mr-2" />
                      <span className="hidden sm:inline">{user?.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link to="/saved-recipes" className="cursor-pointer" data-testid="saved-recipes-link">
                        <Heart size={16} className="mr-2" />
                        Saved Recipes
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="cursor-pointer" data-testid="profile-link">
                        <User size={16} className="mr-2" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={logout} className="cursor-pointer" data-testid="logout-button">
                      <LogOut size={16} className="mr-2" />
                      Log Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  onClick={() => setShowAuthModal(true)}
                  className="rounded-full bg-primary hover:bg-primary/90"
                  data-testid="login-button"
                >
                  <User size={18} className="mr-2" />
                  Log In
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>
      
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
};

export default Navigation;