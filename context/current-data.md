# Current Data

## Current State

- **n8n version**: Fully built and operational. Reference workflows are in the repo as JSON files.
- **Code version**: Not yet started. Planning phase.
- **Sample output**: `Million Dollar Virality System Videos.csv` contains example output from the n8n system showing the kind of data the pipeline produces (links, views, likes, comments, AI analysis, new concepts).

## Reference Files

| File | Purpose |
|------|---------|
| `Instagram Viral Searcher.json` | n8n main workflow — form input, config lookup, creator loop |
| `Instagram Viral Searcher Sub.json` | n8n sub-workflow — scrape, rank, download, analyze, generate, save |
| `Million Dollar Virality System Videos.csv` | Sample output data showing what the system produces |

## Key Metrics From Sample Data

The system analyzes videos with metrics like views, likes, comments and produces structured analysis (Concept, Hook, Retention Mechanisms, Reward, Script) plus adapted new concepts per video.
