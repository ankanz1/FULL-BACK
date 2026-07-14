import dotenv from "dotenv";
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

// API Sports Team ID Map
const apiSportsTeamIds: Record<string, number> = {
  "USA": 33,
  "COL": 42,
  "GER": 50,
  "JPN": 47,
  "ARG": 40,
  "FRA": 49,
  "MAR": 34,
  "ESP": 35,
  "ITA": 45,
  "BRA": 66,
  "CRO": 36,
  "MUN": 33,
  "ARS": 42,
  "MCI": 50,
  "LIV": 40,
  "CHE": 49,
  "TOT": 47
};

// Map mock IDs to real API-Sports Premier League fixture IDs
const mockMatchToRealFixtureId: Record<string, number> = {
  "M001": 1208021,
  "M002": 1208022,
  "M003": 1208028,
  "M004": 1208023,
  "M005": 1208024,
  "M006": 1208025
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

// Helper to fetch stat value safely
function getStatValue(statistics: any[], typeName: string): { home: number; away: number } {
  const homeStats = statistics?.[0]?.statistics || [];
  const awayStats = statistics?.[1]?.statistics || [];
  
  const homeVal = homeStats.find((s: any) => s.type === typeName)?.value ?? 0;
  const awayVal = awayStats.find((s: any) => s.type === typeName)?.value ?? 0;
  
  const parseVal = (v: any) => {
    if (typeof v === "string") {
      return parseInt(v.replace("%", ""), 10) || 0;
    }
    return Number(v) || 0;
  };
  
  return {
    home: parseVal(homeVal),
    away: parseVal(awayVal)
  };
}

// Helper for dynamic team name lookup
function findTeamIdByName(name: string): number | undefined {
  const norm = name.toLowerCase();
  for (const [key, id] of Object.entries(apiSportsTeamIds)) {
    if (norm.includes(key.toLowerCase()) || key.toLowerCase().includes(norm)) {
      return id;
    }
  }
  return undefined;
}

export const sportsDb = {
  async getMatchStats(matchId: string): Promise<MatchStats | undefined> {
    try {
      let apiFixtureId = mockMatchToRealFixtureId[matchId];
      if (!apiFixtureId) {
        const num = parseInt(matchId, 10);
        if (!isNaN(num)) apiFixtureId = num;
      }

      if (apiFixtureId && process.env.API_SPORTS_API_KEY) {
        const res = await fetch(`https://v3.football.api-sports.io/fixtures?id=${apiFixtureId}`, {
          headers: { "x-apisports-key": process.env.API_SPORTS_API_KEY }
        });
        
        if (res.ok) {
          const data = (await res.json()) as any;
          const fixture = data.response?.[0];
          if (fixture) {
            return {
              match_id: matchId,
              home_team: {
                id: String(fixture.teams.home.id),
                name: fixture.teams.home.name,
                code: fixture.teams.home.name.substring(0, 3).toUpperCase(),
                flag: getTeamFlag(fixture.teams.home.name)
              },
              away_team: {
                id: String(fixture.teams.away.id),
                name: fixture.teams.away.name,
                code: fixture.teams.away.name.substring(0, 3).toUpperCase(),
                flag: getTeamFlag(fixture.teams.away.name)
              },
              status: fixture.fixture.status.long || "Scheduled",
              score: {
                home: fixture.goals.home ?? 0,
                away: fixture.goals.away ?? 0
              },
              events: (fixture.events || []).map((e: any) => ({
                time: e.time.elapsed,
                type: e.type === "subst" ? "substitution" : e.type.toLowerCase(),
                detail: e.detail || "",
                team_id: String(e.team.id),
                player: e.player.name || ""
              })),
              stats: {
                possession: getStatValue(fixture.statistics, "Ball Possession"),
                shots: getStatValue(fixture.statistics, "Total Shots"),
                shots_on_target: getStatValue(fixture.statistics, "Shots on Target"),
                passes: getStatValue(fixture.statistics, "Total Passes"),
                pass_accuracy: getStatValue(fixture.statistics, "Passes %"),
                fouls: getStatValue(fixture.statistics, "Fouls"),
                corners: getStatValue(fixture.statistics, "Corner Kicks"),
                saves: getStatValue(fixture.statistics, "Goalkeeper Saves")
              },
              lineups: {
                home: {
                  formation: fixture.lineups?.[0]?.formation || "4-4-2",
                  starting: (fixture.lineups?.[0]?.startXI || []).map((p: any) => ({
                    number: p.player.number,
                    name: p.player.name,
                    position: p.player.pos
                  }))
                },
                away: {
                  formation: fixture.lineups?.[1]?.formation || "4-4-2",
                  starting: (fixture.lineups?.[1]?.startXI || []).map((p: any) => ({
                    number: p.player.number,
                    name: p.player.name,
                    position: p.player.pos
                  }))
                }
              }
            };
          }
        }
      }
    } catch (err) {
      console.error("sportsDb: Error fetching match stats", err);
    }
    return fallbackMatches[matchId] || fallbackMatches["M001"];
  },

  async getTeamForm(teamId: string): Promise<TeamForm | undefined> {
    try {
      const resolvedTeamId = apiSportsTeamIds[teamId.toUpperCase()] || findTeamIdByName(teamId);
      if (resolvedTeamId && process.env.API_SPORTS_API_KEY) {
        const res = await fetch(`https://v3.football.api-sports.io/fixtures?team=${resolvedTeamId}&season=2024`, {
          headers: { "x-apisports-key": process.env.API_SPORTS_API_KEY }
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const response = data.response || [];
          const completed = response.filter((f: any) => ["FT", "AET", "PEN"].includes(f.fixture.status.short));
          completed.sort((a: any, b: any) => b.fixture.timestamp - a.fixture.timestamp);
          
          const recentMatches = completed.slice(0, 5);
          if (recentMatches.length > 0) {
            let form = "", goals_scored = 0, goals_conceded = 0, clean_sheets = 0;
            const recentMapped = recentMatches.map((f: any, idx: number) => {
              const isHome = f.teams.home.id === resolvedTeamId;
              const teamScore = isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
              const oppScore = isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
              goals_scored += teamScore;
              goals_conceded += oppScore;
              if (oppScore === 0) clean_sheets++;
              let result: "W" | "D" | "L" = teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "D";
              form = result + form;
              return { match_id: `M_REC_${teamId}_${idx}`, opponent: isHome ? f.teams.away.name : f.teams.home.name, score: `${f.goals.home}-${f.goals.away}`, result, date: f.fixture.date.substring(0, 10) };
            });
            return { team_id: teamId, team_name: recentMatches[0].teams.home.id === resolvedTeamId ? recentMatches[0].teams.home.name : recentMatches[0].teams.away.name, form: form || "D", recent_matches: recentMapped, goals_scored, goals_conceded, clean_sheets };
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
        const res = await fetch("https://api.football-data.org/v4/competitions/PL/standings", {
          headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY }
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          const table = data.standings?.[0]?.table || [];
          if (table.length > 0) {
            const mapped = table.map((row: any) => ({
              position: row.position,
              team: { id: String(row.team.id), name: row.team.shortName || row.team.name, code: row.team.tla || "", flag: getTeamFlag(row.team.shortName || row.team.name) },
              played: row.playedGames, won: row.won, drawn: row.draw, lost: row.lost, goals_for: row.goalsFor, goals_against: row.goalsAgainst, points: row.points
            }));
            return group.toUpperCase() === "A" ? mapped.slice(0, 10) : mapped.slice(10, 20);
          }
        }
      }
    } catch (err) {
      console.error("sportsDb: Error fetching standings", err);
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
