import httpx
import asyncio
import re

async def test_ddg_images(query: str):
    # Try searching on DuckDuckGo images page or a simple search engine
    url = "https://html.duckduckgo.com/html/"
    params = {"q": f"{query} landmark photo"}
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, params=params, headers=headers, timeout=5.0)
            if res.status_code == 200:
                html = res.text
                # DuckDuckGo HTML search returns links. We can search for image links or look at another service
                print("DDG HTML Status:", res.status_code)
                # Let's try to extract image URLs or page links
                links = re.findall(r'href="([^"]+)"', html)
                external_links = [l for l in links if not l.startswith('/') and 'duckduckgo' not in l]
                print("Found external links:", external_links[:5])
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test_ddg_images("Campuhan Ridge Walk Ubud"))
