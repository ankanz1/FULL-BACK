import requests, json

api_key = "ebdabe24c7a84a6992d8471d89ce9466"
headers = {"X-Auth-Token": api_key}

# 1. Check competitions list for World Cup
r = requests.get("https://api.football-data.org/v4/competitions", headers=headers, timeout=10)
data = r.json()
wc = [c for c in data['competitions'] if 'world' in c['name'].lower() or 'wc' in c['code'].lower() or 'fifa' in c['name'].lower()]
print("=== World Cup competitions found ===")
for c in wc:
    print(f"  ID={c['id']} name={c['name']} code={c['code']} plan={c['plan']}")
    s = c.get('currentSeason', {})
    print(f"  Season: start={s.get('startDate')} end={s.get('endDate')} matchday={s.get('currentMatchday')}")
print()

# 2. Get WC competition info
r = requests.get("https://api.football-data.org/v4/competitions/WC", headers=headers, timeout=10)
print(f"GET /competitions/WC: HTTP {r.status_code}")
if r.status_code == 200:
    info = r.json()
    print(f"  Keys: {list(info.keys())}")
    print(f"  name={info.get('name')} area={info.get('area', {}).get('name')}")
    s = info.get('currentSeason', {})
    print(f"  Season: id={s.get('id')} start={s.get('startDate')} end={s.get('endDate')} matchday={s.get('currentMatchday')}")
print()

# 3. Try WC standings
r = requests.get("https://api.football-data.org/v4/competitions/WC/standings", headers=headers, timeout=10)
print(f"GET /competitions/WC/standings: HTTP {r.status_code}")
if r.status_code == 200:
    print(json.dumps(r.json(), indent=2)[:500])
else:
    print(f"  Body: {r.text[:200]}")
print()

# 4. Try WC matches with season
r = requests.get("https://api.football-data.org/v4/competitions/WC/matches", headers=headers, timeout=10)
print(f"GET /competitions/WC/matches: HTTP {r.status_code}")
if r.status_code == 200:
    print(json.dumps(r.json(), indent=2)[:500])
else:
    print(f"  Body: {r.text[:200]}")
print()

# 5. Try WC matches with season=2026
r = requests.get("https://api.football-data.org/v4/competitions/WC/matches?season=2026", headers=headers, timeout=10)
print(f"GET /competitions/WC/matches?season=2026: HTTP {r.status_code}")
if r.status_code == 200:
    print(json.dumps(r.json(), indent=2)[:500])
else:
    print(f"  Body: {r.text[:200]}")
print()

# 6. Check rate limit headers on each request
print(f"Rate limit remaining this minute: {r.headers.get('X-Requests-Available-Minute', 'N/A')}")
print(f"Rate limit counter: {r.headers.get('X-RequestCounter-All', 'N/A')}")
