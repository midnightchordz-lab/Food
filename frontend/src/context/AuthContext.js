import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, name, dietaryRestrictions = [], cuisinePreferences = []) => {
    try {
      const response = await axios.post(`${API}/auth/register`, {
        email,
        password,
        name,
        dietary_restrictions: dietaryRestrictions,
        cuisine_preferences: cuisinePreferences
      });
      const { access_token, user: userData, trial } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      // Trigger subscription refresh after successful registration
      window.dispatchEvent(new CustomEvent('trigger-subscription-refresh'));
      
      // Return trial info for showing welcome modal
      if (trial?.active) {
        toast.success('Welcome! Your 7-day premium trial has started!');
        return { success: true, trial };
      }
      
      toast.success('Welcome to MOOD FOOD!');
      return { success: true, trial: null };
    } catch (error) {
      const message = error.response?.data?.detail || 'Registration failed';
      toast.error(message);
      return { success: false, trial: null };
    }
  };

  const login = async (email, password) => {
    try {
      console.log('Attempting login to:', `${API}/auth/login`);
      const response = await axios.post(`${API}/auth/login`, {
        email,
        password
      });
      const { access_token, user: userData } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      // Trigger subscription refresh after successful login
      window.dispatchEvent(new CustomEvent('trigger-subscription-refresh'));
      toast.success(`Welcome back, ${userData.name}!`);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      
      let message = 'Login failed';
      if (error.response?.data?.detail) {
        message = error.response.data.detail;
      } else if (error.message === 'Network Error') {
        message = 'Network error - cannot reach server';
      } else if (error.code === 'ERR_NETWORK') {
        message = 'Network error - check your internet connection';
      }
      
      toast.error(message);
      return false;
    }
  };

  const logout = () => {
    // Clear all user-specific chat data from localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('moodfood_chat_state_') || 
        key.startsWith('moodfood_diabetes_chat_state_')
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear auth data
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
    toast.success('Logged out successfully');
  };

  // Login with token directly (for phone auth)
  const loginWithToken = async (accessToken, userData) => {
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    // Trigger subscription refresh after successful token login
    window.dispatchEvent(new CustomEvent('trigger-subscription-refresh'));
    return true;
  };

  const updateProfile = async (data) => {
    try {
      const response = await axios.put(`${API}/auth/profile`, data);
      setUser(response.data);
      toast.success('Profile updated!');
      return true;
    } catch (error) {
      toast.error('Failed to update profile');
      return false;
    }
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    register,
    login,
    loginWithToken,
    logout,
    updateProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};