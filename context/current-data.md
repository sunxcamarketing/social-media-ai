# Current Data

## Data Files

| File | Purpose |
|------|---------|
| `data/configs.csv` | Pipeline configurations (prompts, categories) |
| `data/creators.csv` | Instagram creator accounts to scrape |
| `data/videos.csv` | Analyzed video results with metrics and AI output |

## What The Pipeline Produces

Each video entry includes:
- **Metrics**: views, likes, comments
- **Analysis**: Concept, Hook, Retention Mechanisms, Reward, Script (from Gemini)
- **New Concepts**: Adapted video ideas for the target brand (from Claude)
- **Metadata**: creator, link, thumbnail, dates, config name
