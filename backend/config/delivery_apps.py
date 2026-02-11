"""
Delivery Apps Configuration
Regional grocery delivery services with search URLs
"""

DELIVERY_APPS = {
    # INDIA
    "IN": {
        "country": "India",
        "currency_symbol": "₹",
        "apps": [
            {
                "id": "blinkit",
                "name": "Blinkit",
                "logo": "https://cdn.iconscout.com/icon/free/png-256/free-blinkit-logo-icon-download-in-svg-png-gif-file-formats--grocery-brand-shopping-logos-icons-2928173.png",
                "color": "#FFE000",
                "text_color": "#000000",
                "delivery_time": "10 mins",
                "search_url": "https://blinkit.com/s/?q={query}",
                "available": True
            },
            {
                "id": "zepto",
                "name": "Zepto",
                "logo": "https://play-lh.googleusercontent.com/bTJzNNQhJL6gqC_YnY5EBMJ1DH5WNXvqfz4tO6dyJ_4S2r4qN6SRrYEf5PVxYdAaAQ",
                "color": "#8B2FC9",
                "text_color": "#FFFFFF",
                "delivery_time": "10 mins",
                "search_url": "https://www.zeptonow.com/search?q={query}",
                "available": True
            },
            {
                "id": "swiggy_instamart",
                "name": "Swiggy Instamart",
                "logo": "https://upload.wikimedia.org/wikipedia/en/thumb/1/12/Swiggy_logo.svg/1200px-Swiggy_logo.svg.png",
                "color": "#FC8019",
                "text_color": "#FFFFFF",
                "delivery_time": "15 mins",
                "search_url": "https://www.swiggy.com/instamart/search?query={query}",
                "available": True
            },
            {
                "id": "bigbasket",
                "name": "BigBasket",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Big_basket_logo.png/1200px-Big_basket_logo.png",
                "color": "#84C225",
                "text_color": "#FFFFFF",
                "delivery_time": "2 hours",
                "search_url": "https://www.bigbasket.com/ps/?q={query}",
                "available": True
            },
            {
                "id": "jiomart",
                "name": "JioMart",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/JioMart_Logo.svg/1200px-JioMart_Logo.svg.png",
                "color": "#0071CE",
                "text_color": "#FFFFFF",
                "delivery_time": "Same day",
                "search_url": "https://www.jiomart.com/search/{query}",
                "available": True
            }
        ]
    },
    
    # USA
    "US": {
        "country": "United States",
        "currency_symbol": "$",
        "apps": [
            {
                "id": "instacart",
                "name": "Instacart",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Instacart_logo_and_wordmark.svg/2560px-Instacart_logo_and_wordmark.svg.png",
                "color": "#43B02A",
                "text_color": "#FFFFFF",
                "delivery_time": "1 hour",
                "search_url": "https://www.instacart.com/store/s?k={query}",
                "available": True
            },
            {
                "id": "amazon_fresh",
                "name": "Amazon Fresh",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/1200px-Amazon_logo.svg.png",
                "color": "#FF9900",
                "text_color": "#000000",
                "delivery_time": "2 hours",
                "search_url": "https://www.amazon.com/s?k={query}&rh=n%3A16310101",
                "available": True
            },
            {
                "id": "walmart_grocery",
                "name": "Walmart",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Walmart_logo.svg/2560px-Walmart_logo.svg.png",
                "color": "#0071CE",
                "text_color": "#FFFFFF",
                "delivery_time": "Same day",
                "search_url": "https://www.walmart.com/search?q={query}&cat_id=976759",
                "available": True
            },
            {
                "id": "kroger",
                "name": "Kroger",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Kroger_logo_%281961-2019%29.svg/1200px-Kroger_logo_%281961-2019%29.svg.png",
                "color": "#003087",
                "text_color": "#FFFFFF",
                "delivery_time": "Same day",
                "search_url": "https://www.kroger.com/search?query={query}",
                "available": True
            },
            {
                "id": "doordash",
                "name": "DoorDash",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/DoorDash-Logo.svg/1200px-DoorDash-Logo.svg.png",
                "color": "#FF3008",
                "text_color": "#FFFFFF",
                "delivery_time": "30 mins",
                "search_url": "https://www.doordash.com/convenience/search/?query={query}",
                "available": True
            }
        ]
    },
    
    # UK
    "GB": {
        "country": "United Kingdom",
        "currency_symbol": "£",
        "apps": [
            {
                "id": "ocado",
                "name": "Ocado",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Ocado_logo.svg/1200px-Ocado_logo.svg.png",
                "color": "#6A0DAD",
                "text_color": "#FFFFFF",
                "delivery_time": "Next day",
                "search_url": "https://www.ocado.com/search?entry={query}",
                "available": True
            },
            {
                "id": "tesco",
                "name": "Tesco",
                "logo": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b0/Tesco_Logo.svg/1200px-Tesco_Logo.svg.png",
                "color": "#EE1C25",
                "text_color": "#FFFFFF",
                "delivery_time": "Same day",
                "search_url": "https://www.tesco.com/groceries/en-GB/search?query={query}",
                "available": True
            },
            {
                "id": "sainsburys",
                "name": "Sainsbury's",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Sainsbury%27s_Logo.svg/1200px-Sainsbury%27s_Logo.svg.png",
                "color": "#F06C00",
                "text_color": "#FFFFFF",
                "delivery_time": "Same day",
                "search_url": "https://www.sainsburys.co.uk/gol-ui/SearchDisplayView?filters[keyword]={query}",
                "available": True
            },
            {
                "id": "getir",
                "name": "Getir",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Getir_logo.svg/1200px-Getir_logo.svg.png",
                "color": "#5D0090",
                "text_color": "#FFFFFF",
                "delivery_time": "10 mins",
                "search_url": "https://getir.com/en/search/?query={query}",
                "available": True
            }
        ]
    },
    
    # UAE
    "AE": {
        "country": "UAE",
        "currency_symbol": "AED",
        "apps": [
            {
                "id": "noon_daily",
                "name": "Noon Daily",
                "logo": "https://e7.pngegg.com/pngimages/766/79/png-clipart-noon-uae-noon-logo-icons-logos-emojis-iconic-brands.png",
                "color": "#FEEE00",
                "text_color": "#000000",
                "delivery_time": "1 hour",
                "search_url": "https://www.noon.com/uae-en/search/?q={query}",
                "available": True
            },
            {
                "id": "carrefour_uae",
                "name": "Carrefour",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Carrefour_logo.svg/1200px-Carrefour_logo.svg.png",
                "color": "#004A97",
                "text_color": "#FFFFFF",
                "delivery_time": "2 hours",
                "search_url": "https://www.carrefouruae.com/mafuae/en/v4/search?keyword={query}",
                "available": True
            },
            {
                "id": "talabat_mart",
                "name": "Talabat Mart",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Talabat_logo.svg/1200px-Talabat_logo.svg.png",
                "color": "#FF6900",
                "text_color": "#FFFFFF",
                "delivery_time": "30 mins",
                "search_url": "https://www.talabat.com/uae/groceries?q={query}",
                "available": True
            }
        ]
    },
    
    # Australia
    "AU": {
        "country": "Australia",
        "currency_symbol": "A$",
        "apps": [
            {
                "id": "woolworths",
                "name": "Woolworths",
                "logo": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/Woolworths_logo.svg/1200px-Woolworths_logo.svg.png",
                "color": "#006B3C",
                "text_color": "#FFFFFF",
                "delivery_time": "Same day",
                "search_url": "https://www.woolworths.com.au/shop/search/products?searchTerm={query}",
                "available": True
            },
            {
                "id": "coles",
                "name": "Coles",
                "logo": "https://upload.wikimedia.org/wikipedia/en/thumb/6/6e/Coles_logo.svg/1200px-Coles_logo.svg.png",
                "color": "#E31837",
                "text_color": "#FFFFFF",
                "delivery_time": "Same day",
                "search_url": "https://www.coles.com.au/search?q={query}",
                "available": True
            }
        ]
    },
    
    # Singapore
    "SG": {
        "country": "Singapore",
        "currency_symbol": "S$",
        "apps": [
            {
                "id": "redmart",
                "name": "RedMart",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/RedMart_logo.svg/1200px-RedMart_logo.svg.png",
                "color": "#EF4123",
                "text_color": "#FFFFFF",
                "delivery_time": "Same day",
                "search_url": "https://redmart.lazada.sg/catalog/?q={query}",
                "available": True
            },
            {
                "id": "fairprice",
                "name": "FairPrice",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/FairPrice_logo.svg/1200px-FairPrice_logo.svg.png",
                "color": "#E8212E",
                "text_color": "#FFFFFF",
                "delivery_time": "Same day",
                "search_url": "https://www.fairprice.com.sg/search?query={query}",
                "available": True
            }
        ]
    },
    
    # Canada
    "CA": {
        "country": "Canada",
        "currency_symbol": "C$",
        "apps": [
            {
                "id": "instacart_ca",
                "name": "Instacart",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Instacart_logo_and_wordmark.svg/2560px-Instacart_logo_and_wordmark.svg.png",
                "color": "#43B02A",
                "text_color": "#FFFFFF",
                "delivery_time": "1 hour",
                "search_url": "https://www.instacart.ca/store/s?k={query}",
                "available": True
            },
            {
                "id": "loblaws",
                "name": "Loblaws",
                "logo": "https://upload.wikimedia.org/wikipedia/en/thumb/1/1a/Loblaws_logo.svg/1200px-Loblaws_logo.svg.png",
                "color": "#FFC72C",
                "text_color": "#000000",
                "delivery_time": "Same day",
                "search_url": "https://www.loblaws.ca/search?query={query}",
                "available": True
            }
        ]
    },
    
    # Default fallback
    "DEFAULT": {
        "country": "Global",
        "currency_symbol": "$",
        "apps": [
            {
                "id": "amazon",
                "name": "Amazon",
                "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/1200px-Amazon_logo.svg.png",
                "color": "#FF9900",
                "text_color": "#000000",
                "delivery_time": "2 days",
                "search_url": "https://www.amazon.com/s?k={query}+grocery",
                "available": True
            }
        ]
    }
}


def get_apps_for_country(country_code: str) -> dict:
    """Get delivery apps for a country code"""
    config = DELIVERY_APPS.get(country_code, DELIVERY_APPS["DEFAULT"])
    return {
        "country": config["country"],
        "country_code": country_code,
        "currency_symbol": config["currency_symbol"],
        "apps": [app for app in config["apps"] if app.get("available", True)]
    }


def build_delivery_url(app: dict, ingredients: list) -> str:
    """Build delivery URL with ingredients as search query"""
    # Join ingredient names for search
    ingredient_names = [ing.get("name", ing) if isinstance(ing, dict) else str(ing) for ing in ingredients]
    query = " ".join(ingredient_names[:5])  # Limit to first 5 for cleaner search
    
    import urllib.parse
    encoded_query = urllib.parse.quote(query)
    
    return app["search_url"].replace("{query}", encoded_query)
