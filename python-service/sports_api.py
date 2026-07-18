"""
Shared rate-limited fetch layer for football-data.org API.

Handles:
  - Rate limiting (max 8 req/min, free tier allows 10)
  - Response caching with configurable TTLs
  - Proper error surfacing (logs HTTP status + response body)
  - World Cup (WC) competition data
"""

import os
import time
import json
import logging
from typing import Optional, Any
from functools import wraps

import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sports_api")

API_BASE = "https://api.football-data.org/v4"
WC_COMPETITION = "WC"  # football-data.org code for FIFA World Cup

MIN_REQ_INTERVAL = 7.5  # seconds between requests (~8 req/min max)

# ── Rate limiter ──────────────────────────────────────────────────────────
_last_req_time: float = 0.0

def _rate_limit():
    global _last_req_time
    now = time.time()
    elapsed = now - _last_req_time
    if elapsed < MIN_REQ_INTERVAL:
        sleep_for = MIN_REQ_INTERVAL - elapsed
        logger.info(f"Rate limiter: sleeping {sleep_for:.1f}s")
        time.sleep(sleep_for)
    _last_req_time = time.time()

# ── Cache ─────────────────────────────────────────────────────────────────
_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL = {
    "standings": 60,
    "matches": 60,
    "team_matches": 120,
    "competition": 300,
}

def _cached(key: str, ttl_key: str = "matches") -> Optional[Any]:
    if key in _cache:
        inserted, data = _cache[key]
        if time.time() - inserted < CACHE_TTL.get(ttl_key, 60):
            return data
        del _cache[key]
    return None

def _set_cache(key: str, data: Any):
    _cache[key] = (time.time(), data)

# ── Authenticated request ─────────────────────────────────────────────────
def _api_get(path: str) -> dict:
    api_key = os.getenv("FOOTBALL_DATA_API_KEY")
    if not api_key:
        logger.warning("FOOTBALL_DATA_API_KEY not set, skipping API call")
        return {"error": "API key not configured"}

    _rate_limit()
    url = f"{API_BASE}{path}"
    headers = {"X-Auth-Token": api_key}

    try:
        r = requests.get(url, headers=headers, timeout=10)
        logger.info(f"GET {path} -> HTTP {r.status_code}")

        if r.status_code == 200:
            return r.json()

        body = r.text[:500]
        logger.error(f"API error {r.status_code} for {path}: {body}")

        if r.status_code == 429:
            logger.error("RATE LIMITED. Waiting 60s...")
            time.sleep(60)
            r = requests.get(url, headers=headers, timeout=10)
            if r.status_code == 200:
                return r.json()

        return {"error": f"HTTP {r.status_code}", "detail": body, "path": path}
    except requests.exceptions.Timeout:
        logger.error(f"Timeout fetching {path}")
        return {"error": "timeout", "path": path}
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection error fetching {path}: {e}")
        return {"error": "connection_error", "path": path}
    except Exception as e:
        logger.error(f"Unexpected error fetching {path}: {e}")
        return {"error": str(e), "path": path}

# ── Public API ────────────────────────────────────────────────────────────
def get_wc_info() -> dict:
    cache_key = "wc_info"
    cached = _cached(cache_key, "competition")
    if cached:
        return cached
    data = _api_get(f"/competitions/{WC_COMPETITION}")
    if "error" not in data:
        _set_cache(cache_key, data)
    return data

def get_wc_standings() -> list[dict]:
    cache_key = "wc_standings"
    cached = _cached(cache_key, "standings")
    if cached:
        return cached
    data = _api_get(f"/competitions/{WC_COMPETITION}/standings")
    if "error" not in data:
        _set_cache(cache_key, data)
    return data

def get_wc_matches() -> list[dict]:
    cache_key = "wc_matches"
    cached = _cached(cache_key, "matches")
    if cached:
        return cached
    data = _api_get(f"/competitions/{WC_COMPETITION}/matches")
    if "error" not in data:
        _set_cache(cache_key, data)
    return data

def get_team_matches(team_id: int) -> dict:
    cache_key = f"team_matches_{team_id}"
    cached = _cached(cache_key, "team_matches")
    if cached:
        return cached
    data = _api_get(f"/teams/{team_id}/matches?status=FINISHED&limit=10")
    if "error" not in data:
        _set_cache(cache_key, data)
    return data

def extract_standings_for_group(raw: dict, group_letter: str) -> list[dict]:
    """Extract a single group's standings from the WC standings response."""
    standings_list = raw.get("standings", [])
    for group_data in standings_list:
        group_name = (group_data.get("group") or "").upper()
        target = group_letter.upper()
        if target in group_name.replace("GROUP ", ""):
            table = group_data.get("table", [])
            result = []
            for row in table:
                team = row.get("team", {})
                result.append({
                    "position": row.get("position"),
                    "team": {
                        "id": str(team.get("id", "")),
                        "name": team.get("name", ""),
                        "code": team.get("tla", ""),
                        "flag": _flag_for_country(team.get("name", "")),
                    },
                    "played": row.get("playedGames"),
                    "won": row.get("won"),
                    "drawn": row.get("draw"),
                    "lost": row.get("lost"),
                    "goals_for": row.get("goalsFor"),
                    "goals_against": row.get("goalsAgainst"),
                    "points": row.get("points"),
                })
            return result
    return []

def extract_all_standings_by_group(raw: dict) -> dict[str, list[dict]]:
    """Extract all group standings as {GROUP_LETTER: [...]}."""
    result = {}
    standings_list = raw.get("standings", [])
    for group_data in standings_list:
        group_name = (group_data.get("group") or "").upper()
        table = group_data.get("table", [])
        rows = []
        for row in table:
            team = row.get("team", {})
            rows.append({
                "position": row.get("position"),
                "team": {
                    "id": str(team.get("id", "")),
                    "name": team.get("name", ""),
                    "code": team.get("tla", ""),
                    "flag": _flag_for_country(team.get("name", "")),
                },
                "played": row.get("playedGames"),
                "won": row.get("won"),
                "drawn": row.get("draw"),
                "lost": row.get("lost"),
                "goals_for": row.get("goalsFor"),
                "goals_against": row.get("goalsAgainst"),
                "goals_difference": row.get("goalDifference"),
                "points": row.get("points"),
            })
        letter = group_name.replace("GROUP ", "").replace("GROUP_", "")
        result[letter] = rows
    return result

def extract_matches(raw: dict) -> list[dict]:
    """Extract match list from WC matches response."""
    matches = raw.get("matches", [])
    result = []
    for m in matches:
        home = m.get("homeTeam", {})
        away = m.get("awayTeam", {})
        score = m.get("score", {})
        ft = score.get("fullTime", {}) or {}
        status_map = {
            "FINISHED": "Finished", "SCHEDULED": "Scheduled",
            "LIVE": "Live", "IN_PLAY": "Live", "PAUSED": "Live",
            "AWARDED": "Finished", "CANCELED": "Cancelled",
            "POSTPONED": "Postponed", "SUSPENDED": "Suspended",
            "TIMED": "Scheduled",
        }
        stage = m.get("stage", "")
        group = m.get("group", "")
        result.append({
            "match_id": str(m.get("id", "")),
            "home_team": {
                "id": str(home.get("id", "")),
                "name": home.get("name", ""),
                "code": home.get("tla", ""),
                "flag": _flag_for_country(home.get("name", "")),
            },
            "away_team": {
                "id": str(away.get("id", "")),
                "name": away.get("name", ""),
                "code": away.get("tla", ""),
                "flag": _flag_for_country(away.get("name", "")),
            },
            "status": status_map.get(m.get("status", ""), m.get("status", "")),
            "score": {
                "home": ft.get("home") if ft.get("home") is not None else 0,
                "away": ft.get("away") if ft.get("away") is not None else 0,
            },
            "date": m.get("utcDate", ""),
            "stage": stage,
            "group": group,
            "matchday": m.get("matchday"),
        })
    return result

def extract_team_form(raw: dict, team_id: int) -> Optional[dict]:
    """Extract form data for a specific team from their matches response."""
    matches = raw.get("matches", [])
    completed = [m for m in matches if m.get("status") == "FINISHED"]
    completed.sort(key=lambda x: x.get("utcDate", ""), reverse=True)
    recent = completed[:5]
    if not recent:
        return None

    team_name = ""
    form = ""
    goals_scored = 0
    goals_conceded = 0
    clean_sheets = 0
    recent_list = []

    for i, m in enumerate(recent):
        home_team = m.get("homeTeam", {})
        away_team = m.get("awayTeam", {})
        is_home = home_team.get("id") == team_id
        team_name = home_team.get("name") if is_home else away_team.get("name")
        opp_name = away_team.get("name") if is_home else home_team.get("name")
        ft = m.get("score", {}).get("fullTime", {}) or {}
        ts = ft.get("home") if is_home else ft.get("away")
        os_ = ft.get("away") if is_home else ft.get("home")
        if ts is None or os_ is None:
            continue
        goals_scored += ts
        goals_conceded += os_
        if os_ == 0:
            clean_sheets += 1
        result = "W" if ts > os_ else "L" if ts < os_ else "D"
        form = result + form
        recent_list.append({
            "match_id": f"WC_{m.get('id', '')}_{i}",
            "opponent": opp_name,
            "score": f"{ft.get('home', 0)}-{ft.get('away', 0)}",
            "result": result,
            "date": (m.get("utcDate") or "")[:10],
        })

    return {
        "team_id": str(team_id),
        "team_name": team_name,
        "form": form or "N/A",
        "recent_matches": recent_list,
        "goals_scored": goals_scored,
        "goals_conceded": goals_conceded,
        "clean_sheets": clean_sheets,
    }

def _flag_for_country(name: str) -> str:
    if not name:
        return "⚽"
    n = name.lower()
    flags = {
        "united states": "🇺🇸", "usa": "🇺🇸", "colombia": "🇨🇴",
        "germany": "🇩🇪", "japan": "🇯🇵", "argentina": "🇦🇷",
        "england": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "france": "🇫🇷", "morocco": "🇲🇦",
        "spain": "🇪🇸", "italy": "🇮🇹", "brazil": "🇧🇷",
        "croatia": "🇭🇷", "portugal": "🇵🇹", "netherlands": "🇳🇱",
        "belgium": "🇧🇪", "switzerland": "🇨🇭", "denmark": "🇩🇰",
        "uruguay": "🇺🇾", "mexico": "🇲🇽", "senegal": "🇸🇳",
        "poland": "🇵🇱", "australia": "🇦🇺", "serbia": "🇷🇸",
        "south korea": "🇰🇷", "cameroon": "🇨🇲", "ghana": "🇬🇭",
        "canada": "🇨🇦", "ecuador": "🇪🇨", "saudi arabia": "🇸🇦",
        "iran": "🇮🇷", "tunisia": "🇹🇳", "costa rica": "🇨🇷",
        "wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿", "qatar": "🇶🇦",
        "south africa": "🇿🇦", "republic of ireland": "🇮🇪", "ivory coast": "🇨🇮",
        "dr congo": "🇨🇩", "cape verde": "🇨🇻", "hungary": "🇭🇺",
        "greece": "🇬🇷", "romania": "🇷🇴", "slovakia": "🇸🇰",
        "russia": "🇷🇺", "sweden": "🇸🇪", "norway": "🇳🇴",
        "finland": "🇫🇮", "ukraine": "🇺🇦", "austria": "🇦🇹",
        "turkey": "🇹🇷", "czech republic": "🇨🇿", "slovenia": "🇸🇮",
        "bosnia": "🇧🇦", "montenegro": "🇲🇪", "north macedonia": "🇲🇰",
        "albania": "🇦🇱", "iceland": "🇮🇸", "iraq": "🇮🇶",
        "jordan": "🇯🇴", "uzbekistan": "🇺🇿", "new zealand": "🇳🇿",
        "paraguay": "🇵🇾", "curaçao": "🇨🇼", "haiti": "🇭🇹",
        "panama": "🇵🇦", "egypt": "🇪🇬", "algeria": "🇩🇿",
        "nigeria": "🇳🇬", "mali": "🇲🇱", "zambia": "🇿🇲",
        "angola": "🇦🇴", "cameroon": "🇨🇲", "kenya": "🇰🇪",

    }
    for key, flag in flags.items():
        if key in n:
            return flag
    return "⚽"

# ── Football-data.org team ID mapping for WC teams ────────────────────────
# These are the numeric team IDs on football-data.org used for /teams/{id}/matches
WC_TEAM_IDS: dict[str, int] = {
    "ALG": 778, "ARG": 762, "AUS": 779, "AUT": 816,
    "BEL": 805, "BIH": 1060, "BRA": 764, "CAN": 828,
    "CIV": 1935, "COD": 1934, "COL": 818, "CPV": 1930,
    "CRO": 799, "CUW": 9460, "CZE": 798, "ECU": 791,
    "EGY": 825, "ENG": 770, "ESP": 760, "FRA": 773,
    "GER": 759, "GHA": 763, "HAI": 836, "IRN": 840,
    "IRQ": 8062, "JOR": 8049, "JPN": 766, "KOR": 772,
    "KSA": 801, "MAR": 815, "MEX": 769, "NED": 8601,
    "NOR": 8872, "NZL": 783, "PAN": 1836, "PAR": 761,
    "POR": 765, "QAT": 8030, "RSA": 774, "SCO": 8873,
    "SEN": 804, "SUI": 788, "SWE": 792, "TUN": 802,
    "TUR": 803, "URU": 758, "USA": 771, "UZB": 8070,
}
