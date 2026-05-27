import os
import sys
import pytest
import pandas as pd
from src.components.data_loader import DataLoader

# Mengambil path dari root proyek (1 tingkat di atas folder notebooks)
notebook_dir = os.getcwd()
root_dir = os.path.abspath(os.path.join(notebook_dir, ".."))

# Daftarkan root direktori ke dalam sys.path milik Python jika belum ada
if root_dir not in sys.path:
    sys.path.append(root_dir)

print(f"[INFO] Berhasil menambahkan root ke sys.path: {root_dir}")

def test_data_loader_columns():
    # Inisialisasi loader (pastikan file dataset tiruan atau asli ada)
    loader = DataLoader(file_path="data/processed/dataset_rekomendasi_final.csv")
    df = loader.load_dataset()

    # 1. Pastikan output berupa DataFrame dan tidak kosong
    assert isinstance(df, pd.DataFrame)
    assert not df.empty

    # 2. Yang perlu dicek: Pastikan kolom-kolom baru kaya aset UX & spasial benar-benar termuat
    required_columns = ["latitude", "longitude", "photo_link_1", "review_1"]
    for col in required_columns:
        assert col in df.columns, f"Kolom kritis MLOps/UX '{col}' hilang dari DataLoader!"
