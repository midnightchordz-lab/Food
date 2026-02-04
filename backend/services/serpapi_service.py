"""
SerpAPI Integration Service
Provides recipe search, grocery store finder, and ingredient price check features
"""

import os
import httpx
import logging
from typing import List, Dict, Optional
from urllib.parse import urlencode

SERPAPI_KEY = os.environ.get('SERPAPI_KEY', '61b164ba24fae31ca5fda08e0280c76c873edfc80cf9d34169587d52a7fb42ac')
SERPAPI_BASE_URL = "https://serpapi.com/search.json"


async def search_recipes(query: str, cuisine: str = None, dietary: str = None, limit: int = 10) -> Dict:
    """
    Search for recipes from external websites using Google Search
    """
    try:
        # Build search query
        search_query = f"{query} recipe"
        if cuisine:
            search_query += f" {cuisine}"
        if dietary:
            search_query += f" {dietary}"
        
        params = {
            "api_key": SERPAPI_KEY,
            "engine": "google",
            "q": search_query,
            "num": limit,
            "tbm": "nws" if False else None,  # Can switch to news search
        }
        # Remove None values
        params = {k: v for k, v in params.items() if v is not None}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(SERPAPI_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
        
        # Parse results
        recipes = []
        organic_results = data.get("organic_results", [])
        
        for result in organic_results[:limit]:
            recipe = {
                "title": result.get("title", ""),
                "link": result.get("link", ""),
                "snippet": result.get("snippet", ""),
                "source": result.get("displayed_link", ""),
                "thumbnail": result.get("thumbnail", ""),
                "position": result.get("position", 0)
            }
            # Filter for recipe-related results
            if any(word in recipe["title"].lower() or word in recipe["snippet"].lower() 
                   for word in ["recipe", "cook", "make", "prepare", "ingredients"]):
                recipes.append(recipe)
        
        # Also check for rich recipe results
        if "recipes_results" in data:
            for r in data["recipes_results"][:5]:
                recipes.insert(0, {
                    "title": r.get("title", ""),
                    "link": r.get("link", ""),
                    "snippet": f"⏱️ {r.get('total_time', 'N/A')} | ⭐ {r.get('rating', 'N/A')} ({r.get('reviews', 0)} reviews)",
                    "source": r.get("source", ""),
                    "thumbnail": r.get("thumbnail", ""),
                    "ingredients": r.get("ingredients", []),
                    "is_featured": True
                })
        
        return {
            "success": True,
            "query": search_query,
            "results": recipes[:limit],
            "total_found": len(recipes)
        }
        
    except Exception as e:
        logging.error(f"SerpAPI recipe search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "results": []
        }


async def find_grocery_stores(location: str, ingredient: str = None) -> Dict:
    """
    Find nearby grocery stores using Google Maps search
    """
    try:
        search_query = "grocery stores"
        if ingredient:
            search_query = f"grocery stores {ingredient}"
        
        params = {
            "api_key": SERPAPI_KEY,
            "engine": "google_maps",
            "q": search_query,
            "ll": None,  # Will use location string instead
            "type": "search",
        }
        
        # If location looks like coordinates, use ll parameter
        if "," in location and all(part.replace(".", "").replace("-", "").isdigit() for part in location.split(",")):
            params["ll"] = f"@{location},15z"
        else:
            params["q"] = f"{search_query} near {location}"
        
        params = {k: v for k, v in params.items() if v is not None}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(SERPAPI_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
        
        stores = []
        local_results = data.get("local_results", [])
        
        for store in local_results[:10]:
            store_name = store.get("title", "")
            store_address = store.get("address", "")
            gps_coords = store.get("gps_coordinates", {})
            
            # Generate Google Maps URL for directions
            google_maps_url = None
            if gps_coords and gps_coords.get("latitude") and gps_coords.get("longitude"):
                # Use coordinates for precise location
                lat = gps_coords.get("latitude")
                lng = gps_coords.get("longitude")
                google_maps_url = f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&destination_place_id={store.get('place_id', '')}"
            elif store_name and store_address:
                # Fallback to name + address search
                from urllib.parse import quote
                search_query = f"{store_name}, {store_address}"
                google_maps_url = f"https://www.google.com/maps/search/?api=1&query={quote(search_query)}"
            
            stores.append({
                "name": store_name,
                "address": store_address,
                "rating": store.get("rating", "N/A"),
                "reviews": store.get("reviews", 0),
                "type": store.get("type", "Grocery Store"),
                "hours": store.get("hours", ""),
                "phone": store.get("phone", ""),
                "website": store.get("website", ""),
                "directions_link": store.get("directions", ""),
                "google_maps_url": google_maps_url,
                "thumbnail": store.get("thumbnail", ""),
                "gps_coordinates": gps_coords,
                "price_level": store.get("price", ""),
                "open_now": "Open" in store.get("hours", "") if store.get("hours") else None
            })
        
        return {
            "success": True,
            "location": location,
            "query": search_query,
            "stores": stores,
            "total_found": len(stores)
        }
        
    except Exception as e:
        logging.error(f"SerpAPI grocery store search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "stores": []
        }


async def check_ingredient_prices(ingredient: str, location: str = "USA") -> Dict:
    """
    Search for ingredient prices and deals using Google Shopping
    Automatically detects country and displays prices in local currency
    """
    try:
        search_query = f"{ingredient} grocery price"
        
        # Map common locations to their Google location codes and currencies
        location_mapping = {
            # India
            'mumbai': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Mumbai, Maharashtra, India'},
            'bandra': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Mumbai, Maharashtra, India'},
            'delhi': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Delhi, India'},
            'bangalore': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Bangalore, Karnataka, India'},
            'bengaluru': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Bangalore, Karnataka, India'},
            'chennai': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Chennai, Tamil Nadu, India'},
            'kolkata': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Kolkata, West Bengal, India'},
            'hyderabad': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Hyderabad, Telangana, India'},
            'pune': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'Pune, Maharashtra, India'},
            'india': {'gl': 'in', 'hl': 'en', 'currency': 'INR', 'location': 'India'},
            # UK
            'london': {'gl': 'uk', 'hl': 'en', 'currency': 'GBP', 'location': 'London, United Kingdom'},
            'manchester': {'gl': 'uk', 'hl': 'en', 'currency': 'GBP', 'location': 'Manchester, United Kingdom'},
            'uk': {'gl': 'uk', 'hl': 'en', 'currency': 'GBP', 'location': 'United Kingdom'},
            'united kingdom': {'gl': 'uk', 'hl': 'en', 'currency': 'GBP', 'location': 'United Kingdom'},
            # Europe
            'paris': {'gl': 'fr', 'hl': 'fr', 'currency': 'EUR', 'location': 'Paris, France'},
            'berlin': {'gl': 'de', 'hl': 'de', 'currency': 'EUR', 'location': 'Berlin, Germany'},
            'france': {'gl': 'fr', 'hl': 'fr', 'currency': 'EUR', 'location': 'France'},
            'germany': {'gl': 'de', 'hl': 'de', 'currency': 'EUR', 'location': 'Germany'},
            # Canada
            'toronto': {'gl': 'ca', 'hl': 'en', 'currency': 'CAD', 'location': 'Toronto, Ontario, Canada'},
            'vancouver': {'gl': 'ca', 'hl': 'en', 'currency': 'CAD', 'location': 'Vancouver, BC, Canada'},
            'canada': {'gl': 'ca', 'hl': 'en', 'currency': 'CAD', 'location': 'Canada'},
            # Australia
            'sydney': {'gl': 'au', 'hl': 'en', 'currency': 'AUD', 'location': 'Sydney, NSW, Australia'},
            'melbourne': {'gl': 'au', 'hl': 'en', 'currency': 'AUD', 'location': 'Melbourne, VIC, Australia'},
            'australia': {'gl': 'au', 'hl': 'en', 'currency': 'AUD', 'location': 'Australia'},
            # USA (default)
            'usa': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'United States'},
            'us': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'United States'},
            'united states': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'United States'},
            'new york': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'New York, NY, United States'},
            'los angeles': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'Los Angeles, CA, United States'},
            'austin': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'Austin, TX, United States'},
            'chicago': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'Chicago, IL, United States'},
            'san francisco': {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': 'San Francisco, CA, United States'},
        }
        
        # Find matching location (case-insensitive)
        location_lower = location.lower().strip()
        location_config = None
        
        for key, config in location_mapping.items():
            if key in location_lower or location_lower in key:
                location_config = config
                break
        
        # Default to US if no match
        if not location_config:
            location_config = {'gl': 'us', 'hl': 'en', 'currency': 'USD', 'location': location}
        
        params = {
            "api_key": SERPAPI_KEY,
            "engine": "google_shopping",
            "q": search_query,
            "location": location_config['location'],
            "gl": location_config['gl'],
            "hl": location_config['hl'],
            "num": 15
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(SERPAPI_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
        
        prices = []
        shopping_results = data.get("shopping_results", [])
        
        for item in shopping_results[:15]:
            price_info = {
                "title": item.get("title", ""),
                "price": item.get("price", "N/A"),
                "extracted_price": item.get("extracted_price", 0),
                "source": item.get("source", ""),
                "link": item.get("link", ""),
                "thumbnail": item.get("thumbnail", ""),
                "rating": item.get("rating", None),
                "reviews": item.get("reviews", 0),
                "delivery": item.get("delivery", ""),
                "store_rating": item.get("store_rating", None),
                "second_hand": item.get("second_hand_condition", None),
            }
            prices.append(price_info)
        
        # Calculate price stats
        valid_prices = [p["extracted_price"] for p in prices if p["extracted_price"] and p["extracted_price"] > 0]
        price_stats = {}
        if valid_prices:
            price_stats = {
                "min_price": min(valid_prices),
                "max_price": max(valid_prices),
                "avg_price": round(sum(valid_prices) / len(valid_prices), 2),
                "price_count": len(valid_prices),
                "currency": location_config['currency']
            }
        
        # Also search for deals/coupons
        deals = []
        if "inline_shopping_results" in data:
            for deal in data["inline_shopping_results"][:5]:
                deals.append({
                    "title": deal.get("title", ""),
                    "price": deal.get("price", ""),
                    "source": deal.get("source", ""),
                    "link": deal.get("link", "")
                })
        
        return {
            "success": True,
            "ingredient": ingredient,
            "location": location,
            "detected_location": location_config['location'],
            "currency": location_config['currency'],
            "country_code": location_config['gl'].upper(),
            "prices": prices,
            "price_stats": price_stats,
            "deals": deals,
            "total_found": len(prices)
        }
        
    except Exception as e:
        logging.error(f"SerpAPI price check error: {e}")
        return {
            "success": False,
            "error": str(e),
            "prices": []
        }


async def search_recipe_videos(recipe_name: str, limit: int = 5) -> Dict:
    """
    Search for cooking tutorial videos on YouTube
    """
    try:
        search_query = f"{recipe_name} recipe cooking tutorial"
        
        params = {
            "api_key": SERPAPI_KEY,
            "engine": "youtube",
            "search_query": search_query,
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(SERPAPI_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
        
        videos = []
        video_results = data.get("video_results", [])
        
        for video in video_results[:limit]:
            videos.append({
                "title": video.get("title", ""),
                "link": video.get("link", ""),
                "channel": video.get("channel", {}).get("name", ""),
                "channel_link": video.get("channel", {}).get("link", ""),
                "duration": video.get("length", {}).get("text", ""),
                "views": video.get("views", 0),
                "published": video.get("published_date", ""),
                "thumbnail": video.get("thumbnail", {}).get("static", ""),
                "description": video.get("description", "")
            })
        
        return {
            "success": True,
            "query": recipe_name,
            "videos": videos,
            "total_found": len(videos)
        }
        
    except Exception as e:
        logging.error(f"SerpAPI video search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "videos": []
        }
