import pickle
from sklearn.metrics.pairwise import cosine_similarity

class SimilarityCalculator:
    def __init__(self):
        pass

    def compute_similarity(self, embeddings):
        print("[INFO] Computing Cosine Similarity Matrix...")
        similarity_matrix = cosine_similarity(embeddings, embeddings)
        print(f"[INFO] Matrix computed successfully. Shape: {similarity_matrix.shape}")
        return similarity_matrix
