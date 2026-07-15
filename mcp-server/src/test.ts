import { sportsDb } from "./sportsDb.js";

async function run() {
  console.log("=== TESTING SPORTS DB ===");
  console.log("Match Stats (M001):", JSON.stringify(await sportsDb.getMatchStats("M001"), null, 2));
  console.log("\nTeam Form (USA):", JSON.stringify(await sportsDb.getTeamForm("USA"), null, 2));
  console.log("\nStandings (Group A):", JSON.stringify(await sportsDb.getStandings("A"), null, 2));
}

run().catch((err) => {
  console.error("Test harness failed:", err);
  process.exit(1);
});
