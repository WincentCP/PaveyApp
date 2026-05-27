import numpy as np
from sentence_transformers import SentenceTransformer

class SemanticEmbedder:
    def __init__(self, model_name="ibm-granite/granite-embedding-30m-english"):
        """
        Menggunakan rumpun model IBM Granite Embedding untuk ekstraksi fitur semantik.
        """
        self.model_name = model_name
        self.model = None

    def load_model(self):
        if self.model is None:
            print(f"[INFO] Loading IBM Granite Model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            print("[INFO] Model loaded successfully.")
        return self.model

    def generate_embeddings(self, text_list):
        self.load_model()
        print(f"[INFO] Generating embeddings for {len(text_list)} items...")
        embeddings = self.model.encode(
            text_list,
            show_progress_bar=True,
            convert_to_numpy=True
        )
        print(f"[INFO] Embedding generation completed. Shape: {embeddings.shape}")
        return embeddings
