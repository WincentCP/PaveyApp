import asyncio
import httpx
import re
import urllib.parse

async def test_ddg():
    query = "Seniman Coffee Studio Ubud"
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        async with httpx.AsyncClient(verify=False) as client:
            res = await client.get(url, headers=headers, timeout=10.0)
            print("Status Code:", res.status_code)
            html = res.text
            print("HTML Length:", len(html))
            
            # Find any image or website links
            # DuckDuckGo HTML search results are a list of links:
            # <a class="result__snippet" href="..."> ... </a>
            print("HTML snippet:")
            print(html[:1500])
            links = re.findall(r'href="([^"]+)"', html)
            print("Found links:", links[:15])
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_ddg())
