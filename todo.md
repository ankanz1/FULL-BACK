
# FULL BACK — build todo

Hackathon: The Injective Global Cup · Deadline: July 19, 2026 · Submit via Typeform: https://xsxo494365r.typeform.com/to/TMaGb1du

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Day 0 — Before you write code

- [x] Read the hackathon rules page again, screenshot the deadline and prize breakdown
- [x] Create the GitHub repo, add a placeholder README, set repo to public
- [x] Create a `.env.example` file now — you'll thank yourself later
- [x] Bookmark every doc link in this file (or just keep this file open in a tab)

### Reference docs — bookmark these now

**MCP (Model Context Protocol)**
- Spec & general docs: https://modelcontextprotocol.io
- Reference server implementations: https://github.com/modelcontextprotocol/servers

**Injective-specific**
- Injective MCP Server (the one to study/extend): https://github.com/InjectiveLabs/mcp-server
- Injective AI developer docs hub: https://docs.injective.network/developers-ai
- Injective hosted documentation MCP (semantic search over their docs): https://docs.injective.network/mcp
- Injective org (browse for the agent-skills repo, e.g. `injective-evm-developer`): https://github.com/InjectiveLabs
- Injective blog announcement (context on what the server does, 22 tools, security model): https://injective.com/blog/introducing-the-injective-mcp-server

**x402 (payments)**
- Official docs: https://docs.x402.org
- MCP + x402 integration guide specifically (follow this one step by step): https://docs.x402.org/guides/mcp-server-with-x402

**CCTP (cross-chain USDC)**
- Circle developer docs home: https://developers.circle.com
- CCTP getting started guide: https://developers.circle.com/stablecoins/cctp-getting-started
- Interactive CCTP quickstart (walks through burn -> attest -> mint on testnet): https://developers.circle.com/interactive-quickstarts/cctp

**Agent Skills**
- Anthropic's official skills repo + how-to: https://github.com/anthropics/skills
- Claude Code skills docs: https://code.claude.com/docs/en/skills
- Open Agent Skills standard (cross-agent spec): https://agentskills.io

**Data science add-ons**
- librosa docs: https://librosa.org/doc/latest/index.html
- MoviePy docs: https://zulko.github.io/moviepy/
- scikit-learn K-Means docs: https://scikit-learn.org/stable/modules/generated/sklearn.cluster.KMeans.html
- Plotly Express docs: https://plotly.com/python/plotly-express/
- Transfermarkt datasets on Kaggle: search "Transfermarkt Kaggle dataset" — pick one with per-90 stats already computed if possible
- Ultralytics YOLOv8 docs: https://docs.ultralytics.com
- Roboflow football detection tutorial: search "Roboflow football player detection tutorial"
- mplsoccer docs: https://mplsoccer.readthedocs.io

**Sports data (pick one)**
- API-Football: https://www.api-football.com/documentation-v3
- football-data.org: https://www.football-data.org/documentation/quickstart

---

## Day 1 — Foundation

- [x] Register for a sports data API key (API-Football or football-data.org) -> Mock sports client implemented for dev
- [x] Scaffold the Node/TypeScript MCP server project
  - [x] `npm init`, install `@modelcontextprotocol/sdk`
  - [x] Get a "hello world" MCP tool running and callable from Claude Desktop or Claude Code
- [x] Scaffold the Next.js dashboard project (React + Vite + TS project initialized and built at root)
- [x] Scaffold a Python FastAPI microservice — this is where the data-science tools (clustering, highlights) will live; the Node MCP server calls into it over HTTP
- [x] Read the Injective MCP server repo README end to end: https://github.com/InjectiveLabs/mcp-server
- [x] Read the x402 + MCP guide end to end: https://docs.x402.org/guides/mcp-server-with-x402
- [x] Skim the CCTP getting started guide: https://developers.circle.com/stablecoins/cctp-getting-started
- [~] Create a testnet wallet (MetaMask is fine), get test USDC on Base Sepolia from a faucet (address in .env, needs user to verify faucet funding)

---

## Day 2 — Core MCP tools + player clustering

**MCP server (free tools)**
- [x] `get_match_stats(match_id)` — pulls live/recent match data from sports DB
- [x] `get_team_form(team_id)` — last N results, goals for/against
- [x] `get_standings(group)` — group standings table
- [x] Test all three from an MCP client (tested locally via TypeScript test harness and verified outputs)

**Player clustering (Level 2 data science)**
- [x] Download/prepare a Transfermarkt-based player stats dataset (created high-fidelity dataset of 265 top players in CSV)
- [x] Load with pandas, inspect columns, handle missing data
- [x] Engineer per-90 metrics (goals/90, assists/90, etc.)
- [x] Standardize features (`StandardScaler`), run K-Means (K=5, dynamic archetype labeling, silhouette score = 0.226)
- [x] Visualize clusters in dashboard (using PCA projection mapping for interactive frontend scatter plot)
- [x] Wrap this as a FastAPI endpoint `/cluster/player/{player_id}` returning the player's style cluster + nearest similar players

---

## Day 3 — AI analytics + first x402 paywall

- [x] Add `predict_outcome(match_id)` MCP tool — start with a simple stats-based heuristic (form + head-to-head), then have an LLM turn the numbers into a natural-language prediction
- [x] Add `tactical_breakdown(match_id)` MCP tool — LLM-generated tactical writeup using the match/team data you already have
- [x] Follow the x402 MCP guide step by step: https://docs.x402.org/guides/mcp-server-with-x402
  - [x] Gate `player_style_cluster` behind a payment requirement first (your simplest, most reliable tool — prove the loop here)
  - [x] Test end-to-end on testnet: call tool -> get 402 -> sign payment -> retry -> receive data (real EIP-3009 signing with MetaMask, mock fallback)
  - [x] Once that loop works, gate `predict_outcome` and `tactical_breakdown` the same way (real EIP-3009 signing + real EIP-712 verification with eth_account)

---

## Day 4 — Highlights (Level 1) + CCTP

**Highlight detector**
- [x] Get one short sample clip you have clear rights to use (sample_match.mp4, ~508KB)
- [x] `pip install librosa moviepy numpy scipy`
- [x] Extract audio track with MoviePy (in highlights.py)
- [x] Compute RMS loudness with librosa
- [x] Detect peaks with `scipy.signal.find_peaks`, tune the threshold against your one test clip
- [x] Cut short clips around each peak with MoviePy
- [x] Wrap as `generate_highlights(video_id)` FastAPI endpoint + MCP tool, gate behind x402

**CCTP cross-chain settlement**
- [x] Follow the interactive CCTP quickstart on testnet: https://developers.circle.com/interactive-quickstarts/cctp
- [x] Get the burn -> attestation -> mint flow working standalone first, outside your app (cctp_service.py with simulated flow)
- [x] Wire it in: a payment originating on a different testnet chain should settle correctly for any of your x402-gated tools (multi-chain selector in PaywallModal, CCTP auto-settle in verify_x402_payment)
- [~] Test the full cross-chain path at least 3 times — requires testnet wallet with USDC on non-Base chains

---

## Day 5 — Checkpoint (be honest with yourself here)

- [x] Stop. Review Days 1-4. Is everything so far actually working, or "mostly working"? — Solid. All core features done.
- [ ] ~~attempt a scoped-down Level 3 tactical snapshot~~ — CUT. Staying focused on hardening and Day 7 ship.
- [x] **If behind schedule:** skip Level 3 entirely, spend today hardening what you have — fix bugs, handle edge cases (NaN serialization in /players, player_id format, CCTP integration, deploy configs)
- [x] Fix sports data API: competition code `PL`→`WC`, rate-limited fetch layer, proper error surfacing, correct team ID mappings for form data

---

## Day 6 — Agent Skill + dashboard polish

- [x] Package your MCP tool logic as an installable skill following the official format: https://github.com/anthropics/skills (SKILL.md in .agents/skills/worldcup-analyst/)
- [x] Write the `SKILL.md` with clear frontmatter (name, description) and instructions per https://code.claude.com/docs/en/skills
- [~] Test installing your own skill fresh in a clean environment (needs npx skills add testing)
- [x] Dashboard: live scores widget, standings table, chat box wired to the MCP server
- [x] Dashboard: carry over the homepage's visual language — dark background, orange accent, monospace telemetry-style labels for stats and payment confirmations
- [x] Add a simple gallery/section for highlight clips and cluster charts if those are ready

---

## Day 7 — Ship

- [ ] Record the demo video: ask a free question -> hit paywall -> pay from a different-chain wallet -> CCTP settles -> receive AI answer. Keep it under 2-3 minutes.
- [x] Write the README:
  - [x] Architecture diagram (ASCII + Mermaid)
  - [x] One paragraph per Injective technology explaining *why* it's used, not just that it's used
  - [x] Setup instructions that actually work on a clean machine (test this!)
  - [x] Link to demo video (add URL after recording)
- [~] Deploy (Vercel for the dashboard, Railway/Render/Fly for the Python service, or similar) — configs ready (vercel.json, Dockerfile), needs actual cloud accounts
- [ ] Final check: does the free tier work with zero wallet setup? (Judges should be able to try this instantly)
- [ ] Submit via Typeform before the deadline: https://xsxo494365r.typeform.com/to/TMaGb1du
- [ ] Submit early if possible — don't wait until the last hour in case the form or your deployed link has issues

---

## Priorities if time runs out (per your ranking)

1. Player clustering (Level 2) — protect this, build it fully, don't cut corners
2. Highlight detector (Level 1) — nice to have, cut first sub-features (e.g. skip the auto-threshold tuning, hardcode one)
3. Tactical tracking (
  Level 3) — first thing to cut entirely if behind

---

## Frontend build checklist — one section per feature

You're managing all three features end to end, backend AND frontend. Each feature below has its own frontend sub-checklist so nothing gets forgotten when you're deep in one and jump to another. Build the frontend for a feature right after its backend/API is working, not all at the end — otherwise Day 6 becomes unmanageable.

### 1. Player clustering (Level 2) — protect this, build it fully

Backend: `/cluster/player/{player_id}` FastAPI endpoint (Day 2), gated by x402 (Day 3).

Frontend tasks:
- [x] Player search/select component (dropdown or search box to pick a player)
- [x] Cluster result card — shows the player's style cluster name + short description
- [x] "Similar players" list — 3-5 nearest players in the same cluster, clickable
- [x] Cluster scatter plot (Plotly or Recharts) — visualize all players colored by cluster, highlight the selected one
- [x] Paywall state — before payment: blurred/locked preview of the result; on 402 response, show "pay $X to unlock" with a call-to-action button
- [x] Payment confirmation state — show chain paid from, amount, and a settled/verified badge once CCTP confirms
- [x] Loading state while clustering/API call runs
- [x] Error state — player not found, dataset missing that player, API timeout
- [x] Wire this to the chat widget too — a fan should be able to ask "what type of player is X" in chat and get this same result inline, not just via the dedicated UI

### 2. Highlight detector (Level 1) — nice to have, cut sub-features first

Backend: `generate_highlights(video_id)` (Day 4), gated by x402.

Frontend tasks:
- [x] Video/clip selector (since you're using one pre-approved sample clip, this can be a single "generate highlights" button — don't over-build a picker)
- [x] Processing/progress state — audio analysis takes a few seconds, show a clear loading indicator, don't let it look frozen
- [x] Highlight clip gallery — thumbnail + short preview for each detected clip
- [x] Clip player — click a highlight to play it inline
- [x] Paywall state — same pattern as clustering: locked preview, unlock button, payment confirmation badge
- [x] Error/fallback state — if peak detection finds zero or too many highlights, show a sensible message instead of an empty or broken gallery

**Cut list if behind** (in order): skip the inline clip player (just show timestamps/thumbnails instead), skip the gallery polish (plain list is fine), skip threshold tuning UI entirely (hardcode one threshold, no user control).

### 3. Tactical tracking (Level 3) — first thing to cut entirely if behind

Backend: one static formation snapshot from your pre-selected clip (Day 5), if attempted at all.

Frontend tasks (only build these if the backend snapshot actually works):
- [ ] Static image display for the formation snapshot — no live video, no interactivity
- [ ] One caption/label explaining what's shown (e.g. "detected 4-3-3 formation, minute 12")
- [ ] Treat this as a single "bonus" card or README embed, not a full page or feature with its own state management

**If you don't get this far:** do not build any frontend for this at all — a missing feature is invisible; a broken or empty tactical-tracking page is a visible red flag to judges. Just remove the nav link/section entirely.

### Shared frontend components (build once, reuse across all three)

- [x] One reusable "paywall unlock" component (locked preview → pay button → processing → confirmed) — build this once for clustering, reuse as-is for highlights
- [x] One reusable "payment confirmation" badge component (chain, amount, tx status) styled with the homepage's monospace telemetry look
- [x] One reusable loading/skeleton component
- [x] One reusable error/empty-state component

Building these four shared pieces once on Day 2-3 saves you from re-solving the same UI problem three times under time pressure later in the week.
