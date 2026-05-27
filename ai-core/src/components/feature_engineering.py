import pandas as pd


class FeatureEngineer:
    def __init__(self):
        pass

    def create_combined_features(self, df):
        """
        Tuning 1: Structural Text Padding (Kontekstualisasi Deskriptif).
        Menggabungkan teks fitur semantik utama ke dalam format kalimat buatan (pseudo-sentence).

        Catatan MLOps: Kolom review_1 s/d review_5 dan tautan foto sengaja dieksklusi dari
        proses penggabungan ini agar ukuran dimensi vektor tidak membengkak dan mempercepat
        proses inference, namun aset tersebut tetap tersimpan aman di dataframe utama.

        Update: place_type dan price_level dimasukkan ke narasi agar model embedding
        mendapat konteks kategori dan harga secara eksplisit di representasi vektor.
        """
        df = df.copy()

        # Fallback price_level berdasarkan place_type jika data N/A:
        #   destination → "free"  (asumsi: taman kota, landmark publik, tidak berbayar)
        #   restaurant  → "$$"    (asumsi: mid-range sebagai estimasi konservatif)
        PRICE_FALLBACK_BY_TYPE = {
            "destination": "free",
            "restaurant" : "$$",
        }

        def resolve_price_level(price_level: str, place_type: str) -> str:
            """
            Mengembalikan price_level yang sudah di-resolve:
            - Jika ada nilai eksplisit → pakai langsung.
            - Jika N/A atau kosong → fallback berdasarkan place_type.
            """
            normalized = str(price_level).strip().lower()
            if normalized and normalized != "n/a":
                return normalized
            # N/A: inferensi dari place_type
            return PRICE_FALLBACK_BY_TYPE.get(str(place_type).strip().lower(), "free")

        def build_price_clause(price_level: str) -> str:
            """
            Mengonversi simbol price_level menjadi klausa naratif yang ramah Transformer.
            Simbol '$' tidak informatif secara semantik bagi model bahasa — kalimat lebih baik.
            Dipanggil setelah resolve_price_level(), sehingga input dijamin bukan N/A.
            """
            mapping = {
                "free" : "free to visit with no entry cost",
                "$"    : "budget-friendly with affordable pricing",
                "$$"   : "moderately priced and mid-range",
                "$$$"  : "upscale with premium pricing",
                "$$$$" : "luxury with high-end pricing",
            }
            return mapping.get(str(price_level).strip().lower(), "moderately priced and mid-range")

        def build_pseudo_sentence(row):
            indoor_outdoor = str(row.get("indoor_outdoor", "")).strip()
            name           = str(row.get("name", "")).strip()
            city           = str(row.get("city", "")).strip()
            country        = str(row.get("country", "")).strip()
            features_text  = str(row.get("features_text", "")).strip()

            place_type  = str(row.get("place_type", "")).strip()
            price_level = str(row.get("price_level", "")).strip()

            # Resolve N/A ke nilai inferensi sebelum dibentuk jadi kalimat
            resolved_price = resolve_price_level(price_level, place_type)

            type_clause  = f"It is categorized as a {place_type}." if place_type else ""
            price_clause = f"It is {build_price_clause(resolved_price)}."

            sentence = (
                f"A {indoor_outdoor} destination named {name} located in {city}, {country}. "
                f"This place features characteristics and experiences such as: {features_text}. "
                f"{type_clause} "
                f"{price_clause}"
            )
            return sentence

        # =====================================================================
        # APPLICATION OF PSEUDO-SENTENCE PADDING
        # =====================================================================
        df["combined_features"] = df.apply(build_pseudo_sentence, axis=1)

        # Bersihkan spasi ganda (\s+) sisa penggabungan agar proses tokenisasi model Granite efisien
        df["combined_features"] = (
            df["combined_features"]
            .str.replace(r"\s+", " ", regex=True)
            .str.strip()
        )

        print(
            f"[INFO] Tuning 1 Applied Successfully. Pseudo-sentence string formatted. "
            f"Dataset Shape: {df.shape}"
        )
        return df
