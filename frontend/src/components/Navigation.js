import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, Heart, ShoppingCart, Calendar } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';
  
  if (isHome) return null;
  
  const navItems = [
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/saved-recipes', icon: Heart, label: 'Saved' },
    { path: '/shopping-list', icon: ShoppingCart, label: 'List' },
    { path: '/weekly-planner', icon: Calendar, label: 'Planner' },
  ];
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="text-2xl font-serif font-semibold text-primary" data-testid="nav-logo">
            Chef Feels
          </Link>
          
          <div className="flex gap-2">
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
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;