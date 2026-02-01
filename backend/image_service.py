import os
from typing import Optional, List
import hashlib

# Comprehensive curated high-quality food images from Unsplash (royalty-free)
# Organized by global regions for better matching

FOOD_IMAGES = {
    # ==========================================
    # INDIA & INDIAN SUBCONTINENT
    # ==========================================
    # North Indian
    'butter chicken': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800',
    'chicken tikka masala': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800',
    'palak paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
    'paneer tikka': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=800',
    'paneer butter masala': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
    'dal makhani': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800',
    'dal tadka': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800',
    'masoor dal': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800',
    'chana masala': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
    'chole bhature': 'https://images.unsplash.com/photo-1626132647523-66c5e4c6c3f0?w=800',
    'aloo gobi': 'https://images.unsplash.com/photo-1631452180539-96aca7d48617?w=800',
    'aloo paratha': 'https://images.unsplash.com/photo-1626132647523-66c5e4c6c3f0?w=800',
    'naan': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'roti': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'chapati': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'tandoori chicken': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800',
    'chicken korma': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800',
    'lamb rogan josh': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800',
    'rogan josh': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800',
    'malai kofta': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
    'rajma': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800',
    'kadhi pakora': 'https://images.unsplash.com/photo-1631452180539-96aca7d48617?w=800',
    
    # South Indian
    'dosa': 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=800',
    'masala dosa': 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=800',
    'idli': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800',
    'idli sambar': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800',
    'sambar': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800',
    'rasam': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800',
    'uttapam': 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=800',
    'vada': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800',
    'upma': 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=800',
    'pongal': 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=800',
    'hyderabadi biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
    'coconut chutney': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800',
    
    # Biryani & Rice Dishes
    'biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
    'chicken biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
    'mutton biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
    'veg biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
    'vegetable biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
    'pulao': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
    'pulav': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
    'veggie pulao': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
    'vegetable pulao': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
    'jeera rice': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
    'lemon rice': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
    'tamarind rice': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
    'khichdi': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
    
    # Indian Snacks & Street Food
    'samosa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'pakora': 'https://images.unsplash.com/photo-1631452180539-96aca7d48617?w=800',
    'bhaji': 'https://images.unsplash.com/photo-1631452180539-96aca7d48617?w=800',
    'pani puri': 'https://images.unsplash.com/photo-1626132647523-66c5e4c6c3f0?w=800',
    'bhel puri': 'https://images.unsplash.com/photo-1626132647523-66c5e4c6c3f0?w=800',
    'pav bhaji': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800',
    'vada pav': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800',
    
    # Indian Desserts
    'gulab jamun': 'https://images.unsplash.com/photo-1666190094721-232e6cbf3c11?w=800',
    'rasgulla': 'https://images.unsplash.com/photo-1666190094721-232e6cbf3c11?w=800',
    'kheer': 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
    'jalebi': 'https://images.unsplash.com/photo-1666190094721-232e6cbf3c11?w=800',
    'ladoo': 'https://images.unsplash.com/photo-1666190094721-232e6cbf3c11?w=800',
    'halwa': 'https://images.unsplash.com/photo-1666190094721-232e6cbf3c11?w=800',
    
    # Paneer Dishes (Vegetarian)
    'paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
    'paneer bhurji': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
    'shahi paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
    'kadai paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
    'matar paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800',
    
    # Pakistani/Bangladeshi
    'nihari': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800',
    'haleem': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800',
    'seekh kebab': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800',
    'chapli kebab': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800',
    
    # Sri Lankan
    'kottu roti': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
    'hoppers': 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=800',
    'string hoppers': 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=800',
    
    # ==========================================
    # CHINA
    # ==========================================
    'kung pao chicken': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800',
    'mapo tofu': 'https://images.unsplash.com/photo-1582452919408-80d02cb4cf45?w=800',
    'dim sum': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
    'dumplings': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
    'chinese dumplings': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
    'jiaozi': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
    'sweet and sour pork': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800',
    'sweet and sour chicken': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800',
    'fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'yang chow fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'egg fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'chow mein': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800',
    'lo mein': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800',
    'noodles': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800',
    'spring rolls': 'https://images.unsplash.com/photo-1548507200-e587ab3ee3a7?w=800',
    'egg rolls': 'https://images.unsplash.com/photo-1548507200-e587ab3ee3a7?w=800',
    'wonton soup': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
    'hot and sour soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    'peking duck': 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=800',
    'beijing duck': 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=800',
    'general tso chicken': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800',
    'orange chicken': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800',
    'mongolian beef': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800',
    'beef and broccoli': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800',
    'char siu': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800',
    'baozi': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
    'bao': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
    'congee': 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=800',
    'ma la': 'https://images.unsplash.com/photo-1582452919408-80d02cb4cf45?w=800',
    'hot pot': 'https://images.unsplash.com/photo-1582452919408-80d02cb4cf45?w=800',
    'sichuan': 'https://images.unsplash.com/photo-1582452919408-80d02cb4cf45?w=800',
    
    # ==========================================
    # JAPAN
    # ==========================================
    'ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
    'tonkotsu ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
    'miso ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
    'shoyu ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
    'chicken teriyaki': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    'teriyaki': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    'salmon teriyaki': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
    'sushi': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
    'sushi rolls': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
    'nigiri': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
    'sashimi': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
    'maki': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
    'tempura': 'https://images.unsplash.com/photo-1581781870027-04212e231e96?w=800',
    'katsu curry': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800',
    'tonkatsu': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800',
    'chicken katsu': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800',
    'miso soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    'udon': 'https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?w=800',
    'soba': 'https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?w=800',
    'yakitori': 'https://images.unsplash.com/photo-1708597525178-6c302364f37c?w=800',
    'yakitori chicken': 'https://images.unsplash.com/photo-1708597525178-6c302364f37c?w=800',
    'yakitori skewers': 'https://images.unsplash.com/photo-1708597525178-6c302364f37c?w=800',
    'chicken skewers': 'https://images.unsplash.com/photo-1708597525178-6c302364f37c?w=800',
    'okonomiyaki': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800',
    'takoyaki': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800',
    'gyudon': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800',
    'donburi': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800',
    'onigiri': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
    'gyoza': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
    'edamame': 'https://images.unsplash.com/photo-1564834744159-ff0ea41ba4b9?w=800',
    'matcha': 'https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800',
    'mochi': 'https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800',
    
    # ==========================================
    # KOREA
    # ==========================================
    'bibimbap': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800',
    'bulgogi': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
    'kimchi jjigae': 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800',
    'kimchi stew': 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800',
    'japchae': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
    'korean fried chicken': 'https://images.unsplash.com/photo-1575932444877-5106bee2a599?w=800',
    'fried chicken': 'https://images.unsplash.com/photo-1575932444877-5106bee2a599?w=800',
    'kimchi': 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800',
    'kimbap': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
    'gimbap': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
    'samgyeopsal': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
    'korean bbq': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
    'sundubu jjigae': 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800',
    'tteokbokki': 'https://images.unsplash.com/photo-1635363638580-c2809d049eee?w=800',
    'korean pancake': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800',
    'pajeon': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800',
    'jjajangmyeon': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800',
    'naengmyeon': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800',
    'bossam': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
    
    # ==========================================
    # SOUTHEAST ASIA (ASEAN)
    # ==========================================
    # Thai
    'pad thai': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
    'green curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
    'red curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
    'yellow curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
    'thai curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
    'tom yum': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
    'tom yum soup': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
    'tom kha': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
    'massaman curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
    'panang curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
    'mango sticky rice': 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=800',
    'khao pad': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'thai fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'larb': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
    'som tam': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
    'papaya salad': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
    'satay': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'thai basil chicken': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
    'pad krapow': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
    
    # Vietnamese
    'pho': 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800',
    'pho bo': 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800',
    'pho ga': 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800',
    'banh mi': 'https://images.unsplash.com/photo-1600688640154-9619e002df30?w=800',
    'spring rolls vietnamese': 'https://images.unsplash.com/photo-1548507200-e587ab3ee3a7?w=800',
    'goi cuon': 'https://images.unsplash.com/photo-1548507200-e587ab3ee3a7?w=800',
    'bun cha': 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800',
    'com tam': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'ca kho to': 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800',
    'bo luc lac': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800',
    
    # Malaysian/Singaporean
    'nasi lemak': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'laksa': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
    'char kway teow': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
    'rendang': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800',
    'satay': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'hainanese chicken rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'chicken rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'roti canai': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'nasi goreng': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'mee goreng': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800',
    'chili crab': 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800',
    
    # Indonesian
    'nasi goreng': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'satay ayam': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'gado gado': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
    'soto ayam': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
    'bakso': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
    'martabak': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800',
    'nasi padang': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    
    # Filipino
    'adobo': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    'chicken adobo': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    'pork adobo': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    'sinigang': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
    'kare kare': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800',
    'lechon': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'lumpia': 'https://images.unsplash.com/photo-1548507200-e587ab3ee3a7?w=800',
    'pancit': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800',
    'sisig': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    'halo halo': 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=800',
    
    # ==========================================
    # MIDDLE EAST
    # ==========================================
    'falafel': 'https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?w=800',
    'shawarma': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'hummus': 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800',
    'baba ganoush': 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800',
    'tabbouleh': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
    'fattoush': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
    'shakshuka': 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=800',
    'lamb kebabs': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'kebabs': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'shish kebab': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'kibbeh': 'https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?w=800',
    'mansaf': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800',
    'kofta': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'dolma': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'baklava': 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=800',
    'kunafa': 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=800',
    'musakhan': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'maqluba': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
    'labneh': 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800',
    'pita': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'foul mudammas': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800',
    
    # Persian/Iranian
    'tahdig': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
    'ghormeh sabzi': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800',
    'zereshk polo': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
    'kabab koobideh': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'ash reshteh': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    'fesenjan': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800',
    
    # Turkish
    'doner kebab': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'iskender': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'lahmacun': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
    'pide': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
    'manti': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
    'borek': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'imam bayildi': 'https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=800',
    
    # ==========================================
    # EUROPE
    # ==========================================
    # Italian
    'spaghetti carbonara': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
    'carbonara': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
    'pasta': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
    'spaghetti': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
    'lasagna': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800',
    'osso buco': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'margherita pizza': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
    'pizza': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
    'risotto': 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800',
    'mushroom risotto': 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800',
    'tiramisu': 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
    'gnocchi': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
    'ravioli': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
    'pesto pasta': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
    'bolognese': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
    'caprese': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
    'bruschetta': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
    'minestrone': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    'panna cotta': 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
    'gelato': 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
    
    # French
    'coq au vin': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    'ratatouille': 'https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=800',
    'creme brulee': 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=800',
    'crème brûlée': 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=800',
    'french onion soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    'croissants': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
    'croissant': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
    'beef bourguignon': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'bouillabaisse': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
    'quiche': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    'quiche lorraine': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    'crepes': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800',
    'duck confit': 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=800',
    'cassoulet': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'nicoise salad': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
    'escargot': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'souffle': 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
    'macarons': 'https://images.unsplash.com/photo-1558326567-98ae2405596b?w=800',
    
    # Spanish
    'paella': 'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=800',
    'seafood paella': 'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=800',
    'tapas': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'gazpacho': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    'tortilla espanola': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    'churros': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
    'patatas bravas': 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=800',
    'jamon': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'croquetas': 'https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?w=800',
    
    # Greek/Mediterranean
    'moussaka': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'greek moussaka': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'souvlaki': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'gyros': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'greek salad': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
    'spanakopita': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'tzatziki': 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800',
    'dolmades': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'kleftiko': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    
    # German
    'schnitzel': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800',
    'wiener schnitzel': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800',
    'bratwurst': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'sauerkraut': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'sauerbraten': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'pretzel': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
    'currywurst': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'strudel': 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=800',
    'black forest cake': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
    
    # British
    'fish and chips': 'https://images.unsplash.com/photo-1579208030886-b937da0925dc?w=800',
    'shepherd pie': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800',
    'shepherds pie': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800',
    'bangers and mash': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'roast beef': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'sunday roast': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'yorkshire pudding': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'cornish pasty': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'scones': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
    'full english breakfast': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
    
    # Russian/Eastern European
    'borscht': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    'beef stroganoff': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'stroganoff': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'pelmeni': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
    'pierogi': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
    'blini': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800',
    'shchi': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    'pirozhki': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'goulash': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    
    # ==========================================
    # AMERICAS
    # ==========================================
    # Mexican
    'tacos': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    'tacos al pastor': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800',
    'carnitas': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800',
    'mole': 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800',
    'mole poblano': 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800',
    'guacamole': 'https://images.unsplash.com/photo-1604132727799-6c94a1c32ee2?w=800',
    'enchiladas': 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800',
    'pozole': 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=800',
    'tamales': 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800',
    'chilaquiles': 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800',
    'quesadillas': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    'burritos': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    'burrito': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    'nachos': 'https://images.unsplash.com/photo-1604132727799-6c94a1c32ee2?w=800',
    'elote': 'https://images.unsplash.com/photo-1604132727799-6c94a1c32ee2?w=800',
    'churros': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
    'salsa': 'https://images.unsplash.com/photo-1604132727799-6c94a1c32ee2?w=800',
    'pico de gallo': 'https://images.unsplash.com/photo-1604132727799-6c94a1c32ee2?w=800',
    
    # American
    'burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
    'hamburger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
    'cheeseburger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
    'hot dog': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'bbq ribs': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'ribs': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'pulled pork': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'mac and cheese': 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=800',
    'macaroni and cheese': 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=800',
    'buffalo wings': 'https://images.unsplash.com/photo-1575932444877-5106bee2a599?w=800',
    'chicken wings': 'https://images.unsplash.com/photo-1575932444877-5106bee2a599?w=800',
    'clam chowder': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    'new york cheesecake': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
    'apple pie': 'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?w=800',
    'pancakes': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
    'waffles': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
    'eggs benedict': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
    'lobster roll': 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800',
    'philly cheesesteak': 'https://images.unsplash.com/photo-1600688640154-9619e002df30?w=800',
    'po boy': 'https://images.unsplash.com/photo-1600688640154-9619e002df30?w=800',
    'jambalaya': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'gumbo': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
    'cajun': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'southern fried chicken': 'https://images.unsplash.com/photo-1575932444877-5106bee2a599?w=800',
    
    # Latin American (LATAM)
    'ceviche': 'https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=800',
    'empanadas': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'arepa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'arepas': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'pupusas': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'feijoada': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'churrasco': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'asado': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'chimichurri': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'lomo saltado': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800',
    'bandeja paisa': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'sancocho': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
    'pao de queijo': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
    'brigadeiro': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
    'tres leches': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
    'dulce de leche': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
    'alfajores': 'https://images.unsplash.com/photo-1558326567-98ae2405596b?w=800',
    
    # Caribbean
    'jerk chicken': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800',
    'jamaican jerk': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800',
    'rice and peas': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'oxtail': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'ackee and saltfish': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'ropa vieja': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'mofongo': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'plantains': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'tostones': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    
    # ==========================================
    # OCEANIA
    # ==========================================
    'meat pie': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800',
    'aussie meat pie': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800',
    'pavlova': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
    'lamington': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
    'vegemite toast': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
    'barramundi': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
    'hangi': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'anzac biscuits': 'https://images.unsplash.com/photo-1558326567-98ae2405596b?w=800',
    'flat white': 'https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800',
    
    # ==========================================
    # AFRICAN
    # ==========================================
    'tagine': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800',
    'moroccan tagine': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800',
    'couscous': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
    'injera': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'doro wat': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800',
    'jollof rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'bobotie': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800',
    'bunny chow': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
    'peri peri chicken': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800',
    'suya': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'fufu': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'egusi soup': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800',
    'koshari': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
    
    # ==========================================
    # GENERAL/COMMON
    # ==========================================
    'salad': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
    'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    'steak': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'grilled chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    'roasted chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    'chicken breast': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    'grilled fish': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
    'salmon': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
    'grilled salmon': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
    'baked salmon': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
    'shrimp': 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800',
    'prawns': 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800',
    'curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800',
    'stir fry': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800',
    'stir-fry': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800',
    'omelette': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
    'omelet': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
    'smoothie bowl': 'https://images.unsplash.com/photo-1546039907-7fa05f864c02?w=800',
    'acai bowl': 'https://images.unsplash.com/photo-1546039907-7fa05f864c02?w=800',
    'avocado toast': 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=800',
    'sandwich': 'https://images.unsplash.com/photo-1600688640154-9619e002df30?w=800',
    'wrap': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    'bowl': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800',
    'grain bowl': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800',
    'buddha bowl': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800',
    'poke bowl': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
    'quinoa': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800',
    'tofu': 'https://images.unsplash.com/photo-1582452919408-80d02cb4cf45?w=800',
    'vegetable': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
    'vegetables': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
    'roasted vegetables': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
    'grilled vegetables': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
}

# Category fallbacks for when specific dish isn't found
CUISINE_FALLBACKS = {
    'indian': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
    'chinese': 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800',
    'italian': 'https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=800',
    'mexican': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800',
    'japanese': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
    'thai': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
    'mediterranean': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'korean': 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800',
    'french': 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800',
    'vietnamese': 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800',
    'spanish': 'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=800',
    'greek': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'middle eastern': 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800',
    'turkish': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800',
    'persian': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
    'malaysian': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800',
    'indonesian': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'filipino': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    'american': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
    'cajun': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
    'caribbean': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800',
    'brazilian': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'peruvian': 'https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=800',
    'argentinian': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'african': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800',
    'moroccan': 'https://images.unsplash.com/photo-1545247181-516773cae754?w=800',
    'ethiopian': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800',
    'russian': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    'german': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800',
    'british': 'https://images.unsplash.com/photo-1579208030886-b937da0925dc?w=800',
    'australian': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800',
    'vegetarian': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
    'vegan': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
    'healthy': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
}

# Generic food images for complete fallback
GENERIC_FOOD_IMAGES = [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
    'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800',
    'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800',
]

# SPECIFIC DISH NAMES - These MUST match before generic ingredients
# These are distinctive dishes that should not fall back to generic protein images
SPECIFIC_DISHES = {
    # Japanese specific dishes (not cooking styles)
    'yakitori', 'tempura', 'tonkatsu', 'katsu', 'donburi', 'gyudon',
    'ramen', 'udon', 'soba', 'sushi', 'sashimi', 'nigiri', 'maki', 'onigiri',
    'okonomiyaki', 'takoyaki', 'gyoza', 'miso',
    # Korean specific
    'bibimbap', 'bulgogi', 'kimchi', 'japchae', 'tteokbokki', 'samgyeopsal',
    'kimbap', 'gimbap', 'jjigae', 'sundubu',
    # Chinese specific
    'kung pao', 'mapo', 'dim sum', 'char siu', 'peking', 'mongolian',
    'chow mein', 'lo mein', 'wonton', 'baozi', 'congee',
    # Indian specific
    'biryani', 'pulao', 'tikka', 'tandoori', 'korma', 'vindaloo', 'masala',
    'dal', 'paneer', 'dosa', 'idli', 'sambar', 'naan', 'paratha',
    # Thai specific  
    'pad thai', 'tom yum', 'tom kha', 'massaman', 'panang', 'larb',
    # Vietnamese specific
    'pho', 'banh mi', 'bun cha',
    # Mexican specific
    'tacos', 'burrito', 'enchiladas', 'quesadilla', 'mole', 'pozole', 'tamales',
    # Italian specific
    'carbonara', 'lasagna', 'risotto', 'gnocchi', 'ravioli', 'bolognese',
    # Middle Eastern specific
    'falafel', 'shawarma', 'kebab', 'hummus', 'shakshuka', 'tagine',
    # Other specific dishes
    'paella', 'ratatouille', 'schnitzel', 'goulash', 'moussaka', 'souvlaki',
}

# Generic ingredients - only match these if no specific dish is found
GENERIC_INGREDIENTS = {
    'salmon', 'tuna', 'shrimp', 'prawns', 'lobster', 'crab', 'fish', 'cod', 'tilapia',
    'chicken', 'beef', 'pork', 'lamb', 'duck', 'turkey',
    'tofu', 'tempeh',
    'pasta', 'spaghetti', 'noodles',
    'rice', 'quinoa',
    'pizza', 'burger', 'sandwich',
    'soup', 'stew', 'salad', 'curry',
}

# HIGH PRIORITY PROTEINS - These should match BEFORE cooking styles like teriyaki
# When a dish has both a protein AND a cooking style, prioritize the protein
HIGH_PRIORITY_PROTEINS = {'salmon', 'tuna', 'shrimp', 'lobster', 'crab', 'duck'}

# Cooking styles - lowest priority
COOKING_STYLES = {
    'grilled', 'baked', 'fried', 'roasted', 'steamed', 'braised',
    'glazed', 'sauteed', 'pan-fried', 'stir-fried', 'smoked', 'bbq', 'barbecue',
    'crispy', 'crunchy', 'creamy', 'spicy', 'tangy', 'sweet', 'sour',
    'teriyaki',  # teriyaki is a cooking style, not a dish
}

def get_food_image(recipe_name: str, cuisine: str = None) -> str:
    """
    Get a high-quality food image URL for a recipe.
    Uses curated Unsplash images for reliable, watermark-free results.
    
    MATCHING PRIORITY:
    1. Exact recipe name match
    2. Specific dish names (yakitori, ramen, biryani, etc.)
    3. High-priority proteins (salmon, tuna, shrimp) - before cooking styles
    4. Multi-word matches in database
    5. Generic ingredients (chicken, beef, etc.)
    6. Cuisine fallback
    7. Generic food image
    """
    # Normalize recipe name for lookup
    name_lower = recipe_name.lower().strip()
    
    # STEP 1: Try exact match first
    if name_lower in FOOD_IMAGES:
        return FOOD_IMAGES[name_lower]
    
    # Extract words from recipe name
    words = name_lower.replace('-', ' ').split()
    
    # STEP 2: Look for SPECIFIC DISH NAMES first (yakitori, biryani, ramen, etc.)
    for word in words:
        if word in SPECIFIC_DISHES:
            for key, url in FOOD_IMAGES.items():
                if word in key.split() or word == key:
                    return url
    
    # Also check for two-word specific dishes
    for i in range(len(words) - 1):
        two_word = f"{words[i]} {words[i+1]}"
        if two_word in SPECIFIC_DISHES or two_word in FOOD_IMAGES:
            if two_word in FOOD_IMAGES:
                return FOOD_IMAGES[two_word]
            for key, url in FOOD_IMAGES.items():
                if two_word in key:
                    return url
    
    # STEP 3: Check for HIGH PRIORITY PROTEINS (salmon, tuna, etc.)
    # These should match BEFORE cooking styles like teriyaki
    for word in words:
        if word in HIGH_PRIORITY_PROTEINS:
            for key, url in FOOD_IMAGES.items():
                if word in key.split():
                    return url
    
    # STEP 4: Try matching multi-word dish names from database
    # But SKIP if it's just a cooking style
    best_match = None
    best_match_len = 0
    
    for key, url in FOOD_IMAGES.items():
        # Skip if the key is just a cooking style
        if key in COOKING_STYLES:
            continue
        # Check if key is contained in recipe name
        if key in name_lower and len(key) > best_match_len:
            best_match = url
            best_match_len = len(key)
        # Check if recipe name is contained in key
        elif name_lower in key and len(name_lower) > best_match_len:
            best_match = url
            best_match_len = len(name_lower)
    
    if best_match and best_match_len >= 5:
        return best_match
    
    # STEP 5: Now try GENERIC INGREDIENTS
    for word in words:
        if word in GENERIC_INGREDIENTS:
            for key, url in FOOD_IMAGES.items():
                if word in key.split():
                    return url
    
    # STEP 6: Try matching any significant word
    skip_words = {'a', 'an', 'the', 'with', 'and', 'or', 'in', 'on', 'of', 'for', 
                  'style', 'spicy', 'mild', 'hot', 'cold', 'fresh', 'homemade',
                  'traditional', 'classic', 'authentic', 'delicious', 'easy',
                  'quick', 'simple', 'healthy', 'light', 'rich', 'creamy',
                  'bowl', 'plate', 'dish', 'skewers', 'skewer'}
    
    significant_words = [w for w in words if w not in skip_words and w not in COOKING_STYLES and len(w) > 3]
    
    for word in significant_words:
        for key, url in FOOD_IMAGES.items():
            if word in key.split():
                return url
    
    # STEP 7: Try cuisine fallback
    if cuisine:
        cuisine_lower = cuisine.lower()
        if cuisine_lower in CUISINE_FALLBACKS:
            return CUISINE_FALLBACKS[cuisine_lower]
    
    # Use a consistent generic fallback based on recipe name hash
    hash_val = int(hashlib.md5(name_lower.encode()).hexdigest(), 16)
    return GENERIC_FOOD_IMAGES[hash_val % len(GENERIC_FOOD_IMAGES)]

def get_cuisine_specific_image(recipe_name: str, cuisine: str) -> str:
    """
    Fetch cuisine-specific food image.
    """
    return get_food_image(recipe_name, cuisine)

async def get_food_images_batch(recipe_names: List[str], cuisine: str = None) -> dict:
    """
    Fetch multiple food images at once.
    Returns a dict mapping recipe names to image URLs.
    """
    return {name: get_food_image(name, cuisine) for name in recipe_names}
