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

    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": PLACES_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.photos,places.priceLevel,places.rating,places.userRatingCount,places.location"
    }

    query = "Campuhan Ridge Walk Ubud"
    payload = {
        "textQuery": query,
        "languageCode": "id"
    }

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, headers=headers, timeout=10.0)
            print("Status Code:", res.status_code)
            print("Response:", res.text)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test_places())
