# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Is

**Social Media AI** — a tool that helps create viral Instagram Reels by analyzing competitor content. It scrapes competitors' recent videos, identifies the most viral ones, analyzes them with AI (video understanding + content breakdown), and generates new adapted video concepts for a given brand.

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

---

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** components
- **CSV files** for data storage (in `data/` directory)
- **Apify** — Instagram scraping
- **Google Gemini 2.0 Flash** — Video analysis (upload + multimodal)
- **Claude Sonnet** — New concept generation

---

## How The System Works

### Pipeline Overview

1. **Input** — Select a config and parameters (max videos, top-K, days lookback) via the Run page
2. **Load Config** — Retrieve analysis prompt, new concepts prompt, and creator list from CSV
3. **Scrape** — For each competitor creator, scrape recent Instagram Reels via Apify
4. **Filter & Rank** — Filter by date, sort by views, take top-K most viral
5. **Analyze** — Download video, upload to Gemini, analyze (extracts Concept, Hook, Retention, Reward, Script)
6. **Generate** — Send analysis + brand context to Claude for adapted video concepts
7. **Save** — Append results to `data/videos.csv`, viewable in the Videos page with thumbnails

### Strategy Generation Pipeline — Multi-Step SSE Pipeline

1. **Load Context** — Client profile, audit, performance, competitors, voice profile (no data truncation)
2. **Data Analysis & Goal** — Single Claude call analyzing all data, extracting structured insights, determining reach/trust/revenue goal
3. **Strategy Creation** — Single Claude call creating 3-5 content pillars with 4-6 structured video ideas each + weekly plan
4. **Strategy Review** — Single Claude call checking consistency, voice-format match, subtopic quality. Applies corrections.
5. **Stream to User** — SSE events show real-time progress: analysis → strategy → review

Key endpoint: `POST /api/configs/[id]/generate-strategy` (SSE stream)
Prompts: `src/lib/prompts/strategy-analysis.ts`, `strategy-creation.ts`, `strategy-review.ts`

### Script Generation Pipeline (Weekly) — Multi-Step SSE Pipeline

1. **Load Context** — Client profile, brand positioning, strategy, audit report, performance data, competitor videos
2. **Voice Profile** — Extract/cache structured voice profile from training transcripts (tone, energy, favorite words, sentence patterns)
3. **Topic Selection** — Focused Claude call selecting N strategic topics based on audit + performance data only
4. **Hook Generation** — N parallel Claude calls, each producing 3 hook options and selecting the best (focused on first 3 seconds only)
5. **Body Writing** — N parallel Claude calls, each writing body + CTA with voice profile matching (no audit/competitor context — just voice + brand + topic)
6. **Quality Review** — Single Claude call reviewing all scripts for AI language, voice match, and week coherence. Applies corrections.
7. **Stream to User** — SSE events show real-time progress: steps completing, scripts appearing one by one

Key endpoint: `POST /api/configs/[id]/generate-week-scripts` (SSE stream)
Voice profile: `POST /api/configs/[id]/generate-voice-profile`

### Two Customizable Prompts Per Config

- **Analysis Instruction** — How Gemini should break down the video
- **New Concepts Instruction** — How Claude should adapt the reference for the brand

---

## Workspace Structure

```
.
├── CLAUDE.md                              # This file
├── .env                                   # API keys (not committed)
├── src/
│   ├── app/                               # Pages and API routes
│   │   ├── (app)/                         # App route group (sidebar, topbar)
│   │   │   ├── page.tsx                   # Dashboard
│   │   │   ├── clients/                   # Client management pages
│   │   │   ├── configs/                   # Config management
│   │   │   ├── strategy/                  # Strategy page
│   │   │   ├── training/                  # Training page
│   │   │   └── transcribe/               # Transcribe page
│   │   └── api/                           # API routes (configs, creators, videos, pipeline)
│   ├── lib/                               # Core logic
│   │   ├── pipeline.ts                   # Pipeline orchestration
│   │   ├── apify.ts                      # Apify scraper client
│   │   ├── gemini.ts                     # Gemini video analysis client
│   │   ├── claude.ts                     # Claude concept generation client
│   │   ├── csv.ts                        # CSV read/write utilities
│   │   ├── prompts/                      # Modular prompt system
│   │   └── types.ts                      # TypeScript interfaces
│   └── components/                        # UI components (shadcn + custom)
├── data/                                  # CSV data storage
│   ├── configs.csv                        # Pipeline configurations
│   ├── creators.csv                       # Instagram creator accounts
│   ├── videos.csv                         # Analyzed video results
│   ├── scripts.csv                        # Generated scripts
│   └── training-scripts.csv              # Training script examples
├── context/                               # Background context for Claude
├── plans/                                 # Implementation plans
├── package.json
└── .claude/commands/                      # Slash commands (prime, create-plan, implement)
```

---

## App Pages

| Page | Path | Route Group | Description |
|------|------|-------------|-------------|
| Dashboard | `/` | (app) | Summary stats, recent videos |
| Videos | `/videos` | (app) | Browse results with thumbnails, expandable analysis & concepts |
| Run Pipeline | `/run` | (app) | Select config, set params, run with live progress streaming |
| Configs | `/configs` | (app) | CRUD for pipeline configs (prompts, categories) |
| Creators | `/creators` | (app) | CRUD for competitor Instagram accounts |

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
