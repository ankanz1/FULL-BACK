import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

export interface Team {
  id: string;
  name: string;
  code: string;
  flag: string;
}

export interface MatchStats {
  match_id: string;
  home_team: Team;
  away_team: Team;
  status: string;
  score: {
    home: number;
    away: number;
  };
  events: Array<{
    time: number;
    type: "goal" | "card" | "substitution";
    detail: string;
    team_id: string;
    player: string;
  }>;
  stats: {
    possession: { home: number; away: number };
    shots: { home: number; away: number };
    shots_on_target: { home: number; away: number };
    passes: { home: number; away: number };
    pass_accuracy: { home: number; away: number };
    fouls: { home: number; away: number };
    corners: { home: number; away: number };
    saves: { home: number; away: number };
  };
  lineups: {
    home: {
      formation: string;
      starting: Array<{ number: number; name: string; position: string }>;
    };
    away: {
      formation: string;
      starting: Array<{ number: number; name: string; position: string }>;
    };
  };
}

export interface TeamForm {
  team_id: string;
  team_name: string;
  form: string;
  recent_matches: Array<{
    match_id: string;
    opponent: string;
    score: string;
    result: "W" | "D" | "L";
    date: string;
  }>;
  goals_scored: number;
  goals_conceded: number;
  clean_sheets: number;
}

export interface GroupStanding {
  position: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
}

// Football Data.org Team ID Map
const footballDataTeamIds: Record<string, number> = {
  "USA": 2167,
  "COL": 2183,
  "GER": 2083,
  "JPN": 2102,
  "ARG": 2028,
  "FRA": 2061,
  "MAR": 2149,
  "ESP": 2081,
  "ITA": 2089,
  "BRA": 2050,
  "CRO": 2113,
  "ENG": 2072,
  "MUN": 66,
  "ARS": 57,
  "MCI": 65,
  "LIV": 64,
  "CHE": 61,
  "TOT": 73,
  "NEW": 67,
  "AVL": 58,
  "FUL": 63,
  "BHA": 397,
  "WHU": 563,
  "CRY": 354,
  "BOU": 1044,
  "EVE": 62,
  "BRE": 389,
  "NFO": 351,
  "LEI": 338,
  "WOL": 76,
  "SOU": 340,
  "IPS": 349
};

// Helper to get team flags
function getTeamFlag(teamName: string): string {
  const name = teamName.toLowerCase();
  if (name.includes("united states") || name.includes("usa")) return "🇺🇸";
  if (name.includes("colombia")) return "🇨🇴";
  if (name.includes("germany") || name.includes("ger")) return "🇩🇪";
  if (name.includes("japan") || name.includes("jpn")) return "🇯🇵";
  if (name.includes("argentina")) return "🇦🇷";
  if (name.includes("england") || name.includes("eng")) return "🏴";
  if (name.includes("france")) return "🇫🇷";
  if (name.includes("morocco")) return "🇲🇦";
  if (name.includes("spain") || name.includes("esp")) return "🇪🇸";
  if (name.includes("italy")) return "🇮🇹";
  if (name.includes("brazil")) return "🇧🇷";
  if (name.includes("croatia")) return "🇭🇷";
  
  if (name.includes("arsenal")) return "🔴";
  if (name.includes("city")) return "🔵";
  if (name.includes("liverpool")) return "🔴";
  if (name.includes("chelsea")) return "🔵";
  if (name.includes("united")) return "😈";
  if (name.includes("tottenham")) return "⚪";
  if (name.includes("newcastle")) return "⚫";
  if (name.includes("villa")) return "🦁";
  return "⚽";
}

// Mock Database Fallbacks
const fallbackTeams: Record<string, Team> = {
  USA: { id: "USA", name: "United States", code: "USA", flag: "🇺🇸" },
  COL: { id: "COL", name: "Colombia", code: "COL", flag: "🇨🇴" },
  GER: { id: "GER", name: "Germany", code: "GER", flag: "🇩🇪" },
  JPN: { id: "JPN", name: "Japan", code: "JPN", flag: "🇯🇵" },
  ARG: { id: "ARG", name: "Argentina", code: "ARG", flag: "🇦🇷" },
  ENG: { id: "ENG", name: "England", code: "ENG", flag: "🏴" },
  FRA: { id: "FRA", name: "France", code: "FRA", flag: "🇫🇷" },
  MAR: { id: "MAR", name: "Morocco", code: "MAR", flag: "🇲🇦" },
  ESP: { id: "ESP", name: "Spain", code: "ESP", flag: "🇪🇸" },
  ITA: { id: "ITA", name: "Italy", code: "ITA", flag: "🇮🇹" },
  BRA: { id: "BRA", name: "Brazil", code: "BRA", flag: "🇧🇷" },
  CRO: { id: "CRO", name: "Croatia", code: "CRO", flag: "🇭🇷" },
};

const fallbackMatches: Record<string, MatchStats> = {
  "M001": {
    match_id: "M001",
    home_team: fallbackTeams.USA,
    away_team: fallbackTeams.COL,
    status: "Finished",
    score: { home: 2, away: 1 },
    events: [
      { time: 14, type: "goal", detail: "Regular Goal", team_id: "USA", player: "Christian Pulisic" },
      { time: 38, type: "card", detail: "Yellow Card", team_id: "COL", player: "Jefferson Lerma" },
      { time: 55, type: "goal", detail: "Header Goal", team_id: "COL", player: "Luis Diaz" },
      { time: 76, type: "goal", detail: "Regular Goal", team_id: "USA", player: "Folarin Balogun" },
    ],
    stats: {
      possession: { home: 48, away: 52 },
      shots: { home: 12, away: 15 },
      shots_on_target: { home: 5, away: 4 },
      passes: { home: 410, away: 450 },
      pass_accuracy: { home: 82, away: 84 },
      fouls: { home: 11, away: 14 },
      corners: { home: 4, away: 7 },
      saves: { home: 3, away: 3 }
    },
    lineups: {
      home: {
        formation: "4-3-3",
        starting: [
          { number: 1, name: "Matt Turner", position: "G" },
          { number: 2, name: "Sergino Dest", position: "D" },
          { number: 3, name: "Chris Richards", position: "D" },
          { number: 10, name: "Christian Pulisic", position: "A" }
        ]
      },
      away: {
        formation: "4-2-3-1",
        starting: [
          { number: 12, name: "Camilo Vargas", position: "G" },
          { number: 7, name: "Luis Diaz", position: "A" }
        ]
      }
    }
  },
  "M002": {
    match_id: "M002",
    home_team: fallbackTeams.GER,
    away_team: fallbackTeams.JPN,
    status: "Finished",
    score: { home: 3, away: 1 },
    events: [],
    stats: {
      possession: { home: 58, away: 42 },
      shots: { home: 16, away: 8 },
      shots_on_target: { home: 8, away: 3 },
      passes: { home: 530, away: 380 },
      pass_accuracy: { home: 88, away: 79 },
      fouls: { home: 9, away: 12 },
      corners: { home: 8, away: 3 },
      saves: { home: 2, away: 5 }
    },
    lineups: {
      home: { formation: "4-2-3-1", starting: [] },
      away: { formation: "4-3-3", starting: [] }
    }
  },
  "M003": {
    match_id: "M003",
    home_team: fallbackTeams.ARG,
    away_team: fallbackTeams.FRA,
    status: "Finished",
    score: { home: 2, away: 2 },
    events: [],
    stats: {
      possession: { home: 50, away: 50 },
      shots: { home: 14, away: 14 },
      shots_on_target: { home: 6, away: 6 },
      passes: { home: 490, away: 490 },
      pass_accuracy: { home: 85, away: 85 },
      fouls: { home: 15, away: 13 },
      corners: { home: 6, away: 5 },
      saves: { home: 4, away: 4 }
    },
    lineups: {
      home: { formation: "4-3-3", starting: [] },
      away: { formation: "4-2-3-1", starting: [] }
    }
  }
};

const fallbackStandings: Record<string, GroupStanding[]> = {
  "A": [
    { position: 1, team: fallbackTeams.GER, played: 1, won: 1, drawn: 0, lost: 0, goals_for: 3, goals_against: 1, points: 3 },
    { position: 2, team: fallbackTeams.USA, played: 1, won: 1, drawn: 0, lost: 0, goals_for: 2, goals_against: 1, points: 3 },
    { position: 3, team: fallbackTeams.COL, played: 1, won: 0, drawn: 0, lost: 1, goals_for: 1, goals_against: 2, points: 0 },
    { position: 4, team: fallbackTeams.JPN, played: 1, won: 0, drawn: 0, lost: 1, goals_for: 1, goals_against: 3, points: 0 }
  ],
  "B": [
    { position: 1, team: fallbackTeams.ARG, played: 1, won: 0, drawn: 1, lost: 0, goals_for: 2, goals_against: 2, points: 1 },
    { position: 2, team: fallbackTeams.FRA, played: 1, won: 0, drawn: 1, lost: 0, goals_for: 2, goals_against: 2, points: 1 },
    { position: 3, team: fallbackTeams.ENG, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 },
    { position: 4, team: fallbackTeams.MAR, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 }
  ]
};

const fallbackTeamForms: Record<string, TeamForm> = {
  "USA": {
    team_id: "USA",
    team_name: "United States",
    form: "WDLWW",
    recent_matches: [
      { match_id: "M001", opponent: "Colombia", score: "2-1", result: "W", date: "2026-06-12" }
    ],
    goals_scored: 8,
    goals_conceded: 5,
    clean_sheets: 1
  },
  "COL": {
    team_id: "COL",
    team_name: "Colombia",
    form: "LWWWD",
    recent_matches: [
      { match_id: "M001", opponent: "United States", score: "1-2", result: "L", date: "2026-06-12" }
    ],
    goals_scored: 10,
    goals_conceded: 3,
    clean_sheets: 2
  }
};

// Helper for dynamic team name lookup
function findTeamIdByName(name: string): number | undefined {
  const norm = name.toLowerCase();
  for (const [key, id] of Object.entries(footballDataTeamIds)) {
    if (norm.includes(key.toLowerCase()) || key.toLowerCase().includes(norm)) {
      return id;
    }
  }
  return undefined;
}

export const sportsDb = {
  async getMatchStats(matchId: string): Promise<MatchStats | undefined> {
    try {
      const fdMatchId = parseInt(matchId, 10);
      if (!isNaN(fdMatchId) && process.env.FOOTBALL_DATA_API_KEY) {
        const headers = { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY };
        const res = await fetch(`https://api.football-data.org/v4/matches/${fdMatchId}`, { headers });

        if (res.ok) {
          const data = (await res.json()) as any;
          const m = data.match || {};
          const home = m.homeTeam || {};
          const away = m.awayTeam || {};
          const score = m.score || {};
          const ft = score.fullTime || {};
          const statusMap: Record<string, string> = {
            FINISHED: "Finished", SCHEDULED: "Scheduled",
            LIVE: "Live", IN_PLAY: "Live", PAUSED: "Live",
            AWARDED: "Finished", CANCELED: "Cancelled",
            POSTPONED: "Postponed", SUSPENDED: "Suspended"
          };

          return {
            match_id: matchId,
            home_team: {
              id: String(home.id || ""),
              name: home.name || "",
              code: home.tla || (home.name || "").substring(0, 3).toUpperCase(),
              flag: getTeamFlag(home.name || "")
            },
            away_team: {
              id: String(away.id || ""),
              name: away.name || "",
              code: away.tla || (away.name || "").substring(0, 3).toUpperCase(),
              flag: getTeamFlag(away.name || "")
            },
            status: statusMap[m.status] || m.status || "Scheduled",
            score: {
              home: ft.home ?? 0,
              away: ft.away ?? 0
            },
            events: [],
            stats: {
              possession: { home: 0, away: 0 },
              shots: { home: 0, away: 0 },
              shots_on_target: { home: 0, away: 0 },
              passes: { home: 0, away: 0 },
              pass_accuracy: { home: 0, away: 0 },
              fouls: { home: 0, away: 0 },
              corners: { home: 0, away: 0 },
              saves: { home: 0, away: 0 }
            },
            lineups: {
              home: { formation: "4-4-2", starting: [] },
              away: { formation: "4-4-2", starting: [] }
            }
          };
        }
      }
    } catch (err) {
      console.error("sportsDb: Error fetching match stats", err);
    }
    return fallbackMatches[matchId] || fallbackMatches["M001"];
  },

  async getTeamForm(teamId: string): Promise<TeamForm | undefined> {
    try {
      const resolvedTeamId = footballDataTeamIds[teamId.toUpperCase()] || findTeamIdByName(teamId);
      if (resolvedTeamId && process.env.FOOTBALL_DATA_API_KEY) {
        const res = await fetch(`https://api.football-data.org/v4/teams/${resolvedTeamId}/matches?status=FINISHED&limit=5`, {
          headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY }
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const matches = data.matches || [];
          const completed = matches.filter((m: any) => m.status === "FINISHED");
          completed.sort((a: any, b: any) => (b.utcDate || "").localeCompare(a.utcDate || ""));
          
          const recentMatches = completed.slice(0, 5);
          if (recentMatches.length > 0) {
            let form = "", goals_scored = 0, goals_conceded = 0, clean_sheets = 0;
            const recentMapped = recentMatches.map((m: any, idx: number) => {
              const isHome = m.homeTeam.id === resolvedTeamId;
              const ft = m.score?.fullTime || {};
              const teamScore = isHome ? (ft.home ?? 0) : (ft.away ?? 0);
              const oppScore = isHome ? (ft.away ?? 0) : (ft.home ?? 0);
              goals_scored += teamScore;
              goals_conceded += oppScore;
              if (oppScore === 0) clean_sheets++;
              let result: "W" | "D" | "L" = teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "D";
              form = result + form;
              return {
                match_id: `M_REC_${teamId}_${idx}`,
                opponent: isHome ? m.awayTeam.name : m.homeTeam.name,
                score: `${ft.home ?? 0}-${ft.away ?? 0}`,
                result,
                date: (m.utcDate || "").substring(0, 10)
              };
            });
            const teamName = recentMatches[0].homeTeam.id === resolvedTeamId
              ? recentMatches[0].homeTeam.name
              : recentMatches[0].awayTeam.name;
            return { team_id: teamId, team_name: teamName, form: form || "D", recent_matches: recentMapped, goals_scored, goals_conceded, clean_sheets };
          }
        }
      }
    } catch (err) {
      console.error("sportsDb: Error fetching team form", err);
    }
    return fallbackTeamForms[teamId.toUpperCase()] || fallbackTeamForms["USA"];
  },

  async getStandings(group: string): Promise<GroupStanding[] | undefined> {
    try {
      if (process.env.FOOTBALL_DATA_API_KEY) {
        console.error(`sportsDb: Fetching WC standings for group ${group}...`);
        const res = await fetch("https://api.football-data.org/v4/competitions/WC/standings", {
          headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY }
        });
        console.error(`sportsDb: WC standings -> HTTP ${res.status}`);
        if (!res.ok) {
          const body = await res.text();
          console.error(`sportsDb: WC standings error body: ${body.slice(0, 300)}`);
        }
        if (res.ok) {
          const data = (await res.json()) as any;
          const standingsList = data.standings || [];
          const groupUpper = group.toUpperCase();
          for (const g of standingsList) {
            const gName = (g.group || "").toUpperCase();
            if (gName.includes(groupUpper)) {
              const table = g.table || [];
              return table.map((row: any) => ({
                position: row.position,
                team: { id: String(row.team.id), name: row.team.name, code: row.team.tla || "", flag: getTeamFlag(row.team.name) },
                played: row.playedGames, won: row.won, drawn: row.draw, lost: row.lost, goals_for: row.goalsFor, goals_against: row.goalsAgainst, points: row.points
              }));
            }
          }
          console.error(`sportsDb: Group ${group} not found in WC standings response`);
        }
      }
    } catch (err) {
      console.error("sportsDb: Error fetching WC standings", err);
    }
    return fallbackStandings[group.toUpperCase()] || fallbackStandings["A"];
  },

  async getAllMatches(): Promise<MatchStats[]> {
    const list = [];
    for (const id of ["M001", "M002", "M003"]) {
      const m = await this.getMatchStats(id);
      if (m) list.push(m);
    }
    return list;
  },

  async getAllStandings(): Promise<Record<string, GroupStanding[]>> {
    return { "A": await this.getStandings("A") || [], "B": await this.getStandings("B") || [] };
  }
};
