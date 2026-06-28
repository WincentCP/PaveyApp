import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

async def test_legacy_places():
    key = os.getenv("GOOGLE_PLACES_API_KEY")
    print(f"Using Google Places API Key: {key}")
    query = "Monas Jakarta"
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        "query": query,
        "key": key
    }
    async with httpx.AsyncClient() as client:
        res = await client.get(url, params=params)
        print("Legacy Status Code:", res.status_code)
        try:
            data = res.json()
            print("Full Data:", data)
            print("Status:", data.get("status"))
            results = data.get("results", [])
            if results:
                match = results[0]
                print("Name:", match.get("name"))
                print("Rating:", match.get("rating"))
                print("Location:", match.get("geometry", {}).get("location"))
                photos = match.get("photos", [])
                if photos:
                    ref = photos[0].get("photo_reference")
                    photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference={ref}&key={key}"
                    print("Photo URL:", photo_url)
                else:
                    print("No photos found.")
            else:
                print("No results found.")
        except Exception as e:
            print("Error parsing json:", e)

if __name__ == "__main__":
    asyncio.run(test_legacy_places())
