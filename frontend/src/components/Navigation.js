import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, Heart, ShoppingCart, Calendar, User, LogOut, Home, Activity, Import, CalendarDays, Search, CreditCard, Settings, Menu, X, Scan } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AuthModal from './AuthModal';
import SearchHub from './SearchHub';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Navigation = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const { user, isAuthenticated, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSearchHub, setShowSearchHub] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  if (isHome) return null;
  
  // Main navigation items for bottom bar on mobile
  const mainNavItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/weekly-planner', icon: Calendar, label: 'Planner' },
    { path: '/pricing', icon: CreditCard, label: 'Pricing' },
  ];
  
  // Additional items shown in "More" menu on mobile
  const moreNavItems = [
    { path: '/fridge-scanner', icon: Scan, label: 'Fridge Scanner' },
    { path: '/diabetes-meals', icon: Activity, label: 'Diabetes Meals' },
    { path: '/diabetes-planner', icon: CalendarDays, label: 'Diabetes Planner' },
    { path: '/import-recipe', icon: Import, label: 'Import Recipe' },
    { path: '/saved-recipes', icon: Heart, label: 'Saved Recipes' },
    { path: '/profile', icon: User, label: 'Profile' },
    { path: '/subscription', icon: CreditCard, label: 'Subscription' },
  ];
  
  // All items for desktop
  const desktopNavItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/diabetes-meals', icon: Activity, label: 'Diabetes' },
    { path: '/diabetes-planner', icon: CalendarDays, label: 'DPlan' },
    { path: '/import-recipe', icon: Import, label: 'Import' },
    { path: '/weekly-planner', icon: Calendar, label: 'Planner' },
    { path: '/pricing', icon: CreditCard, label: 'Pricing' },
  ];
  
  return (
    <>
      {/* Desktop Top Navigation */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-serif font-bold tracking-wide text-primary" data-testid="nav-logo">
              MOOD FOOD
            </Link>
            
            <div className="flex items-center gap-2">
              {desktopNavItems.map((item) => {
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
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              
              {/* Search Hub Button */}
              {isAuthenticated && (
                <button
                  onClick={() => setShowSearchHub(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 bg-secondary/50 hover:bg-secondary text-foreground"
                  data-testid="search-hub-button"
                >
                  <Search size={18} />
                  <span>Search</span>
                </button>
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
                      <span>{user?.name}</span>
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
                    <DropdownMenuItem asChild>
                      <Link to="/subscription" className="cursor-pointer" data-testid="subscription-link">
                        <CreditCard size={16} className="mr-2" />
                        Subscription
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
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
      
      {/* Mobile Top Header - Minimal */}
      <nav className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex justify-between items-center h-14 px-4">
          <Link to="/" className="text-xl font-serif font-bold tracking-wide text-primary" data-testid="nav-logo-mobile">
            MOOD FOOD
          </Link>
          
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={() => setShowSearchHub(true)}
                className="p-2 rounded-full bg-secondary/50"
                data-testid="search-hub-button-mobile"
              >
                <Search size={20} />
              </button>
            )}
            
            {isAuthenticated ? (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-full bg-secondary/50"
                data-testid="mobile-menu-button"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            ) : (
              <Button
                onClick={() => setShowAuthModal(true)}
                size="sm"
                className="rounded-full bg-primary hover:bg-primary/90"
                data-testid="login-button-mobile"
              >
                Log In
              </Button>
            )}
          </div>
        </div>
        
        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && isAuthenticated && (
          <div className="absolute top-14 left-0 right-0 bg-background border-b border-border shadow-lg p-4 space-y-2">
            {moreNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/30 hover:bg-secondary/50'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={() => {
                logout();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left bg-red-50 text-red-600 hover:bg-red-100"
            >
              <LogOut size={20} />
              <span className="font-medium">Log Out</span>
            </button>
          </div>
        )}
      </nav>
      
      {/* Mobile Bottom Tab Bar - Always visible with labels */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border safe-area-bottom">
        <div className="flex justify-around items-center h-16 px-2">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path === '/weekly-planner' && location.pathname === '/planner');
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-mobile-${item.label.toLowerCase()}`}
                className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all min-w-[60px] ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-primary' : ''}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          
          {/* More button for additional options */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="nav-mobile-more"
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all min-w-[60px] ${
              mobileMenuOpen
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Menu size={22} strokeWidth={mobileMenuOpen ? 2.5 : 2} />
            <span className={`text-[10px] mt-1 font-medium ${mobileMenuOpen ? 'text-primary' : ''}`}>
              More
            </span>
          </button>
        </div>
      </nav>
      
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <SearchHub isOpen={showSearchHub} onClose={() => setShowSearchHub(false)} />
    </>
  );
};

export default Navigation;