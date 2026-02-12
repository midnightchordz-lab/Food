import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ShoppingCartProvider } from "@/context/ShoppingCartContext";
import { SubscriptionProvider } from "@/components/FeatureGate";
import { UsageLimitProvider } from "@/hooks/useUsageLimit";
import UpgradeModal from "@/components/UpgradeModal";
import { Suspense, lazy, useEffect } from "react";
import Navigation from "@/components/Navigation";
import ShoppingCartModal from "@/components/ShoppingCartModal";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import LiveCookingModal from "@/components/live-cooking/LiveCookingModal";
import { initializeCapacitor, isNative } from "@/capacitor";
import "@/App.css";

// Lazy load pages for code splitting - only load when needed
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const SavedRecipes = lazy(() => import("@/pages/SavedRecipes"));
const ShoppingListPage = lazy(() => import("@/pages/ShoppingListPage"));
const WeeklyPlannerPage = lazy(() => import("@/pages/WeeklyPlannerPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const ExploreCuisinesPage = lazy(() => import("@/pages/ExploreCuisinesPage"));
const CuisineRecipesPage = lazy(() => import("@/pages/CuisineRecipesPage"));
const DiscoverRecipesPage = lazy(() => import("@/pages/DiscoverRecipesPage"));
const DiabetesMealsPage = lazy(() => import("@/pages/DiabetesMealsPage"));
const DiabetesWeeklyPlannerPage = lazy(() => import("@/pages/DiabetesWeeklyPlannerPage"));
const ImportRecipePage = lazy(() => import("@/pages/ImportRecipePage"));
const PricingPage = lazy(() => import("@/pages/PricingPage"));
const SubscriptionManagementPage = lazy(() => import("@/pages/SubscriptionManagementPage"));
const CheckoutSuccessPage = lazy(() => import("@/pages/CheckoutSuccessPage"));
const CheckoutFailurePage = lazy(() => import("@/pages/CheckoutFailurePage"));
const FridgeScannerPage = lazy(() => import("@/pages/FridgeScannerPage"));

// Loading spinner component for Suspense fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  </div>
);

function App() {
  // Initialize Capacitor for native mobile app
  useEffect(() => {
    initializeCapacitor();
  }, []);

  // Auto-detect user's preferred language
  useEffect(() => {
    const detectLanguage = () => {
      const browserLang = navigator.language || navigator.userLanguage;
      const langCode = browserLang.split('-')[0];
      
      const languageMap = {
        'en': 'en', 'hi': 'hi', 'zh': 'zh', 'es': 'es', 'fr': 'fr',
        'ja': 'ja', 'ko': 'ko', 'th': 'th', 'ar': 'ar', 'it': 'it',
        'pt': 'pt', 'vi': 'vi',
      };
      
      const detectedLang = languageMap[langCode] || 'en';
      
      if (!localStorage.getItem('preferredLanguage')) {
        localStorage.setItem('preferredLanguage', detectedLang);
      }
    };
    
    detectLanguage();
  }, []);

  return (
    <AuthProvider>
      <UsageLimitProvider>
        <SubscriptionProvider>
          <ShoppingCartProvider>
            <div className="App min-h-screen">
              <BrowserRouter>
                <Navigation />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/diabetes-meals" element={<DiabetesMealsPage />} />
                    <Route path="/diabetes-planner" element={<DiabetesWeeklyPlannerPage />} />
                    <Route path="/import-recipe" element={<ImportRecipePage />} />
                    <Route path="/saved-recipes" element={<SavedRecipes />} />
                    <Route path="/shopping-list" element={<ShoppingListPage />} />
                    <Route path="/weekly-planner" element={<WeeklyPlannerPage />} />
                    <Route path="/planner" element={<WeeklyPlannerPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/explore-cuisines" element={<ExploreCuisinesPage />} />
                    <Route path="/recipes/cuisine/:cuisine" element={<CuisineRecipesPage />} />
                    <Route path="/discover-recipes" element={<DiscoverRecipesPage />} />
                    <Route path="/discover-recipes/:cuisine" element={<DiscoverRecipesPage />} />
                    <Route path="/pricing" element={<PricingPage />} />
                    <Route path="/subscription" element={<SubscriptionManagementPage />} />
                    <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
                    <Route path="/checkout/failure" element={<CheckoutFailurePage />} />
                    <Route path="/fridge-scanner" element={<FridgeScannerPage />} />
                  </Routes>
                </Suspense>
                <ShoppingCartModal />
                <UpgradeModal />
                {!isNative && <PWAInstallPrompt />}
              </BrowserRouter>
            <Toaster />
          </div>
          </ShoppingCartProvider>
        </SubscriptionProvider>
      </UsageLimitProvider>
    </AuthProvider>
  );
}

export default App;
