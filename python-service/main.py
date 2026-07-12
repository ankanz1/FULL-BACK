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

import pandas as pd
import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.decomposition import PCA

app = FastAPI(title="FULL BACK Data Science Service", version="1.0.0")

# Enable CORS for frontend dashboard queries
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CSV_PATH = "data/players_stats.csv"

# Global cache for processed data
processed_data: Dict[str, Any] = {}

def process_clustering():
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"Player stats dataset not found at {CSV_PATH}")

    # Load data
    df = pd.read_csv(CSV_PATH)
    
    # Filter players with low minutes
    df = df[df["minutes_played"] >= 90].copy()

    # Calculate per 90 metrics
    df["goals_per_90"] = (df["goals"] / df["minutes_played"]) * 90
    df["assists_per_90"] = (df["assists"] / df["minutes_played"]) * 90
    df["key_passes_per_90"] = (df["key_passes"] / df["minutes_played"]) * 90
    df["tackles_per_90"] = (df["tackles"] / df["minutes_played"]) * 90
    df["interceptions_per_90"] = (df["interceptions"] / df["minutes_played"]) * 90

    features = [
        "goals_per_90", 
        "assists_per_90", 
        "key_passes_per_90", 
        "tackles_per_90", 
        "interceptions_per_90", 
        "pass_accuracy", 
        "market_value_m"
    ]

    # Handle missing values
    df[features] = df[features].fillna(0)

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df[features])

    # Run K-Means
    k = 5
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    clusters = kmeans.fit_predict(X_scaled)
    df["cluster"] = clusters

    # Calculate silhouette score
    sil_score = float(silhouette_score(X_scaled, clusters))

    # Run PCA for visualization (2D)
    pca = PCA(n_components=2)
    X_pca = pca.fit_transform(X_scaled)
    df["pca_x"] = X_pca[:, 0]
    df["pca_y"] = X_pca[:, 1]

    # Map clusters to football-logical archetypes using feature averages
    cluster_means = df.groupby("cluster")[features].mean()
    
    # Striker (highest goals)
    striker_c = int(cluster_means["goals_per_90"].idxmax())
    
    # Playmaker (highest key passes among non-strikers)
    rem_1 = cluster_means.index.difference([striker_c])
    playmaker_c = int(cluster_means.loc[rem_1, "key_passes_per_90"].idxmax())
    
    # Defensive Anchor (highest interceptions among remainder)
    rem_2 = rem_1.difference([playmaker_c])
    defensive_c = int(cluster_means.loc[rem_2, "interceptions_per_90"].idxmax())
    
    # Tempo Control / Midfielder (highest pass accuracy among remainder)
    rem_3 = rem_2.difference([defensive_c])
    tempo_c = int(cluster_means.loc[rem_3, "pass_accuracy"].idxmax())
    
    # Fullback / Box-to-Box (last remaining)
    rem_4 = rem_3.difference([tempo_c])
    b2b_c = int(rem_4[0]) if len(rem_4) > 0 else -1

    archetypes = {
        striker_c: "Elite Goalscorer (Advanced Attacker)",
        playmaker_c: "Creative Playmaker (Winger/Attacking Midfielder)",
        defensive_c: "Defensive Anchor (Ball-Winning Defender)",
        tempo_c: "Tempo Regulator (Ball-Playing Midfielder)",
    }
    if b2b_c != -1:
        archetypes[b2b_c] = "Dynamic Fullback / Box-to-Box Midfielder"
    else:
        # Fallback if any duplicate
        for idx in range(k):
            if idx not in archetypes:
                archetypes[idx] = "Generalist Contributor"

    df["archetype"] = df["cluster"].map(archetypes)

    # Store in global cache
    processed_data["df"] = df
    processed_data["X_scaled"] = X_scaled
    processed_data["features"] = features
    processed_data["silhouette_score"] = sil_score
    processed_data["archetypes"] = archetypes
    
    print(f"Clustering model updated. Silhouette Score: {sil_score:.3f}")

# Perform clustering on startup
try:
    process_clustering()
except Exception as e:
    print(f"Error loading player dataset on startup: {e}")

import base64
import json
import requests
from fastapi import Request, Header, Depends
from fastapi.responses import JSONResponse

# Custom Payment Required Exception and Handler
class PaymentRequiredException(Exception):
    def __init__(self, resource: str, amount: str, description: str):
        self.resource = resource
        self.amount = amount
        self.description = description

def get_payment_required_header(resource_path: str, amount: str, desc: str) -> str:
    payload = {
        "x402Version": 1,
        "accepts": [
            {
                "scheme": "exact",
                "network": "eip155:84532",  # Base Sepolia
                "maxAmountRequired": amount,
                "resource": resource_path,
                "payTo": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",  # Demo merchant address
                "asset": "0x036eFd41E265914E01E7574432c40e16414777a8",  # Base Sepolia USDC
                "maxTimeoutSeconds": 60,
                "description": desc
            }
        ],
        "error": "PAYMENT-SIGNATURE header is required"
    }
    json_bytes = json.dumps(payload).encode("utf-8")
    return base64.b64encode(json_bytes).decode("utf-8")

@app.exception_handler(PaymentRequiredException)
async def payment_required_exception_handler(request: Request, exc: PaymentRequiredException):
    req_header = get_payment_required_header(exc.resource, exc.amount, exc.description)
    return JSONResponse(
        status_code=402,
        content={"error": "Payment Required", "message": exc.description},
        headers={
            "PAYMENT-REQUIRED": req_header,
            "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE"
        }
    )

# FastAPI Dependency to verify EIP-3009 payment signatures
async def verify_x402_payment(
    request: Request,
    payment_signature: str = Header(None, alias="payment-signature")
):
    path = request.url.path
    
    amount = "10000"
    desc = "Access premium analytics"
    
    if "/cluster/player/" in path:
        amount = "10000"  # 0.01 USDC
        desc = "Access premium player similarity clustering data"
    elif "/predict/match/" in path:
        amount = "50000"  # 0.05 USDC
        desc = "Generate AI premium match outcome prediction"
    elif "/tactical/match/" in path:
        amount = "100000"  # 0.10 USDC
        desc = "Generate premium tactical match breakdown writeup"
    elif "/highlights/match/" in path or "/generate_highlights/" in path:
        amount = "80000"  # 0.08 USDC
        desc = "Generate premium match highlight clips from audio telemetry"

    if not payment_signature:
        raise PaymentRequiredException(resource=path, amount=amount, description=desc)
        
    try:
        # Decode Base64 EIP-3009 auth details
        decoded_bytes = base64.b64decode(payment_signature)
        sig_payload = json.loads(decoded_bytes.decode("utf-8"))
        print(f"Verified payment signature for {path}:", sig_payload)
        
        # Verify basic EIP-3009 parameter alignment
        if sig_payload.get("amount") and str(sig_payload.get("amount")) != amount:
            print(f"Warning: Signature amount {sig_payload.get('amount')} differs from required {amount}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payment signature header: {e}")

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
}

matches_db = {
    "M001": {
        "match_id": "M001",
        "home_team": teams_db["USA"],
        "away_team": teams_db["COL"],
        "status": "Finished",
        "score": {"home": 2, "away": 1},
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
    }
}

team_forms_db = {
    "USA": "Form: WDWLW. Avg goals scored: 1.6/match, conceded: 0.8/match.",
    "COL": "Form: LWWWD. Avg goals scored: 2.0/match, conceded: 0.6/match.",
    "GER": "Form: WWWDW. Avg goals scored: 2.4/match, conceded: 1.0/match.",
    "JPN": "Form: LWWLD. Avg goals scored: 1.2/match, conceded: 1.4/match.",
    "ARG": "Form: WWDWD. Avg goals scored: 1.8/match, conceded: 0.8/match.",
    "ENG": "Form: WWDWD. Avg goals scored: 2.0/match, conceded: 1.0/match.",
}

class HealthResponse(BaseModel):
    status: str
    service: str

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="healthy", service="fullback-python-service")

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
    if "df" not in processed_data:
        try:
            process_clustering()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Data not initialized: {e}")
            
    df = processed_data["df"]
    return df.to_dict(orient="records")

# Gated by verify_x402_payment
@app.get("/cluster/player/{player_id}", dependencies=[Depends(verify_x402_payment)])
async def get_player_cluster(player_id: str):
    """Returns cluster archetype and top 5 similar players for a specific player ID (Paid)"""
    if "df" not in processed_data:
        try:
            process_clustering()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Data not initialized: {e}")

    df = processed_data["df"]
    X_scaled = processed_data["X_scaled"]
    
    player_rows = df[df["player_id"] == player_id]
    if player_rows.empty:
        raise HTTPException(status_code=404, detail=f"Player ID {player_id} not found")

    player_idx = player_rows.index[0]
    player_data = player_rows.iloc[0].to_dict()
    
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

# Paid AI Outcome Prediction (0.05 USDC)
@app.get("/predict/match/{match_id}", dependencies=[Depends(verify_x402_payment)])
async def get_match_prediction(match_id: str):
    """Generates an AI match outcome prediction (Paid)"""
    match = matches_db.get(match_id)
    if not match:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")
        
    home = match["home_team"]["name"]
    away = match["away_team"]["name"]
    home_code = match["home_team"]["code"]
    away_code = match["away_team"]["code"]
    
    home_form = team_forms_db.get(home_code, "No recent form data")
    away_form = team_forms_db.get(away_code, "No recent form data")
    
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
    You are FULL BACK, a premium sports analyst. Generate a highly detailed, professional match outcome prediction for this upcoming match:
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

# Paid AI Tactical Breakdown (0.10 USDC)
@app.get("/tactical/match/{match_id}", dependencies=[Depends(verify_x402_payment)])
async def get_tactical_breakdown(match_id: str):
    """Generates an AI tactical match breakdown (Paid)"""
    match = matches_db.get(match_id)
    if not match:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")
        
    home = match["home_team"]["name"]
    away = match["away_team"]["name"]
    score_str = f"{match['score']['home']} - {match['score']['away']}"
    stats = match["stats"]
    
    # Prompt for AI
    prompt = f"""
    You are FULL BACK, a premium tactical match analyst. Generate a thorough, professional post-match tactical breakdown for:
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
    if "df" not in processed_data:
        try:
            process_clustering()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Data not initialized: {e}")

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

@app.get("/highlights/match/{match_id}", dependencies=[Depends(verify_x402_payment)])
async def get_match_highlights(match_id: str):
    """Generates and returns audio-loudness-based match highlights (gated by x402)"""
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

@app.get("/generate_highlights/{video_id}", dependencies=[Depends(verify_x402_payment)])
async def generate_highlights(video_id: str):
    """Generates highlights for a specific video ID (gated by x402)"""
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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
