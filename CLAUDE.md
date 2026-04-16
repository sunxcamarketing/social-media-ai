# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Is

**Social Media AI** — a platform for Aysun's social media agency (Sun x ca) that generates viral Instagram Reels content. It scrapes competitors, analyzes viral videos with AI, generates content strategies, and writes complete video scripts — all optimized for each client's unique voice and brand.

---

## How to Run

```bash
npm install
npm run dev
# Open http://localhost:3000
```

**Required environment variables** (in `.env` at project root):
- `APIFY_API_TOKEN` — Apify Instagram scraper
- `GEMINI_API_KEY` — Google Gemini video analysis
- `ANTHROPIC_API_KEY` — Claude concept generation
- `BRAVE_API_KEY` — Brave Search API for live trend research
- `JOB_SECRET` — Auth token for background research jobs
- `GOOGLE_SERVICE_ACCOUNT_KEY` — Google Drive integration (base64 JSON)

---

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** components
- **Supabase** for data storage (migrated from CSV)
- **Apify** — Instagram scraping
- **Google Gemini 2.0 Flash** — Video analysis (upload + multimodal)
- **Claude Sonnet** — Script generation, strategy, concept adaptation

---

## How The System Works

### Video Analysis Pipeline

1. **Input** — Select a config and parameters (max videos, top-K, days lookback) via the Run page
2. **Load Config** — Retrieve analysis prompt, new concepts prompt, and creator list
3. **Scrape** — For each competitor creator, scrape recent Instagram Reels via Apify
4. **Filter & Rank** — Filter by date, sort by views, take top-K most viral
5. **Analyze** — Download video, upload to Gemini, analyze (extracts Concept, Hook, Retention, Reward, Script)
6. **Generate** — Send analysis + brand context to Claude for adapted video concepts
7. **Save** — Results viewable in the Videos page with thumbnails

### Strategy Generation Pipeline — Multi-Step SSE Pipeline

1. **Load Context** — Client profile, audit, performance, competitors, voice profile (no data truncation)
2. **Data Analysis & Goal** — Single Claude call analyzing all data, determining reach/trust/revenue goal
3. **Strategy Creation** — Single Claude call creating 3-5 content pillars with video ideas + weekly plan
4. **Strategy Review** — Single Claude call checking consistency, voice-format match, subtopic quality

Key endpoint: `POST /api/configs/[id]/generate-strategy` (SSE stream)

### Script Generation Pipeline (Weekly) — Multi-Step SSE Pipeline

1. **Load Context** — Client profile, brand positioning, strategy, audit, performance, competitors, platform config
2. **Voice Profile** — Extract/cache structured voice profile from training transcripts
3. **Research** — Load pre-computed trend snapshots + client learnings; live Brave Search as primary, snapshot as fallback
4. **Topic Selection** — Select N strategic topics based on audit + performance + trends + learnings
5. **Hook Generation** — N parallel calls, each producing 3 hook options and selecting the best
6. **Body Writing** — N parallel calls, each writing body + CTA with voice matching
7. **Quality Review** — Single call reviewing all scripts for AI language, voice match, week coherence
8. **Background Trigger** — Fire-and-forget research cycle for next run

Pipeline steps extracted into `src/lib/pipelines/weekly-steps.ts` — route is a ~95-line orchestrator.

Key endpoint: `POST /api/configs/[id]/generate-week-scripts` (SSE stream)
Voice profile: `POST /api/configs/[id]/generate-voice-profile`

### Viral Script Builder — Psychology-First Pipeline

Adapts viral reference videos by extracting PSYCHOLOGICAL MECHANICS (not structure). Produces original-feeling scripts that use the same triggers.

1. **Load Context** — Voice profile, script structure, audit
2. **Reference Video** — Scrape via Apify + analyze with Gemini (or use existing DB video)
3. **Psychology Extraction** — Extract hook-trigger, retention-mechanic, share-trigger, opinion-angle, reward-mechanic
4. **Hook Generation** — 3 hook variants using same psychological trigger (not word-swapping)
5. **Script Adaptation** — New script using same psychology, different content (short + long versions)
6. **Critic Agent Loop** — Up to 3 rounds: critic evaluates creative quality + psychological equivalence → writer revises
7. **Production Notes** — Shot list for filming

Key endpoint: `POST /api/viral-script` (SSE stream)

### Content Agent (Portal Chat)

AI-Agent im Client-Portal mit Tool-Zugriff. Nutzt Claude's native `tool_use` für autonome Datenabfragen und Skript-Generierung. Der Agent entscheidet selbstständig welche Tools er aufruft basierend auf der Nachricht.

**Tools (12):** `load_client_context`, `load_voice_profile`, `search_scripts`, `check_performance`, `load_audit`, `generate_script`, `check_competitors`, `check_learnings`, `search_web`, `research_trends`, `save_idea`, `update_profile` (+ admin-only: `list_clients`)

- Agent-Loop: Non-streaming tool iterations + SSE text streaming for final response
- Tool implementations: `src/lib/agent-tools.ts`
- Agent prompt: `prompts/agents/content-agent.md` (slim, no script rules)
- Script generation: Writer (`script-writer.md`) + Regex check + Reviewer (`script-reviewer.md`, only when needed)
- Max 10 tool-call iterations per turn (safety limit)
- Scripts always generated in short (30-40s) + long (60+s) versions
- `search_web` uses Brave Search API for live web data
- `research_trends` runs multi-query niche trend search
- `check_learnings` returns confidence-scored performance insights (N≥8 minimum)

Key endpoint: `POST /api/chat` (SSE stream with agent loop)

### Voice Agent (Content Interview)

Voice-basierter Interview-Agent im Client-Portal. Nutzt Gemini Live API (WebSocket, Echtzeit-Audio) um Clients durch gezielte Fragen Content-Material zu entlocken — Stories, Meinungen, Erfahrungen. Am Ende der Session werden daraus strukturierte Content-Ideen generiert und gespeichert.

1. **Session Start** — Browser verbindet via WebSocket zum Voice Server, Gemini Live Session wird erstellt
2. **Context Loading** — Agent lädt Client-Profil, Audit, Performance via Function Calling
3. **Interview** — Agent stellt Fragen basierend auf WICK-Methode (Wound, Identity Shift, Cost, Key Lesson)
4. **Content-Erkennung** — Agent erkennt Stories, kontroverse Meinungen, Tipps und markiert sie als Ideen
5. **Session End** — Transkript wird an Claude gesendet, extrahiert 3-5 Content-Ideen, speichert in `ideas` Tabelle

**Architektur:** Browser (Mic) → WebSocket → Voice Server (Port 4001) → Gemini Live API
- Separater WebSocket-Server (`src/voice-server.ts`) — Next.js hat kein natives WS
- Gemini Live Client: `src/lib/gemini-live.ts`
- Voice Agent Prompt: `prompts/agents/voice-agent.md`
- Tools (5): `load_client_context`, `load_audit`, `check_performance`, `check_learnings`, `save_idea`
- Audio: PCM 16kHz (Browser → Gemini), 24kHz (Gemini → Browser)
- Auth: Supabase access token als WebSocket query parameter

**How to Run:**
```bash
npm run dev           # Next.js on port 4000
npm run voice-server  # Voice WS server on port 4001
```

Key page: `/portal/voice`

---

## Modular Prompt Architecture

The heart of the system. All prompt text lives in markdown files, assembled at runtime by `buildPrompt()`.

### How It Works

```
API Route calls:  buildPrompt("hook-generation", { client_name: "Max" })
                         │
                         ▼
              loads agents/hook-generation.md
              finds {{placeholders}} in template
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         passed       auto-load   auto-load
         substitution foundational foundational
         (client_name) (hook-regeln.md) (verboten-ai-sprache.md)
                         │
                         ▼
              fully assembled system prompt
```

1. `buildPrompt(agentName, substitutions)` loads the agent template from `agents/{name}.md`
2. For each `{{placeholder}}` in the template:
   - First checks `substitutions` dict (for runtime values like word limits, client names)
   - Then auto-loads `foundational/{placeholder}.md` (for reusable prompt modules)
3. Returns the fully assembled system prompt string

### Agent Templates (`prompts/agents/`)

Mother prompts — one per pipeline step. Each contains the full structure with `{{placeholder}}` slots.

| Agent | Pipeline Step | Key Placeholders |
|-------|---------------|------------------|
| `topic-selection.md` | Weekly: Topic Selection | `{{num_days}}`, `{{platform_context}}`, auto: themen-spezifizitaet, audit-nutzung, anti-muster |
| `trend-research.md` | Weekly: Trend Research | `{{niche}}`, `{{current_date}}`, `{{month_label}}`, `{{platform_context}}` |
| `hook-generation.md` | Weekly: Hook Generation | `{{platform_context}}`, auto: hook-regeln, hook-muster, hook-framework, verboten-ai-sprache, natuerliche-satzstruktur |
| `body-writing.md` | Weekly: Body Writing | `{{laenge_regeln}}`, `{{stimm_matching}}`, `{{skript_struktur}}`, `{{skript_beispiele}}`, auto: rolle-skriptschreiber, hook-framework, body-regeln, cta-regeln, konkretion-regeln, sprach-stil, verboten-ai-sprache, anti-ai-checkliste, anti-monotone-formatierung, natuerliche-satzstruktur |
| `quality-review.md` | Weekly: Quality Review | auto: verboten-ai-sprache, anti-ai-checkliste, anti-monotone-formatierung, natuerliche-satzstruktur |
| `voice-profile.md` | Voice Profile Extraction | (no placeholders — standalone) |
| `script-structure.md` | Script Structure Extraction | (no placeholders — standalone) |
| `strategy-analysis.md` | Strategy: Data Analysis | auto: audit-nutzung |
| `strategy-creation.md` | Strategy: Pillar Creation | `{{posts_per_week}}`, `{{active_days}}`, `{{content_types}}`, `{{formats}}`, auto: themen-spezifizitaet, konkretion-regeln |
| `strategy-review.md` | Strategy: Review | (no placeholders — standalone) |
| `content-agent.md` | Content Agent (Portal Chat) | `{{platform_context}}` (script rules removed, delegated to Script Agent) |
| `script-writer.md` | Script Agent: Creative Writing | `{{platform_context}}`, auto: hook-regeln, hook-muster, body-regeln, cta-regeln, konkretion-regeln, storytelling-formel, text-hook-regeln |
| `script-reviewer.md` | Script Agent: Quality Gate | auto: verboten-ai-sprache, anti-ai-checkliste, anti-monotone-formatierung, natuerliche-satzstruktur, sprach-stil |
| `viral-script-structure.md` | Viral: Psychology Extraction | (standalone) |
| `viral-hook-generation.md` | Viral: Hook Generation | `{{platform_context}}` |
| `viral-script-adapt.md` | Viral: Script Adaptation | auto: rolle-skriptschreiber, verboten-ai-sprache, natuerliche-satzstruktur, anti-monotone-formatierung, stimm-matching |
| `viral-script-critic.md` | Viral: Quality Critique | `{{platform_context}}`, auto: verboten-ai-sprache |
| `viral-script-production.md` | Viral: Production Notes | `{{platform_context}}` |
| `voice-agent.md` | Voice Interview Agent | auto: konkretion-regeln, themen-spezifizitaet |

### Foundational Sub-Prompts (`prompts/foundational/`)

Single-concern markdown files. Each covers ONE aspect of script quality. Reused across multiple agents.

**Script Quality Rules:**
| File | What It Controls |
|------|-----------------|
| `rolle-skriptschreiber.md` | Role definition — "you are an elite scriptwriter for Instagram Reels" |
| `hook-regeln.md` | Core hook rules — first sentence must grab, open loop, no fluff |
| `hook-muster.md` | 8 proven hook patterns — Kontrast, Provokation, Neugier, etc. |
| `hook-framework.md` | Hook/Retain/Reward psychological framework for scroll-stopping content |
| `body-regeln.md` | Body rules — one idea per paragraph, no repetition, progressive value |
| `cta-regeln.md` | CTA rules — clear action, max 1-2 sentences |
| `konkretion-regeln.md` | Concreteness rules — specific examples, real numbers, no vague claims |
| `abwechslung-regeln.md` | Variety rules — vary hooks, emotions, formats across the week |
| `titel-regeln.md` | Title rules — max 10 words, describes exact content |

**Anti-AI & Language Quality:**
| File | What It Controls |
|------|-----------------|
| `verboten-ai-sprache.md` | **100+ banned German AI phrases** across 12 categories (the flagship prompt) |
| `anti-ai-checkliste.md` | 7-point post-generation checklist — "does this sound like a human?" |
| `sprach-stil.md` | Language style — spoken German, short sentences, direct, raw, real |
| `anti-monotone-formatierung.md` | Bans the "one sentence → blank line → one sentence" AI pattern |
| `natuerliche-satzstruktur.md` | Variable sentence structure — mix short/long, strategic punctuation |

**Voice & Examples:**
| File | What It Controls |
|------|-----------------|
| `stimm-matching.md` | Voice matching template — uses `{{client_name}}` for personalization |
| `skript-beispiele.md` | Script examples wrapper — uses `{{beispiel_skripte}}` for training scripts |

**Strategy & Data:**
| File | What It Controls |
|------|-----------------|
| `reasoning-regeln.md` | Data-driven reasoning — cite concrete audit findings, not vague claims |
| `audit-nutzung.md` | How to use audit report — read fully, find patterns, identify gaps |
| `themen-spezifizitaet.md` | Topic specificity — "not 'Trading Fehler' but 'Warum dein Stop-Loss bei 2% Quatsch ist'" |
| `wochen-koherenz.md` | Week coherence — strategic variety across pillars, hooks, emotions |
| `anti-muster.md` | Anti-patterns — what NOT to do (generic titles, repetitive hooks, etc.) |

### Tool Schemas (`prompts/tools.ts`)

All Anthropic tool schemas in one file. Used with `tool_choice: { type: "tool" }` for structured JSON output.

| Tool | Used By | Output |
|------|---------|--------|
| `TOPIC_SELECTION_TOOL` | topic-selection | Array of day/pillar/type/format/title/description/reasoning |
| `TREND_RESEARCH_TOOL` | trend-research | Array of topic/angle/whyNow/hookIdea |
| `HOOK_GENERATION_TOOL` | hook-generation | 3 hook options + selected index + reason |
| `BODY_WRITING_TOOL` | body-writing | body + cta text |
| `QUALITY_REVIEW_TOOL` | quality-review | Per-script issues + optional revised text |
| `VOICE_PROFILE_TOOL` | voice-profile | Structured voice profile (tone, energy, words, patterns) |
| `SCRIPT_STRUCTURE_TOOL` | script-structure | Dramaturgic flow, hook/body/CTA patterns |
| `STRATEGY_ANALYSIS_TOOL` | strategy-analysis | Insights + goal (reach/trust/revenue) |
| `STRATEGY_CREATION_TOOL` | strategy-creation | Pillars with subtopics + weekly schedule |
| `STRATEGY_REVIEW_TOOL` | strategy-review | Issues + optional revised pillars/weekly |

### Editing Prompts

To change how scripts are generated:
- **Change a rule** (e.g. banned AI phrases): Edit the foundational `.md` file directly. Changes apply everywhere it's used.
- **Change a pipeline step** (e.g. how hooks are generated): Edit the agent template `.md` file.
- **Add a new concern** (e.g. new quality rule): Create a new `foundational/my-rule.md`, then add `{{my-rule}}` to the relevant agent templates.
- **Pass runtime data**: Add a `{{my_placeholder}}` to the agent template, then pass `{ my_placeholder: "value" }` in the `buildPrompt()` call in the API route.

---

## Workspace Structure

```
.
├── CLAUDE.md                              # This file
├── .env                                   # API keys (not committed)
├── src/
│   ├── app/                               # Pages and API routes
│   │   ├── (app)/                         # Admin route group (sidebar, topbar)
│   │   │   ├── page.tsx                   # Dashboard
│   │   │   ├── clients/                   # Client management pages
│   │   │   ├── configs/                   # Config management
│   │   │   ├── strategy/                  # Strategy page
│   │   │   ├── training/                  # Training page
│   │   │   └── transcribe/               # Transcribe page
│   │   ├── portal/                        # Client portal (read-only)
│   │   │   ├── layout.tsx                # Portal layout with client-nav
│   │   │   ├── page.tsx                  # Client dashboard
│   │   │   ├── scripts/                  # Client scripts (read-only)
│   │   │   ├── strategy/                 # Client strategy (read-only)
│   │   │   ├── analyse/                  # Client audit (read-only)
│   │   │   ├── videos/                   # Client videos (read-only)
│   │   │   ├── chat/                     # Client chat (scoped context)
│   │   └── voice/                    # Voice interview agent (Gemini Live)
│   │   ├── login/                         # Login page (password + magic link)
│   │   ├── no-access/                     # No access page
│   │   └── api/                           # API routes
│   │       ├── auth/                      # Auth routes (invite, me, impersonate)
│   │       ├── chat/                      # Content Agent chat (SSE)
│   │       ├── configs/[id]/
│   │       │   ├── generate-week-scripts/ # Weekly script pipeline (SSE)
│   │       │   ├── generate-strategy/     # Strategy pipeline (SSE)
│   │       │   ├── generate-voice-profile/# Voice profile extraction
│   │       │   └── performance/           # Performance data
│   │       ├── viral-script/              # Viral script builder (SSE)
│   │       └── jobs/
│   │           └── research-cycle/        # Background research orchestrator
│   ├── lib/                               # Core logic
│   │   ├── auth.ts                       # Auth helpers (getCurrentUser, requireAdmin, etc.)
│   │   ├── pipeline.ts                   # Video analysis pipeline orchestration
│   │   ├── pipelines/weekly-steps.ts     # Weekly pipeline steps (extracted)
│   │   ├── voice-profile.ts              # Voice + script structure extraction
│   │   ├── agent-tools.ts               # Content Agent tool implementations (12 tools)
│   │   ├── gemini-live.ts              # Gemini Live API client (WebSocket, audio streaming)
│   │   ├── platforms.ts                  # Platform abstraction (IG, TikTok, LinkedIn)
│   │   ├── intelligence.ts              # Intelligence snapshots CRUD + freshness
│   │   ├── client-learnings.ts          # Client learnings with confidence scoring
│   │   ├── brave-search.ts             # Brave Search API client
│   │   ├── apify.ts                      # Apify scraper client
│   │   ├── gemini.ts                     # Gemini video analysis client
│   │   ├── claude.ts                     # Claude concept generation client
│   │   ├── csv.ts                        # Supabase CRUD utilities
│   │   ├── jobs/                         # Background research jobs
│   │   │   ├── competitor-refresh.ts    # Apify competitor scraping
│   │   │   ├── trend-refresh.ts         # Brave Search trend research
│   │   │   └── performance-feedback.ts  # Performance analysis + learning extraction
│   │   └── types.ts                      # TypeScript interfaces
│   ├── voice-server.ts                   # Standalone WebSocket server for Voice Agent (port 4001)
│   └── components/                        # UI components (shadcn + custom)
├── prompts/                               # ── MODULAR PROMPT SYSTEM (top-level!) ──
│   ├── index.ts                          # Re-exports: buildPrompt, tools, analysis
│   ├── loader.ts                         # buildPrompt() — loads agent + resolves {{placeholders}}
│   ├── tools.ts                          # All Anthropic tool schemas (pipeline + agent)
│   ├── analysis.ts                       # Gemini video analysis prompts
│   ├── agents/                           # Agent templates (mother prompts)
│   │   ├── topic-selection.md
│   │   ├── trend-research.md
│   │   ├── hook-generation.md
│   │   ├── body-writing.md
│   │   ├── quality-review.md
│   │   ├── voice-profile.md
│   │   ├── script-structure.md
│   │   ├── strategy-analysis.md
│   │   ├── strategy-creation.md
│   │   ├── strategy-review.md
│   │   ├── content-agent.md              # Content Agent system prompt (12 tools + rules)
│   │   ├── script-agent.md              # Script Agent (nested in chat generate_script tool)
│   │   ├── viral-script-structure.md    # Viral: Psychology extraction
│   │   ├── viral-hook-generation.md     # Viral: Hook generation
│   │   ├── viral-script-adapt.md        # Viral: Script adaptation (psychology-first)
│   │   ├── viral-script-critic.md       # Viral: Quality critique
│   │   └── viral-script-production.md   # Viral: Production notes
│   └── foundational/                     # 21 sub-prompts (single-concern .md)
│       ├── rolle-skriptschreiber.md
│       ├── hook-regeln.md
│       ├── hook-muster.md
│       ├── hook-framework.md
│       ├── body-regeln.md
│       ├── cta-regeln.md
│       ├── konkretion-regeln.md
│       ├── abwechslung-regeln.md
│       ├── titel-regeln.md
│       ├── verboten-ai-sprache.md
│       ├── anti-ai-checkliste.md
│       ├── sprach-stil.md
│       ├── anti-monotone-formatierung.md
│       ├── natuerliche-satzstruktur.md
│       ├── stimm-matching.md
│       ├── skript-beispiele.md
│       ├── reasoning-regeln.md
│       ├── audit-nutzung.md
│       ├── themen-spezifizitaet.md
│       ├── wochen-koherenz.md
│       └── anti-muster.md
├── data/                                  # CSV data storage (legacy)
├── context/                               # Background context for Claude
├── plans/                                 # Implementation plans
├── package.json
└── .claude/commands/                      # Slash commands (prime, create-plan, implement)
```

---

## App Pages

### Admin Pages (Route Group: `(app)`)

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Summary stats, recent videos |
| Videos | `/videos` | Browse results with thumbnails, expandable analysis & concepts |
| Run Pipeline | `/run` | Select config, set params, run with live progress streaming |
| Configs | `/configs` | CRUD for pipeline configs (prompts, categories) |
| Creators | `/creators` | CRUD for competitor Instagram accounts |

### Client Portal Pages (`/portal/*`)

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/portal` | Welcome + quick stats |
| Skripte | `/portal/scripts` | Read-only scripts with expandable hook/body/CTA |
| Strategie | `/portal/strategy` | Content pillars + weekly plan (read-only) |
| Audit | `/portal/analyse` | Latest audit report with stats |
| Videos | `/portal/videos` | Analyzed videos with thumbnails |
| Chat | `/portal/chat` | AI assistant scoped to client's own data |
| Voice | `/portal/voice` | Voice interview agent for content idea extraction |

---

## Authentication & Rollen

### How It Works

- **`client_users` table** maps Supabase Auth users to clients with roles (`admin` | `client`)
- **Admins** (Aysun): access all clients, all tools, full sidebar — login via email/password
- **Clients**: access only their own data via `/portal/*` — login via Magic Link (no password)
- **Middleware** (`src/middleware.ts`): checks role, routes clients to `/portal`, blocks unauthorized access
- **Auth helpers** (`src/lib/auth.ts`): `getCurrentUser()`, `requireAdmin()`, `requireClientAccess()`, `getEffectiveClientId()`
- **API-level auth**: every API route checks the user's role and filters data accordingly

### Admin Impersonate

Admins can click the Eye icon per client in the sidebar to "view as client". This sets an `impersonate_client_id` cookie and opens the `/portal` view with a banner showing "Du siehst den Bereich von [Client] als Admin". The "Zurück zum Admin-Bereich" button clears the cookie.

### Invitation Flow

1. Admin opens client's Information page → "Kundenzugang" section
2. Enters client's email → clicks "Einladen"
3. `POST /api/auth/invite` creates Supabase Auth user + `client_users` mapping
4. Client receives Magic Link email → clicks → lands on `/portal`

---

## Commands

### /prime
Initialize a new session with full context awareness.

### /create-plan [request]
Create a detailed implementation plan in `plans/`.

### /implement [plan-path]
Execute a plan step by step.

---

## Critical Instruction: Maintain This File

After any change to the workspace, ask:
1. Does this change add new functionality?
2. Does it modify the workspace structure documented above?
3. Should a new command be listed?
4. Does context/ need updates?

If yes, update the relevant sections.

---

## Session Workflow

1. **Start**: Run `/prime` to load context
2. **Work**: Use commands or direct Claude with tasks
3. **Plan changes**: Use `/create-plan` before significant additions
4. **Execute**: Use `/implement` to execute plans
5. **Maintain**: Claude updates CLAUDE.md and context/ as the workspace evolves
