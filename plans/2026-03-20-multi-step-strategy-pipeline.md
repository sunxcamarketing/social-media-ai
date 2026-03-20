# Plan: Multi-Step Strategy Generation Pipeline

**Created:** 2026-03-20
**Status:** Implemented (3-step version: Analysis+Goal → Strategy → Review)
**Request:** Rebuild monolithic strategy generation into a multi-step SSE streaming pipeline with focused prompts, full data utilization, and voice profile integration.

---

## Overview

### What This Plan Accomplishes

Replaces the single-Claude-call strategy generation with a 5-step SSE streaming pipeline: (1) Data Analysis, (2) Goal Determination, (3) Pillar Definition, (4) Weekly Plan, (5) Strategy Review. Each step gets focused context, data is used without truncation, and the user sees live progress. The strategy output becomes more concrete — especially subtopics — which directly improves downstream script generation.

### Why This Matters

The current strategy call dumps client profile, audit (truncated to 3000 chars), performance, competitors (truncated to 400 chars per analysis), and training scripts all into one prompt. Claude can't focus on everything simultaneously — resulting in generic pillars, vague subtopics, and shallow data usage. The script pipeline already proved that splitting into focused steps dramatically improves output quality. The strategy is the foundation for everything downstream — if pillars are vague, scripts will be vague.

---

## Current State

### Relevant Existing Structure

| File | Role |
|------|------|
| `src/app/api/configs/[id]/generate-strategy/route.ts` | Single monolithic Claude call (297 lines) |
| `src/app/(app)/clients/[id]/strategy/page.tsx` | Frontend — fire-and-forget fetch, no SSE (754 lines) |
| `src/lib/prompts/strategy-generation.ts` | Interface-only documentation (30 lines) |
| `src/lib/strategy.ts` | BUILT_IN_CONTENT_TYPES (10) + BUILT_IN_FORMATS (14) |
| `src/context/generation-context.tsx` | State management for strategy/analysis/enrich generation tasks |
| `src/app/api/configs/[id]/generate-week-scripts/route.ts` | SSE streaming reference implementation (563 lines) |
| `src/app/(app)/clients/[id]/scripts/page.tsx` | SSE consumer reference (760 lines) |
| `src/lib/voice-profile.ts` | Voice profile read/generate/format |
| `src/lib/prompts/scripting.ts` | AUDIT_USAGE_RULES, TOPIC_SPECIFICITY_RULES |
| `src/lib/prompts/quality.ts` | ANTI_PATTERNS, CONCRETENESS_RULES |

### Gaps or Problems Being Addressed

1. **Kitchen Sink Prompt**: All context crammed into 1 call → pillars become generic, data usage is shallow
2. **Data Truncation**: Audit report cut to 3000 chars, competitor analyses to 400 chars → concrete insights lost
3. **No Voice Awareness**: Strategy doesn't know how client speaks → pillars/formats may not match their style
4. **Vague Subtopics**: `subTopics` is a free-text string like "3-4 konkrete Themenideen" → downstream topic selection has little to work with
5. **No Progress Feedback**: User stares at spinner for 15-30 seconds with no indication of progress
6. **No Quality Gate**: Strategy output is never reviewed — inconsistencies pass through silently
7. **Weak Strategy→Scripts Bridge**: Subtopics don't carry enough detail to guide topic selection effectively
8. **Training Scripts Wasted**: Included in strategy call but irrelevant to goal/pillar decisions — just noise

---

## Proposed Changes

### Summary of Changes

- Create 5 focused prompt modules for each strategy pipeline step
- Rewrite `generate-strategy/route.ts` as multi-step SSE streaming pipeline
- Update strategy page to consume SSE events with live progress UI
- Improve `subTopics` from free-text string to structured array of concrete video ideas
- Integrate voice profile into strategy review step
- Remove data truncation — each step gets full data relevant to its focus
- Update `generation-context.tsx` to support SSE-based strategy generation
- Update types to support structured subtopics

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `src/lib/prompts/strategy-data-analysis.ts` | Step 1 prompt: Extract structured insights from audit + performance + competitor data |
| `src/lib/prompts/strategy-goal.ts` | Step 2 prompt: Determine reach/trust/revenue goal from insights + client profile |
| `src/lib/prompts/strategy-pillars.ts` | Step 3 prompt: Define 3-5 pillars with concrete subtopics from goal + brand |
| `src/lib/prompts/strategy-weekly.ts` | Step 4 prompt: Build day-by-day plan from pillars + insights + types/formats |
| `src/lib/prompts/strategy-review.ts` | Step 5 prompt: Review strategy consistency, voice match, completeness |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `src/app/api/configs/[id]/generate-strategy/route.ts` | **Major rewrite**: Replace single call with 5-step SSE streaming pipeline |
| `src/app/(app)/clients/[id]/strategy/page.tsx` | **Major update**: Add SSE streaming consumption with pipeline progress UI |
| `src/lib/prompts/strategy-generation.ts` | Replace interface-only file with proper exports of all 5 step prompts |
| `src/lib/prompts/index.ts` | Add exports for new strategy prompt modules |
| `src/lib/types.ts` | Add `StrategyInsights` interface, update pillar `subTopics` to structured array |
| `src/context/generation-context.tsx` | Strategy generation now uses SSE instead of fire-and-forget |

### Files to Delete

None.

---

## Design Decisions

### Key Decisions Made

1. **SSE Streaming (same as script pipeline)**: Consistent UX pattern across the app. User sees live progress. Proven to work on Vercel with `maxDuration = 120`.

2. **5 steps, not 3**: Separating goal determination from pillar definition prevents the goal choice from being an afterthought. Separating data analysis from everything else means insights are extracted once, clearly, and reused.

3. **Structured subtopics**: Change `subTopics: string` (free text) to `subTopics: Array<{ title: string; angle: string }>`. Each subtopic becomes a concrete video idea with a specific angle — directly usable by the script pipeline's topic selection step.

4. **Full data in Step 1 only**: Step 1 (Data Analysis) reads ALL data without truncation and extracts structured insights. Steps 2-4 receive only the extracted insights — not the raw data. This focuses context while preserving information.

5. **Voice Profile in Review only**: Steps 2-4 don't need voice profile. Step 5 (Review) checks whether the strategy's formats and topics are compatible with how the client speaks. E.g., if the client has a low-energy, reflective voice, a "Reaction" format might not fit.

6. **Keep backward compatibility**: The output format (strategyGoal, strategyPillars, strategyWeekly) stored in the config remains the same structure. Frontend rendering of existing strategies still works.

7. **Reuse existing prompt rules**: AUDIT_USAGE_RULES, TOPIC_SPECIFICITY_RULES, CONCRETENESS_RULES from the script pipeline apply equally to strategy generation.

### Alternatives Considered

- **Keep fire-and-forget, just split into chained calls**: Rejected — no progress feedback, and the total time (5 sequential calls) would make it feel slower without SSE.
- **Parallel steps 3+4**: Rejected — step 4 (weekly plan) needs pillars from step 3. Sequential is correct here.
- **Voice profile in pillar definition**: Rejected — voice affects HOW you say things, not WHAT topics you cover. Pillars are about brand positioning, not tone.
- **Replace generation-context with direct SSE in page**: Considered — but the existing pattern uses context for state management across navigations. We'll modify the context to handle SSE state.

### Open Questions

1. **SubTopics migration**: Existing strategies have `subTopics` as a string. Should we migrate existing data on first load, or just handle both formats in rendering? → Recommendation: Handle both formats. Parse string as-is if it's not JSON array.

---

## Step-by-Step Tasks

### Step 1: Add StrategyInsights type and update SubTopics

Update types to support the new pipeline output.

**Actions:**

- Add `StrategyInsights` interface to `src/lib/types.ts`:
  ```typescript
  export interface StrategyInsight {
    category: "performance" | "audit" | "competitor" | "gap";
    insight: string;           // concrete finding
    dataPoint: string;         // specific number/example backing it
    implication: string;       // what this means for the strategy
  }
  ```

- Add `StructuredSubTopic` interface:
  ```typescript
  export interface StructuredSubTopic {
    title: string;             // concrete video title (max 10 words)
    angle: string;             // specific angle/perspective (1 sentence)
  }
  ```

**Files affected:**
- `src/lib/types.ts`

---

### Step 2: Create Strategy Data Analysis Prompt (Step 1 of pipeline)

Focused prompt that reads ALL raw data and extracts structured insights.

**Actions:**

- Create `src/lib/prompts/strategy-data-analysis.ts`:
  - System prompt: "Du bist ein Daten-Analyst für Social-Media-Strategien. Deine EINZIGE Aufgabe: Analysiere die Rohdaten und extrahiere die wichtigsten Erkenntnisse."
  - Receives: full audit report (no truncation), full performance data (own top videos), full competitor data (no truncation), existing strategy (if any)
  - Does NOT receive: client profile, brand info, voice profile, content types/formats
  - Tool output: `{ insights: StrategyInsight[], topPerformingFormats: string[], topPerformingTypes: string[], avgViralDuration: number | null, nichePatterns: string }`
  - Reuse `AUDIT_USAGE_RULES` from `scripting.ts`
  - Rules: Be concrete — "Videos unter 25s haben 3x mehr Views" not "Kurze Videos sind besser". Every insight needs a data point.

**Files affected:**
- `src/lib/prompts/strategy-data-analysis.ts` (new)

---

### Step 3: Create Strategy Goal Prompt (Step 2 of pipeline)

Focused prompt for the strategic goal decision.

**Actions:**

- Create `src/lib/prompts/strategy-goal.ts`:
  - System prompt: "Du bist ein Strategie-Berater. Deine EINZIGE Aufgabe: Bestimme das strategische Ziel für diesen Client."
  - Receives: extracted insights from Step 1, client profile (name, role, company, niche, followers), brand info (feeling, problem, branding statement)
  - Does NOT receive: raw data, competitor videos, training scripts, content types
  - Tool output: `{ goal: "reach" | "trust" | "revenue", reasoning: string, keyInsights: string[] }`
  - Rules:
    - "reach" if visibility/discovery is the bottleneck (low followers relative to niche, low views)
    - "trust" if community/authority needs building (followers exist but low engagement, few saves/shares)
    - "revenue" if conversion is the priority (strong community but no offer visibility)
    - Reasoning must reference specific data points from insights

**Files affected:**
- `src/lib/prompts/strategy-goal.ts` (new)

---

### Step 4: Create Strategy Pillars Prompt (Step 3 of pipeline)

Focused prompt for defining content pillars with concrete subtopics.

**Actions:**

- Create `src/lib/prompts/strategy-pillars.ts`:
  - System prompt: "Du bist ein Content-Architekt. Deine EINZIGE Aufgabe: Definiere 3-5 Content Pillars mit konkreten Video-Ideen."
  - Receives: goal + reasoning from Step 2, insights from Step 1, client brand info (feeling, problem, dream customer, customer problems, authenticity zone, branding statement, human differentiation)
  - Does NOT receive: raw data, content types/formats, competitor videos, training scripts
  - Reuse `TOPIC_SPECIFICITY_RULES` and `CONCRETENESS_RULES`
  - Tool output:
    ```
    { pillars: Array<{
        name: string,           // 2-4 words
        why: string,            // 1 sentence: why this pillar for this goal
        subTopics: Array<{
          title: string,        // concrete video title, max 10 words
          angle: string         // specific angle/hook direction
        }>                      // 4-6 per pillar
      }>
    }
    ```
  - Rules:
    - Each pillar must connect to dream customer's problems OR client's expertise
    - SubTopics are not generic ideas — they are ready-to-use video titles
    - "Warum dein Stop-Loss bei 2% Quatsch ist" not "Trading Fehler"
    - 4-6 subtopics per pillar (more than current 3-4, and structured)
    - No pillar should overlap >30% with another

**Files affected:**
- `src/lib/prompts/strategy-pillars.ts` (new)

---

### Step 5: Create Strategy Weekly Prompt (Step 4 of pipeline)

Focused prompt for building the day-by-day content plan.

**Actions:**

- Create `src/lib/prompts/strategy-weekly.ts`:
  - System prompt: "Du bist ein Redaktionsplan-Spezialist. Deine EINZIGE Aufgabe: Erstelle den optimalen Wochenplan."
  - Receives: goal from Step 2, pillars from Step 3, insights from Step 1, full content types list, full formats list, posts per week / active days
  - Does NOT receive: raw audit/competitor data, client profile, voice profile
  - Tool output:
    ```
    { weekly: Record<day, {
        type: string,           // exact name from content types list
        format: string,         // exact name(s) from formats list
        pillar: string,         // which pillar this day serves
        reason: string          // data-backed: "Authority am Mo weil laut Audit Auth-Content 2x mehr Views hat"
      }>
    }
    ```
  - Rules:
    - Use EXACT names from content types + formats lists
    - Each pillar should appear at least once in the week
    - Formats can combine with " + " (e.g. "Face to Camera + Voice Over + B-Roll")
    - Reference specific insights: "Face to Camera am Mo weil laut Performance-Daten eigene FTC-Videos Ø 15K Views haben"
    - Vary content types across the week — no same type on consecutive days

**Files affected:**
- `src/lib/prompts/strategy-weekly.ts` (new)

---

### Step 6: Create Strategy Review Prompt (Step 5 of pipeline)

Quality gate for the complete strategy.

**Actions:**

- Create `src/lib/prompts/strategy-review.ts`:
  - System prompt: "Du bist ein Strategie-Reviewer. Prüfe diese Content-Strategie auf Konsistenz, Vollständigkeit und Praxistauglichkeit."
  - Receives: complete strategy (goal, pillars, weekly), voice profile (if exists), client brand info (branding statement, dream customer)
  - Does NOT receive: raw data
  - Tool output:
    ```
    {
      issues: Array<{
        area: "goal" | "pillars" | "weekly" | "coherence",
        issue: string,
        suggestion: string
      }>,
      revisedPillars?: Array<pillar>,    // only if corrections needed
      revisedWeekly?: Record<day, plan>, // only if corrections needed
      overallAssessment: string          // 2-3 sentences
    }
    ```
  - Checks:
    - Do all pillars connect to the stated goal?
    - Are subtopics concrete enough to film tomorrow?
    - Does the weekly plan cover all pillars at least once?
    - If voice profile exists: Do the chosen formats match the client's energy? (e.g., low-energy client → maybe not "Reaction" format)
    - Are there obvious gaps? (e.g., no social proof content but goal is "trust")
    - Is there enough variety in content types across the week?

**Files affected:**
- `src/lib/prompts/strategy-review.ts` (new)

---

### Step 7: Update Prompt Exports

Wire up all new prompt modules.

**Actions:**

- Rewrite `src/lib/prompts/strategy-generation.ts` to export the `StrategyPromptContext` and `StrategyOutput` interfaces (keep existing), plus re-export from all 5 new prompt files.

- Update `src/lib/prompts/index.ts` to add exports for:
  - `strategy-data-analysis`
  - `strategy-goal`
  - `strategy-pillars`
  - `strategy-weekly`
  - `strategy-review`

**Files affected:**
- `src/lib/prompts/strategy-generation.ts`
- `src/lib/prompts/index.ts`

---

### Step 8: Rewrite generate-strategy as Multi-Step SSE Pipeline

Replace the single Claude call with a streaming multi-step pipeline.

**Actions:**

Rewrite `src/app/api/configs/[id]/generate-strategy/route.ts`:

```
Pipeline flow (SSE events sent at each transition):

1. LOAD CONTEXT
   → Read config, audit, performance, competitors, voice profile
   → NO truncation — pass full data to Step 1
   → Event: { step: "context", status: "done" }

2. DATA ANALYSIS (1 Claude call)
   → Full audit + full performance + full competitors
   → Extracts structured insights
   → Event: { step: "analysis", status: "done", insightCount: N }

3. GOAL DETERMINATION (1 Claude call)
   → Insights + client profile
   → Event: { step: "goal", status: "done", goal: "reach"|"trust"|"revenue", reasoning: string }

4. PILLAR DEFINITION (1 Claude call)
   → Goal + insights + brand info
   → Event: { step: "pillars", status: "done", pillars: [...] }

5. WEEKLY PLAN (1 Claude call)
   → Pillars + insights + content types/formats
   → Event: { step: "weekly", status: "done", weekly: {...} }

6. STRATEGY REVIEW (1 Claude call)
   → Complete strategy + voice profile
   → Applies corrections if needed
   → Event: { step: "review", status: "done", issues: [...] }

7. DONE
   → Save to config (same format as before)
   → Event: { step: "done", strategy: { goal, reasoning, pillars, weekly } }
```

**Key implementation details:**
- Use `ReadableStream` with SSE format (matching `generate-week-scripts` pattern)
- `sendEvent()` helper same as script pipeline
- Each step has try/catch — if a step fails, send error event with step name
- Total: 5 Claude calls, all sequential (each depends on previous)
- Estimated time: ~25-40 seconds total (5 x 5-8 seconds per call)
- Model: `claude-sonnet-4-6` for all steps
- max_tokens per step: analysis=3000, goal=500, pillars=3000, weekly=2000, review=3000
- `maxDuration = 120` (same as script pipeline)
- Data loading helpers: Reuse `getAuditBlock()` but create `getFullAuditReport()` that returns untruncated report. Reuse `buildPerformanceBlock()` from existing code but without truncation. Build full competitor block without 400-char limit.
- Save format: Convert structured subtopics to JSON string in `strategyPillars`. Keep `strategyWeekly` and `strategyGoal` format compatible.

**Files affected:**
- `src/app/api/configs/[id]/generate-strategy/route.ts` (major rewrite)

---

### Step 9: Update Strategy Page with SSE Streaming Progress

Rewrite the strategy page to consume SSE events and show live progress.

**Actions:**

Update `src/app/(app)/clients/[id]/strategy/page.tsx`:

- Replace the `useGeneration()` fire-and-forget pattern with direct SSE consumption (same pattern as scripts page)
- New state variables:
  ```typescript
  type StrategyPipelineStep = "context" | "analysis" | "goal" | "pillars" | "weekly" | "review" | "done";
  const [pipelineStep, setPipelineStep] = useState<StrategyPipelineStep | null>(null);
  const [generating, setGenerating] = useState(false);
  const [streamedGoal, setStreamedGoal] = useState<string | null>(null);
  const [streamedPillars, setStreamedPillars] = useState<Pillar[] | null>(null);
  ```

- Pipeline progress component (reuse pattern from scripts page):
  ```
  ✓ Daten geladen
  ✓ Audit & Performance analysiert (12 Erkenntnisse)
  ✓ Strategie-Ziel bestimmt: Reichweite
  ■ Content Pillars definieren...
  ○ Wochenplan erstellen
  ○ Qualitätsprüfung
  ```

- Results appear progressively:
  - After Step 2: Show goal badge + reasoning
  - After Step 3: Show pillar cards (appearing one by one would be nice but not required)
  - After Step 4: Show weekly calendar
  - After Step 5: Show review assessment, highlight any corrections

- SSE reading pattern: Copy from scripts page `generateWeek()` function
  ```typescript
  const res = await fetch(`/api/configs/${id}/generate-strategy`, { method: "POST" });
  const reader = res.body?.getReader();
  // ... same buffer/parse pattern as scripts page
  ```

- Keep existing `StrategyEditDialog` for manual editing after generation
- Keep existing display components for goal, pillars, weekly — just add progressive reveal
- Error handling: If a step fails, show which step failed and allow retry

**Files affected:**
- `src/app/(app)/clients/[id]/strategy/page.tsx` (major update to generation function + progress UI)

---

### Step 10: Update Generation Context

The generation context currently fires and forgets for strategy. Since we're moving to SSE consumed directly in the page, simplify the context.

**Actions:**

- In `src/context/generation-context.tsx`:
  - Keep `strategyGen` Map for backward compatibility
  - The strategy page will manage its own SSE state locally (same as scripts page does)
  - `startStrategyGeneration()` can be simplified or removed — the page handles it directly
  - Keep `clearStrategyGen()` for cleanup

**Files affected:**
- `src/context/generation-context.tsx` (minor simplification)

---

### Step 11: Handle Backward Compatibility for SubTopics

Existing strategies have `subTopics` as a plain string. New strategies will have structured arrays.

**Actions:**

- In the strategy page rendering code, detect format:
  ```typescript
  function parseSubTopics(raw: string | StructuredSubTopic[]): StructuredSubTopic[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      // Legacy format: "Topic 1, Topic 2, Topic 3"
      return raw.split(/[,\n]/).filter(Boolean).map(s => ({ title: s.trim(), angle: "" }));
    }
    return [];
  }
  ```

- In the strategy page pillar rendering, show both formats:
  - Old format: plain text list
  - New format: each subtopic as a card with title + angle

- In `generate-week-scripts/route.ts` topic selection, update `pillarBlock` to use structured subtopics if available:
  ```typescript
  const pillarBlock = pillars.map(p => {
    let line = `- ${p.name}`;
    if (Array.isArray(p.subTopics)) {
      line += "\n" + p.subTopics.map(st => `  • ${st.title}${st.angle ? ` (${st.angle})` : ""}`).join("\n");
    } else if (p.subTopics) {
      line += `\n  Unterthemen: ${p.subTopics}`;
    }
    return line;
  }).join("\n");
  ```

**Files affected:**
- `src/app/(app)/clients/[id]/strategy/page.tsx` (subtopic rendering)
- `src/app/api/configs/[id]/generate-week-scripts/route.ts` (pillarBlock construction, ~line 191-195)

---

### Step 12: Update CLAUDE.md

Document the new strategy pipeline architecture.

**Actions:**

- Add "Strategy Generation Pipeline (Multi-Step SSE)" section to CLAUDE.md:
  ```
  ### Strategy Generation Pipeline — Multi-Step SSE Pipeline

  1. **Load Context** — Client profile, audit, performance, competitors, voice profile
  2. **Data Analysis** — Extract structured insights from all data sources (no truncation)
  3. **Goal Determination** — Pick reach/trust/revenue based on insights + client profile
  4. **Pillar Definition** — Define 3-5 pillars with 4-6 concrete video ideas each
  5. **Weekly Plan** — Assign content type + format per day, data-backed reasoning
  6. **Strategy Review** — Check consistency, voice match, completeness. Apply corrections.
  7. **Stream to User** — SSE events show real-time progress

  Key endpoint: `POST /api/configs/[id]/generate-strategy` (SSE stream)
  ```

- Update the "Two Customizable Prompts Per Config" section if needed

**Files affected:**
- `CLAUDE.md`

---

### Step 13: Testing & Validation

**Actions:**

- Test full strategy generation pipeline end-to-end with a client that has:
  - Audit report
  - Performance data
  - Competitor videos
  - Voice profile
- Test with a client that has NO data (only profile) — each step should handle missing data gracefully
- Verify SSE streaming works correctly (events arrive in order, no dropped events)
- Verify generated subtopics are concrete and specific (not generic)
- Compare output quality: generate strategy with old and new pipeline for same client
- Test frontend progress UI: all 6 steps render correctly with progressive reveal
- Test that existing strategies still display correctly (backward compatibility)
- Test that script pipeline's topic selection works better with new structured subtopics
- Verify Vercel deployment: SSE streaming within maxDuration
- Test error recovery: if one step fails, user sees clear error and can retry

**Files affected:** None (testing only)

---

## Connections & Dependencies

### Files That Reference This Area

- `src/app/(app)/clients/[id]/strategy/page.tsx` — main consumer
- `src/app/api/configs/[id]/generate-week-scripts/route.ts` — reads `strategyPillars` and `strategyWeekly` for topic selection (lines 160-195)
- `src/lib/prompts/topic-selection.ts` — receives pillars as context
- `src/context/generation-context.tsx` — manages generation state
- `src/lib/csv.ts` — reads/writes configs

### Updates Needed for Consistency

- `CLAUDE.md` — add strategy pipeline section (Step 12)
- `src/lib/prompts/index.ts` — new exports (Step 7)
- `src/lib/types.ts` — new interfaces (Step 1)

### Impact on Existing Workflows

- **Strategy generation**: Complete UX change (SSE streaming instead of spinner). Output stored in same config fields.
- **Script generation**: Improved input — structured subtopics give topic selection step more to work with. No API changes needed.
- **Manual strategy editing**: Unchanged. StrategyEditDialog stays as-is. May need minor update to handle structured subtopics in edit form.
- **Existing saved strategies**: Backward compatible — old string subtopics still render correctly.

---

## Validation Checklist

- [ ] Data Analysis step extracts concrete, data-backed insights (not generic)
- [ ] Goal determination references specific data points in reasoning
- [ ] Pillars have 4-6 structured subtopics each with concrete video titles
- [ ] Weekly plan uses exact content type and format names from the built-in lists
- [ ] Strategy review catches inconsistencies and suggests corrections
- [ ] Voice profile integration works (format/energy compatibility check)
- [ ] SSE streaming shows progress in real-time on frontend
- [ ] Goal, pillars, weekly appear progressively as each step completes
- [ ] Existing strategies still display correctly (backward compatibility)
- [ ] Script pipeline's topic selection handles new structured subtopics
- [ ] Total generation time is ≤60s for full pipeline
- [ ] Error in one step shows clear message, allows retry
- [ ] CLAUDE.md updated with new architecture

---

## Success Criteria

The implementation is complete when:

1. **Strategy generation shows live progress** with 6 visible steps and results appearing progressively
2. **Data is used without truncation** — insights reference specific numbers from audit/performance/competitors
3. **Subtopics are concrete video titles** — "Warum dein Stop-Loss bei 2% Quatsch ist" not "Trading Fehler"
4. **Strategy review catches problems** — missing pillar coverage, format/voice mismatches, generic subtopics
5. **Script pipeline benefits** — topic selection step produces better results because pillar subtopics are more specific
6. **Existing strategies still work** — backward compatibility for string-format subtopics

---

## Notes

- The 5 sequential Claude calls will take ~25-40 seconds total. This is comparable to the current single call (~15-30s) but delivers much higher quality. The SSE streaming makes it feel faster because the user sees continuous progress.
- Future: The Data Analysis step could be cached — if audit/performance/competitor data hasn't changed, reuse previous insights instead of re-analyzing.
- Future: Strategy review feedback could inform the next generation — "last time Pillar 3 was too generic" stored as a learning.
- Future: Structured subtopics could be shown as a "content bank" the user picks from when generating individual scripts.
- The script pipeline's topic selection already references the strategy's weekly plan and pillars. With more concrete subtopics, topic selection can stay closer to the strategy's intent while still being creative.
- Consider: Step 3 (Pillars) could potentially be parallelized — e.g., define each pillar in a separate call. But 3-5 pillars need to be defined together to avoid overlap, so sequential is likely better.
