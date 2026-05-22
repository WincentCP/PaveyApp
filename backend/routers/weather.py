from fastapi import APIRouter, HTTPException
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()

WEATHER_KEY = os.getenv("OPENWEATHER_API_KEY")

@router.get("/current")
async def get_weather(lat: float, lon: float):
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={
                    "lat": lat,
                    "lon": lon,
                    "appid": WEATHER_KEY,
                    "units": "metric",
                    "lang": "id"
                }
            )
        data = res.json()
        return {
            "city": data["name"],
            "temp_celsius": data["main"]["temp"],
            "humidity": data["main"]["humidity"],
            "condition": data["weather"][0]["description"],
            "icon": data["weather"][0]["icon"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))