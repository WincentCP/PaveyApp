import requests
from src.monitoring.logging import logger

class WeatherService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.openweathermap.org/data/2.5/weather"

    def is_raining_at_destination(self, city: str) -> bool:
        if not self.api_key:
            logger.warning("OpenWeather API Key tidak terkonfigurasi! Melewati pengecekan cuaca.")
            return False
        try:
            params = {"q": city, "appid": self.api_key, "units": "metric"}
            response = requests.get(self.base_url, params=params, timeout=5)
            if response.status_code == 200:
                data = response.json()
                weather_main = data["weather"][0]["main"].lower()
                logger.info(f"Kondisi cuaca terkini di {city}: {weather_main}")
                return "rain" in weather_main or "thunderstorm" in weather_main
            return False
        except Exception as e:
            logger.error(f"Gagal mengambil data cuaca: {str(e)}")
            return False
