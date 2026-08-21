import asyncio
import sys
from services.google_places import enrich_place_details

async def test_enrich(place, city):
    res = await enrich_place_details(place, city)
    print(f"Result for {place}: {res}")

async def main():
    print("Testing enrich_place_details with Wikidata/Wikipedia fallback...")
    await test_enrich("Seniman Coffee Studio", "Ubud")
    await test_enrich("Gedung Sate", "Bandung")
    await test_enrich("Seoul Restaurant", "Seoul")

if __name__ == "__main__":
    asyncio.run(main())
