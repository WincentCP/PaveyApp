import os
import sys
import pytest
import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
from src.components.feature_engineering import FeatureEngineer

# Mengambil path dari root proyek (1 tingkat di atas folder notebooks)
notebook_dir = os.getcwd()
root_dir = os.path.abspath(os.path.join(notebook_dir, ".."))

# Daftarkan root direktori ke dalam sys.path milik Python jika belum ada
if root_dir not in sys.path:
    sys.path.append(root_dir)

print(f"[INFO] Berhasil menambahkan root ke sys.path: {root_dir}")

def test_pseudo_sentence_embedding_generation():
    # 1. Mock data tiruan dengan format kolom kompleks
    mock_df = pd.DataFrame([{
        "name": "Eiffel Tower",
        "city": "Paris",
        "country": "France",
        "rating": 4.7,
        "indoor_outdoor": "Outdoor",
        "features_text": "iconic tower romantic view historical monument"
    }])

    # 2. Jalankan Feature Engineer (Tuning 1: Pseudo-Sentence)
    engineer = FeatureEngineer()
    df_engineered = engineer.create_combined_features(mock_df)

    assert "combined_features" in df_engineered.columns
    pseudo_sentence = df_engineered["combined_features"].iloc[0]

    # PERBAIKAN: Gunakan 'in' untuk mendeteksi komponen konten penting di dalam kalimat pelindung konteks
    assert "Eiffel Tower" in pseudo_sentence
    assert "Paris, France" in pseudo_sentence
    assert "iconic tower" in pseudo_sentence

    # 3. Uji kekuatan encoding model IBM Granite
    model = SentenceTransformer("ibm-granite/granite-embedding-30m-english")
    embedding = model.encode([pseudo_sentence], convert_to_numpy=True)

    # Pastikan menghasilkan dimensi vektor baris yang konsisten dan tidak kosong
    assert embedding.ndim == 2
    assert embedding.shape[0] == 1
    assert embedding.shape[1] > 0  # Memastikan dimensi embedding terisi
