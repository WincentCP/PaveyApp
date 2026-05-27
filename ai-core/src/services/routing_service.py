import requests
from src.monitoring.logging import logger

class RoutingService:
    def __init__(self, base_url: str):
        self.base_url = base_url

    def calculate_travel_time(self, lat1: float, lon1: float, lat2: float, lon2: float) -> int:
        """Mengembalikan estimasi waktu tempuh dalam satuan menit menggunakan OSRM."""
        try:
            url = f"{self.base_url}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}"
            response = requests.get(url, params={"overview": "false"}, timeout=4)
            if response.status_code == 200:
                data = response.json()
                duration_seconds = data["routes"][0]["duration"]
                return max(1, int(duration_seconds / 60))
            return 15  # Fallback default 15 menit jika API gagal
        except Exception as e:
            logger.error(f"OSRM Routing gagal dipanggil: {str(e)}")
            return 15
