"""
Recipe Text Preparation Service
Converts recipe data into natural, speakable text
Handles multiple languages with proper formatting
"""
import re
from typing import Dict, List, Optional


class RecipeTextPrepService:
    """Prepares recipe text for text-to-speech conversion"""
    
    # Number words for different languages (1-20)
    NUMBER_WORDS = {
        'en': ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 
               'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
               'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'],
        'hi': ['शून्य', 'एक', 'दो', 'तीन', 'चार', 'पांच', 'छह', 'सात', 
               'आठ', 'नौ', 'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह',
               'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस', 'बीस'],
        'es': ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete',
               'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce',
               'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte'],
    }
    
    # Step labels in different languages
    STEP_LABELS = {
        'en': lambda n, t: f"Step {n} of {t}.",
        'hi': lambda n, t: f"चरण {n}, कुल {t} में से।",
        'es': lambda n, t: f"Paso {n} de {t}.",
        'fr': lambda n, t: f"Étape {n} sur {t}.",
        'de': lambda n, t: f"Schritt {n} von {t}.",
        'it': lambda n, t: f"Passo {n} di {t}.",
        'ja': lambda n, t: f"ステップ {n}、全 {t} ステップ中。",
        'zh': lambda n, t: f"第 {n} 步，共 {t} 步。",
        'ar': lambda n, t: f"الخطوة {n} من {t}.",
        'pt': lambda n, t: f"Passo {n} de {t}.",
        'ko': lambda n, t: f"{n}단계, 총 {t}단계 중."
    }
    
    # Introduction templates
    INTRO_TEMPLATES = {
        'en': "Welcome to {name}. This is a {cuisine} dish that takes about {time} minutes to prepare. It serves {servings} people.",
        'hi': "{name} में आपका स्वागत है। यह एक {cuisine} व्यंजन है जिसे तैयार करने में लगभग {time} मिनट लगते हैं।",
        'es': "Bienvenidos a {name}. Este es un plato {cuisine} que tarda unos {time} minutos en prepararse.",
        'fr': "Bienvenue dans la recette de {name}. C'est un plat {cuisine} qui prend environ {time} minutes.",
        'de': "Willkommen bei {name}. Dies ist ein {cuisine} Gericht, das etwa {time} Minuten Zubereitungszeit benötigt.",
        'it': "Benvenuti in {name}. Questo è un piatto {cuisine} che richiede circa {time} minuti.",
        'ja': "{name}へようこそ。これは{cuisine}料理で、約{time}分で作れます。",
        'zh': "欢迎来到{name}的食谱。这是一道{cuisine}菜，大约需要{time}分钟。",
        'ar': "مرحباً بكم في وصفة {name}. هذه وصفة {cuisine} تستغرق حوالي {time} دقيقة.",
        'pt': "Bem-vindos à receita de {name}. Este é um prato {cuisine} que leva cerca de {time} minutos.",
        'ko': "{name} 레시피에 오신 것을 환영합니다. 이것은 약 {time}분이 걸리는 {cuisine} 요리입니다."
    }
    
    # Ingredients header
    INGREDIENTS_HEADERS = {
        'en': "Here are the ingredients you will need.",
        'hi': "यहाँ वे सामग्रियाँ हैं जिनकी आपको आवश्यकता होगी।",
        'es': "Aquí están los ingredientes que necesitarás.",
        'fr': "Voici les ingrédients dont vous aurez besoin.",
        'de': "Hier sind die Zutaten, die Sie benötigen.",
        'it': "Ecco gli ingredienti di cui avrai bisogno.",
        'ja': "必要な材料はこちらです。",
        'zh': "以下是您需要的食材。",
        'ar': "إليك المكونات التي ستحتاجها.",
        'pt': "Aqui estão os ingredientes de que você vai precisar.",
        'ko': "필요한 재료는 다음과 같습니다."
    }
    
    # Instructions header
    INSTRUCTIONS_HEADERS = {
        'en': "Now let's start cooking.",
        'hi': "अब चलिए खाना पकाना शुरू करते हैं।",
        'es': "Ahora empecemos a cocinar.",
        'fr': "Maintenant, commençons à cuisiner.",
        'de': "Jetzt fangen wir an zu kochen.",
        'it': "Ora iniziamo a cucinare.",
        'ja': "それでは料理を始めましょう。",
        'zh': "现在让我们开始烹饪。",
        'ar': "الآن لنبدأ الطهي.",
        'pt': "Agora vamos começar a cozinhar.",
        'ko': "이제 요리를 시작해 봅시다."
    }
    
    # Tips header
    TIPS_HEADERS = {
        'en': "Here are some helpful tips.",
        'hi': "यहाँ कुछ उपयोगी सुझाव हैं।",
        'es': "Aquí hay algunos consejos útiles.",
        'fr': "Voici quelques conseils utiles.",
        'de': "Hier sind einige hilfreiche Tipps.",
        'it': "Ecco alcuni suggerimenti utili.",
        'ja': "役立つヒントをご紹介します。",
        'zh': "这里有一些有用的提示。",
        'ar': "إليك بعض النصائح المفيدة.",
        'pt': "Aqui estão algumas dicas úteis.",
        'ko': "유용한 팁을 알려드리겠습니다."
    }
    
    def prepare_recipe_for_speech(self, recipe: Dict, language: str = 'en') -> str:
        """
        Convert recipe object to speakable text
        Handles numbers written out, removes special characters
        """
        sections = []
        
        # 1. Introduction
        sections.append(self._build_intro(recipe, language))
        
        # 2. Ingredients
        ingredients = recipe.get('ingredients', [])
        if ingredients:
            sections.append(self._build_ingredients_list(ingredients, language))
        
        # 3. Instructions
        instructions = recipe.get('instructions', [])
        if not instructions:
            # Try alternative key names
            instructions = recipe.get('steps', []) or recipe.get('directions', [])
        if instructions:
            sections.append(self._build_instructions(instructions, language))
        
        # 4. Tips
        tips = recipe.get('tips', [])
        if tips:
            sections.append(self._build_tips(tips, language))
        
        return '\n\n'.join(sections)
    
    def prepare_step_for_speech(self, step_number: int, step_text: str, 
                                 total_steps: int, language: str = 'en') -> str:
        """
        Prepare just one instruction step for real-time cooking mode
        """
        label_func = self.STEP_LABELS.get(language, self.STEP_LABELS['en'])
        label = label_func(step_number, total_steps)
        
        clean_step = self.clean_text_for_speech(step_text)
        
        return f"{label} {clean_step}"
    
    def clean_text_for_speech(self, text: str) -> str:
        """
        Clean text for TTS - write out numbers, remove special characters
        ElevenLabs recommends this to avoid pronunciation errors
        """
        if not text:
            return ''
        
        cleaned = text
        
        # Write out common fractions
        cleaned = re.sub(r'1/2', 'one half', cleaned)
        cleaned = re.sub(r'1/4', 'one quarter', cleaned)
        cleaned = re.sub(r'3/4', 'three quarters', cleaned)
        cleaned = re.sub(r'1/3', 'one third', cleaned)
        cleaned = re.sub(r'2/3', 'two thirds', cleaned)
        
        # Write out measurements
        cleaned = re.sub(r'(\d+)\s*°C', r'\1 degrees Celsius', cleaned)
        cleaned = re.sub(r'(\d+)\s*°F', r'\1 degrees Fahrenheit', cleaned)
        cleaned = re.sub(r'(\d+)\s*ml', r'\1 millilitres', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'(\d+)\s*g\b', r'\1 grams', cleaned)
        cleaned = re.sub(r'(\d+)\s*kg', r'\1 kilograms', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'(\d+)\s*tsp', r'\1 teaspoons', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'(\d+)\s*tbsp', r'\1 tablespoons', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'(\d+)\s*min(utes?)?\b', r'\1 minutes', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'(\d+)\s*hr(s|ours?)?\b', r'\1 hours', cleaned, flags=re.IGNORECASE)
        
        # Remove special characters that break speech
        cleaned = re.sub(r'[*_~`#]', '', cleaned)
        cleaned = re.sub(r'[\[\]]', '', cleaned)
        cleaned = re.sub(r'[()]', ', ', cleaned)
        
        # Clean up multiple spaces
        cleaned = re.sub(r'\s+', ' ', cleaned)
        
        return cleaned.strip()
    
    def _build_intro(self, recipe: Dict, language: str) -> str:
        """Build introduction section"""
        template = self.INTRO_TEMPLATES.get(language, self.INTRO_TEMPLATES['en'])
        
        name = recipe.get('name', recipe.get('title', 'this recipe'))
        cuisine = recipe.get('cuisine', 'delicious')
        total_time = recipe.get('totalTime', recipe.get('total_time', recipe.get('cookTime', '30')))
        servings = recipe.get('servings', '4')
        
        return template.format(
            name=name,
            cuisine=cuisine,
            time=total_time,
            servings=servings
        )
    
    def _build_ingredients_list(self, ingredients: List, language: str) -> str:
        """Build ingredients section"""
        header = self.INGREDIENTS_HEADERS.get(language, self.INGREDIENTS_HEADERS['en'])
        
        ingredient_texts = []
        for ing in ingredients:
            if isinstance(ing, dict):
                amount = self.clean_text_for_speech(str(ing.get('amount', '')))
                name = self.clean_text_for_speech(ing.get('name', ing.get('ingredient', '')))
                ingredient_texts.append(f"{amount} {name}".strip())
            else:
                # String ingredient
                ingredient_texts.append(self.clean_text_for_speech(str(ing)))
        
        ingredient_list = '. '.join(ingredient_texts)
        return f"{header} {ingredient_list}."
    
    def _build_instructions(self, instructions: List, language: str) -> str:
        """Build instructions section"""
        header = self.INSTRUCTIONS_HEADERS.get(language, self.INSTRUCTIONS_HEADERS['en'])
        
        steps = []
        for i, step in enumerate(instructions, 1):
            step_text = step if isinstance(step, str) else step.get('text', step.get('instruction', str(step)))
            steps.append(self.prepare_step_for_speech(i, step_text, len(instructions), language))
        
        return f"{header} {' '.join(steps)}"
    
    def _build_tips(self, tips: List, language: str) -> str:
        """Build tips section"""
        header = self.TIPS_HEADERS.get(language, self.TIPS_HEADERS['en'])
        
        tips_list = '. '.join(self.clean_text_for_speech(str(tip)) for tip in tips)
        return f"{header} {tips_list}."
    
    def number_to_words(self, num: int, language: str = 'en') -> str:
        """Convert number to words"""
        words = self.NUMBER_WORDS.get(language, self.NUMBER_WORDS['en'])
        if num <= 20:
            return words[num]
        return str(num)


# Singleton instance
recipe_text_prep_service = RecipeTextPrepService()
