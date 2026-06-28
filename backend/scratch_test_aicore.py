import os
import sys
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

async def test_aicore():
    ai_core_url = os.getenv("AI_CORE_URL", "http://localhost:8080")
    print(f"Testing AI Core URL: {ai_core_url}")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(f"{ai_core_url}/")
            print(f"Status Code: {res.status_code}")
            print(f"Response: {res.text}")
    except Exception as e:
        print(f"Error connecting to AI Core: {e}")

if __name__ == "__main__":
    asyncio.run(test_aicore())
