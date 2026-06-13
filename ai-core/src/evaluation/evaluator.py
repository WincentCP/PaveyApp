import numpy as np
import pandas as pd

class RecommenderEvaluator:
    def __init__(self, recommender_system):
        """
        Modul Evaluasi Kuantitatif MLOps untuk mengukur performa Tuning 1, 2, dan 3.
        Serta adaptif terhadap kembalian data bertipe Buffer Candidates (top_n * 3).
        """
        self.recommender = recommender_system

    def evaluate_precision_at_k(self, recommendations_df, ground_truth_names, k=5):
        """
        Menghitung seberapa banyak item yang direkomendasikan masuk ke dalam daftar Ground Truth user.
        Dibatasi ketat pada k-item teratas untuk menjaga presisi metrik UX.
        """
        if recommendations_df.empty:
            return 0.0

        # Batasi evaluasi hanya pada k tempat teratas yang akan dilihat user
        top_k_rec = recommendations_df.head(k)["name"].str.lower().str.strip().tolist()
        gt_list = [name.lower().strip() for name in ground_truth_names]

        hits = sum(1 for item in top_k_rec if item in gt_list)
        return hits / k

    def evaluate_mrr(self, recommendations_df, ground_truth_names, k=5):
        """
        Menghitung Mean Reciprocal Rank (MRR) untuk melihat seberapa tinggi
        posisi peringkat (rank) item ground truth yang berhasil ditebak oleh AI.
        Dibatasi pada k-item teratas agar adil terhadap skenario pasokan data buffer.
        """
        if recommendations_df.empty:
            return 0.0

        # Evaluasi peringkat dibatasi hingga urutan ke-k teratas
        rec_names = recommendations_df.head(k)["name"].str.lower().str.strip().tolist()
        gt_list = [name.lower().strip() for name in ground_truth_names]

        for rank, name in enumerate(rec_names, start=1):
            if name in gt_list:
                return 1.0 / rank  # Semakin tinggi peringkatnya (rank=1), nilai mendekati 1.0
        return 0.0

    def run_benchmark_test(self, test_cases, target_top_k=5):
        """
        Menjalankan uji simulasi massal (Benchmark) terhadap beberapa skenario preferensi user.
        Format test_cases:
        [
          {
            "city": "Kuala Lumpur",
            "preference": "aquarium family ocean fish",
            "gt": ["Aquaria KLCC"],
            "datetime": None
          }
        ]
        """
        scores_mrr = []
        scores_p5 = []
        fallback_counts = 0

        print(f"[START BENCHMARK] Evaluating system tuning performance (Target K={target_top_k})...")

        for i, case in enumerate(test_cases):
            # Meminta rekomendasi dengan target_top_k dasar
            res_df = self.recommender.recommend_by_city_and_preference(
                city_name=case["city"],
                preference_text=case["preference"],
                top_n=target_top_k,
                user_datetime=case.get("datetime", None)
            )

            # Hitung metrik evaluasi dengan pembatasan k yang tegas
            mrr = self.evaluate_mrr(res_df, case["gt"], k=target_top_k)
            p5 = self.evaluate_precision_at_k(res_df, case["gt"], k=target_top_k)

            scores_mrr.append(mrr)
            scores_p5.append(p5)

            # Deteksi pemicu fallback aman dari baris manapun di dalam dataframe kembalian
            if not res_df.empty and res_df.iloc[0].get("fallback_triggered", False):
                fallback_counts += 1

        print("\n================ BENCHMARK REPORT ================")
        print(f"Total Test Scenarios   : {len(test_cases)}")
        print(f"Mean Reciprocal Rank   : {np.mean(scores_mrr):.4f}")
        print(f"Precision @ {target_top_k}          : {np.mean(scores_p5):.4f}")
        print(f"Fallback Safety Triggers: {fallback_counts} times activated")
        print("==================================================")

        return {
            "mean_mrr": float(np.mean(scores_mrr)),
            "mean_p5": float(np.mean(scores_p5)),
            "fallback_activations": fallback_counts
        }
