import os
import glob
import pandas as pd
import numpy as np

# 1. Mapping Kota ke Negara
KOTA_TO_COUNTRY = {
    "Jakarta": "Indonesia", "Bali": "Indonesia", "Medan": "Indonesia",
    "Lombok": "Indonesia", "Manado": "Indonesia", "Palembang": "Indonesia",
    "Bandung": "Indonesia", "Bogor": "Indonesia", "Jogjakarta": "Indonesia",
    "Kuala Lumpur": "Malaysia", "Penang": "Malaysia", "Sarawak": "Malaysia",
    "Singapore": "Singapore",
    "Manila": "Philippines", "Cagayan de Oro": "Philippines", "Cebu": "Philippines",
    "Berlin": "Germany", "Hamburg": "Germany", "Stuttgart": "Germany",
    "Hannover": "Germany", "Freiburg im Breisgau": "Germany",
    "Salzburg": "Austria", "Vienna": "Austria",
    "Melbourne": "Australia", "Sydney": "Australia", "Canberra": "Australia",
    "San Francisco": "USA", "New York": "USA", "California": "USA", "Massachusetts": "USA",
    "Dublin": "Ireland",
    "Amsterdam": "Netherlands", "Den Haag": "Netherlands"
}

def build():
    raw_dir = "data/raw"
    csv_files = glob.glob(os.path.join(raw_dir, "**/*.csv"), recursive=True)
    print(f"Found {len(csv_files)} raw CSV files.")

    dfs = []
    kota_map_lowercase = {k.lower(): k for k in KOTA_TO_COUNTRY.keys()}

    for file in csv_files:
        filename = os.path.basename(file)
        city_extracted = filename.replace("places_", "").replace(".csv", "").strip().lower()
        city_extracted = city_extracted.replace("_", " ")

        if city_extracted in kota_map_lowercase:
            city_name = kota_map_lowercase[city_extracted]
        else:
            folder_name = os.path.basename(os.path.dirname(file))
            city_name = folder_name.replace("_", " ")

        try:
            df = pd.read_csv(file)
            df["city"] = city_name
            df["country"] = KOTA_TO_COUNTRY.get(city_name, "Unknown")
            dfs.append(df)
        except Exception as e:
            print(f"Failed to read {filename}: {e}")

    if not dfs:
        print("No data combined!")
        return

    final_df = pd.concat(dfs, ignore_index=True)
    print(f"Merged dataframe shape: {final_df.shape}")

    # Fill NaNs
    final_df['features_text'] = final_df['features_text'].fillna('').astype(str)
    final_df['city'] = final_df['city'].fillna('').astype(str)
    final_df['country'] = final_df['country'].fillna('').astype(str)
    final_df['indoor_outdoor'] = final_df['indoor_outdoor'].fillna('').astype(str)

    if 'opening_time' in final_df.columns:
        final_df['opening_time'] = final_df['opening_time'].fillna('No Opening Hours Data').astype(str)
    if 'gmaps_link' in final_df.columns:
        final_df['gmaps_link'] = final_df['gmaps_link'].fillna('No Link Available').astype(str)

    # In case there's no combined_features
    final_df['combined_features'] = (
        final_df['features_text'] + " " +
        final_df['city'] + " " +
        final_df['country'] + " " +
        final_df['indoor_outdoor']
    ).str.lower().str.replace(r'\s+', ' ', regex=True).str.strip()

    # Enforce extra columns expected by train.py and inference.py
    # total_reviews
    if 'total_reviews' not in final_df.columns:
        final_df['total_reviews'] = np.random.randint(10, 500, size=len(final_df))
    # today_hours
    if 'today_hours' not in final_df.columns:
        final_df['today_hours'] = final_df['opening_time']

    # photo_links (photo_link_1 to photo_link_5)
    for i in range(1, 6):
        col = f'photo_link_{i}'
        if col not in final_df.columns:
            final_df[col] = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80'

    # reviews (review_1 to review_5)
    dummy_reviews = [
        'A wonderful place to visit, highly recommended!',
        'Had an amazing time here with friends and family.',
        'Great atmosphere and very friendly vibes.',
        'A must-visit spot on your trip, absolutely loved it.',
        'Pleasant environment, very clean and well maintained.'
    ]
    for i in range(1, 6):
        col = f'review_{i}'
        if col not in final_df.columns:
            final_df[col] = dummy_reviews[i-1]
    # place_type: 'restaurant' or 'destination'
    if 'place_type' not in final_df.columns:
        # Check if restaurant keywords are present in features_text
        keywords = ["restaurant", "food", "cafe", "bar", "bakery", "meal", "dining", "coffee"]
        def classify(text):
            text = str(text).lower()
            for kw in keywords:
                if kw in text:
                    return "restaurant"
            return "destination"
        final_df['place_type'] = final_df['features_text'].apply(classify)

    # price_level scaling
    if 'price_level' in final_df.columns:
        # Replace PRICE_LEVEL_UNSPECIFIED with random/default value, map strings
        final_df['price_level'] = final_df['price_level'].replace('PRICE_LEVEL_UNSPECIFIED', None)
        final_df['price_level'] = final_df['price_level'].replace('PRICE_LEVEL_FREE', 0)
        final_df['price_level'] = final_df['price_level'].replace('PRICE_LEVEL_INEXPENSIVE', 1)
        final_df['price_level'] = final_df['price_level'].replace('PRICE_LEVEL_MODERATE', 2)
        final_df['price_level'] = final_df['price_level'].replace('PRICE_LEVEL_EXPENSIVE', 3)
        final_df['price_level'] = final_df['price_level'].replace('PRICE_LEVEL_VERY_EXPENSIVE', 4)
        # fillna with random or 1
        final_df['price_level'] = final_df['price_level'].fillna(1)
        # convert to numeric
        final_df['price_level'] = pd.to_numeric(final_df['price_level'], errors='coerce').fillna(1).astype(int)
    else:
        final_df['price_level'] = 1

    # Keep necessary columns
    os.makedirs("data/processed", exist_ok=True)
    final_df.to_csv("data/processed/dataset_rekomendasi_final.csv", index=False)
    print("dataset_rekomendasi_final.csv created successfully.")

if __name__ == "__main__":
    build()
