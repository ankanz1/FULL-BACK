import os
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

def main():
    # Data directory (relative to script location)
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    
    # Step 1: Load and inspect data
    print("=== Step 1: Loading and inspecting data ===")
    
    players_df = pd.read_csv(os.path.join(data_dir, "players.csv"))
    appearances_df = pd.read_csv(os.path.join(data_dir, "appearances.csv"))
    
    print(f"Players CSV columns: {list(players_df.columns)}")
    print(f"Players CSV shape: {players_df.shape}")
    print(f"Appearances CSV columns: {list(appearances_df.columns)}")
    print(f"Appearances CSV shape: {appearances_df.shape}")
    print("\n")

    # Step 2: Aggregate appearances by player
    print("=== Step 2: Aggregating player stats ===")
    player_agg = appearances_df.groupby("player_id").agg(
        total_minutes_played=("minutes_played", "sum"),
        total_goals=("goals", "sum"),
        total_assists=("assists", "sum"),
        games_played=("appearance_id", "count")
    ).reset_index()
    
    print(f"Number of players in appearances: {len(player_agg)}")
    print(f"Player aggregate stats: \n{player_agg.describe()}")
    print("\n")
    
    # Step 3: Filter low-minute players
    print("=== Step 3: Filtering low-minute players (>=450 minutes) ===")
    min_minutes = 450
    player_agg = player_agg[player_agg["total_minutes_played"] >= min_minutes].copy()
    print(f"Players after filtering: {len(player_agg)}")
    print("\n")
    
    # Step4: Engineer per-90 metrics
    print("=== Step4: Calculating per-90 metrics ===")
    player_agg["goals_per_90"] = (player_agg["total_goals"] / player_agg["total_minutes_played"]) * 90
    player_agg["assists_per_90"] = (player_agg["total_assists"] / player_agg["total_minutes_played"]) * 90
    
    # Step5: Join with players.csv for name, position etc.
    print("=== Step5: Joining with players data ===")
    # Select columns we need from players
    players_subset = players_df[["player_id", "name", "position", "sub_position", "market_value_in_eur", "country_of_citizenship"]].copy()
    
    merged_df = pd.merge(
        left=player_agg,
        right=players_subset,
        on="player_id",
        how="left"
    )
    # Handle any missing names/market value
    merged_df["name"] = merged_df["name"].fillna("Unknown Player")
    merged_df["market_value_in_eur"] = merged_df["market_value_in_eur"].fillna(0)
    merged_df["market_value_m"] = merged_df["market_value_in_eur"] / 1_000_000
    merged_df["nationality"] = merged_df["country_of_citizenship"]
    
    print(f"Merged DataFrame shape: {merged_df.shape}")
    print(f"Merged DF head:\n{merged_df[['player_id', 'name', 'total_goals', 'goals_per_90']].head()}")
    print("\n")

    # Step6: Standardize features and cluster
    print("=== Step6: Clustering players ===")
    
    # Feature selection
    features = ["goals_per_90", "assists_per_90"]
    
    # Handle any missing/inf values (division by zero)
    for f in features:
        merged_df[f] = merged_df[f].replace([np.inf, -np.inf], 0).fillna(0)
    
    # Standardize
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(merged_df[features])
    
    # Find optimal k (try 3-6, pick best silhouette)
    best_k = 5
    best_score = -1
    best_labels = None
    
    for k in range(3, 7):
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = kmeans.fit_predict(scaled_features)
        score = silhouette_score(scaled_features, labels)
        print(f"k={k}, silhouette score={score:.4f}")
        
        if score > best_score:
            best_k = k
            best_score = score
            best_labels = labels
    
    print(f"\nBest k: {best_k} with silhouette score {best_score:.4f}")
    
    # Assign clusters
    merged_df["cluster"] = best_labels
    
    # Step7: Inspect clusters and assign labels
    print("\n=== Step7: Analyzing clusters ===")
    cluster_means = merged_df.groupby("cluster")[features].mean().round(3)
    cluster_sizes = merged_df["cluster"].value_counts().sort_index()
    
    print("Cluster means:\n", cluster_means)
    print("\nCluster sizes:\n", cluster_sizes)
    
    # Assign human-readable labels based on cluster characteristics
    cluster_labels = {}
    for cluster_id in range(best_k):
        cluster_data = cluster_means.loc[cluster_id]
        if cluster_data["goals_per_90"] > cluster_means["goals_per_90"].mean() + 0.5:
            label = "Elite Goalscorer"
        elif cluster_data["assists_per_90"] > cluster_means["assists_per_90"].mean() + 0.3:
            label = "Creative Playmaker"
        elif cluster_data["goals_per_90"] > cluster_means["goals_per_90"].mean() and cluster_data["assists_per_90"] > cluster_means["assists_per_90"].mean():
            label = "All-Around Forward"
        else:
            label = "Contributor"
        
        cluster_labels[cluster_id] = label
    
    print("\nCluster labels:", cluster_labels)
    merged_df["archetype"] = merged_df["cluster"].map(cluster_labels)

    # Step8: Add scaled features for distance calculations later
    scaled_df = pd.DataFrame(scaled_features, index=merged_df.index, columns=[f"{f}_scaled" for f in features])
    final_df = pd.concat([merged_df, scaled_df], axis=1)

    # Step9: Save the results
    output_path = os.path.join(data_dir, "player_clusters.csv")
    final_df.to_csv(output_path, index=False)
    print(f"\n=== Step9: Results saved to {output_path} ===")

if __name__ == "__main__":
    main()
