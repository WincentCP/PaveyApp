import pandas as pd


class DataPreprocessor:
    def __init__(self):
        pass

    def clean_text(self, text):
        """Helper untuk membersihkan teks fitur/kategori menjadi lowercase dan konsisten."""
        if pd.isna(text):
            return ""
        return str(text).lower().strip()

    def clean_asset_text(self, text):
        """Helper khusus untuk aset (URL foto & Review) agar huruf kapital TIDAK hilang (Case-Sensitive)."""
        if pd.isna(text):
            return ""
        return str(text).strip()

    def preprocess(self, df):
        df = df.copy()

        # =====================================
        # REMOVE DUPLICATES
        # =====================================
        df = df.drop_duplicates()

        # =====================================
        # HANDLE MISSING VALUES (TEXT & CATEGORICAL)
        # =====================================
        # Kolom teks yang perlu diubah menjadi lowercase untuk keselarasan embedding / categorical search
        text_columns = [
            "name",
            "city",
            "country",
            "features_text",
            "combined_features",
            "indoor_outdoor",
            "place_type",   # NEW: 'restaurant' / 'destination'
            "price_level",  # NEW: '$' / '$$' / '$$$' / '$$$$' / 'N/A'
        ]
        for col in text_columns:
            if col in df.columns:
                df[col] = (
                    df[col]
                    .fillna("")
                    .apply(self.clean_text)
                )

        # =====================================
        # HANDLE TIME & GEOSPATIAL DATA (AIOps Ready)
        # =====================================
        # Pastikan opening_time aman dari NaN (tidak di-lowercase secara brutal agar format hari tetap rapi)
        if "opening_time" in df.columns:
            df["opening_time"] = df["opening_time"].fillna("").apply(self.clean_asset_text)

        # Konversi Latitude dan Longitude menjadi Float numerik agar bisa dihitung jarak spasialnya nanti
        spatial_columns = ["latitude", "longitude"]
        for col in spatial_columns:
            if col in df.columns:
                df[col] = (
                    pd.to_numeric(df[col], errors="coerce")
                    .fillna(0.0)
                )

        # =====================================
        # HANDLE RATING & REVIEW COUNT
        # =====================================
        if "rating" in df.columns:
            df["rating"] = (
                pd.to_numeric(df["rating"], errors="coerce")
                .fillna(0.0)
            )

        # NEW: total_reviews — integer, baris tanpa data scraping diisi 0
        if "total_reviews" in df.columns:
            df["total_reviews"] = (
                pd.to_numeric(df["total_reviews"], errors="coerce")
                .fillna(0)
                .astype(int)
            )

        # =====================================
        # HANDLE UX ASSETS (Photos & Reviews Forwarding)
        # =====================================
        photo_cols  = [f"photo_link_{i}" for i in range(1, 6)]
        review_cols = [f"review_{i}" for i in range(1, 6)]

        all_ux_assets = photo_cols + review_cols
        for col in all_ux_assets:
            if col in df.columns:
                df[col] = df[col].fillna("").apply(self.clean_asset_text)

        print(
            f"[INFO] Preprocessing completed successfully. Dataset Shape: {df.shape}"
        )
        return df
