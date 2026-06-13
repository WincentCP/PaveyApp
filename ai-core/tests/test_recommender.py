import os
import sys
import pytest
import pandas as pd
import numpy as np
from datetime import datetime
from sentence_transformers import SentenceTransformer
from src.components.recommender import SemanticRecommender

# Mengambil path dari root proyek (1 tingkat di atas folder notebooks)
notebook_dir = os.getcwd()
root_dir = os.path.abspath(os.path.join(notebook_dir, ".."))

# Daftarkan root direktori ke dalam sys.path milik Python jika belum ada
if root_dir not in sys.path:
    sys.path.append(root_dir)

print(f"[INFO] Berhasil menambahkan root ke sys.path: {root_dir}")

@pytest.fixture
def setup_recommender():
    # Setup data minimal untuk unit testing rekomendasi beserta edge case "Open 24 hours"
    mock_data = pd.DataFrame([
        {
            "name": "Merdeka Square",
            "city": "Kuala Lumpur",
            "country": "Malaysia",
            "rating": 4.5,
            "indoor_outdoor": "Outdoor",
            "opening_time": "Monday: Open 24 hours | Tuesday: Open 24 hours",
            "photo_link_1": "https://Gmaps.com/Photos/CaseSensitiveToken123",
            "latitude": 3.149,
            "longitude": 101.693,
            "combined_features": "This place is located in Kuala Lumpur..."
        }
    ])

    model = SentenceTransformer("ibm-granite/granite-embedding-30m-english")
    embeddings = np.random.rand(1, 384) # Mock embedding array

    recommender = SemanticRecommender(
        df=mock_data,
        embeddings=embeddings,
        similarity_matrix=None,
        model=model,
        alpha=0.2,
        min_threshold=0.1 # Dikecilkan khusus test agar tidak memicu fallback pure rating
    )
    return recommender

def test_recommendation_time_and_ux_assets(setup_recommender):
    recommender = setup_recommender
    user_time = datetime.strptime("2026-05-25 10:00:00", "%Y-%m-%d %H:%M:%S") # Hari Senin

    # Jalankan rekomendasi
    res_df = recommender.recommend_by_city_and_preference(
        city_name="Kuala Lumpur",
        preference_text="park square field",
        top_n=1,
        user_datetime=user_time
    )

    assert not res_df.empty

    # Uji 1: Pastikan menyertakan kolom operasional hari ini dan status pemicu fallback
    assert "today_hours" in res_df.columns
    assert "fallback_triggered" in res_df.columns
    assert res_df["today_hours"].iloc[0] == "Open 24 hours" # Memastikan edge-case 24 jam lolos aman!

    # Uji 2: Ketahanan data (Pastikan token URL Foto tidak rusak/menjadi lowercase akibat mutasi fungsi)
    original_url = "https://Gmaps.com/Photos/CaseSensitiveToken123"
    returned_url = res_df["photo_link_1"].iloc[0]

    assert returned_url == original_url, "BUG UX: Karakter case-sensitive pada URL Foto rusak pasca pencarian!"
