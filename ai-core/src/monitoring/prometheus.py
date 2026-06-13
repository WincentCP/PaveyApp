from prometheus_client import Counter, Histogram
import time

# =====================================================================
# PROMETHEUS METRICS DEFINITION
# =====================================================================

# 1. Metrik untuk menghitung total request pencarian rekomendasi berdasarkan kota
RECOMMENDATION_REQUESTS = Counter(
    "pavey_recommender_requests_total",  # Ditambahkan prefix pavey_
    "Total pencarian rekomendasi wisata berdasarkan kota asal/tujuan",
    ["city"]
)

# 2. Metrik untuk memantau seberapa sering kebijakan Fallback Safety diaktifkan karena skor rendah
FALLBACK_TRIGGERED_TOTAL = Counter(
    "pavey_recommender_fallback_triggered_total",  # Ditambahkan prefix pavey_
    "Total aktivasi sistem fallback otomatis akibat kemiripan semantik di bawah threshold",
    ["city"]
)

# 3. Metrik untuk mengukur latensi (kecepatan) proses komputasi hybrid scoring model dalam detik
RECOMMENDATION_LATENCY = Histogram(
    "pavey_recommender_latency_seconds",  # Ditambahkan prefix pavey_
    "Durasi waktu respons pencarian rekomendasi semantic-hybrid",
    buckets=(0.1, 0.2, 0.5, 1.0, 2.0, 5.0)
)

# =====================================================================
# CORE HELPER ENGINE
# =====================================================================

def track_recommendation_metrics(city: str, fallback_active: bool, start_time: float):
    """
    Helper function untuk mencatat metrik real-time pasca fungsi rekomendasi dipanggil.
    Dibungkus try-except agar tidak memutus flow inference jika Prometheus busy.
    """
    try:
        # Catat penambahan total request kota terkait (pastikan di-string-kan biar aman dari tipe data aneh)
        RECOMMENDATION_REQUESTS.labels(city=str(city)).inc()

        # Jika terdeteksi fallback aktif, naikkan counter Prometheus
        if fallback_active:
            FALLBACK_TRIGGERED_TOTAL.labels(city=str(city)).inc()

        # Hitung durasi waktu pengeksekusian kode
        latency = time.time() - start_time
        RECOMMENDATION_LATENCY.observe(latency)

    except Exception as prom_err:
        # Biar ketahuan di docker logs kalau ada problem label mismatch, tanpa nge-crash-in API
        print(f"[Prometheus Recommender Error] Gagal mencatat telemetri hybrid: {str(prom_err)}")
