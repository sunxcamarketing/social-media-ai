# Plan: Research-First Pipeline — Komplette Architektur-Überarbeitung

**Created:** 2026-04-04
**Status:** Draft
**Request:** Pipelines von Daten-Recycling zu echtem Research-First umbauen. Multi-Platform vorbereiten. UX bleibt simpel.

---

## Die 3 Säulen

1. **Multi-Platform jetzt, nicht später.** Abstraktionsschicht die IG, TikTok, LinkedIn als Module erlaubt. Kein Mono-Platform-Tool in 2026.
2. **Research vor dem Klick, nicht beim Klick.** Background-Jobs die async laufen. Wenn der User klickt, ist alles schon da. 0 Sekunden Wartezeit für Research.
3. **Client Learnings mit Confidence Scores.** Minimum N≥8 Datenpunkte, Decay mit 60-Tage Halbwertszeit, keine Garbage-Insights.

---

## Architektur-Übersicht

```
┌──────────────────────────────────────────────────────────────┐
│  BACKGROUND (Cron / nach Pipeline-Run / manuell)             │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐           │
│  │ Competitor   │ │ Trend       │ │ Performance  │           │
│  │ Refresh      │ │ Research    │ │ Feedback     │           │
│  │ (Apify)     │ │ (Brave)     │ │ (Learnings)  │           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬───────┘           │
│         └───────────────┼───────────────┘                    │
│                         ▼                                    │
│            intelligence_snapshots (Supabase)                 │
│            Frisch, timestamped, ready to use                 │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼ (schon fertig wenn User klickt)
┌──────────────────────────────────────────────────────────────┐
│  USER KLICKT — Pipeline startet SOFORT                       │
│                                                              │
│  Snapshot laden → Voice Profile → Topics → Hooks → Bodies    │
│       ↑              → QA Review → Output                    │
│  Client Learnings     (pro Platform wenn Multi-Platform)     │
│  (high-confidence)                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Teil 1: Platform-Abstraktionsschicht

### Ist-Zustand: Instagram überall hardcoded

Vollständige Analyse (Background Agent Scan):

**Prompt-Dateien (14 Dateien):**
- `content-agent.md` — "Instagram Reels Content" (Zeile 1, 11, 81)
- `hook-generation.md` — "Hook-Spezialist für Instagram Reels" (Zeile 2)
- `quality-review.md` — "Qualitätsprüfer für Instagram-Reel-Skripte" (Zeile 2)
- `strategy-analysis.md` — "Strategie-Berater für Instagram" (Zeile 2)
- `strategy-creation.md` — "Content-Architekt für Instagram" (Zeile 2)
- `topic-plan.md` — "Content-Stratege für Instagram Reels" (Zeile 2)
- `topic-script.md` — "Skriptschreiber für Instagram Reels" (Zeile 2)
- `topic-selection.md` — "Content-Stratege für Instagram Reels" (Zeile 2)
- `trend-research.md` — "auf Instagram Reels und TikTok" (Zeile 2, 9)
- `viral-hook-generation.md` — "Hook-Spezialist für Instagram Reels" (Zeile 1)
- `viral-script-critic.md` — "Skript-Kritiker für Instagram Reels" (Zeile 1)
- `viral-script-production.md` — "Reel-Regisseur und Editor" (Zeile 1)
- `viral-script-adapt.md` — Hardcoded "30-40 Sekunden / 60-80 Wörter"
- `foundational/storytelling-formel.md` — "STORYTELLING-FORMEL FÜR INSTAGRAM REELS" (Zeile 1)

**Database Schema (9 Felder):**
- `configs`: `instagram`, `igFullName`, `igBio`, `igFollowers`, `igFollowing`, `igPostsCount`, `igProfilePicUrl`, `igCategory`, `igVerified`, `igLastUpdated`
- `creators`: `reels_count_30d` (Instagram-Terminologie)
- `analyses`: `instagram_handle`, `profile_reels_30d`
- Kein `platform`-Feld in `videos`, `scripts`, `creators`

**API Routes (8 Dateien):**
- `configs/[id]/instagram-profile/route.ts` — Komplett Instagram-only
- `configs/[id]/research-creators/route.ts` — Apify Instagram Scraper
- `creators/refresh/route.ts` — `scrapeCreatorStats()` = Instagram
- `transcribe/route.ts` — Apify Instagram Scraper
- `strategy/analyze-link/route.ts` — Regex matched nur `instagram.com`
- `viral-script/route.ts` — `scrapeSinglePost` = Instagram
- `analyse/route.ts` — Instagram Apify
- `verify-creator/route.ts` — Instagram Apify

**Library Code (4 Dateien):**
- `apify.ts` — 8x `apify~instagram-scraper` hardcoded. Komplett Instagram-only.
- `pipeline.ts` — `scrapeReels` Import, "reels" Terminologie
- `audit.ts` — `profileReels30d`
- `types.ts` — `igFullName`, `igBio`, etc. + `reelsCount30d`, `instagramHandle`

**Positiv:** `strategy.ts` hat schon Multi-Platform Formate ("Reels, TikTok, YouTube"). Config hat `tiktok`, `youtube`, `linkedin` Felder. Die Basis ist da.

### Design: Platform-Config

```typescript
// src/lib/platforms.ts

export type PlatformId = "instagram" | "tiktok" | "linkedin";

export interface PlatformConfig {
  id: PlatformId;
  label: string;
  shortLabel: string;
  contentFormats: string[];
  optimalDurations: {
    short: { min: number; max: number; label: string };
    long: { min: number; max: number; label: string };
  };
  hookStyle: string;       // Prompt-Block: wie Hooks auf dieser Platform funktionieren
  captionRules: string;    // Prompt-Block: Caption/Description Regeln
  hashtagStrategy: string; // Prompt-Block: Hashtag-Ansatz
  scraperAvailable: boolean;
}

export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  instagram: {
    id: "instagram",
    label: "Instagram Reels",
    shortLabel: "IG",
    contentFormats: ["Reel", "Carousel", "Story", "Post"],
    optimalDurations: {
      short: { min: 15, max: 40, label: "15-40 Sek" },
      long: { min: 45, max: 90, label: "45-90 Sek" },
    },
    hookStyle: "Erster Satz muss in 1.5 Sekunden fesseln. Audio UND Text-Hook gleichzeitig. Scroll-Stopper.",
    captionRules: "Max 2200 Zeichen. Erste Zeile = Neugier-Lücke. CTA am Ende.",
    hashtagStrategy: "3-5 Nischen-Hashtags, 1-2 große. Keine Spam-Tags.",
    scraperAvailable: true,
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    shortLabel: "TT",
    contentFormats: ["Video", "Photo Carousel", "LIVE"],
    optimalDurations: {
      short: { min: 7, max: 30, label: "7-30 Sek" },
      long: { min: 30, max: 60, label: "30-60 Sek" },
    },
    hookStyle: "Erste 0.5 Sekunden entscheiden. Visueller Hook dominant. Pattern Interrupt. Casual Ton.",
    captionRules: "Max 4000 Zeichen. Casual, Emojis ok. Kein Corporate-Ton.",
    hashtagStrategy: "2-3 trending Hashtags. Nischen-Tags. FYP-Optimierung.",
    scraperAvailable: true,  // Apify hat TikTok Scraper
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    shortLabel: "LI",
    contentFormats: ["Video", "Text Post", "Carousel (PDF)", "Newsletter"],
    optimalDurations: {
      short: { min: 30, max: 60, label: "30-60 Sek" },
      long: { min: 60, max: 180, label: "1-3 Min" },
    },
    hookStyle: "Erster Satz = kontroverse Aussage oder überraschende Zahl. Professionell aber nicht steril.",
    captionRules: "Max 3000 Zeichen. Absätze mit Zeilenumbrüchen. Storytelling-Format funktioniert am besten.",
    hashtagStrategy: "Max 3 Hashtags. Industry-spezifisch. Keine Trending-Tags.",
    scraperAvailable: false,
  },
};

// Baut den {{platform_context}} Block für Prompts
export function buildPlatformContext(platformId: PlatformId): string {
  const p = PLATFORMS[platformId];
  return `ZIEL-PLATFORM: ${p.label}

HOOK-REGELN FÜR ${p.label.toUpperCase()}:
${p.hookStyle}

OPTIMALE DAUER:
- Kurz: ${p.optimalDurations.short.label}
- Lang: ${p.optimalDurations.long.label}

CAPTION/BESCHREIBUNG:
${p.captionRules}

HASHTAGS:
${p.hashtagStrategy}`;
}
```

### Prompt-Migration

Alle 14 Agent-Prompts bekommen `{{platform_context}}` statt hardcoded "Instagram Reels":

```markdown
# VORHER (in jedem Agent):
Du bist ein Hook-Spezialist für Instagram Reels.

# NACHHER:
Du bist ein Hook-Spezialist für Social-Media-Video-Content.
{{platform_context}}
```

Die foundational Prompts bleiben platform-agnostisch (Sprach-Regeln, Voice Matching etc. gelten überall).

### Pipeline-Änderung

```typescript
// generate-week-scripts/route.ts
const targetPlatforms: PlatformId[] = safeJsonParse(config.targetPlatforms, ["instagram"]);

// Skripte werden pro Platform generiert
// Wenn Client IG + TikTok will: 5 Skripte × 2 Platforms = 10 Skripte
// Aber: Hooks und Bodies werden pro Platform angepasst, nicht einfach kopiert
for (const platformId of targetPlatforms) {
  const platformContext = buildPlatformContext(platformId);
  // buildPrompt("hook-generation", { platform_context: platformContext })
  // buildPrompt("body-writing", { platform_context: platformContext, ... })
}
```

### Schema-Änderungen

```sql
-- Configs: welche Platforms der Client bespielt
ALTER TABLE configs ADD COLUMN target_platforms TEXT DEFAULT '["instagram"]';

-- Scripts: auf welcher Platform dieses Skript ist
ALTER TABLE scripts ADD COLUMN platform TEXT DEFAULT 'instagram';

-- Videos: von welcher Platform gescrapt (Zukunft: TikTok Scraping)
ALTER TABLE videos ADD COLUMN platform TEXT DEFAULT 'instagram';

-- Creators: Platform-Feld (Zukunft: TikTok Creators tracken)
ALTER TABLE creators ADD COLUMN platform TEXT DEFAULT 'instagram';
```

Bestehende `ig*`-Felder bleiben vorerst — sie stören nicht und ein Rename wäre Breaking Change ohne Mehrwert.

### Aufwand

| Task | Files | Aufwand |
|------|-------|---------|
| `src/lib/platforms.ts` erstellen | 1 neu | 1h |
| 14 Agent-Prompts: "Instagram Reels" → `{{platform_context}}` | 14 `.md` | 2h |
| `buildPrompt()` Aufrufe: `platform_context` durchreichen | ~6 API routes | 2h |
| Schema-Migration: 4 ALTER TABLE | 1 SQL | 30 Min |
| `src/lib/types.ts`: `targetPlatforms` + `platform` Felder | 1 `.ts` | 15 Min |
| UI: Platform-Checkboxen in Config-Page | 1 Page | 1h |
| UI: Platform-Badge bei Skripten | 1 Component | 30 Min |

**Gesamt: ~1 Tag**

---

## Teil 2: Background Research (vor dem Klick)

### Prinzip

Research darf NICHT beim Klick passieren. Der User öffnet die Run-Page und sieht: "Daten sind frisch. Klick und los."

### Snapshot-Tabelle

```sql
CREATE TABLE intelligence_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('competitor_refresh', 'web_trends', 'performance_feedback')),
  platform TEXT DEFAULT 'instagram',
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_snapshots_lookup 
  ON intelligence_snapshots(client_id, type, platform, created_at DESC);
```

### 3 Background Jobs

#### Job 1: Competitor Refresh

```typescript
// src/lib/jobs/competitor-refresh.ts

export async function refreshCompetitors(clientId: string) {
  const config = await readConfig(clientId);
  const creators = await getCreatorsForConfig(config.configName);
  
  // Top-5 nach Follower-Zahl, letzte 7 Tage, max 5 Videos pro Creator
  const topCreators = creators
    .sort((a, b) => b.followers - a.followers)
    .slice(0, 5);
  
  const results = [];
  for (const creator of topCreators) {
    try {
      const reels = await scrapeReels(creator.username, { maxResults: 5, daysBack: 7 });
      results.push({ creator: creator.username, videos: reels });
      // Auch in videos-Tabelle speichern für langfristiges Tracking
    } catch {
      results.push({ creator: creator.username, videos: [], error: true });
    }
  }
  
  await saveSnapshot(clientId, "competitor_refresh", {
    creators: results,
    totalVideos: results.reduce((sum, r) => sum + r.videos.length, 0),
    scrapedAt: new Date().toISOString(),
  });
}
```

**Trigger:** Alle 3 Tage per Cron + nach jedem Pipeline-Run + manuell via Button
**Kosten:** ~5 Apify-Runs pro Client. Bei 4 Clients alle 3 Tage = ~7 Runs/Tag. Minimal.

#### Job 2: Web Trends

```typescript
// src/lib/jobs/trend-refresh.ts

export async function refreshTrends(clientId: string) {
  const config = await readConfig(clientId);
  const niche = config.creatorsCategory || "Social Media";
  
  const trends = await searchTrends(niche);  // Brave Search (schon gebaut)
  
  await saveSnapshot(clientId, "web_trends", {
    niche,
    searches: trends,
    totalResults: trends.reduce((sum, t) => sum + t.results.length, 0),
  });
}
```

**Trigger:** Täglich nachts + manuell
**Kosten:** 3 Brave Queries pro Client/Tag = nichts.

#### Job 3: Performance Feedback + Learning Extraction

```typescript
// src/lib/jobs/performance-feedback.ts

export async function analyzePerformanceFeedback(clientId: string) {
  const scripts = await readScriptsByClient(clientId);
  const config = await readConfig(clientId);
  const insights = parseInsights(config.performanceInsights);
  
  if (!insights) {
    return saveSnapshot(clientId, "performance_feedback", {
      status: "no_performance_data",
    });
  }
  
  // Match scripts to performance (über Titel/Datum/URL)
  const matched = matchScriptsToPerformance(scripts, insights);
  
  // Snapshot: Was lief letzte Woche gut/schlecht
  const lastWeek = matched.filter(s => isWithinDays(s.createdAt, 14));
  await saveSnapshot(clientId, "performance_feedback", {
    status: matched.length >= 8 ? "sufficient_data" : "insufficient_data",
    matchedCount: matched.length,
    lastWeekCount: lastWeek.length,
    topPerformers: lastWeek.sort((a, b) => b.views - a.views).slice(0, 3),
    worstPerformers: lastWeek.sort((a, b) => a.views - b.views).slice(0, 3),
  });
  
  // Learning Extraction (nur wenn N >= 8)
  if (matched.length >= 8) {
    await extractLearnings(clientId, matched);  // → siehe Teil 3
  }
}
```

**Trigger:** Wöchentlich + nach Pipeline-Run
**Kosten:** Nur DB-Queries, kein API-Call.

### Job-Orchestrator + API

```typescript
// src/app/api/jobs/research-cycle/route.ts

export async function POST(request: Request) {
  // Auth: nur mit JOB_SECRET oder Admin-User
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.JOB_SECRET}`) {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  
  const { clientId } = await request.json();
  
  // Alle 3 Jobs parallel
  const results = await Promise.allSettled([
    refreshCompetitors(clientId),
    refreshTrends(clientId),
    analyzePerformanceFeedback(clientId),
  ]);
  
  return Response.json({
    competitor: results[0].status,
    trends: results[1].status,
    feedback: results[2].status,
  });
}
```

### Cron-Setup

**Empfohlen: Option C (Post-Pipeline Trigger) als Start, Vercel Cron später.**

```typescript
// Am Ende von generate-week-scripts/route.ts, nach "done" Event:
// Fire-and-forget: nächsten Research-Cycle vorbereiten
fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/research-cycle`, {
  method: "POST",
  headers: { 
    "Authorization": `Bearer ${process.env.JOB_SECRET}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ clientId: id }),
}).catch(() => {}); // Ignoriere Fehler — Research ist nicht pipeline-kritisch
```

Später (mit Vercel Pro): Cron-Jobs hinzufügen für regelmäßige Aktualisierung.

### Pipeline liest Snapshots

```typescript
// generate-week-scripts/route.ts — STEP 2.5 wird zu:
sendEvent(controller, { step: "research", status: "loading" });

const [trendSnap, compSnap, feedbackSnap] = await Promise.all([
  getLatestSnapshot(id, "web_trends"),
  getLatestSnapshot(id, "competitor_refresh"),
  getLatestSnapshot(id, "performance_feedback"),
]);

// Freshness-Info für UI
sendEvent(controller, { 
  step: "research", 
  status: "done",
  freshness: {
    trends: trendSnap ? { age: trendSnap.created_at, fresh: !isOlderThan(trendSnap.created_at, 3) } : null,
    competitors: compSnap ? { age: compSnap.created_at, fresh: !isOlderThan(compSnap.created_at, 5) } : null,
    performance: feedbackSnap ? { age: feedbackSnap.created_at, fresh: !isOlderThan(feedbackSnap.created_at, 7) } : null,
  },
});

// Snapshot-Daten in Prompt-Blöcke umwandeln
const trendBlock = trendSnap ? buildTrendBlockFromSnapshot(trendSnap.data) : "";
const competitorBlock = compSnap ? buildCompetitorBlockFromSnapshot(compSnap.data) : "";
const feedbackBlock = feedbackSnap ? buildFeedbackBlockFromSnapshot(feedbackSnap.data) : "";
```

### UX: Freshness-Indikator auf Run-Page

```
┌──────────────────────────────────────────────┐
│  Daten-Status                                │
│                                              │
│  Competitors:  ● frisch  (vor 1 Tag)         │
│  Trends:       ● frisch  (vor 8h)            │
│  Performance:  ○ veraltet (12 Tage)          │
│                                              │
│  [↻ Aktualisieren]                           │
│                                              │
│  [▶ Woche generieren]                        │
└──────────────────────────────────────────────┘
```

- Grüner Punkt = frisch (< Schwellwert)
- Grauer Punkt = veraltet oder keine Daten
- "Aktualisieren" = manueller Research-Cycle (für alle 3)
- "Woche generieren" = startet sofort, nutzt vorhandene Snapshots

### Aufwand

| Task | Files | Aufwand |
|------|-------|---------|
| `intelligence_snapshots` Tabelle | 1 SQL | 15 Min |
| `src/lib/intelligence.ts` (Snapshot CRUD, Freshness) | 1 neu | 1h |
| Job: `competitor-refresh.ts` | 1 neu | 3h |
| Job: `trend-refresh.ts` | 1 neu | 30 Min |
| Job: `performance-feedback.ts` | 1 neu | 2h |
| API: `research-cycle/route.ts` + Auth | 1 neu | 1h |
| Pipeline umbauen: Snapshots statt Live | 2 Routes | 2h |
| Post-Pipeline Trigger | 2 Routes | 30 Min |
| UI: Freshness-Indikator | 1 Component | 1.5h |
| UI: "Aktualisieren" Button + Loading | 1 Component | 30 Min |

**Gesamt: ~1.5 Tage**

---

## Teil 3: Client Learnings mit Confidence Scoring

### Prinzip

Kein Learning ohne statistische Basis. Jedes Insight braucht:
- **Minimum N≥8** Datenpunkte
- **Confidence Score** (0.0 - 1.0)
- **Decay**: Alte Daten verlieren Gewicht (Halbwertszeit 60 Tage)
- **Threshold**: Nur Insights ≥ 0.4 Confidence fließen in Pipelines

### Schema

```sql
CREATE TABLE client_learnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
  
  -- Was wurde gelernt?
  category TEXT NOT NULL CHECK (category IN (
    'hook_pattern', 'content_type', 'format', 'pillar', 'duration', 'topic_angle'
  )),
  value TEXT NOT NULL,         -- z.B. "Provokation" für hook_pattern
  insight TEXT NOT NULL,       -- Human-readable: "Provokations-Hooks performen 2.8x besser"
  direction TEXT NOT NULL CHECK (direction IN ('positive', 'negative')),
  
  -- Statistische Basis
  data_points INTEGER NOT NULL DEFAULT 0,
  supporting_points INTEGER NOT NULL DEFAULT 0,
  metric_name TEXT NOT NULL DEFAULT 'views',
  metric_avg NUMERIC,
  metric_baseline NUMERIC,
  
  -- Confidence
  confidence NUMERIC NOT NULL DEFAULT 0,
  
  -- Zeitlich
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_data_at TIMESTAMPTZ,
  
  UNIQUE(client_id, category, value, metric_name)
);

CREATE INDEX idx_learnings_client ON client_learnings(client_id, confidence DESC);
```

### Confidence-Berechnung

```typescript
// src/lib/client-learnings.ts

const MIN_DATA_POINTS = 8;
const DECAY_HALF_LIFE_DAYS = 60;
const CONFIDENCE_THRESHOLD = 0.4;

export function calculateConfidence(
  dataPoints: number,
  supportingPoints: number,
  daysSinceLastData: number,
): number {
  // Gate: unter Minimum = 0
  if (dataPoints < MIN_DATA_POINTS) return 0;

  // 1. Base: Wie konsistent ist das Pattern?
  const consistency = supportingPoints / dataPoints;
  
  // 2. Sample: Mehr Daten = mehr Vertrauen (diminishing returns nach N=30)
  const sampleFactor = Math.min(1, Math.log2(dataPoints) / Math.log2(30));
  
  // 3. Decay: Alte Daten verlieren Gewicht
  const decay = Math.pow(0.5, daysSinceLastData / DECAY_HALF_LIFE_DAYS);
  
  return Math.round(consistency * sampleFactor * decay * 100) / 100;
}

export async function getHighConfidenceLearnings(
  clientId: string,
  threshold = CONFIDENCE_THRESHOLD,
): Promise<ClientLearning[]> {
  // Recalculate confidence with current decay
  const learnings = await getAllLearnings(clientId);
  const now = Date.now();
  
  return learnings
    .map(l => ({
      ...l,
      confidence: calculateConfidence(
        l.dataPoints,
        l.supportingPoints,
        (now - new Date(l.lastDataAt).getTime()) / (1000 * 60 * 60 * 24),
      ),
    }))
    .filter(l => l.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence);
}
```

### Learning-Extraktion

```typescript
// Innerhalb von performance-feedback.ts:

async function extractLearnings(
  clientId: string,
  matched: ScriptWithPerformance[],
) {
  const baseline = avg(matched.map(s => s.views));
  
  // Analysiere jede Kategorie
  const categories: Array<{ key: keyof ScriptWithPerformance; category: string }> = [
    { key: 'hookPattern', category: 'hook_pattern' },
    { key: 'contentType', category: 'content_type' },
    { key: 'format', category: 'format' },
    { key: 'pillar', category: 'pillar' },
  ];
  
  for (const { key, category } of categories) {
    const groups = groupBy(matched, s => s[key] as string);
    
    for (const [value, group] of Object.entries(groups)) {
      if (!value || group.length < 3) continue;
      
      const groupAvg = avg(group.map(s => s.views));
      const ratio = groupAvg / baseline;
      
      // Nur signifikante Abweichungen (>1.5x oder <0.5x)
      if (ratio > 1.5 || ratio < 0.5) {
        const direction = ratio > 1 ? 'positive' : 'negative';
        const multiplier = ratio > 1 ? ratio : 1 / ratio;
        
        await upsertLearning({
          clientId,
          category,
          value,
          insight: direction === 'positive'
            ? `${value} performt ${multiplier.toFixed(1)}x besser als Durchschnitt`
            : `${value} performt ${multiplier.toFixed(1)}x schlechter als Durchschnitt`,
          direction,
          dataPoints: matched.length,
          supportingPoints: group.length,
          metricName: 'views',
          metricAvg: groupAvg,
          metricBaseline: baseline,
          lastDataAt: new Date().toISOString(),
        });
      }
    }
  }
}
```

### In der Pipeline

```typescript
// generate-week-scripts/route.ts — nach Snapshot laden:
const learnings = await getHighConfidenceLearnings(id);

const learningsBlock = learnings.length > 0 
  ? `<client_learnings>
DATENGESTÜTZTE ERKENNTNISSE (nur statistisch verifiziert):
${learnings.map(l => {
  const conf = Math.round(l.confidence * 100);
  const emoji = l.direction === 'positive' ? '↑' : '↓';
  return `${emoji} [${conf}% · N=${l.dataPoints}] ${l.insight}`;
}).join("\n")}

ANWENDUNG:
- Learnings mit ≥70% Confidence: Aktiv bevorzugen/vermeiden
- Learnings mit 40-70%: Als Tendenz behandeln, nicht als Regel
- TROTZDEM Abwechslung: Nicht NUR das machen was funktioniert hat
</client_learnings>`
  : "";
```

### Aufwand

| Task | Files | Aufwand |
|------|-------|---------|
| `client_learnings` Tabelle + Migration | 1 SQL | 15 Min |
| `src/lib/client-learnings.ts` (Confidence, Decay, CRUD) | 1 neu | 3h |
| Learning-Extraktion in Performance-Feedback Job | 1 erweitern | 2h |
| Pipeline: Learnings-Block einbauen | 2 Routes | 1h |
| Content Agent: Learnings als Tool verfügbar | 2 Files | 1h |

**Gesamt: ~1 Tag**

---

## Implementierungs-Reihenfolge

| Phase | Was | Aufwand | Abhängigkeiten |
|-------|-----|---------|---------------|
| **1** | Platform-Abstraktionsschicht | 1 Tag | Keine — Fundament für alles |
| **2** | Background Research + Snapshots | 1.5 Tage | Braucht Phase 1 für Platform-Feld in Snapshots |
| **3** | Client Learnings + Confidence | 1 Tag | Braucht Phase 2 für Performance-Feedback Job |

**Gesamt: ~3.5 Tage**

Phase 3 liefert erst echten Wert nachdem genug Performance-Daten gesammelt wurden (N≥8 Skripte mit Views). Die Infrastruktur ist aber sofort da.

---

## UX-Änderungen (Zusammenfassung)

### Für den Admin (Aysun)

**Config-Page:** Neue Checkboxen "Ziel-Platforms"
```
Ziel-Platforms:  [✓] Instagram  [✓] TikTok  [ ] LinkedIn
```

**Run-Page:** Freshness-Indikator + manueller Refresh
```
Daten-Status:
  ● Competitors: frisch (vor 1 Tag)
  ● Trends: frisch (vor 8h)  
  ○ Performance: keine Daten

[↻ Aktualisieren]    [▶ Woche generieren]
```

**Skript-Ansicht:** Platform-Badge pro Skript (IG / TT / LI)

### Für den Client (Portal)

Keine Änderung. Clients sehen ihre Skripte wie bisher. Wenn Multi-Platform aktiv: Skripte gruppiert nach Platform.

---

## Neue Files

| Datei | Zweck |
|-------|-------|
| `src/lib/platforms.ts` | Platform-Configs + `buildPlatformContext()` |
| `src/lib/intelligence.ts` | Snapshot CRUD, `getLatestSnapshot()`, `isOlderThan()` |
| `src/lib/client-learnings.ts` | Learning CRUD, `calculateConfidence()`, `getHighConfidenceLearnings()` |
| `src/lib/jobs/competitor-refresh.ts` | Background Job: Apify Scrape |
| `src/lib/jobs/trend-refresh.ts` | Background Job: Brave Search |
| `src/lib/jobs/performance-feedback.ts` | Background Job: Learning Extraction |
| `src/app/api/jobs/research-cycle/route.ts` | Job-Orchestrator API |
| `src/app/api/jobs/snapshots/route.ts` | Freshness-API für UI |

## Geänderte Files

| Datei | Änderung |
|-------|----------|
| `supabase-schema.sql` | + 2 Tabellen, + 4 ALTER TABLE |
| `prompts/agents/*.md` (14 Dateien) | "Instagram Reels" → `{{platform_context}}` |
| `prompts/foundational/storytelling-formel.md` | Platform-agnostisch |
| `src/lib/types.ts` | + `targetPlatforms`, `platform` Felder |
| `src/app/api/configs/[id]/generate-week-scripts/route.ts` | Snapshots, Learnings, Platform-Loop |
| `src/app/api/configs/[id]/generate-strategy/route.ts` | Snapshots nutzen |
| `src/lib/agent-tools.ts` | Platform-Kontext in generate_script |
| `prompts/tools.ts` | Platform-Feld in Tool-Schemas |
