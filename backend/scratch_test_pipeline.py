import os
import sys
import asyncio
from dotenv import load_dotenv

# Add parent directory to path so we can import routers and services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

from services.google_places import enrich_place_details
from routers.trips import enrich_itinerary_items, generate_fallback_itinerary

async def test_places():
    print("Testing Google Places Enrichment:")
    place = "Monas"
    city = "Jakarta"
    res = await enrich_place_details(place, city)
    print(f"Enrichment for '{place}' in '{city}':")
    print(res)
    print("-" * 50)

    # Let's try another place
    place2 = "Candi Borobudur"
    city2 = "Yogyakarta"
    res2 = await enrich_place_details(place2, city2)
    print(f"Enrichment for '{place2}' in '{city2}':")
    print(res2)
    print("-" * 50)

async def test_fallback():
    print("Testing Fallback Itinerary Generation:")
    result = generate_fallback_itinerary("Medan", "cultural", 2)
    print(f"Result count: {len(result)}")
    for item in result[:5]:
        print(item)
    print("-" * 50)

async def main():
    await test_places()
    await test_fallback()

if __name__ == "__main__":
    asyncio.run(main())
