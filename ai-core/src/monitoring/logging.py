import os
import logging
from datetime import datetime
from pathlib import Path

# =====================================================================
# PATH CONFIGURATION
# =====================================================================
# __file__ ada di src/monitoring/logging.py
# .parent = src/monitoring
# .parent.parent = src/
# .parent.parent.parent = Root Proyek (Tempat docker-compose berada)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
LOG_DIR = os.path.join(ROOT_DIR, "logs")

# Buat folder logs di root proyek jika belum ada
os.makedirs(LOG_DIR, exist_ok=True)

# Format nama file log berdasarkan tanggal running
log_filename = f"pavey_pipeline_{datetime.now().strftime('%Y%m%d')}.log"
log_filepath = os.path.join(LOG_DIR, log_filename)

def setup_logger(name: str = "pavey-ai-core") -> logging.Logger:
    """
    Setup Logger terpusat untuk mencatat info, warning, dan error ke console dan file log.
    Mendukung isolasi path kontainer Docker.
    """
    logger = logging.getLogger(name)

    # Cegah duplikasi handler jika fungsi dipanggil berulang kali
    if logger.hasHandlers():
        return logger

    logger.setLevel(logging.INFO)

    # Format pencatatan log ala MLOps Production
    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(filename)s:%(lineno)d]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    try:
        # 1. Handler untuk menulis ke File Log Lokal/Volume Docker
        file_handler = logging.FileHandler(log_filepath, encoding="utf-8")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        # Fallback jika permission Docker bermasalah saat membuat file
        print(f"[Logging Warning] Gagal menginisialisasi FileHandler: {str(e)}")

    # 2. Handler untuk memunculkan di Terminal (Console / Docker Logs)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    return logger

# Instansiasi objek logger utama agar bisa langsung diimport oleh main.py dkk
logger = setup_logger()
