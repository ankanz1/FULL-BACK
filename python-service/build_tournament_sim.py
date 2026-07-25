import os
import json
import numpy as np
import pandas as pd
from prediction_model import (
    load_elo,
    expected_goals,
    poisson_pmf,
    dixon_coles_tau,
    get_team_rating,
    HOME_ADV,
    MAX_GOALS,
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
TEAMS_PATH = os.path.join(DATA_DIR, "tournament_teams.json")
ODDS_OUTPUT = os.path.join(DATA_DIR, "tournament_odds.json")

N_SIMULATIONS = 2000

def simulate_group_match(elo_home: float, elo_away: float, rng: np.random.Generator) -> tuple[int, int]:
    lam = expected_goals(elo_home, elo_away, HOME_ADV)
    mu = expected_goals(elo_away, elo_home, -HOME_ADV / 2)
    goal_probs_h = [poisson_pmf(g, lam) for g in range(MAX_GOALS + 1)]
    goal_probs_a = [poisson_pmf(g, mu) for g in range(MAX_GOALS + 1)]
    joint_probs = np.zeros((MAX_GOALS + 1, MAX_GOALS + 1))
    for i in range(MAX_GOALS + 1):
        for j in range(MAX_GOALS + 1):
            tau = dixon_coles_tau(i, j, lam, mu)
            joint_probs[i][j] = tau * goal_probs_h[i] * goal_probs_a[j]
    joint_probs /= joint_probs.sum()
    flat = joint_probs.flatten()
    idx = rng.choice(len(flat), p=flat)
    return int(idx // (MAX_GOALS + 1)), int(idx % (MAX_GOALS + 1))

class TournamentSimulator:
    def __init__(self, teams_config: dict, elo_df: pd.DataFrame):
        self.groups_config = teams_config["groups"]
        self.all_teams = []
        for g, teams in self.groups_config.items():
            for t in teams:
                rating = get_team_rating(t)
                self.all_teams.append({
                    "name": t,
                    "group": g,
                    "elo": rating or 1500,
                })
        self.team_map = {t["name"]: t for t in self.all_teams}

    def simulate_group_stage(self, rng: np.random.Generator) -> dict:
        group_results = {}
        for group_letter, teams in self.groups_config.items():
            standings = {}
            for t in teams:
                standings[t] = {"pts": 0, "gd": 0, "gf": 0, "ga": 0, "w": 0, "d": 0, "l": 0}
            for i in range(len(teams)):
                for j in range(i + 1, len(teams)):
                    home_t = teams[i]
                    away_t = teams[j]
                    elo_h = self.team_map[home_t]["elo"]
                    elo_a = self.team_map[away_t]["elo"]
                    hg, ag = simulate_group_match(elo_h, elo_a, rng)
                    standings[home_t]["gd"] += hg - ag
                    standings[home_t]["gf"] += hg
                    standings[home_t]["ga"] += ag
                    standings[away_t]["gd"] += ag - hg
                    standings[away_t]["gf"] += ag
                    standings[away_t]["ga"] += hg
                    if hg > ag:
                        standings[home_t]["pts"] += 3
                        standings[home_t]["w"] += 1
                        standings[away_t]["l"] += 1
                    elif ag > hg:
                        standings[away_t]["pts"] += 3
                        standings[away_t]["w"] += 1
                        standings[home_t]["l"] += 1
                    else:
                        standings[home_t]["pts"] += 1
                        standings[away_t]["pts"] += 1
                        standings[home_t]["d"] += 1
                        standings[away_t]["d"] += 1

            sorted_standings = sorted(
                standings.items(),
                key=lambda x: (x[1]["pts"], x[1]["gd"], x[1]["gf"]),
                reverse=True,
            )
            group_results[group_letter] = sorted_standings

        return group_results

    def get_advancing_teams(self, group_results: dict) -> list:
        top_two = []
        third_placed = []
        for group_letter, standing in group_results.items():
            for idx, (team, stats) in enumerate(standing):
                if idx < 2:
                    top_two.append({
                        "team": team,
                        "group": group_letter,
                        "position": idx + 1,
                        "pts": stats["pts"],
                        "gd": stats["gd"],
                        "gf": stats["gf"],
                    })
                elif idx == 2:
                    third_placed.append({
                        "team": team,
                        "group": group_letter,
                        "position": 3,
                        "pts": stats["pts"],
                        "gd": stats["gd"],
                        "gf": stats["gf"],
                    })

        third_placed.sort(key=lambda x: (x["pts"], x["gd"], x["gf"]), reverse=True)
        best_third = third_placed[:8]

        all_advancing = top_two + best_third
        all_advancing.sort(key=lambda x: (x["pts"], x["gd"], x["gf"]), reverse=True)
        return all_advancing

    def simulate_knockout_match(self, team_a: str, team_b: str, rng: np.random.Generator) -> str:
        elo_a = self.team_map[team_a]["elo"]
        elo_b = self.team_map[team_b]["elo"]
        hg, ag = simulate_group_match(elo_a, elo_b, rng)
        if hg != ag:
            return team_a if hg > ag else team_b
        et_hg, et_ag = simulate_group_match(elo_a, elo_b, rng)
        if et_hg != et_ag:
            return team_a if et_hg > et_ag else team_b
        exp_a = 1.0 / (1.0 + 10.0 ** ((elo_b - (elo_a + HOME_ADV)) / 400.0))
        return team_a if rng.random() < exp_a else team_b

    def simulate_tournament(self, rng: np.random.Generator) -> dict:
        group_results = self.simulate_group_stage(rng)
        advancing = self.get_advancing_teams(group_results)
        team_names = [t["team"] for t in advancing]

        results = {
            "champion": None,
            "finalist": None,
            "semi_finalists": [],
            "quarter_finalists": [],
            "round_16": [],
            "round_32": team_names[:],
            "group_stage": [t for t in self.team_map.keys() if t not in team_names],
        }

        if len(team_names) < 2:
            results["round_16"] = team_names[:]
            results["quarter_finalists"] = team_names[:]
            results["semi_finalists"] = team_names[:]
            results["finalist"] = team_names[0] if team_names else None
            results["champion"] = team_names[0] if team_names else None
            return results

        def play_round(teams_in_round: list, round_name: str):
            winners = []
            n = len(teams_in_round)
            for i in range(0, n, 2):
                if i + 1 >= n:
                    winners.append(teams_in_round[i])
                    continue
                winner = self.simulate_knockout_match(teams_in_round[i], teams_in_round[i + 1], rng)
                winners.append(winner)
            return winners

        r32 = team_names
        r16_winners = play_round(r32, "R32")
        results["round_16"] = r16_winners[:]
        qf_winners = play_round(r16_winners, "R16")
        results["quarter_finalists"] = qf_winners[:]
        sf_winners = play_round(qf_winners, "QF")
        results["semi_finalists"] = sf_winners[:]

        if len(sf_winners) >= 2:
            finalist_a = sf_winners[0]
            finalist_b = sf_winners[1]
            champion = self.simulate_knockout_match(finalist_a, finalist_b, rng)
            results["finalist"] = finalist_b if champion == finalist_a else finalist_a
            results["champion"] = champion
        elif len(sf_winners) == 1:
            results["finalist"] = sf_winners[0]
            results["champion"] = sf_winners[0]

        if len(sf_winners) == 2:
            losers = [t for t in qf_winners if t not in sf_winners]
            if len(losers) >= 2:
                bronze_winner = self.simulate_knockout_match(losers[0], losers[1], rng)
                results["bronze"] = bronze_winner

        return results

def main():
    print(f"=== Tournament Simulation ({N_SIMULATIONS} runs) ===")

    with open(TEAMS_PATH) as f:
        teams_config = json.load(f)

    elo_df = load_elo()
    sim = TournamentSimulator(teams_config, elo_df)

    team_stats = {}
    for t in sim.all_teams:
        name = t["name"]
        team_stats[name] = {
            "round_32": 0,
            "round_16": 0,
            "quarter_final": 0,
            "semi_final": 0,
            "final": 0,
            "champion": 0,
            "group_stage_elim": 0,
            "elo": t["elo"],
        }

    for run in range(N_SIMULATIONS):
        rng = np.random.default_rng(run + 42)
        result = sim.simulate_tournament(rng)

        all_advancing = result.get("round_32", [])
        round_16 = result.get("round_16", [])
        qf = result.get("quarter_finalists", [])
        sf = result.get("semi_finalists", [])
        finalist = result.get("finalist")
        champion = result.get("champion")
        group_stage = result.get("group_stage", [])

        for name in all_advancing:
            team_stats[name]["round_32"] += 1
        for name in round_16:
            team_stats[name]["round_16"] += 1
        for name in qf:
            team_stats[name]["quarter_final"] += 1
        for name in sf:
            team_stats[name]["semi_final"] += 1
        if finalist:
            team_stats[finalist]["final"] += 1
        if champion:
            team_stats[champion]["champion"] += 1
        for name in group_stage:
            team_stats[name]["group_stage_elim"] += 1

        if (run + 1) % 200 == 0:
            print(f"  Completed {run + 1}/{N_SIMULATIONS} simulations...")

    output = {
        "total_simulations": N_SIMULATIONS,
        "teams": {},
        "most_likely_champion": None,
        "generated_at": pd.Timestamp.now().isoformat(),
    }

    teams_sorted = sorted(
        team_stats.items(),
        key=lambda x: x[1]["champion"],
        reverse=True,
    )

    for name, stats in teams_sorted:
        pct = lambda v: round(v / N_SIMULATIONS * 100, 1)
        output["teams"][name] = {
            "title_pct": pct(stats["champion"]),
            "final_pct": pct(stats["final"]),
            "semi_pct": pct(stats["semi_final"]),
            "quarter_pct": pct(stats["quarter_final"]),
            "round16_pct": pct(stats["round_16"]),
            "round32_pct": pct(stats["round_32"]),
            "group_pct": pct(stats["group_stage_elim"]),
            "elo": round(stats["elo"], 1),
        }

    if teams_sorted:
        output["most_likely_champion"] = teams_sorted[0][0]
        output["champion_odds"] = [
            {"team": name, "title_pct": pct(stats["champion"])}
            for name, stats in teams_sorted[:10]
        ]

    with open(ODDS_OUTPUT, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n=== Results saved to {ODDS_OUTPUT} ===")
    print(f"\nTop 10 by title probability:")
    for name, stats in teams_sorted[:10]:
        print(f"  {name:20s}  {pct(stats['champion']):5.1f}% title  {pct(stats['final']):5.1f}% final  "
              f"{pct(stats['semi_final']):5.1f}% semi  {pct(stats['round_16']):5.1f}% R16  elo={stats['elo']:.0f}")

if __name__ == "__main__":
    main()
