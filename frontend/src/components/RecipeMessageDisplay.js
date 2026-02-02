import { useState, useCallback, useEffect, useRef } from 'react';
import { Heart, Clock, ChefHat, Utensils, ChevronRight, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RecipeDetailModal from './RecipeDetailModal';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Cache for AI-generated images to avoid re-generation
const aiImageCache = new Map();

// Function to generate AI image for a recipe
const generateAIImage = async (recipeName, cuisine = '') => {
  try {
    const response = await fetch(`${API_URL}/api/recipe-image/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipe_name: recipeName,
        cuisine: cuisine,
        ingredients: []
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.image_url;
    }
    return null;
  } catch (error) {
    console.error('AI image generation error:', error);
    return null;
  }
};

// Curated high-quality food images from Unsplash
const FOOD_IMAGES = {
  // Indian
  'butter chicken': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800',
  'palak paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
  'chicken biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
  'biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
  'dal': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800',
  'curry': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
  'tikka masala': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800',
  'tikka': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800',
  'samosa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
  'naan': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800',
  'paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
  'chana masala': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
  'korma': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800',
  'vindaloo': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
  
  // Italian
  'caprese': 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=800',
  'quinoa salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  'spaghetti': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
  'carbonara': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
  'pasta': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800',
  'pizza': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
  'margherita': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
  'risotto': 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800',
  'tiramisu': 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
  'lasagna': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800',
  'penne': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800',
  'alfredo': 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=800',
  'gnocchi': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800',
  'bruschetta': 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=800',
  'minestrone': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
  
  // Mexican
  'tacos': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800',
  'burrito': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800',
  'guacamole': 'https://images.unsplash.com/photo-1604132061973-c90de135f2a4?w=800',
  'enchiladas': 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800',
  'quesadilla': 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800',
  'nachos': 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=800',
  'fajitas': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800',
  'burrito bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'chilaquiles': 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800',
  
  // Chinese
  'kung pao': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800',
  'mapo tofu': 'https://images.unsplash.com/photo-1582452919408-80d02cb4cf45?w=800',
  'dim sum': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
  'dumplings': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
  'fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
  'stir fry': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800',
  'noodles': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
  'chow mein': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800',
  'lo mein': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800',
  'orange chicken': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800',
  'general tso': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800',
  'sweet and sour': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800',
  
  // Japanese
  'ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
  'sushi': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
  'teriyaki chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'chicken teriyaki': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'tempura': 'https://images.unsplash.com/photo-1581781870027-04212e231e96?w=800',
  'miso soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
  'udon': 'https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?w=800',
  'donburi': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
  'edamame': 'https://images.unsplash.com/photo-1564093497595-593b96d80180?w=800',
  'katsu': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800',
  'onigiri': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
  
  // Thai
  'pad thai': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
  'green curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  'tom yum': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
  'thai curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  'massaman': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  'satay': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
  'tom kha': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
  'thai basil': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
  
  // Mediterranean
  'falafel': 'https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?w=800',
  'shakshuka': 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=800',
  'hummus': 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800',
  'kebab': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
  'gyro': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
  'pita': 'https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?w=800',
  'greek salad': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
  'moussaka': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800',
  'tabbouleh': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  
  // Korean
  'bibimbap': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800',
  'bulgogi': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
  'kimchi': 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800',
  'korean bbq': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
  'japchae': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
  'korean fried chicken': 'https://images.unsplash.com/photo-1575932444877-5106bee2a599?w=800',
  
  // French
  'croissant': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
  'ratatouille': 'https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=800',
  'quiche': 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800',
  'crepe': 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=800',
  'coq au vin': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'bouillabaisse': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
  'beef bourguignon': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
  
  // General Foods
  'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
  'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  'sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
  'smoothie': 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=800',
  'smoothie bowl': 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=800',
  'oatmeal': 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=800',
  'pancakes': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
  'avocado toast': 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=800',
  
  // PROTEINS - HIGH PRIORITY (salmon, fish, shrimp MUST come before chicken)
  'salmon': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
  'salmon bowl': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
  'teriyaki salmon': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
  'salmon teriyaki': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
  'grilled salmon': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
  'baked salmon': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
  'tuna': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'shrimp': 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800',
  'fish': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
  
  // OTHER PROTEINS
  'chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'grilled chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
  'steak': 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800',
  'burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
  'roasted vegetables': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800',
  'bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'grain bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'buddha bowl': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'wrap': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800',
  'veggie wrap': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800',
  'tofu': 'https://images.unsplash.com/photo-1582452919408-80d02cb4cf45?w=800',
  'egg': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
  'omelet': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
  'frittata': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
  'dessert': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800',
  'chocolate': 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800',
  'cake': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
};

// Cuisine fallbacks
const CUISINE_FALLBACKS = {
  'indian': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
  'italian': 'https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=800',
  'mexican': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800',
  'chinese': 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800',
  'japanese': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
  'thai': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
  'mediterranean': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
  'korean': 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800',
  'french': 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800',
  'american': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
  'vegetarian': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
  'vegan': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800',
};

// Generic food images
const GENERIC_FOOD_IMAGES = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
];

// HIGH PRIORITY PROTEINS - These MUST match BEFORE cooking styles
const HIGH_PRIORITY_PROTEINS = new Set([
  'salmon', 'tuna', 'shrimp', 'prawns', 'lobster', 'crab', 'fish', 'duck'
]);

// SPECIFIC DISHES - These should match before generic proteins
const SPECIFIC_DISHES = new Set([
  'yakitori', 'tempura', 'tonkatsu', 'ramen', 'udon', 'soba', 'sushi', 'sashimi',
  'bibimbap', 'bulgogi', 'kimchi', 'japchae', 'biryani', 'pulao', 'tikka', 'tandoori',
  'pad thai', 'tom yum', 'pho', 'banh mi', 'tacos', 'burrito', 'enchiladas',
  'carbonara', 'lasagna', 'risotto', 'falafel', 'shawarma', 'kebab', 'paella'
]);

// COOKING STYLES - Lowest priority, should NOT override proteins
const COOKING_STYLES = new Set([
  'teriyaki', 'grilled', 'baked', 'fried', 'roasted', 'steamed', 'glazed', 'crispy'
]);

/**
 * SIMPLE, DIRECT image matching - NO complex logic
 * Just find keywords in order of priority
 */
const getRecipeImage = (title, cuisineHint = '') => {
  const searchText = (title + ' ' + cuisineHint).toLowerCase();
  
  // PRIORITY 1: Check for HIGH PRIORITY PROTEINS (salmon, shrimp, tuna, fish)
  // These MUST match first to avoid salmon showing chicken
  if (searchText.includes('salmon')) {
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800';
  }
  if (searchText.includes('tuna')) {
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800';
  }
  if (searchText.includes('shrimp') || searchText.includes('prawn') || searchText.includes('ebi')) {
    return 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800';
  }
  if (searchText.includes('lobster')) {
    return 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800';
  }
  if (searchText.includes('crab')) {
    return 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800';
  }
  if (searchText.includes('cod') || searchText.includes('fish') && !searchText.includes('dish')) {
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800';
  }
  
  // PRIORITY 2: Check for SPECIFIC JAPANESE dishes
  if (searchText.includes('tempura')) {
    return 'https://images.unsplash.com/photo-1581781870027-04212e231e96?w=800';
  }
  if (searchText.includes('yakitori')) {
    return 'https://images.unsplash.com/photo-1708597525178-6c302364f37c?w=800';
  }
  if (searchText.includes('ramen')) {
    return 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800';
  }
  if (searchText.includes('sushi')) {
    return 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800';
  }
  if (searchText.includes('udon')) {
    return 'https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?w=800';
  }
  if (searchText.includes('soba')) {
    return 'https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?w=800';
  }
  if (searchText.includes('katsu')) {
    return 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800';
  }
  if (searchText.includes('miso')) {
    return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800';
  }
  if (searchText.includes('donburi') || searchText.includes('don ')) {
    return 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800';
  }
  
  // PRIORITY 3: Check for INDIAN dishes
  if (searchText.includes('biryani')) {
    return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800';
  }
  if (searchText.includes('pulao') || searchText.includes('pulav')) {
    return 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800';
  }
  if (searchText.includes('tikka')) {
    return 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800';
  }
  if (searchText.includes('tandoori')) {
    return 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800';
  }
  if (searchText.includes('butter chicken')) {
    return 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800';
  }
  if (searchText.includes('korma')) {
    return 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800';
  }
  if (searchText.includes('paneer')) {
    return 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800';
  }
  if (searchText.includes('dal') || searchText.includes('daal')) {
    return 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800';
  }
  if (searchText.includes('curry') && searchText.includes('india')) {
    return 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800';
  }
  
  // PRIORITY 4: Check for THAI dishes
  if (searchText.includes('pad thai')) {
    return 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800';
  }
  if (searchText.includes('tom yum')) {
    return 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800';
  }
  if (searchText.includes('green curry') || searchText.includes('thai curry')) {
    return 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800';
  }
  if (searchText.includes('satay')) {
    return 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800';
  }
  
  // PRIORITY 5: Check for KOREAN dishes
  if (searchText.includes('bibimbap')) {
    return 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800';
  }
  if (searchText.includes('bulgogi')) {
    return 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800';
  }
  if (searchText.includes('kimchi')) {
    return 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800';
  }
  
  // PRIORITY 6: Check for MEXICAN dishes
  if (searchText.includes('taco')) {
    return 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800';
  }
  if (searchText.includes('burrito')) {
    return 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800';
  }
  if (searchText.includes('enchilada')) {
    return 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800';
  }
  if (searchText.includes('quesadilla')) {
    return 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800';
  }
  
  // PRIORITY 7: Check for ITALIAN dishes
  if (searchText.includes('carbonara')) {
    return 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800';
  }
  if (searchText.includes('lasagna') || searchText.includes('lasagne')) {
    return 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800';
  }
  if (searchText.includes('risotto')) {
    return 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800';
  }
  if (searchText.includes('pizza')) {
    return 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800';
  }
  if (searchText.includes('pasta') || searchText.includes('spaghetti') || searchText.includes('penne')) {
    return 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800';
  }
  
  // PRIORITY 8: Check for CHINESE dishes
  if (searchText.includes('kung pao')) {
    return 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800';
  }
  if (searchText.includes('dim sum') || searchText.includes('dumpling')) {
    return 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800';
  }
  if (searchText.includes('fried rice')) {
    return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800';
  }
  if (searchText.includes('chow mein') || searchText.includes('lo mein')) {
    return 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800';
  }
  
  // PRIORITY 9: Check for VIETNAMESE dishes
  if (searchText.includes('pho')) {
    return 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800';
  }
  if (searchText.includes('banh mi')) {
    return 'https://images.unsplash.com/photo-1600688640154-9619e002df30?w=800';
  }
  
  // PRIORITY 10: Check for MIDDLE EASTERN dishes
  if (searchText.includes('falafel')) {
    return 'https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?w=800';
  }
  if (searchText.includes('shawarma')) {
    return 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800';
  }
  if (searchText.includes('hummus')) {
    return 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800';
  }
  if (searchText.includes('shakshuka')) {
    return 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=800';
  }
  
  // PRIORITY 11: CHICKEN comes LAST (after all specific dishes checked)
  if (searchText.includes('chicken') || searchText.includes('teriyaki')) {
    return 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800';
  }
  
  // PRIORITY 12: Other proteins
  if (searchText.includes('beef') || searchText.includes('steak')) {
    return 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800';
  }
  if (searchText.includes('pork')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800';
  }
  if (searchText.includes('lamb')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800';
  }
  if (searchText.includes('tofu')) {
    return 'https://images.unsplash.com/photo-1582452919408-80d02cb4cf45?w=800';
  }
  
  // PRIORITY 13: Generic food types
  if (searchText.includes('salad')) {
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800';
  }
  if (searchText.includes('soup')) {
    return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800';
  }
  if (searchText.includes('sandwich')) {
    return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800';
  }
  if (searchText.includes('burger')) {
    return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800';
  }
  if (searchText.includes('bowl')) {
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800';
  }
  if (searchText.includes('curry')) {
    return 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800';
  }
  if (searchText.includes('noodle')) {
    return 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800';
  }
  if (searchText.includes('rice')) {
    return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800';
  }
  
  // CUISINE FALLBACKS
  if (cuisineHint) {
    const cuisine = cuisineHint.toLowerCase();
    if (cuisine.includes('japan')) return 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800';
    if (cuisine.includes('india')) return 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800';
    if (cuisine.includes('thai')) return 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800';
    if (cuisine.includes('korea')) return 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800';
    if (cuisine.includes('china') || cuisine.includes('chinese')) return 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800';
    if (cuisine.includes('mexic')) return 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800';
    if (cuisine.includes('italy') || cuisine.includes('italian')) return 'https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=800';
    if (cuisine.includes('vietnam')) return 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800';
    if (cuisine.includes('middle east') || cuisine.includes('mediterranean')) return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800';
  }
  
  // FALLBACK: Use generic food image based on title hash
  const hash = title.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
  return GENERIC_FOOD_IMAGES[Math.abs(hash) % GENERIC_FOOD_IMAGES.length];
};

// Difficulty badge colors
const DIFFICULTY_COLORS = {
  'Easy': 'bg-green-500/15 text-green-700 border-green-500/40',
  'Medium': 'bg-amber-500/15 text-amber-700 border-amber-500/40',
  'Hard': 'bg-red-500/15 text-red-700 border-red-500/40',
};

// Time category icons and colors
const TIME_CATEGORIES = {
  quick: { icon: '⚡', title: 'Quick Option (15-20 min)', color: 'text-emerald-600' },
  moderate: { icon: '🍳', title: 'Moderate Option (20-40 min)', color: 'text-blue-600' },
  elaborate: { icon: '👨‍🍳', title: 'Elaborate Option (40-60 min)', color: 'text-purple-600' },
};

// Parse recipes with better title extraction - supports multiple recipes per category
const parseRecipesWithCategories = (message) => {
  const categories = {
    quick: { ...TIME_CATEGORIES.quick, recipes: [] },
    moderate: { ...TIME_CATEGORIES.moderate, recipes: [] },
    elaborate: { ...TIME_CATEGORIES.elaborate, recipes: [] },
  };
  
  // PATTERN 1: New AI format - "### 1. Recipe Name" or "### Recipe Name"
  // Parse numbered recipes and distribute by cooking time
  const numberedRecipes = parseNumberedRecipes(message);
  if (numberedRecipes.length > 0) {
    numberedRecipes.forEach(recipe => {
      const time = extractTimeMinutes(recipe.cookingTime);
      if (time <= 25) categories.quick.recipes.push(recipe);
      else if (time <= 40) categories.moderate.recipes.push(recipe);
      else categories.elaborate.recipes.push(recipe);
    });
    
    // If all ended up in one category, redistribute evenly
    const totalRecipes = numberedRecipes.length;
    if (categories.quick.recipes.length === totalRecipes || 
        categories.moderate.recipes.length === totalRecipes ||
        categories.elaborate.recipes.length === totalRecipes) {
      categories.quick.recipes = [];
      categories.moderate.recipes = [];
      categories.elaborate.recipes = [];
      numberedRecipes.forEach((recipe, idx) => {
        if (idx < Math.ceil(totalRecipes / 3)) categories.quick.recipes.push(recipe);
        else if (idx < Math.ceil(2 * totalRecipes / 3)) categories.moderate.recipes.push(recipe);
        else categories.elaborate.recipes.push(recipe);
      });
    }
    return categories;
  }
  
  // PATTERN 2: Original format - "### Quick Option (X min): Recipe Name"
  const quickMatches = [...message.matchAll(/###?\s*Quick\s*Option[^:]*:\s*([^\n]+)[\s\S]*?(?=###?\s*(?:Quick|Moderate|Elaborate)\s*Option|$)/gi)];
  const moderateMatches = [...message.matchAll(/###?\s*Moderate\s*Option[^:]*:\s*([^\n]+)[\s\S]*?(?=###?\s*(?:Quick|Moderate|Elaborate)\s*Option|$)/gi)];
  const elaborateMatches = [...message.matchAll(/###?\s*Elaborate\s*Option[^:]*:\s*([^\n]+)[\s\S]*?(?=###?\s*(?:Quick|Moderate|Elaborate)\s*Option|$)/gi)];
  
  // Parse each match
  quickMatches.forEach(match => {
    const recipe = parseRecipeFromMatch(match, 'quick');
    if (recipe) categories.quick.recipes.push(recipe);
  });
  
  moderateMatches.forEach(match => {
    const recipe = parseRecipeFromMatch(match, 'moderate');
    if (recipe) categories.moderate.recipes.push(recipe);
  });
  
  elaborateMatches.forEach(match => {
    const recipe = parseRecipeFromMatch(match, 'elaborate');
    if (recipe) categories.elaborate.recipes.push(recipe);
  });
  
  // If no categories found, try general parsing
  if (!categories.quick.recipes.length && !categories.moderate.recipes.length && !categories.elaborate.recipes.length) {
    // Fallback: try old section-based parsing
    const quickSection = message.match(/###?\s*Quick\s*Option[^#]*(?=###|$)/is);
    const moderateSection = message.match(/###?\s*Moderate\s*Option[^#]*(?=###|$)/is);
    const elaborateSection = message.match(/###?\s*Elaborate\s*Option[^#]*(?=###|$)/is);
    
    if (quickSection) categories.quick.recipes = parseRecipesFromSection(quickSection[0], 'quick');
    if (moderateSection) categories.moderate.recipes = parseRecipesFromSection(moderateSection[0], 'moderate');
    if (elaborateSection) categories.elaborate.recipes = parseRecipesFromSection(elaborateSection[0], 'elaborate');
    
    // If still nothing, try completely general parsing
    if (!categories.quick.recipes.length && !categories.moderate.recipes.length && !categories.elaborate.recipes.length) {
      const allRecipes = parseRecipesGeneral(message);
      allRecipes.forEach(recipe => {
        const time = extractTimeMinutes(recipe.cookingTime);
        if (time <= 20) categories.quick.recipes.push(recipe);
        else if (time <= 40) categories.moderate.recipes.push(recipe);
        else categories.elaborate.recipes.push(recipe);
      });
    }
  }
  
  return categories;
};

// Parse numbered recipes format: "### 1. Recipe Name" or "## Recipe 3: Name" or "### Recipe Name (Meal Type)"
const parseNumberedRecipes = (message) => {
  const recipes = [];
  
  // Comprehensive skip patterns - NOT recipe names
  const skipPatterns = [
    /^(option|tip|note|step|ingredient|instruction|direction|nutritional|sensory|description|serving|highlight|benefit|why|quick|moderate|elaborate|cooking time|difficulty|cuisine type|cuisine|name|total time|prep time)/i,
    /^(blood sugar|diabetes|health|safety|warning|important|reminder|disclaimer|information|general|overview|summary|conclusion|key|additional|special|meal planning|meal prep)/i,
    /^(tips?|notes?|benefits?|guidelines?|considerations?|recommendations?)/i,
    /^(about|regarding|for your|please|remember|keep in mind)/i,
    /^(drink|pairing|beverage|hydration)/i,
    // Skip generic advice/tips that are NOT recipe names
    /^(choose|select|opt for|look for|watch|avoid|limit|consider|try|focus on|prioritize|incorporate)/i,
    /^(lean proteins?|non-starchy|starchy|vegetables?|sauces?|carbohydrates?|fiber|sugar|sodium|fats?)/i,
    /^(portion|serving size|balance|moderation|healthy|low|high|good|best|worst)/i,
    // Skip common tip titles that appear as recipes
    /^(whole grains?|spices?|herbs?|fresh produce|ingredients?|cooking methods?|meal ideas?)/i,
    /^(protein sources?|healthy fats?|complex carbs?|simple swaps?|smart choices?)/i,
    /\b(in moderation|with caution|sparingly|carefully)\b/i,
  ];
  
  // Match patterns:
  // - "### 1. Recipe Name"
  // - "## Recipe 1: Recipe Name" (diabetes format)
  // - "### Recipe Name (Meal Type)"
  // Each section ends at the next ## or ### or ---
  
  // PATTERN 1: Diabetes format "## Recipe X: Recipe Name"
  const diabetesPattern = /##\s*Recipe\s*\d+:\s*([^\n]+)\n([\s\S]*?)(?=##\s*Recipe\s*\d+:|---\s*$|$)/gi;
  let match;
  while ((match = diabetesPattern.exec(message)) !== null) {
    let title = match[1].trim();
    const content = match[2].trim();
    
    // Skip empty titles
    if (!title || title.length < 3 || title.length > 100) continue;
    if (skipPatterns.some(pattern => pattern.test(title))) continue;
    if (title === ':' || title.endsWith(':')) continue;
    
    // Extract cooking time
    const timeMatch = content.match(/\*\*(?:Cook(?:ing)?\s*)?Time:?\*\*\s*(\d+[-–]?\d*)\s*min/i) ||
                      content.match(/\*\*Prep\s*Time:?\*\*\s*(\d+)/i);
    const cookingTime = timeMatch ? timeMatch[1] + ' min' : '30 min';
    
    // Extract difficulty
    const diffMatch = content.match(/\*\*Difficulty:?\*\*\s*(Easy|Medium|Hard)/i);
    const difficulty = diffMatch ? diffMatch[1] : 'Medium';
    
    // Extract description - look for "Why" explanations or first content line
    const descMatch = content.match(/\*\*Why[^*]+\*\*\s*([^\n]+)/i) ||
                      content.match(/💚\s*\*\*Why[^*]+\*\*\s*\n([^\n*]+)/i) ||
                      content.match(/\*\*Description:?\*\*\s*([^\n*]+)/i);
    let description = descMatch ? descMatch[1].trim().replace(/^[-•]\s*/, '') : '';
    if (!description) {
      // Try to get from blood sugar impact info
      const bloodSugarMatch = content.match(/Blood Sugar Impact:\s*([^\n]+)/i);
      if (bloodSugarMatch) description = `Blood sugar impact: ${bloodSugarMatch[1].trim()}`;
    }
    if (!description) description = `A delicious diabetes-friendly ${title} recipe.`;
    
    // Detect cuisine
    const cuisineHint = detectCuisine(title + ' ' + content);
    
    recipes.push({
      title,
      description,
      cookingTime,
      difficulty,
      cuisineHint,
      category: 'moderate',
      imageUrl: getRecipeImage(title, cuisineHint),
      fullContent: content
    });
  }
  
  // If we found recipes in diabetes format, return them
  if (recipes.length > 0) {
    return recipes;
  }
  
  // PATTERN 2: Standard format "### 1. Recipe Name" or "### Recipe Name"
  const recipePattern = /##[#]?\s*(?:\d+\.)?\s*([^\n:]+?)(?:\([^)]*\))?\s*\n([\s\S]*?)(?=##[#]?|---\s*$|$)/g;
  
  while ((match = recipePattern.exec(message)) !== null) {
    let title = match[1].trim()
      .replace(/\([^)]*\)\s*$/, '')
      .replace(/^:\s*/, '')
      .trim();
    const content = match[2].trim();
    
    if (!title || title.length < 3 || title.length > 100) continue;
    if (skipPatterns.some(pattern => pattern.test(title))) continue;
    if (title === ':' || title.endsWith(':')) continue;
    
    // Skip if title is "Recipe X" - we need the actual name
    if (/^Recipe\s*\d+$/i.test(title)) continue;
    
    const timeMatch = content.match(/\*\*(?:Cooking\s*)?Time:?\*\*\s*(\d+[-–]?\d*)\s*min/i) ||
                      content.match(/\|\s*\*\*Time:?\*\*\s*(\d+)\s*min/i);
    const cookingTime = timeMatch ? timeMatch[1] + ' min' : '30 min';
    
    const diffMatch = content.match(/\*\*Difficulty:?\*\*\s*(Easy|Medium|Hard)/i);
    const difficulty = diffMatch ? diffMatch[1] : 'Medium';
    
    const descMatch = content.match(/\*\*Why[^*]+\*\*\s*([^\n*]+)/i) ||
                      content.match(/\*\*Description:?\*\*\s*([^\n*]+)/i);
    let description = descMatch ? descMatch[1].trim() : '';
    if (!description) {
      const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('*') && !l.startsWith('#'));
      if (lines.length > 0) description = lines[0].substring(0, 200);
    }
    if (!description) description = `A delicious ${title} recipe.`;
    
    const cuisineMatch = content.match(/\*\*Cuisine:?\*\*\s*([^|\n*]+)/i);
    const cuisineHint = cuisineMatch ? cuisineMatch[1].trim() : detectCuisine(title + ' ' + content);
    
    recipes.push({
      title,
      description,
      cookingTime,
      difficulty,
      cuisineHint,
      category: 'moderate',
      imageUrl: getRecipeImage(title, cuisineHint),
      fullContent: content
    });
  }
  
  return recipes;
};

// Parse a single recipe from a regex match
const parseRecipeFromMatch = (match, category) => {
  const [fullMatch, titleFromHeader] = match;
  const title = titleFromHeader?.trim();
  
  // Comprehensive skip patterns - NOT recipe names
  const skipPatterns = [
    /^(option|tip|note|step|ingredient|instruction|direction|nutritional|sensory|description|serving|highlight|benefit|why|quick|moderate|elaborate|cooking time|difficulty|cuisine type|cuisine|name|total time|prep time)/i,
    /^(blood sugar|diabetes|health|safety|warning|important|reminder|disclaimer|information|general|overview|summary|conclusion|key|additional|special|meal planning|meal prep)/i,
    /^(tips?|notes?|benefits?|guidelines?|considerations?|recommendations?)/i,
    /^(about|regarding|for your|please|remember|keep in mind)/i,
    /^(drink|pairing|beverage|hydration)/i,
    // Skip generic advice/tips that are NOT recipe names
    /^(choose|select|opt for|look for|watch|avoid|limit|consider|try|focus on|prioritize|incorporate)/i,
    /^(lean proteins?|non-starchy|starchy|vegetables?|sauces?|carbohydrates?|fiber|sugar|sodium|fats?)/i,
    /^(portion|serving size|balance|moderation|healthy|low|high|good|best|worst)/i,
    // Skip common tip titles that appear as recipes
    /^(whole grains?|spices?|herbs?|fresh produce|ingredients?|cooking methods?|meal ideas?)/i,
    /^(protein sources?|healthy fats?|complex carbs?|simple swaps?|smart choices?)/i,
    /\b(in moderation|with caution|sparingly|carefully)\b/i,
    /:$/,  // Ends with colon
  ];
  
  if (!title || title.length < 3 || title.length > 120) return null;
  if (skipPatterns.some(p => p.test(title))) return null;
  if (title.endsWith(':')) return null;
  
  // Extract cooking time from the full match
  const timeMatch = fullMatch.match(/\*\*Cooking\s*Time:?\*\*\s*(\d+[-–]?\d*\s*(?:min|minutes|hours?))/i) ||
                    fullMatch.match(/\((\d+[-–]?\d*\s*min)\)/i);
  const cookingTime = timeMatch ? timeMatch[1] : getCategoryDefaultTime(category);
  
  // Extract difficulty
  const diffMatch = fullMatch.match(/\*\*Difficulty(?:\s*Level)?:?\*\*\s*(Easy|Medium|Hard|Moderate)/i);
  let difficulty = diffMatch ? diffMatch[1] : 'Medium';
  if (difficulty === 'Moderate') difficulty = 'Medium';
  if (category === 'quick') difficulty = 'Easy';
  if (category === 'elaborate') difficulty = 'Hard';
  
  // Extract description
  const descMatch = fullMatch.match(/\*\*Description:?\*\*\s*([^*\n]+)/i);
  let description = descMatch ? descMatch[1].trim() : '';
  if (!description) {
    const lines = fullMatch.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('**'));
    if (lines.length > 0) {
      description = lines[0].trim().substring(0, 200);
    }
  }
  if (!description || description.length < 10) {
    description = `A delicious ${category === 'quick' ? 'quick and easy' : category === 'elaborate' ? 'gourmet' : 'satisfying'} dish perfect for any occasion.`;
  }
  
  const cuisineHint = detectCuisine(title + ' ' + fullMatch);
  
  return {
    title,
    description,
    cookingTime,
    difficulty,
    cuisineHint,
    category,
    imageUrl: getRecipeImage(title, cuisineHint),
    fullContent: fullMatch
  };
};

// Extract time in minutes
const extractTimeMinutes = (timeStr) => {
  if (!timeStr) return 30;
  const match = timeStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 30;
};

// Parse recipes from a section with improved title detection
const parseRecipesFromSection = (section, category) => {
  const recipes = [];
  
  // Skip patterns - things that are NOT recipe names
  const skipPatterns = [
    /^(option|tip|note|step|ingredient|instruction|direction|nutritional|sensory|description|serving|highlight|benefit|why|quick|moderate|elaborate|cooking time|difficulty|cuisine type|cuisine|name|total time|prep time)/i,
    /^(blood sugar|diabetes|health|safety|warning|important|reminder|disclaimer|information|general|overview|summary|conclusion|key|additional|special|meal planning|meal prep)/i,
    /^(tips?|notes?|benefits?|guidelines?|considerations?|recommendations?)/i,
    /^(about|regarding|for your|please|remember|keep in mind)/i,
    /^(drink|pairing|beverage|hydration|safe)/i,
    // Skip generic advice/tips that are NOT recipe names
    /^(choose|select|opt for|look for|watch|avoid|limit|consider|try|focus on|prioritize|incorporate)/i,
    /^(lean proteins?|non-starchy|starchy|vegetables?|sauces?|carbohydrates?|fiber|sugar|sodium|fats?)/i,
    /^(portion|serving size|balance|moderation|healthy|low|high|good|best|worst)/i,
    // Skip common tip titles that appear as recipes
    /^(whole grains?|spices?|herbs?|fresh produce|ingredients?|cooking methods?|meal ideas?)/i,
    /^(protein sources?|healthy fats?|complex carbs?|simple swaps?|smart choices?)/i,
    /\b(in moderation|with caution|sparingly|carefully)\b/i,
    /^\d+\.\s*$/,
    /^[:\s]*\(\d+/,
  ];
  
  // PATTERN 1: Try to extract recipe title from ### header line
  // Format: "### Quick Option (15-20 min): Recipe Title Name Here"
  const headerMatch = section.match(/###?\s*(?:Quick|Moderate|Elaborate)\s*Option\s*\([^)]+\)\s*[:\-–]\s*(.+?)(?:\n|$)/i);
  if (headerMatch) {
    const title = headerMatch[1].trim();
    if (title.length >= 3 && title.length <= 120 && !skipPatterns.some(p => p.test(title)) && !title.endsWith(':')) {
      const recipe = parseRecipeContent(title, section, category);
      if (recipe) recipes.push(recipe);
      return recipes; // One recipe per section in this format
    }
  }
  
  // PATTERN 2: Original pattern - look for **Recipe Title**
  const recipePattern = /\*\*([^*]+)\*\*([^*]*?)(?=\*\*|$)/gs;
  let match;
  
  while ((match = recipePattern.exec(section)) !== null) {
    let title = match[1].trim();
    const content = match[2].trim();
    
    // Skip if it matches skip patterns
    if (skipPatterns.some(pattern => pattern.test(title))) continue;
    if (title.length < 3 || title.length > 120) continue;
    
    // Skip titles that end with a colon (usually section headers)
    if (title.endsWith(':')) continue;
    
    // Clean title - remove parenthetical time if present
    const titleTimeMatch = title.match(/^(.+?)\s*\((\d+[-–]?\d*\s*(?:min|minutes?))\)$/i);
    let cookingTime = null;
    if (titleTimeMatch) {
      title = titleTimeMatch[1].trim();
      cookingTime = titleTimeMatch[2];
    }
    
    // Get cooking time from content if not in title
    if (!cookingTime) {
      const contentTimeMatch = content.match(/(\d+[-–]?\d*)\s*(min|minutes|hour|hours)/i);
      cookingTime = contentTimeMatch ? contentTimeMatch[0] : getCategoryDefaultTime(category);
    }
    
    // Skip if title still looks like a label
    if (title.match(/^(name|time|difficulty|type|cuisine):/i)) continue;
    
    // Determine difficulty
    let difficulty = 'Medium';
    if (category === 'quick' || content.match(/\b(quick|easy|simple|fast)\b/i)) difficulty = 'Easy';
    else if (category === 'elaborate' || content.match(/\b(involved|complex|advanced|elaborate)\b/i)) difficulty = 'Hard';
    
    // Get description - clean it up
    let description = '';
    const descLines = content.split('\n').filter(l => l.trim() && !l.match(/^[-*•]/));
    if (descLines.length > 0) {
      description = descLines[0].replace(/^[:\s]+/, '').trim();
      // Get up to 2 sentences
      const sentences = description.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 0) {
        description = sentences.slice(0, 2).join(' ').trim();
      }
    }
    if (!description || description.length < 10) {
      description = `A delicious ${category === 'quick' ? 'quick and easy' : category === 'elaborate' ? 'gourmet' : 'satisfying'} dish perfect for any occasion.`;
    }
    
    // Detect cuisine
    const cuisineHint = detectCuisine(title + ' ' + content);
    
    recipes.push({
      title,
      description,
      cookingTime,
      difficulty,
      cuisineHint,
      category,
      imageUrl: getRecipeImage(title, cuisineHint),
      fullContent: content
    });
  }
  
  return recipes;
};

// Parse recipe content helper for header-based recipes
const parseRecipeContent = (title, section, category) => {
  // Extract cooking time from section
  const timeMatch = section.match(/\*\*Cooking\s*Time:?\*\*\s*(\d+[-–]?\d*\s*(?:min|minutes|hours?))/i) ||
                    section.match(/(\d+[-–]?\d*)\s*(min|minutes)/i);
  const cookingTime = timeMatch ? timeMatch[1] || timeMatch[0] : getCategoryDefaultTime(category);
  
  // Extract difficulty
  const diffMatch = section.match(/\*\*Difficulty(?:\s*Level)?:?\*\*\s*(Easy|Medium|Hard|Moderate)/i);
  let difficulty = diffMatch ? diffMatch[1] : 'Medium';
  if (difficulty === 'Moderate') difficulty = 'Medium';
  if (category === 'quick') difficulty = 'Easy';
  if (category === 'elaborate') difficulty = 'Hard';
  
  // Extract description
  const descMatch = section.match(/\*\*Description:?\*\*\s*([^*\n]+)/i);
  let description = descMatch ? descMatch[1].trim() : '';
  if (!description) {
    // Try to get first paragraph after header
    const paragraphs = section.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('*') && !l.startsWith('-'));
    if (paragraphs.length > 0) {
      description = paragraphs[0].trim().substring(0, 200);
    }
  }
  if (!description || description.length < 10) {
    description = `A delicious ${category === 'quick' ? 'quick and easy' : category === 'elaborate' ? 'gourmet' : 'satisfying'} dish perfect for any occasion.`;
  }
  
  const cuisineHint = detectCuisine(title + ' ' + section);
  
  return {
    title,
    description,
    cookingTime,
    difficulty,
    cuisineHint,
    category,
    imageUrl: getRecipeImage(title, cuisineHint),
    fullContent: section
  };
};

// Get default time for category
const getCategoryDefaultTime = (category) => {
  switch (category) {
    case 'quick': return '15-20 min';
    case 'moderate': return '25-35 min';
    case 'elaborate': return '45-60 min';
    default: return '30 min';
  }
};

// General recipe parsing (fallback)
const parseRecipesGeneral = (message) => {
  const recipes = [];
  
  const skipPatterns = [
    /^(option|tip|note|step|ingredient|instruction|direction|nutritional|sensory|description|serving|highlight|benefit|why|quick|moderate|elaborate|cooking time|difficulty|cuisine type|cuisine|name)/i,
    /^(blood sugar|diabetes|health|safety|warning|important|reminder|disclaimer|information|general|overview|summary|conclusion|key|additional|special|meal planning|meal prep)/i,
    /^(tips?|notes?|benefits?|guidelines?|considerations?|recommendations?)/i,
    /^(about|regarding|for your|please|remember|keep in mind)/i,
    /^(drink|pairing|beverage|hydration|safe)/i,
    /^(mood boost|why this)/i,
    // Skip generic advice/tips that are NOT recipe names
    /^(choose|select|opt for|look for|watch|avoid|limit|consider|try|focus on|prioritize|incorporate)/i,
    /^(lean proteins?|non-starchy|starchy|vegetables?|sauces?|carbohydrates?|fiber|sugar|sodium|fats?)/i,
    /^(portion|serving size|balance|moderation|healthy|low|high|good|best|worst)/i,
    // Skip common tip titles that appear as recipes
    /^(whole grains?|spices?|herbs?|fresh produce|ingredients?|cooking methods?|meal ideas?)/i,
    /^(protein sources?|healthy fats?|complex carbs?|simple swaps?|smart choices?)/i,
    /\b(in moderation|with caution|sparingly|carefully)\b/i,
  ];
  
  // PATTERN 1: Numbered list format "1. **Recipe Name**" - most common for follow-up requests
  const numberedPattern = /(\d+)\.\s*\*\*([^*]+)\*\*\s*([\s\S]*?)(?=\d+\.\s*\*\*|$)/g;
  let numberedMatch;
  
  while ((numberedMatch = numberedPattern.exec(message)) !== null) {
    const title = numberedMatch[2].trim();
    const content = numberedMatch[3].trim();
    
    if (!title || title.length < 3 || title.length > 120) continue;
    if (skipPatterns.some(pattern => pattern.test(title))) continue;
    if (title.endsWith(':')) continue;
    
    // Extract cooking time
    const timeMatch = content.match(/\*Cooking\s*[Tt]ime:?\*\s*(\d+[-–]?\d*\s*(?:min|minutes?))/i) ||
                      content.match(/(\d+)\s*(?:min|minutes)/i);
    const cookingTime = timeMatch ? timeMatch[1] : '30 min';
    
    // Extract difficulty
    const diffMatch = content.match(/\*Difficulty:?\*\s*(Easy|Medium|Hard)/i);
    let difficulty = diffMatch ? diffMatch[1] : 'Medium';
    
    // Get description - first meaningful line after title
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('*') && !l.startsWith('-'));
    let description = lines.length > 0 ? lines[0].trim() : '';
    // Extract first 2 sentences
    const sentences = description.match(/[^.!?]+[.!?]+/g);
    if (sentences) description = sentences.slice(0, 2).join(' ').trim();
    if (!description || description.length < 10) description = `A delicious ${title} recipe.`;
    
    const cuisineHint = detectCuisine(title + ' ' + content);
    
    recipes.push({
      title,
      description,
      cookingTime: typeof cookingTime === 'string' && !cookingTime.includes('min') ? cookingTime + ' min' : cookingTime,
      difficulty,
      cuisineHint,
      imageUrl: getRecipeImage(title, cuisineHint),
      fullContent: content
    });
  }
  
  // If we found numbered recipes, return them
  if (recipes.length > 0) {
    return recipes;
  }
  
  // PATTERN 2: Standard bold format "**Recipe Name**"
  const recipePattern = /\*\*([^*]+)\*\*([^*]*?)(?=\*\*|$)/gs;
  let match;
  
  while ((match = recipePattern.exec(message)) !== null) {
    let title = match[1].trim();
    const content = match[2].trim();
    
    if (skipPatterns.some(pattern => pattern.test(title))) continue;
    if (title.length < 3 || title.length > 120) continue;
    
    // Skip titles that end with a colon (usually section headers)
    if (title.endsWith(':')) continue;
    
    // Must look like actual food
    const looksLikeRecipe = title.match(/\b(chicken|beef|pork|fish|salmon|shrimp|tofu|vegetable|soup|salad|curry|pasta|rice|noodle|stew|roast|grilled|baked|fried|steamed|bowl|wrap|taco|pizza|burger|sandwich|quinoa|lentil|bean|egg|mushroom|eggplant|zucchini|spinach|kale)\b/i) ||
      title.match(/^[A-Z][a-z]+(\s+[A-Za-z]+)*$/) ||
      title.match(/\b(dal|paneer|tikka|biryani|ramen|sushi|burrito|risotto|pad thai|pho|kebab|falafel|hummus|bibimbap|bulgogi|quesadilla|enchilada|carbonara|alfredo|teriyaki|tempura|korma|vindaloo|masala)\b/i);
    
    if (!looksLikeRecipe && !content.match(/ingredient|prep time|cook time|serves/i)) continue;
    
    const titleTimeMatch = title.match(/^(.+?)\s*\((\d+[-–]?\d*\s*(?:min|minutes?))\)$/i);
    let cookingTime = null;
    if (titleTimeMatch) {
      title = titleTimeMatch[1].trim();
      cookingTime = titleTimeMatch[2];
    }
    if (!cookingTime) {
      const contentTimeMatch = content.match(/(\d+[-–]?\d*)\s*(min|minutes|hour|hours)/i);
      cookingTime = contentTimeMatch ? contentTimeMatch[0] : '30 min';
    }
    
    let difficulty = 'Medium';
    if (content.match(/\b(quick|easy|simple|fast|15[-\s]*min)\b/i)) difficulty = 'Easy';
    else if (content.match(/\b(involved|complex|hour|advanced)\b/i)) difficulty = 'Hard';
    
    let description = content.split('\n')[0].replace(/^[:\s]+/, '').trim();
    const sentences = description.match(/[^.!?]+[.!?]+/g);
    if (sentences) description = sentences.slice(0, 2).join(' ').trim();
    if (!description || description.length < 10) description = 'A delicious mood-boosting recipe.';
    
    const cuisineHint = detectCuisine(title + ' ' + content);
    
    recipes.push({
      title,
      description,
      cookingTime,
      difficulty,
      cuisineHint,
      imageUrl: getRecipeImage(title, cuisineHint),
      fullContent: content
    });
  }
  
  return recipes;
};

// Detect cuisine from text
const detectCuisine = (text) => {
  const searchText = text.toLowerCase();
  if (searchText.match(/\b(indian|curry|masala|paneer|dal|tikka|biryani|naan|tandoor|chana|korma|vindaloo)\b/i)) return 'Indian';
  if (searchText.match(/\b(italian|pasta|risotto|pizza|parmesan|marinara|pesto|lasagna|penne|gnocchi|carbonara|alfredo|bruschetta)\b/i)) return 'Italian';
  if (searchText.match(/\b(mexican|taco|salsa|cilantro|burrito|enchilada|quesadilla|fajita|guacamole|nachos)\b/i)) return 'Mexican';
  if (searchText.match(/\b(chinese|wok|stir.?fry|soy sauce|dumpling|dim sum|szechuan|cantonese|lo mein|kung pao|orange chicken)\b/i)) return 'Chinese';
  if (searchText.match(/\b(japanese|miso|sushi|ramen|teriyaki|tempura|udon|sake|donburi|katsu)\b/i)) return 'Japanese';
  if (searchText.match(/\b(thai|coconut milk|lemongrass|fish sauce|pad thai|tom yum|basil|massaman|tom kha)\b/i)) return 'Thai';
  if (searchText.match(/\b(korean|gochujang|kimchi|sesame|bulgogi|bibimbap|korean bbq|japchae)\b/i)) return 'Korean';
  if (searchText.match(/\b(french|butter|wine|cream|provence|bistro|croissant|coq au vin|bourguignon)\b/i)) return 'French';
  if (searchText.match(/\b(mediterranean|olive oil|feta|hummus|falafel|greek|lebanese|pita|tabbouleh|moussaka)\b/i)) return 'Mediterranean';
  if (searchText.match(/\b(american|burger|bbq|southern|cajun)\b/i)) return 'American';
  return '';
};

// Check if message contains recipes
export const hasRecipes = (message) => {
  // Check for various recipe formats
  const hasTimeCategories = message.match(/###?\s*(Quick|Moderate|Elaborate)\s*Option/i);
  const hasBoldRecipes = message.includes('**') && message.match(/\b(ingredient|recipe|cook|prep|serve|meal|dish)\b/i);
  const hasRecipeStructure = message.match(/\*\*(Cooking Time|Difficulty|Ingredients|Instructions):?\*\*/i);
  // NEW: Check for numbered list format "1. **Recipe Name**"
  const hasNumberedRecipes = message.match(/^\d+\.\s*\*\*[^*]+\*\*/m);
  // NEW: Check for "**Recipe Name**" at start of line
  const hasBoldTitles = message.match(/^\*\*[A-Z][^*]+\*\*/m);
  
  return (hasTimeCategories || hasBoldRecipes || hasRecipeStructure || hasNumberedRecipes || hasBoldTitles) && message.length > 200;
};

// Clickable Recipe Card Component - Compact for 3-per-row grid
// Now with AUTO AI image generation for accurate dish-specific images
const RecipeCard = ({ recipe, onSave, onViewDetails }) => {
  const [imageUrl, setImageUrl] = useState(recipe.imageUrl);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  const hasTriedAI = useRef(false);

  // Auto-generate AI image on mount
  useEffect(() => {
    if (!recipe.title || hasTriedAI.current) return;
    
    const generateImage = async () => {
      hasTriedAI.current = true;
      
      // Check cache first
      const cacheKey = `${recipe.title}-${recipe.cuisineHint || ''}`.toLowerCase();
      if (aiImageCache.has(cacheKey)) {
        setImageUrl(aiImageCache.get(cacheKey));
        setIsAIGenerated(true);
        return;
      }
      
      setIsGenerating(true);
      try {
        const aiUrl = await generateAIImage(recipe.title, recipe.cuisineHint);
        if (aiUrl) {
          aiImageCache.set(cacheKey, aiUrl);
          setImageUrl(aiUrl);
          setIsAIGenerated(true);
        }
      } catch (err) {
        console.error('AI image generation failed:', err);
      } finally {
        setIsGenerating(false);
      }
    };
    
    // Stagger requests to avoid overwhelming the API
    const delay = Math.random() * 1500;
    const timer = setTimeout(generateImage, delay);
    return () => clearTimeout(timer);
  }, [recipe.title, recipe.cuisineHint]);

  const handleGenerateAI = useCallback(async (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (isGenerating) return;
    
    setIsGenerating(true);
    try {
      const aiUrl = await generateAIImage(recipe.title, recipe.cuisineHint);
      if (aiUrl) {
        const cacheKey = `${recipe.title}-${recipe.cuisineHint || ''}`.toLowerCase();
        aiImageCache.set(cacheKey, aiUrl);
        setImageUrl(aiUrl);
        setIsAIGenerated(true);
      }
    } catch (err) {
      console.error('AI generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [recipe.title, recipe.cuisineHint, isGenerating]);

  return (
    <div 
      className="recipe-visual-card group flex flex-col bg-card rounded-2xl border border-border/40 overflow-hidden hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-pointer h-full"
      onClick={() => onViewDetails({ ...recipe, imageUrl: imageUrl })}
      data-testid="recipe-visual-card"
    >
      {/* Recipe Image - Top */}
      <div className="w-full h-44 relative overflow-hidden">
        <img
          src={imageUrl}
          alt={recipe.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            e.target.src = GENERIC_FOOD_IMAGES[0];
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        
        {/* AI Generated Badge */}
        {isAIGenerated && !isGenerating && (
          <div className="absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg z-10">
            <Sparkles className="w-3 h-3" />
            <span>AI Generated</span>
          </div>
        )}
        
        {/* Loading Overlay - Shows while generating AI image */}
        {isGenerating && (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/80 to-blue-900/80 flex items-center justify-center z-20">
            <div className="text-center text-white">
              <div className="relative">
                <Sparkles className="w-8 h-8 animate-pulse mx-auto mb-2" />
                <RefreshCw className="w-4 h-4 animate-spin absolute -bottom-1 -right-1 text-purple-300" />
              </div>
              <p className="text-sm font-medium">Creating image...</p>
              <p className="text-xs text-purple-200 mt-1">AI-powered accuracy</p>
            </div>
          </div>
        )}
        
        {/* Regenerate AI Image Button - only show if AI already generated */}
        {isAIGenerated && !isGenerating && (
          <button
            onClick={handleGenerateAI}
            className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-800 text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg transition-all hover:scale-105 z-10 opacity-0 group-hover:opacity-100"
            title="Regenerate AI image"
          >
            <RefreshCw className="w-3 h-3 text-purple-600" />
            <span>New</span>
          </button>
        )}
        
        {/* View Recipe overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all duration-300">
          <span className="px-4 py-2 bg-white/95 rounded-full text-sm font-medium opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 flex items-center gap-2">
            Read More <ChevronRight size={16} />
          </span>
        </div>
      </div>
      
      {/* Recipe Content - Bottom */}
      <div className="flex-1 p-4 flex flex-col">
        {/* Title */}
        <h3 className="text-lg font-serif text-foreground leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {recipe.title}
        </h3>
        
        {/* Description */}
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2 flex-1">
          {recipe.description}
        </p>
        
        {/* Metadata */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Clock size={14} className="text-primary" />
            <span>{recipe.cookingTime || '30 min'}</span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${DIFFICULTY_COLORS[recipe.difficulty] || DIFFICULTY_COLORS['Medium']}`}>
            {recipe.difficulty}
          </span>
        </div>
        
        {/* Read More Button */}
        <Button
          size="sm"
          variant="outline"
          className="w-full rounded-full text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground group-hover:border-primary"
          onClick={(e) => {
            e.stopPropagation();
            // Pass the current imageUrl (which may be AI-generated) to the detail view
            onViewDetails({ ...recipe, imageUrl: imageUrl });
          }}
        >
          Read More <ChevronRight size={14} className="ml-1" />
        </Button>
      </div>
    </div>
  );
};

// Time Category Section - 3 cards per row grid
const TimeCategorySection = ({ category, categoryData, onSaveRecipe, onViewRecipe }) => {
  if (categoryData.recipes.length === 0) return null;
  
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{categoryData.icon}</span>
        <h3 className={`text-lg font-serif ${categoryData.color}`}>{categoryData.title}</h3>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary">
          {categoryData.recipes.length} {categoryData.recipes.length === 1 ? 'recipe' : 'recipes'}
        </span>
      </div>
      {/* 3-column grid for recipe cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoryData.recipes.map((recipe, idx) => (
          <RecipeCard 
            key={idx} 
            recipe={recipe} 
            onSave={onSaveRecipe}
            onViewDetails={onViewRecipe}
          />
        ))}
      </div>
    </div>
  );
};

// Main component
const RecipeMessageDisplay = ({ message, onSaveRecipe }) => {
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const categories = parseRecipesWithCategories(message);
  const hasAnyRecipes = Object.values(categories).some(cat => cat.recipes.length > 0);
  
  const handleViewRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setShowDetailModal(true);
  };
  
  const handleSaveRecipe = (recipe) => {
    onSaveRecipe && onSaveRecipe(recipe);
  };
  
  if (!hasAnyRecipes) {
    return <p className="whitespace-pre-wrap">{message}</p>;
  }
  
  // Get intro text (before first ### or **)
  const introMatch = message.match(/^([\s\S]*?)(?=###|\*\*)/);
  const introText = introMatch ? introMatch[1].trim() : '';
  
  return (
    <div className="recipe-visual-display space-y-6">
      {/* Intro text */}
      {introText && (
        <p className="text-foreground whitespace-pre-wrap mb-4">{introText}</p>
      )}
      
      {/* Recipe Categories */}
      <TimeCategorySection 
        category="quick" 
        categoryData={categories.quick} 
        onSaveRecipe={handleSaveRecipe}
        onViewRecipe={handleViewRecipe}
      />
      <TimeCategorySection 
        category="moderate" 
        categoryData={categories.moderate} 
        onSaveRecipe={handleSaveRecipe}
        onViewRecipe={handleViewRecipe}
      />
      <TimeCategorySection 
        category="elaborate" 
        categoryData={categories.elaborate} 
        onSaveRecipe={handleSaveRecipe}
        onViewRecipe={handleViewRecipe}
      />
      
      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onSave={handleSaveRecipe}
      />
    </div>
  );
};

export { RecipeMessageDisplay, RecipeCard, parseRecipesWithCategories, getRecipeImage };
export default RecipeMessageDisplay;
