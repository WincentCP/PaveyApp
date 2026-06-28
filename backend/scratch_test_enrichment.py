import asyncio
import sys
from services.google_places import enrich_place_details

async def main():
    print("Testing enrich_place_details with Wikidata/Wikipedia fallback...")
    res = await enrich_place_details("The Well Kuta Lombok", "Lombok")
    print("Result for The Well Kuta Lombok:", res)
    img_url = res.get("image")
    if img_url:
        import httpx
        try:
            async with httpx.AsyncClient() as client:
                res_img = await client.head(img_url, timeout=5.0)
                print("Image URL Status Code:", res_img.status_code)
                print("Image URL Headers:", dict(res_img.headers))
        except Exception as e:
            print("Error checking image URL:", e)

if __name__ == "__main__":
    asyncio.run(main())
