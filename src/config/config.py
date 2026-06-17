import os
from pathlib import Path

class Config:
    # Base Directory Proyek
    BASE_DIR = Path(__file__).resolve().parent.parent.parent

    # 1. Konfigurasi Path Data & Artifacts
    DATA_CONFIG = {
        "raw_data_path": str(BASE_DIR / "data" / "processed" / "dataset_rekomendasi_final.csv"),
        "dataset_version": "v3_enriched",
        "model_output_dir": str(BASE_DIR / "artifacts" / "models"),
        "matrix_output_path": str(BASE_DIR / "artifacts" / "models" / "similarity_matrix.npy"),
    }

    # 2. Konfigurasi Model Embedding (IBM Granite)
    MODEL_CONFIG = {
        "model_name": "ibm-granite/granite-embedding-30m-english",
        "device": "cpu",
    }

    # 3. Hasil Hyperparameter Tuning
    HYPERPARAMETERS = {
        "alpha": 0.2,
        "beta": 0.1,
        "min_threshold": 0.55,
        "top_n_buffer": 5
    }

    # 4. Konfigurasi MLOps Tracking (MLflow)
    MLFLOW_CONFIG = {
        "experiment_name": "Travel_Recommendation_System_Prod",
        "tracking_uri": f"file:{str(BASE_DIR / 'mlruns')}"
    }

# Pastikan folder artifacts otomatis terbentuk saat config di-load
os.makedirs(Config.DATA_CONFIG["model_output_dir"], exist_ok=True)
