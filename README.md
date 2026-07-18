# FULL BACK
### An AI analyst that has the fan's back — on and off the pitch



---
<img width="640" height="220" alt="full-back-logo-primary-v2" src="https://github.com/user-attachments/assets/b240a25e-88f7-4972-afd3-7082e17e856a" />

---

## The name, decoded

A full back is the defensive position that also drives the attack — covers your flank, then joins the run forward. That's the product: it pushes the analysis forward (AI-generated tactical insight most fans can't get anywhere else), freely accessible and ready on demand.

---

## One-liner

**FULL BACK is an AI match analyst, exposed as an MCP server, that any fan or any agent can query for World Cup insight — from live scores to AI tactical breakdowns, all freely accessible.**

---

## The problem

World Cup content today is either:
- **Free but shallow** — scores, standings, headlines
- **Deep but gated behind subscriptions** — paid analytics platforms that want a monthly commitment for something you might use twice during the tournament
- **Built for humans only** — no fan-facing product today is built so that an AI agent (yours, a friend's, a future one) can query it directly and get structured, payable, verifiable answers

Fans want the deep stuff — win probabilities, tactical breakdowns, player-style comparisons — but only when they actually want it, for a match that actually matters to them. Subscriptions are the wrong shape for that.

---

## The idea

A single MCP server sits at the center. It exposes tools an AI agent (or a simple chat UI) can call:

**Live scores, standings, team form** — the basics, no friction.

**AI-powered analysis** — ask "how will Brazil do against Argentina tonight" and get a genuine AI-generated tactical breakdown, instantly, freely.

**Reusable, not just a demo** — the same logic is packaged as an installable **Agent Skill**, so any developer's AI agent can install `worldcup-analyst` and get World Cup expertise. It's a developer tool, not just an app.

---

## Core features

| Feature | Powered by |
|---|---|
| Live scores & standings | MCP tool, sports data API |
| Team form lookup | MCP tool |
| AI match prediction & tactical writeup | LLM |
| Player-style clustering ("which players play like X") | pandas + K-Means |
| AI-generated highlight clips from match audio | librosa + moviepy |
| Formation snapshot from match footage | YOLOv8 + homography |
| Installable analyst skill for other agents | Agent Skills |

---

## USP — why this wins

1. **MCP is the actual product architecture** (not a wrapper bolted on at the end), and Agent Skills make the work reusable by other builders.
2. **The dashboard is genuinely useful** — anyone can evaluate usability on the spot.
3. **Data science with a clear head, not scope creep.** Player clustering is fully built. Highlights is built. Formation tracking is explicitly a bonus screenshot, not a promise

---

## Two user flows

**Fan flow:** open the dashboard → check today's fixtures and form → ask the chat widget a tactical question → get a genuinely useful, AI-written answer

**Developer flow:** `npx skills add` the `worldcup-analyst` skill into their own agent → their agent now knows how to query FULL BACK's MCP server

---

## Design language

The homepage sets the tone — carry it through:
- Near-black backgrounds, single orange accent color for live/active states
- Monospace, all-caps micro-labels for data readouts (mirroring the "LATITUDE / FLOODLIGHT" telemetry style) — use this pattern for match stats and odds
- Bold condensed display type for headlines, restrained everywhere else
- The stadium-at-night photography motif can extend into the dashboard as a subtle background texture, not a busy one

---

## Architecture (recap)

```
Fan dashboard ──┐
                 ├──▶ MCP server ──▶ Tools (scores, standings, predictions, clustering, highlights)
External agents ─┘
                         │
                   Agent Skill (packaged for reuse)
```

---

## Technical Architecture

## How it works

```

 User / Agent ──▶ MCP Server ──▶ Python FastAPI Microservice ──▶ Gemini API / K-Means
```

### Model Context Protocol (MCP)
**Unifies human and machine execution.** The analyst is packaged as an MCP server. This means any LLM client (Cursor, Claude Desktop, custom agents) can natively discover and call FULL BACK tools.

### Agent Skills
**Modular reusability.** By distributing the analyst as an installable skill under the Open Agent Skills standard, other developers can add sports-analyst telemetry to their own agents with a single command.

---

## Local Setup Instructions

### 1. Requirements
*   **Node.js**: v20+
*   **Python**: v3.10+
*   **npm** / **pip**

### 2. Environment Setup
Clone the repository and copy the template configuration:
```bash
cp .env.example .env
```
Fill in the configuration details inside `.env`:
*   `FOOTBALL_DATA_API_KEY`: Your football API key.
*   `GEMINI_API_KEY`: API key for Gemini models.

### 3. Run the Python Data Science Service
```bash
cd python-service
# Install dependencies
pip install -r requirements.txt
# Run the FastAPI server
python main.py
```
This runs the microservice on `http://localhost:8000`.

### 4. Run the Node MCP Server
```bash
cd mcp-server
# Install dependencies
npm install
# Compile TypeScript and run
npm run start
```
This starts the Stdio MCP server bridge.

### 5. Run the Frontend Dashboard
From the root directory:
```bash
# Install packages
npm install
# Run local Vite dashboard
npm run dev
```
Open `http://localhost:5173` in your browser. Click **ENTER THE FIELD** to view the live dashboard.

