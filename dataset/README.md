# Pavey Destination Dataset (`dataset`)

This directory houses the raw geographic and attraction dataset used by Pavey's AI Core for contextual itinerary recommendation.

## Directory Structure
* **`[City Name]/`**: Individual folders for each supported city (e.g. `Bali`, `Bandung`, `Singapore`, `Amsterdam`) containing a scraped `.csv` file with listing details (name, latitude, longitude, description, pricing, etc.).
* **`data_engineering.ipynb`**: A Jupyter notebook documenting the steps to parse, sanitize, format, and prepare the raw scraped dataset for training/embeddings generation.

## Replicating the Dataset Processing

The contents of this folder serve as the raw data source. 
To build the compiled dataset used by the AI engine:
1. Copy or refer to these folders inside the `ai-core/data/raw/` directory.
2. Run the processing pipeline in `ai-core/build_dataset.py` to compile them into `ai-core/data/processed/dataset_rekomendasi_final.csv`.
