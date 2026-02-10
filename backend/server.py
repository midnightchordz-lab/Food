"""
MoodFood API Server
A comprehensive mood-based recipe discovery application

This is the main application entry point that imports and includes all modular routers.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import logging

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=False)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create FastAPI app
app = FastAPI(
    title="MoodFood API",
    description="A comprehensive mood-based recipe discovery application with diabetes support",
    version="2.0.0"
)

# Import and include all routers
from routes import (
    auth_router,
    exclusions_router,
    chat_router,
    recipes_router,
    meal_planning_router,
    diabetes_router,
    import_router,
    voice_router,
    image_router
)
from routes.search import router as search_router
from routes.recipe_library import router as recipe_library_router
from routes.subscription import router as subscription_router
from routes.twilio_routes import router as twilio_router
from services.scheduled_tasks import router as scheduled_tasks_router, start_scheduler, stop_scheduler

# Include all routers with /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(exclusions_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(recipes_router, prefix="/api")
app.include_router(meal_planning_router, prefix="/api")
app.include_router(diabetes_router, prefix="/api")
app.include_router(import_router, prefix="/api")
app.include_router(voice_router, prefix="/api")
app.include_router(image_router, prefix="/api/recipe-image")
app.include_router(search_router, prefix="/api")
app.include_router(recipe_library_router, prefix="/api")
app.include_router(subscription_router, prefix="/api")
app.include_router(scheduled_tasks_router, prefix="/api")
app.include_router(twilio_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event - create database indexes and start scheduler
@app.on_event("startup")
async def startup_event():
    from routes.deps import create_indexes
    await create_indexes()
    await start_scheduler()
    logger.info("Application started with database indexes and scheduled tasks")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_db_client():
    await stop_scheduler()
    client.close()
    logger.info("Application shutdown complete")

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}
