# Pavey AI Core Engine (`ai-core`)

[![Framework](https://img.shields.io/badge/Framework-FastAPI-teal.svg)](#)
[![LLM Engine](https://img.shields.io/badge/LLM-Groq%20%2F%20Llama--3.1--8b-orange.svg)](#)
[![Monitoring](https://img.shields.io/badge/Monitoring-Prometheus%20&%20Sentry-red.svg)](#)

## Deskripsi Proyek
Wisatawan sering menghadapi kendala travel anxiety akibat perubahan cuaca mendadak di lokasi asing. **Pavey AI Core** hadir sebagai microservice kecerdasan buatan berbasis *Contextual Retrieval-Augmented Generation* (RAG) yang mampu mengekstraksi preferensi pengguna, melakukan *weather-driven dynamic rerouting* secara real-time, dan mengorkestrasi itinerary perjalanan yang personal, logis, serta anti tumpang-tindih.

---

## Spesifikasi Teknis

| Komponen | Detail Spesifikasi |
| :--- | :--- |
| **Data Engineering** | Tokenisasi teks input, pembersihan string, dan transformasi preferensi psikografis pengguna menjadi representasi vektor numerik kaku menggunakan model **IBM Granite Embeddings** (`sentence-transformers`). |
| **Contextual RAG** | Pencarian destinasi berbasis *Cosine Similarity* pada klaster data lokal (atraksi & kuliner) yang disintesis dan divalidasi langsung terhadap data koordinat serta *place details* dari **Google Places API**. |
| **Orchestrator Core** | **Llama-3.1-8b via Groq** sebagai generator utama teks bebas, penyusunan jadwal linier (*Strict Accumulation Law*), dan deksripsi aktivitas kreatif berbasis *Asynchronous Tasks*. |
| **Transit & Weather API** | Integrasi koordinat via **OSRM (OpenStreetMap Routing Machine)** untuk kalkulasi waktu tempuh spasial dan **OpenWeather API** untuk deteksi hujan ekstrem guna memicu pengalihan rute otomatis. |
| **API Caching & Storage** | **Redis Cache Layer** terpasang pada gerbang pemanggilan API eksternal untuk menyimpan data cuaca dan rute terdekat. Mengurangi latensi request berulang dan menekan pembengkakan biaya (*overbudget*) Google API limits. |
| **Testing Protocol** | Pengujian unit (*Unit Testing*) otomatis untuk validasi skema JSON output (*Proper Case Enforcement Rule*, pembulatan waktu *Human Time Rounding* per 5 menit, dan tipe objek `"restaurant"`/`"destination"`). |
| **MLOps Pipeline** | Kontainerisasi penuh menggunakan **Docker & Docker Compose** terisolasi dengan optimasi PyTorch Wheel versi CPU-only (~150MB) untuk menghemat storage lokal tim. |
| **Observability (Monitoring)** | **Prometheus Client** untuk *latency tracking* performa internal API dan **Sentry SDK** untuk pelacakan error log/exception secara real-time. |

---

## Cara Penggunaan (Quick Start)

### 1. Jalankan Aplikasi via Docker
Pastikan file `.env` sudah dikonfigurasi (tanpa tanda kutip pada API Key), lalu jalankan perintah berikut:
```bash
docker compose up -d --build ai-core-api

```

### 2. Pengujian Endpoint API

Lakukan request pembuatan itinerary satu hari via `curl` atau Postman:

* **Endpoint:** `POST http://localhost:8080/api/v1/itinerary`
* **Payload Request:**

```json
{
  "city": "Amsterdam",
  "starting_time": "09:00",
  "preference": "Authentic local culinary and historical museums"
}

```

* **Ekspektasi Response:**

```json
{
  "itinerary": [
    {
      "step": 1,
      "type": "restaurant",
      "name": "Restaurant Showw",
      "arrival_time": "09:00",
      "duration_spent_minutes": 60,
      "travel_time_to_next_minutes": 10,
      "activity_todo": "Savoring premium local fine dining dishes curated specifically to match your culinary interest."
    }
  ]
}

```

### 3. Akses Dokumentasi API

Buka browser dan akses `http://localhost:8080/docs` untuk membuka Swagger UI interaktif.

```
