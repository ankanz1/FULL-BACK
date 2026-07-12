import { sportsDb } from "./sportsDb.js";

console.log("=== TESTING SPORTS DB ===");
console.log("Match Stats (M001):", JSON.stringify(sportsDb.getMatchStats("M001"), null, 2));
console.log("\nTeam Form (USA):", JSON.stringify(sportsDb.getTeamForm("USA"), null, 2));
console.log("\nStandings (Group A):", JSON.stringify(sportsDb.getStandings("A"), null, 2));
