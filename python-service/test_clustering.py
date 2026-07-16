
import os
import pandas as pd
import numpy as np
from sklearn.metrics import silhouette_score

data_dir = os.path.join(os.path.dirname(__file__), "data")
CSV_PATH = os.path.join(data_dir, "player_clusters.csv")

df = pd.read_csv(CSV_PATH)
df = df.rename(columns={
    "total_goals": "goals",
    "total_assists": "assists",
    "total_minutes_played": "minutes_played"
})

for col in ["key_passes", "tackles", "interceptions", "pass_accuracy"]:
    df[col] = 0

scaled_cols = [c for c in df.columns if c.endswith("_scaled")]
X_scaled = df[scaled_cols].values

sil_score = float(silhouette_score(X_scaled, df["cluster"].values))
print("Silhouette score:", sil_score)
print("Archetypes:", df["archetype"].value_counts())
print("\nSample player (player_id=10):")
print(df[df["player_id"] == 10].to_dict(orient="records")[0])
