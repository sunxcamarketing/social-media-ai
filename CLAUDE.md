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
- `APIFY_API_TOKEN` — Apify (Instagram + LinkedIn + TikTok scraping for Auto-fill, plus competitor video scraping)
- `GEMINI_API_KEY` — Google Gemini video analysis
- `ANTHROPIC_API_KEY` — Claude concept generation
- `BRAVE_API_KEY` — Brave Search API for live trend research
- `JOB_SECRET` — Auth token for background research jobs
- `GOOGLE_SERVICE_ACCOUNT_KEY` — Google Drive integration (base64 JSON)

**Optional Apify actor overrides** (defaults work for most cases; override only if you've subscribed to a different actor):
- `APIFY_LINKEDIN_ACTOR` — default `dev_fusion~Linkedin-Profile-Scraper`
- `APIFY_TIKTOK_ACTOR` — default `clockworks~tiktok-profile-scraper`

---

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** components
- **Supabase** for data storage (migrated from CSV)
- **Apify** — Instagram scraping
- **Google Gemini 2.0 Flash** — Video analysis (upload + multimodal)
- **Claude (Sonnet + Opus + Haiku)** — Strategy, weekly ideas, chat agent, concept adaptation. Models centralized in `src/lib/models.ts` — never hardcode model IDs at the call site.

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

### Weekly Ideas Pipeline — One-Shot Opus

Note: despite the endpoint name `generate-week-scripts`, this flow produces **ideas, not scripts**. Scripts are generated on-demand from an idea (see next section).

1. **Lock** — `acquirePipelineLock()` prevents parallel week runs per client (returns 409 on collision)
2. **Parallel Context Load** — `loadPipelineContext()` + `loadVoiceProfiles()`:
   - Client/brand/audit/performance/competitor/cross-niche context
   - Week-seeded schedule (same configId + same ISO week → same day/pillar/type/format rotation, different week → different offset)
   - Winner anchors (own top videos + competitor winners for core/variant posts)
   - Recent scripts + hook-pattern history (to avoid recycling)
   - Audit-preferred duration as hard ceiling
   - Voice profile + script structure + voice onboarding block (all cached in DB, regenerated on miss)
3. **Research** — `runResearch()`: Brave deep search (15-20 queries across 9 categories, week-RNG rotates angles) → Sonnet synthesizes 6-12 real trends via `TREND_RESEARCH_TOOL` (plus high-confidence client learnings from Supabase)
4. **One-Shot Idea Generation** — single **Opus** call (`claude-opus-4-7`) with the `weekly-ideas` agent + `WEEKLY_IDEAS_TOOL`. Sees full context and returns N coherent ideas (one per active day) with `title`, `angle`, `hookDirection`, `keyPoints`, `whyNow`, `emotion`, plus a `weekReasoning`
5. **Return Inline, Don't Persist** — ideas stream back to the UI. The user picks which to develop into full scripts via the Content Agent chat (the "Skript ausformulieren" button on each idea opens the chat pre-seeded with the idea brief)
6. **Fire-and-Forget** — triggers `/api/jobs/research-cycle` to refresh snapshots/learnings for the next run

Entry point: `src/lib/pipelines/weekly-oneshot.ts` (`generateWeekIdeas`)
Shared setup: `src/lib/pipelines/weekly-steps.ts` (`loadPipelineContext`, `loadVoiceProfiles`, `runResearch`)
Route orchestrator: ~95 lines — `POST /api/configs/[id]/generate-week-scripts` (SSE stream)
Voice profile: `POST /api/configs/[id]/generate-voice-profile`

### Single Script Generation — Inline in the Content Agent Chat

Scripts are written **inline by the Content Agent** as plain text in the chat (`/api/chat`). There is no separate script-generation endpoint and no Writer/Reviewer pipeline — the agent's system prompt (`prompts/agents/content-agent.md`) loads the full set of foundational rules (hook-regeln, body-regeln, anti-AI, voice profile, etc.) and the agent writes both the short (30-40s) and long (60+s) versions in a single message. The user can then call the `save_script` tool to persist them.

There are two ways to enter that flow:

- **From an idea** — the "Skript ausformulieren" button on any saved idea or weekly idea opens `DevelopIdeaDialog` (`src/components/develop-idea-dialog.tsx`), which mounts the chat with a pre-seeded message describing the idea.
- **Directly in chat** — the user just asks for a script. Same agent, same prompt, same rules.

### Content Agent (Portal Chat)

AI-Agent im Client-Portal mit Tool-Zugriff. Nutzt Claude's native `tool_use` für autonome Datenabfragen. Skripte schreibt der Agent **selbst inline im Chat** — kein separater Script-Generation-Endpoint, kein Writer/Reviewer-Loop. Der Agent entscheidet selbstständig welche Tools er aufruft basierend auf der Nachricht.

**Tools (13):** `load_client_context`, `load_voice_profile`, `search_scripts`, `check_performance`, `load_audit`, `check_competitors`, `check_learnings`, `search_web`, `research_trends`, `save_idea`, `list_ideas`, `save_script`, `update_profile` (+ admin-only: `list_clients`)

- Agent-Loop: Non-streaming tool iterations + SSE text streaming for final response
- Tool implementations: `src/lib/agent-tools.ts`
- Agent prompt: `prompts/agents/content-agent.md` (loads all foundational rules — hook-regeln, body-regeln, anti-AI, etc.)
- Max iterations per turn: `AGENT_ITERATION_LIMIT` from `src/lib/models.ts` (currently 10)
- Scripts always generated in short (30-40s) + long (60+s) versions, written inline; `save_script` persists both as separate Skript-Einträge
- `search_web` uses Brave Search API for live web data
- `research_trends` runs multi-query niche trend search
- `check_learnings` returns confidence-scored performance insights (N≥8 minimum)
- Prompt caching enabled on the system prompt — large speed-up on multi-turn conversations

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

**How to Run (local):**
```bash
npm run dev           # Next.js on port 4000
npm run voice-server  # Voice WS server on port 4001
```

Key page: `/portal/voice`

### Production Deployment (Fly.io)

The voice server runs as its own service because Vercel doesn't support long-lived WebSockets. We deploy it to Fly.io's Frankfurt region (low latency for DACH clients).

Files involved:
- `Dockerfile` — minimal Node 20 alpine image, copies only what `voice-server.ts` imports (`src/lib`, `prompts/`, `tsconfig.json`)
- `fly.toml` — app config: 512MB shared-cpu, auto-stop on idle, auto-start on next request, health check on `/health`
- `voice-server.ts` — reads `PORT` env var (cloud convention) before falling back to `VOICE_SERVER_PORT` (local)

**One-time setup** (Aysun, do this in your terminal):
```bash
brew install flyctl                 # if not installed
fly auth signup                     # or `fly auth login`
fly launch --copy-config --no-deploy
# accept the suggested name (or pick one); region: fra; don't deploy yet
fly secrets set \
  GEMINI_API_KEY=... \
  NEXT_PUBLIC_SUPABASE_URL=... \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  SUPABASE_SERVICE_ROLE_KEY=...
fly deploy
fly status                          # shows the public URL
```

**Wire it up in the browser**: in Vercel project settings, set
```
NEXT_PUBLIC_VOICE_SERVER_URL=wss://<your-app>.fly.dev
```
Then redeploy Vercel. Locally this var is unset, so the client falls back to `ws://localhost:4001`.

**Updating after code changes**: `fly deploy` from the repo root. Roughly 60-90s rebuild + ship.

---

## Modular Prompt Architecture

The heart of the system. All prompt text lives in markdown files, assembled at runtime by `buildPrompt()`.

### How It Works

```
API Route calls:  buildPrompt("content-agent", { platform_context: ctx })
                         │
                         ▼
              loads agents/content-agent.md
              finds {{placeholders}} in template
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         passed       auto-load   auto-load
         substitution foundational foundational
         (platform_context) (hook-regeln.md) (verboten-ai-sprache.md)
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

| Agent | Pipeline Step |
|-------|---------------|
| `weekly-ideas.md` | Weekly: One-Shot Idea Generation (Opus) |
| `trend-research.md` | Weekly: Trend Research (synthesizes Brave search results) |
| `content-agent.md` | Content Agent (Portal Chat) — writes scripts inline, loads all script foundationals |
| `story-strategist.md` | Story Strategist (`POST /api/configs/[id]/story-strategies`) |
| `carousel-generator.md` / `carousel-react-generator.md` / `carousel-chat-refine.md` | Carousel pipelines |
| `voice-profile.md` | Voice Profile Extraction from training transcripts |
| `voice-profile-topic.md` / `voice-profile-scenario.md` | Voice Agent voice-profile sub-prompts |
| `voice-agent.md` | Voice Interview Agent (Gemini Live) |
| `voice-agent-onboarding.md` | Voice Onboarding (8-block interview) |
| `script-structure.md` | Script Structure Extraction |
| `strategy-analysis.md` | Strategy: Data Analysis |
| `strategy-creation.md` | Strategy: Pillar Creation |
| `strategy-review.md` | Strategy: Review |

### Foundational Sub-Prompts (`prompts/foundational/`)

Single-concern markdown files. Each covers ONE aspect of script quality. Reused across multiple agents.

**Script Quality Rules:**
| File | What It Controls |
|------|-----------------|
| `rolle-skriptschreiber.md` | Role definition — "you are an elite scriptwriter for Instagram Reels" |
| `hook-regeln.md` | Core hook rules — first sentence must grab, open loop, no fluff |
| `hook-muster.md` | Proven hook patterns — Kontrast, Provokation, Neugier, etc. |
| `hook-framework.md` | Hook/Retain/Reward psychological framework for scroll-stopping content |
| `text-hook-regeln.md` | On-screen text hook rules (separate from spoken audio hook) |
| `body-regeln.md` | Body rules — one idea per paragraph, no repetition, progressive value |
| `cta-regeln.md` | CTA rules — clear action, max 1-2 sentences |
| `konkretion-regeln.md` | Concreteness rules — specific examples, real numbers, no vague claims |
| `abwechslung-regeln.md` | Variety rules — vary hooks, emotions, formats across the week |
| `titel-regeln.md` | Title rules — max 10 words, describes exact content |
| `storytelling-formel.md` | Story structure formula for narrative scripts |
| `meinungs-injektion.md` | Opinion injection — how to insert contrarian POV into scripts |

**Anti-AI & Language Quality:**
| File | What It Controls |
|------|-----------------|
| `verboten-ai-sprache.md` | **100+ banned German AI phrases** (`.en.md` is a hand-curated English list, not a translation) |
| `anti-ai-checkliste.md` | Post-generation checklist — "does this sound like a human?" |
| `sprach-stil.md` | Language style — spoken German, short sentences, direct, raw, real |
| `anti-monotone-formatierung.md` | Bans the "one sentence → blank line → one sentence" AI pattern |
| `natuerliche-satzstruktur.md` | Variable sentence structure — mix short/long, strategic punctuation |

**Chat Surfaces:**
| File | What It Controls |
|------|-----------------|
| `chat-admin-mode.md` | Admin-mode banner/context for Content Agent |
| `chat-admin-scoped.md` | Admin chat scoped to a single client |
| `chat-client-scoped.md` | Client-portal chat scope (client sees only own data) |

**Strategy & Data:**
| File | What It Controls |
|------|-----------------|
| `audit-nutzung.md` | How to use audit report — read fully, find patterns, identify gaps |
| `themen-spezifizitaet.md` | Topic specificity — "not 'Trading Fehler' but 'Warum dein Stop-Loss bei 2% Quatsch ist'" |
| `wochen-koherenz.md` | Week coherence — strategic variety across pillars, hooks, emotions |
| `anti-muster.md` | Anti-patterns — what NOT to do (generic titles, repetitive hooks, etc.) |

### Tool Schemas (`prompts/tools/`)

Anthropic tool schemas split by domain into `prompts/tools/{strategy,voice,agent,carousel,story,enrich}.ts`, with a re-export index. Used with `tool_choice: { type: "tool" }` for structured JSON output. Importers can use either the bundled re-export (`@prompts/tools` or `@prompts`) or a specific domain file.

| Tool | Used By | Output |
|------|---------|--------|
| `WEEKLY_IDEAS_TOOL(n)` | weekly-ideas | N coherent ideas for the week (title/angle/hookDirection/keyPoints/whyNow/emotion) + weekReasoning |
| `TREND_RESEARCH_TOOL` | trend-research | Array of topic/angle/whyNow/hookIdea + sourceUrls + category |
| `VOICE_PROFILE_TOOL` | voice-profile | Structured voice profile (tone, energy, words, patterns) |
| `SCRIPT_STRUCTURE_TOOL` | script-structure | Dramaturgic flow, hook/body/CTA patterns |
| `STRATEGY_ANALYSIS_TOOL` | strategy-analysis | Insights + goal (reach/trust/revenue) |
| `STRATEGY_CREATION_TOOL` | strategy-creation | Pillars with subtopics + weekly schedule |
| `STRATEGY_REVIEW_TOOL` | strategy-review | Issues + optional revised pillars/weekly |
| `AGENT_*_TOOL` (13 + admin `list_clients`) | Content Agent tool-use loop | Tool-specific payloads (load context, search scripts, save idea, save script, etc.) |
| `VOICE_AGENT_GEMINI_TOOLS` | Voice Agent (Gemini Live) | Live function-calling schemas for voice session |
| `STORY_STRATEGY_TOOL` | story-strategist | Instagram Story campaign plan |
| `CAROUSEL_UPDATE_TOOL` | carousel chat refine | TSX update + summary |
| `ENRICH_PROFILE_TOOL` | profile enrichment (auto-fill) | Brand-positioning profile from scraped social data |

### Editing Prompts

To change how scripts are generated:
- **Change a rule** (e.g. banned AI phrases): Edit the foundational `.md` file directly. Changes apply everywhere it's used.
- **Change a pipeline step** (e.g. how hooks are generated): Edit the agent template `.md` file.
- **Add a new concern** (e.g. new quality rule): Create a new `foundational/my-rule.md`, then add `{{my-rule}}` to the relevant agent templates.
- **Pass runtime data**: Add a `{{my_placeholder}}` to the agent template, then pass `{ my_placeholder: "value" }` in the `buildPrompt()` call in the API route.

---

## i18n (German / English)

Every client has a `language` (`"de"` or `"en"`, default `"de"`) chosen at onboarding. It drives the output language of **all** generation (scripts, strategy, audit), the Chat Agent, and the Voice Agent. Existing clients without a value default to German — 100% backward-compatible.

### Filename convention

Every prompt file has two variants:
- `foo.md` — German (default)
- `foo.en.md` — English

`buildPrompt(name, subs, lang?)` tries `{name}.en.md` first when `lang === "en"`, falls back to `{name}.md` otherwise. Missing English variants log a warning.

When adding a new prompt, **always create both** — a German file and an English sibling. Don't translate at runtime.

### API

```ts
import { buildPrompt, type Lang } from "@prompts";

const lang: Lang = config.language === "en" ? "en" : "de";
const systemPrompt = buildPrompt("content-agent", { platform_context: ctx }, lang);
```

Every pipeline entry point reads `config.language` and threads it through. Key touchpoints:
- `prompts/loader.ts` — `buildPrompt`, `loadAgent`, `loadFoundational` all take optional `lang`
- `src/lib/pipelines/weekly-steps.ts` — `PipelineContext.lang` populated in `loadPipelineContext`
- `src/app/api/chat/route.ts` — reads `config.language`, passes to `buildPrompt`; admin-mode banners live in `chat-admin-mode.{de,en}.md`
- `src/voice-server.ts` — accepts `?lang=` query override; dynamic `languageCode` (`de-DE` / `en-US`) passed to `GeminiLiveSession.connect()`

### UI language

UI language is independent from content language. Stored in `localStorage["sunxca-lang"]` (user override) with `client.language` as the default when the portal loads. Toggle button in both admin topbar and portal topbar. Precedence: **user override > client default > "de"**.

The i18n dict lives in `src/lib/i18n.tsx` (~500 keys, single file). Access via `const { lang, toggleLang, t } = useI18n()`. No `next-intl` — the lightweight custom system is intentional.

### English banned-phrase list

`prompts/foundational/verboten-ai-sprache.en.md` is **hand-curated** — not a translation of the German list. It catches English-specific AI tells (`delve`, `tapestry`, `game-changer`, `In today's fast-paced world`, `It's important to note`, `— and here's why`, etc.). If you edit the banned-phrase list, be explicit about **which** language file you're touching; the two lists stay independently maintained.

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
│   │       ├── chat/                      # Content Agent chat (SSE) — writes scripts inline
│   │       ├── configs/[id]/
│   │       │   ├── generate-week-scripts/ # Weekly IDEAS pipeline — one-shot Opus (SSE)
│   │       │   ├── generate-strategy/     # Strategy pipeline (SSE)
│   │       │   ├── generate-voice-profile/# Voice profile extraction
│   │       │   ├── chat/                  # Per-config helper chat
│   │       │   ├── finish-chat/           # Voice/onboarding completion (Haiku, submit_scripts)
│   │       │   ├── voice-training/        # Training-script CRUD per client
│   │       │   ├── voice-sessions/        # Voice agent session storage
│   │       │   ├── story-strategies/      # Instagram Story strategy generation
│   │       │   ├── performance/           # Performance data
│   │       │   ├── refresh-posts/         # Re-scrape client's own posts
│   │       │   ├── research-creators/     # Suggest competitor creators
│   │       │   ├── reorganize-info/       # Profile-info reorganize (Haiku)
│   │       │   ├── add-info/              # Profile-info add (Haiku)
│   │       │   ├── enrich/                # Auto-fill profile from socials
│   │       │   ├── instagram-profile/     # IG profile fetch
│   │       │   └── sync-drive/            # Google Drive sync
│   │       ├── carousel/                  # Carousel generator + chat refine
│   │       ├── ideas/                     # Ideas CRUD
│   │       ├── scripts/                   # Scripts CRUD + feedback + release
│   │       ├── analyse/                   # Single-creator analysis (SSE)
│   │       ├── inngest/                   # Inngest background jobs
│   │       └── jobs/
│   │           └── research-cycle/        # Background research orchestrator
│   ├── lib/                               # Core logic
│   │   ├── auth.ts                       # Auth helpers (getCurrentUser, requireAdmin, etc.)
│   │   ├── pipeline.ts                   # Video analysis pipeline orchestration
│   │   ├── pipelines/
│   │   │   ├── weekly-oneshot.ts         # One-shot Opus weekly idea generator
│   │   │   └── weekly-steps.ts           # Shared context/voice/research loaders
│   │   ├── pipeline-lock.ts              # Per-client pipeline lock (prevents parallel runs)
│   │   ├── voice-profile.ts              # Voice + script structure extraction
│   │   ├── voice-onboarding.ts           # Voice onboarding synthesis
│   │   ├── agent-tools.ts               # Content Agent tool implementations (13 tools + admin list_clients)
│   │   ├── models.ts                    # Centralized model IDs (MODEL_HAIKU/SONNET/OPUS) + AGENT_ITERATION_LIMIT
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
│   ├── loader.ts                         # buildPrompt() — loads agent + resolves {{placeholders}}; throws in dev on missing placeholder
│   ├── tools/                            # Anthropic tool schemas split by domain
│   │   ├── index.ts                      # Re-export of all tool schemas
│   │   ├── strategy.ts                   # WEEKLY_IDEAS / TREND_RESEARCH / STRATEGY_*
│   │   ├── voice.ts                      # VOICE_PROFILE / SCRIPT_STRUCTURE / VOICE_AGENT_GEMINI_TOOLS
│   │   ├── agent.ts                      # AGENT_* (Content Agent tools)
│   │   ├── carousel.ts                   # CAROUSEL_UPDATE_TOOL
│   │   ├── story.ts                      # STORY_STRATEGY_TOOL
│   │   └── enrich.ts                     # ENRICH_PROFILE_TOOL
│   ├── analysis.ts                       # Gemini video analysis prompts
│   ├── agents/                           # Agent templates (each exists as foo.md = de + foo.en.md = en)
│   │   ├── weekly-ideas.md               # One-shot Opus week idea generator
│   │   ├── trend-research.md             # Sonnet trend synthesis
│   │   ├── content-agent.md              # Content Agent system prompt (writes scripts inline)
│   │   ├── carousel-generator.md         # Carousel slides
│   │   ├── carousel-react-generator.md   # React-based carousel
│   │   ├── carousel-chat-refine.md       # Carousel refine chat
│   │   ├── story-strategist.md           # Story strategist
│   │   ├── voice-profile.md              # Voice profile extraction
│   │   ├── voice-profile-topic.md        # Voice agent topic sub-prompt
│   │   ├── voice-profile-scenario.md     # Voice agent scenario sub-prompt
│   │   ├── voice-agent.md                # Voice interview agent
│   │   ├── voice-agent-onboarding.md     # Voice onboarding (8-block interview)
│   │   ├── script-structure.md           # Script structure extraction
│   │   ├── strategy-analysis.md
│   │   ├── strategy-creation.md
│   │   └── strategy-review.md
│   └── foundational/                     # 25 sub-prompts (single-concern .md, de + .en.md pairs)
│       ├── rolle-skriptschreiber.md
│       ├── hook-regeln.md · hook-muster.md · hook-framework.md · text-hook-regeln.md
│       ├── body-regeln.md · cta-regeln.md · konkretion-regeln.md · titel-regeln.md
│       ├── abwechslung-regeln.md · storytelling-formel.md · meinungs-injektion.md
│       ├── verboten-ai-sprache.md · anti-ai-checkliste.md · sprach-stil.md
│       ├── anti-monotone-formatierung.md · natuerliche-satzstruktur.md
│       ├── chat-admin-mode.md · chat-admin-scoped.md · chat-client-scoped.md
│       ├── audit-nutzung.md
│       └── themen-spezifizitaet.md · wochen-koherenz.md · anti-muster.md
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
