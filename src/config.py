import os
import sentry_sdk
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class Config:
    # API Keys & External Services
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
    OSRM_BASE_URL = os.getenv("OSRM_BASE_URL", "http://router.project-osrm.org")

    # Paths
    RAW_DATA_PATH = os.path.join(BASE_DIR, "data/processed/dataset_rekomendasi_final.csv")

    # Redis Caching Config
    REDIS_URL = os.getenv("REDIS_URL", "redis://pavey-cache:6379/0")
    CACHE_TTL_SECONDS = 3600  # Caching selama 1 jam

    # Sentry DSN for Error Tracking
    SENTRY_DSN = os.getenv("SENTRY_DSN", "")

    @staticmethod
    def init_sentry():
        if Config.SENTRY_DSN:
            sentry_sdk.init(
                dsn=Config.SENTRY_DSN,
                traces_sample_rate=1.0,
                profiles_sample_rate=1.0,
            )
