import os
# Load environment variables from root .env if it exists
def load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

load_env()

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import threading

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(_SCRIPT_DIR, "data", "players_stats.csv")

processed_data: Dict[str, Any] = {}
_data_ready = False
_clustering_running = False

def process_clustering():
    global _data_ready
    if _data_ready:
        return
    if not os.path.exists(CSV_PATH):
        print(f"Player stats dataset not found at {CSV_PATH}")
        return

    import pandas as pd
    import numpy as np
    from sklearn.preprocessing import StandardScaler
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score
    from sklearn.decomposition import PCA

    df = pd.read_csv(CSV_PATH)
    df = df[df["position"] != "Goalkeeper"].copy()
    # Sample heavily to fit Render's 512MB free tier
    if len(df) > 3000:
        df = df.sample(n=3000, random_state=42)
    df = df.reset_index(drop=True)
    df["player_id"] = df["player_id"].apply(lambda x: f"PL{int(x):06d}")

    for col in ["goals_per_90", "assists_per_90", "key_passes", "tackles", "interceptions"]:
        if col not in df.columns:
            df[col] = 0

    nf = np.inf
    df["goals_per_90"] = (df["goals"] / df["minutes_played"]).replace([nf, -nf], 0).fillna(0) * 90
    df["assists_per_90"] = (df["assists"] / df["minutes_played"]).replace([nf, -nf], 0).fillna(0) * 90
    df["key_passes_per_90"] = (df["key_passes"] / df["minutes_played"]).replace([nf, -nf], 0).fillna(0) * 90
    df["tackles_per_90"] = (df["tackles"] / df["minutes_played"]).replace([nf, -nf], 0).fillna(0) * 90
    df["interceptions_per_90"] = (df["interceptions"] / df["minutes_played"]).replace([nf, -nf], 0).fillna(0) * 90
    df["pass_accuracy"] = df.get("pass_accuracy", pd.Series(75.0, index=df.index)).fillna(75.0)

    features = [
        "goals_per_90", "assists_per_90", "key_passes_per_90",
        "tackles_per_90", "interceptions_per_90", "pass_accuracy",
    ]
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df[features])

    best_k, best_score = 5, -1
    print("Searching optimal K (3..5)...")
    for k in range(3, 6):
        km = KMeans(n_clusters=k, random_state=42, n_init=3)
        labels = km.fit_predict(X_scaled)
        s = silhouette_score(X_scaled, labels)
        print(f"  K={k}: silhouette={s:.4f}")
        if s > best_score:
            best_score, best_k = s, k

    sil_score = best_score
    print(f"Best K={best_k} (silhouette={sil_score:.4f}). Fitting final model...")
    kmeans = KMeans(n_clusters=best_k, random_state=42, n_init=5)
    labels = kmeans.fit_predict(X_scaled)
    df["cluster"] = labels

    centroids = scaler.inverse_transform(kmeans.cluster_centers_)
    centroid_df = pd.DataFrame(centroids, columns=features)
    g_mean, g_std = centroid_df["goals_per_90"].mean(), centroid_df["goals_per_90"].std()
    a_mean, a_std = centroid_df["assists_per_90"].mean(), centroid_df["assists_per_90"].std()
    kp_mean = centroid_df["key_passes_per_90"].mean()
    t_mean, t_std = centroid_df["tackles_per_90"].mean(), centroid_df["tackles_per_90"].std()

    cluster_labels = {}
    for cid in range(best_k):
        row = centroid_df.loc[cid]
        tags = []
        if row["goals_per_90"] > g_mean + g_std * 0.5:
            tags.append("Elite Goalscorer")
        elif row["goals_per_90"] > g_mean:
            tags.append("Goal Threat")
        if row["assists_per_90"] > a_mean + a_std * 0.5:
            tags.append("Creative Playmaker")
        elif row["assists_per_90"] > a_mean:
            tags.append("Playmaker")
        if row["key_passes_per_90"] > kp_mean + 0.3:
            tags.append("Chance Creator")
        if row["tackles_per_90"] > t_mean + t_std * 0.5:
            tags.append("Ball Winner")
        if not tags:
            tags.append("Contributor")
        cluster_labels[cid] = " · ".join(tags[:2])

    df["archetype"] = df["cluster"].map(cluster_labels)
    for i, feat in enumerate(features):
        df[f"{feat}_scaled"] = X_scaled[:, i]

    pca = PCA(n_components=2)
    coords = pca.fit_transform(X_scaled)
    df["pca_x"] = coords[:, 0]
    df["pca_y"] = coords[:, 1]

    processed_data["df"] = df
    processed_data["X_scaled"] = X_scaled
    processed_data["features"] = features
    processed_data["scaler"] = scaler
    processed_data["silhouette_score"] = sil_score
    processed_data["best_k"] = best_k
    processed_data["pca_variance"] = pca.explained_variance_ratio_.tolist()
    processed_data["archetypes"] = cluster_labels
    _data_ready = True

    print(f"Clustering loaded on {len(df)} outfield players. Best K={best_k}, Silhouette: {sil_score:.3f}")
    print(f"Cluster sizes:\n{df['cluster'].value_counts().sort_index()}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="FULL BACK Data Science Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import json, time, sys
import numpy as np
import requests
from fastapi.staticfiles import StaticFiles
import prediction_model
from sports_api import (
    get_wc_standings,
    get_wc_matches,
    get_team_matches,
    get_wc_scorers,
    extract_standings_for_group,
    extract_all_standings_by_group,
    extract_matches,
    extract_team_form,
    WC_TEAM_IDS,
    _flag_for_country,
)

os.makedirs("public/highlights", exist_ok=True)
app.mount("/public", StaticFiles(directory="public"), name="public")

def ensure_data():
    global _clustering_running
    if _data_ready:
        return
    if not _clustering_running:
        _clustering_running = True
        t = threading.Thread(target=process_clustering, daemon=True)
        t.start()
    if not _data_ready:
        raise HTTPException(status_code=503, detail="Clustering in progress (~15s), try again shortly")

# Helper to call Gemini API
def call_gemini_api(prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return ""
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ]
        }
        res = requests.post(url, json=payload, timeout=10)
        if res.status_code == 200:
            res_data = res.json()
            return res_data["candidates"][0]["content"]["parts"][0]["text"]
        else:
            print(f"Gemini API returned error code {res.status_code}: {res.text}")
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
    return ""

# Mock Sports DB (Matches Node sportsDb)
teams_db = {
    "USA": {"id": "USA", "name": "United States", "code": "USA", "flag": "🇺🇸"},
    "COL": {"id": "COL", "name": "Colombia", "code": "COL", "flag": "🇨🇴"},
    "GER": {"id": "GER", "name": "Germany", "code": "GER", "flag": "🇩🇪"},
    "JPN": {"id": "JPN", "name": "Japan", "code": "JPN", "flag": "🇯🇵"},
    "ARG": {"id": "ARG", "name": "Argentina", "code": "ARG", "flag": "🇦🇷"},
    "ENG": {"id": "ENG", "name": "England", "code": "ENG", "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿"},
    "FRA": {"id": "FRA", "name": "France", "code": "FRA", "flag": "🇫🇷"},
    "MAR": {"id": "MAR", "name": "Morocco", "code": "MAR", "flag": "🇲🇦"},
    "ESP": {"id": "ESP", "name": "Spain", "code": "ESP", "flag": "🇪🇸"},
    "ITA": {"id": "ITA", "name": "Italy", "code": "ITA", "flag": "🇮🇹"},
    "BRA": {"id": "BRA", "name": "Brazil", "code": "BRA", "flag": "🇧🇷"},
    "CRO": {"id": "CRO", "name": "Croatia", "code": "CRO", "flag": "🇭🇷"},
    "NED": {"id": "NED", "name": "Netherlands", "code": "NED", "flag": "🇳🇱"},
    "POR": {"id": "POR", "name": "Portugal", "code": "POR", "flag": "🇵🇹"},
    "SUI": {"id": "SUI", "name": "Switzerland", "code": "SUI", "flag": "🇨🇭"},
    "DEN": {"id": "DEN", "name": "Denmark", "code": "DEN", "flag": "🇩🇰"},
    "URU": {"id": "URU", "name": "Uruguay", "code": "URU", "flag": "🇺🇾"},
    "MEX": {"id": "MEX", "name": "Mexico", "code": "MEX", "flag": "🇲🇽"},
    "SEN": {"id": "SEN", "name": "Senegal", "code": "SEN", "flag": "🇸🇳"},
    "KOR": {"id": "KOR", "name": "South Korea", "code": "KOR", "flag": "🇰🇷"},
    "AUS": {"id": "AUS", "name": "Australia", "code": "AUS", "flag": "🇦🇺"},
}

matches_db = {
    "M001": {
        "match_id": "M001",
        "home_team": teams_db["USA"],
        "away_team": teams_db["COL"],
        "status": "Finished",
        "score": {"home": 2, "away": 1},
        "stage": "GROUP_STAGE",
        "group": "GROUP_A",
        "matchday": 1,
        "stats": {
            "possession": {"home": 48, "away": 52},
            "shots": {"home": 12, "away": 15},
            "shots_on_target": {"home": 5, "away": 4},
            "passes": {"home": 410, "away": 450},
            "pass_accuracy": {"home": 82, "away": 84},
            "fouls": {"home": 11, "away": 14},
            "corners": {"home": 4, "away": 7},
            "saves": {"home": 3, "away": 3},
        },
        "events": [
            {"time": 14, "type": "goal", "detail": "Regular Goal", "team_id": "USA", "player": "Christian Pulisic"},
            {"time": 38, "type": "card", "detail": "Yellow Card", "team_id": "COL", "player": "Jefferson Lerma"},
            {"time": 55, "type": "goal", "detail": "Header Goal", "team_id": "COL", "player": "Luis Diaz"},
            {"time": 76, "type": "goal", "detail": "Regular Goal", "team_id": "USA", "player": "Folarin Balogun"},
        ]
    },
    "M002": {
        "match_id": "M002",
        "home_team": teams_db["GER"],
        "away_team": teams_db["JPN"],
        "status": "Finished",
        "score": {"home": 3, "away": 1},
        "stage": "GROUP_STAGE",
        "group": "GROUP_A",
        "matchday": 1,
        "stats": {
            "possession": {"home": 58, "away": 42},
            "shots": {"home": 18, "away": 9},
            "shots_on_target": {"home": 8, "away": 3},
            "passes": {"home": 590, "away": 380},
            "pass_accuracy": {"home": 89, "away": 79},
            "fouls": {"home": 8, "away": 12},
            "corners": {"home": 6, "away": 3},
            "saves": {"home": 2, "away": 5},
        },
        "events": [
            {"time": 22, "type": "goal", "detail": "Regular Goal", "team_id": "GER", "player": "Florian Wirtz"},
            {"time": 41, "type": "goal", "detail": "Regular Goal", "team_id": "GER", "player": "Jamal Musiala"},
            {"time": 64, "type": "goal", "detail": "Regular Goal", "team_id": "JPN", "player": "Kaoru Mitoma"},
            {"time": 88, "type": "goal", "detail": "Regular Goal", "team_id": "GER", "player": "Kai Havertz"},
        ]
    },
    "M003": {
        "match_id": "M003",
        "home_team": teams_db["ARG"],
        "away_team": teams_db["ENG"],
        "status": "Finished",
        "score": {"home": 2, "away": 2},
        "stage": "GROUP_STAGE",
        "group": "GROUP_B",
        "matchday": 1,
        "stats": {
            "possession": {"home": 51, "away": 49},
            "shots": {"home": 14, "away": 16},
            "shots_on_target": {"home": 6, "away": 7},
            "passes": {"home": 490, "away": 480},
            "pass_accuracy": {"home": 86, "away": 85},
            "fouls": {"home": 12, "away": 15},
            "corners": {"home": 5, "away": 8},
            "saves": {"home": 5, "away": 4},
        },
        "events": [
            {"time": 8, "type": "goal", "detail": "Penalty Goal", "team_id": "ARG", "player": "Lionel Messi"},
            {"time": 27, "type": "goal", "detail": "Regular Goal", "team_id": "ENG", "player": "Harry Kane"},
            {"time": 54, "type": "goal", "detail": "Regular Goal", "team_id": "ENG", "player": "Jude Bellingham"},
            {"time": 82, "type": "goal", "detail": "Regular Goal", "team_id": "ARG", "player": "Lautaro Martinez"},
        ]
    },
    "M004": {
        "match_id": "M004",
        "home_team": teams_db["FRA"],
        "away_team": teams_db["MAR"],
        "status": "Finished",
        "score": {"home": 3, "away": 0},
        "stage": "GROUP_STAGE",
        "group": "GROUP_B",
        "matchday": 1,
        "stats": {},
        "events": []
    },
    "M005": {
        "match_id": "M005",
        "home_team": teams_db["BRA"],
        "away_team": teams_db["ESP"],
        "status": "Scheduled",
        "score": {"home": 0, "away": 0},
        "stage": "GROUP_STAGE",
        "group": "GROUP_C",
        "matchday": 1,
        "stats": {},
        "events": []
    },
    "M006": {
        "match_id": "M006",
        "home_team": teams_db["POR"],
        "away_team": teams_db["CRO"],
        "status": "Scheduled",
        "score": {"home": 0, "away": 0},
        "stage": "GROUP_STAGE",
        "group": "GROUP_C",
        "matchday": 1,
        "stats": {},
        "events": []
    },
    "M007": {
        "match_id": "M007",
        "home_team": teams_db["ITA"],
        "away_team": teams_db["NED"],
        "status": "Scheduled",
        "score": {"home": 0, "away": 0},
        "stage": "GROUP_STAGE",
        "group": "GROUP_D",
        "matchday": 1,
        "stats": {},
        "events": []
    },
    "M008": {
        "match_id": "M008",
        "home_team": teams_db["SUI"],
        "away_team": teams_db["DEN"],
        "status": "Scheduled",
        "score": {"home": 0, "away": 0},
        "stage": "GROUP_STAGE",
        "group": "GROUP_D",
        "matchday": 1,
        "stats": {},
        "events": []
    },
    "R001": {
        "match_id": "R001",
        "home_team": teams_db["GER"],
        "away_team": teams_db["MEX"],
        "status": "Finished",
        "score": {"home": 2, "away": 1},
        "stage": "ROUND_16",
        "date": "2026-06-28T16:00:00Z",
        "stats": {}, "events": []
    },
    "R002": {
        "match_id": "R002",
        "home_team": teams_db["USA"],
        "away_team": teams_db["SEN"],
        "status": "Finished",
        "score": {"home": 3, "away": 0},
        "stage": "ROUND_16",
        "date": "2026-06-28T20:00:00Z",
        "stats": {}, "events": []
    },
    "R003": {
        "match_id": "R003",
        "home_team": teams_db["FRA"],
        "away_team": teams_db["KOR"],
        "status": "Finished",
        "score": {"home": 1, "away": 1, "penalties": {"home": 4, "away": 2}},
        "stage": "ROUND_16",
        "date": "2026-06-29T16:00:00Z",
        "stats": {}, "events": []
    },
    "R004": {
        "match_id": "R004",
        "home_team": teams_db["ARG"],
        "away_team": teams_db["AUS"],
        "status": "Finished",
        "score": {"home": 4, "away": 0},
        "stage": "ROUND_16",
        "date": "2026-06-29T20:00:00Z",
        "stats": {}, "events": []
    },
    "R005": {
        "match_id": "R005",
        "home_team": teams_db["ENG"],
        "away_team": teams_db["URU"],
        "status": "Finished",
        "score": {"home": 2, "away": 1},
        "stage": "ROUND_16",
        "date": "2026-06-30T16:00:00Z",
        "stats": {}, "events": []
    },
    "R006": {
        "match_id": "R006",
        "home_team": teams_db["NED"],
        "away_team": teams_db["ESP"],
        "status": "Scheduled",
        "score": {"home": 0, "away": 0},
        "stage": "ROUND_16",
        "date": "2026-06-30T20:00:00Z",
        "stats": {}, "events": []
    },
    "R007": {
        "match_id": "R007",
        "home_team": teams_db["POR"],
        "away_team": teams_db["SUI"],
        "status": "Scheduled",
        "score": {"home": 0, "away": 0},
        "stage": "ROUND_16",
        "date": "2026-07-01T16:00:00Z",
        "stats": {}, "events": []
    },
    "R008": {
        "match_id": "R008",
        "home_team": teams_db["BRA"],
        "away_team": teams_db["ITA"],
        "status": "Scheduled",
        "score": {"home": 0, "away": 0},
        "stage": "ROUND_16",
        "date": "2026-07-01T20:00:00Z",
        "stats": {}, "events": []
    },
    "Q001": {
        "match_id": "Q001",
        "home_team": teams_db["GER"],
        "away_team": teams_db["USA"],
        "status": "Finished",
        "score": {"home": 2, "away": 1},
        "stage": "QUARTER_FINALS",
        "date": "2026-07-04T16:00:00Z",
        "stats": {}, "events": []
    },
    "Q002": {
        "match_id": "Q002",
        "home_team": teams_db["FRA"],
        "away_team": teams_db["ARG"],
        "status": "Finished",
        "score": {"home": 1, "away": 1, "penalties": {"home": 3, "away": 5}},
        "stage": "QUARTER_FINALS",
        "date": "2026-07-04T20:00:00Z",
        "stats": {}, "events": []
    },
    "Q003": {
        "match_id": "Q003",
        "home_team": teams_db["ENG"],
        "away_team": teams_db["NED"],
        "status": "Scheduled",
        "score": {"home": 0, "away": 0},
        "stage": "QUARTER_FINALS",
        "date": "2026-07-05T16:00:00Z",
        "stats": {}, "events": []
    },
    "Q004": {
        "match_id": "Q004",
        "home_team": teams_db["POR"],
        "away_team": teams_db["BRA"],
        "status": "Scheduled",
        "score": {"home": 0, "away": 0},
        "stage": "QUARTER_FINALS",
        "date": "2026-07-05T20:00:00Z",
        "stats": {}, "events": []
    },
    "S001": {
        "match_id": "S001",
        "home_team": teams_db["GER"],
        "away_team": teams_db["ARG"],
        "status": "Scheduled",
        "score": {"home": 0, "away": 0},
        "stage": "SEMI_FINALS",
        "date": "2026-07-08T20:00:00Z",
        "stats": {}, "events": []
    },
    "S002": {
        "match_id": "S002",
        "home_team": teams_db["ENG"],
        "away_team": teams_db["BRA"],
        "status": "Scheduled",
        "score": {"home": 0, "away": 0},
        "stage": "SEMI_FINALS",
        "date": "2026-07-09T20:00:00Z",
        "stats": {}, "events": []
    },
    "B001": {
        "match_id": "B001",
        "home_team": teams_db["ARG"],
        "away_team": teams_db["BRA"],
        "status": "Scheduled",
        "score": {"home": 0, "away": 0},
        "stage": "BRONZE_FINAL",
        "date": "2026-07-12T16:00:00Z",
        "stats": {}, "events": []
    },
    "F001": {
        "match_id": "F001",
        "home_team": teams_db["GER"],
        "away_team": teams_db["ENG"],
        "status": "Scheduled",
        "score": {"home": 0, "away": 0},
        "stage": "FINAL",
        "date": "2026-07-12T20:00:00Z",
        "stats": {}, "events": []
    }
}

standings_db = {
    "A": [
        {"position": 1, "team": teams_db["GER"], "played": 1, "won": 1, "drawn": 0, "lost": 0, "goals_for": 3, "goals_against": 1, "points": 3},
        {"position": 2, "team": teams_db["USA"], "played": 1, "won": 1, "drawn": 0, "lost": 0, "goals_for": 2, "goals_against": 1, "points": 3},
        {"position": 3, "team": teams_db["COL"], "played": 1, "won": 0, "drawn": 0, "lost": 1, "goals_for": 1, "goals_against": 2, "points": 0},
        {"position": 4, "team": teams_db["JPN"], "played": 1, "won": 0, "drawn": 0, "lost": 1, "goals_for": 1, "goals_against": 3, "points": 0}
    ],
    "B": [
        {"position": 1, "team": teams_db["FRA"], "played": 1, "won": 1, "drawn": 0, "lost": 0, "goals_for": 2, "goals_against": 1, "points": 3},
        {"position": 2, "team": teams_db["ARG"], "played": 1, "won": 0, "drawn": 1, "lost": 0, "goals_for": 2, "goals_against": 2, "points": 1},
        {"position": 3, "team": teams_db["ENG"], "played": 1, "won": 0, "drawn": 1, "lost": 0, "goals_for": 2, "goals_against": 2, "points": 1},
        {"position": 4, "team": teams_db["MAR"], "played": 0, "won": 0, "drawn": 0, "lost": 0, "goals_for": 0, "goals_against": 0, "points": 0}
    ]
}

team_forms_db = {
    "USA": {"team_id": "USA", "team_name": "United States", "form": "WDWLW", "recent_matches": [{"match_id": "M001", "opponent": "Colombia", "score": "2-1", "result": "W", "date": "2026-06-12"}], "goals_scored": 8, "goals_conceded": 5, "clean_sheets": 1},
    "COL": {"team_id": "COL", "team_name": "Colombia", "form": "LWWWD", "recent_matches": [{"match_id": "M001", "opponent": "United States", "score": "1-2", "result": "L", "date": "2026-06-12"}], "goals_scored": 10, "goals_conceded": 3, "clean_sheets": 2},
    "GER": {"team_id": "GER", "team_name": "Germany", "form": "WWWDW", "recent_matches": [{"match_id": "M002", "opponent": "Japan", "score": "3-1", "result": "W", "date": "2026-06-13"}], "goals_scored": 12, "goals_conceded": 5, "clean_sheets": 2},
    "JPN": {"team_id": "JPN", "team_name": "Japan", "form": "LWWLD", "recent_matches": [{"match_id": "M002", "opponent": "Germany", "score": "1-3", "result": "L", "date": "2026-06-13"}], "goals_scored": 6, "goals_conceded": 7, "clean_sheets": 0},
    "ARG": {"team_id": "ARG", "team_name": "Argentina", "form": "WWDWD", "recent_matches": [{"match_id": "M003", "opponent": "England", "score": "2-2", "result": "D", "date": "2026-06-14"}], "goals_scored": 9, "goals_conceded": 4, "clean_sheets": 1},
    "ENG": {"team_id": "ENG", "team_name": "England", "form": "WWDWD", "recent_matches": [{"match_id": "M003", "opponent": "Argentina", "score": "2-2", "result": "D", "date": "2026-06-14"}], "goals_scored": 10, "goals_conceded": 5, "clean_sheets": 0},
    "FRA": {"team_id": "FRA", "team_name": "France", "form": "WWWDW", "recent_matches": [], "goals_scored": 11, "goals_conceded": 4, "clean_sheets": 2},
    "MAR": {"team_id": "MAR", "team_name": "Morocco", "form": "WDLWW", "recent_matches": [], "goals_scored": 7, "goals_conceded": 6, "clean_sheets": 1},
    "MEX": {"team_id": "MEX", "team_name": "Mexico", "form": "WWWWW", "recent_matches": [], "goals_scored": 9, "goals_conceded": 1, "clean_sheets": 3},
    "RSA": {"team_id": "RSA", "team_name": "South Africa", "form": "WDWLL", "recent_matches": [], "goals_scored": 4, "goals_conceded": 5, "clean_sheets": 1},
    "KOR": {"team_id": "KOR", "team_name": "South Korea", "form": "WWLLD", "recent_matches": [], "goals_scored": 6, "goals_conceded": 7, "clean_sheets": 0},
    "NED": {"team_id": "NED", "team_name": "Netherlands", "form": "WWWDW", "recent_matches": [], "goals_scored": 10, "goals_conceded": 3, "clean_sheets": 3},
    "POR": {"team_id": "POR", "team_name": "Portugal", "form": "WWLWW", "recent_matches": [], "goals_scored": 11, "goals_conceded": 4, "clean_sheets": 2},
    "BEL": {"team_id": "BEL", "team_name": "Belgium", "form": "WWDWW", "recent_matches": [], "goals_scored": 8, "goals_conceded": 3, "clean_sheets": 2},
    "SUI": {"team_id": "SUI", "team_name": "Switzerland", "form": "WDLWW", "recent_matches": [], "goals_scored": 5, "goals_conceded": 4, "clean_sheets": 1},
    "ESP": {"team_id": "ESP", "team_name": "Spain", "form": "WDLWD", "recent_matches": [], "goals_scored": 7, "goals_conceded": 5, "clean_sheets": 1},
    "BRA": {"team_id": "BRA", "team_name": "Brazil", "form": "WWWWD", "recent_matches": [], "goals_scored": 12, "goals_conceded": 2, "clean_sheets": 3},
    "CRO": {"team_id": "CRO", "team_name": "Croatia", "form": "WDLDW", "recent_matches": [], "goals_scored": 5, "goals_conceded": 5, "clean_sheets": 1},
    "URU": {"team_id": "URU", "team_name": "Uruguay", "form": "WWLDW", "recent_matches": [], "goals_scored": 6, "goals_conceded": 3, "clean_sheets": 2},
    "DEN": {"team_id": "DEN", "team_name": "Denmark", "form": "WDLWL", "recent_matches": [], "goals_scored": 4, "goals_conceded": 5, "clean_sheets": 1},
    "SEN": {"team_id": "SEN", "team_name": "Senegal", "form": "LDWWW", "recent_matches": [], "goals_scored": 5, "goals_conceded": 6, "clean_sheets": 0},
    "AUS": {"team_id": "AUS", "team_name": "Australia", "form": "LLDWW", "recent_matches": [], "goals_scored": 3, "goals_conceded": 7, "clean_sheets": 0},
    "JPN": {"team_id": "JPN", "team_name": "Japan", "form": "LWWLD", "recent_matches": [], "goals_scored": 6, "goals_conceded": 7, "clean_sheets": 0},
}

# Re-use the correct World Cup team IDs from sports_api
FOOTBALL_DATA_TEAM_IDS = WC_TEAM_IDS

def fetch_real_match_stats(match_id: str):
    api_key = os.getenv("FOOTBALL_DATA_API_KEY")
    try:
        fd_match_id = int(match_id)
    except ValueError:
        fd_match_id = None

    if fd_match_id and api_key:
        try:
            url = f"https://api.football-data.org/v4/matches/{fd_match_id}"
            headers = {"X-Auth-Token": api_key}
            r = requests.get(url, headers=headers, timeout=5)
            if r.status_code == 200:
                data = r.json()
                m = data
                home = m.get("homeTeam", {})
                away = m.get("awayTeam", {})
                score = m.get("score", {})
                ft = score.get("fullTime", {}) or {}
                status = m.get("status", "SCHEDULED")
                status_map = {
                    "FINISHED": "Finished", "SCHEDULED": "Scheduled",
                    "LIVE": "Live", "IN_PLAY": "Live", "PAUSED": "Live",
                    "AWARDED": "Finished", "CANCELED": "Cancelled",
                    "POSTPONED": "Postponed", "SUSPENDED": "Suspended"
                }
                return {
                    "match_id": match_id,
                    "home_team": {
                        "id": str(home.get("id", "")),
                        "name": home.get("name", ""),
                        "code": home.get("tla", home.get("name", "")[:3].upper()),
                        "flag": _flag_for_country(home.get("name", "")),
                    },
                    "away_team": {
                        "id": str(away.get("id", "")),
                        "name": away.get("name", ""),
                        "code": away.get("tla", away.get("name", "")[:3].upper()),
                        "flag": _flag_for_country(away.get("name", "")),
                    },
                    "status": status_map.get(status, status),
                    "score": {
                        "home": ft.get("home") if ft.get("home") is not None else 0,
                        "away": ft.get("away") if ft.get("away") is not None else 0
                    },
                    "date": m.get("utcDate", ""),
                    "stage": m.get("stage", ""),
                    "group": m.get("group", ""),
                    "stats": {
                        "possession": {"home": 0, "away": 0},
                        "shots": {"home": 0, "away": 0},
                        "shots_on_target": {"home": 0, "away": 0},
                        "passes": {"home": 0, "away": 0},
                        "pass_accuracy": {"home": 0, "away": 0},
                        "fouls": {"home": 0, "away": 0},
                        "corners": {"home": 0, "away": 0},
                        "saves": {"home": 0, "away": 0}
                    }
                }
        except Exception as e:
            print("Error fetching real match stats in python-service:", e)

    return matches_db.get(match_id) or matches_db.get("M001")

def fetch_real_team_form(team_code: str):
    api_key = os.getenv("FOOTBALL_DATA_API_KEY")
    team_id = FOOTBALL_DATA_TEAM_IDS.get(team_code.upper())
    if not team_id:
        for k, v in FOOTBALL_DATA_TEAM_IDS.items():
            if team_code.lower() in k.lower() or k.lower() in team_code.lower():
                team_id = v
                break

    if team_id and api_key:
        try:
            url = f"https://api.football-data.org/v4/teams/{team_id}/matches?status=FINISHED&limit=5"
            headers = {"X-Auth-Token": api_key}
            r = requests.get(url, headers=headers, timeout=5)
            if r.status_code == 200:
                data = r.json()
                matches = data.get("matches", [])
                completed = [m for m in matches if m.get("status") == "FINISHED"]
                completed.sort(key=lambda x: x.get("utcDate", ""), reverse=True)
                recent = completed[:5]
                if recent:
                    form = ""
                    for m in recent:
                        is_home = m["homeTeam"]["id"] == team_id
                        ft = m.get("score", {}).get("fullTime", {}) or {}
                        team_score = ft.get("home") if is_home else ft.get("away")
                        opp_score = ft.get("away") if is_home else ft.get("home")
                        if team_score is None or opp_score is None:
                            continue
                        if team_score > opp_score:
                            form = "W" + form
                        elif team_score < opp_score:
                            form = "L" + form
                        else:
                            form = "D" + form
                    return f"Form: {form}. Dynamic recent statistics calculated from last {len(recent)} fixtures."
        except Exception as e:
            print("Error fetching real team form in python-service:", e)

    return team_forms_db.get(team_code.upper()) or "Form: WDLWW. Fallback metrics loaded."

class HealthResponse(BaseModel):
    status: str
    service: str

@app.head("/health")
@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="healthy", service="fullback-python-service")

@app.head("/")
@app.get("/")
async def root():
    return {
        "message": "FULL BACK Python Data Science API is online",
        "has_data": "df" in processed_data
    }

@app.post("/reload")
async def reload_model():
    """Trigger recalculation of the clustering models"""
    try:
        process_clustering()
        return {"status": "success", "silhouette_score": processed_data["silhouette_score"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/players")
async def get_players():
    """Returns all players with their cluster allocations and PCA coordinates"""
    ensure_data()

    df = processed_data["df"]
    df = df.fillna("")
    records = json.loads(df.to_json(orient="records"))
    return records

@app.get("/cluster/player/{player_id}")
async def get_player_cluster(player_id: str):
    """Returns cluster archetype and top 5 similar players for a specific player ID"""
    ensure_data()

    df = processed_data["df"]
    X_scaled = processed_data["X_scaled"]
    
    player_rows = df[df["player_id"] == player_id]
    if player_rows.empty:
        raise HTTPException(status_code=404, detail=f"Player ID {player_id} not found")

    player_idx = player_rows.index[0]
    player_data = player_rows.iloc[0].to_dict()
    player_data = {k: (None if v != v else v) for k, v in player_data.items()}
    
    target_vec = X_scaled[player_idx]
    distances = np.linalg.norm(X_scaled - target_vec, axis=1)
    
    temp_df = df.copy()
    temp_df["distance"] = distances
    
    same_cluster_df = temp_df[temp_df["cluster"] == player_data["cluster"]]
    similar_in_cluster = same_cluster_df[same_cluster_df["player_id"] != player_id].sort_values("distance").head(5)
    
    if len(similar_in_cluster) < 5:
        any_cluster = temp_df[temp_df["player_id"] != player_id].sort_values("distance").head(5)
        similar_list = any_cluster.to_dict(orient="records")
    else:
        similar_list = similar_in_cluster.to_dict(orient="records")

    return {
        "player": player_data,
        "silhouette_score": processed_data["silhouette_score"],
        "model": {
            "k": processed_data.get("best_k", 5),
            "features": list(processed_data.get("features", [])),
        },
        "similar_players": [
            {
                "player_id": p["player_id"],
                "name": p["name"],
                "nationality": p["nationality"],
                "position": p["position"],
                "market_value_m": p["market_value_m"],
                "cluster": int(p["cluster"]),
                "archetype": p["archetype"],
                "similarity_distance": float(p["distance"])
            }
            for p in similar_list
        ]
    }

@app.get("/predict/match/{match_id}")
async def get_match_prediction(match_id: str):
    """Generates an AI match outcome prediction"""
    match = fetch_real_match_stats(match_id)
    if not match:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")
        
    home = match["home_team"]["name"]
    away = match["away_team"]["name"]
    home_code = match["home_team"]["code"]
    away_code = match["away_team"]["code"]
    
    home_form = fetch_real_team_form(home_code)
    away_form = fetch_real_team_form(away_code)
    
    # Heuristic math
    home_score = 0
    away_score = 0
    
    # Analyze recent forms to adjust weights
    if "W" in home_form:
        home_score += home_form.count("W") * 2
    if "W" in away_form:
        away_score += away_form.count("W") * 2
        
    total = home_score + away_score + 10
    home_prob = int((home_score + 5) / total * 100)
    away_prob = int((away_score + 5) / total * 100)
    draw_prob = 100 - home_prob - away_prob
    
    prediction_summary = f"Win Probability: {home} {home_prob}%, {away} {away_prob}%, Draw {draw_prob}%."
    
    # Prompt for AI
    prompt = f"""
    You are FULL BACK, a sports analyst. Generate a highly detailed, professional match outcome prediction for this upcoming match:
    Matchup: {home} vs {away}
    Team Form / Telemetry:
    - {home}: {home_form}
    - {away}: {away_form}
    Our statistical engine predicts:
    - {home} Win Probability: {home_prob}%
    - {away} Win Probability: {away_prob}%
    - Draw Probability: {draw_prob}%
    
    Provide a professional analysis covering:
    1. Key tactical matchup and expectations.
    2. How the current form influences the dynamic.
    3. Final score projection and rationale.
    
    Format the response nicely in Markdown.
    """
    
    ai_response = call_gemini_api(prompt)
    if not ai_response:
        # Fallback generator
        ai_response = f"""### FULL BACK AI Match Analytics Prediction: {home} vs {away}

#### 1. Tactical Matchup & Expectations
This clash features {home} vs {away}. tactical profiles suggest a high-tempo match. {home} will likely seek to control central zones and establish possession, while {away} relies on explosive wing play to expose defensive spaces on the counter.

#### 2. Form & Telemetry Dynamics
- **{home} Form:** {home_form}
- **{away} Form:** {away_form}
The form guide gives a slight advantage to the home side, though cup ties are historically unpredictable in these stages.

#### 3. Mathematical Probability & Score Projection
- **{home} Win:** {home_prob}%
- **{away} Win:** {away_prob}%
- **Draw:** {draw_prob}%

**Projected Final Score:** {home} {int(home_prob/30)} - {int(away_prob/30)} {away}. The model expects a narrow result decided by tactical adjustments in the second half.
"""

    return {
        "match_id": match_id,
        "home_team": home,
        "away_team": away,
        "probabilities": {
            "home_win": home_prob,
            "away_win": away_prob,
            "draw": draw_prob
        },
        "summary": prediction_summary,
        "prediction_analysis": ai_response
    }

@app.get("/tactical/match/{match_id}")
async def get_tactical_breakdown(match_id: str):
    """Generates an AI tactical match breakdown"""
    match = fetch_real_match_stats(match_id)
    if not match:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")
        
    home = match["home_team"]["name"]
    away = match["away_team"]["name"]
    score_str = f"{match['score']['home']} - {match['score']['away']}"
    stats = match["stats"]
    
    # Prompt for AI
    prompt = f"""
    You are FULL BACK, a tactical match analyst. Generate a thorough, professional post-match tactical breakdown for:
    Match: {home} vs {away}
    Final Score: {score_str}
    
    Match Stats:
    - Possession: Home {stats['possession']['home']}% / Away {stats['possession']['away']}%
    - Shots (On Target): Home {stats['shots']['home']}({stats['shots_on_target']['home']}) / Away {stats['shots']['away']}({stats['shots_on_target']['away']})
    - Pass Accuracy: Home {stats['pass_accuracy']['home']}% / Away {stats['pass_accuracy']['away']}%
    - Corners: Home {stats['corners']['home']} / Away {stats['corners']['away']}
    
    Please provide:
    1. Formation and Style Analysis: How both managers setup.
    2. Tactical Pivot Points: Where the match was won or lost.
    3. Standout Player Analysis: Who dictated the game flow.
    
    Format the response nicely in Markdown.
    """
    
    ai_response = call_gemini_api(prompt)
    if not ai_response:
        # Fallback generator
        ai_response = f"""### FULL BACK Tactical Post-Match Breakdown: {home} {score_str} {away}

#### 1. Formation & Tactical Systems
{home} operated in their standard shape, focusing on build-up play from the back with {stats['pass_accuracy']['home']}% passing accuracy and maintaining {stats['possession']['home']}% possession. {away} lined up defensively solid, attempting to choke spaces between the lines.

#### 2. Key Tactical Pivot Points
- **Central Dominance:** {home}'s midfield succeeded in breaking the first line of press, creating {stats['shots']['home']} shot opportunities.
- **Set Piece Threat:** Both teams exploited corner opportunities (Home: {stats['corners']['home']}, Away: {stats['corners']['away']}), creating several box scrambles.

#### 3. Managerial Adjustments
The game changed in the second half when substitutions altered the width of attack, resulting in the final {score_str} scoreline.
"""

    return {
        "match_id": match_id,
        "score": score_str,
        "stats_snapshot": stats,
        "tactical_breakdown": ai_response
    }

@app.get("/cluster/stats")
async def get_cluster_stats():
    """Returns summary statistics for the clustering model"""
    ensure_data()

    df = processed_data["df"]
    archetypes = processed_data["archetypes"]
    
    stats = []
    for c_id, arch_name in archetypes.items():
        sub_df = df[df["cluster"] == c_id]
        stats.append({
            "cluster_id": int(c_id),
            "archetype": arch_name,
            "count": int(len(sub_df)),
            "avg_value_m": float(sub_df["market_value_m"].mean()),
            "avg_goals": float(sub_df["goals"].mean()),
            "avg_assists": float(sub_df["assists"].mean()),
            "avg_key_passes": float(sub_df["key_passes"].mean()),
            "avg_tackles": float(sub_df["tackles"].mean()),
            "avg_interceptions": float(sub_df["interceptions"].mean()),
        })

    return {
        "silhouette_score": processed_data["silhouette_score"],
        "clusters": stats
    }

@app.get("/highlights/match/{match_id}")
async def get_match_highlights(match_id: str):
    """Generates and returns audio-loudness-based match highlights"""
    from highlights import analyze_and_extract_highlights
    video_path = f"public/{match_id}.mp4"
    if not os.path.exists(video_path):
        video_path = "public/sample_match.mp4"
        
    output_dir = f"public/highlights/{match_id}"
    highlights = analyze_and_extract_highlights(video_path, output_dir)
    return {
        "match_id": match_id,
        "highlights": highlights
    }

@app.get("/generate_highlights/{video_id}")
async def generate_highlights(video_id: str):
    """Generates highlights for a specific video ID"""
    from highlights import analyze_and_extract_highlights
    video_path = f"public/{video_id}.mp4"
    if not os.path.exists(video_path):
        video_path = "public/sample_match.mp4"
        
    output_dir = f"public/highlights/{video_id}"
    highlights = analyze_and_extract_highlights(video_path, output_dir)
    return {
        "video_id": video_id,
        "highlights": highlights
    }

# Free endpoints for dashboard
@app.get("/standings/{group}")
async def get_standings(group: str):
    """Get group standings — fetches live from football-data.org WC competition"""
    group = group.upper()
    try:
        raw = await get_wc_standings()
        if "error" not in raw:
            result = extract_standings_for_group(raw, group)
            if result:
                return result
            all_groups = extract_all_standings_by_group(raw)
            if group in all_groups:
                return all_groups[group]
        print(f"WC API returned error for standings, using fallback: {raw.get('error', 'unknown')}")
    except Exception as e:
        print(f"Error fetching WC standings: {e}")

    if group in standings_db:
        return standings_db[group]
    raise HTTPException(status_code=404, detail=f"Group {group} not found")

@app.get("/matches")
async def get_all_matches():
    """Get all matches (fixtures) — fetches live from football-data.org WC competition"""
    try:
        raw = await get_wc_matches()
        if "error" not in raw:
            extracted = extract_matches(raw)
            if extracted:
                return extracted
        print(f"WC API error for matches, using fallback: {raw.get('error', 'unknown')}")
    except Exception as e:
        print(f"Error fetching WC matches: {e}")
    return list(matches_db.values())

@app.get("/matches/{match_id}")
async def get_match(match_id: str):
    """Get single match by football-data.org match ID"""
    match = fetch_real_match_stats(match_id)
    if match:
        return match

    try:
        raw = await get_wc_matches()
        if "error" not in raw:
            extracted = extract_matches(raw)
            for m in extracted:
                if m["match_id"] == match_id:
                    return m
    except Exception as e:
        print(f"Error looking up match {match_id}: {e}")

    raise HTTPException(status_code=404, detail=f"Match {match_id} not found")

@app.get("/team-form/{team_id}")
async def get_team_form(team_id: str):
    """Get team form and recent matches — fetches from football-data.org"""
    team_id = team_id.upper()

    fd_id = WC_TEAM_IDS.get(team_id)
    if not fd_id:
        rev = {str(v): k for k, v in WC_TEAM_IDS.items()}
        mapped = rev.get(team_id)
        if mapped:
            fd_id = WC_TEAM_IDS.get(mapped)
    if fd_id:
        try:
            raw = await get_team_matches(fd_id)
            if "error" not in raw:
                form = extract_team_form(raw, fd_id)
                if form:
                    return form
                print(f"Team {team_id} (FD ID {fd_id}): no form data found")
        except Exception as e:
            print(f"Error fetching form for {team_id}: {e}")

    if team_id in team_forms_db:
        return team_forms_db[team_id]
    return team_forms_db.get("USA", {"team_id": team_id, "team_name": team_id, "form": "N/A", "recent_matches": [], "goals_scored": 0, "goals_conceded": 0, "clean_sheets": 0})

@app.get("/player-stats")
async def get_player_stats():
    """Get top scorers and assist leaders"""
    ensure_data()
    
    df = processed_data["df"]
    top_scorers = df.sort_values("goals", ascending=False).head(10).to_dict(orient="records")
    top_assists = df.sort_values("assists", ascending=False).head(10).to_dict(orient="records")
    
    return {
        "top_scorers": top_scorers,
        "top_assists": top_assists
    }

# ── WC 2026 Scorers cache ──────────────────────────────────────────────────
WC_STATS_CACHE: dict = {"data": None, "fetched_at": 0}
WC_STATS_CACHE_TTL = 300
WC_STATS_FALLBACK = {
    "top_scorers": [
        {"player_id": "331500", "name": "Kylian Mbappé", "nationality": "France", "position": "Forward", "goals": 10, "assists": 4, "team_name": "France"},
        {"player_id": "332200", "name": "Lionel Messi", "nationality": "Argentina", "position": "Forward", "goals": 8, "assists": 4, "team_name": "Argentina"},
        {"player_id": "331100", "name": "Erling Haaland", "nationality": "Norway", "position": "Forward", "goals": 7, "assists": 0, "team_name": "Norway"},
        {"player_id": "330800", "name": "Jude Bellingham", "nationality": "England", "position": "Midfielder", "goals": 7, "assists": 1, "team_name": "England"},
        {"player_id": "330200", "name": "Harry Kane", "nationality": "England", "position": "Forward", "goals": 6, "assists": 1, "team_name": "England"},
        {"player_id": "331600", "name": "Ousmane Dembélé", "nationality": "France", "position": "Forward", "goals": 6, "assists": 2, "team_name": "France"},
        {"player_id": "332100", "name": "Mikel Oyarzabal", "nationality": "Spain", "position": "Forward", "goals": 5, "assists": 1, "team_name": "Spain"},
        {"player_id": "333000", "name": "Julián Quiñones", "nationality": "Mexico", "position": "Forward", "goals": 4, "assists": 1, "team_name": "Mexico"},
        {"player_id": "330500", "name": "Vinicius Junior", "nationality": "Brazil", "position": "Forward", "goals": 4, "assists": 1, "team_name": "Brazil"},
        {"player_id": "334000", "name": "Ismaïla Sarr", "nationality": "Senegal", "position": "Forward", "goals": 4, "assists": 0, "team_name": "Senegal"},
        {"player_id": "330700", "name": "Folarin Balogun", "nationality": "United States", "position": "Forward", "goals": 4, "assists": 1, "team_name": "United States"},
        {"player_id": "331800", "name": "Jamal Musiala", "nationality": "Germany", "position": "Midfielder", "goals": 3, "assists": 3, "team_name": "Germany"},
        {"player_id": "332500", "name": "Bukayo Saka", "nationality": "England", "position": "Forward", "goals": 3, "assists": 2, "team_name": "England"},
        {"player_id": "332800", "name": "Gonçalo Ramos", "nationality": "Portugal", "position": "Forward", "goals": 3, "assists": 1, "team_name": "Portugal"},
        {"player_id": "330900", "name": "Lautaro Martínez", "nationality": "Argentina", "position": "Forward", "goals": 3, "assists": 1, "team_name": "Argentina"},
    ],
    "top_assists": [
        {"player_id": "331500", "name": "Kylian Mbappé", "nationality": "France", "position": "Forward", "goals": 10, "assists": 4, "team_name": "France"},
        {"player_id": "332200", "name": "Lionel Messi", "nationality": "Argentina", "position": "Forward", "goals": 8, "assists": 4, "team_name": "Argentina"},
        {"player_id": "331800", "name": "Jamal Musiala", "nationality": "Germany", "position": "Midfielder", "goals": 3, "assists": 3, "team_name": "Germany"},
        {"player_id": "331600", "name": "Ousmane Dembélé", "nationality": "France", "position": "Forward", "goals": 6, "assists": 2, "team_name": "France"},
        {"player_id": "332500", "name": "Bukayo Saka", "nationality": "England", "position": "Forward", "goals": 3, "assists": 2, "team_name": "England"},
        {"player_id": "330800", "name": "Jude Bellingham", "nationality": "England", "position": "Midfielder", "goals": 7, "assists": 1, "team_name": "England"},
        {"player_id": "330200", "name": "Harry Kane", "nationality": "England", "position": "Forward", "goals": 6, "assists": 1, "team_name": "England"},
        {"player_id": "332100", "name": "Mikel Oyarzabal", "nationality": "Spain", "position": "Forward", "goals": 5, "assists": 1, "team_name": "Spain"},
        {"player_id": "333000", "name": "Julián Quiñones", "nationality": "Mexico", "position": "Forward", "goals": 4, "assists": 1, "team_name": "Mexico"},
        {"player_id": "330500", "name": "Vinicius Junior", "nationality": "Brazil", "position": "Forward", "goals": 4, "assists": 1, "team_name": "Brazil"},
        {"player_id": "330700", "name": "Folarin Balogun", "nationality": "United States", "position": "Forward", "goals": 4, "assists": 1, "team_name": "United States"},
        {"player_id": "332800", "name": "Gonçalo Ramos", "nationality": "Portugal", "position": "Forward", "goals": 3, "assists": 1, "team_name": "Portugal"},
        {"player_id": "330900", "name": "Lautaro Martínez", "nationality": "Argentina", "position": "Forward", "goals": 3, "assists": 1, "team_name": "Argentina"},
        {"player_id": "333500", "name": "Phil Foden", "nationality": "England", "position": "Midfielder", "goals": 2, "assists": 3, "team_name": "England"},
        {"player_id": "333100", "name": "Antoine Griezmann", "nationality": "France", "position": "Forward", "goals": 2, "assists": 3, "team_name": "France"},
    ],
}

@app.get("/wc/stats")
async def get_wc_stats():
    """Real World Cup 2026 top scorers and assist leaders from football-data.org"""
    now = time.time()
    if WC_STATS_CACHE["data"] and (now - WC_STATS_CACHE["fetched_at"]) < WC_STATS_CACHE_TTL:
        return WC_STATS_CACHE["data"]
    try:
        raw = await get_wc_scorers(40)
        if "error" not in raw and raw.get("scorers"):
            scorers = raw["scorers"]
            top_scorers = []
            top_assists = []
            for s in scorers:
                player = s.get("player", {})
                team = s.get("team", {})
                p = {
                    "player_id": str(player.get("id", "")),
                    "name": player.get("name", ""),
                    "nationality": player.get("nationality", ""),
                    "position": player.get("position", ""),
                    "goals": s.get("goals", 0) or 0,
                    "assists": s.get("assists", 0) or 0,
                    "team_name": team.get("name", ""),
                }
                top_scorers.append(p)
                top_assists.append(p)
            top_scorers.sort(key=lambda x: x["goals"], reverse=True)
            top_assists.sort(key=lambda x: x["assists"], reverse=True)
            result = {"top_scorers": top_scorers, "top_assists": top_assists}
            WC_STATS_CACHE["data"] = result
            WC_STATS_CACHE["fetched_at"] = now
            return result
        print(f"WC scorers API error: {raw.get('error', 'unknown')}")
    except Exception as e:
        print(f"Error fetching WC scorers: {e}")
    return WC_STATS_FALLBACK

NEWS_CACHE = {"data": None, "fetched_at": 0}
NEWS_CACHE_TTL = 900
NEWS_FEED_URL = "https://www.fotmob.com/api/news?page=1"

@app.get("/news")
async def get_news():
    """Get football news headlines, cached server-side."""
    import feedparser
    now = time.time()
    if NEWS_CACHE["data"] and (now - NEWS_CACHE["fetched_at"]) < NEWS_CACHE_TTL:
        return NEWS_CACHE["data"]
    try:
        feed = feedparser.parse("https://www.theguardian.com/football/rss")
        items = []
        for entry in feed.entries[:20]:
            items.append({
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "source": "The Guardian",
                "published": entry.get("published", ""),
            })
        result = {"headlines": items}
        NEWS_CACHE["data"] = result
        NEWS_CACHE["fetched_at"] = now
        return result
    except Exception as e:
        if NEWS_CACHE["data"]:
            return NEWS_CACHE["data"]
        raise HTTPException(status_code=502, detail=f"Failed to fetch news: {str(e)}")

_snapshot_model = None
def _get_snapshot_model():
    global _snapshot_model
    if _snapshot_model is None:
        from ultralytics import YOLO
        _snapshot_model = YOLO("yolov8n.pt")
    return _snapshot_model

@app.get("/tactics/snapshot")
async def get_tactical_snapshot():
    """Return cached tactical snapshot if available, otherwise placeholder."""
    image_path = os.path.join(_SCRIPT_DIR, "public", "tactical_snapshot.png")
    caption_path = os.path.join(_SCRIPT_DIR, "public", "tactical_snapshot_caption.txt")

    if os.path.exists(image_path) and os.path.exists(caption_path):
        age = time.time() - os.path.getmtime(image_path)
        if age < 3600:
            caption = ""
            if os.path.exists(caption_path):
                with open(caption_path) as f:
                    caption = f.read().strip()
            return {
                "type": "tactical_snapshot",
                "image_url": "/public/tactical_snapshot.png",
                "caption": caption or "Tactical snapshot generated."
            }

    return {
        "type": "tactical_snapshot",
        "image_url": None,
        "caption": "Tactical snapshot unavailable — video processing requires a GPU-backed deployment."
    }

_analyst_model = None
def _get_analyst_model():
    global _analyst_model
    if _analyst_model is None:
        from ultralytics import YOLO
        model_path = os.path.join(_SCRIPT_DIR, "models", "football-detector", "train", "weights", "best.pt")
        if os.path.exists(model_path):
            _analyst_model = YOLO(model_path)
        else:
            _analyst_model = YOLO(os.path.join(_SCRIPT_DIR, "yolov8n.pt"))
    return _analyst_model



@app.get("/analyst/tactical")
async def get_analyst_tactical():
    """Returns cached tactical analysis if available, otherwise returns a placeholder."""
    image_path = os.path.join(_SCRIPT_DIR, "public", "tactical_analyst.png")
    caption_path = os.path.join(_SCRIPT_DIR, "public", "tactical_analyst_caption.txt")

    if os.path.exists(image_path) and os.path.exists(caption_path):
        age = time.time() - os.path.getmtime(image_path)
        caption = ""
        if os.path.exists(caption_path):
            with open(caption_path) as f:
                caption = f.read().strip()
        if age < 3600:
            return {
                "type": "tactical_analyst",
                "image_url": "/public/tactical_analyst.png",
                "caption": caption or "Tactical analysis generated.",
                "formations": {},
            }

    return {
        "type": "tactical_analyst",
        "image_url": None,
        "caption": "Tactical analysis is temporarily unavailable on the demo server due to the high CPU requirements of real-time video processing. This feature requires a GPU-backed deployment.",
        "formations": {},
    }

@app.get("/predict/match")
async def predict_match(home_team: str, away_team: str):
    result = prediction_model.predict_match(home_team, away_team)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@app.get("/predict/tournament")
async def predict_tournament():
    odds_path = os.path.join(_SCRIPT_DIR, "data", "tournament_odds.json")
    if not os.path.exists(odds_path):
        raise HTTPException(status_code=503, detail="Tournament odds not yet generated. Run build_tournament_sim.py first.")
    with open(odds_path) as f:
        return json.load(f)

@app.get("/predict/teams")
async def predict_teams():
    try:
        teams = prediction_model.get_all_teams()
        return {"teams": teams}
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))

@app.get("/predict/elo/{team_name}")
async def predict_team_elo(team_name: str):
    rating = prediction_model.get_team_rating(team_name)
    if rating is None:
        raise HTTPException(status_code=404, detail=f"Team '{team_name}' not found")
    return {"team": team_name, "elo": rating}

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")

    system_prompt = (
        "You are FULL BACK, an elite World Cup 2026 football analyst AI. "
        "You have access to match data, player statistics, tactical analysis, Elo-based predictions, "
        "and player clustering via K-Means archetypes. "
        "Answer concisely and authoritatively. "
        "Keep responses under 3-4 paragraphs. "
        "Use markdown formatting when listing data. "
        "You do not execute code or access live data — respond with knowledge and analysis only."
    )

    contents = []
    for msg in req.history:
        role = "model" if msg.role == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": msg.content}]})
    contents.append({"role": "user", "parts": [{"text": req.message}]})

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": contents
        }
        res = requests.post(url, json=payload, timeout=30)
        if res.status_code == 200:
            res_data = res.json()
            text = res_data["candidates"][0]["content"]["parts"][0]["text"]
            return {"response": text}
        elif res.status_code == 429:
            return {"response": "FULL BACK's Gemini API quota is currently exhausted. Please try again later or upgrade the API plan. In the meantime, try using the prediction and tactical breakdown features — they work independently of the chat."}
        else:
            detail = f"Gemini API returned status {res.status_code}"
            try:
                detail += f": {res.json()}"
            except Exception:
                detail += f": {res.text[:200]}"
            print(f"Chat error: {detail}")
            return {"response": f"FULL BACK chat is temporarily unavailable (API error {res.status_code}). Please try again later."}
    except requests.Timeout:
        return {"response": "FULL BACK's Gemini API timed out. Please try again with a shorter question."}
    except Exception as e:
        print(f"Chat error: {e}")
        return {"response": "FULL BACK encountered an internal error. Please try again later."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
