import os
import json
import time
import math
from datetime import datetime, timedelta
from typing import List, Optional

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv(override=True)

# Core FastAPI framework
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Integrasi Eksternal Layanan MLOps & Third-Party
import redis
import sentry_sdk
import groq
from groq import Groq
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

# ==========================================
# 1. IMPORT MODULAR
# ==========================================
from src.config import Config
from src.pipelines.inference import InferencePipeline
from src.services.weather_service import WeatherService
from src.services.routing_service import RoutingService
from src.monitoring.logging import logger

# Import data drift detector suite terbaru
from src.monitoring.data_drift import drift_detector

# Import metrik dan manager telemetri dari monitoring suite yang sudah diperbarui
from src.monitoring.telemetry import (
    TelemetryManager,
    API_LATENCY,
    WEATHER_FILTER_TRIGGERED,
    INPUT_LENGTH_GAUGE,
    DATA_DRIFT_P_VALUE,
    DATA_DRIFT_ALERTS_TOTAL
)

# Ambil environment variables secara langsung tanpa class Config
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OSRM_BASE_URL = os.getenv("OSRM_BASE_URL", "http://router.project-osrm.org")

# Fallback model chain: if primary hits rate limit (429), try next in list
GROQ_MODELS_FALLBACK = [
    os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
]
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
SENTRY_DSN = os.getenv("SENTRY_DSN")

# =====================================================================
# MONKEY PATCH: SINKRONISASI HTTPX 0.28.0+ DENGAN SDK GROQ
# =====================================================================
from groq._base_client import SyncHttpxClientWrapper

class CustomGroqHttpxClientWrapper(SyncHttpxClientWrapper):
    def __init__(self, *args, **kwargs):
        # Buang argumen 'proxies' yang sudah dihapus oleh httpx versi terbaru
        kwargs.pop("proxies", None)
        super().__init__(*args, **kwargs)

# Inject patch ke module internal Groq secara aman
groq._base_client.SyncHttpxClientWrapper = CustomGroqHttpxClientWrapper
# =====================================================================

# Inisialisasi Sentry Error Tracking langsung dari environment variable
if SENTRY_DSN:
    try:
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            traces_sample_rate=1.0,
            profiles_sample_rate=1.0,
            environment="production"
        )
        logger.info("[AIOps] Sentry Error Tracking berhasil diaktifkan via .env DSN.")
    except Exception as sentry_err:
        logger.error(f"[AIOps Warning] Gagal memuat Sentry DSN dari .env: {str(sentry_err)}")

app = FastAPI(
    title="Pavey Enterprise AI Core API",
    version="2.0.0",
    description="Sistem API Rekomendasi RAG Pariwisata berbasis Intelijen Cuaca, Spasial OSRM, Koordinat Akurat, dan MLOps Suite Telemetri."
)

# Mengaktifkan CORS secara komprehensif agar Frontend PWA tidak terkena blokir
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inisialisasi komponen state aplikasi dan pipeline inferensi lokal
inference_pipeline = InferencePipeline()
weather_service = WeatherService(api_key=OPENWEATHER_API_KEY)
routing_service = RoutingService(base_url=OSRM_BASE_URL)

# Klien Redis Caching Layer menggunakan URL langsung dari .env
try:
    redis_cache = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    redis_cache.ping()
    logger.info("[Cache Engine] Berhasil terhubung ke Redis Server via .env URL.")
except Exception as ex:
    redis_cache = None
    logger.error(f"[Cache Engine] Koneksi Redis gagal! Aplikasi berjalan tanpa API Caching: {str(ex)}")

@app.on_event("startup")
def startup_event():
    """Hook startup FastAPI untuk memuat matriks kesamaan IBM Granite ke memori."""
    logger.info("[System Lifecycle] Memulai inisialisasi basis pengetahuan model...")
    inference_pipeline.initialize_system()
    logger.info("[System Lifecycle] Inisialisasi sistem selesai. API Core siap menerima request.")

# Skema Data Validation (Pydantic)
class TravelPlannerRequest(BaseModel):
    city: str = Field(..., example="Jakarta", description="Nama kota destinasi wisata")
    preference: str = Field(..., example="Wisata sejarah dan kuliner lokal", description="Preferensi personalisasi user")
    num_places: int = Field(default=5, ge=1, le=15, description="Jumlah rekomendasi tempat lokasi objek wisata")
    start_datetime: str = Field(..., example="2026-05-25T09:00:00", description="Waktu awal mulai perjalanan format ISO")
    duration_per_place: List[int] = Field(
        default_factory=lambda: [60],
        example=[120, 60, 90, 60, 120],
        description="Array durasi kunjungan per lokasi berurutan dalam satuan menit"
    )
    place_type: str = Field(default="all", example="destination", description="Filter tipe lokasi: 'destination', 'restaurant', atau 'all'")
    price_level: Optional[int] = Field(default=None, ge=0, le=5, example=0, description="Filter tingkat harga (0=Gratis, 1-5 skala Google). Kosongi untuk semua.")
    bypass_cache: Optional[bool] = Field(default=False, description="Bypass Redis cache dan acak kandidat")
    exclude_names: Optional[List[str]] = Field(default_factory=list, description="Daftar nama tempat yang dikecualikan dari generasi")

# ==========================================
# 2. ENDPOINT ROUTE IMPLEMENTATION
# ==========================================

@app.get("/metrics")
def get_prometheus_metrics():
    """Exposed Endpoint untuk ditarik (scraped) oleh Prometheus Server secara periodik."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.post("/api/v1/generate-itinerary")
def generate_itinerary(payload: TravelPlannerRequest):
    start_execution_time = time.time()

    # ----------------------------------------------------------------------
    # MLOps DATA DRIFT MONITORING SUITE
    # ----------------------------------------------------------------------
    try:
        TelemetryManager.monitor_data_drift(payload.preference)
        pref_len = len(payload.preference)
        drift_detector.add_prediction_input(pref_len)
        is_drift, p_val = drift_detector.detect_drift()

        DATA_DRIFT_P_VALUE.set(p_val)
        if is_drift:
            DATA_DRIFT_ALERTS_TOTAL.inc()

    except Exception as drift_err:
        warning_msg = f"[Telemetry Warning] Gagal menguji status data drift: {str(drift_err)}"
        logger.warning(warning_msg)

    req_place_type = payload.place_type.lower().strip() if payload.place_type else "all"
    req_price_level = payload.price_level

    # ----------------------------------------------------------------------
    # VALIDASI & SANITIZATION DURASI ARRAY DINAMIS PER TEMPAT
    # ----------------------------------------------------------------------
    validated_durations = []
    raw_durations = payload.duration_per_place if payload.duration_per_place else [60]

    for i in range(payload.num_places):
        if i < len(raw_durations):
            dur = raw_durations[i]
            if dur is None or dur <= 0 or dur > 480:
                validated_durations.append(60)
            else:
                validated_durations.append(dur)
        else:
            validated_durations.append(60)

    # ----------------------------------------------------------------------
    # LAYER 1: API CACHING STRATEGY (Redis)
    # ----------------------------------------------------------------------
    durations_cache_str = "-".join(map(str, validated_durations))
    exclude_names_str = "-".join(sorted([n.lower().strip() for n in (payload.exclude_names or [])]))
    cache_key = (
        f"itinerary:v7:{payload.city.lower().replace(' ', '_')}:"
        f"{hash(payload.preference)}:{payload.num_places}:{payload.start_datetime}:"
        f"{durations_cache_str}:{req_place_type}:{req_price_level}:{exclude_names_str}"
    )

    if redis_cache and not payload.bypass_cache:
        try:
            cached_itinerary = redis_cache.get(cache_key)
            if cached_itinerary:
                logger.info(f"[AIOps Cache] HIT! Mengembalikan respons tersimpan untuk kunci: {cache_key}")
                API_LATENCY.labels(endpoint="/generate-itinerary").observe(time.time() - start_execution_time)
                return json.loads(cached_itinerary)
        except Exception as cache_err:
            logger.error(f"[AIOps Cache] Gagal membaca data dari Redis: {str(cache_err)}")

    # ----------------------------------------------------------------------
    # LAYER 2: VALIDASI WAKTU & DATA KNOWLEDGE EXTRACTION (IBM GRANITE)
    # ----------------------------------------------------------------------
    try:
        user_datetime_obj = datetime.fromisoformat(payload.start_datetime)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Format skema 'start_datetime' salah. Wajib menggunakan standar ISO format (YYYY-MM-DDTHH:MM:SS)."
        )

    # Dapatkan lebih banyak rekomendasi jika ada pengecualian agar tidak kekurangan kandidat
    top_n_candidates = max(payload.num_places * 4, 35) if payload.exclude_names else payload.num_places * 4

    candidate_df = inference_pipeline.get_recommendations(
        city=payload.city,
        preference=payload.preference,
        top_n=top_n_candidates,
        user_datetime=user_datetime_obj
    )

    if candidate_df is not None and not candidate_df.empty and payload.exclude_names:
        exclude_set = {name.lower().strip() for name in payload.exclude_names if name}
        candidate_df = candidate_df[~candidate_df["name"].str.lower().str.strip().isin(exclude_set)]

    if candidate_df is None or candidate_df.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Tidak ditemukan objek wisata yang cocok di kota '{payload.city}' untuk preferensi tersebut."
        )

    # ----------------------------------------------------------------------
    # FILTERING LAYER: KUSTOMISASI PAYLOAD USER (Place Type & Price Level)
    # ----------------------------------------------------------------------
    if req_place_type in ["destination", "restaurant", "resto", "dest"]:
        mapped_type = "restaurant" if req_place_type in ["restaurant", "resto"] else "destination"
        if "place_type" in candidate_df.columns:
            filtered_df = candidate_df[candidate_df["place_type"].str.lower() == mapped_type]
            if not filtered_df.empty:
                candidate_df = filtered_df
            else:
                logger.warning(f"[Filter Engine] Tipe '{mapped_type}' tidak ditemukan. Mengabaikan filter tipe.")

    if req_price_level is not None:
        if "price_level" in candidate_df.columns:
            if req_price_level == 0:
                filtered_df = candidate_df[
                    (candidate_df["price_level"] == 0) | (candidate_df["price_level"].isna())
                ]
            elif req_price_level <= 2:
                filtered_df = candidate_df[
                    (candidate_df["price_level"] == req_price_level) |
                    (candidate_df["price_level"] == 0) |
                    (candidate_df["price_level"].isna())
                ]
            else:
                filtered_df = candidate_df[candidate_df["price_level"] == req_price_level]

            if not filtered_df.empty:
                candidate_df = filtered_df
            else:
                logger.warning(f"[Filter Engine] Tingkat harga {req_price_level} tidak tersedia. Mengabaikan filter harga.")

    # ----------------------------------------------------------------------
    # LAYER 3: INTELLIGENT WEATHER AWARE FILTERING (OpenWeatherAPI)
    # ----------------------------------------------------------------------
    is_raining = (
        weather_service.check_is_raining(payload.city)
        if hasattr(weather_service, 'check_is_raining')
        else weather_service.is_raining_at_destination(payload.city)
    )

    if is_raining:
        WEATHER_FILTER_TRIGGERED.labels(city=payload.city, action="filter_indoor").inc()
        logger.info(f"[AIOps Routing] Mengaktifkan pengkondisian cuaca buruk untuk kota {payload.city}. Menyaring destinasi indoor.")

        if "indoor_outdoor" in candidate_df.columns:
            indoor_df = candidate_df[candidate_df["indoor_outdoor"].str.lower() == "indoor"]
            if not indoor_df.empty:
                candidate_df = indoor_df
            else:
                logger.warning("[AIOps Routing] Lokasi alternatif berbasis indoor tidak memadai. Kembali menggunakan data utama.")

    if payload.bypass_cache:
        # Ambil acak dari top 2x tempat agar bervariasi saat re-roll
        sample_pool = candidate_df.head(payload.num_places * 2)
        final_rec_df = sample_pool.sample(n=min(payload.num_places, len(sample_pool)))
    else:
        final_rec_df = candidate_df.head(payload.num_places)

    # ----------------------------------------------------------------------
    # LAYER 4: GEOGRAPHICAL ROUTING INJECTION (OSRM VIA DB METADATA)
    # ----------------------------------------------------------------------
    places_records = final_rec_df.to_dict(orient="records")
    rag_context_builder = ""
    current_itinerary_time = user_datetime_obj

    # Kamus penampung metadata koordinat, rating, & reviews untuk sinkronisasi pasca LLM
    metadata_mapping = {}

    for index in range(len(places_records)):
        current_node = places_records[index]
        raw_transit_time = 0
        current_place_duration = validated_durations[index]

        # Ambil koordinat kualitatif dan kuantitatif dari model recommender (Source of Truth)
        place_name_key = str(current_node.get('name', '')).strip().lower()

        current_lat = float(current_node.get("latitude", 0) if current_node.get("latitude") is not None else 0.0)
        current_lon = float(current_node.get("longitude", 0) if current_node.get("longitude") is not None else 0.0)
        current_rating = float(current_node.get("rating", 4.0) if current_node.get("rating") is not None else 4.0)
        current_reviews = int(current_node.get("total_reviews", 0) if current_node.get("total_reviews") is not None else 0)

        # Kunci data ke dalam mapping lokal Python
        metadata_mapping[place_name_key] = {
            "latitude": current_lat,
            "longitude": current_lon,
            "rating": current_rating,
            "total_reviews": current_reviews
        }

        if index < len(places_records) - 1:
            next_node = places_records[index + 1]
            func_routing = (
                routing_service.get_travel_duration_minutes
                if hasattr(routing_service, 'get_travel_duration_minutes')
                else routing_service.calculate_travel_time
            )

            # Gunakan koordinat presisi terenkripsi dari DB untuk menghitung jarak rute spasial OSRM
            raw_transit_time = func_routing(
                current_lat, current_lon,
                float(next_node.get("latitude", 0) if next_node.get("latitude") is not None else 0.0),
                float(next_node.get("longitude", 0) if next_node.get("longitude") is not None else 0.0)
            )

        rounded_transit_time = math.ceil(raw_transit_time / 5.0) * 5
        if rounded_transit_time == 0 and raw_transit_time > 0:
            rounded_transit_time = 5

        arrival_string = current_itinerary_time.strftime("%H:%M")

        current_node["calculated_arrival_time"] = arrival_string
        current_node["calculated_transit_to_next"] = rounded_transit_time
        current_node["calculated_duration_stay"] = current_place_duration

        # Bangun teks konteks RAG terstruktur untuk diinjeksikan ke instruksi LLM
        rag_context_builder += (
            f"- Destinasi {index+1}: {current_node.get('name', 'N/A')} | "
            f"Tipe Tempat: {current_node.get('place_type', 'N/A')} | "
            f"Level Harga: {current_node.get('price_level', 'N/A')}/5 | "
            f"Koordinat Lokasi: {current_lat}, {current_lon} | "
            f"Rating: {current_rating} | "
            f"Total Ulasan: {current_reviews} | "
            f"Jam Operasional Hari Ini: {current_node.get('today_hours', 'N/A')} | "
            f"WAKTU TIBA HARUS: {arrival_string} | "
            f"DURASI KUNJUNGAN: {current_place_duration} Menit | "
            f"Estimasi Perjalanan Terbuang Ke Titik Berikutnya (Sudah Dibulatkan): {rounded_transit_time} Menit\n"
        )

        current_itinerary_time += timedelta(minutes=current_place_duration + rounded_transit_time)

    # ----------------------------------------------------------------------
    # LAYER 5: ORKESTRASI LLM VIA GROQ CLIENT (RAG INJECTION)
    # ----------------------------------------------------------------------
    system_instruction = (
        "You are an Expert AI Travel Planner for the Pavey application. "
        "Your main task is to structure the user's travel schedule into a clean, logical sequence. "
        "You MUST respond entirely in ENGLISH. All text fields, including 'activity_todo', MUST be written in fluent English. "
        "You MUST return the final output as a pure JSON Object with the structure: {\"itinerary\": [...]}. "
        "Do not include any markdown code wrappers like ```json ... ``` or any extra conversational text."
    )

    user_generation_prompt = f"""
    Create a highly realistic, polished, and logical travel itinerary in {payload.city} based on this structured RAG context data:
    {rag_context_builder}

    USER STARTING DATETIME: {user_datetime_obj.strftime('%A, %d %B %Y at %H:%M')}
    LOCAL WEATHER CONDITION: {'RAINY (Strictly optimize for Indoor locations)' if is_raining else 'CLEAR / NORMAL'}

    STRICT TIME-CALCULATION RULES:
    1. Step 1 MUST start exactly at the USER STARTING DATETIME.
    2. LINEAR TIME ACCUMULATION LAW: The arrival time (`arrival_time`) for each step MUST match exactly with the 'WAKTU TIBA HARUS' value specified in the context layer above. Do not recalculate or guess.
    3. You MUST preserve the exact numbers from the context for `duration_spent_minutes` and `travel_time_to_next_minutes` for each respective destination.

    STRICT FORMATTING, COORDINATE & CLASSIFICATION RULES:
    4. PROPER CAPITALIZATION: You MUST capitalize the first letter of each word for the `"name"` field.
    5. ACCURATE TYPE MAPPING: Map the `"type"` field directly from the context ('restaurant' or 'destination').
    6. MAP GEOGRAPHICAL & METADATA: Extract and pass the exact `"latitude"`, `"longitude"`, `"rating"`, and `"total_reviews"` from the context into each respective JSON object.
    7. Provide specific, engaging, and creative 'activity_todo' descriptions in fluent ENGLISH, perfectly customized to the user's core preference: "{payload.preference}".

    The output format MUST be a raw JSON Object adhering strictly to this structure:
    {{
      "itinerary": [
        {{
          "step": 1,
          "type": "destination or restaurant from context",
          "name": "Proper Case Place Name from Context",
          "arrival_time": "HH:MM (Ambil mutlak dari WAKTU TIBA HARUS)",
          "duration_spent_minutes": "Ambil angka DURASI KUNJUNGAN lokasi ini",
          "travel_time_to_next_minutes": "Ambil dari Estimasi Perjalanan Terbuang ke titik berikutnya",
          "rating": "Numerical rating value from context",
          "total_reviews": "Integer total reviews value from context",
          "latitude": "Numerical latitude coordinate from context",
          "longitude": "Numerical longitude coordinate from context",
          "activity_todo": "Detailed English description based on preference"
        }}
      ]
    }}
    """

    try:
        groq_client = Groq(api_key=GROQ_API_KEY)

        # --- Model fallback chain: retry with smaller models on 429 rate limit ---
        chat_completion = None
        groq_model = None
        last_error = None
        for candidate_model in GROQ_MODELS_FALLBACK:
            try:
                logger.info(f"[Inference] Mencoba model: {candidate_model}")
                chat_completion = groq_client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": user_generation_prompt}
                    ],
                    model=candidate_model,
                    response_format={"type": "json_object"},
                    temperature=0.25,
                    max_tokens=2048
                )
                groq_model = candidate_model
                logger.info(f"[Inference] Berhasil menggunakan model: {groq_model}")
                break
            except Exception as model_err:
                err_str = str(model_err)
                if "429" in err_str or "rate_limit" in err_str.lower():
                    logger.warning(f"[Inference] Rate limit pada model '{candidate_model}', mencoba fallback berikutnya... ({err_str[:120]})")
                    last_error = model_err
                    continue
                else:
                    # Non-rate-limit error: re-raise immediately
                    raise

        if chat_completion is None:
            raise last_error or RuntimeError("Semua model Groq mencapai rate limit. Coba lagi nanti.")

        response_payload_text = chat_completion.choices[0].message.content

        actual_prompt_tokens = chat_completion.usage.prompt_tokens
        actual_completion_tokens = chat_completion.usage.completion_tokens

        try:
            TelemetryManager.log_inference_telemetry(
                prompt_tokens=actual_prompt_tokens,
                completion_tokens=actual_completion_tokens,
                model_name=groq_model
            )
        except Exception as prom_err:
            logger.error(f"[Prometheus Error] Gagal melakukan push telemetri: {str(prom_err)}")

        # Parsing hasil output JSON mentah dari Groq API
        parsed_itinerary_json = json.loads(response_payload_text)
        if isinstance(parsed_itinerary_json, dict) and "itinerary" in parsed_itinerary_json:
            parsed_itinerary_json = parsed_itinerary_json["itinerary"]

        # --- SINKRONISASI PASCA INFERENCE: STANDARISASI TIPE DATA & AKURASI KOORDINAT ---
        for idx, item in enumerate(parsed_itinerary_json):
            item_name_lower = str(item.get("name", "")).strip().lower()

            # Siapkan backup metadata jikalau LLM melakukan halusinasi salin data
            backup_meta = metadata_mapping.get(
                item_name_lower,
                {"latitude": 0.0, "longitude": 0.0, "rating": 4.0, "total_reviews": 100}
            )

            # Validasi tipe data Float & Integer agar stabil saat dibaca oleh PWA Frontend
            try:
                item["rating"] = float(item.get("rating", backup_meta["rating"]))
                item["total_reviews"] = int(item.get("total_reviews", backup_meta["total_reviews"]))
                item["latitude"] = float(item.get("latitude", backup_meta["latitude"]))
                item["longitude"] = float(item.get("longitude", backup_meta["longitude"]))
            except:
                item["rating"] = backup_meta["rating"]
                item["total_reviews"] = backup_meta["total_reviews"]
                item["latitude"] = backup_meta["latitude"]
                item["longitude"] = backup_meta["longitude"]

            # Keamanan Tambahan: Paksa konversi waktu agar kalkulator transit tidak broken
            try:
                item["duration_spent_minutes"] = int(item["duration_spent_minutes"])
                item["travel_time_to_next_minutes"] = int(item["travel_time_to_next_minutes"])
            except:
                pass

        final_api_response = {
            "status": "success",
            "city": payload.city,
            "weather_mode": "Rain-Adaptive (Indoor)" if is_raining else "Standard (Clear)",
            "start_time": payload.start_datetime,
            "filters_applied": {
                "place_type": req_place_type,
                "price_level": req_price_level,
                "durations_per_place_minutes": validated_durations
            },
            "telemetry": {
                "prompt_tokens": actual_prompt_tokens,
                "completion_tokens": actual_completion_tokens,
                "total_tokens": chat_completion.usage.total_tokens
            },
            "itinerary": parsed_itinerary_json
        }

        # Simpan hasil ke Redis Cache Layer menggunakan default TTL (3600 detik)
        if redis_cache:
            try:
                redis_cache.setex(
                    name=cache_key,
                    time=3600,
                    value=json.dumps(final_api_response)
                )
            except Exception as cache_write_err:
                logger.error(f"[AIOps Cache] Gagal menulis hasil ke Redis: {str(cache_write_err)}")

        API_LATENCY.labels(endpoint="/generate-itinerary").observe(time.time() - start_execution_time)
        return final_api_response

    except Exception as llm_error:
        sentry_sdk.capture_exception(llm_error)
        logger.error(f"[AIOps Critical Fail] Gangguan pada proses inferensi LLM Core: {str(llm_error)}")
        raise HTTPException(status_code=500, detail=f"AI Generation Error: {str(llm_error)}")
