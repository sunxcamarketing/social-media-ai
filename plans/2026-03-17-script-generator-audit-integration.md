# Plan: Integrate Audit Reports into Script Generation for Strategic Video Ideas

**Created:** 2026-03-17
**Status:** Implemented
**Request:** Upgrade the script generation system to produce the same quality as the manual Roman Decker analysis — by feeding the full Instagram audit report, performance patterns, and strategic reasoning into the AI prompts.

---

## Overview

### What This Plan Accomplishes

The current script generation (topic plan + script writing) uses client profile data, pillars, and some top video hooks — but completely ignores the rich Instagram audit report that contains the most actionable insights: what video lengths work, what hook styles perform, engagement patterns, content cannibalization issues, and specific sofort-massnahmen. This plan integrates the audit report into both the topic plan and script generation prompts, so the AI produces strategically justified video ideas at the same quality level as the manual analysis.

### Why This Matters

The manual analysis for Roman Decker was "EXTREM gut" because it synthesized ALL available data — profile, audit, performance insights, and cross-platform signals — into scripts that each had a clear strategic "warum". The current app has all this data but doesn't connect it. Closing this gap means every client gets the same strategic depth automatically.

---

## Current State

### Relevant Existing Structure

| File | Role |
|------|------|
| `app/src/app/api/configs/[id]/generate-topic-plan/route.ts` | Step 1: Generates weekly topic plan via Claude |
| `app/src/app/api/configs/[id]/generate-script/route.ts` | Step 2: Generates individual script for a topic |
| `app/src/app/(app)/clients/[id]/scripts/page.tsx` | Frontend: 2-step flow (plan topics → write scripts) + chat |
| `app/src/app/api/analyses/route.ts` | CRUD for audit reports |
| `data/analyses.csv` | Stored audit reports (id, clientId, report markdown, profile stats) |
| `data/configs.csv` | Client profiles with performanceInsights JSON (top videos with hooks/topics/whyItWorked) |
| `app/src/lib/csv.ts` | `readAnalyses()` function already exists |

### Gaps Being Addressed

1. **Audit report is never loaded in generation prompts** — `generate-topic-plan` and `generate-script` both ignore `data/analyses.csv` entirely
2. **No strategic reasoning displayed** — The topic plan shows title + description but no "warum" / strategic justification
3. **Performance insights are under-utilized** — Only top video hooks are extracted, not the audit's pattern analysis (optimal length, engagement patterns, what content types work)
4. **No "generate full week" one-click** — User must click topic plan, then click each script individually. For the quality I produced manually, all 5-6 scripts should generate in one batch with full strategic context.

---

## Proposed Changes

### Summary of Changes

- **Enrich `generate-topic-plan` prompt** with the client's most recent audit report (strengths, weaknesses, optimal video length, content patterns, sofort-massnahmen)
- **Enrich `generate-script` prompt** with audit-derived constraints (max video length, hook style guidance, comment-CTA requirement)
- **Add `reasoning` field to topic plan items** so each topic shows WHY it was chosen (data-backed justification)
- **Add "Generate Full Week" button** that generates all topics AND scripts in one streaming call, producing the same output quality as the manual analysis
- **New API route** `/api/configs/[id]/generate-week-scripts` — single endpoint that returns a complete week of scripts with strategic reasoning
- **Update frontend** to display the strategic reasoning and audit-based constraints per script

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `app/src/app/api/configs/[id]/generate-week-scripts/route.ts` | All-in-one endpoint: generates a full week of scripts with audit context in a single Claude call |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `app/src/app/api/configs/[id]/generate-topic-plan/route.ts` | Add audit report loading + inject into prompt |
| `app/src/app/api/configs/[id]/generate-script/route.ts` | Add audit report loading + inject constraints into prompt |
| `app/src/app/(app)/clients/[id]/scripts/page.tsx` | Add "Full Week" generation button + reasoning display in cards |
| `app/src/lib/types.ts` | Extend `TopicPlanItem` with optional `reasoning` field |

### Files to Delete

None.

---

## Design Decisions

### Key Decisions Made

1. **Single mega-prompt for full week generation**: The manual analysis worked because ALL context was in one prompt and the AI could reason across the entire week. Generating scripts one-by-one loses the ability to ensure variety and strategic balance. The new endpoint sends one big prompt and gets back 5-6 complete scripts.

2. **Extract key audit metrics, don't dump the entire report**: The audit reports are 3000+ words of markdown. Sending the full report wastes tokens and dilutes focus. Instead, extract the actionable sections: optimal video length, top/bottom patterns, sofort-massnahmen, and engagement benchmarks.

3. **Keep existing 2-step flow as-is, add "Full Week" as a premium option**: The 2-step topic→script flow works well for fine-grained control. The new "Full Week" button is for when you want the AI to handle everything strategically — like I did manually.

4. **Use `claude-sonnet-4-6` with tool_use for structured output**: Matches existing pattern. The tool schema ensures each script has all required fields (day, pillar, type, format, title, hook, body, cta, reasoning).

5. **Display reasoning prominently**: Each generated script card should show the "warum" — why this topic, why this hook style, what data supports it. This is what made the manual analysis "extrem gut".

### Alternatives Considered

- **Streaming SSE for full week generation**: Considered but adds complexity. A single request with 5-6 scripts takes ~15-20s with Claude. A loading state is sufficient. Can add streaming later if needed.
- **Separate YouTube analysis integration**: The YouTube data is currently not structured in CSV. Would require a new scraping pipeline. Deferred — the Instagram audit + performance insights already provide 90% of the value.

### Open Questions

1. Should the "Full Week" scripts auto-save or show a review step first? (Recommendation: show review first, with save-all button)

---

## Step-by-Step Tasks

### Step 1: Add `reasoning` field to TopicPlanItem type

Extend the TopicPlanItem interface to support strategic justification.

**Actions:**
- Add optional `reasoning?: string` field to `TopicPlanItem` in types.ts

**Files affected:**
- `app/src/lib/types.ts`

---

### Step 2: Create audit report extraction utility

Build a helper function that reads the most recent audit report for a client and extracts the key actionable sections into a structured prompt block.

**Actions:**
- In the new `generate-week-scripts/route.ts` (and reusable from other routes), create a function `getAuditContext(clientId: string)` that:
  1. Calls `readAnalyses()` and filters by `clientId`
  2. Takes the most recent analysis (sorted by `createdAt`)
  3. Extracts from the markdown report:
     - Profile overview stats (followers, reels/30d, avg views)
     - Strengths (bulleted)
     - Key improvement areas (bulleted)
     - Optimal video length recommendation
     - Content-analysis patterns (what works vs doesn't)
     - Sofort-massnahmen (immediate actions)
  4. Returns a formatted context block string

**Files affected:**
- `app/src/app/api/configs/[id]/generate-week-scripts/route.ts` (new file)

---

### Step 3: Create the `generate-week-scripts` API endpoint

Build the all-in-one endpoint that generates a complete strategic week of scripts.

**Actions:**
- Create `app/src/app/api/configs/[id]/generate-week-scripts/route.ts`
- POST handler that:
  1. Loads client config (profile, pillars, weekly schedule, brand context, dream customer)
  2. Loads audit report via the extraction utility from Step 2
  3. Loads performance insights (own top videos + competitor videos with hooks/topics/whyItWorked)
  4. Loads training scripts for voice matching
  5. Loads recent scripts to avoid repetition
  6. Builds a comprehensive system prompt that instructs Claude to:
     - Create exactly N scripts (one per active day)
     - Follow the weekly schedule (day → type → format)
     - Stay within the audit-recommended video length
     - Use proven hook styles from performance data
     - Include a comment-CTA in every script
     - Provide strategic reasoning for each script
     - Ensure variety across pillars and sub-topics
  7. Uses tool_use with a `submit_week_scripts` tool that expects an array of script objects, each with: day, pillar, contentType, format, title, hook, body, cta, reasoning
  8. Returns the array of generated scripts

**Key prompt sections:**
```
<client_profile> ... </client_profile>
<brand_positioning> ... </brand_positioning>
<content_strategy> pillars + weekly schedule </content_strategy>
<audit_report> extracted key insights </audit_report>
<performance_data> own top videos + competitor videos with hooks </performance_data>
<voice_examples> training transcripts </voice_examples>
<already_covered> recent script titles </already_covered>
```

**System prompt emphasis:**
- "Du erstellst eine KOMPLETTE strategische Woche — nicht einzelne Skripte im Vakuum"
- "Jedes Skript muss ein 'WARUM' haben: Welche Daten aus dem Audit stützen diese Entscheidung?"
- "Die Woche als Ganzes muss strategisch sinnvoll sein: Abwechslung in Pillars, Hook-Stilen, und emotionalen Registern"

**Files affected:**
- `app/src/app/api/configs/[id]/generate-week-scripts/route.ts` (new)

---

### Step 4: Enrich existing `generate-topic-plan` with audit data

Add the audit report context to the existing topic plan generation so even the 2-step flow benefits.

**Actions:**
- Import `readAnalyses` in `generate-topic-plan/route.ts`
- After loading config, load the most recent analysis for this client
- Extract key sections (same logic as Step 2, can share the function)
- Add an `<audit_insights>` block to the user prompt
- Add `reasoning` to the tool schema so each topic includes justification
- Update the system prompt to instruct: "Nutze die Audit-Erkenntnisse um datenbasierte Themen zu wählen"

**Files affected:**
- `app/src/app/api/configs/[id]/generate-topic-plan/route.ts`

---

### Step 5: Enrich existing `generate-script` with audit constraints

Add audit-derived constraints to individual script generation.

**Actions:**
- Import `readAnalyses` in `generate-script/route.ts`
- Load the most recent analysis for the client
- Extract the optimal video length recommendation and override the duration calculation if the audit provides a more specific recommendation
- Add a `<audit_context>` block to the user prompt with:
  - What hook styles work for this client
  - What to avoid (from improvement areas)
  - Comment-CTA requirement (from sofort-massnahmen)
- Update system prompt to reference audit data

**Files affected:**
- `app/src/app/api/configs/[id]/generate-script/route.ts`

---

### Step 6: Update frontend — "Full Week" generation button and display

Add the new generation flow to the scripts page.

**Actions:**

1. **Add state for full-week generation:**
   ```typescript
   type FullWeekScript = {
     day: string; pillar: string; contentType: string; format: string;
     title: string; hook: string; body: string; cta: string; reasoning: string;
   };
   const [fullWeekScripts, setFullWeekScripts] = useState<FullWeekScript[]>([]);
   const [fullWeekLoading, setFullWeekLoading] = useState(false);
   const [fullWeekError, setFullWeekError] = useState<string | null>(null);
   ```

2. **Add "Generate Full Week" button** in the Wochenplanung panel, next to the existing "Woche planen" button:
   - New button: "Komplette Woche generieren" with Sparkles icon
   - Uses blush/accent styling to distinguish from the existing topic-only flow
   - Calls `/api/configs/${id}/generate-week-scripts` POST
   - Shows loading state with "Strategische Skripte werden erstellt..."

3. **Add FullWeekScriptCard component** that shows:
   - Day badge (Mo, Di, Mi, Do, Fr)
   - Title (prominently)
   - Pillar + Content Type + Format badges
   - **Reasoning section** with a Lightbulb icon — shows WHY this script was chosen (always visible, not collapsed)
   - Expandable hook/body/cta sections
   - Copy button (copies hook + body + cta)
   - Save button (saves to scripts CSV via existing POST /api/scripts)
   - Regenerate button (re-calls generate-script for just that slot)

4. **Add "Save All" button** when full week is displayed:
   - Saves all scripts to CSV in one batch
   - Shows checkmarks as each is saved

5. **Add audit status indicator** in the data sources section:
   - Show whether an audit report exists for this client
   - Green checkmark + date if audit exists
   - Yellow warning if no audit (suggest running one first for better results)

**Files affected:**
- `app/src/app/(app)/clients/[id]/scripts/page.tsx`

---

### Step 7: Extract shared audit parsing logic

Refactor the audit extraction into a shared utility so both the new endpoint and the enriched existing endpoints can use it.

**Actions:**
- Create a helper function in the new route file (or a small shared util) that:
  ```typescript
  function extractAuditContext(report: string): {
    profileOverview: string;
    strengths: string;
    improvements: string;
    optimalVideoLength: string;
    contentPatterns: string;
    immediateActions: string;
  }
  ```
- Parse the markdown report by `## ` section headers
- Return each section trimmed to reasonable length (max 500 chars each to stay within token budget)

**Files affected:**
- `app/src/app/api/configs/[id]/generate-week-scripts/route.ts`

---

## Connections & Dependencies

### Files That Reference This Area

- `app/src/components/app-sidebar.tsx` — Already has "Scripts" tab linked, no changes needed
- `app/src/context/generation-context.tsx` — Used for background generation, may need update if full-week uses it
- `app/src/lib/csv.ts` — `readAnalyses()` already exists and working

### Updates Needed for Consistency

- `CLAUDE.md` — Update to document the new generate-week-scripts endpoint and the audit integration

### Impact on Existing Workflows

- **Existing 2-step flow**: Enhanced with audit data but still works the same way. No breaking changes.
- **Existing scripts CRUD**: Unchanged. Full week scripts are saved through the same `/api/scripts` POST endpoint.
- **Audit page**: No changes needed. The audit report is read-only from the generation perspective.

---

## Validation Checklist

- [ ] `generate-week-scripts` endpoint returns 5 scripts with all fields including reasoning
- [ ] Each script respects the client's weekly schedule (correct day → type → format mapping)
- [ ] Audit report data is visible in the prompt (check via logging)
- [ ] Scripts reference audit insights in their reasoning (e.g., "optimal length based on audit data")
- [ ] "Full Week" button appears on scripts page and triggers generation
- [ ] Generated scripts display with reasoning section visible
- [ ] "Save All" saves all scripts to CSV correctly
- [ ] Existing 2-step topic plan flow still works and now includes audit context
- [ ] Audit status indicator shows correct state (exists vs missing)
- [ ] CLAUDE.md updated

---

## Success Criteria

The implementation is complete when:

1. Clicking "Komplette Woche generieren" for Roman Decker produces 5-6 scripts that are strategically justified with data from his audit report (mentions optimal video length, proven hook styles, engagement patterns)
2. Each script card shows a clear "Warum" reasoning that references specific audit findings
3. The existing 2-step flow also benefits from audit data (topics are more data-driven)
4. Scripts can be saved individually or all at once

---

## Notes

- **Token budget**: The full prompt with all context (profile + audit + performance + voice + existing scripts) may be 4000-6000 tokens. Claude Sonnet handles this well. The response with 5-6 full scripts + reasoning will be ~3000-4000 tokens. Set max_tokens to 4096.
- **Future enhancement**: YouTube channel analysis could be added as another data source. Would need a YouTube scraping/API integration similar to how Apify handles Instagram.
- **Future enhancement**: The "reasoning" per script could become a learning signal — if Aysun marks certain scripts as "published" and they perform well, that feedback loop could improve future generations.

---

## Implementation Notes

**Implemented:** 2026-03-17

### Summary

- Created `generate-week-scripts` API endpoint that synthesizes ALL client data (profile, brand, audit report, performance insights, competitor videos, voice training, existing scripts) into a single comprehensive Claude prompt
- Built `extractAuditContext()` and `getAuditBlock()` utilities that parse the markdown audit report into structured sections (overview, strengths, improvements, content patterns, sofort-massnahmen)
- Enriched existing `generate-topic-plan` endpoint with audit data + reasoning field
- Enriched existing `generate-script` endpoint with audit context (both main and topic-based flows)
- Completely rewrote the Scripts frontend page: removed the old 2-step topic plan flow and chat agent, replaced with a clean Generate → Review → Save flow
- Each generated script card shows the strategic "Warum" reasoning prominently
- Added audit status indicator and generation metadata display
- All scripts saveable individually or via "Save All" button

### Deviations from Plan

- **Simplified frontend significantly** per user instruction: removed the 2-step topic plan UI, removed the chat agent, removed the background generation banner. Kept only: Generate Week button, generated script cards, saved scripts list, manual edit dialog.
- **Combined Steps 2, 3, 7** into a single file since the audit extraction utility is only used in API routes and doesn't need to be a separate lib file.
- **Skipped Step 4 reasoning display in topic plan UI** since the topic plan UI was removed. The topic plan API still generates reasoning for programmatic use.

### Issues Encountered

None — clean compile and build on first pass.
