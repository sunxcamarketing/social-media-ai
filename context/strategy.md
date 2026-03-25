# Strategy

## Current Status (2026-03-25)

The platform is fully functional with three main pipelines:

1. **Video Analysis Pipeline** — Scrape competitors, analyze with Gemini, generate adapted concepts with Claude
2. **Strategy Generation Pipeline** — Multi-step SSE: data analysis → pillar creation → review
3. **Script Generation Pipeline** — Multi-step SSE: voice profile → trends → topics → hooks (parallel) → bodies (parallel) → quality review

All pipelines are production-ready and deployed locally.

## Recent Architecture Change: Modular Prompt System

Migrated from TypeScript template literals to **markdown-based modular prompts** (inspired by Authority AI platform):

- **13 agent templates** in `prompts/agents/` — one per pipeline step (top-level for instant access)
- **21 foundational sub-prompts** in `prompts/foundational/` — single-concern reusable modules
- **`buildPrompt()`** assembles them at runtime by resolving `{{placeholder}}` references
- **Tool schemas** consolidated in `prompts/tools.ts`

This makes prompt management dramatically easier — each `.md` file handles one concern, is human-reviewable, and changes propagate everywhere the module is used.

## Key Quality Features

- **100+ banned German AI phrases** across 12 categories (the largest prompt module)
- **Voice profile matching** — scripts sound like the actual client, not generic AI
- **Script structure learning** — extracts dramaturgic patterns from client's training scripts
- **Hook/Retain/Reward framework** — psychological framework for scroll-stopping content
- **Anti-monotonous formatting** — prevents the "one sentence per line" AI tell
- **Trend research** — injects fresh ideas to prevent closed-loop recycling of past data

## Next Steps

- Test full pipeline end-to-end with real client data
- Improve training script ingestion (Google Drive sync)
- Consider a `/prompts` admin page for non-technical prompt editing
- Add prompt versioning or A/B testing capability
