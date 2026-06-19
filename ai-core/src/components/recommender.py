import numpy as np
import pandas as pd
import re
from datetime import datetime, time
from sklearn.metrics.pairwise import cosine_similarity


class SemanticRecommender:
    def __init__(
        self,
        df,
        embeddings,
        similarity_matrix,
        model,
        alpha=0.2,
        beta=0.1,
        min_threshold=0.55,
    ):
        self.df               = df
        self.embeddings       = embeddings
        self.similarity_matrix = similarity_matrix
        self.model            = model
        self.alpha            = alpha          # Tuning 2a: Bobot rating bias terhadap final_score
        self.beta             = beta           # Tuning 2b: Bobot popularitas (total_reviews) terhadap final_score
        self.min_threshold    = min_threshold  # Tuning 3:  Batas minimum cosine similarity sebelum fallback aktif

    # =========================================================================
    # PRIVATE HELPERS
    # =========================================================================

    def _parse_google_maps_time(self, time_str: str) -> time:
        """
        Mengonversi string waktu Google Maps (AM/PM atau 24 jam) menjadi objek time Python.
        """
        time_str = time_str.strip()
        time_str = re.sub(r'\s+', ' ', time_str)
        # Sisipkan spasi antara digit dan AM/PM jika langsung menempel (e.g. "9:00AM" → "9:00 AM")
        # Ini penting karena clean_schedule menghapus spasi sebelum split '-',
        # sehingga format seperti "9:00AM" masuk ke sini tanpa spasi.
        time_str = re.sub(r'(\d)(AM|PM)', r'\1 \2', time_str, flags=re.IGNORECASE)
        time_str = time_str.upper()

        if "AM" in time_str or "PM" in time_str:
            try:
                return datetime.strptime(time_str, "%I:%M %p").time()
            except ValueError:
                try:
                    return datetime.strptime(time_str, "%I %p").time()
                except ValueError:
                    pass

        try:
            return datetime.strptime(time_str, "%H:%M").time()
        except ValueError:
            try:
                hour   = int(time_str.split(':')[0])
                minute = int(time_str.split(':')[1]) if ':' in time_str else 0
                return time(hour, minute)
            except Exception:
                return time(0, 0)

    def _compute_reviews_norm(self, df_city: pd.DataFrame) -> pd.Series:
        """
        Log-normalisasi total_reviews per kota (bukan global) agar tempat di kota kecil
        tidak selalu kalah dari kota besar yang punya review jutaan.

        Rumus: log1p(x) / log1p(max_x_in_city)

        Edge case:
          - Semua 0 (belum di-scrape)       → seluruh nilai 0.0, beta tidak berpengaruh
          - Satu baris saja                  → nilai 1.0, beta penuh
          - NaN / non-numerik (setelah preprocessing seharusnya tidak ada) → diperlakukan 0
        """
        if "total_reviews" not in df_city.columns:
            return pd.Series(0.0, index=df_city.index)
        reviews = pd.to_numeric(df_city["total_reviews"], errors="coerce").fillna(0)
        max_reviews = reviews.max()

        if max_reviews == 0:
            # Tidak ada data review sama sekali — nonaktifkan sinyal beta
            return pd.Series(0.0, index=df_city.index)

        return np.log1p(reviews) / np.log1p(max_reviews)

    # =========================================================================
    # PUBLIC — CORE RECOMMENDATION
    # =========================================================================

    def recommend_by_city_and_preference(
        self,
        city_name,
        preference_text,
        top_n=5,
        user_datetime=None,
    ):
        """
        Phase 1 Core (Fully Tuned):
          Filter Kota → Hybrid Scoring (Rating Bias + Popularity Bias) →
          Thresholding/Fallback → Time Filtering (Overnight & 24-Hour Adaptive) →
          Data Forwarding.

        Hybrid Score Formula:
          final_score = cosine_score × (1 + α × (rating/5) + β × reviews_norm)

          α (alpha) : bobot kualitas tempat via rating bintang
          β (beta)  : bobot popularitas tempat via log-normalized total_reviews per kota
        """

        # ------------------------------------------------------------------
        # 1. Filter wilayah kota (Case-Insensitive with synonym mapping)
        # ------------------------------------------------------------------
        norm_city = city_name.lower().strip()
        if "," in norm_city:
            norm_city = norm_city.split(",")[0].strip()
        if "yogyakarta" in norm_city or "jogja" in norm_city:
            norm_city = "jogjakarta"
        # Map Bali sub-regions to the main "bali" city dataset
        if norm_city in ["seminyak", "ubud", "canggu", "nusa dua", "uluwatu", "kuta", "sanur", "jimbaran"]:
            norm_city = "bali"

        city_mask         = self.df["city"].str.lower().str.strip() == norm_city
        city_filtered_df  = self.df[city_mask].copy()

        if city_filtered_df.empty:
            print(f"[WARNING] No places found for city: {city_name}")
            return pd.DataFrame()

        # ------------------------------------------------------------------
        # 2. Slicing embedding sesuai index kota
        # ------------------------------------------------------------------
        filtered_indices  = city_filtered_df.index.tolist()
        filtered_embeddings = self.embeddings[filtered_indices]

        # ------------------------------------------------------------------
        # 3. Real-time encoding preferensi user
        # ------------------------------------------------------------------
        user_pseudo_sentence = f"Looking for places with features like: {preference_text}."
        user_embedding = self.model.encode([user_pseudo_sentence], convert_to_numpy=True)

        # ------------------------------------------------------------------
        # 4. Cosine Similarity
        # ------------------------------------------------------------------
        cosine_scores = cosine_similarity(user_embedding, filtered_embeddings)[0]
        city_filtered_df["cosine_score"] = cosine_scores

        # ------------------------------------------------------------------
        # TUNING 2: HYBRID SCORING (Rating Bias + Popularity Bias)
        # ------------------------------------------------------------------
        # Hitung reviews_norm per kota — isolasi dari distribusi kota lain
        city_filtered_df["reviews_norm"] = self._compute_reviews_norm(city_filtered_df)

        city_filtered_df["final_score"] = city_filtered_df.apply(
            lambda row: row["cosine_score"] * (
                1
                + self.alpha * (float(row.get("rating", 0.0)) / 5.0)
                + self.beta  * float(row.get("reviews_norm", 0.0))
            ),
            axis=1,
        )

        sorted_candidates = city_filtered_df.sort_values(by="final_score", ascending=False)

        # ------------------------------------------------------------------
        # TUNING 3: THRESHOLDING & GRACEFUL FALLBACK
        # ------------------------------------------------------------------
        max_cosine_achieved = sorted_candidates["cosine_score"].max() if not sorted_candidates.empty else 0.0
        is_fallback_active  = False

        if max_cosine_achieved < self.min_threshold:
            print(
                f"[TUNING FALLBACK] Max Cosine Score ({max_cosine_achieved:.4f}) "
                f"< Threshold ({self.min_threshold}). Memunculkan tempat terpopuler/rating tertinggi!"
            )
            sorted_candidates  = city_filtered_df.sort_values(by="rating", ascending=False)
            is_fallback_active = True

        # ------------------------------------------------------------------
        # Kolom output standar — dipakai di dua return path (with / without datetime)
        # ------------------------------------------------------------------
        BASE_OUTPUT_COLUMNS = [
            "name", "city", "country", "rating", "indoor_outdoor",
            "place_type", "price_level", "total_reviews",
            "latitude", "longitude",
            "photo_link_1", "photo_link_2", "photo_link_3", "photo_link_4", "photo_link_5",
            "review_1", "review_2", "review_3", "review_4", "review_5",
            "features_text", "cosine_score", "final_score",
        ]

        # ------------------------------------------------------------------
        # 5. BYPASS: Jika tidak ada parameter waktu
        # ------------------------------------------------------------------
        if user_datetime is None:
            results = sorted_candidates.head(top_n * 3).copy()
            results["fallback_triggered"] = is_fallback_active
            existing_cols = [c for c in BASE_OUTPUT_COLUMNS + ["fallback_triggered"] if c in results.columns]
            return results[existing_cols]

        # ------------------------------------------------------------------
        # 6. CORE REAL-TIME OPERATION FILTER (Time-matching Google Maps)
        # ------------------------------------------------------------------
        target_day = user_datetime.strftime('%A')
        user_time  = user_datetime.time()

        filtered_list = []

        for idx, row in sorted_candidates.iterrows():
            opening_time_string = str(row.get('opening_time', '')).strip()

            day_pattern = rf"{target_day}:\s*([^|]+)"
            match       = re.search(day_pattern, opening_time_string)

            today_schedule = match.group(1).strip() if match else opening_time_string

            if "closed" in today_schedule.lower():
                continue

            # Destinasi buka 24 jam
            if "24 hours" in today_schedule.lower() or "open 24" in today_schedule.lower():
                row = row.copy()
                row["today_hours"]        = "Open 24 hours"
                row["fallback_triggered"] = is_fallback_active
                filtered_list.append(row)
                if len(filtered_list) == (top_n * 3):
                    break
                continue

            # Jam operasional terjadwal normal
            try:
                clean_schedule = today_schedule.replace('–', '-').replace(' ', '')
                clean_schedule = re.sub(r'\s+', ' ', clean_schedule).strip()

                open_str, close_str = clean_schedule.split('-')
                close_str_clean = close_str.strip().upper()
                open_str_clean  = open_str.strip().upper()

                # Penjembatan format AM/PM terbuka
                if "PM" in close_str_clean and "AM" not in open_str_clean and "PM" not in open_str_clean:
                    try:
                        val_hour = int(open_str_clean.split(':')[0])
                        open_str_clean += " AM" if 6 <= val_hour < 12 else " PM"
                    except Exception:
                        open_str_clean += " AM"
                elif "AM" in close_str_clean and "AM" not in open_str_clean and "PM" not in open_str_clean:
                    open_str_clean += " AM"

                open_time  = self._parse_google_maps_time(open_str_clean)
                close_time = self._parse_google_maps_time(close_str_clean)

                # Mendukung destinasi wisata yang buka lintas tengah malam
                if open_time <= close_time:
                    is_open_now = open_time <= user_time <= close_time
                else:
                    is_open_now = user_time >= open_time or user_time <= close_time

                if is_open_now:
                    row = row.copy()
                    row["today_hours"]        = clean_schedule
                    row["fallback_triggered"] = is_fallback_active
                    filtered_list.append(row)

            except Exception:
                # Format waktu tidak terbaca — loloskan sebagai fallback darurat
                row = row.copy()
                row["today_hours"]        = "Open"
                row["fallback_triggered"] = is_fallback_active
                filtered_list.append(row)

            if len(filtered_list) == (top_n * 3):
                break

        if not filtered_list:
            return pd.DataFrame()

        # ------------------------------------------------------------------
        # 7. Return dataframe kaya aset
        # ------------------------------------------------------------------
        results = pd.DataFrame(filtered_list)
        TIME_OUTPUT_COLUMNS = [
            "name", "city", "country", "rating", "indoor_outdoor",
            "place_type", "price_level", "total_reviews",
            "latitude", "longitude", "today_hours",
            "cosine_score", "final_score", "fallback_triggered",
            "photo_link_1", "photo_link_2", "photo_link_3", "photo_link_4", "photo_link_5",
            "review_1", "review_2", "review_3", "review_4", "review_5",
            "features_text",
        ]
        existing_cols = [c for c in TIME_OUTPUT_COLUMNS if c in results.columns]
        return results[existing_cols]
