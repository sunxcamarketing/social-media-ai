# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Is

**Social Media AI** — a system that helps create viral Instagram Reels by analyzing competitor content. It scrapes competitors' recent videos, identifies the most viral ones, analyzes them with AI (video understanding + content breakdown), and generates new adapted video concepts for the user's brand.

Originally built as an n8n workflow ("Million Dollar Virality System"), now implemented as a **Next.js local app**.

---

## How to Run

```bash
cd app
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

1. **Input** — User selects a config and parameters (max videos, top-K, days lookback) via the Run page
2. **Load Config** — Retrieve analysis prompt, new concepts prompt, and creator list from CSV
3. **Scrape** — For each competitor creator, scrape recent Instagram Reels via Apify
4. **Filter & Rank** — Filter by date, sort by views, take top-K most viral
5. **Analyze** — Download video, upload to Gemini, analyze (extracts Concept, Hook, Retention, Reward, Script)
6. **Generate** — Send analysis + brand context to Claude for adapted video concepts
7. **Save** — Append results to `data/videos.csv`, viewable in the Videos page with thumbnails

### Two Customizable Prompts Per Config

- **Analysis Instruction** — How Gemini should break down the video
- **New Concepts Instruction** — How Claude should adapt the reference for the brand

---

## Workspace Structure

```
.
├── CLAUDE.md                              # This file
├── .env                                   # API keys (not committed)
├── app/                                   # Next.js application
│   ├── src/
│   │   ├── app/                           # Pages and API routes
│   │   │   ├── (app)/                     # App route group (sidebar, topbar)
│   │   │   │   ├── page.tsx               # Dashboard
│   │   │   │   ├── clients/               # Client management pages
│   │   │   │   ├── videos/page.tsx        # Videos browser with thumbnails
│   │   │   │   ├── run/page.tsx           # Pipeline runner with live progress
│   │   │   │   ├── configs/page.tsx       # Config management
│   │   │   │   └── creators/page.tsx      # Creator management
│   │   │   ├── (landing)/                 # Landing page route group (no sidebar)
│   │   │   │   └── audit/page.tsx         # Leadmagnet: Instagram Profil-Audit
│   │   │   └── api/                       # API routes (configs, creators, videos, pipeline, audit)
│   │   ├── lib/                           # Core logic
│   │   │   ├── pipeline.ts               # Pipeline orchestration
│   │   │   ├── apify.ts                  # Apify scraper client
│   │   │   ├── gemini.ts                 # Gemini video analysis client
│   │   │   ├── claude.ts                 # Claude concept generation client
│   │   │   ├── csv.ts                    # CSV read/write utilities
│   │   │   └── types.ts                  # TypeScript interfaces
│   │   └── components/                    # UI components (shadcn + custom)
│   └── package.json
├── data/                                  # CSV data storage
│   ├── configs.csv                        # Pipeline configurations
│   ├── creators.csv                       # Instagram creator accounts
│   ├── videos.csv                         # Analyzed video results
│   └── leads.csv                          # Leadmagnet audit submissions
├── context/                               # Background context for Claude
├── plans/                                 # Implementation plans
├── .claude/commands/                      # Slash commands (prime, create-plan, implement)
├── Instagram Viral Searcher.json          # n8n main workflow (reference)
├── Instagram Viral Searcher Sub.json      # n8n sub-workflow (reference)
└── Million Dollar Virality System Videos.csv  # Sample output from n8n
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
| **Audit** | `/audit` | (landing) | Leadmagnet: Instagram Profil-Audit mit KI-Report |

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
1. Does this change add new functionality users need to know about?
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

# currentDate
Today's date is 2026-03-06.
