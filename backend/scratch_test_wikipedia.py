import httpx
import asyncio

async def search_wikipedia_image(title: str) -> str:
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "prop": "pageimages",
        "format": "json",
        "piprop": "original",
        "titles": title,
        "redirects": 1
    }
    # Try English Wikipedia
    async with httpx.AsyncClient() as client:
        res = await client.get(url, params=params)
        if res.status_code == 200:
            data = res.json()
            pages = data.get("query", {}).get("pages", {})
            for page_id, page in pages.items():
                if "original" in page:
                    return page["original"].get("source")
        
        # Try Indonesian Wikipedia
        url_id = "https://id.wikipedia.org/w/api.php"
        res = await client.get(url_id, params=params)
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
        img = await search_wikipedia_image(p)
        print(f"{p} image URL: {img}")

if __name__ == "__main__":
    asyncio.run(test())
