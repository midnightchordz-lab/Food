import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import LandingPage from "@/pages/LandingPage";
import ChatPage from "@/pages/ChatPage";
import SavedRecipes from "@/pages/SavedRecipes";
import ShoppingListPage from "@/pages/ShoppingListPage";
import WeeklyPlannerPage from "@/pages/WeeklyPlannerPage";
import ProfilePage from "@/pages/ProfilePage";
import Navigation from "@/components/Navigation";
import "@/App.css";

function App() {
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
          </Routes>
        </BrowserRouter>
        <Toaster />
      </div>
    </AuthProvider>
  );
}

export default App;