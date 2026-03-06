# Plan: Migrate Virality System from n8n to Next.js Local App

**Created:** 2026-03-06
**Status:** Implemented
**Request:** Build a local Next.js app with shadcn UI that replaces the n8n workflow and Google Sheets, using CSV files for storage in the first iteration.

---

## Overview

### What This Plan Accomplishes

Builds a fully local Next.js application that replicates the entire "Million Dollar Virality System" pipeline: configure runs, manage competitor creators, trigger scraping + analysis + concept generation, and browse results — all through a clean web UI instead of n8n + Google Sheets. Data is stored in local CSV files for simplicity.

### Why This Matters

The n8n version works but is a black box — hard to debug, extend, and customize. A code-based version gives full control over the pipeline, a proper UI for managing configs and viewing results, and a foundation that can be extended later (database, deployment, new features).

---

## Current State

### Relevant Existing Structure

- `Instagram Viral Searcher.json` — n8n main workflow (form → config lookup → creator loop → sub-workflow)
- `Instagram Viral Searcher Sub.json` — n8n sub-workflow (scrape → filter → rank → download → Gemini analyze → Claude generate → save)
- `Million Dollar Virality System Videos.csv` — sample output with columns: Link, Thumbnail, Creator, Views, Likes, Comments, Analysis, New Concepts, Date Posted, Date Added, Config Name
- `context/`, `plans/`, `outputs/`, `reference/`, `scripts/` — workspace directories (mostly empty)

### Gaps or Problems Being Addressed

- No code-based pipeline exists yet — everything runs in n8n
- Google Sheets is clunky for viewing AI analysis results (long text in cells)
- No way to easily browse, search, or filter analyzed videos
- No local-first option — depends on n8n cloud + Google Sheets

---

## Proposed Changes

### Summary of Changes

- Create a Next.js 14+ app (App Router) with TypeScript in a new `app/` directory at the project root
- Build UI with shadcn/ui components (Tailwind CSS)
- Implement 3 CSV data stores: `data/configs.csv`, `data/creators.csv`, `data/videos.csv`
- Build the backend pipeline as Next.js API routes / server actions that call Apify, Gemini, and Claude APIs
- Build frontend pages: Dashboard, Configs, Creators, Videos (results browser), Run Pipeline
- Seed CSV files with sample data from the existing n8n output

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `app/package.json` | Next.js project dependencies |
| `app/tsconfig.json` | TypeScript configuration |
| `app/next.config.ts` | Next.js config |
| `app/tailwind.config.ts` | Tailwind CSS config |
| `app/postcss.config.mjs` | PostCSS config for Tailwind |
| `app/.env.local.example` | Example env file with required API keys |
| `app/src/app/layout.tsx` | Root layout with sidebar navigation |
| `app/src/app/page.tsx` | Dashboard / home page |
| `app/src/app/configs/page.tsx` | Configs management page (list, create, edit) |
| `app/src/app/creators/page.tsx` | Creators management page (list, add, edit, assign categories) |
| `app/src/app/videos/page.tsx` | Videos results browser (table with expandable analysis) |
| `app/src/app/run/page.tsx` | Run pipeline page (select config, set params, trigger, view progress) |
| `app/src/app/api/pipeline/route.ts` | API route: trigger the full pipeline |
| `app/src/app/api/configs/route.ts` | API route: CRUD for configs |
| `app/src/app/api/creators/route.ts` | API route: CRUD for creators |
| `app/src/app/api/videos/route.ts` | API route: read/filter videos |
| `app/src/lib/csv.ts` | CSV read/write utilities (using csv-parse/csv-stringify) |
| `app/src/lib/pipeline.ts` | Core pipeline logic (orchestrates the full flow) |
| `app/src/lib/apify.ts` | Apify Instagram scraper client |
| `app/src/lib/gemini.ts` | Gemini file upload + video analysis client |
| `app/src/lib/claude.ts` | Claude new concepts generation client |
| `app/src/lib/types.ts` | TypeScript types for Config, Creator, Video, PipelineParams |
| `app/src/components/ui/` | shadcn/ui components (installed via CLI) |
| `app/src/components/sidebar.tsx` | App sidebar navigation |
| `app/src/components/video-card.tsx` | Expandable video result card |
| `app/src/components/pipeline-progress.tsx` | Real-time pipeline progress display |
| `data/configs.csv` | Configs storage |
| `data/creators.csv` | Creators storage |
| `data/videos.csv` | Videos/results storage (seeded from existing CSV) |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `CLAUDE.md` | Add app structure, tech stack, how to run locally |
| `context/current-data.md` | Update to reflect code version exists |

### Files to Delete

None. The n8n JSON files stay as reference.

---

## Design Decisions

### Key Decisions Made

1. **Next.js App Router with `app/` directory at project root**: Keeps the workspace structure clean — all code lives in `app/`, workspace files (context, plans, etc.) stay at root. The Next.js app is a subdirectory, not the root.

2. **CSV files in `data/` at project root**: Simple, human-readable, git-friendly. Uses `csv-parse` and `csv-stringify` (battle-tested Node.js CSV libraries). The `data/` directory is at the workspace root so it's accessible and inspectable outside the app.

3. **shadcn/ui**: Not a dependency — it copies component source code into the project. Maximum flexibility, great defaults, works perfectly with Tailwind.

4. **Server-side pipeline execution via API routes**: The pipeline runs server-side (Node.js). The frontend polls for progress. No need for WebSockets in v1 — simple polling with status updates written to a JSON status file.

5. **Gemini for video analysis, Claude for concept generation**: Same split as the n8n version. Gemini 2.0 Flash is used because it can process video directly. Claude Sonnet is used for creative concept generation.

6. **No authentication in v1**: Local-only app, no auth needed.

7. **Pipeline progress via server-sent events (SSE)**: Simple, built-in browser support, no extra dependencies. The `/api/pipeline` route streams progress events.

### Alternatives Considered

- **SQLite instead of CSV**: More robust but adds complexity. CSV is readable, editable, and sufficient for v1. Easy to migrate later.
- **Separate backend (Express/Fastify)**: Unnecessary — Next.js API routes handle everything and keep it as one app.
- **Electron for desktop app**: Overkill for v1. `next dev` running locally is simpler and achieves the same goal.

### Open Questions

None — all resolved:
- API keys: provided in `.env` at project root (APIFY_API_TOKEN, GEMINI_API_KEY, ANTHROPIC_API_KEY)
- Package manager: npm
- Thumbnails: display Instagram Reel thumbnails visually in the Videos UI (like Google Sheets had with =IMAGE())

---

## Step-by-Step Tasks

### Step 1: Initialize Next.js Project

Create the Next.js app inside the `app/` directory with TypeScript, Tailwind CSS, and App Router.

**Actions:**

- Run `npx create-next-app@latest app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` (with default options)
- Install additional dependencies: `csv-parse`, `csv-stringify`, `uuid` (for generating IDs)
- Create `.env.local.example` with placeholder API keys

**Files affected:**

- `app/` (entire new directory)
- `app/.env.local.example`

---

### Step 2: Install and Configure shadcn/ui

Set up shadcn/ui and install core components needed for the UI.

**Actions:**

- Run `npx shadcn@latest init` inside `app/` directory
- Install components: `button`, `card`, `table`, `input`, `textarea`, `label`, `select`, `dialog`, `badge`, `tabs`, `separator`, `scroll-area`, `sheet`, `sidebar`, `collapsible`, `progress`, `skeleton`
- This gives us a full component library for the UI

**Files affected:**

- `app/src/components/ui/` (shadcn components)
- `app/components.json` (shadcn config)
- `app/src/lib/utils.ts` (cn utility)

---

### Step 3: Define TypeScript Types

Create the core data types that mirror the CSV structure and pipeline parameters.

**Actions:**

- Create `app/src/lib/types.ts` with interfaces:

```typescript
export interface Config {
  id: string;
  configName: string;
  creatorsCategory: string;
  analysisInstruction: string;
  newConceptsInstruction: string;
}

export interface Creator {
  id: string;
  username: string;
  category: string;
  platform: string; // always "instagram" for now
}

export interface Video {
  id: string;
  link: string;
  thumbnail: string;
  creator: string;
  views: number;
  likes: number;
  comments: number;
  analysis: string;
  newConcepts: string;
  datePosted: string;
  dateAdded: string;
  configName: string;
}

export interface PipelineParams {
  configName: string;
  maxVideos: number;  // max videos to scrape per creator
  topK: number;       // top videos to analyze per creator
  nDays: number;      // lookback period in days
}

export interface PipelineProgress {
  status: "idle" | "running" | "completed" | "error";
  currentCreator: string;
  currentStep: string;
  creatorsCompleted: number;
  creatorsTotal: number;
  videosAnalyzed: number;
  videosTotal: number;
  errors: string[];
  log: string[];
}
```

**Files affected:**

- `app/src/lib/types.ts`

---

### Step 4: Build CSV Utilities

Create read/write functions for the three CSV stores.

**Actions:**

- Create `app/src/lib/csv.ts` with functions:
  - `readConfigs()` / `writeConfigs(configs)` — reads/writes `data/configs.csv`
  - `readCreators()` / `writeCreators(creators)` — reads/writes `data/creators.csv`
  - `readVideos()` / `writeVideos(videos)` / `appendVideo(video)` — reads/writes/appends to `data/videos.csv`
- All functions resolve paths relative to the project root (using `process.cwd()` going up from `app/`)
- Handle file creation if CSV doesn't exist yet (write headers)
- Use `csv-parse/sync` and `csv-stringify/sync` for simplicity

**Files affected:**

- `app/src/lib/csv.ts`
- `data/configs.csv` (created with headers if missing)
- `data/creators.csv` (created with headers if missing)
- `data/videos.csv` (created with headers if missing)

---

### Step 5: Seed Data Files

Create initial CSV files with sample data so the app has content to display on first run.

**Actions:**

- Create `data/configs.csv` with one sample config (extracted from n8n pinned data):
  - Config Name: "FABODXB"
  - Creators Category: "dubai-real-estate"
  - Analysis Instruction: (the full Gemini analysis prompt from the n8n workflow)
  - New Concepts Instruction: (the full Claude prompt from the n8n workflow)
- Create `data/creators.csv` with a few sample creators:
  - username: "marcel.remus", category: "dubai-real-estate"
  - username: "urban.dxb_", category: "dubai-real-estate"
  - username: "danieldalen", category: "dubai-real-estate"
- Copy/transform `Million Dollar Virality System Videos.csv` into `data/videos.csv` with matching column headers (adding `id` column)

**Files affected:**

- `data/configs.csv`
- `data/creators.csv`
- `data/videos.csv`

---

### Step 6: Build API Clients (Apify, Gemini, Claude)

Implement the three external service clients.

**Actions:**

- Create `app/src/lib/apify.ts`:
  - `scrapeReels(username: string, maxVideos: number, nDays: number)` — calls Apify Instagram Scraper API (POST to `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items`)
  - Returns array of `{ videoUrl, url, videoPlayCount, likesCount, commentsCount, ownerUsername, images, timestamp }`
  - Uses `APIFY_API_TOKEN` from env

- Create `app/src/lib/gemini.ts`:
  - `uploadVideo(videoBuffer: Buffer, mimeType: string, fileSize: number)` — uploads video to Gemini File API
  - `analyzeVideo(fileUri: string, mimeType: string, analysisPrompt: string)` — sends video + prompt to Gemini 2.0 Flash
  - Includes retry logic (wait + retry on failure, matching the n8n 5-sec retry)
  - Uses `GEMINI_API_KEY` from env

- Create `app/src/lib/claude.ts`:
  - `generateNewConcepts(videoAnalysis: string, newConceptsPrompt: string)` — sends analysis + prompt to Claude Sonnet
  - Uses `ANTHROPIC_API_KEY` from env
  - Uses the Anthropic SDK (`@anthropic-ai/sdk`)

**Files affected:**

- `app/src/lib/apify.ts`
- `app/src/lib/gemini.ts`
- `app/src/lib/claude.ts`

---

### Step 7: Build Core Pipeline Logic

Implement the orchestration logic that ties everything together.

**Actions:**

- Create `app/src/lib/pipeline.ts`:
  - `runPipeline(params: PipelineParams, onProgress: (progress: PipelineProgress) => void)` — main entry point
  - Flow:
    1. Load config by name from CSV
    2. Load creators filtered by config's category from CSV
    3. For each creator:
       a. Call Apify to scrape reels
       b. Extract fields (videoUrl, postUrl, views, likes, comments, username, thumbnail, datePosted)
       c. Filter by date (within nDays)
       d. Sort by views descending, take top K
       e. For each top video:
          - Download video binary
          - Upload to Gemini
          - Wait briefly for processing
          - Analyze with Gemini (with retry on failure)
          - Generate new concepts with Claude
          - Append result to videos CSV
          - Update progress callback
  - Error handling: continue on individual video failure, log errors, don't stop the whole pipeline

**Files affected:**

- `app/src/lib/pipeline.ts`

---

### Step 8: Build API Routes

Create the Next.js API routes for CRUD operations and pipeline execution.

**Actions:**

- Create `app/src/app/api/configs/route.ts`:
  - GET: return all configs
  - POST: create new config
  - PUT: update config
  - DELETE: delete config by id

- Create `app/src/app/api/creators/route.ts`:
  - GET: return all creators (optionally filtered by `?category=...`)
  - POST: create new creator
  - PUT: update creator
  - DELETE: delete creator by id

- Create `app/src/app/api/videos/route.ts`:
  - GET: return videos (filterable by `?configName=...`, `?creator=...`, sorted by date added desc)

- Create `app/src/app/api/pipeline/route.ts`:
  - POST: start pipeline run (accepts PipelineParams in body)
  - Uses SSE (Server-Sent Events) to stream progress back to the client
  - The pipeline runs in the request handler, streaming progress events as it goes

**Files affected:**

- `app/src/app/api/configs/route.ts`
- `app/src/app/api/creators/route.ts`
- `app/src/app/api/videos/route.ts`
- `app/src/app/api/pipeline/route.ts`

---

### Step 9: Build Layout and Navigation

Create the app shell with sidebar navigation.

**Actions:**

- Create `app/src/components/sidebar.tsx`:
  - Navigation links: Dashboard, Configs, Creators, Videos, Run Pipeline
  - Clean sidebar using shadcn sidebar component

- Update `app/src/app/layout.tsx`:
  - Add sidebar layout wrapper
  - Set up font (Inter or Geist)
  - Page title: "Virality System"

- Update `app/src/app/globals.css`:
  - Ensure Tailwind directives are present
  - Add any custom styles needed

**Files affected:**

- `app/src/components/sidebar.tsx`
- `app/src/app/layout.tsx`
- `app/src/app/globals.css`

---

### Step 10: Build Dashboard Page

Create the home/dashboard page with summary stats.

**Actions:**

- Create `app/src/app/page.tsx`:
  - Show summary cards: total configs, total creators, total videos analyzed
  - Show recent pipeline runs / recent videos added
  - Quick action buttons: "Run New Analysis", "View Results"
  - Read data server-side using the CSV utilities

**Files affected:**

- `app/src/app/page.tsx`

---

### Step 11: Build Configs Page

Create the configs management page.

**Actions:**

- Create `app/src/app/configs/page.tsx`:
  - Table listing all configs (Config Name, Creators Category, actions)
  - "New Config" button opens a dialog/form
  - Edit button opens dialog with pre-filled form
  - Delete button with confirmation
  - Form fields: Config Name, Creators Category, Analysis Instruction (textarea), New Concepts Instruction (textarea)

**Files affected:**

- `app/src/app/configs/page.tsx`

---

### Step 12: Build Creators Page

Create the creators management page.

**Actions:**

- Create `app/src/app/creators/page.tsx`:
  - Table listing all creators (Username, Category, actions)
  - "Add Creator" button/dialog
  - Edit and delete actions
  - Filter by category dropdown
  - Form fields: Username, Category

**Files affected:**

- `app/src/app/creators/page.tsx`

---

### Step 13: Build Videos/Results Page

Create the main results browsing page — this is the most important page.

**Actions:**

- Create `app/src/app/videos/page.tsx`:
  - Filter bar: by Config Name, by Creator, date range
  - Table/card view of results with columns: Thumbnail, Creator, Views, Likes, Comments, Date Posted, Date Added, Config Name
  - Expandable rows or click-to-open detail view showing full Analysis and New Concepts (rendered as markdown)
  - Sort by views, likes, date

- Create `app/src/components/video-card.tsx`:
  - Displays a single video result
  - Shows metrics (views, likes, comments) with badges
  - Expandable sections for Analysis and New Concepts
  - Link to original Instagram post

**Files affected:**

- `app/src/app/videos/page.tsx`
- `app/src/components/video-card.tsx`

---

### Step 14: Build Run Pipeline Page

Create the page for triggering new pipeline runs.

**Actions:**

- Create `app/src/app/run/page.tsx`:
  - Config selector dropdown (loads from configs CSV)
  - Number inputs: Max Videos to Scrape (default 20), Top K to Analyze (default 3), Days Lookback (default 30)
  - "Run Pipeline" button
  - Progress display showing:
    - Current creator being processed
    - Current step (scraping, downloading, analyzing, generating)
    - Progress bar (creators completed / total)
    - Live log of events
    - Error messages if any
  - Uses SSE to receive real-time progress from the API

- Create `app/src/components/pipeline-progress.tsx`:
  - Reusable progress display component
  - Shows animated steps, log entries, and completion state

**Files affected:**

- `app/src/app/run/page.tsx`
- `app/src/components/pipeline-progress.tsx`

---

### Step 15: Update Documentation

Update CLAUDE.md and context to reflect the new app structure.

**Actions:**

- Update `CLAUDE.md`:
  - Add "How to Run" section: `cd app && npm install && npm run dev`
  - Add required env vars section
  - Update workspace structure to include `app/` and `data/`
  - Add tech stack section

- Update `context/current-data.md`:
  - Change status from "not started" to "v1 implemented"

**Files affected:**

- `CLAUDE.md`
- `context/current-data.md`

---

## Connections & Dependencies

### Files That Reference This Area

- `CLAUDE.md` — documents workspace structure and pipeline description
- `context/current-data.md` — tracks project state
- `context/strategy.md` — references the migration as priority #1

### Updates Needed for Consistency

- `CLAUDE.md` must be updated with the new `app/` and `data/` directories, tech stack, and run instructions
- `context/current-data.md` must reflect that v1 is implemented

### Impact on Existing Workflows

- No existing code workflows are affected (there are none yet)
- The n8n JSON files remain as reference and are not modified
- The existing CSV sample file will be transformed into the `data/videos.csv` seed data

---

## Validation Checklist

- [ ] `cd app && npm install` completes without errors
- [ ] `cd app && npm run dev` starts the dev server on localhost:3000
- [ ] Dashboard page loads and shows summary stats from CSV data
- [ ] Configs page: can list, create, edit, delete configs (persisted to CSV)
- [ ] Creators page: can list, add, edit, delete creators (persisted to CSV)
- [ ] Videos page: shows seeded data with expandable analysis/concepts
- [ ] Videos page: filtering by config name and creator works
- [ ] Run page: form loads configs from CSV, parameters have defaults
- [ ] Run page: triggering pipeline calls APIs correctly (tested with real keys)
- [ ] Pipeline: Apify scraping returns video data
- [ ] Pipeline: Gemini upload + analysis works on downloaded video
- [ ] Pipeline: Claude concept generation returns adapted concepts
- [ ] Pipeline: results are appended to `data/videos.csv`
- [ ] Pipeline: progress SSE stream updates the UI in real-time
- [ ] CLAUDE.md updated with new structure and run instructions
- [ ] All TypeScript compiles without errors (`npm run build`)

---

## Success Criteria

The implementation is complete when:

1. The Next.js app runs locally and provides a full UI for managing configs, creators, and browsing analyzed video results
2. The pipeline can be triggered from the UI, scrapes Instagram via Apify, analyzes videos with Gemini, generates concepts with Claude, and saves results to CSV
3. The existing n8n sample data is visible in the videos browser as seeded data
4. All CRUD operations persist to CSV files in the `data/` directory

---

## Notes

- **Future iterations** could add: SQLite/Postgres database, user authentication, deployment to Vercel, batch scheduling, video preview playback, export to various formats, comparison views across configs
- **Rate limits**: Apify's sync endpoint can be slow for large scrapes. Gemini file upload has size limits. The pipeline processes creators sequentially and videos within each creator sequentially to avoid hitting rate limits.
- **Video download size**: Instagram Reels can be large. The pipeline downloads to memory (Buffer), uploads to Gemini, then discards. No local file storage of videos.
- **The analysis and new_concepts prompts from the n8n pinned data** are long and detailed. They'll be stored as-is in the configs CSV. The textarea fields in the UI should be large enough to edit them comfortably.
