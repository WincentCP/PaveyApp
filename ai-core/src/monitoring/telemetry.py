from prometheus_client import Counter, Histogram, Gauge
import tiktoken

# =====================================================================
# PROMETHEUS METRICS DEFINITION
# =====================================================================

# 1. Token Usage: Gunakan label 'model' dan 'token_type' agar klop dengan main.py
LLM_TOKEN_USAGE = Counter(
    "pavey_llm_token_usage_total",  # Disamakan dengan prefix global
    "Total token consumed by Groq LLM instances",
    ["model", "token_type"]         # Diubah dari 'type' ke 'token_type'
)

# 2. Weather Filter: Pastikan label 'city' dan 'action' terdaftar resmi
WEATHER_FILTER_TRIGGERED = Counter(
    "pavey_weather_filter_triggered_total",
    "Total weather adaptations triggered",
    ["city", "action"]
)

# 3. API Latency
API_LATENCY = Histogram(
    "pavey_api_latency_seconds",
    "End-to-End API Latency for Pavey endpoints",
    ["endpoint"]
)

# 4. Input Length: Mengikuti nama asli yang terdeteksi di Grafana lu kemarin
INPUT_LENGTH_GAUGE = Gauge(
    "pavey_input_preference_length",
    "Data Drift proxy: preference length string metric"
)

class TelemetryManager:
    @staticmethod
    def count_tokens(text: str, model_name: str = "gpt-3.5-turbo") -> int:
        """Mengestimasi token menggunakan tiktoken encoder untuk pemantauan drift/biaya."""
        try:
            encoding = tiktoken.encoding_for_model(model_name)
            return len(encoding.encode(text))
        except Exception:
            return len(text.split())  # Fallback estimasi kasar jika library bermasalah

    @staticmethod
    def log_inference_telemetry(prompt_tokens: int, completion_tokens: int, model_name: str = "llama-3.1-8b-instant"):
        """Fungsi pembungkus aman untuk push data token ke Prometheus registry."""
        try:
            LLM_TOKEN_USAGE.labels(model=model_name, token_type="input").inc(int(prompt_tokens))
            LLM_TOKEN_USAGE.labels(model=model_name, token_type="output").inc(int(completion_tokens))
        except Exception as e:
            # Jangan di-pass doang, biar kelihatan di docker logs kalau ada problem label mismatch
            print(f"[Telemetry Warning] Gagal mencatat token usage: {str(e)}")

    @staticmethod
    def monitor_data_drift(preference_text: str):
        """MLOps Drift Detection Proxy: Mencatat panjang string preferensi user."""
        try:
            INPUT_LENGTH_GAUGE.set(len(preference_text))
        except Exception as e:
            print(f"[Telemetry Warning] Gagal mencatat data drift: {str(e)}")
