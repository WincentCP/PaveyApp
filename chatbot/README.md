# Pavey Intelligent Chatbot Interface (`chatbot`)

[![Framework](https://img.shields.io/badge/Framework-React%20%2F%20TypeScript-blue.svg)](#)
[![Build Tool](https://img.shields.io/badge/Build%20Tool-Vite-purple.svg)](#)
[![Style](https://img.shields.io/badge/Styling-Tailwind%20CSS-06b6d4.svg)](#)
[![Map Engine](https://img.shields.io/badge/Maps-Leaflet%20%2F%20OSM-green.svg)](#)

## Deskripsi Proyek
**Pavey Chatbot Interface** adalah subsistem *frontend* berbasis web yang responsif, interaktif, dan ultra-cepat. Berfungsi sebagai gerbang interaksi utama (*Human-to-AI Interface*) bagi wisatawan, modul ini menerjemahkan respons kaku berupa JSON struktural dari AI Core menjadi komponen visual yang intuitif. Antarmuka ini dirancang untuk mengatasi *travel anxiety* pengguna melalui penyajian informasi spasial, prakiraan cuaca, rekomendasi akomodasi, dan rute perjalanan dinamis secara *real-time*.

---

## Spesifikasi Teknis & Arsitektur

| Komponen | Detail Spesifikasi |
| :--- | :--- |
| **State Management Core** | Menggunakan arsitektur custom React Hooks (**`useChat.ts`**) yang mengatur siklus hidup pesan (*streaming state*), resolusi prioritas lokasi, caching preferensi pengguna (*User Preferences*), dan deteksi koordinat GPS. |
| **City Resolution System** | Resolusi deteksi kota berjenjang demi meminimalkan interupsi obrolan:<br>1. Ekstraksi entitas kota dari JSON AI (`aiCity`) — *Prioritas Utama*<br>2. Cache state lokal dari turn sebelumnya (`preferences.city`)<br>3. IP Geolocation / HTML5 GPS Engine — *Opsi Terakhir* |
| **Hotel Search Engine** | Integrasi berlapis pada layanan **`hotel.ts`** dengan toleransi kegagalan tinggi (*High Fault Tolerance*):<br>1. **TripAdvisor API via RapidAPI** (Limitasi tier gratis 500 req/bulan)<br>2. Fallback otomatis ke **Overpass API (OpenStreetMap)** dengan radius spasial 15km terikat *strict tagging constraint* (`tourism=hotel`, `hostel`, `guest_house`) untuk kota-kota kecil.<br>3. Standar *Deterministic Mock Fallback Engine* untuk mencegah kegagalan render output peta. |
| **Weather Integration Engine** | Layanan **`weather.ts`** yang terintegrasi penuh dengan **OpenWeatherMap API** untuk mengonversi data cuaca menjadi metrik kondisi (Suhu riil, Kelembapan, Kecepatan Angin, Intensitas Hujan). Mampu mendeteksi kondisi cuaca ekstrem (`isExtreme`) dan curah hujan (`isRainy`) untuk mentrigger visualisasi *alert* pada UI. |
| **Rich Content Rendering** | Pemisahan layer rendering berbasis komponen modular (**`MessageBubble.tsx`**). Fungsi regex khusus dipasang untuk membersihkan tag mentah `<DATA_JSON>` dari teks balasan asisten, kemudian menyalurkan datanya ke widget visual terisolasi seperti `WeatherWidget`, `MapView` (Leaflet), `PlaceCarousel`, dan `TravelPlanView`. |
| **Geocoding & Spatial Mapping** | Implementasi penyaringan lokasi menggunakan sufiks wilayah kaku untuk mencegah pencocokan koordinat beda benua. Menggunakan penanda emoji kontekstual (`TYPE_EMOJI`) berbasis tipe destinasi (`destination`, `restaurant`, `hotel`, `attraction`) yang dipetakan langsung ke titik koordinat. |

---

## Struktur Modul Komponen Utama

* **`useChat.ts`**: Otak dari penanganan pesan. Mengatur alur pemanggilan API penyedia LLM (Prioritas: *Groq* $\rightarrow$ *OpenRouter* $\rightarrow$ *Ollama Local*), pemrosesan intent terstruktur, serta koordinasi fungsi pemanggilan asinkronus eksternal.
* **`App.tsx`**: Kontainer layout utama aplikasi. Mengelola status antarmuka UI, transisi *sidebar*, pemicu awal deteksi lokasi pengguna via GPS, serta penanganan *quick prompt templates* (seperti: "Places Near Me", "Plan My Day", "Check Weather").
* **`MessageBubble.tsx`**: Komponen atomik untuk merender gelembung percakapan. Memisahkan teks naratif bertipe Markdown dari visualisasi kaya (*Rich Content Component*) menggunakan teknik *sanitization parser* internal.
* **`TravelPlanView.tsx`**: Mengonversi struktur *Strict Accumulation Law* dari AI Core menjadi komponen garis waktu (*timeline matrix*) perjalanan linier, lengkap dengan informasi jarak spasial tiap destinasi dari titik hotel (`distanceFromHotel`), durasi kunjungan, serta *weather-warning alert*.

---

## Cara Penggunaan (Quick Start)

### 1. Konfigurasi Environment Variables
Buat file `.env` di dalam root folder `chatbot/` dan isi konfigurasi kunci API Anda:
```env
VITE_GROQ_KEY=gsk_your_groq_api_key_here
VITE_GROQ_MODEL=llama-3.1-8b-instant

VITE_OPENWEATHER_KEY=your_openweathermap_api_key_here
VITE_RAPIDAPI_KEY=your_rapidapi_tripadvisor_key_here

# Opsional: Jika ingin menggunakan Local LLM Engine
VITE_OLLAMA_URL=http://localhost:11434
VITE_OLLAMA_MODEL=llama3.2

```

### 2. Instalasi Dependensi & Menjalankan Mode Development

Pastikan Anda berada di direktori `chatbot/`, lalu eksekusi perintah berikut untuk menginstal paket node dan menjalankan server lokal Vite:

```bash
# Menginstal semua dependensi proyek
npm install

# Menjalankan server lokal development
npm run dev

```

Setelah berhasil dijalankan, buka browser Anda dan akses tautan lokal yang tertera pada terminal (biasanya `http://localhost:5173`).

### 3. Struktur Dokumen Produksi (Build)

Untuk mengompilasi aplikasi ke dalam file statis yang siap didistribusikan ke server produksi (folder `dist/`), jalankan perintah:

```bash
npm run build

```

---

## Aturan Pengujian Komponen UI (Testing Protocol)

* **JSON Block Cleanliness**: Memastikan fungsi parser tidak membocorkan fragmen kode biner atau penutup tag teks berekstensi `<DATA_JSON>` ke visualisasi teks gelembung pengguna.
* **Fallback Rendering State**: Memastikan peta Leaflet dan *carousel card* akomodasi tetap merender komponen *Mock Engine* secara anggun apabila kuota API TripAdvisor habis (HTTP Status `429 Too Many Requests`).
* **Coordinate Mapping Logic**: Memastikan penanda rute geospasial pada peta interaktif tidak melompat keluar pulau akibat kegagalan geocoding entitas nama tempat yang ambigu.

```

```
