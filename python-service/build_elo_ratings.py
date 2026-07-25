import os
import json
import pandas as pd
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
RESULTS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "arcdata", "results.csv")
ELO_OUTPUT = os.path.join(DATA_DIR, "elo_ratings.csv")

HOME_ADV = 75
DEFAULT_SEED = 1500
RECENCY_HALF_MONTHS = 18

SEED_PRIORS = {
    "Argentina": 2085, "France": 2065, "Spain": 2055, "Brazil": 2045,
    "England": 2000, "Portugal": 1980, "Netherlands": 1965, "Germany": 1945,
    "Belgium": 1925, "Italy": 1915, "Colombia": 1890, "Uruguay": 1875,
    "Croatia": 1870, "Morocco": 1840, "Switzerland": 1825, "Mexico": 1825,
    "Japan": 1810, "Senegal": 1795, "Denmark": 1790, "Ecuador": 1760,
    "Australia": 1735, "South Korea": 1730, "Iran": 1720, "Poland": 1715,
    "Canada": 1700, "Serbia": 1695, "Ghana": 1665, "Tunisia": 1655,
    "Ivory Coast": 1655, "Nigeria": 1645, "Saudi Arabia": 1640, "Qatar": 1630,
    "Egypt": 1620, "Algeria": 1615, "Cameroon": 1600, "Paraguay": 1595,
    "Venezuela": 1590, "Turkey": 1874, "Sweden": 1850, "Norway": 1912,
    "Czech Republic": 1570, "Ukraine": 1580, "Iraq": 1500, "Mali": 1500,
    "United States": 1830, "New Zealand": 1495, "Panama": 1480, "China": 1500,
}

def base_k(tournament: str) -> int:
    t = tournament.lower()
    if "fifa world cup" in t and "qualification" not in t and "qual" not in t:
        return 55
    if "world cup" in t and ("qualification" in t or "qual" in t):
        return 40
    if any(x in t for x in ["copa america", "euro championship", "asian cup", "africa cup", "gold cup", "euro"]):
        return 50
    if "nations league" in t or "nations cup" in t:
        return 32
    if "friendly" in t:
        return 18
    return 28

def recency_weight(match_date_sec: float, now_sec: float) -> float:
    months_ago = (now_sec - match_date_sec) / (30.44 * 86400)
    return 0.5 ** (months_ago / RECENCY_HALF_MONTHS)

def goal_diff_multiplier(gd: int) -> float:
    d = abs(gd)
    if d <= 1:
        return 1.0
    if d == 2:
        return 1.5
    return (11 + d) / 8

def expected_score(rating_a: float, rating_b: float, home_bonus: float = 0) -> float:
    return 1.0 / (1.0 + 10.0 ** ((rating_b - (rating_a + home_bonus)) / 400.0))

def main():
    print("=== Step 1: Loading results data ===")
    df = pd.read_csv(RESULTS_PATH)
    print(f"Loaded {len(df)} matches")
    print(f"Date range: {df['date'].min()} to {df['date'].max()}")

    df = df.sort_values("date").reset_index(drop=True)
    df["date"] = pd.to_datetime(df["date"])

    now_ts = df["date"].iloc[-1].timestamp()

    print("\n=== Step 2: Computing calibrated Elo ratings ===")
    R = {}
    def get_r(name: str) -> float:
        if name not in R:
            R[name] = SEED_PRIORS.get(name, DEFAULT_SEED)
        return R[name]

    total_matches = len(df)
    skipped_nan = 0
    applied = 0

    for idx, row in df.iterrows():
        home = row["home_team"]
        away = row["away_team"]
        hg = row["home_score"]
        ag = row["away_score"]

        if pd.isna(hg) or pd.isna(ag):
            skipped_nan += 1
            continue

        hg, ag = int(hg), int(ag)
        tournament = str(row["tournament"])
        neutral = str(row.get("neutral", "FALSE")).upper() == "TRUE"
        match_ts = row["date"].timestamp()

        r_home = get_r(home)
        r_away = get_r(away)

        home_bonus = HOME_ADV if not neutral else 0
        exp_h = expected_score(r_home, r_away, home_bonus)

        if hg > ag:
            score_h = 1.0
        elif hg < ag:
            score_h = 0.0
        else:
            score_h = 0.5

        k = base_k(tournament)
        rec = recency_weight(match_ts, now_ts)
        gdm = goal_diff_multiplier(hg - ag)
        delta = k * rec * gdm * (score_h - exp_h)

        R[home] = r_home + delta
        R[away] = r_away - delta
        applied += 1

        if (idx + 1) % 10000 == 0:
            print(f"  Processed {idx + 1}/{total_matches} matches...")

    print(f"\n  Applied {applied} weighted matches ({skipped_nan} skipped for NaN)")

    print("\n=== Step 3: Blending with priors (70% calibrated + 30% prior) ===")
    blended = {}
    for name, calibrated in R.items():
        prior = SEED_PRIORS.get(name, DEFAULT_SEED)
        blended[name] = round(0.7 * calibrated + 0.3 * prior, 1)

    print("\n=== Step 4: Saving Elo ratings ===")
    final_records = []
    for team in sorted(blended.keys(), reverse=True, key=lambda t: blended[t]):
        final_records.append({
            "team": team,
            "rating": blended[team],
            "matches": applied,
            "last_date": df["date"].iloc[-1].strftime("%Y-%m-%d"),
        })

    ratings_df = pd.DataFrame(final_records)
    ratings_df.to_csv(ELO_OUTPUT, index=False)
    print(f"Saved {len(ratings_df)} team ratings to {ELO_OUTPUT}")
    print(f"\nTop 20 teams:")
    print(ratings_df.head(20).to_string(index=False))

    print("\n=== Done ===")

if __name__ == "__main__":
    main()
