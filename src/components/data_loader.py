import pandas as pd


class DataLoader:

    def __init__(self, file_path):

        self.file_path = file_path


    def load_dataset(self):

        df = pd.read_csv(
            self.file_path
        )

        print(
            f"[INFO] Dataset loaded successfully: {df.shape}"
        )

        return df
