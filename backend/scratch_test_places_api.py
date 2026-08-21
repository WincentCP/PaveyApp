import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()
PLACES_KEY = os.getenv("GOOGLE_PLACES_API_KEY")

async def test_places():
    print("PLACES_KEY:", PLACES_KEY)
    if not PLACES_KEY:
        print("No Places Key found")
        return

    # 1. Test New Places API (v1)
    url_v1 = "https://places.googleapis.com/v1/places:searchText"
    headers_v1 = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": PLACES_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.photos,places.priceLevel,places.rating,places.userRatingCount,places.location"
    }
    payload_v1 = {
        "textQuery": "Campuhan Ridge Walk Ubud",
        "languageCode": "id"
    }

    print("\n--- Testing v1 (New) API ---")
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url_v1, json=payload_v1, headers=headers_v1, timeout=10.0)
            print("V1 Status Code:", res.status_code)
            print("V1 Response:", res.text[:500])
    except Exception as e:
        print("V1 Error:", e)

    # 2. Test Legacy Places API (v0)
    url_v0 = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params_v0 = {
        "query": "Campuhan Ridge Walk Ubud",
        "key": PLACES_KEY
    }

    print("\n--- Testing v0 (Legacy) API ---")
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url_v0, params=params_v0, timeout=10.0)
            print("V0 Status Code:", res.status_code)
            print("V0 Response:", res.text[:500])
    except Exception as e:
        print("V0 Error:", e)

if __name__ == "__main__":
    asyncio.run(test_places())
