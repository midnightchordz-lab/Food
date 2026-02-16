import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { X, Download, Smartphone, Monitor } from 'lucide-react';

const PWAInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;
    setIsStandalone(standalone);
    
    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);
    
    // Check if mobile
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(mobile);
    
    // Don't show if already installed
    if (standalone) return;
    
    // Check if dismissed recently (within 7 days)
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return;
    }
    
    // Listen for install availability on Android/Chrome
    const handleInstallAvailable = (e) => {
      setCanInstall(true);
      setShowPrompt(true);
    };
    
    window.addEventListener('pwaInstallAvailable', handleInstallAvailable);
    
    // Check if deferredPrompt is already available (in case event fired before component mounted)
    if (window.deferredPrompt) {
      setCanInstall(true);
      setShowPrompt(true);
    } else {
      // Show prompt after a delay for iOS or as fallback
      const timer = setTimeout(() => {
        // Only show if iOS (which doesn't support beforeinstallprompt) or if install is available
        if (iOS || window.deferredPrompt) {
          setShowPrompt(true);
          if (window.deferredPrompt) {
            setCanInstall(true);
          }
        }
      }, 5000);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('pwaInstallAvailable', handleInstallAvailable);
      };
    }
    
    return () => {
      window.removeEventListener('pwaInstallAvailable', handleInstallAvailable);
    };
  }, []);

  // Auto-dismiss on chat page after 10 seconds to avoid blocking interactions
  useEffect(() => {
    if (showPrompt && location.pathname === '/chat') {
      const autoDismissTimer = setTimeout(() => {
        setShowPrompt(false);
      }, 10000);
      
      return () => clearTimeout(autoDismissTimer);
    }
  }, [showPrompt, location.pathname]);

  const handleInstall = async () => {
    if (window.installPWA && canInstall) {
      await window.installPWA();
      setShowPrompt(false);
    } else {
      // Fallback: Show browser-specific instructions
      alert('To install this app:\n\n• Chrome: Click the install icon in the address bar (⊕)\n• Edge: Click "..." menu → "Apps" → "Install this site as an app"\n• Firefox: Add to Home Screen from menu');
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-40 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 relative">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>
        
        {/* Content */}
        <div className="flex gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
            {isMobile ? (
              <Smartphone className="text-primary" size={24} />
            ) : (
              <Monitor className="text-primary" size={24} />
            )}
          </div>
          
          <div className="flex-1 pr-4">
            <h3 className="font-serif font-bold text-base sm:text-lg mb-1">
              Install MOOD FOOD
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3">
              {isMobile 
                ? "Add to your home screen for quick access and offline support."
                : "Install as a desktop app for quick access and better experience."}
            </p>
            
            {isIOS ? (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 sm:p-3">
                <p className="font-medium mb-1">To install on iOS:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Tap the Share button ⬆️</li>
                  <li>Tap "Add to Home Screen"</li>
                </ol>
              </div>
            ) : (
              <Button 
                onClick={handleInstall}
                className="w-full gap-2 h-9 text-sm"
                data-testid="pwa-install-button"
              >
                <Download size={16} />
                Install App
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
