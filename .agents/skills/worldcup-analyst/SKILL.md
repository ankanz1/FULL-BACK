---
name: worldcup-analyst
description: A premium AI sports analyst skill providing World Cup match stats, group standings, AI predictions, and tactical post-match breakdowns.
---

# World Cup Analyst Skill

This skill allows agents to interface with the **FULL BACK** Model Context Protocol (MCP) server. It provides tools for real-time sports telemetry, style clustering, AI match predictions, and audio highlights extraction.

## Available Tools

### 1. hello_analyst (Free)
*   **Description**: Test tool to verify connection to the analyst.
*   **Args**: `{ name: string }`

### 2. get_match_stats (Free)
*   **Description**: Pulls comprehensive stats, scores, and lineups for a match.
*   **Args**: `{ match_id: string }` (e.g. `M001`, `M002`)

### 3. get_team_form (Free)
*   **Description**: Pulls a team's last 5 match results, goals scored/conceded, and clean sheets count.
*   **Args**: `{ team_id: string }` (e.g. `USA`, `COL`, `GER`)

### 4. get_standings (Free)
*   **Description**: Pulls current World Cup group stage standings.
*   **Args**: `{ group: string }` (e.g. `A`, `B`)

### 5. predict_outcome (Premium - 0.05 USDC)
*   **Description**: Generates a deep AI prediction on upcoming match win/draw probabilities and scoreline.
*   **Args**: `{ match_id: string }`

### 6. tactical_breakdown (Premium - 0.10 USDC)
*   **Description**: Generates a professional post-match tactical breakdown writeup.
*   **Args**: `{ match_id: string }`

### 7. player_style_cluster (Premium - 0.01 USDC)
*   **Description**: Determines a player's dynamic archetype and lists the top 5 nearest similar players.
*   **Args**: `{ player_id: string }` (e.g. `PL001`, `PL002`)

### 8. generate_highlights (Premium - 0.08 USDC)
*   **Description**: Generates match highlight clips by analyzing audio decibel cheering spikes.
*   **Args**: `{ match_id: string }`

---

## Autonomous Payment Integration (x402)

Premium tools require stablecoin micro-payments on Base Sepolia.

When calling any of the premium tools:
1.  The server checks if a `payment-signature` header is present.
2.  If absent, it returns an **HTTP 402 Payment Required** status code and a Base64-encoded `PAYMENT-REQUIRED` header detailing the required USDC amount, merchant wallet address, and network.
3.  The agent should construct and sign the EIP-3009 transfer signature using its configured private key.
4.  The request should be retried with the `payment-signature` header containing the Base64-encoded signed payload.
