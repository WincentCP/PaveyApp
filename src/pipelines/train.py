import os
import json
import numpy as np
import pandas as pd
import mlflow

# Import konfigurasi terpusat dan logger MLOps
from src.config.config import Config
from src.monitoring.logging import logger

# Import komponen core pipeline
from src.components.data_loader import DataLoader
from src.components.preprocessing import DataPreprocessor
from src.components.feature_engineering import FeatureEngineer
from src.components.embedding import SemanticEmbedder
from src.components.similarity import SimilarityCalculator


def run_training_pipeline():
    logger.info("=========================================================")
    logger.info("STARTING TUNED TRAINING PIPELINE (IBM GRANITE)")
    logger.info("=========================================================\n")

    # =====================================================
    # MLFLOW EXPERIMENT REGISTERING
    # =====================================================
    mlflow.set_tracking_uri(Config.MLFLOW_CONFIG["tracking_uri"])
    mlflow.set_experiment(Config.MLFLOW_CONFIG["experiment_name"])

    with mlflow.start_run():
        # Ekstrak nilai dari konfigurasi terpusat (Dinamis)
        ALPHA_BIAS            = Config.HYPERPARAMETERS["alpha"]
        BETA_POPULARITY_BIAS  = Config.HYPERPARAMETERS["beta"]
        MIN_SIMILARITY_THRESHOLD = Config.HYPERPARAMETERS["min_threshold"]
        EMBEDDING_MODEL_NAME  = Config.MODEL_CONFIG["model_name"]

        # Versi dataset — satu sumber kebenaran, dipakai di log_param dan metadata
        DATASET_VERSION = Config.DATA_CONFIG.get("dataset_version", "v3_enriched")

        # =====================================================
        # LOG PARAMETERS KE MLFLOW DASHBOARD
        # =====================================================
        logger.info("Registering hyperparameters and configuration to MLflow...")
        mlflow.log_param("embedding_model",              EMBEDDING_MODEL_NAME)
        mlflow.log_param("similarity_metric",            "cosine")
        mlflow.log_param("dataset_version",              DATASET_VERSION)
        mlflow.log_param("tuning_alpha_rating_bias",     ALPHA_BIAS)
        mlflow.log_param("tuning_beta_popularity_bias",  BETA_POPULARITY_BIAS)
        mlflow.log_param("tuning_min_threshold",         MIN_SIMILARITY_THRESHOLD)

        # =====================================================
        # 1. LOAD DATA
        # =====================================================
        logger.info(f"Loading raw dataset from: {Config.DATA_CONFIG['raw_data_path']}")
        loader = DataLoader(file_path=Config.DATA_CONFIG["raw_data_path"])
        df = loader.load_dataset()

        # =====================================================
        # 2. PREPROCESSING (AIOps & Case-Sensitive UX Asset Safe)
        # =====================================================
        logger.info("Executing pre-processing steps...")
        preprocessor = DataPreprocessor()
        df = preprocessor.preprocess(df)

        # =====================================================
        # 3. FEATURE ENGINEERING (Tuning 1: Pseudo-Sentence Padding)
        # =====================================================
        logger.info("Applying Tuning 1: Building context-rich pseudo-sentences...")
        engineer = FeatureEngineer()
        df = engineer.create_combined_features(df)

        # =====================================================
        # 4. GENERATE SEMANTIC EMBEDDINGS (IBM Granite Core)
        # =====================================================
        logger.info(f"Generating semantic embeddings using {EMBEDDING_MODEL_NAME} on {Config.MODEL_CONFIG['device']}...")
        embedder = SemanticEmbedder(model_name=EMBEDDING_MODEL_NAME)
        embeddings = embedder.generate_embeddings(df["combined_features"].tolist())

        # =====================================================
        # 5. COMPUTE COSINE SIMILARITY MATRIX
        # =====================================================
        logger.info("Pre-computing Cosine Similarity Matrix...")
        calculator = SimilarityCalculator()
        similarity_matrix = calculator.compute_similarity(embeddings)

        # =====================================================
        # CREATE ARTIFACTS DIRECTORY
        # =====================================================
        output_dir = Config.DATA_CONFIG["model_output_dir"]
        os.makedirs(output_dir, exist_ok=True)

        # =====================================================
        # SAVE ARTIFACTS TO DISK
        # =====================================================
        logger.info(f"Saving optimized artifacts locally to {output_dir}...")

        processed_dataset_path = os.path.join(output_dir, "processed_dataset.csv")
        df.to_csv(processed_dataset_path, index=False)

        embeddings_path = os.path.join(output_dir, "embeddings.npy")
        np.save(embeddings_path, embeddings)

        # Simpan similarity matrix sebagai .npy (jauh lebih cepat dari pickle)
        similarity_path = os.path.join(output_dir, "similarity_matrix.npy")
        np.save(similarity_path, similarity_matrix)

        # Metadata struktur sistem — satu sumber kebenaran untuk semua artifact consumer
        metadata = {
            "embedding_model": EMBEDDING_MODEL_NAME,
            "dataset_version": DATASET_VERSION,
            "similarity": "cosine",
            "tuned_hyperparameters": {
                "alpha_rating_bias":    ALPHA_BIAS,
                "beta_popularity_bias": BETA_POPULARITY_BIAS,
                "min_threshold":        MIN_SIMILARITY_THRESHOLD,
            }
        }

        metadata_path = os.path.join(output_dir, "metadata.json")
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=4)

        # =====================================================
        # LOG METRICS KE MLFLOW
        # =====================================================
        logger.info("Logging core pipeline metrics to MLflow...")
        mlflow.log_metric("dataset_size",        len(df))
        mlflow.log_metric("embedding_dimension", embeddings.shape[1])
        mlflow.log_metric("num_similarity_rows", similarity_matrix.shape[0])

        if "total_reviews" in df.columns:
            enriched_pct = (df["total_reviews"] > 0).mean() * 100
            mlflow.log_metric("enriched_reviews_coverage_pct", round(enriched_pct, 2))
            logger.info(f"Enriched reviews coverage: {enriched_pct:.1f}% of dataset")

        if "place_type" in df.columns:
            restaurant_pct = (df["place_type"] == "restaurant").mean() * 100
            mlflow.log_metric("place_type_restaurant_pct", round(restaurant_pct, 2))

        # =====================================================
        # LOG ARTIFACTS KE MLFLOW RUNS
        # =====================================================
        logger.info("Uploading artifacts to MLflow registry...")
        mlflow.log_artifact(processed_dataset_path)
        mlflow.log_artifact(embeddings_path)
        mlflow.log_artifact(similarity_path)
        mlflow.log_artifact(metadata_path)

        # =====================================================
        # SUCCESS LOG
        # =====================================================
        logger.info("\n[SUCCESS] All tuned components & metrics registered to MLflow.")
        logger.info(f"Artifacts saved locally and tracked under Version: {DATASET_VERSION}")
        logger.info("\n=========================================================")
        logger.info("TRAINING PIPELINE COMPLETED SUCCESSFULLY WITH TUNING LOGS")
        logger.info("=========================================================")


if __name__ == "__main__":
    run_training_pipeline()
