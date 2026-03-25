# Current Data

## Data Storage

Primary storage is Supabase (migrated from CSV). Legacy CSV files in `data/` may still exist.

| Table | Purpose |
|-------|---------|
| `configs` | Client configurations — brand, strategy, voice profile, prompts |
| `creators` | Instagram creator accounts to scrape |
| `videos` | Analyzed video results with metrics and AI output |
| `scripts` | Generated scripts (hook, body, CTA, metadata) |
| `training_scripts` | Client training transcripts for voice/structure learning |
| `analyses` | Audit reports per client |

## What The Pipeline Produces

**Video Analysis:**
- Metrics: views, likes, comments
- Analysis: Concept, Hook, Retention, Reward, Script (from Gemini)
- New Concepts: Adapted video ideas for the target brand (from Claude)

**Strategy:**
- Strategic goal (reach / trust / revenue) with data-driven reasoning
- 3-5 content pillars with 4-6 video ideas each
- Weekly schedule mapping days to content types, formats, and pillars

**Scripts:**
- Title, Hook, Body, CTA — each as separate fields
- Pillar, content type, format, reasoning metadata
- Hook pattern tracking (which patterns have been used)
- Voice-matched to client's speaking style
