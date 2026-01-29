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
load_dotenv(ROOT_DIR / '.env')

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
    voice_router
)

# Include all routers with /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(exclusions_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(recipes_router, prefix="/api")
app.include_router(meal_planning_router, prefix="/api")
app.include_router(diabetes_router, prefix="/api")
app.include_router(import_router, prefix="/api")
app.include_router(voice_router, prefix="/api")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shutdown event
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}
