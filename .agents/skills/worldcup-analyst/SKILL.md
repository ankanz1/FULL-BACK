---
name: worldcup-analyst
description: An AI sports analyst skill providing World Cup match stats, group standings, AI predictions, and tactical post-match breakdowns.
---

# World Cup Analyst Skill

This skill allows agents to interface with the **FULL BACK** Model Context Protocol (MCP) server. It provides tools for real-time sports telemetry, style clustering, AI match predictions, and audio highlights extraction.

## Available Tools

### 1. hello_analyst
*   **Description**: Test tool to verify connection to the analyst.
*   **Args**: `{ name: string }`

### 2. get_match_stats
*   **Description**: Pulls comprehensive stats, scores, and lineups for a match.
*   **Args**: `{ match_id: string }` (e.g. `M001`, `M002`)

### 3. get_team_form
*   **Description**: Pulls a team's last 5 match results, goals scored/conceded, and clean sheets count.
*   **Args**: `{ team_id: string }` (e.g. `USA`, `COL`, `GER`)

### 4. get_standings
*   **Description**: Pulls current World Cup group stage standings.
*   **Args**: `{ group: string }` (e.g. `A`, `B`)

### 5. predict_outcome
*   **Description**: Generates a deep AI prediction on upcoming match win/draw probabilities and scoreline.
*   **Args**: `{ match_id: string }`

### 6. tactical_breakdown
*   **Description**: Generates a professional post-match tactical breakdown writeup.
*   **Args**: `{ match_id: string }`

### 7. player_style_cluster
*   **Description**: Determines a player's dynamic archetype and lists the top 5 nearest similar players.
*   **Args**: `{ player_id: string }` (e.g. `PL001`, `PL002`)

### 8. generate_highlights
*   **Description**: Generates match highlight clips by analyzing audio decibel cheering spikes.
*   **Args**: `{ match_id: string }`
