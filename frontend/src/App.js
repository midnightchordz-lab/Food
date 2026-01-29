import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ShoppingCartProvider } from "@/context/ShoppingCartContext";
import LandingPage from "@/pages/LandingPage";
import ChatPage from "@/pages/ChatPage";
import SavedRecipes from "@/pages/SavedRecipes";
import ShoppingListPage from "@/pages/ShoppingListPage";
import WeeklyPlannerPage from "@/pages/WeeklyPlannerPage";
import ProfilePage from "@/pages/ProfilePage";
import ExploreCuisinesPage from "@/pages/ExploreCuisinesPage";
import CuisineRecipesPage from "@/pages/CuisineRecipesPage";
import DiscoverRecipesPage from "@/pages/DiscoverRecipesPage";
import DiabetesMealsPage from "@/pages/DiabetesMealsPage";
import DiabetesWeeklyPlannerPage from "@/pages/DiabetesWeeklyPlannerPage";
import ImportRecipePage from "@/pages/ImportRecipePage";
import Navigation from "@/components/Navigation";
import ShoppingCartModal from "@/components/ShoppingCartModal";
import "@/App.css";
import { useEffect } from "react";

function App() {
  // Auto-detect user's preferred language
  useEffect(() => {
    const detectLanguage = () => {
      const browserLang = navigator.language || navigator.userLanguage;
      const langCode = browserLang.split('-')[0]; // Get primary language code
      
      const languageMap = {
        'en': 'en',
        'hi': 'hi',
        'zh': 'zh',
        'es': 'es',
        'fr': 'fr',
        'ja': 'ja',
        'ko': 'ko',
        'th': 'th',
        'ar': 'ar',
        'it': 'it',
        'pt': 'pt',
        'vi': 'vi',
      };
      
      const detectedLang = languageMap[langCode] || 'en';
      
      // Store in localStorage if not already set
      if (!localStorage.getItem('preferredLanguage')) {
        localStorage.setItem('preferredLanguage', detectedLang);
        console.log(`Auto-detected language: ${detectedLang}`);
      }
    };
    
    detectLanguage();
  }, []);

  return (
    <AuthProvider>
      <ShoppingCartProvider>
        <div className="App min-h-screen">
          <BrowserRouter>
            <Navigation />
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
            </Routes>
            <ShoppingCartModal />
          </BrowserRouter>
          <Toaster />
        </div>
      </ShoppingCartProvider>
    </AuthProvider>
  );
}

export default App;