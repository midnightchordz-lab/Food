import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import LandingPage from "@/pages/LandingPage";
import ChatPage from "@/pages/ChatPage";
import SavedRecipes from "@/pages/SavedRecipes";
import ShoppingListPage from "@/pages/ShoppingListPage";
import WeeklyPlannerPage from "@/pages/WeeklyPlannerPage";
import ProfilePage from "@/pages/ProfilePage";
import ExploreCuisinesPage from "@/pages/ExploreCuisinesPage";
import CuisineRecipesPage from "@/pages/CuisineRecipesPage";
import Navigation from "@/components/Navigation";
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
      <div className="App min-h-screen">
        <BrowserRouter>
          <Navigation />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/saved-recipes" element={<SavedRecipes />} />
            <Route path="/shopping-list" element={<ShoppingListPage />} />
            <Route path="/weekly-planner" element={<WeeklyPlannerPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/explore-cuisines" element={<ExploreCuisinesPage />} />
            <Route path="/recipes/cuisine/:cuisine" element={<CuisineRecipesPage />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </div>
    </AuthProvider>
  );
}

export default App;