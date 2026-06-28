import httpx
import asyncio

async def search_wikipedia_image_by_search(query: str) -> str:
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": query,
        "gsrlimit": 1,
        "prop": "pageimages",
        "piprop": "original",
        "redirects": 1
    }
    headers = {"User-Agent": "PaveyApp/1.0 (contact@pavey.app)"}
    # Try English Wikipedia first
    async with httpx.AsyncClient() as client:
        res = await client.get(url, params=params, headers=headers)
        if res.status_code == 200:
            data = res.json()
            pages = data.get("query", {}).get("pages", {})
            for page_id, page in pages.items():
                if "original" in page:
                    return page["original"].get("source")
        
        # Try Indonesian Wikipedia
        url_id = "https://id.wikipedia.org/w/api.php"
        res = await client.get(url_id, params=params, headers=headers)
        if res.status_code == 200:
            data = res.json()
            pages = data.get("query", {}).get("pages", {})
            for page_id, page in pages.items():
                if "original" in page:
                    return page["original"].get("source")
    return ""

async def test():
    places = ["Monas", "Borobudur", "Gedung Sate", "Eiffel Tower", "Louvre Museum"]
    for p in places:
        img = await search_wikipedia_image_by_search(p)
        print(f"{p} image URL: {img}")

if __name__ == "__main__":
    asyncio.run(test())
