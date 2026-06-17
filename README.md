---
title: Pavey Aicore
emoji: 👁
colorFrom: green
colorTo: pink
sdk: docker
app_port: 8000
pinned: false
---

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
| **Orchestrator Core** | **Llama-3.1-8b via Groq** sebagai generator utama teks bebas, penyusunan jadwal linier (*Strict Accumulation Law*), dan deskripsi aktivitas kreatif berbasis *Asynchronous Tasks*. |
| **Transit & Weather API** | Integrasi koordinat via **OSRM (OpenStreetMap Routing Machine)** untuk kalkulasi waktu tempuh spasial dan **OpenWeather API** untuk deteksi hujan ekstrem guna memicu pengalihan rute otomatis. |
| **API Caching & Storage** | **Redis Cache Layer** terpasang pada gerbang pemanggilan API eksternal untuk menyimpan data cuaca dan rute terdekat. Mengurangi latensi request berulang dan menekan pembengkakan biaya (*overbudget*) Google API limits. |
| **Testing Protocol** | Pengujian unit (*Unit Testing*) otomatis untuk validasi skema JSON output (*Proper Case Enforcement Rule*, pembulatan waktu *Human Time Rounding* per 5 menit, dan tipe objek `"restaurant"`/`"destination"`). |
| **MLOps Pipeline** | Kontainerisasi penuh menggunakan **Docker & Docker Compose** terisolasi dengan optimasi PyTorch Wheel versi CPU-only (~150MB) untuk menghemat storage lokal tim. |
| **Observability & Suite Monitoring** | **Sentry SDK** untuk pelacakan error log secara real-time, ekspos metrik token riil dari Groq metadata, serta **Advanced Data Drift Detection Engine** menggunakan uji statistik Kolmogorov-Smirnov (KS-Test) via rolling window yang diekspos ke **Prometheus Server & Grafana**. |

---

## Cara Penggunaan (Quick Start)

### 1. Jalankan Aplikasi via Docker
Pastikan file `.env` sudah dikonfigurasi (API Keys), lalu jalankan perintah berikut:
```bash
docker compose up -d --build ai-core-api

```

### 2. Pengujian Endpoint API

Lakukan request pembuatan itinerary satu hari via `curl` atau Postman:

* **Endpoint:** `POST http://localhost:8000/api/v1/generate-itinerary`
* **Payload Request:**

```json
{
  "city": "Amsterdam",
  "preference": "Authentic local culinary and historical museums",
  "num_places": 3,
  "start_datetime": "2026-05-25T09:00:00",
  "duration_per_place": [120, 60, 90],
  "place_type": "all",
  "price_level": 0
}

```

* **Ekspektasi Response:**

```json
{
  "status": "success",
  "city": "Amsterdam",
  "weather_mode": "Standard (Clear)",
  "start_time": "2026-05-25T09:00:00",
  "filters_applied": {
    "place_type": "all",
    "price_level": 0,
    "durations_per_place_minutes": [120, 60, 90]
  },
  "telemetry": {
    "prompt_tokens": 1420,
    "completion_tokens": 385,
    "total_tokens": 1805
  },
  "itinerary": [
    {
      "step": 1,
      "type": "destination",
      "name": "Rijksmuseum",
      "arrival_time": "09:00",
      "duration_spent_minutes": 120,
      "travel_time_to_next_minutes": 10,
      "activity_todo": "Exploring the magnificent halls of the Rijksmuseum, focusing on Dutch Golden Age masterpieces to satisfy your historical interest."
    },
    {
      "step": 2,
      "type": "restaurant",
      "name": "Vlaams Friteshuis Vleminckx",
      "arrival_time": "11:10",
      "duration_spent_minutes": 60,
      "travel_time_to_next_minutes": 15,
      "activity_todo": "Savoring authentic traditional Dutch fries with specialty sauces, diving deep into local culinary history."
    }
  ]
}

```

### 3. Akses Dokumentasi & Metrik MLOps

* **Swagger UI Interaktif:** Buka browser dan akses `http://localhost:8000/docs`
* **Prometheus Metrics Endpoints:** Akses `http://localhost:8000/metrics` untuk melihat data telemetri token dan nilai *p-value data drift*.

```
