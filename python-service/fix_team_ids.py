import os
os.environ["FOOTBALL_DATA_API_KEY"] = "ebdabe24c7a84a6992d8471d89ce9466"

from sports_api import get_wc_standings, get_wc_matches
import json

# Get team IDs from standings
d = get_wc_standings()
standings = d.get("standings", [])
team_ids = {}
for g in standings:
    for row in g.get("table", []):
        team = row.get("team", {})
        tid = team.get("id")
        name = team.get("name", "")
        tla = team.get("tla", "")
        if tid and tla:
            team_ids[tla] = tid

# Also get team IDs from matches
m = get_wc_matches()
matches = m.get("matches", [])
for match in matches:
    for side in ["homeTeam", "awayTeam"]:
        team = match.get(side, {})
        tid = team.get("id")
        name = team.get("name", "")
        tla = team.get("tla", "")
        if tid and tla and tla not in team_ids:
            team_ids[tla] = tid

print("CORRECT WC_TEAM_IDS:")
for k in sorted(team_ids.keys()):
    print(f'    "{k}": {team_ids[k]},')
