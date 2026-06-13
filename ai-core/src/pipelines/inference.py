import os
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
from src.components.recommender import SemanticRecommender
from src.monitoring.logging import logger

class InferencePipeline:
    def __init__(self, model_name="ibm-granite/granite-embedding-30m-english"):
        self.model_name = model_name
        self.df = None
        self.embeddings = None
        self.model = None
        self.recommender = None

    def initialize_system(self):
        """
        Memuat seluruh artifacts ke memori server.
        """
        logger.info("[Inference Pipeline] Initializing Inference Pipeline Components...")

        try:
            # Load processed dataset dan matriks embeddings dengan path internal Docker
            self.df = pd.read_csv("artifacts/processed_dataset.csv")
            self.embeddings = np.load("artifacts/embeddings.npy")

            # Normalisasi nama kolom kota ke lowercase di memory untuk pencarian string yang kebal Typo/Case-Sensitivity
            if "city" in self.df.columns:
                self.df["city_lower"] = self.df["city"].str.lower().str.strip()
            elif "City" in self.df.columns:
                self.df["city_lower"] = self.df["City"].str.lower().str.strip()

            # Load model embedding IBM Granite untuk encoding query preferensi user secara real-time
            self.model = SentenceTransformer(self.model_name)

            # Daftarkan ke mesin pembaca rekomendasi semantik
            self.recommender = SemanticRecommender(
                df=self.df,
                embeddings=self.embeddings,
                similarity_matrix=None,  # Ditangani secara real-time via user_embedding
                model=self.model
            )
            logger.info("[Inference Pipeline] Inference Pipeline is hot and ready!")
        except Exception as err:
            # Tetap sediakan backup logging terpusat jika artifak gagal dimuat saat container start
            logger.error(f"[Inference Pipeline Critical] Gagal memuat komponen artifak: {str(err)}")
            raise err

    def get_recommendations(self, city: str, preference: str, top_n: int = 5, user_datetime=None):
        """
        Mengambil rekomendasi tempat berdasarkan nama kota, preferensi semantik, dan waktu perjalanan.
        Dilengkapi dengan data-post processing shield untuk kekebalan schema dataset baru.
        """
        if self.recommender is None:
            self.initialize_system()

        cleaned_city = str(city).lower().strip()
        logger.info(f"[Inference Pipeline] Memproses pencarian semantik untuk kota: '{cleaned_city}'")

        try:
            # Teruskan parameter ke objek recommender asli
            results_df = self.recommender.recommend_by_city_and_preference(
                city_name=cleaned_city,
                preference_text=preference,
                top_n=top_n,
                user_datetime=user_datetime
            )

            if results_df is None or results_df.empty:
                return pd.DataFrame()

            # =========================================================================
            # DATA POST-PROCESSING SHIELD (KEBAL DATASET BARU / RETRAIN)
            # =========================================================================
            # 1. Amankan kolom filter cuaca dari float/NaN agar .str.lower() di main.py tidak crash
            if "indoor_outdoor" in results_df.columns:
                results_df["indoor_outdoor"] = results_df["indoor_outdoor"].fillna("indoor").astype(str)
            else:
                results_df["indoor_outdoor"] = "indoor"

            # 2. Amankan data spasial dari nilai kosong/NaN untuk kestabilan kalkulasi rute OSRM
            results_df["latitude"] = pd.to_numeric(results_df["latitude"], errors="coerce").fillna(0.0)
            results_df["longitude"] = pd.to_numeric(results_df["longitude"], errors="coerce").fillna(0.0)

            # 3. Sediakan nilai default untuk jam operasional jika format scraping bermasalah
            if "today_hours" in results_df.columns:
                results_df["today_hours"] = results_df["today_hours"].fillna("Open 24 Hours").astype(str)
            else:
                results_df["today_hours"] = "Open 24 Hours"

            # 4. Amankan metadata penting pendukung LLM prompt context builder
            results_df["name"] = results_df["name"].fillna("Unknown Location").astype(str)

            # Pengkondisian kolom opsional dari dataset baru jika ingin disuapi ke LLM Context
            for col in ["price_level", "place_type", "total_reviews"]:
                if col in results_df.columns:
                    results_df[col] = results_df[col].fillna(0)

            return results_df

        except Exception as ex:
            logger.error(f"[Inference Pipeline Fail] Gagal mengeksekusi kalkulasi skor semantik: {str(ex)}")
            return pd.DataFrame()
