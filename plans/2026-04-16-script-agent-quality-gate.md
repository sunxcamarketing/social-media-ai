# Plan: Script Agent Quality Gate — Writer/Reviewer Split

**Created:** 2026-04-16
**Status:** Implemented
**Request:** Split the monolithic script-agent into Writer + Reviewer, remove duplicate script rules from content-agent, add regex-based post-processing. Goals: better script quality, fewer tokens, enforced quality gate.

---

## Overview

### What This Plan Accomplishes

Restructures the Script Agent from a single 7,700-token monolith into a focused Writer (~4,000 tokens) + enforced Reviewer (~3,000 tokens) pipeline. Removes ~4,300 tokens of duplicate script rules from the Content Agent prompt. Adds regex-based post-processing to catch the most obvious AI tells (em-dashes, monotone formatting) before the script reaches the user.

### Why This Matters

The current Script Agent produces scripts with obvious AI language (em-dashes, monotone formatting, banned phrases) despite having 2,662 tokens of anti-AI rules. This happens because: (1) the rules are buried at position ~5,000 in a 7,700-token prompt ("lost in the middle"), (2) creative writing and constraint-following compete for model attention in a single call, (3) no enforcement of self-review. The Content Agent wastes ~4,300 tokens per chat message on script rules it never uses (it delegates writing to the Script Agent).

---

## Current State

### Relevant Existing Structure

| File | Role | Tokens |
|------|------|--------|
| `prompts/agents/script-agent.md` | Monolithic writer+reviewer prompt | ~7,700 |
| `prompts/agents/content-agent.md` | Chat agent, loads ALL script rules | ~7,200 |
| `src/lib/script-agent.ts` | Agent loop, builds prompt, runs tools | — |
| `src/lib/agent-tools.ts` | `toolGenerateScript()` calls `runScriptAgent()` | — |
| `prompts/loader.ts` | `buildPrompt()` resolves `{{placeholders}}` | — |
| `prompts/foundational/*.md` | 21 reusable rule modules | — |

### Gaps or Problems Being Addressed

1. **AI-sounding scripts**: Em-dashes, banned phrases, monotone formatting slip through despite explicit rules
2. **Lost in the middle**: Anti-AI rules at position ~5,000 of 7,700 tokens get deprioritized by Sonnet
3. **No enforced review**: Agent can call `submit_script` without self-reviewing
4. **Token waste**: Content Agent loads ~4,300 tokens of script rules it never uses (delegates to Script Agent)
5. **Competing objectives**: One prompt tries to be creative writer AND quality policer simultaneously

---

## Proposed Changes

### Summary of Changes

- Split `script-agent.md` into `script-writer.md` (creative) and `script-reviewer.md` (quality gate)
- Modify `script-agent.ts` to run Writer then Reviewer as two separate Claude calls
- Add regex-based post-processing in `script-agent.ts` to catch em-dashes, monotone formatting, banned phrases
- Remove script-specific foundational blocks from `content-agent.md` (keep viral framework for ideation)
- Delete `script-agent.md` (replaced by writer + reviewer)

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `prompts/agents/script-writer.md` | Focused creative prompt: angle, hooks, voice match, script writing (~4,000 tok) |
| `prompts/agents/script-reviewer.md` | Focused quality gate: AI language, formatting, voice check (~3,000 tok) |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `src/lib/script-agent.ts` | Add reviewer step after writer submits; add regex post-processing |
| `prompts/agents/content-agent.md` | Remove `{{hook-regeln}}`, `{{hook-muster}}`, `{{body-regeln}}`, `{{cta-regeln}}`, `{{konkretion-regeln}}`, `{{storytelling-formel}}`, `{{verboten-ai-sprache}}`, `{{sprach-stil}}`, `{{natuerliche-satzstruktur}}`, `{{anti-monotone-formatierung}}` and their section headers |
| `prompts/index.ts` | No changes needed (buildPrompt is generic) |
| `CLAUDE.md` | Update agent templates table to reflect writer/reviewer split |

### Files to Delete

| File Path | Reason |
|-----------|--------|
| `prompts/agents/script-agent.md` | Replaced by `script-writer.md` + `script-reviewer.md` |

---

## Design Decisions

### Key Decisions Made

1. **Two-call pipeline, not two-agent pipeline**: The reviewer is a single Claude call (not an agent loop with tools). It receives the script + voice profile and either approves or rewrites. This keeps it fast and cheap (~1 API call, not 5-15).

2. **Writer keeps creative rules, reviewer gets constraint rules**: The writer gets `hook-regeln`, `hook-muster`, `body-regeln`, `cta-regeln`, `konkretion-regeln`, `storytelling-formel`, `text-hook-regeln` — everything about WHAT to write. The reviewer gets `verboten-ai-sprache`, `anti-ai-checkliste`, `anti-monotone-formatierung`, `natuerliche-satzstruktur`, `sprach-stil` — everything about HOW it should NOT sound.

3. **Regex runs BEFORE reviewer**: If we can catch em-dashes and obvious patterns with a simple string check, we save a reviewer API call on clean scripts. If regex finds issues, the reviewer is triggered. This means scripts that pass regex don't need the reviewer at all (faster, cheaper).

4. **Content-Agent keeps viral framework but drops writing rules**: The Content Agent needs to THINK about content strategy (viral framework, satzrollen, scroll-off reasons) but doesn't need the granular writing rules (hook-regeln, body-regeln, etc.) since it never writes scripts itself. Keep the `# SUNXCA VIRAL FRAMEWORK` section, remove the `# SKRIPT-REGELN` and `# KRITISCH: SPRACH-REGELN` sections.

5. **Sonnet for both writer and reviewer**: With focused prompts (~3,000-4,000 tokens each instead of 7,700), Sonnet should handle both roles well. The reviewer prompt is small enough that the anti-AI rules won't get lost. If quality is still insufficient, the reviewer can be upgraded to Opus later with a one-line model change.

6. **Reviewer can rewrite, not just flag**: The reviewer either returns "approved" (original script passes through) or returns a rewritten version. No back-and-forth loop — one shot. This prevents infinite loops and keeps latency predictable.

### Alternatives Considered

1. **Opus for everything**: Would improve constraint-following but 5x cost and slower. Rejected — the architecture fix (splitting prompts) addresses the root cause.

2. **Three-step pipeline (like weekly)**: Hook → Body → Review as separate calls. Too slow for the chat agent (user is waiting). The weekly pipeline can afford sequential steps; the chat agent needs speed.

3. **Just reorder the prompt (move anti-AI to top)**: Quick fix but doesn't solve the competing-objectives problem. Creative writing and constraint-following still fight for attention in one prompt.

4. **Fine-tuning**: Out of scope, overkill for this problem.

### Open Questions

None — all decisions are made based on the analysis.

---

## Step-by-Step Tasks

### Step 1: Create `script-writer.md`

Extract the creative writing portions of `script-agent.md` into a focused writer prompt. This prompt handles: role definition, chat-agent collaboration, tools, the 5-phase workflow (understand → angle → hook → write → submit), SUNXCA viral framework, and the content-focused rules.

**Content structure (in order):**

1. `# WER DU BIST` — Keep as-is from script-agent.md (lines 1-7)
2. `# ZUSAMMENARBEIT MIT DEM CHAT-AGENT` — Keep as-is (lines 9-16)
3. `{{platform_context}}` — Keep
4. `# DEINE TOOLS` — Keep as-is (lines 20-29)
5. `# WIE DU ARBEITEST` — Keep Phases 1-4 from script-agent.md (lines 31-108). **REMOVE Phase 5 (Self-Review)** entirely — the reviewer handles this now.
6. `# SUNXCA VIRAL FRAMEWORK` — Keep as-is (lines 139-168)
7. `# SKRIPT-REGELN` — Keep with these foundational blocks:
   - `{{hook-regeln}}`
   - `{{hook-muster}}`
   - `{{body-regeln}}`
   - `{{cta-regeln}}`
   - `{{konkretion-regeln}}`
   - `{{storytelling-formel}}`
   - `{{text-hook-regeln}}`
8. `# STIMME` — Add a short section: "Schreibe in der STIMME des Clients. Nicht in deiner. Nicht in AI-Stimme. Das Voice Profile gibt dir die Vorlage."
9. `# OUTPUT-FORMAT` — Keep as-is (lines 203-213)

**What is NOT in this prompt:**
- No `{{verboten-ai-sprache}}` (1,508 tokens saved)
- No `{{anti-ai-checkliste}}` (161 tokens saved)
- No `{{anti-monotone-formatierung}}` (218 tokens saved)
- No `{{natuerliche-satzstruktur}}` (187 tokens saved)
- No `{{sprach-stil}}` (219 tokens saved)
- No Phase 5 Self-Review (~200 tokens saved)
- Total saved: ~2,493 tokens → Writer prompt ~5,200 tokens

**Files affected:**
- `prompts/agents/script-writer.md` (new)

---

### Step 2: Create `script-reviewer.md`

Create a focused quality-gate prompt. This prompt does ONE thing: check a script for AI language, formatting issues, and voice mismatch, then either approve or rewrite.

**Content:**

```markdown
# DEINE AUFGABE

Du bist der Qualitäts-Gatekeeper für Video-Skripte. Du bekommst ein Skript und prüfst es auf AI-Sprache, unnatürliche Formatierung und Voice Mismatch. Du bist gnadenlos — wenn es nach AI klingt, schreibst du es um.

Du änderst NICHT den Inhalt, den Winkel oder die Struktur. Du änderst NUR die Sprache und Formatierung.

# PRÜFKRITERIEN

## 1. AI-Sprache (Dealbreaker)
{{verboten-ai-sprache}}

## 2. Checkliste
{{anti-ai-checkliste}}

## 3. Formatierung
{{anti-monotone-formatierung}}

## 4. Satzstruktur
{{natuerliche-satzstruktur}}

## 5. Sprachstil
{{sprach-stil}}

# VOICE MATCH

Wenn ein Voice Profile mitgeliefert wird: prüfe ob das Skript wie der Client klingt. Stimmen Wortwahl, Satzlänge, Energie überein? Wenn nicht, passe die Sprache an das Voice Profile an.

# DEIN OUTPUT

Antworte mit dem `review_script` Tool. Entweder:

**APPROVED** — Das Skript ist sauber. Keine AI-Sprache, gute Formatierung, Voice Match passt.
→ `approved: true`, `short_script` und `long_script` bleiben leer.

**REWRITTEN** — Du hast Probleme gefunden und das Skript umgeschrieben.
→ `approved: false`, `issues` beschreibt was du geändert hast, `short_script` und `long_script` enthalten die überarbeiteten Versionen.

WICHTIG: Du änderst NUR Sprache und Formatierung. Der Inhalt, der Winkel, die Struktur, der Hook-Mechanismus — alles bleibt gleich. Du polierst, du erfindest nicht neu.
```

**Estimated tokens:** ~3,000 (dominated by verboten-ai-sprache at 1,508)

**Files affected:**
- `prompts/agents/script-reviewer.md` (new)

---

### Step 3: Modify `script-agent.ts` — Add reviewer step + regex post-processing

This is the main code change. The `runScriptAgent()` function gets three additions:

**A. Regex post-processing function**

Add a function `detectAIPatterns(script: string): string[]` that checks for:
- Em-dashes (`—` and `–`) — return "Bindestriche/Gedankenstriche gefunden"
- Monotone formatting: if >60% of lines are single sentences followed by blank lines — return "Monotone Ein-Satz-pro-Zeile Formatierung"
- Banned phrases from a hardcoded subset (top 20 most common offenders): "Die meisten Menschen", "Stell dir vor", "Das Schöne daran", "Am Ende des Tages", "Und genau das ist der Punkt", "Hier kommt der Clou", "Lass das mal sacken", "Das Ergebnis?", "Der Clou?", "Das Beste?", "Nicht weil..., sondern weil...", "Die Frage ist nicht ob", rhetorical one-word questions pattern `/^(Das|Der|Die) \w+\?$/m`

**B. Reviewer call**

After the writer submits and regex finds issues, run a single Claude call with `script-reviewer.md` as system prompt. Pass:
- The writer's script (short + long)
- The voice profile (if available, pre-loaded during writer phase)
- The regex-detected issues as context

Tool for the reviewer:
```typescript
{
  name: "review_script",
  input_schema: {
    properties: {
      approved: { type: "boolean" },
      issues: { type: "string", description: "Was geändert wurde (leer wenn approved)" },
      short_script: { type: "string", description: "Überarbeitete Kurzversion (leer wenn approved)" },
      long_script: { type: "string", description: "Überarbeitete Langversion (leer wenn approved)" },
    },
    required: ["approved"]
  }
}
```

If reviewer returns `approved: true` → use writer's original script.
If reviewer returns `approved: false` → use reviewer's rewritten script.

**C. Updated flow**

```
Writer (agent loop, max 15 iterations)
  → submit_script
  → Regex check
  → If regex clean → return script (skip reviewer, save tokens)
  → If regex finds issues → Reviewer (single call)
    → If approved → return original
    → If rewritten → return rewritten version
```

**D. Change `buildPrompt("script-agent", ...)` to `buildPrompt("script-writer", ...)`**

**Files affected:**
- `src/lib/script-agent.ts`

---

### Step 4: Clean up `content-agent.md`

Remove all script-specific foundational blocks and their section headers. The Content Agent doesn't write scripts — it delegates to the Script Agent.

**Remove these sections entirely (lines ~83-119):**

```markdown
# SKRIPT-REGELN

Wenn du Skripte schreibst, bewertest oder generierst, gelten diese Regeln:

## Hook-Regeln
{{hook-regeln}}

## Hook-Muster
{{hook-muster}}

## Body-Regeln
{{body-regeln}}

## CTA-Regeln
{{cta-regeln}}

## Konkretions-Regeln
{{konkretion-regeln}}

## Storytelling-Formel
{{storytelling-formel}}

# ═══════════════════════════════════════════════════════════════
# KRITISCH: SPRACH-REGELN — GELTEN FÜR JEDE EINZELNE ANTWORT
# ═══════════════════════════════════════════════════════════════

## Verbotene AI-Sprache
{{verboten-ai-sprache}}

## Sprachstil
{{sprach-stil}}

## Natürliche Satzstruktur
{{natuerliche-satzstruktur}}

## Anti-Monotone Formatierung
{{anti-monotone-formatierung}}
```

**Keep the `# SUNXCA VIRAL FRAMEWORK` section** — the Content Agent uses this to think about content strategy, evaluate ideas, and give feedback. It's not about writing rules, it's about strategic thinking.

**Keep a slimmed-down language section** for the Content Agent's OWN chat responses (not scripts):

```markdown
# SPRACHE IM CHAT

Sprich Deutsch. Direkt. Wie eine echte Person die neben dem Client sitzt.
Keine Listen mit Bindestrichen. Keine AI-Formatierung. Kein "Hier sind deine Ergebnisse:".
Keine Bindestriche (–, —) als Stilmittel. Punkt. Neuer Satz.

BEVOR du antwortest, prüfe:
1. Habe ich Bindestriche als Stilmittel benutzt? ENTFERNEN. Punkt setzen, neuer Satz.
2. Klingt meine Antwort wie ein AI-Report? NEU SCHREIBEN wie eine Sprachnachricht.
```

This replaces the massive `# VERHALTEN` section's language rules with a compact version (~80 tokens vs. ~2,200 tokens of loaded foundational blocks).

**Token savings:** ~4,300 tokens per chat message.

**Files affected:**
- `prompts/agents/content-agent.md`

---

### Step 5: Delete `script-agent.md`

Remove the old monolithic prompt now that it's split into writer + reviewer.

**Files affected:**
- `prompts/agents/script-agent.md` (delete)

---

### Step 6: Update `CLAUDE.md`

Update the Agent Templates table to reflect the new structure:

**Replace the `script-agent.md` row with:**

| Agent | Pipeline Step | Key Placeholders |
|-------|---------------|------------------|
| `script-writer.md` | Script Agent: Creative Writing | `{{platform_context}}`, auto: hook-regeln, hook-muster, body-regeln, cta-regeln, konkretion-regeln, storytelling-formel, text-hook-regeln |
| `script-reviewer.md` | Script Agent: Quality Gate | auto: verboten-ai-sprache, anti-ai-checkliste, anti-monotone-formatierung, natuerliche-satzstruktur, sprach-stil |

**Update the Content Agent description** to note it no longer loads script rules:

| `content-agent.md` | Content Agent (Portal Chat) | `{{platform_context}}` (script rules removed — delegated to Script Agent) |

**Update the Script Generation section** in "How The System Works" to mention the writer/reviewer split.

**Files affected:**
- `CLAUDE.md`

---

### Step 7: Test end-to-end

1. Start dev server: `npm run dev`
2. Open chat, select a client (e.g. Elliott)
3. Ask the agent to write a script on any topic
4. Verify:
   - Writer produces a script (check server logs for `buildPrompt("script-writer", ...)`)
   - Regex check runs and reports findings
   - If issues found, reviewer runs and rewrites
   - Final script has NO em-dashes, NO monotone formatting, NO banned phrases
5. Check Content Agent responses in chat are also clean (no AI formatting in the agent's own messages)
6. Compare token usage in Anthropic dashboard: content-agent calls should be ~4,300 tokens smaller

**Files affected:** None (testing only)

---

## Connections & Dependencies

### Files That Reference This Area

| File | Reference |
|------|-----------|
| `src/lib/agent-tools.ts` | `import { runScriptAgent }` — no changes needed, interface stays the same |
| `src/app/api/chat/route.ts` | Uses `buildPrompt("content-agent", ...)` — no changes needed |
| `prompts/index.ts` | Re-exports buildPrompt — no changes needed |
| `prompts/tools.ts` | Agent tool schemas — no changes needed (generate_script tool stays the same) |

### Updates Needed for Consistency

- `CLAUDE.md` agent templates table (Step 6)
- Memory file `project_current_state.md` — update after implementation

### Impact on Existing Workflows

- **Content Agent chat**: Faster (fewer tokens), no behavior change (it never used the script rules)
- **Script generation via chat**: Same API, same input/output format. Scripts will be higher quality. Slightly more latency when reviewer is triggered (~2-4 seconds for one additional API call)
- **Weekly pipeline**: NOT affected — it has its own separate prompts (hook-generation.md, body-writing.md, quality-review.md)
- **Viral script builder**: NOT affected — it has its own prompts

---

## Validation Checklist

- [ ] `script-writer.md` exists and loads correctly via `buildPrompt("script-writer", { platform_context: "..." })`
- [ ] `script-reviewer.md` exists and loads correctly via `buildPrompt("script-reviewer", {})`
- [ ] `script-agent.md` is deleted
- [ ] `content-agent.md` no longer contains `{{hook-regeln}}`, `{{body-regeln}}`, `{{verboten-ai-sprache}}` etc.
- [ ] `script-agent.ts` runs writer → regex → (optional reviewer) → returns script
- [ ] Generated scripts contain zero em-dashes
- [ ] Generated scripts don't have monotone one-sentence-per-line formatting
- [ ] Content Agent chat responses are unaffected (still works normally)
- [ ] `ScriptAgentResult` interface unchanged (agent-tools.ts still works)
- [ ] CLAUDE.md updated with new agent table entries
- [ ] TypeScript compiles without errors

---

## Success Criteria

The implementation is complete when:

1. Scripts generated via the chat agent contain zero em-dashes and no banned AI phrases
2. Content Agent system prompt is ~2,900 tokens instead of ~7,200 tokens
3. The reviewer is only triggered when regex detects issues (no unnecessary API calls)
4. The external API (ScriptAgentResult, toolGenerateScript) is unchanged — no breaking changes for the chat route

---

## Notes

- **Future upgrade path**: If the reviewer on Sonnet still lets issues through, change the model in the reviewer call from `claude-sonnet-4-6` to `claude-opus-4-6`. One-line change in `script-agent.ts`. The focused 3,000-token prompt should make this unnecessary, but the option is there.
- **Regex list maintenance**: The hardcoded banned phrases in the regex check are a subset of `verboten-ai-sprache.md`. If the foundational prompt grows, the regex list should be updated too. Consider auto-parsing the .md file for the regex list in a future iteration.
- **Monitoring**: After deployment, check the first 5-10 generated scripts manually. If the reviewer triggers on >50% of scripts, the writer prompt may need adjustment (more emphasis on natural language in the writer itself).

---

## Implementation Notes

**Implemented:** 2026-04-16

### Summary

Split the monolithic script-agent into a Writer (creative focus, ~5,144 tokens) + Reviewer (quality gate, ~2,656 tokens) pipeline. Added regex-based AI pattern detection (em-dashes, banned phrases, monotone formatting) as a fast pre-filter before the reviewer. Removed ~4,400 tokens of duplicate script rules from the Content Agent (7,200 → 2,812 tokens). The reviewer only runs when regex detects issues, saving tokens on clean scripts.

### Deviations from Plan

- Writer prompt came in at ~5,144 tokens (plan estimated ~4,000-5,200). Within range.
- Reviewer prompt came in at ~2,656 tokens (plan estimated ~3,000). Slightly under.
- Also fixed em-dashes in content-agent.md intro text (not in original plan but consistent with the goal).

### Issues Encountered

None.
