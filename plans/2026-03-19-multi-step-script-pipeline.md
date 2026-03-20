# Plan: Multi-Step Script Generation Pipeline

**Created:** 2026-03-19
**Status:** Implemented
**Request:** Rebuild monolithic script generation into a multi-step pipeline with parallelization, streaming progress, voice profiling, and quality review.

---

## Overview

### What This Plan Accomplishes

Replaces the current single-Claude-call script generation with a 5-step pipeline: (1) Voice Profile extraction, (2) Topic Selection, (3) Hook Generation, (4) Body Writing, (5) Quality Review. Each step has focused context, scripts generate in parallel, and the user sees live progress via SSE streaming.

### Why This Matters

The current approach dumps 15+ context sources and 50+ rules into one API call. Claude can't focus on everything simultaneously — resulting in mediocre hooks, AI-sounding language, weak voice matching, and inconsistent quality. By splitting into focused steps, each gets full attention. Parallelization also cuts total time from ~90s to ~60s while improving output quality.

---

## Current State

### Relevant Existing Structure

| File | Role |
|------|------|
| `src/app/api/configs/[id]/generate-week-scripts/route.ts` | Single monolithic call generating all week scripts |
| `src/app/api/configs/[id]/generate-script/route.ts` | Single script generation (3 modes) |
| `src/app/api/configs/[id]/generate-topic-plan/route.ts` | Topic plan generation (already a separate step) |
| `src/app/(app)/clients/[id]/scripts/page.tsx` | Frontend — no streaming, shows loading spinner |
| `src/lib/prompts/index.ts` | Composed system prompts (weekScriptsSystemPrompt, singleScriptSystemPrompt, topicScriptSystemPrompt) |
| `src/lib/prompts/language.ts` | LANGUAGE_RULES, VOICE_MATCHING_INSTRUCTIONS, LENGTH_RULES |
| `src/lib/prompts/hooks.ts` | HOOK_RULES, HOOK_PATTERNS |
| `src/lib/prompts/quality.ts` | BODY_RULES, CTA_RULES, CONCRETENESS_RULES, etc. |
| `src/lib/prompts/scripting.ts` | WEEK_COHERENCE_RULES, REASONING_RULES, AUDIT_USAGE_RULES |
| `src/app/api/analyse/route.ts` | SSE streaming pattern (reference implementation) |
| `src/lib/csv.ts` | Supabase read/write for all data including training_scripts |
| `src/lib/types.ts` | TypeScript interfaces (Script, TrainingScript, Config, etc.) |

### Gaps or Problems Being Addressed

1. **Kitchen Sink Prompt**: All context + all rules in one call → nothing gets proper attention
2. **No Voice Profiling**: Raw transcripts pasted in, competing with other context for attention
3. **No Quality Gate**: Only check is word count; no AI-detection, no voice-match validation
4. **Sequential & Slow**: One blocking call for entire week (~90s), no progress feedback
5. **Attention Decay**: Last scripts in week generation are weaker than first ones
6. **Fragile**: If the single call fails or times out, everything is lost
7. **No Streaming UX**: User stares at spinner with no indication of progress

---

## Proposed Changes

### Summary of Changes

- Create a new **Voice Profile** system: extract style patterns from training scripts, store per client
- Replace `generate-week-scripts` with a **multi-step SSE streaming pipeline**
- Add focused prompt modules for each pipeline step (topic selection, hook generation, body writing, quality review)
- **Parallelize** individual script generation (hooks + bodies run concurrently per script)
- Add **Quality Review** step that checks for AI language, voice match, and week coherence
- Update frontend to show **live progress** as each step completes
- Keep `generate-script` (single) and `generate-topic-plan` working (minor refactors only)

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `src/lib/prompts/voice-profile.ts` | Prompt for extracting voice style profile from training transcripts |
| `src/lib/prompts/topic-selection.ts` | Focused prompt for strategic topic selection (audit + performance only) |
| `src/lib/prompts/hook-generation.ts` | Focused prompt for hook creation (competitor hooks + hook patterns only) |
| `src/lib/prompts/body-writing.ts` | Focused prompt for body/CTA writing (voice profile + topic + hook only) |
| `src/lib/prompts/quality-review.ts` | Prompt for reviewing all scripts: AI check, voice match, week coherence |
| `src/lib/voice-profile.ts` | Logic for generating, caching, and reading voice profiles per client |
| `src/app/api/configs/[id]/generate-voice-profile/route.ts` | API endpoint to trigger voice profile generation |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `src/app/api/configs/[id]/generate-week-scripts/route.ts` | **Major rewrite**: Replace single call with multi-step SSE streaming pipeline |
| `src/app/(app)/clients/[id]/scripts/page.tsx` | **Major rewrite**: Add SSE streaming UI with step-by-step progress |
| `src/lib/prompts/index.ts` | Export new prompt modules |
| `src/lib/types.ts` | Add VoiceProfile interface |
| `src/lib/csv.ts` | Add voice_profiles Supabase table read/write |

### Files to Delete

None. Existing single-script generation (`generate-script/route.ts`) stays as-is for now.

---

## Design Decisions

### Key Decisions Made

1. **SSE Streaming (not WebSocket)**: Matches existing pattern from `/api/analyse`. Simple, proven, works on Vercel.

2. **Voice Profile stored in Supabase**: Generated once, reused across all script generations. Re-generated when training scripts change. Avoids re-analyzing transcripts every time.

3. **5 parallel Claude calls for bodies (not 1 call for all 5)**: Each script gets full attention. If one fails, others still work. Faster due to parallelism.

4. **Quality Review as final step**: Catches AI-sounding language after the fact rather than trying to prevent it in the writing step. Separation of creation and critique.

5. **Hook generation gets 3 options, best is auto-selected**: More creative exploration, better hooks. The selection criteria: specificity, open-loop strength, voice match.

6. **Keep generate-script single-call for now**: Refactoring both routes at once is too risky. Week generation is the priority (it's the primary workflow).

7. **Voice Profile is a JSON object, not free text**: Structured fields (avgSentenceLength, favoriteWords, tone, energy, patterns) are more useful than a paragraph description.

### Alternatives Considered

- **Multi-turn conversation instead of tool-use**: Rejected — tool-use gives structured output, multi-turn adds latency.
- **Use Opus instead of Sonnet for quality**: Rejected — too slow for 5 parallel calls. Sonnet with focused context is better than Opus with kitchen-sink context.
- **Generate hooks and bodies in same call**: Rejected — separating them lets the hook step focus purely on attention-grabbing, and the body step focus on voice and substance.
- **Client-side parallel calls**: Rejected — server-side parallelization is simpler, handles errors better, and keeps API keys server-side.

### Open Questions

1. **Supabase table for voice_profiles**: Does the Supabase instance already have a `voice_profiles` table, or do we need to create it? → We'll store as JSON field on the `configs` table (`voiceProfile` column) to avoid schema changes.

---

## Step-by-Step Tasks

### Step 1: Create Voice Profile System

Create the voice profile extraction logic and prompt.

**Actions:**

- Create `src/lib/prompts/voice-profile.ts` with a focused prompt that:
  - Takes training script transcripts as input
  - Extracts: average sentence length, favorite words/phrases, avoided words, tone descriptor, energy level, speech patterns, sentence structure preferences, slang/dialect markers
  - Returns structured JSON (not free text)

- Create `src/lib/voice-profile.ts` with:
  - `generateVoiceProfile(clientId: string, clientName: string)`: reads training scripts from Supabase, calls Claude to extract profile, saves to config
  - `getVoiceProfile(clientId: string)`: reads cached profile from config, returns null if none exists
  - Profile stored as JSON string in `configs.voiceProfile` field

- Create `src/app/api/configs/[id]/generate-voice-profile/route.ts`:
  - POST endpoint that triggers voice profile generation
  - Returns the generated profile JSON

- Add `VoiceProfile` interface to `src/lib/types.ts`:
  ```typescript
  interface VoiceProfile {
    avgSentenceLength: number;
    favoriteWords: string[];
    avoidedWords: string[];
    tone: string;
    energy: string;
    sentencePatterns: string;
    slangMarkers: string[];
    exampleSentences: string[];   // 5 characteristic sentences extracted
    summary: string;              // 2-3 sentence style description
  }
  ```

**Files affected:**
- `src/lib/prompts/voice-profile.ts` (new)
- `src/lib/voice-profile.ts` (new)
- `src/app/api/configs/[id]/generate-voice-profile/route.ts` (new)
- `src/lib/types.ts` (add VoiceProfile interface)

---

### Step 2: Create Focused Step Prompts

Create dedicated prompts for each pipeline step. Each prompt gets ONLY the context it needs.

**Actions:**

- Create `src/lib/prompts/topic-selection.ts`:
  - System prompt: "Du bist ein Content-Stratege. Wähle die strategisch besten Themen für diese Woche."
  - Context it receives: audit report, own performance data, competitor data, pillars, weekly schedule, already-covered titles
  - Context it does NOT receive: voice training, hook patterns, body rules, language rules
  - Output: array of `{ day, pillar, contentType, format, title, description, reasoning }`

- Create `src/lib/prompts/hook-generation.ts`:
  - System prompt: "Du bist ein Hook-Spezialist. Deine EINZIGE Aufgabe: Die ersten 3 Sekunden."
  - Context it receives: topic + description, hook patterns, competitor top hooks, voice profile (tone/energy only)
  - Context it does NOT receive: full audit, body rules, brand positioning details
  - Output: `{ options: [hook1, hook2, hook3], selected: number, selectionReason: string }`

- Create `src/lib/prompts/body-writing.ts`:
  - System prompt: "Du schreibst den Hauptteil eines Video-Skripts. Der Hook steht bereits fest."
  - Context it receives: topic, chosen hook, voice profile (FULL), client brand context, length rules, anti-AI rules
  - Context it does NOT receive: competitor data, audit report, hook patterns
  - Output: `{ body, cta }`

- Create `src/lib/prompts/quality-review.ts`:
  - System prompt: "Du bist ein Qualitätsprüfer. Prüfe diese Skripte auf AI-Sprache, Stimm-Match und Wochenkoherenz."
  - Context it receives: all 5 finished scripts, voice profile, anti-AI checklist, week coherence rules
  - Output: `{ scripts: [{ index, issues: string[], revised: { hook?, body?, cta? } | null }], weekCoherence: string }`

- Update `src/lib/prompts/index.ts` to export all new prompts

**Files affected:**
- `src/lib/prompts/topic-selection.ts` (new)
- `src/lib/prompts/hook-generation.ts` (new)
- `src/lib/prompts/body-writing.ts` (new)
- `src/lib/prompts/quality-review.ts` (new)
- `src/lib/prompts/index.ts` (add exports)

---

### Step 3: Rewrite generate-week-scripts as Multi-Step SSE Pipeline

Replace the single Claude call with a streaming multi-step pipeline.

**Actions:**

Rewrite `src/app/api/configs/[id]/generate-week-scripts/route.ts`:

```
Pipeline flow (SSE events sent at each transition):

1. LOAD CONTEXT (same as today)
   → Event: { step: "context", status: "done" }

2. VOICE PROFILE
   → Check if voiceProfile exists on config
   → If not and training scripts exist: generate it now (+ save)
   → If not and no training scripts: skip
   → Event: { step: "voice", status: "done", hasVoice: boolean }

3. TOPIC SELECTION (1 Claude call)
   → Focused prompt with audit + performance + strategy only
   → Event: { step: "topics", status: "done", topics: TopicPlanItem[] }

4. HOOK GENERATION (N parallel Claude calls)
   → One call per topic, focused on hooks only
   → Each returns 3 options, auto-selects best
   → Event per script: { step: "hooks", index: N, status: "done", hook: string }
   → Event when all done: { step: "hooks", status: "all_done" }

5. BODY WRITING (N parallel Claude calls)
   → One call per script, with hook already set
   → Focused on voice-matched body + CTA
   → Event per script: { step: "bodies", index: N, status: "done", title, body, cta }
   → Event when all done: { step: "bodies", status: "all_done" }

6. QUALITY REVIEW (1 Claude call)
   → Reviews all 5 scripts together
   → Checks: AI language, voice match, week variety
   → Applies revisions if needed
   → Event: { step: "review", status: "done", issues: [...] }

7. DONE
   → Event: { step: "done", scripts: [...], _meta: {...} }
```

**Key implementation details:**
- Use `ReadableStream` with SSE format (matching `/api/analyse` pattern)
- Parallel calls use `Promise.all()` for hooks and bodies
- Each step has try/catch — if hooks fail for one script, retry once, then use a simpler hook
- Total Claude calls: 1 (topics) + N (hooks) + N (bodies) + 1 (review) = 2 + 2N
- For 5 scripts: 12 calls, but 10 run in parallel pairs → effective 4 sequential calls
- Individual call max_tokens: topics=2000, hooks=500 each, bodies=1500 each, review=4000

**Files affected:**
- `src/app/api/configs/[id]/generate-week-scripts/route.ts` (major rewrite)

---

### Step 4: Update Frontend with Streaming Progress

Rewrite the scripts page to consume SSE events and show live progress.

**Actions:**

Update `src/app/(app)/clients/[id]/scripts/page.tsx`:

- Replace simple `fetch().json()` with SSE reader (same pattern as audit page)
- New state: `pipelineStep`, `pipelineProgress` (tracks which scripts have hooks/bodies done)
- Progress UI showing:
  ```
  ✓ Kontext geladen
  ✓ Stimmprofil erstellt
  ✓ 5 Themen ausgewählt
  ■ Hooks generieren... (3/5)
  ○ Skripte schreiben
  ○ Qualitätsprüfung
  ```
- Scripts appear one by one as bodies complete (not all at once at the end)
- Each script card shows immediately when its body is done (collapsed by default, expandable)
- Keep existing save/copy/edit functionality unchanged
- Error handling: if a step fails, show which step failed and allow retry

**New component structure:**
```
<WeekGenerationPanel>
  <PipelineProgress step={step} progress={progress} />
  {scripts.map(s => <ScriptCard key={s.day} script={s} />)}
</WeekGenerationPanel>
```

**Files affected:**
- `src/app/(app)/clients/[id]/scripts/page.tsx` (major update to generateWeek function + progress UI)

---

### Step 5: Auto-Generate Voice Profile on Training Page

When training scripts are saved/updated, auto-regenerate the voice profile.

**Actions:**

- Find where training scripts are saved (training page or API)
- After save: trigger `POST /api/configs/[id]/generate-voice-profile`
- Show small indicator: "Stimmprofil wird aktualisiert..."
- On scripts page: show voice profile status (exists / missing / outdated)

**Files affected:**
- `src/app/(app)/clients/[id]/training/page.tsx` (add auto-trigger after save)
- `src/app/(app)/clients/[id]/scripts/page.tsx` (show voice profile indicator)

---

### Step 6: Update Single Script Generation (Light Refactor)

Apply same improvements to single script route without full pipeline rewrite.

**Actions:**

- Use voice profile instead of raw training scripts
- Use focused body-writing prompt instead of kitchen-sink prompt
- Keep as single JSON response (no SSE needed for one script)
- Add quality self-check: append "Prüfe dein Skript auf AI-Floskeln bevor du es einreichst" to prompt

**Files affected:**
- `src/app/api/configs/[id]/generate-script/route.ts` (moderate refactor)

---

### Step 7: Testing & Validation

**Actions:**

- Test voice profile generation with a client that has training scripts
- Test voice profile generation with a client that has NO training scripts (should skip gracefully)
- Test full week generation pipeline end-to-end
- Verify SSE streaming works correctly (events arrive in order)
- Verify parallel calls complete correctly (no race conditions in state)
- Test error recovery: kill one parallel call, verify others complete
- Test frontend progress UI: all steps render correctly
- Compare output quality: generate scripts with old and new pipeline for same client
- Verify Vercel deployment: SSE streaming works on Vercel (maxDuration = 120s should be sufficient)

**Files affected:** None (testing only)

---

## Connections & Dependencies

### Files That Reference This Area

- `src/app/(app)/clients/[id]/scripts/page.tsx` — main consumer of generate-week-scripts
- `src/app/api/scripts/route.ts` — saves generated scripts (unchanged)
- `src/lib/csv.ts` — reads training_scripts, configs, analyses, videos, scripts
- `src/context/audit-context.tsx` — SSE pattern reference (not modified)

### Updates Needed for Consistency

- `CLAUDE.md` — update "Script Generation Pipeline" section to describe multi-step architecture
- `src/lib/prompts/index.ts` — new exports for all step prompts

### Impact on Existing Workflows

- **Week generation**: Complete UX change (streaming instead of spinner). Output format unchanged (same Script fields).
- **Single script generation**: Minor quality improvement via voice profile. No UX change.
- **Topic plan generation**: Unchanged. The new pipeline includes its own topic selection step.
- **Training page**: Minor addition (auto-trigger voice profile generation).
- **Saved scripts**: No change. Scripts are saved in same format.

---

## Validation Checklist

- [ ] Voice profile generates correctly from training transcripts
- [ ] Voice profile is cached and reused (not regenerated every time)
- [ ] Topic selection step produces 5 concrete, varied topics
- [ ] Hook generation produces 3 options per script, selects best
- [ ] Body writing matches client voice (compare with training scripts)
- [ ] Quality review catches AI floskeln and suggests revisions
- [ ] SSE streaming shows progress in real-time on frontend
- [ ] Scripts appear one by one as they complete
- [ ] Total generation time is ≤90s for 5 scripts
- [ ] Error in one script doesn't break the whole pipeline
- [ ] Single script generation still works (uses voice profile)
- [ ] Vercel deployment works (SSE within maxDuration)
- [ ] CLAUDE.md updated with new architecture

---

## Success Criteria

The implementation is complete when:

1. **Generating a week of scripts shows live progress** with 6 visible steps (context → voice → topics → hooks → bodies → review)
2. **Each individual script gets full Claude attention** (separate calls, not cramped into one)
3. **Voice profile is extracted once** and reused — scripts should noticeably match client's speaking style
4. **Quality review catches AI language** — comparing before/after, fewer AI floskeln in output
5. **Total time is comparable or faster** than current single-call approach (~60-90s)
6. **Frontend shows scripts appearing one by one** instead of all-or-nothing after a long wait

---

## Notes

- The existing `generate-topic-plan` route already does topic selection separately. The new pipeline's Step 3 essentially replaces this for week generation, but the standalone endpoint stays for other use cases.
- Voice profiles could later be shown in the client settings UI so users can see/edit how the AI understands their voice.
- The quality review step could later feed back into a learning loop — tracking which issues are caught most often to improve the writing prompts.
- If Vercel's 120s limit becomes tight with 12 Claude calls, we can reduce hook options from 3→2 or skip the review step for faster generation.
- Future: Consider caching topic plans so users can regenerate individual scripts without re-doing the whole pipeline.
