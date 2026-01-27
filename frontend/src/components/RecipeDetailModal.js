import { useState } from 'react';
import { 
  Heart, Clock, ChefHat, Utensils, Users, Flame, Printer, 
  Share2, Star, ShoppingCart, BookOpen, X, ChevronRight,
  Timer, Leaf, AlertCircle, Check, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useShoppingCart } from '@/context/ShoppingCartContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ============================================================
// COMPREHENSIVE RECIPE DATABASE WITH SPECIFIC INSTRUCTIONS
// ============================================================

const DETAILED_RECIPES = {
  // ==================== ITALIAN RECIPES ====================
  'caprese quinoa salad': {
    servings: 4,
    prepTime: '10 min',
    cookTime: '15 min',
    totalTime: '25 min',
    equipment: ['Medium saucepan with lid', 'Fine-mesh strainer', 'Large mixing bowl', 'Small bowl for dressing'],
    ingredients: [
      { amount: '1 cup', item: 'quinoa, uncooked' },
      { amount: '2 cups', item: 'water' },
      { amount: '2 cups', item: 'cherry tomatoes, halved' },
      { amount: '8 oz', item: 'fresh mozzarella, torn into bite-sized pieces' },
      { amount: '½ cup', item: 'fresh basil leaves, roughly chopped' },
      { amount: '3 tbsp', item: 'extra virgin olive oil' },
      { amount: '2 tbsp', item: 'balsamic vinegar' },
      { amount: '2 cloves', item: 'garlic, minced' },
      { amount: '½ tsp', item: 'sea salt' },
      { amount: '¼ tsp', item: 'freshly ground black pepper' },
      { amount: '¼ cup', item: 'pine nuts, toasted (optional)' },
    ],
    instructions: [
      { step: 1, text: 'Rinse 1 cup of quinoa under cold running water in a fine-mesh strainer for 30 seconds, agitating with your fingers to remove the bitter saponin coating.', time: '2 min' },
      { step: 2, text: 'In a medium saucepan, combine the rinsed quinoa with 2 cups of water and a pinch of salt. Bring to a rolling boil over high heat.', time: '3-4 min' },
      { step: 3, text: 'Once boiling, reduce heat to low, cover with a tight-fitting lid, and simmer until all water is absorbed and quinoa is fluffy with visible spirals.', time: '15 min' },
      { step: 4, text: 'While quinoa cooks, halve 2 cups of cherry tomatoes lengthwise. Tear 8 oz of fresh mozzarella into irregular, bite-sized pieces for rustic texture.', time: '5 min' },
      { step: 5, text: 'Roughly chop ½ cup of fresh basil leaves. Stack leaves, roll tightly, and slice into ribbons (chiffonade) for best flavor release.', time: '2 min' },
      { step: 6, text: 'In a small bowl, whisk together 3 tbsp extra virgin olive oil, 2 tbsp balsamic vinegar, 2 minced garlic cloves, ½ tsp salt, and ¼ tsp black pepper until emulsified.', time: '2 min' },
      { step: 7, text: 'Once quinoa is done, remove from heat and let sit covered for 5 minutes. Then fluff with a fork, spreading on a sheet pan to cool faster.', time: '5 min' },
      { step: 8, text: 'In a large mixing bowl, combine the cooled quinoa, halved cherry tomatoes, torn mozzarella, and most of the basil (reserve some for garnish).', time: '2 min' },
      { step: 9, text: 'Pour the balsamic dressing over the salad and toss gently with two forks to combine without crushing the mozzarella.', time: '1 min' },
      { step: 10, text: 'Transfer to a serving platter, garnish with remaining basil and toasted pine nuts if using. Serve immediately or refrigerate for 30 minutes for flavors to meld.', time: '1 min' },
    ],
    nutrition: { calories: 385, protein: 16, carbs: 32, fat: 22, fiber: 4 },
    tips: [
      'Toast pine nuts in a dry skillet over medium heat for 2-3 minutes, shaking frequently until golden',
      'Use burrata instead of mozzarella for an extra creamy, luxurious version',
      'Add a drizzle of balsamic glaze just before serving for restaurant-quality presentation',
      'This salad tastes even better after 30 minutes in the fridge as flavors marry together'
    ],
    pairings: ['Crusty Italian bread', 'Grilled chicken breast', 'Pinot Grigio wine', 'Minestrone soup'],
    substitutions: [
      'No quinoa? Use Israeli couscous or farro instead',
      'Substitute balsamic with red wine vinegar and a touch of honey',
      'Cherry tomatoes can be swapped for diced Roma tomatoes'
    ],
    storage: 'Store in an airtight container in the refrigerator for up to 3 days. The basil may darken slightly but the salad remains delicious. Do not freeze.',
    dietaryTags: ['Vegetarian', 'Gluten-Free', 'High Protein'],
  },

  'spaghetti carbonara': {
    servings: 4,
    prepTime: '10 min',
    cookTime: '15 min',
    totalTime: '25 min',
    equipment: ['Large pot for pasta', 'Large skillet', 'Mixing bowl', 'Tongs', 'Cheese grater'],
    ingredients: [
      { amount: '1 lb', item: 'spaghetti' },
      { amount: '8 oz', item: 'guanciale or pancetta, cut into ½-inch cubes' },
      { amount: '4', item: 'large egg yolks' },
      { amount: '2', item: 'whole eggs' },
      { amount: '1 cup', item: 'Pecorino Romano, freshly grated' },
      { amount: '½ cup', item: 'Parmigiano-Reggiano, freshly grated' },
      { amount: '1 tbsp', item: 'freshly ground black pepper' },
      { amount: '1 tbsp', item: 'kosher salt (for pasta water)' },
      { amount: '½ cup', item: 'reserved pasta water' },
    ],
    instructions: [
      { step: 1, text: 'Bring 6 quarts of water to a rolling boil in a large pot. Add 1 tbsp kosher salt - the water should taste like the sea.', time: '8-10 min' },
      { step: 2, text: 'While water heats, cut 8 oz guanciale into ½-inch cubes. The fat should be cold for cleaner cuts.', time: '3 min' },
      { step: 3, text: 'In a mixing bowl, whisk together 4 egg yolks + 2 whole eggs, 1 cup Pecorino Romano, ½ cup Parmigiano-Reggiano, and 1 tbsp black pepper until smooth.', time: '3 min' },
      { step: 4, text: 'Add guanciale to a cold large skillet, then turn heat to medium. This renders the fat slowly without burning.', time: '1 min' },
      { step: 5, text: 'Cook guanciale, stirring occasionally, until fat is rendered and meat is crispy but still slightly chewy.', time: '8-10 min' },
      { step: 6, text: 'Add 1 lb spaghetti to boiling water. Cook for 1 minute less than package directions for al dente texture.', time: '9-10 min' },
      { step: 7, text: 'Reserve 1 cup of starchy pasta water before draining. This is your sauce insurance!', time: '30 sec' },
      { step: 8, text: 'Remove skillet from heat and let cool for 2 minutes - this prevents scrambling the eggs.', time: '2 min' },
      { step: 9, text: 'Add drained pasta directly to the skillet with guanciale. Toss to coat in rendered fat.', time: '1 min' },
      { step: 10, text: 'Pour egg mixture over pasta OFF THE HEAT. Toss vigorously with tongs for 2 minutes, adding pasta water tablespoon by tablespoon until silky.', time: '2-3 min' },
      { step: 11, text: 'Serve immediately in warmed bowls. Top with extra Pecorino and black pepper. The sauce will thicken as it cools.', time: '1 min' },
    ],
    nutrition: { calories: 680, protein: 28, carbs: 68, fat: 32, fiber: 3 },
    tips: [
      'NEVER add cream - authentic carbonara gets its creaminess from eggs and cheese only',
      'The pasta must be hot enough to cook the eggs but not so hot it scrambles them',
      'Guanciale (cured pork jowl) is traditional, but good-quality pancetta works too',
      'Grate your cheese fresh - pre-grated cheese contains anti-caking agents that prevent smooth sauce'
    ],
    pairings: ['Simple green salad', 'Garlic bread', 'Crisp white wine like Frascati', 'Fresh fruit for dessert'],
    substitutions: [
      'Pancetta or thick-cut bacon can replace guanciale',
      'Use all Parmigiano if Pecorino is unavailable (sauce will be milder)',
      'Rigatoni or bucatini work well instead of spaghetti'
    ],
    storage: 'Best eaten immediately. Carbonara does not reheat well as the sauce can break. If you must store, refrigerate up to 1 day and reheat very gently with added pasta water.',
    dietaryTags: ['High Protein', 'Contains Pork', 'Contains Eggs'],
  },

  'margherita pizza': {
    servings: 2,
    prepTime: '20 min',
    cookTime: '12 min',
    totalTime: '32 min',
    equipment: ['Pizza stone or baking sheet', 'Rolling pin', 'Pizza peel or cutting board', 'Stand mixer (optional)'],
    ingredients: [
      { amount: '1 lb', item: 'pizza dough (store-bought or homemade)' },
      { amount: '½ cup', item: 'San Marzano tomato sauce' },
      { amount: '8 oz', item: 'fresh mozzarella, sliced ¼-inch thick' },
      { amount: '½ cup', item: 'fresh basil leaves' },
      { amount: '2 tbsp', item: 'extra virgin olive oil' },
      { amount: '2 cloves', item: 'garlic, minced' },
      { amount: '½ tsp', item: 'sea salt' },
      { amount: '¼ tsp', item: 'dried oregano' },
      { amount: '', item: 'Semolina flour for dusting' },
    ],
    instructions: [
      { step: 1, text: 'Place pizza stone on the lowest oven rack and preheat to 500°F (or highest setting). Let stone heat for at least 30 minutes.', time: '30 min' },
      { step: 2, text: 'Remove pizza dough from refrigerator and let rest at room temperature for 20 minutes to relax the gluten.', time: '20 min' },
      { step: 3, text: 'In a small bowl, combine ½ cup tomato sauce with 2 minced garlic cloves, ¼ tsp oregano, and a pinch of salt. Stir well.', time: '2 min' },
      { step: 4, text: 'Slice 8 oz fresh mozzarella into ¼-inch thick rounds. Pat dry with paper towels to prevent a soggy pizza.', time: '3 min' },
      { step: 5, text: 'Dust work surface generously with semolina flour. Press dough into a disk, then stretch by hand into a 12-inch round, leaving edges slightly thicker for crust.', time: '5 min' },
      { step: 6, text: 'Transfer stretched dough to a semolina-dusted pizza peel or inverted baking sheet.', time: '1 min' },
      { step: 7, text: 'Spread tomato sauce evenly over dough, leaving a 1-inch border. Use the back of a spoon in circular motions.', time: '1 min' },
      { step: 8, text: 'Arrange mozzarella slices evenly over sauce. Drizzle with 1 tbsp olive oil and sprinkle with salt.', time: '2 min' },
      { step: 9, text: 'Slide pizza onto preheated stone with a quick jerking motion. Bake until crust is golden and cheese is bubbling with brown spots.', time: '10-12 min' },
      { step: 10, text: 'Remove pizza to cutting board. Immediately top with fresh basil leaves and drizzle remaining 1 tbsp olive oil.', time: '1 min' },
      { step: 11, text: 'Let rest 2 minutes before slicing into 6-8 pieces. The resting allows cheese to set slightly for cleaner cuts.', time: '2 min' },
    ],
    nutrition: { calories: 520, protein: 22, carbs: 58, fat: 24, fiber: 3 },
    tips: [
      'A screaming hot oven is the secret to pizzeria-quality pizza at home',
      'Don\'t overload toppings - less is more for authentic Margherita',
      'Add basil AFTER baking to preserve its bright color and fresh flavor',
      'If dough springs back when stretching, let it rest 5 more minutes'
    ],
    pairings: ['Arugula salad with lemon', 'Antipasto platter', 'Chianti wine', 'Gelato for dessert'],
    substitutions: [
      'Low-moisture mozzarella works if fresh is unavailable (use less)',
      'Crushed canned tomatoes can replace San Marzano sauce',
      'No pizza stone? Use an inverted cast iron skillet'
    ],
    storage: 'Best eaten immediately. Leftover pizza can be stored covered in the fridge for 2 days. Reheat in a skillet with lid for crispy bottom and melty cheese.',
    dietaryTags: ['Vegetarian', 'Contains Gluten', 'Contains Dairy'],
  },

  // ==================== INDIAN RECIPES ====================
  'butter chicken': {
    servings: 4,
    prepTime: '20 min',
    cookTime: '35 min',
    totalTime: '55 min',
    equipment: ['Large heavy-bottomed pot or Dutch oven', 'Blender or immersion blender', 'Large bowl for marinating'],
    ingredients: [
      { amount: '1.5 lbs', item: 'boneless chicken thighs, cut into 2-inch pieces' },
      { amount: '1 cup', item: 'full-fat plain yogurt' },
      { amount: '2 tbsp', item: 'lemon juice' },
      { amount: '2 tsp', item: 'garam masala, divided' },
      { amount: '1 tsp', item: 'turmeric powder' },
      { amount: '1 tsp', item: 'cumin powder' },
      { amount: '1 tsp', item: 'Kashmiri red chili powder' },
      { amount: '4 tbsp', item: 'unsalted butter, divided' },
      { amount: '1', item: 'large onion, finely diced' },
      { amount: '4 cloves', item: 'garlic, minced' },
      { amount: '2 inch', item: 'fresh ginger, grated' },
      { amount: '1 can', item: '14 oz crushed tomatoes' },
      { amount: '1 cup', item: 'heavy cream' },
      { amount: '2 tbsp', item: 'tomato paste' },
      { amount: '1 tsp', item: 'sugar' },
      { amount: '½ cup', item: 'fresh cilantro, chopped' },
      { amount: '', item: 'Salt to taste' },
    ],
    instructions: [
      { step: 1, text: 'In a large bowl, combine 1 cup yogurt, 2 tbsp lemon juice, 1 tsp garam masala, turmeric, cumin, and chili powder. Mix into a smooth marinade.', time: '3 min' },
      { step: 2, text: 'Add 1.5 lbs chicken pieces to marinade, coating thoroughly. Cover and refrigerate for at least 1 hour, or overnight for best results.', time: '1-24 hours' },
      { step: 3, text: 'Melt 2 tbsp butter in a large heavy pot over medium-high heat until foaming. Add marinated chicken in batches, searing until golden.', time: '8-10 min' },
      { step: 4, text: 'Remove chicken and set aside. The fond (brown bits) on the bottom will add flavor to the sauce.', time: '1 min' },
      { step: 5, text: 'Add remaining 2 tbsp butter to the same pot. Sauté diced onion until deeply golden and caramelized, stirring frequently.', time: '8-10 min' },
      { step: 6, text: 'Add 4 minced garlic cloves and 2 inches grated ginger. Stir constantly until very fragrant, about 1 minute.', time: '1 min' },
      { step: 7, text: 'Stir in 2 tbsp tomato paste and cook for 2 minutes until it darkens slightly, stirring constantly.', time: '2 min' },
      { step: 8, text: 'Add the can of crushed tomatoes and 1 tsp sugar. Simmer uncovered, stirring occasionally, until sauce thickens.', time: '10 min' },
      { step: 9, text: 'Using an immersion blender, blend sauce until smooth. Alternatively, carefully transfer to a blender and blend until silky.', time: '2 min' },
      { step: 10, text: 'Stir in 1 cup heavy cream and remaining 1 tsp garam masala. Return seared chicken to the pot.', time: '2 min' },
      { step: 11, text: 'Simmer gently on low heat until chicken is cooked through and sauce coats the back of a spoon.', time: '10-15 min' },
      { step: 12, text: 'Taste and adjust salt. Garnish with fresh cilantro. Serve hot over basmati rice with warm naan bread.', time: '2 min' },
    ],
    nutrition: { calories: 520, protein: 38, carbs: 16, fat: 36, fiber: 3 },
    tips: [
      'Marinating overnight makes the chicken incredibly tender and flavorful',
      'Kashmiri chili gives the signature red color without too much heat - don\'t substitute cayenne',
      'The sauce should be rich and velvety - if too thick, add a splash of water',
      'Finish with a pat of butter for restaurant-style richness (makhani means "with butter")'
    ],
    pairings: ['Basmati rice', 'Garlic naan bread', 'Cucumber raita', 'Mango lassi'],
    substitutions: [
      'Chicken breast works but thighs are juicier and more forgiving',
      'Coconut cream can replace heavy cream for dairy-free version',
      'Greek yogurt is thicker than regular - use slightly less for marinade'
    ],
    storage: 'Store in airtight container in refrigerator for up to 4 days. Reheat gently on stovetop, adding cream or water to loosen. Freezes well for up to 3 months.',
    dietaryTags: ['Gluten-Free', 'High Protein', 'Contains Dairy'],
  },

  'palak paneer': {
    servings: 4,
    prepTime: '15 min',
    cookTime: '25 min',
    totalTime: '40 min',
    equipment: ['Large pot for blanching', 'Blender', 'Large skillet or kadai', 'Slotted spoon', 'Ice bath bowl'],
    ingredients: [
      { amount: '1 lb', item: 'fresh spinach leaves, washed' },
      { amount: '14 oz', item: 'paneer, cut into 1-inch cubes' },
      { amount: '3 tbsp', item: 'ghee or vegetable oil, divided' },
      { amount: '1', item: 'large onion, roughly chopped' },
      { amount: '4 cloves', item: 'garlic, minced' },
      { amount: '1 inch', item: 'fresh ginger, grated' },
      { amount: '2', item: 'green chilies, slit lengthwise' },
      { amount: '1 tsp', item: 'cumin seeds' },
      { amount: '1 tsp', item: 'garam masala' },
      { amount: '½ tsp', item: 'turmeric powder' },
      { amount: '½ cup', item: 'heavy cream or cashew cream' },
      { amount: '1 tsp', item: 'kasuri methi (dried fenugreek leaves)' },
      { amount: '', item: 'Salt to taste' },
    ],
    instructions: [
      { step: 1, text: 'Bring a large pot of water to a rolling boil. Prepare a large bowl with ice water for shocking the spinach.', time: '5 min' },
      { step: 2, text: 'Blanch 1 lb spinach in boiling water for exactly 2 minutes until bright green and wilted. Don\'t overcook!', time: '2 min' },
      { step: 3, text: 'Immediately transfer spinach with a slotted spoon to ice bath to stop cooking and preserve the vibrant green color.', time: '2 min' },
      { step: 4, text: 'Squeeze excess water from cooled spinach and add to blender with chopped onion, garlic, and ginger. Blend to smooth puree.', time: '3 min' },
      { step: 5, text: 'Heat 2 tbsp ghee in a large skillet over medium-high heat. Add paneer cubes in a single layer.', time: '1 min' },
      { step: 6, text: 'Fry paneer until golden on all sides, turning gently. Remove to a plate - don\'t overcrowd the pan.', time: '5-6 min' },
      { step: 7, text: 'In the same skillet, add remaining 1 tbsp ghee. Add cumin seeds and let them sizzle until fragrant.', time: '30 sec' },
      { step: 8, text: 'Add slit green chilies and sauté for 30 seconds. Then add the spinach puree carefully (it may splatter).', time: '1 min' },
      { step: 9, text: 'Stir in turmeric and garam masala. Cook the puree on medium heat, stirring often, until it thickens and oil separates at edges.', time: '8-10 min' },
      { step: 10, text: 'Pour in ½ cup cream and crush kasuri methi between your palms directly into the pan. Stir well.', time: '2 min' },
      { step: 11, text: 'Gently fold in the fried paneer cubes. Simmer for 3-4 minutes so paneer absorbs the flavors.', time: '3-4 min' },
      { step: 12, text: 'Taste and adjust salt. Serve hot garnished with a swirl of cream and extra kasuri methi. Pair with roti or rice.', time: '1 min' },
    ],
    nutrition: { calories: 420, protein: 22, carbs: 14, fat: 32, fiber: 5 },
    tips: [
      'The ice bath is crucial - it stops cooking and keeps spinach bright green instead of army green',
      'Kasuri methi (dried fenugreek) is the secret ingredient that makes restaurant palak paneer taste special',
      'For extra rich flavor, fry paneer in ghee rather than oil',
      'Don\'t skip the step of cooking until oil separates - this removes the raw taste'
    ],
    pairings: ['Butter naan', 'Jeera rice', 'Raita', 'Mango pickle'],
    substitutions: [
      'Frozen spinach works in a pinch - thaw and squeeze dry before blending',
      'Firm tofu can replace paneer for vegan version (press dry first)',
      'Cashew cream makes an excellent dairy-free alternative'
    ],
    storage: 'Refrigerate in airtight container for up to 3 days. Color may darken slightly but flavor improves. Reheat gently with a splash of water or cream.',
    dietaryTags: ['Vegetarian', 'Gluten-Free', 'High Iron'],
  },

  // ==================== MEXICAN RECIPES ====================
  'tacos al pastor': {
    servings: 4,
    prepTime: '30 min',
    cookTime: '20 min',
    totalTime: '50 min',
    equipment: ['Blender', 'Large skillet or grill pan', 'Meat mallet or heavy pan for pressing', 'Tortilla warmer'],
    ingredients: [
      { amount: '2 lbs', item: 'boneless pork shoulder, sliced ¼-inch thick' },
      { amount: '4', item: 'dried guajillo chilies, stemmed and seeded' },
      { amount: '2', item: 'dried ancho chilies, stemmed and seeded' },
      { amount: '½ cup', item: 'pineapple juice' },
      { amount: '¼ cup', item: 'white vinegar' },
      { amount: '4 cloves', item: 'garlic' },
      { amount: '1 tsp', item: 'cumin' },
      { amount: '1 tsp', item: 'dried oregano' },
      { amount: '½ tsp', item: 'ground cloves' },
      { amount: '1 cup', item: 'fresh pineapple, diced small' },
      { amount: '12', item: 'small corn tortillas' },
      { amount: '½ cup', item: 'white onion, finely diced' },
      { amount: '½ cup', item: 'fresh cilantro, chopped' },
      { amount: '2', item: 'limes, cut into wedges' },
      { amount: '', item: 'Salsa verde for serving' },
    ],
    instructions: [
      { step: 1, text: 'Toast dried guajillo and ancho chilies in a dry skillet over medium heat for 2-3 minutes per side until fragrant and pliable. Don\'t burn!', time: '5 min' },
      { step: 2, text: 'Place toasted chilies in a bowl, cover with boiling water, and soak until softened and rehydrated.', time: '15 min' },
      { step: 3, text: 'Drain chilies and add to blender with pineapple juice, vinegar, garlic, cumin, oregano, cloves, and 1 tsp salt. Blend until completely smooth.', time: '3 min' },
      { step: 4, text: 'Slice 2 lbs pork shoulder against the grain into thin ¼-inch slices. Pound thicker pieces to even thickness.', time: '10 min' },
      { step: 5, text: 'Coat pork slices thoroughly in adobo marinade. Cover and marinate at least 2 hours, preferably overnight.', time: '2-24 hours' },
      { step: 6, text: 'Heat a large cast iron skillet or grill pan over high heat until smoking. You want intense heat for charred edges.', time: '5 min' },
      { step: 7, text: 'Cook marinated pork in batches, pressing down with spatula to ensure contact. Cook 3-4 minutes per side until charred.', time: '15-20 min' },
      { step: 8, text: 'Once all pork is cooked, chop into small pieces on a cutting board. Keep warm.', time: '3 min' },
      { step: 9, text: 'In the same hot pan, quickly char the diced pineapple until caramelized with dark spots.', time: '3 min' },
      { step: 10, text: 'Warm corn tortillas directly on the gas flame or in a dry pan until soft and slightly charred. Keep wrapped in a towel.', time: '5 min' },
      { step: 11, text: 'Assemble tacos: double-stack tortillas, add chopped pork, top with charred pineapple, diced onion, and fresh cilantro.', time: '5 min' },
      { step: 12, text: 'Serve immediately with lime wedges and salsa verde on the side. Squeeze lime juice over tacos just before eating.', time: '1 min' },
    ],
    nutrition: { calories: 480, protein: 35, carbs: 38, fat: 22, fiber: 5 },
    tips: [
      'Real al pastor is cooked on a vertical spit (trompo) - this skillet method replicates the charred edges',
      'Pork shoulder has the right fat content - don\'t use lean cuts or it will dry out',
      'The pineapple juice in the marinade helps tenderize the meat',
      'Char is flavor - don\'t be afraid of dark edges on the pork and pineapple'
    ],
    pairings: ['Mexican street corn (elote)', 'Refried beans', 'Horchata', 'Churros for dessert'],
    substitutions: [
      'Boneless chicken thighs work as an alternative protein',
      'Canned pineapple juice works if fresh isn\'t available',
      'Flour tortillas can substitute if corn isn\'t preferred'
    ],
    storage: 'Store cooked pork separately from toppings in refrigerator up to 3 days. Reheat pork in a hot skillet to restore char. Assemble fresh.',
    dietaryTags: ['Dairy-Free', 'High Protein', 'Contains Gluten (if flour tortillas)'],
  },

  // ==================== ASIAN RECIPES ====================
  'pad thai': {
    servings: 4,
    prepTime: '20 min',
    cookTime: '10 min',
    totalTime: '30 min',
    equipment: ['Large wok or 14-inch skillet', 'Small bowl for sauce', 'Tongs', 'Large bowl for soaking noodles'],
    ingredients: [
      { amount: '8 oz', item: 'flat rice noodles (pad thai noodles)' },
      { amount: '8 oz', item: 'large shrimp, peeled and deveined' },
      { amount: '8 oz', item: 'firm tofu, pressed and cubed' },
      { amount: '3 tbsp', item: 'tamarind paste' },
      { amount: '3 tbsp', item: 'fish sauce' },
      { amount: '2 tbsp', item: 'palm sugar or brown sugar' },
      { amount: '1 tbsp', item: 'rice vinegar' },
      { amount: '3 tbsp', item: 'vegetable oil, divided' },
      { amount: '4 cloves', item: 'garlic, minced' },
      { amount: '2', item: 'eggs, beaten' },
      { amount: '1 cup', item: 'bean sprouts' },
      { amount: '4', item: 'green onions, cut into 2-inch pieces' },
      { amount: '¼ cup', item: 'roasted peanuts, roughly chopped' },
      { amount: '1', item: 'lime, cut into wedges' },
      { amount: '¼ tsp', item: 'red pepper flakes (optional)' },
    ],
    instructions: [
      { step: 1, text: 'Soak 8 oz rice noodles in room temperature water for 30-40 minutes until pliable but still firm. They\'ll cook more in the wok.', time: '30-40 min' },
      { step: 2, text: 'Make the sauce: whisk together 3 tbsp tamarind paste, 3 tbsp fish sauce, 2 tbsp palm sugar, and 1 tbsp rice vinegar until sugar dissolves.', time: '3 min' },
      { step: 3, text: 'Heat wok over highest heat until smoking. Add 1 tbsp oil, swirl to coat. Add cubed tofu in single layer.', time: '2 min' },
      { step: 4, text: 'Fry tofu without stirring until golden and crispy on bottom, then flip. Remove when golden all over.', time: '4-5 min' },
      { step: 5, text: 'Add another 1 tbsp oil. Sear shrimp in single layer until pink and curled, about 1-2 minutes per side. Remove.', time: '3 min' },
      { step: 6, text: 'Add remaining 1 tbsp oil and 4 minced garlic cloves. Stir for 15 seconds until fragrant but not brown.', time: '30 sec' },
      { step: 7, text: 'Push garlic to side. Add beaten eggs to empty space. Let set slightly, then scramble into small curds.', time: '1 min' },
      { step: 8, text: 'Drain noodles and add to wok. Pour in sauce. Toss constantly with tongs, letting noodles absorb liquid.', time: '2-3 min' },
      { step: 9, text: 'Return tofu and shrimp to wok. Add half the bean sprouts and green onions. Toss to combine.', time: '1 min' },
      { step: 10, text: 'Transfer to plates. Top with remaining bean sprouts, chopped peanuts, red pepper flakes, and lime wedges.', time: '2 min' },
      { step: 11, text: 'Serve immediately - pad thai waits for no one! Squeeze lime juice over top just before eating.', time: '1 min' },
    ],
    nutrition: { calories: 520, protein: 28, carbs: 52, fat: 24, fiber: 4 },
    tips: [
      'Room temperature water for noodles prevents them from getting gummy - never use hot water',
      'A smoking hot wok is essential for "wok hei" (breath of the wok) flavor',
      'Work in batches to avoid overcrowding - a crowded wok steams instead of sears',
      'Traditional pad thai should be slightly sweet, sour, salty - taste and adjust sauce'
    ],
    pairings: ['Thai iced tea', 'Fresh spring rolls', 'Tom yum soup', 'Mango sticky rice'],
    substitutions: [
      'Chicken breast can replace shrimp (slice thin and cook first)',
      'Soy sauce can substitute fish sauce for vegetarian version',
      'Regular brown sugar works if palm sugar is unavailable'
    ],
    storage: 'Best eaten immediately. Noodles will soften if stored. If needed, refrigerate up to 1 day and reheat in hot wok with splash of water.',
    dietaryTags: ['Dairy-Free', 'Contains Shellfish', 'Contains Eggs'],
  },

  'chicken teriyaki': {
    servings: 4,
    prepTime: '10 min',
    cookTime: '20 min',
    totalTime: '30 min',
    equipment: ['Large skillet or grill pan', 'Small saucepan', 'Meat thermometer', 'Basting brush'],
    ingredients: [
      { amount: '4', item: 'boneless skinless chicken thighs (about 1.5 lbs)' },
      { amount: '½ cup', item: 'soy sauce' },
      { amount: '¼ cup', item: 'mirin (sweet rice wine)' },
      { amount: '¼ cup', item: 'sake or dry white wine' },
      { amount: '3 tbsp', item: 'honey or sugar' },
      { amount: '2 cloves', item: 'garlic, minced' },
      { amount: '1 inch', item: 'fresh ginger, grated' },
      { amount: '1 tbsp', item: 'cornstarch + 2 tbsp water (slurry)' },
      { amount: '2 tbsp', item: 'vegetable oil' },
      { amount: '2', item: 'green onions, thinly sliced' },
      { amount: '1 tbsp', item: 'sesame seeds' },
      { amount: '', item: 'Steamed rice for serving' },
    ],
    instructions: [
      { step: 1, text: 'Make teriyaki sauce: combine ½ cup soy sauce, ¼ cup mirin, ¼ cup sake, 3 tbsp honey, minced garlic, and grated ginger in a small saucepan.', time: '2 min' },
      { step: 2, text: 'Bring sauce to a boil over medium heat, then reduce to simmer. Cook until reduced by about one-third.', time: '8-10 min' },
      { step: 3, text: 'Mix cornstarch slurry (1 tbsp cornstarch + 2 tbsp water). Stir into simmering sauce. Cook until glossy and thickened.', time: '2 min' },
      { step: 4, text: 'Remove sauce from heat and set aside. You\'ll have about ½ cup of glossy teriyaki glaze.', time: '1 min' },
      { step: 5, text: 'Pat 4 chicken thighs completely dry with paper towels. Season both sides with a pinch of salt.', time: '2 min' },
      { step: 6, text: 'Heat 2 tbsp oil in a large skillet over medium-high heat until shimmering. Place chicken smooth-side down.', time: '2 min' },
      { step: 7, text: 'Cook without moving for 5-6 minutes until deep golden brown and releases easily from pan.', time: '5-6 min' },
      { step: 8, text: 'Flip chicken and cook another 5-6 minutes until internal temperature reaches 165°F.', time: '5-6 min' },
      { step: 9, text: 'Reduce heat to medium-low. Pour half the teriyaki sauce over chicken. Turn chicken to coat, letting sauce caramelize.', time: '2 min' },
      { step: 10, text: 'Transfer chicken to cutting board. Let rest 3 minutes, then slice against the grain into ½-inch strips.', time: '3 min' },
      { step: 11, text: 'Arrange sliced chicken over steamed rice. Drizzle with remaining sauce, scatter green onions and sesame seeds.', time: '2 min' },
    ],
    nutrition: { calories: 380, protein: 32, carbs: 24, fat: 18, fiber: 1 },
    tips: [
      'Chicken thighs stay juicier than breasts - they\'re more forgiving if slightly overcooked',
      'Real teriyaki is a glaze, not a drowning sauce - less is more',
      'The sauce will thicken more as it cools - it\'s ready when it coats a spoon',
      'Drying the chicken ensures a crispy, caramelized exterior instead of steaming'
    ],
    pairings: ['Steamed jasmine rice', 'Stir-fried vegetables', 'Miso soup', 'Edamame'],
    substitutions: [
      'Chicken breast works - pound to even thickness and watch carefully to avoid drying out',
      'Rice vinegar + sugar can substitute for mirin',
      'Maple syrup instead of honey for slightly different sweetness'
    ],
    storage: 'Refrigerate in airtight container for up to 4 days. Sauce may thicken - add splash of water when reheating. Reheat gently to avoid overcooking chicken.',
    dietaryTags: ['Dairy-Free', 'High Protein', 'Contains Soy'],
  },

  'ramen': {
    servings: 4,
    prepTime: '30 min',
    cookTime: '15 min',
    totalTime: '45 min',
    equipment: ['Large pot for broth', 'Medium pot for noodles', 'Small pot for eggs', 'Large soup bowls'],
    ingredients: [
      { amount: '8 cups', item: 'chicken stock (preferably homemade)' },
      { amount: '4', item: 'packages fresh ramen noodles (or 8 oz dried)' },
      { amount: '4', item: 'large eggs' },
      { amount: '½ lb', item: 'chashu pork belly, sliced (or substitute roasted pork)' },
      { amount: '4 tbsp', item: 'white miso paste' },
      { amount: '2 tbsp', item: 'soy sauce' },
      { amount: '1 tbsp', item: 'sesame oil' },
      { amount: '4 cloves', item: 'garlic, minced' },
      { amount: '2 inch', item: 'fresh ginger, sliced' },
      { amount: '4', item: 'green onions, sliced thin' },
      { amount: '2 cups', item: 'baby spinach or bok choy' },
      { amount: '1 sheet', item: 'nori seaweed, cut into strips' },
      { amount: '4 tbsp', item: 'corn kernels' },
      { amount: '', item: 'Chili oil and sesame seeds for topping' },
    ],
    instructions: [
      { step: 1, text: 'Prepare soft-boiled eggs: bring water to boil. Gently lower 4 eggs, cook exactly 6.5 minutes for jammy yolks.', time: '7 min' },
      { step: 2, text: 'Transfer eggs immediately to ice bath. Let cool 5 minutes, then peel carefully under running water.', time: '5 min' },
      { step: 3, text: 'Make tare (seasoning base): combine 4 tbsp miso paste, 2 tbsp soy sauce, and 1 tbsp sesame oil in a bowl.', time: '2 min' },
      { step: 4, text: 'In a large pot, sauté 4 minced garlic cloves and sliced ginger in 1 tbsp oil until fragrant.', time: '2 min' },
      { step: 5, text: 'Add 8 cups chicken stock. Bring to a gentle simmer - never a rolling boil or broth becomes cloudy.', time: '5 min' },
      { step: 6, text: 'Simmer broth for 10 minutes to infuse garlic and ginger flavor. Remove ginger slices.', time: '10 min' },
      { step: 7, text: 'In a separate pot, cook fresh ramen noodles according to package directions (usually 2-3 minutes). Don\'t overcook!', time: '2-3 min' },
      { step: 8, text: 'Wilt spinach or bok choy in simmering broth for 1 minute until just tender.', time: '1 min' },
      { step: 9, text: 'Divide tare among 4 large soup bowls. Ladle 2 cups hot broth into each bowl, stirring to dissolve tare.', time: '2 min' },
      { step: 10, text: 'Drain noodles and divide among bowls. Use chopsticks to lift and arrange noodles.', time: '1 min' },
      { step: 11, text: 'Slice soft-boiled eggs in half. Arrange egg halves, chashu pork slices, corn, green onions, and nori on top of each bowl.', time: '3 min' },
      { step: 12, text: 'Drizzle with chili oil and sprinkle sesame seeds. Serve immediately while piping hot. Slurp loudly!', time: '1 min' },
    ],
    nutrition: { calories: 580, protein: 32, carbs: 58, fat: 24, fiber: 4 },
    tips: [
      'The 6.5-minute egg is non-negotiable - it creates the perfect jammy yolk that makes ramen special',
      'Tare (seasoning) goes in the bowl first, not the pot - this keeps the broth clean for refills',
      'Fresh ramen noodles are vastly superior - check Asian grocery stores',
      'In Japan, slurping is encouraged - it cools the noodles and shows appreciation'
    ],
    pairings: ['Gyoza dumplings', 'Edamame', 'Japanese pickles', 'Cold sake or Japanese beer'],
    substitutions: [
      'Instant ramen noodles work if fresh aren\'t available (discard seasoning packet)',
      'Pork can be replaced with sliced chicken breast or tofu',
      'Vegetable broth + extra miso for vegetarian version'
    ],
    storage: 'Store components separately - broth, noodles, toppings. Noodles will absorb broth if stored together. Reheat broth and cook fresh noodles when serving.',
    dietaryTags: ['Contains Soy', 'Contains Eggs', 'Contains Gluten'],
  },
};

// Default template for recipes not in database
const createDefaultRecipe = (recipe) => {
  const title = recipe.title.toLowerCase();
  
  // Detect recipe type for more relevant defaults
  let category = 'general';
  if (title.includes('salad') || title.includes('bowl')) category = 'salad';
  else if (title.includes('curry') || title.includes('masala')) category = 'curry';
  else if (title.includes('pasta') || title.includes('spaghetti') || title.includes('noodle')) category = 'pasta';
  else if (title.includes('stir') || title.includes('fry')) category = 'stirfry';
  else if (title.includes('soup') || title.includes('stew')) category = 'soup';
  else if (title.includes('chicken') || title.includes('beef') || title.includes('pork') || title.includes('fish')) category = 'protein';
  else if (title.includes('rice') || title.includes('grain')) category = 'grain';
  
  const defaultIngredients = {
    salad: [
      { amount: '4 cups', item: 'mixed greens or main salad base' },
      { amount: '1 cup', item: 'cherry tomatoes, halved' },
      { amount: '½', item: 'cucumber, sliced' },
      { amount: '¼ cup', item: 'red onion, thinly sliced' },
      { amount: '½ cup', item: 'cheese of choice, crumbled' },
      { amount: '3 tbsp', item: 'olive oil' },
      { amount: '2 tbsp', item: 'vinegar or lemon juice' },
      { amount: '', item: 'Salt and pepper to taste' },
      { amount: '¼ cup', item: 'nuts or seeds for crunch' },
    ],
    curry: [
      { amount: '1.5 lbs', item: 'protein of choice, cubed' },
      { amount: '1 can', item: 'coconut milk (14 oz)' },
      { amount: '2 tbsp', item: 'curry paste or powder' },
      { amount: '1', item: 'large onion, diced' },
      { amount: '4 cloves', item: 'garlic, minced' },
      { amount: '1 inch', item: 'ginger, grated' },
      { amount: '2 cups', item: 'vegetables (bell peppers, spinach)' },
      { amount: '2 tbsp', item: 'vegetable oil' },
      { amount: '1 cup', item: 'broth or water' },
      { amount: '', item: 'Fresh cilantro for garnish' },
    ],
    pasta: [
      { amount: '1 lb', item: 'pasta of choice' },
      { amount: '2 tbsp', item: 'olive oil' },
      { amount: '4 cloves', item: 'garlic, minced' },
      { amount: '1 can', item: 'crushed tomatoes or cream sauce base' },
      { amount: '½ cup', item: 'parmesan cheese, grated' },
      { amount: '¼ cup', item: 'fresh basil or herbs' },
      { amount: '', item: 'Salt and pepper to taste' },
      { amount: '½ cup', item: 'reserved pasta water' },
    ],
    general: [
      { amount: '1.5 lbs', item: 'main protein or vegetable' },
      { amount: '2 tbsp', item: 'cooking oil' },
      { amount: '1', item: 'onion, diced' },
      { amount: '4 cloves', item: 'garlic, minced' },
      { amount: '1 cup', item: 'sauce, broth, or liquid' },
      { amount: '2 cups', item: 'vegetables or grains' },
      { amount: '', item: 'Herbs and spices appropriate to cuisine' },
      { amount: '', item: 'Salt and pepper to taste' },
    ],
  };

  const defaultInstructions = {
    salad: [
      { step: 1, text: `Wash and dry 4 cups of greens thoroughly. Spin in a salad spinner or pat dry with clean towels for crisp texture.`, time: '3 min' },
      { step: 2, text: 'Prepare all vegetables: halve cherry tomatoes, slice cucumber into half-moons, thinly slice red onion.', time: '5 min' },
      { step: 3, text: 'Make the dressing: whisk together 3 tbsp olive oil, 2 tbsp vinegar, a pinch of salt, and pepper until emulsified.', time: '2 min' },
      { step: 4, text: 'In a large bowl, combine greens with prepared vegetables. Toss gently to distribute evenly.', time: '1 min' },
      { step: 5, text: 'Drizzle dressing over salad and toss to coat every leaf lightly. Don\'t overdress!', time: '1 min' },
      { step: 6, text: 'Top with crumbled cheese and toasted nuts. Season with additional salt and pepper if needed.', time: '2 min' },
      { step: 7, text: 'Serve immediately on chilled plates for the crispest texture.', time: '1 min' },
    ],
    curry: [
      { step: 1, text: 'Cut 1.5 lbs protein into even 1-inch cubes for consistent cooking. Pat dry with paper towels.', time: '5 min' },
      { step: 2, text: 'Heat 2 tbsp oil in a large heavy-bottomed pot over medium-high heat until shimmering.', time: '2 min' },
      { step: 3, text: 'Sear protein in batches until golden brown on all sides. Don\'t overcrowd. Remove and set aside.', time: '8 min' },
      { step: 4, text: 'In the same pot, sauté diced onion until deeply golden and caramelized, about 8 minutes.', time: '8 min' },
      { step: 5, text: 'Add garlic and ginger, cook for 1 minute until very fragrant, stirring constantly.', time: '1 min' },
      { step: 6, text: 'Stir in curry paste/powder and cook for 1 minute to bloom the spices.', time: '1 min' },
      { step: 7, text: 'Pour in coconut milk and broth. Bring to a simmer, scraping up any browned bits.', time: '3 min' },
      { step: 8, text: 'Return protein to pot. Add vegetables. Simmer until protein is cooked through.', time: '15 min' },
      { step: 9, text: 'Taste and adjust seasoning. Garnish with fresh cilantro and serve over rice.', time: '2 min' },
    ],
    pasta: [
      { step: 1, text: 'Bring 6 quarts of water to a rolling boil. Add 2 tbsp salt - it should taste like the sea.', time: '10 min' },
      { step: 2, text: 'While water heats, mince 4 garlic cloves and prepare your sauce ingredients.', time: '3 min' },
      { step: 3, text: 'Cook 1 lb pasta according to package directions minus 1 minute for al dente.', time: '8-10 min' },
      { step: 4, text: 'Reserve 1 cup pasta water before draining - this starchy liquid helps bind the sauce.', time: '30 sec' },
      { step: 5, text: 'In a large skillet, heat olive oil over medium heat. Add garlic and cook until golden but not brown.', time: '2 min' },
      { step: 6, text: 'Add your sauce base. Simmer until slightly thickened and flavors meld.', time: '5 min' },
      { step: 7, text: 'Add drained pasta directly to sauce. Toss to coat, adding pasta water to achieve silky consistency.', time: '2 min' },
      { step: 8, text: 'Remove from heat. Stir in grated parmesan and fresh herbs.', time: '1 min' },
      { step: 9, text: 'Serve immediately in warmed bowls with extra cheese on top.', time: '1 min' },
    ],
    general: [
      { step: 1, text: 'Prepare all ingredients before cooking (mise en place): dice, mince, measure everything.', time: '10 min' },
      { step: 2, text: 'Heat cooking oil in a large pan over medium-high heat until shimmering.', time: '2 min' },
      { step: 3, text: 'If using protein, cook first until golden and almost done. Remove and set aside.', time: '6-8 min' },
      { step: 4, text: 'Sauté aromatics (onion, garlic) until fragrant and softened.', time: '4 min' },
      { step: 5, text: 'Add spices and cook for 1 minute to bloom flavors.', time: '1 min' },
      { step: 6, text: 'Add liquid and vegetables. Bring to a simmer.', time: '5 min' },
      { step: 7, text: 'Return protein if applicable. Cook until everything is done.', time: '10 min' },
      { step: 8, text: 'Taste and adjust seasoning. Garnish appropriately and serve.', time: '2 min' },
    ],
  };

  return {
    servings: 4,
    prepTime: '15 min',
    cookTime: recipe.cookingTime || '30 min',
    totalTime: recipe.cookingTime || '45 min',
    equipment: ['Large skillet or pot', 'Cutting board', 'Chef\'s knife', 'Measuring cups and spoons'],
    ingredients: defaultIngredients[category] || defaultIngredients.general,
    instructions: defaultInstructions[category] || defaultInstructions.general,
    nutrition: { calories: 350, protein: 20, carbs: 30, fat: 15, fiber: 5 },
    tips: [
      'Taste as you cook and adjust seasoning throughout the process',
      'Prep all ingredients before you start cooking for smoother execution',
      'Use fresh, high-quality ingredients for the best results',
      'Don\'t rush - proper cooking times ensure the best flavors and textures'
    ],
    pairings: ['Fresh salad', 'Crusty bread', 'Your favorite beverage', 'Light dessert'],
    substitutions: [
      'Adjust protein or vegetables based on dietary preferences',
      'Swap dairy for plant-based alternatives if needed',
      'Adjust spice levels to your taste'
    ],
    storage: 'Store in an airtight container in the refrigerator for up to 3-4 days. Reheat gently on stovetop or in microwave.',
    dietaryTags: getDietaryTags(recipe),
  };
};

// Get dietary tags based on recipe
const getDietaryTags = (recipe) => {
  const tags = [];
  const text = (recipe.title + ' ' + (recipe.description || '')).toLowerCase();
  
  if (!text.match(/chicken|beef|pork|fish|shrimp|meat|bacon/)) {
    if (!text.match(/egg|cheese|cream|butter|milk|yogurt/)) {
      tags.push('Vegan-Friendly');
    }
    tags.push('Vegetarian');
  }
  if (!text.match(/wheat|bread|pasta|flour|gluten/)) {
    tags.push('Gluten-Free Option');
  }
  if (!text.match(/cheese|cream|butter|milk|yogurt|dairy/)) {
    tags.push('Dairy-Free');
  }
  if (text.match(/protein|chicken|beef|fish|tofu|beans/)) {
    tags.push('High Protein');
  }
  
  return tags.slice(0, 4);
};

// Generate detailed recipe - check database first, then create default
const generateDetailedRecipe = (recipe) => {
  if (!recipe) return null;
  
  const titleKey = recipe.title.toLowerCase().trim();
  
  // Check if we have this exact recipe in database
  if (DETAILED_RECIPES[titleKey]) {
    return {
      ...recipe,
      ...DETAILED_RECIPES[titleKey],
    };
  }
  
  // Check for partial matches
  for (const [key, details] of Object.entries(DETAILED_RECIPES)) {
    if (titleKey.includes(key) || key.includes(titleKey)) {
      return {
        ...recipe,
        ...details,
      };
    }
  }
  
  // Create a default recipe based on type
  return {
    ...recipe,
    ...createDefaultRecipe(recipe),
  };
};

// Star Rating Component
const StarRating = ({ rating, onRate }) => {
  const [hover, setHover] = useState(0);
  
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onRate && onRate(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={`transition-colors ${onRate ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
        >
          <Star
            size={24}
            className={`transition-all ${
              star <= (hover || rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

// Recipe Detail Modal Component
const RecipeDetailModal = ({ recipe, isOpen, onClose, onSave, onAddToShoppingList }) => {
  const [userRating, setUserRating] = useState(0);
  const [servings, setServings] = useState(4);
  const [checkedSteps, setCheckedSteps] = useState({});
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [addedIngredients, setAddedIngredients] = useState({});
  
  // Shopping cart hook - wrapped in try/catch for safety
  let shoppingCart = null;
  try {
    shoppingCart = useShoppingCart();
  } catch (e) {
    // Shopping cart not available in this context
  }
  
  const detailedRecipe = recipe ? generateDetailedRecipe(recipe) : null;
  
  const handlePrint = () => {
    window.print();
    toast.success('Print dialog opened');
  };
  
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: recipe.title,
          text: `Check out this recipe: ${recipe.title}`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(`${recipe.title} - ${window.location.href}`);
      toast.success('Recipe link copied to clipboard!');
    }
  };
  
  // Add single ingredient to cart
  const handleAddIngredient = (ingredient, index) => {
    if (shoppingCart) {
      shoppingCart.addToCart(ingredient, recipe.title);
      setAddedIngredients(prev => ({ ...prev, [index]: true }));
    } else {
      toast.error('Shopping cart not available');
    }
  };
  
  // Add all ingredients to cart
  const handleAddAllToCart = () => {
    if (shoppingCart && detailedRecipe?.ingredients) {
      shoppingCart.addAllToCart(detailedRecipe.ingredients, recipe.title);
      // Mark all as added
      const allAdded = {};
      detailedRecipe.ingredients.forEach((_, idx) => {
        allAdded[idx] = true;
      });
      setAddedIngredients(allAdded);
    } else {
      toast.error('Shopping cart not available');
    }
  };
  
  // Legacy function for API-based shopping list
  const handleAddToShoppingList = async () => {
    handleAddAllToCart();
  };
  
  const handleRate = (rating) => {
    setUserRating(rating);
    toast.success(`Rated ${recipe.title} ${rating} stars!`);
  };
  
  // Scale ingredient amounts
  const scaleAmount = (amount, baseServings = 4) => {
    if (!amount) return '';
    const match = amount.match(/^([\d.\/]+)/);
    if (!match) return amount;
    
    let num;
    if (match[1].includes('/')) {
      const [numerator, denominator] = match[1].split('/');
      num = parseInt(numerator) / parseInt(denominator);
    } else {
      num = parseFloat(match[1]);
    }
    
    const scaled = (num * servings / baseServings);
    const scaledStr = scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1).replace(/\.0$/, '');
    return amount.replace(match[1], scaledStr);
  };

  if (!recipe || !detailedRecipe) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0" data-testid="recipe-detail-modal">
        <DialogHeader className="sr-only">
          <DialogTitle>{recipe.title}</DialogTitle>
          <DialogDescription>Full recipe details for {recipe.title}</DialogDescription>
        </DialogHeader>
        
        {/* Hero Section */}
        <div className="relative h-72 md:h-96 overflow-hidden">
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X size={20} />
          </button>
          
          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <p className="text-sm uppercase tracking-wider mb-2 text-white/80">Recipe Name</p>
            <h1 className="text-3xl md:text-4xl font-serif mb-3">{recipe.title}</h1>
            <div className="flex flex-wrap gap-2">
              {detailedRecipe.dietaryTags?.map((tag, idx) => (
                <span key={idx} className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {/* Quick Info Bar */}
          <div className="flex flex-wrap gap-6 mb-6 pb-6 border-b">
            <div className="flex items-center gap-2">
              <Timer size={20} className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Prep Time</p>
                <p className="font-semibold">{detailedRecipe.prepTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={20} className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Cook Time</p>
                <p className="font-semibold">{detailedRecipe.cookTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Flame size={20} className="text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Time</p>
                <p className="font-semibold">{detailedRecipe.totalTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users size={20} className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Servings</p>
                <select 
                  value={servings} 
                  onChange={(e) => setServings(Number(e.target.value))}
                  className="font-semibold bg-transparent border rounded px-2 py-0.5 cursor-pointer"
                >
                  {[2, 4, 6, 8].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ChefHat size={20} className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Difficulty</p>
                <p className="font-semibold">{recipe.difficulty}</p>
              </div>
            </div>
            {recipe.cuisineHint && (
              <div className="flex items-center gap-2">
                <Utensils size={20} className="text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Cuisine</p>
                  <p className="font-semibold capitalize">{recipe.cuisineHint}</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-8">
            <Button onClick={() => onSave && onSave(recipe)} className="rounded-full">
              <Heart size={16} className="mr-2" />
              Save Recipe
            </Button>
            <Button variant="outline" onClick={handleAddToShoppingList} className="rounded-full">
              <ShoppingCart size={16} className="mr-2" />
              Add to Shopping List
            </Button>
            <Button variant="outline" onClick={handleShare} className="rounded-full">
              <Share2 size={16} className="mr-2" />
              Share
            </Button>
            <Button variant="outline" onClick={handlePrint} className="rounded-full">
              <Printer size={16} className="mr-2" />
              Print
            </Button>
          </div>
          
          {/* Description */}
          {recipe.description && (
            <p className="text-muted-foreground mb-8 text-lg leading-relaxed">{recipe.description}</p>
          )}
          
          {/* Equipment */}
          {detailedRecipe.equipment && (
            <div className="mb-8 p-4 bg-secondary/30 rounded-xl">
              <h3 className="font-semibold mb-2">Equipment Needed</h3>
              <p className="text-sm text-muted-foreground">{detailedRecipe.equipment.join(' • ')}</p>
            </div>
          )}
          
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Ingredients */}
            <div>
              <h2 className="text-xl font-serif mb-4 flex items-center gap-2">
                <Leaf size={22} className="text-green-600" />
                Ingredients
                <span className="text-sm font-normal text-muted-foreground">(for {servings} servings)</span>
              </h2>
              <ul className="space-y-2">
                {detailedRecipe.ingredients.map((ing, idx) => (
                  <li 
                    key={idx} 
                    className={`flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer ${
                      checkedIngredients[idx] ? 'bg-green-50 line-through text-muted-foreground' : 'hover:bg-secondary/30'
                    }`}
                    onClick={() => setCheckedIngredients(prev => ({ ...prev, [idx]: !prev[idx] }))}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      checkedIngredients[idx] ? 'bg-green-500 border-green-500' : 'border-gray-300'
                    }`}>
                      {checkedIngredients[idx] && <Check size={14} className="text-white" />}
                    </div>
                    <span>
                      <strong className="text-primary">{scaleAmount(ing.amount, detailedRecipe.servings)}</strong> {ing.item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Nutrition */}
            <div>
              <h2 className="text-xl font-serif mb-4 flex items-center gap-2">
                <Flame size={22} className="text-orange-500" />
                Nutrition
                <span className="text-sm font-normal text-muted-foreground">(per serving)</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(detailedRecipe.nutrition).map(([key, value]) => (
                  <div key={key} className="bg-secondary/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-primary">{value}{key === 'calories' ? '' : 'g'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{key}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Step-by-Step Instructions */}
          <div className="mb-8">
            <h2 className="text-xl font-serif mb-6 flex items-center gap-2">
              <BookOpen size={22} className="text-blue-600" />
              Step-by-Step Instructions
            </h2>
            <ol className="space-y-4">
              {detailedRecipe.instructions.map((inst, idx) => (
                <li 
                  key={idx} 
                  className={`flex gap-4 p-4 rounded-xl transition-all cursor-pointer ${
                    checkedSteps[idx] ? 'bg-green-50/50 opacity-60' : 'bg-secondary/20 hover:bg-secondary/30'
                  }`}
                  onClick={() => setCheckedSteps(prev => ({ ...prev, [idx]: !prev[idx] }))}
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                    checkedSteps[idx] ? 'bg-green-500 text-white' : 'bg-primary/10 text-primary'
                  }`}>
                    {checkedSteps[idx] ? <Check size={20} /> : inst.step}
                  </div>
                  <div className="flex-1">
                    <p className={`text-base leading-relaxed ${checkedSteps[idx] ? 'line-through' : ''}`}>{inst.text}</p>
                    {inst.time && (
                      <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
                        <Clock size={14} className="text-primary" /> {inst.time}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
          
          {/* Chef's Tips */}
          <div className="mb-8 p-5 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <h2 className="text-lg font-serif mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-amber-600" />
              Chef's Tips & Pro Tricks
            </h2>
            <ul className="space-y-3">
              {detailedRecipe.tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <ChevronRight size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm leading-relaxed">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Pairings */}
            <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
              <h2 className="text-lg font-serif mb-3">Perfect Pairings</h2>
              <div className="flex flex-wrap gap-2">
                {detailedRecipe.pairings.map((pairing, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-white/60 rounded-full text-sm">
                    {pairing}
                  </span>
                ))}
              </div>
            </div>
            
            {/* Substitutions */}
            <div className="p-4 bg-teal-500/10 rounded-xl border border-teal-500/20">
              <h2 className="text-lg font-serif mb-3">Substitution Options</h2>
              <ul className="space-y-2">
                {detailedRecipe.substitutions.map((sub, idx) => (
                  <li key={idx} className="text-sm flex items-start gap-2">
                    <span className="text-teal-600">•</span>
                    {sub}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Storage */}
          <div className="mb-8 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <h2 className="text-lg font-serif mb-2">Storage & Reheating Instructions</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{detailedRecipe.storage}</p>
          </div>
          
          {/* Rating */}
          <div className="pt-6 border-t text-center">
            <h2 className="text-lg font-serif mb-4">Rate This Recipe</h2>
            <div className="flex justify-center mb-3">
              <StarRating rating={userRating} onRate={handleRate} />
            </div>
            <p className="text-sm text-muted-foreground">
              {userRating > 0 ? `You rated this ${userRating} stars - thank you!` : 'Click the stars to rate'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecipeDetailModal;
export { generateDetailedRecipe, StarRating, DETAILED_RECIPES };
