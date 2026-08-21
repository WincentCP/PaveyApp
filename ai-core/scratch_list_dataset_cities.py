import pandas as pd

try:
    df = pd.read_csv("artifacts/processed_dataset.csv")
    print("Unique cities in processed_dataset.csv:")
    print(df["city"].unique())
except Exception as e:
    print("Error:", e)
