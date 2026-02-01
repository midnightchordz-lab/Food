"""
Backend Routes Package
All API routes are organized into modular files
"""
from .auth import router as auth_router
from .exclusions import router as exclusions_router
from .chat import router as chat_router
from .recipes import router as recipes_router
from .meal_planning import router as meal_planning_router
from .diabetes import router as diabetes_router
from .import_recipe import router as import_router
from .voice import router as voice_router
from .image_generation import router as image_router

__all__ = [
    'auth_router',
    'exclusions_router', 
    'chat_router',
    'recipes_router',
    'meal_planning_router',
    'diabetes_router',
    'import_router',
    'voice_router',
    'image_router'
]
