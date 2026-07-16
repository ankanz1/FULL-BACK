
import os
import pandas as pd
from sklearn.metrics import silhouette_score

CSV_PATH = os.path.join(os.path.dirname(__file__), "data", "player_clusters.csv")

print("Testing data loading...")
if os.path.exists(CSV_PATH):
    df = pd.read_csv(CSV_PATH)
    print("Successfully loaded {} players!".format(len(df)))
    print("Columns: {}".format(', '.join(df.columns)))
    print("Cluster count: {}".format(df['cluster'].nunique()))
    
    # Test silhouette score calculation
    scaled_cols = [c for c in df.columns if c.endswith('_scaled')]
    X_scaled = df[scaled_cols].values
    sil_score = silhouette_score(X_scaled, df['cluster'].values)
    print("Silhouette score: {:.3f}".format(sil_score))
    print("\nSample players:")
    print(df[['player_id', 'name', 'position', 'archetype', 'total_goals', 'total_assists']].head(10).to_string(index=False))
    
else:
    print("ERROR: player_clusters.csv not found at {}".format(CSV_PATH))
    print("Please run build_clusters.py first!")
