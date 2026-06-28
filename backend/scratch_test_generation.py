import os
import sys
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

async def test_generation():
    ai_core_url = os.getenv("AI_CORE_URL", "http://localhost:8080")
    payload = {
        "city": "Jakarta",
        "preference": "cultural",
        "num_places": 4,
        "start_datetime": "2026-06-20T09:00:00",
        "duration_per_place": [60, 60, 60, 60],
        "place_type": "all",
        "exclude_names": []
    }
    print(f"Testing generation via: {ai_core_url}/api/v1/generate-itinerary")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(f"{ai_core_url}/api/v1/generate-itinerary", json=payload)
            print(f"Status Code: {res.status_code}")
            if res.status_code == 200:
                data = res.json()
                print("Generated Places:")
                for item in data.get("itinerary", []):
                    print(f"- {item.get('name')} (Rating: {item.get('rating')}, Lat: {item.get('latitude')}, Lng: {item.get('longitude')})")
            else:
                print(f"Error response: {res.text}")
    except Exception as e:
        print(f"Error calling generation: {e}")

if __name__ == "__main__":
    asyncio.run(test_generation())
