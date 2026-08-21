import asyncio
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from routers.chatbot import enrich_chatbot_reply

async def test_chatbot_enrichment():
    print("Testing chatbot response enrichment...")
    
    sample_reply = """Tentu, berikut adalah 3 tempat makan paling asyik dan populer di Ubud, Bali yang wajib kamu coba:
    
    1. Seniman Coffee Studio - tempat ngopi hits dengan racikan kopi khas Bali.
    2. Hujan Locale - masakan nusantara dengan bahan organik segar.
    3. Bebek Bengil - bebek goreng renyah yang legendaris.
    
    DATA_JSON> {
        "intent": "recommend_places",
        "city": "Ubud",
        "intro": "Berikut beberapa rekomendasi tempat makan lezat di Ubud!",
        "places": [
            {
                "name": "Seniman Coffee Studio",
                "type": "restaurant",
                "category": "Cafe",
                "description": "Tempat ngopi hits yang menyajikan speciality coffee."
            },
            {
                "name": "Hujan Locale",
                "type": "restaurant",
                "category": "Foodie",
                "description": "Menawarkan hidangan Indonesia modern yang lezat."
            },
            {
                "name": "Bebek Bengil",
                "type": "restaurant",
                "category": "Foodie",
                "description": "Restoran legendaris dengan pemandangan sawah."
            }
        ]
    } <DATA_JSON
    """
    
    enriched = await enrich_chatbot_reply(sample_reply)
    print("\n--- ENRICHED REPLY OUTPUT ---")
    print(enriched)

if __name__ == "__main__":
    asyncio.run(test_chatbot_enrichment())
