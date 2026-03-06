# Strategy

## Current Focus Period

Q1 2026 — Migration and enhancement of the virality system.

## Strategic Priorities

1. **Migrate from n8n to code** — Rebuild the Instagram Viral Searcher pipeline as a standalone application with full control over the logic
2. **Maintain feature parity** — Ensure the code version does everything the n8n version did (scrape, filter, rank, analyze with Gemini, generate concepts with Claude, save results)
3. **Improve and extend** — Once parity is achieved, add capabilities that were hard to do in n8n

## What Success Looks Like

- A working code-based pipeline that can take a config, scrape competitors, analyze top viral videos, generate new concepts, and output results
- Easy to configure for different clients (different creators, prompts, parameters)
- Reliable and debuggable compared to the n8n version

## Key Decisions / Open Questions

- Tech stack choice (language, framework, storage format)
- How to handle configuration (files, database, CLI args?)
- Whether to keep Google Sheets integration or move to local/other storage
- How to handle the video download + Gemini upload flow efficiently
