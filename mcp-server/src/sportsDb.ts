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
  form: string; // e.g. "WDWWL"
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

// Mock Database
const teams: Record<string, Team> = {
  USA: { id: "USA", name: "United States", code: "USA", flag: "🇺🇸" },
  COL: { id: "COL", name: "Colombia", code: "COL", flag: "🇨🇴" },
  GER: { id: "GER", name: "Germany", code: "GER", flag: "🇩🇪" },
  JPN: { id: "JPN", name: "Japan", code: "JPN", flag: "🇯🇵" },
  ARG: { id: "ARG", name: "Argentina", code: "ARG", flag: "🇦🇷" },
  ENG: { id: "ENG", name: "England", code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  FRA: { id: "FRA", name: "France", code: "FRA", flag: "🇫🇷" },
  MAR: { id: "MAR", name: "Morocco", code: "MAR", flag: "🇲🇦" },
  ESP: { id: "ESP", name: "Spain", code: "ESP", flag: "🇪🇸" },
  ITA: { id: "ITA", name: "Italy", code: "ITA", flag: "🇮🇹" },
  BRA: { id: "BRA", name: "Brazil", code: "BRA", flag: "🇧🇷" },
  CRO: { id: "CRO", name: "Croatia", code: "CRO", flag: "🇭🇷" },
};

const matches: Record<string, MatchStats> = {
  "M001": {
    match_id: "M001",
    home_team: teams.USA,
    away_team: teams.COL,
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
      saves: { home: 3, away: 3 },
    },
    lineups: {
      home: {
        formation: "4-3-3",
        starting: [
          { number: 1, name: "Matt Turner", position: "G" },
          { number: 2, name: "Sergino Dest", position: "D" },
          { number: 3, name: "Chris Richards", position: "D" },
          { number: 4, name: "Tim Ream", position: "D" },
          { number: 5, name: "Antonee Robinson", position: "D" },
          { number: 6, name: "Yunus Musah", position: "M" },
          { number: 4, name: "Tyler Adams", position: "M" },
          { number: 8, name: "Weston McKennie", position: "M" },
          { number: 10, name: "Christian Pulisic", position: "A" },
          { number: 20, name: "Folarin Balogun", position: "A" },
          { number: 11, name: "Timothy Weah", position: "A" },
        ],
      },
      away: {
        formation: "4-2-3-1",
        starting: [
          { number: 12, name: "Camilo Vargas", position: "G" },
          { number: 21, name: "Daniel Munoz", position: "D" },
          { number: 2, name: "Davinson Sanchez", position: "D" },
          { number: 3, name: "Jhon Lucumi", position: "D" },
          { number: 17, name: "Johan Mojica", position: "D" },
          { number: 16, name: "Jefferson Lerma", position: "M" },
          { number: 6, name: "Richard Rios", position: "M" },
          { number: 11, name: "Jhon Arias", position: "M" },
          { number: 10, name: "James Rodriguez", position: "M" },
          { number: 7, name: "Luis Diaz", position: "A" },
          { number: 9, name: "Jhon Cordoba", position: "A" },
        ],
      },
    },
  },
  "M002": {
    match_id: "M002",
    home_team: teams.GER,
    away_team: teams.JPN,
    status: "Finished",
    score: { home: 3, away: 1 },
    events: [
      { time: 22, type: "goal", detail: "Regular Goal", team_id: "GER", player: "Florian Wirtz" },
      { time: 41, type: "goal", detail: "Regular Goal", team_id: "GER", player: "Jamal Musiala" },
      { time: 64, type: "goal", detail: "Regular Goal", team_id: "JPN", player: "Kaoru Mitoma" },
      { time: 88, type: "goal", detail: "Regular Goal", team_id: "GER", player: "Kai Havertz" },
    ],
    stats: {
      possession: { home: 58, away: 42 },
      shots: { home: 18, away: 9 },
      shots_on_target: { home: 8, away: 3 },
      passes: { home: 590, away: 380 },
      pass_accuracy: { home: 89, away: 79 },
      fouls: { home: 8, away: 12 },
      corners: { home: 6, away: 3 },
      saves: { home: 2, away: 5 },
    },
    lineups: {
      home: {
        formation: "4-2-3-1",
        starting: [
          { number: 1, name: "Marc-Andre ter Stegen", position: "G" },
          { number: 6, name: "Joshua Kimmich", position: "D" },
          { number: 2, name: "Antonio Rudiger", position: "D" },
          { number: 4, name: "Jonathan Tah", position: "D" },
          { number: 3, name: "David Raum", position: "D" },
          { number: 8, name: "Robert Andrich", position: "M" },
          { number: 10, name: "Toni Kroos", position: "M" },
          { number: 17, name: "Florian Wirtz", position: "M" },
          { number: 21, name: "Ilkay Gundogan", position: "M" },
          { number: 10, name: "Jamal Musiala", position: "M" },
          { number: 7, name: "Kai Havertz", position: "A" },
        ],
      },
      away: {
        formation: "4-3-3",
        starting: [
          { number: 23, name: "Zion Suzuki", position: "G" },
          { number: 2, name: "Yukinari Sugawara", position: "D" },
          { number: 4, name: "Ko Itakura", position: "D" },
          { number: 3, name: "Shogo Taniguchi", position: "D" },
          { number: 21, name: "Hiroki Ito", position: "D" },
          { number: 6, name: "Wataru Endo", position: "M" },
          { number: 5, name: "Hidemasa Morita", position: "M" },
          { number: 8, name: "Takumi Minamino", position: "M" },
          { number: 14, name: "Junya Ito", position: "A" },
          { number: 9, name: "Ayase Ueda", position: "A" },
          { number: 7, name: "Kaoru Mitoma", position: "A" },
        ],
      },
    },
  },
  "M003": {
    match_id: "M003",
    home_team: teams.ARG,
    away_team: teams.ENG,
    status: "Finished",
    score: { home: 2, away: 2 },
    events: [
      { time: 8, type: "goal", detail: "Penalty Goal", team_id: "ARG", player: "Lionel Messi" },
      { time: 27, type: "goal", detail: "Regular Goal", team_id: "ENG", player: "Harry Kane" },
      { time: 54, type: "goal", detail: "Regular Goal", team_id: "ENG", player: "Jude Bellingham" },
      { time: 82, type: "goal", detail: "Regular Goal", team_id: "ARG", player: "Lautaro Martinez" },
    ],
    stats: {
      possession: { home: 51, away: 49 },
      shots: { home: 14, away: 16 },
      shots_on_target: { home: 6, away: 7 },
      passes: { home: 490, away: 480 },
      pass_accuracy: { home: 86, away: 85 },
      fouls: { home: 12, away: 15 },
      corners: { home: 5, away: 8 },
      saves: { home: 5, away: 4 },
    },
    lineups: {
      home: {
        formation: "4-3-3",
        starting: [
          { number: 23, name: "Emiliano Martinez", position: "G" },
          { number: 26, name: "Nahuel Molina", position: "D" },
          { number: 13, name: "Cristian Romero", position: "D" },
          { number: 19, name: "Nicolas Otamendi", position: "D" },
          { number: 3, name: "Nicolas Tagliafico", position: "D" },
          { number: 7, name: "Rodrigo De Paul", position: "M" },
          { number: 24, name: "Enzo Fernandez", position: "M" },
          { number: 20, name: "Alexis Mac Allister", position: "M" },
          { number: 10, name: "Lionel Messi", position: "A" },
          { number: 22, name: "Lautaro Martinez", position: "A" },
          { number: 9, name: "Julian Alvarez", position: "A" },
        ],
      },
      away: {
        formation: "4-2-3-1",
        starting: [
          { number: 1, name: "Jordan Pickford", position: "G" },
          { number: 2, name: "Kyle Walker", position: "D" },
          { number: 5, name: "John Stones", position: "D" },
          { number: 6, name: "Marc Guehi", position: "D" },
          { number: 12, name: "Kieran Trippier", position: "D" },
          { number: 26, name: "Declan Rice", position: "M" },
          { number: 4, name: "Kobbie Mainoo", position: "M" },
          { number: 7, name: "Bukayo Saka", position: "M" },
          { number: 10, name: "Jude Bellingham", position: "M" },
          { number: 11, name: "Phil Foden", position: "M" },
          { number: 9, name: "Harry Kane", position: "A" },
        ],
      },
    },
  },
};

const groupStandings: Record<string, GroupStanding[]> = {
  "A": [
    { position: 1, team: teams.GER, played: 1, won: 1, drawn: 0, lost: 0, goals_for: 3, goals_against: 1, points: 3 },
    { position: 2, team: teams.USA, played: 1, won: 1, drawn: 0, lost: 0, goals_for: 2, goals_against: 1, points: 3 },
    { position: 3, team: teams.COL, played: 1, won: 0, drawn: 0, lost: 1, goals_for: 1, goals_against: 2, points: 0 },
    { position: 4, team: teams.JPN, played: 1, won: 0, drawn: 0, lost: 1, goals_for: 1, goals_against: 3, points: 0 },
  ],
  "B": [
    { position: 1, team: teams.FRA, played: 1, won: 1, drawn: 0, lost: 0, goals_for: 1, goals_against: 0, points: 3 },
    { position: 2, team: teams.ARG, played: 1, won: 0, drawn: 1, lost: 0, goals_for: 2, goals_against: 2, points: 1 },
    { position: 3, team: teams.ENG, played: 1, won: 0, drawn: 1, lost: 0, goals_for: 2, goals_against: 2, points: 1 },
    { position: 4, team: teams.MAR, played: 1, won: 0, drawn: 0, lost: 1, goals_for: 0, goals_against: 1, points: 0 },
  ],
};

const teamForms: Record<string, TeamForm> = {
  "USA": {
    team_id: "USA",
    team_name: "United States",
    form: "WDWLW",
    recent_matches: [
      { match_id: "M001", opponent: "Colombia", score: "2-1", result: "W", date: "2026-06-12" },
      { match_id: "M_PREV_1", opponent: "Mexico", score: "0-1", result: "L", date: "2026-06-05" },
      { match_id: "M_PREV_2", opponent: "Canada", score: "2-0", result: "W", date: "2026-05-30" },
      { match_id: "M_PREV_3", opponent: "Jamaica", score: "1-1", result: "D", date: "2026-05-24" },
      { match_id: "M_PREV_4", opponent: "Panama", score: "3-1", result: "W", date: "2026-05-18" },
    ],
    goals_scored: 8,
    goals_conceded: 4,
    clean_sheets: 1,
  },
  "COL": {
    team_id: "COL",
    team_name: "Colombia",
    form: "LWWWD",
    recent_matches: [
      { match_id: "M001", opponent: "United States", score: "1-2", result: "L", date: "2026-06-12" },
      { match_id: "M_PREV_5", opponent: "Paraguay", score: "3-0", result: "W", date: "2026-06-06" },
      { match_id: "M_PREV_6", opponent: "Peru", score: "2-1", result: "W", date: "2026-05-31" },
      { match_id: "M_PREV_7", opponent: "Bolivia", score: "4-0", result: "W", date: "2026-05-25" },
      { match_id: "M_PREV_8", opponent: "Chile", score: "0-0", result: "D", date: "2026-05-19" },
    ],
    goals_scored: 10,
    goals_conceded: 3,
    clean_sheets: 2,
  },
  "GER": {
    team_id: "GER",
    team_name: "Germany",
    form: "WWWDW",
    recent_matches: [
      { match_id: "M002", opponent: "Japan", score: "3-1", result: "W", date: "2026-06-13" },
      { match_id: "M_PREV_9", opponent: "Austria", score: "2-0", result: "W", date: "2026-06-06" },
      { match_id: "M_PREV_10", opponent: "Netherlands", score: "2-1", result: "W", date: "2026-05-31" },
      { match_id: "M_PREV_11", opponent: "France", score: "2-2", result: "D", date: "2026-05-24" },
      { match_id: "M_PREV_12", opponent: "Ukraine", score: "4-1", result: "W", date: "2026-05-18" },
    ],
    goals_scored: 12,
    goals_conceded: 5,
    clean_sheets: 1,
  },
};

export const sportsDb = {
  getMatchStats(matchId: string): MatchStats | undefined {
    return matches[matchId];
  },
  getTeamForm(teamId: string): TeamForm | undefined {
    return teamForms[teamId];
  },
  getStandings(group: string): GroupStanding[] | undefined {
    return groupStandings[group.toUpperCase()];
  },
  getAllMatches(): MatchStats[] {
    return Object.values(matches);
  },
  getAllStandings(): Record<string, GroupStanding[]> {
    return groupStandings;
  }
};
