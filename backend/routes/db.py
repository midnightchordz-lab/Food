"""
Database connection + index bootstrap.

Single source of the Motor client/db handle used across all routes.
"""
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging

# Database connection - Production ready (no fallbacks)
mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise RuntimeError("MONGO_URL environment variable is required")
client = AsyncIOMotorClient(mongo_url)

db_name = os.environ.get('DB_NAME')
if not db_name:
    raise RuntimeError("DB_NAME environment variable is required")
db = client[db_name]


async def create_indexes():
    """Create database indexes for faster queries"""
    try:
        # Users collection
        try:
            await db.users.create_index("id", unique=True, background=True)
        except Exception:
            pass
        try:
            await db.users.create_index("email", sparse=True, background=True)
        except Exception:
            pass
        try:
            await db.users.create_index("phone_number", sparse=True, background=True)
        except Exception:
            pass

        # Recipes collection
        try:
            await db.recipes.create_index("id", unique=True, background=True)
        except Exception:
            pass
        try:
            await db.recipes.create_index("title", background=True)
        except Exception:
            pass
        try:
            await db.recipes.create_index([("title", "text"), ("description", "text")], background=True)
        except Exception:
            pass

        # Saved recipes
        try:
            await db.saved_recipes.create_index("user_id", background=True)
        except Exception:
            pass
        try:
            await db.saved_recipes.create_index([("user_id", 1), ("recipe_id", 1)], background=True)
        except Exception:
            pass

        # Chat messages
        try:
            await db.chat_messages.create_index([("session_id", 1), ("user_id", 1)], background=True)
        except Exception:
            pass
        try:
            await db.chat_messages.create_index("timestamp", background=True)
        except Exception:
            pass

        # Weekly plans
        try:
            await db.weekly_plans.create_index([("user_id", 1), ("week_start", 1)], background=True)
        except Exception:
            pass

        # Meal preferences
        try:
            await db.meal_preferences.create_index("user_id", unique=True, background=True)
        except Exception:
            pass

        # User exclusions
        try:
            # Drop legacy camelCase index if present (caused DuplicateKeyError on null userId)
            try:
                await db.user_exclusions.drop_index("userId_1")
            except Exception:
                pass
            await db.user_exclusions.create_index("user_id", unique=True, background=True)
        except Exception:
            pass

        # Shopping lists
        try:
            await db.shopping_lists.create_index("user_id", unique=True, background=True)
        except Exception:
            pass

        # Imported recipes
        try:
            await db.imported_recipes.create_index("user_id", background=True)
        except Exception:
            pass
        try:
            await db.imported_recipes.create_index("id", unique=True, background=True)
        except Exception:
            pass

        # Recipe Library (AI-generated recipes storage)
        try:
            await db.recipe_library.create_index("id", unique=True, background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("title_normalized", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("cuisine", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("dietary", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("meal_type", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("mood", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("tags", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("times_served", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index("is_premium", background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index([
                ("cuisine", 1), ("dietary", 1), ("meal_type", 1), ("mood", 1)
            ], background=True)
        except Exception:
            pass
        try:
            await db.recipe_library.create_index([
                ("is_premium", 1), ("times_served", -1)
            ], background=True)
        except Exception:
            pass

        # Refresh tokens (rotation + reuse detection). TTL auto-purges expired nodes.
        try:
            await db.refresh_tokens.create_index("user_id", background=True)
        except Exception:
            pass
        try:
            await db.refresh_tokens.create_index("family_id", background=True)
        except Exception:
            pass
        try:
            await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0, background=True)
        except Exception:
            pass
        try:
            await db.auth_events.create_index("created_at", background=True)
        except Exception:
            pass

        logging.info("Database indexes created successfully")
    except Exception as e:
        logging.warning(f"Index creation warning (may already exist): {e}")
