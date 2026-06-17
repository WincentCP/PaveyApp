from prometheus_client import Counter, Histogram, Gauge
import tiktoken

# =====================================================================
# PROMETHEUS METRICS DEFINITION
# =====================================================================

# 1. Token Usage: Menggunakan label 'model' dan 'token_type' (input/output)
LLM_TOKEN_USAGE = Counter(
    "pavey_llm_token_usage_total",
    "Total token consumed by Groq LLM instances",
    ["model", "token_type"]
)

# 2. Weather Filter: Mencatat adaptasi filter cuaca buruk
WEATHER_FILTER_TRIGGERED = Counter(
    "pavey_weather_filter_triggered_total",
    "Total weather adaptations triggered",
    ["city", "action"]
)

# 3. API Latency: Mengukur latensi end-to-end endpoint
API_LATENCY = Histogram(
    "pavey_api_latency_seconds",
    "End-to-End API Latency for Pavey endpoints",
    ["endpoint"]
)

# 4. Input Length: Proxy untuk deteksi awal Data Drift
INPUT_LENGTH_GAUGE = Gauge(
    "pavey_input_preference_length",
    "Data Drift proxy: preference length string metric"
)

# 5. Advanced MLOps Data Drift Suite (Koneksi ke data_drift.py)
DATA_DRIFT_P_VALUE = Gauge(
    "pavey_data_drift_p_value",
    "Nilai p-value hasil uji KS-Test untuk mendeteksi pergeseran distribusi preferensi user"
)

DATA_DRIFT_ALERTS_TOTAL = Counter(
    "pavey_data_drift_alerts_total",
    "Total akumulasi peringatan data drift yang terpicu (p-value < 0.05)"
)

class TelemetryManager:
    @staticmethod
    def count_tokens(text: str, model_name: str = "cl100k_base") -> int:
        """
        Mengestimasi jumlah token menggunakan tiktoken encoder.
        Menggunakan cl100k_base sebagai fallback universal yang lebih dekat dengan tokenizer modern.
        """
        try:
            try:
                encoding = tiktoken.encoding_for_model(model_name)
            except KeyError:
                encoding = tiktoken.get_encoding("cl100k_base")
            return len(encoding.encode(text))
        except Exception:
            return len(text.split())  # Fallback kasar jika library bermasalah

    @staticmethod
    def log_inference_telemetry(prompt_tokens: int, completion_tokens: int, model_name: str = "llama-3.1-8b-instant"):
        """Fungsi pembungkus aman untuk push data token riil dari Groq API ke Prometheus."""
        try:
            LLM_TOKEN_USAGE.labels(model=model_name, token_type="input").inc(int(prompt_tokens))
            LLM_TOKEN_USAGE.labels(model=model_name, token_type="output").inc(int(completion_tokens))
        except Exception as e:
            print(f"[Telemetry Warning] Gagal mencatat token usage ke Prometheus: {str(e)}")

    @staticmethod
    def monitor_data_drift(preference_text: str):
        """MLOps Drift Detection Proxy: Mencatat panjang string preferensi user."""
        try:
            INPUT_LENGTH_GAUGE.set(len(preference_text))
        except Exception as e:
            print(f"[Telemetry Warning] Gagal mencatat data drift: {str(e)}")
