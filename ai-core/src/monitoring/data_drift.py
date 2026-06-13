import numpy as np
from scipy.stats import ks_2samp
from src.monitoring.logging import logger

class DataDriftDetector:
    def __init__(self, window_size: int = 100):
        self.window_size = window_size
        self.current_window = []

        # Baseline referensi: Nilai rata-rata panjang preferensi dari fase training/testing awal
        # Misal saat testing, panjang teks preferensi user rata-rata terdistribusi normal di sekitar angka ini
        np.random.seed(42)
        self.reference_baseline = np.random.normal(loc=45, scale=15, size=200).tolist()

    def add_prediction_input(self, text_length: int):
        """Memasukkan data panjang teks input terbaru ke dalam rolling window."""
        self.current_window.append(text_length)
        if len(self.current_window) > self.window_size:
            self.current_window.pop(0)  # Buang data paling lama (FIFO)

    def detect_drift(self):
        """
        Menghitung Data Drift menggunakan Kolmogorov-Smirnov Test.
        Returns:
            drift_detected (bool): True jika distribusi bergeser signifikan (p-value < 0.05)
            p_value (float): Nilai p-value hasil pengujian statistik
        """
        if len(self.current_window) < self.window_size:
            # Data belum cukup untuk ditarik kesimpulan statistik
            return False, 1.0

        # Eksekusi KS-Test membandingkan Baseline vs Input Real-time
        stat, p_value = ks_2samp(self.reference_baseline, self.current_window)

        # Aturan umum statistik: jika p-value < 0.05, maka hipotesis nol ditolak (ada drift)
        drift_detected = p_value < 0.05

        if drift_detected:
            logger.warning(f"[MLOps Drift] ALERT: Data Drift terdeteksi pada text input! p-value: {p_value:.4f}")

        return drift_detected, p_value

# Inisialisasi detector secara global agar bisa dipanggil dari main.py
drift_detector = DataDriftDetector(window_size=50)
