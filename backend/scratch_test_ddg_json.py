import httpx
import asyncio
import re
import json

async def fetch_ddg_image(query: str):
    # Step 1: get vqd token
    token_url = "https://duckduckgo.com/"
    params = {"q": query}
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(token_url, params=params, headers=headers, timeout=5.0)
            if res.status_code == 200:
                html = res.text
                match = re.search(r'vqd=([^&\'"]+)', html)
                if match:
                    vqd = match.group(1)
                    print("Found VQD:", vqd)
                    
                    # Step 2: request i.js
                    image_url = "https://duckduckgo.com/i.js"
                    image_params = {
                        "l": "us-en",
                        "o": "json",
                        "q": query,
                        "vqd": vqd,
                        "f": ",,,",
                        "p": "1"
                    }
                    img_res = await client.get(image_url, params=image_params, headers=headers, timeout=5.0)
                    print("Image search status:", img_res.status_code)
                    if img_res.status_code == 200:
                        data = img_res.json()
                        results = data.get("results", [])
                        if results:
                            print("First Image URL:", results[0].get("image"))
                            return results[0].get("image")
                        else:
                            print("No results in DDG JSON")
                else:
                    print("VQD not found in HTML")
            else:
                print("Failed to get HTML page, status:", res.status_code)
    except Exception as e:
        import traceback
        print("Error fetching DDG images:", type(e).__name__, e)
        traceback.print_exc()
    return None

if __name__ == "__main__":
    asyncio.run(fetch_ddg_image("Monas Jakarta"))
