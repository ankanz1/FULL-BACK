import os
import json
import math
import numpy as np
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
ELO_PATH = os.path.join(DATA_DIR, "elo_ratings.csv")
TOURNAMENT_ODDS_PATH = os.path.join(DATA_DIR, "tournament_odds.json")
TOURNAMENT_TEAMS_PATH = os.path.join(DATA_DIR, "tournament_teams.json")

HOME_ADV = 75
DC_RHO = -0.13
MAX_GOALS = 8

_elo_cache = None

def load_elo() -> pd.DataFrame:
    global _elo_cache
    if _elo_cache is None:
        if not os.path.exists(ELO_PATH):
            raise FileNotFoundError(f"Elo ratings file not found: {ELO_PATH}. Run build_elo_ratings.py first.")
        _elo_cache = pd.read_csv(ELO_PATH)
    return _elo_cache

def get_team_rating(team_name: str) -> float | None:
    df = load_elo()
    row = df[df["team"].str.lower() == team_name.lower()]
    if row.empty:
        row = df[df["team"].str.contains(team_name, case=False)]
    if row.empty:
        return None
    return float(row.iloc[0]["rating"])

def get_all_teams() -> list[dict]:
    try:
        df = load_elo()
        return df.to_dict(orient="records")
    except FileNotFoundError as e:
        raise FileNotFoundError(f"Elo data unavailable: {e}")

def expected_goals(rating: float, opponent: float, home_bonus: float = 0) -> float:
    diff = (rating + home_bonus) - opponent
    lam = 1.35 + diff / 400
    return max(0.3, min(3.5, lam))

def dixon_coles_tau(x: int, y: int, lam: float, mu: float, rho: float = DC_RHO) -> float:
    if x == 0 and y == 0:
        return 1.0 - lam * mu * rho
    if x == 0 and y == 1:
        return 1.0 + lam * rho
    if x == 1 and y == 0:
        return 1.0 + mu * rho
    if x == 1 and y == 1:
        return 1.0 - rho
    return 1.0

def poisson_pmf(k: int, lam: float) -> float:
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    p = math.exp(-lam)
    for i in range(1, k + 1):
        p *= lam / i
    return p

def _match_joint_probs(rating_a: float, rating_b: float, home_bonus: float) -> np.ndarray:
    lam = expected_goals(rating_a, rating_b, home_bonus)
    mu = expected_goals(rating_b, rating_a, -home_bonus / 2)
    probs_h = [poisson_pmf(g, lam) for g in range(MAX_GOALS + 1)]
    probs_a = [poisson_pmf(g, mu) for g in range(MAX_GOALS + 1)]
    joint = np.zeros((MAX_GOALS + 1, MAX_GOALS + 1))
    for i in range(MAX_GOALS + 1):
        for j in range(MAX_GOALS + 1):
            tau = dixon_coles_tau(i, j, lam, mu)
            joint[i][j] = probs_h[i] * probs_a[j] * tau
    joint /= joint.sum()
    return joint

def match_prob(rating_a: float, rating_b: float, home_bonus: float = 0) -> dict:
    lam = expected_goals(rating_a, rating_b, home_bonus)
    mu = expected_goals(rating_b, rating_a, -home_bonus / 2)
    win_a, draw, win_b = 0.0, 0.0, 0.0
    probs_h = [poisson_pmf(g, lam) for g in range(MAX_GOALS + 1)]
    probs_a = [poisson_pmf(g, mu) for g in range(MAX_GOALS + 1)]
    for i in range(MAX_GOALS + 1):
        for j in range(MAX_GOALS + 1):
            tau = dixon_coles_tau(i, j, lam, mu)
            p = probs_h[i] * probs_a[j] * tau
            if i > j:
                win_a += p
            elif i < j:
                win_b += p
            else:
                draw += p
    total = win_a + draw + win_b
    return {
        "home_win_pct": round(win_a / total * 100, 1),
        "draw_pct": round(draw / total * 100, 1),
        "away_win_pct": round(win_b / total * 100, 1),
        "expected_goals": {"home": round(lam, 3), "away": round(mu, 3)},
    }

def sample_match(rating_a: float, rating_b: float, home_bonus: float = 0,
                 allow_draw: bool = True, rng: np.random.Generator = None) -> tuple[int, int]:
    if rng is None:
        rng = np.random.default_rng()
    lam = expected_goals(rating_a, rating_b, home_bonus)
    mu = expected_goals(rating_b, rating_a, -home_bonus / 2)
    probs_h = [poisson_pmf(g, lam) for g in range(MAX_GOALS + 1)]
    probs_a = [poisson_pmf(g, mu) for g in range(MAX_GOALS + 1)]
    probs_h = np.array(probs_h)
    probs_a = np.array(probs_a)
    goals_a = int(rng.choice(MAX_GOALS + 1, p=probs_h / probs_h.sum()))
    goals_b = int(rng.choice(MAX_GOALS + 1, p=probs_a / probs_a.sum()))
    if not allow_draw and goals_a == goals_b:
        exp = 1.0 / (1.0 + 10.0 ** ((rating_b - (rating_a + home_bonus)) / 400.0))
        if rng.random() < exp:
            goals_a += 1
        else:
            goals_b += 1
    return goals_a, goals_b

def simulate_match(
    elo_home: float,
    elo_away: float,
    home_advantage: bool = True,
    n_simulations: int = 10000,
) -> dict:
    joint = _match_joint_probs(elo_home, elo_away, HOME_ADV if home_advantage else 0)
    flat = joint.flatten()
    lam = expected_goals(elo_home, elo_away, HOME_ADV if home_advantage else 0)
    mu = expected_goals(elo_away, elo_home, -HOME_ADV / 2 if home_advantage else 0)
    sample = np.random.choice(len(flat), size=n_simulations, p=flat)
    home_goals_all = sample // (MAX_GOALS + 1)
    away_goals_all = sample % (MAX_GOALS + 1)
    home_wins = int((home_goals_all > away_goals_all).sum())
    away_wins = int((away_goals_all > home_goals_all).sum())
    draws = n_simulations - home_wins - away_wins
    return {
        "home_win_pct": round(home_wins / n_simulations * 100, 1),
        "draw_pct": round(draws / n_simulations * 100, 1),
        "away_win_pct": round(away_wins / n_simulations * 100, 1),
        "expected_goals": {"home": round(lam, 3), "away": round(mu, 3)},
        "n_simulations": n_simulations,
    }

def predict_match(home_team: str, away_team: str) -> dict:
    elo_home = get_team_rating(home_team)
    elo_away = get_team_rating(away_team)
    if elo_home is None:
        return {"error": f"Team '{home_team}' not found in Elo ratings"}
    if elo_away is None:
        return {"error": f"Team '{away_team}' not found in Elo ratings"}
    result = simulate_match(elo_home, elo_away)
    result["home_team"] = home_team
    result["away_team"] = away_team
    result["elo_home"] = round(elo_home, 1)
    result["elo_away"] = round(elo_away, 1)
    return result

def simulate_match_deterministic(elo_home: float, elo_away: float, rng: np.random.Generator) -> tuple[int, int]:
    return sample_match(elo_home, elo_away, HOME_ADV, allow_draw=True, rng=rng)

if __name__ == "__main__":
    result = predict_match("Argentina", "Brazil")
    print(json.dumps(result, indent=2))
