# Plan: Modular Prompt Architecture — Markdown Files with Placeholder Substitution

**Created:** 2026-03-25
**Status:** Implemented
**Request:** Restructure all script-generation prompts into a modular markdown-based system (inspired by Authority AI), with mother prompts + sub-prompts, massively expanded German AI language bans, and training-script-based examples.

---

## Overview

### What This Plan Accomplishes

Migrate the entire prompt system from TypeScript template literals to a **markdown-based modular architecture** with:
- **Agent templates** (mother prompts) with `{{placeholder}}` syntax in `src/lib/prompts/agents/`
- **Foundational sub-prompts** (single-concern markdown files) in `src/lib/prompts/foundational/`
- A **loader/builder** that auto-resolves placeholders from foundational files or passed substitutions
- Tool schemas remain in TypeScript (they need code)
- **3x expansion** of the banned AI language list (from ~35 to 100+ patterns)
- New prompt modules adapted from Authority AI: anti-monotonous formatting, natural sentence structure, hook psychological framework, script examples

### Why This Matters

1. **Reviewability** — Each sub-prompt is a standalone `.md` file. Aysun or Oleg can review/edit individual concerns (e.g. "banned AI phrases" or "hook rules") without touching code.
2. **Modularity** — Same foundational prompt reused across multiple agent templates without duplication.
3. **Quality** — Massively expanded AI language detection catches more German ChatGPT patterns.
4. **Consistency** — Follows the same proven architecture as the Authority AI platform.

---

## Current State

### Relevant Existing Structure

```
src/lib/prompts/
├── index.ts              # Barrel exports + composed system prompts (weekScriptsSystemPrompt, etc.)
├── hooks.ts              # HOOK_RULES, HOOK_PATTERNS (exported string constants)
├── language.ts           # LANGUAGE_RULES, VOICE_MATCHING_INSTRUCTIONS(), LENGTH_RULES()
├── quality.ts            # BODY_RULES, CTA_RULES, CONCRETENESS_RULES, VARIETY_RULES, TITLE_RULES, ANTI_PATTERNS
├── scripting.ts          # WEEK_COHERENCE_RULES(), REASONING_RULES, AUDIT_USAGE_RULES, TOPIC_SPECIFICITY_RULES
├── topic-selection.ts    # topicSelectionSystemPrompt() + TOPIC_SELECTION_TOOL
├── hook-generation.ts    # HOOK_GENERATION_SYSTEM + HOOK_GENERATION_TOOL
├── body-writing.ts       # bodyWritingSystemPrompt() + BODY_WRITING_TOOL
├── quality-review.ts     # QUALITY_REVIEW_SYSTEM + QUALITY_REVIEW_TOOL
├── voice-profile.ts      # VOICE_PROFILE_SYSTEM + VOICE_PROFILE_TOOL
├── script-structure.ts   # SCRIPT_STRUCTURE_SYSTEM + SCRIPT_STRUCTURE_TOOL
├── trend-research.ts     # trendResearchSystemPrompt() + TREND_RESEARCH_TOOL
├── strategy-analysis.ts  # STRATEGY_ANALYSIS_SYSTEM + STRATEGY_ANALYSIS_TOOL
├── strategy-creation.ts  # strategyCreationSystemPrompt() + STRATEGY_CREATION_TOOL
├── strategy-review.ts    # STRATEGY_REVIEW_SYSTEM + STRATEGY_REVIEW_TOOL
├── strategy-generation.ts # Type definitions
└── analysis.ts           # ANALYSIS_PROMPT + buildConceptsPrompt()
```

**Current approach:** Rules are TypeScript string constants, composed via template literal interpolation in `index.ts`. Already somewhat modular (separate files per concern) but rules are embedded in code strings — hard to review/edit without a code editor.

### Gaps or Problems Being Addressed

1. **Rules embedded in TypeScript** — Non-developers can't review/edit without parsing JS template literals
2. **AI language ban list too small** — Only ~35 patterns; research shows 100+ common German AI patterns
3. **No anti-monotonous formatting rules** — Authority AI has strong rules against the "one line → blank line → one line" AI tell
4. **No natural sentence structure guidance** — No explicit rules about mixing paragraph density, sentence length variety
5. **No hook psychological framework** — Authority AI has a complete Hook/Retain/Reward framework with formulas
6. **No script examples in prompts** — Body writing has no example scripts to anchor quality; training scripts could serve this role
7. **No placeholder-based composition** — Can't swap out sub-prompts without editing code

---

## Proposed Changes

### Summary of Changes

- Create `src/lib/prompts/foundational/` directory with 20+ standalone `.md` sub-prompt files
- Create `src/lib/prompts/agents/` directory with 10 mother prompt templates using `{{placeholder}}`
- Create `src/lib/prompts/loader.ts` — markdown file loader + `buildPrompt()` function
- Create `src/lib/prompts/tools.ts` — all tool schemas consolidated in one file
- Rewrite `src/lib/prompts/index.ts` — thin re-export layer
- Delete old `.ts` prompt files (hooks.ts, language.ts, quality.ts, scripting.ts, hook-generation.ts, etc.)
- Expand banned AI language from ~35 to 100+ German patterns
- Add new foundational prompts: anti-monotonous formatting, natural sentence structure, hook framework, script examples
- Update all API route files to use `buildPrompt()` instead of direct imports

### New Files to Create

#### Foundational Sub-Prompts (`src/lib/prompts/foundational/`)

| File Path | Purpose |
|-----------|---------|
| `foundational/rolle-skriptschreiber.md` | Role definition: "You are an elite script writer for Instagram Reels..." |
| `foundational/verboten-ai-sprache.md` | **Massively expanded** banned AI language list (100+ patterns in 12 categories) |
| `foundational/hook-regeln.md` | Core hook rules: 1-2 sentences, open loop, 3-second grab |
| `foundational/hook-muster.md` | 8 proven hook patterns with German examples |
| `foundational/hook-framework.md` | **NEW**: Hook/Retain/Reward psychological framework (adapted from Authority AI) |
| `foundational/body-regeln.md` | Body rules: one thought per paragraph, no repetition |
| `foundational/cta-regeln.md` | CTA rules: concrete, varied, forces interaction |
| `foundational/konkretion-regeln.md` | Concreteness rules: numbers, examples, mental images |
| `foundational/abwechslung-regeln.md` | Variety rules: emotional registers, content types |
| `foundational/titel-regeln.md` | Title rules: max 10 words, specific not clickbait |
| `foundational/anti-muster.md` | Negative examples — what NOT to do |
| `foundational/sprach-stil.md` | Language style: spoken German, direct, rough, authentic |
| `foundational/stimm-matching.md` | Voice matching template (with `{{client_name}}` placeholder) |
| `foundational/anti-monotone-formatierung.md` | **NEW**: Ban the "one line → blank line" AI pattern, require natural paragraph variety |
| `foundational/natuerliche-satzstruktur.md` | **NEW**: Variable sentence lengths, mixed density, imperfect structure |
| `foundational/wochen-koherenz.md` | Week coherence: pillar balance, hook variety, emotional range |
| `foundational/reasoning-regeln.md` | Data-driven reasoning: cite audit, explain why |
| `foundational/audit-nutzung.md` | How to read and apply audit/performance/competitor data |
| `foundational/themen-spezifizitaet.md` | Topic specificity: concrete not generic, with examples |
| `foundational/skript-beispiele.md` | **NEW**: 3-5 example scripts pulled from training data as quality anchors |
| `foundational/anti-ai-checkliste.md` | Post-generation 5-point checklist for AI detection |

#### Agent Templates (`src/lib/prompts/agents/`)

| File Path | Purpose |
|-----------|---------|
| `agents/topic-selection.md` | Mother prompt for strategic topic selection |
| `agents/hook-generation.md` | Mother prompt for hook creation (3 options + select) |
| `agents/body-writing.md` | Mother prompt for body + CTA writing |
| `agents/quality-review.md` | Mother prompt for quality review of all scripts |
| `agents/voice-profile.md` | Mother prompt for voice profile extraction |
| `agents/script-structure.md` | Mother prompt for script structure extraction |
| `agents/trend-research.md` | Mother prompt for trend identification |
| `agents/strategy-analysis.md` | Mother prompt for strategy data analysis |
| `agents/strategy-creation.md` | Mother prompt for strategy creation |
| `agents/strategy-review.md` | Mother prompt for strategy review |

#### Code Files

| File Path | Purpose |
|-----------|---------|
| `src/lib/prompts/loader.ts` | `loadFoundational()`, `loadAgent()`, `buildPrompt()` functions |
| `src/lib/prompts/tools.ts` | All tool schemas consolidated (moved from individual prompt files) |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `src/lib/prompts/index.ts` | Rewrite: thin re-export of `buildPrompt`, `loadFoundational`, and all tools from `tools.ts` |
| `src/app/api/configs/[id]/generate-week-scripts/route.ts` | Use `buildPrompt()` for each pipeline step |
| `src/app/api/configs/[id]/generate-voice-profile/route.ts` | Use `buildPrompt()` |
| Any other API routes using prompt imports | Switch to `buildPrompt()` calls |

### Files to Delete

| File Path | Reason |
|-----------|--------|
| `src/lib/prompts/hooks.ts` | Content moved to `foundational/hook-regeln.md` + `hook-muster.md` |
| `src/lib/prompts/language.ts` | Content moved to `foundational/verboten-ai-sprache.md` + `sprach-stil.md` + `stimm-matching.md` |
| `src/lib/prompts/quality.ts` | Content moved to multiple foundational files |
| `src/lib/prompts/scripting.ts` | Content moved to multiple foundational files |
| `src/lib/prompts/hook-generation.ts` | System prompt → `agents/hook-generation.md`, tool → `tools.ts` |
| `src/lib/prompts/body-writing.ts` | System prompt → `agents/body-writing.md`, tool → `tools.ts` |
| `src/lib/prompts/topic-selection.ts` | System prompt → `agents/topic-selection.md`, tool → `tools.ts` |
| `src/lib/prompts/quality-review.ts` | System prompt → `agents/quality-review.md`, tool → `tools.ts` |
| `src/lib/prompts/voice-profile.ts` | System prompt → `agents/voice-profile.md`, tool → `tools.ts` |
| `src/lib/prompts/script-structure.ts` | System prompt → `agents/script-structure.md`, tool → `tools.ts` |
| `src/lib/prompts/trend-research.ts` | System prompt → `agents/trend-research.md`, tool → `tools.ts` |
| `src/lib/prompts/strategy-analysis.ts` | System prompt → `agents/strategy-analysis.md`, tool → `tools.ts` |
| `src/lib/prompts/strategy-creation.ts` | System prompt → `agents/strategy-creation.md`, tool → `tools.ts` |
| `src/lib/prompts/strategy-review.ts` | System prompt → `agents/strategy-review.md`, tool → `tools.ts` |
| `src/lib/prompts/strategy-generation.ts` | Types can move to `tools.ts` or a types file |

**Keep:** `src/lib/prompts/analysis.ts` (Gemini video analysis — separate pipeline, not part of script generation)

---

## Design Decisions

### Key Decisions Made

1. **Markdown files for prompt text, TypeScript for tool schemas**: Tool schemas need `type: "object" as const` and other TypeScript constructs. Keeping them in code is cleaner than trying to serialize JSON schemas in markdown. The `tools.ts` file consolidates all schemas.

2. **Same `{{placeholder}}` convention as Authority AI**: Uses `{{name}}` syntax. The builder first checks passed substitutions, then auto-loads matching foundational file. This means static rules auto-resolve and dynamic values (client name, max words) are passed explicitly.

3. **Parameterized prompts via substitutions, not functions**: Instead of `LENGTH_RULES(maxWords, durationLabel)`, the caller passes `{ laenge_regeln: "Max 60 Wörter..." }` as a substitution. Foundational files that need parameters use their own `{{placeholder}}` syntax (resolved in the same pass).

4. **Separate `verboten-ai-sprache.md` from `sprach-stil.md`**: The banned phrases list (100+ items) is a distinct concern from general style rules (tone, brevity, substance). Splitting them means you can review/expand the ban list without touching style rules.

5. **Script examples from training data**: Instead of hardcoding example scripts like Authority AI does with LinkedIn posts, we'll pull 3-5 of the client's best training scripts at runtime and inject them as `{{skript_beispiele}}`. Fallback: a `foundational/skript-beispiele.md` with generic high-quality German Reel script examples.

6. **German language throughout**: All foundational prompts in German (matching the current system). The expanded AI ban list is all German patterns.

7. **Keep analysis.ts unchanged**: The Gemini video analysis pipeline is separate from script generation and doesn't benefit from this refactor.

### Alternatives Considered

1. **YAML-based prompt config** — Rejected: more complex, no benefit over plain markdown for this use case.
2. **Keep TypeScript strings, just expand banned list** — Rejected: doesn't achieve the reviewability goal. The whole point is markdown files that non-developers can read.
3. **Use a prompt management platform (e.g., Langfuse)** — Rejected: adds external dependency, overkill for this project size.

### Open Questions

1. **Script examples strategy**: Should we use hardcoded generic German Reel examples in `foundational/skript-beispiele.md`, or dynamically inject the client's training scripts at runtime? **Recommendation:** Both — hardcoded examples as fallback, client training scripts injected when available.
2. **Strategy pipeline scope**: Should the strategy prompts (analysis, creation, review) also be migrated to markdown, or just the script generation pipeline? **Recommendation:** Migrate everything for consistency. The effort is the same.

---

## Step-by-Step Tasks

### Step 1: Create the Loader System

Create the markdown file loader and prompt builder.

**Actions:**

- Create `src/lib/prompts/loader.ts` with:
  - `loadFoundational(name: string): string` — reads `foundational/{name}.md`
  - `loadAgent(name: string): string` — reads `agents/{name}.md`
  - `buildPrompt(agentName: string, substitutions: Record<string, string>): string` — loads agent template, replaces `{{placeholder}}` patterns (first checks substitutions, then auto-loads foundational)
- Create empty directories: `src/lib/prompts/foundational/`, `src/lib/prompts/agents/`

**Files affected:**
- `src/lib/prompts/loader.ts` (new)

---

### Step 2: Create Foundational Sub-Prompts — Core Rules

Migrate existing rules from TypeScript constants to individual markdown files, expanding and improving each one.

**Actions:**

Create these foundational files (content adapted from current TypeScript + expanded):

- **`foundational/rolle-skriptschreiber.md`** — Role definition:
  ```markdown
  Du bist ein erstklassiger Skriptschreiber für Instagram Reels und Short-Form Video Content.
  Du schreibst Skripte die der Kunde 1:1 auf Kamera vorlesen und aufnehmen kann.
  Dein Fokus: Maximale Wirkung in minimaler Zeit. Jedes Wort muss sitzen.
  ```

- **`foundational/hook-regeln.md`** — Migrated from `HOOK_RULES` in hooks.ts

- **`foundational/hook-muster.md`** — Migrated from `HOOK_PATTERNS` in hooks.ts

- **`foundational/body-regeln.md`** — Migrated from `BODY_RULES` in quality.ts

- **`foundational/cta-regeln.md`** — Migrated from `CTA_RULES` in quality.ts

- **`foundational/konkretion-regeln.md`** — Migrated from `CONCRETENESS_RULES` in quality.ts

- **`foundational/abwechslung-regeln.md`** — Migrated from `VARIETY_RULES` in quality.ts

- **`foundational/titel-regeln.md`** — Migrated from `TITLE_RULES` in quality.ts

- **`foundational/anti-muster.md`** — Migrated from `ANTI_PATTERNS` in quality.ts

- **`foundational/reasoning-regeln.md`** — Migrated from `REASONING_RULES` in scripting.ts

- **`foundational/audit-nutzung.md`** — Migrated from `AUDIT_USAGE_RULES` in scripting.ts

- **`foundational/themen-spezifizitaet.md`** — Migrated from `TOPIC_SPECIFICITY_RULES` in scripting.ts

**Files affected:**
- 12 new `.md` files in `foundational/`

---

### Step 3: Create the Massively Expanded AI Language Ban List

The flagship foundational prompt. Expands from ~35 to 100+ banned patterns.

**Actions:**

Create **`foundational/verboten-ai-sprache.md`** with 12 categories:

```markdown
# VERBOTEN — Typische AI-Sprache

Wenn du eine dieser Phrasen schreibst, ist das Skript gescheitert.
Auch keine Synonyme oder leichte Abwandlungen.

## 1. Eröffnungsfloskeln
- "Die meisten Menschen..."
- "Viele Menschen..."
- "Stell dir vor..."
- "In der heutigen Zeit..."
- "In der heutigen hektischen Welt..."
- "In einer Welt, in der..."
- "Hast du dich jemals gefragt..."
- "Lass mich dir erzählen..."
- "Hier ist die Wahrheit:"
- "Wusstest du, dass..."
- "Es gibt da etwas..."
- "Immer mehr Menschen fragen sich..."
- "Es ist kein Geheimnis, dass..."
- "Lass uns..." / "Lassen Sie uns..."
- "Tauchen wir ein..."
- "Ich nehme dich mit auf eine Reise..."

## 2. Übergangsfloskeln
- "Das Schöne daran ist..."
- "Am Ende des Tages..."
- "Anders gesagt..."
- "Was bedeutet das konkret?"
- "Und genau das ist der Punkt."
- "Hier kommt der Clou:"
- "Und weißt du was?"
- "Aber jetzt kommt's:"
- "Und das Beste daran?"
- "Darüber hinaus..."
- "Des Weiteren..."
- "Nicht nur..., sondern auch..."
- "Es ist jedoch wichtig zu beachten, dass..."

## 3. Füllwörter
- gewissermaßen, sozusagen, im Grunde genommen
- tatsächlich (als Füllwort), letztendlich, grundsätzlich
- interessanterweise, spannenderweise
- zudem, ferner, folglich, zusätzlich

## 4. Motivations-Kitsch
- "Du schaffst das!"
- "Glaub an dich!"
- "Es ist nie zu spät"
- "Der erste Schritt ist der wichtigste"
- "Du bist nicht allein damit"
- "Das verändert alles"
- "Du wirst es nicht glauben"
- "Aufs nächste Level bringen" / "nächstes Level"
- "Potenzial entfalten"
- "Neue Perspektiven eröffnen"

## 5. Struktur-Muster
- "Erstens... Zweitens... Drittens..."
- "Also zusammengefasst..."
- "Nicht weil..., sondern weil..." (typische AI-Kontrastformel)
- "Die Frage ist nicht ob, sondern..."
- "Lass das mal sacken"
- "Nicht wahr?"
- "Abschließend lässt sich sagen, dass..."
- "Zusammenfassend lässt sich sagen, dass..."
- "Im Großen und Ganzen..."

## 6. Pseudo-Empathie
- "Ich weiß wie du dich fühlst"
- "Das kenne ich nur zu gut"
- "Wir alle kennen das"
- "Sei mal ehrlich zu dir selbst"
- "Hand aufs Herz"

## 7. Überbenutzte Adjektive
- umfassend, ganzheitlich, bahnbrechend, nahtlos
- robust, facettenreich, nuanciert, entscheidend
- wegweisend, herausragend, maßgeblich, überragend

## 8. Überbenutzte Verben
- eintauchen, revolutionieren, optimieren, transformieren
- entfalten, meistern, sicherstellen, gewährleisten, fördern

## 9. Überbenutzte Substantive
- Paradigmenwechsel, Landschaft (metaphorisch)
- Dreh- und Angelpunkt, Kernaussage
- "eine Vielzahl an...", "eine breite Palette an..."
- "zahlreiche Vorteile"

## 10. Rhetorische Einwort-Fragen (DER schlimmste AI-Tell)
- "Das Ergebnis?", "Der Clou?", "Das Beste?"
- "Der Unterschied?", "Die Lösung?", "Mein Rat?"
- "Die Lektion?", "Was passierte?"

## 11. Leere Autoritätsphrasen
- "Es ist wichtig zu beachten, dass..."
- "Es ist bemerkenswert, dass..."
- "Es versteht sich von selbst, dass..."
- "Viele Experten sind sich einig, dass..."

## 12. Pretentiöse Kurzfragmente
NICHT: "Innovation. Disruption. Transformation. Das definiert Erfolg."
SONDERN: Konkret. Spezifisch. Wie ein echter Mensch reden würde.
```

**Also create `foundational/anti-ai-checkliste.md`** — the 5-point post-generation check (migrated from LANGUAGE_RULES).

**Files affected:**
- `foundational/verboten-ai-sprache.md` (new)
- `foundational/anti-ai-checkliste.md` (new)

---

### Step 4: Create New Foundational Prompts (Adapted from Authority AI)

These are entirely new prompt modules that don't exist in the current system.

**Actions:**

- **`foundational/sprach-stil.md`** — General language style (migrated from LANGUAGE_RULES, but without the VERBOTEN section which is now separate):
  ```markdown
  SPRACHE:
  Gesprochenes Deutsch. Kurze Sätze. Direkte Anrede ("du").
  Wie man redet, nicht schreibt.
  Sprechrhythmus: Kurz. Kurz. Dann ein längerer Satz. Dann wieder kurz.
  ...
  ```

- **`foundational/anti-monotone-formatierung.md`** — **NEW** (adapted from Authority AI's anti-monotonous formatting rules):
  ```markdown
  # Anti-Monotone Formatierung

  DER #1 AI-TELL BEI SKRIPTEN: Jeder Satz in einer eigenen Zeile mit doppeltem
  Zeilenumbruch dazwischen. Dieses "ein Satz → Leerzeile → ein Satz" Muster = offensichtlich AI.

  WAS NATÜRLICHE STRUKTUR AUSSIEHT:
  - Manchmal laufen 2-3 Sätze in einem Absatz zusammen
  - Dann eine kurze punchige Zeile allein
  - Dann wieder ein fließender Absatz mit mehreren Gedanken
  - Manche Abschnitte dicht und schnell, andere atmen mit Raum
  - Unvollkommene Formatierung — nicht jede Zeile muss ein perfektes Statement sein

  DAS ZIEL:
  Schreib wie jemand der seine echten Gedanken tippt. Die Struktur soll sich leicht
  chaotisch anfühlen, leicht unvollkommen — wie ein echter Mensch es in einem Zug
  geschrieben und aufgenommen hat.
  ```

- **`foundational/natuerliche-satzstruktur.md`** — **NEW** (adapted from Authority AI):
  ```markdown
  # Natürliche Satzstruktur

  VARIABLE UND FLEXIBLE STRUKTUR:
  - Manche Sätze: eine Zeile
  - Manche Sätze: durch \n getrennt (einfacher Zeilenumbruch)
  - Manche Sätze: durch \n\n getrennt (doppelter Zeilenumbruch)
  - Kurze punchige + lange Sätze gemischt

  STRATEGISCHE INTERPUNKTION:
  - Stil flexibel halten
  - Manchmal CAPS für Betonung
  - Manchmal "..." und andere Interpunktion
  - Interpunktion strategisch einsetzen wie in den Beispielen

  STIMME:
  - Konversationell, spezifisch, geerdet in echter Erfahrung
  - Natürliche Satzvariation (kurze Sätze sind SUPER wenn konversationell)
  - Kein künstliches Drama oder erzwungene Tiefgründigkeit
  ```

- **`foundational/hook-framework.md`** — **NEW** (adapted from Authority AI's Hook/Retain/Reward framework, localized for German Reels):
  ```markdown
  # Hook/Retain/Reward Framework

  ## HOOK (Erste 1-3 Sekunden): Scroll stoppen
  - Wähle aus: Persönliche Erfahrung, Provokante These, Kontrast, Konkrete Beobachtung, Universelles Problem
  - Mindestens 2 Elemente: Relevanz + Konflikt/Überraschung/Identifikation
  - Sofortiges Verständnis: Kein Kontext nötig, jeder versteht es in 2 Sekunden

  Hook-Formeln die funktionieren:
  - Persönliche Erfahrung: "Ich hab 3 Jahre lang X falsch gemacht."
  - Provokante These: "Dein Coach lügt dich an."
  - Kontrast-Wahrheit: "Hör auf X zu machen. Fang an mit Y."
  - Konkrete Beobachtung: "[Spezifische Situation] hat mir [unerwartete Lektion] gezeigt."
  - Universelles Problem: "Warum machst du [nervige Sache] wenn [bessere Option]?"

  ## RETAIN (Mittelteil): Dranbleiben erzwingen
  - 3 Methoden: Listen, Schritte, Geschichten
  - Jeder Satz bringt EINE neue Information
  - Spezifisch und konkret — keine vagen Aussagen
  - Progressive Wertlieferung — es wird besser, nicht schlechter

  ## REWARD (Ende): Belohnung liefern
  - Erwartung erfüllen oder übertreffen
  - Klare, umsetzbare Erkenntnis
  - Einprägsamer Takeaway
  ```

- **`foundational/stimm-matching.md`** — Voice matching template (migrated from `VOICE_MATCHING_INSTRUCTIONS`):
  ```markdown
  VOICE MATCHING — HÖCHSTE PRIORITÄT:
  Die Voice-Beispiele zeigen wie {{client_name}} WIRKLICH spricht.
  Dein Skript muss klingen als hätte {{client_name}} es selbst geschrieben.
  ...
  ```

- **`foundational/skript-beispiele.md`** — Placeholder file with instructions for runtime injection:
  ```markdown
  # Skript-Beispiele

  Die folgenden Skripte sind bewährte Beispiele die den gewünschten Qualitätsstandard zeigen.
  Orientiere dich an Stil, Struktur und Ton — aber kopiere nicht.

  {{beispiel_skripte}}
  ```
  At runtime, `{{beispiel_skripte}}` is replaced with actual training scripts from the client.

**Files affected:**
- 6 new `.md` files in `foundational/`

---

### Step 5: Create Agent Templates (Mother Prompts)

Convert each pipeline step's system prompt into a markdown agent template with `{{placeholder}}` syntax.

**Actions:**

Create each agent template. Example structure for **`agents/body-writing.md`**:

```markdown
# PART 1: DEINE ROLLE
{{rolle-skriptschreiber}}

# PART 2: AUFGABE
Der Hook steht bereits fest — du schreibst NUR Body und CTA.
1. Der Hook zieht den Zuschauer rein. Dein Body LÖST das offene Loop ein.
2. Jeder Absatz = ein neuer Gedanke. Keine Wiederholungen.
3. Am Ende: ein CTA der zur Interaktion zwingt.
4. Der Kunde liest den Text 1:1 auf Kamera vor.

# PART 3: HOOK/RETAIN/REWARD FRAMEWORK
{{hook-framework}}

# PART 4: QUALITÄTSREGELN
{{body-regeln}}
{{cta-regeln}}
{{konkretion-regeln}}

# PART 5: SPRACHE & STIMME
{{sprach-stil}}
{{verboten-ai-sprache}}
{{anti-ai-checkliste}}
{{laenge_regeln}}

# PART 6: NATÜRLICHE STRUKTUR
{{anti-monotone-formatierung}}
{{natuerliche-satzstruktur}}

# PART 7: VOICE MATCHING
{{stimm_matching}}

# PART 8: SKRIPT-STRUKTUR DES KUNDEN
{{skript_struktur}}

# PART 9: BEISPIEL-SKRIPTE
{{skript_beispiele}}

# PART 10: KONTEXT
## Thema
{{topic_title}}: {{topic_description}}

## Gewählter Hook
{{chosen_hook}}

## Brand & Client
{{client_context}}
{{brand_context}}
```

Similarly create agent templates for:
- **`agents/topic-selection.md`** — Parts: Role, Task, Audit Usage, Topic Specificity, Anti-Patterns, Strategy Context, Data Context
- **`agents/hook-generation.md`** — Parts: Role (hook specialist), Hook Rules, Hook Patterns, Hook Framework, Process, Anti-AI, Topic, Competitor Hooks, Used Patterns
- **`agents/quality-review.md`** — Parts: Role (quality reviewer), Banned AI Language, Anti-AI Checklist, Anti-Monotone Formatting, Voice Matching, Process, Scripts to Review
- **`agents/voice-profile.md`** — Parts: Role (linguist), Extraction Instructions, Output Schema
- **`agents/script-structure.md`** — Parts: Role (dramaturg), Extraction Instructions, Output Schema
- **`agents/trend-research.md`** — Parts: Role (trend analyst), Niche Context, Date
- **`agents/strategy-analysis.md`** — Parts: Role (strategist), Analysis Instructions, Data Context
- **`agents/strategy-creation.md`** — Parts: Role, Creation Rules, Topic Specificity, Concreteness, Context
- **`agents/strategy-review.md`** — Parts: Role, Review Criteria, Strategy to Review

**Files affected:**
- 10 new `.md` files in `agents/`

---

### Step 6: Consolidate Tool Schemas

Move all Anthropic tool schemas from individual prompt files into one `tools.ts`.

**Actions:**

- Create `src/lib/prompts/tools.ts` containing:
  - `TOPIC_SELECTION_TOOL(days, pillarNames, contentTypeNames, formatNames)`
  - `HOOK_GENERATION_TOOL`
  - `BODY_WRITING_TOOL(maxWords)`
  - `QUALITY_REVIEW_TOOL(numScripts)`
  - `VOICE_PROFILE_TOOL`
  - `SCRIPT_STRUCTURE_TOOL`
  - `TREND_RESEARCH_TOOL`
  - `STRATEGY_ANALYSIS_TOOL`
  - `STRATEGY_CREATION_TOOL(activeDays, contentTypes, formats)`
  - `STRATEGY_REVIEW_TOOL(activeDays)`
- Also move type definitions from `strategy-generation.ts`

**Files affected:**
- `src/lib/prompts/tools.ts` (new)

---

### Step 7: Rewrite index.ts

Thin re-export layer that exposes the new API.

**Actions:**

Rewrite `src/lib/prompts/index.ts`:
```typescript
// Loader
export { buildPrompt, loadFoundational, loadAgent } from "./loader";

// Tool schemas
export {
  TOPIC_SELECTION_TOOL,
  HOOK_GENERATION_TOOL,
  BODY_WRITING_TOOL,
  QUALITY_REVIEW_TOOL,
  VOICE_PROFILE_TOOL,
  SCRIPT_STRUCTURE_TOOL,
  TREND_RESEARCH_TOOL,
  STRATEGY_ANALYSIS_TOOL,
  STRATEGY_CREATION_TOOL,
  STRATEGY_REVIEW_TOOL,
} from "./tools";

// Types
export type { StrategyPromptContext, StrategyOutput } from "./tools";

// Video analysis (separate pipeline, unchanged)
export { ANALYSIS_PROMPT, buildConceptsPrompt } from "./analysis";
```

The old composed functions (`weekScriptsSystemPrompt`, `singleScriptSystemPrompt`, etc.) are replaced by `buildPrompt()` calls in the API routes.

**Files affected:**
- `src/lib/prompts/index.ts` (rewrite)

---

### Step 8: Update API Routes

Update all API route handlers to use `buildPrompt()` instead of importing TypeScript prompt constants.

**Actions:**

For each API route that uses prompts:

**Example — `generate-week-scripts/route.ts` hook generation step:**
```typescript
// Before:
import { HOOK_GENERATION_SYSTEM } from "@/lib/prompts";
const systemPrompt = HOOK_GENERATION_SYSTEM;

// After:
import { buildPrompt } from "@/lib/prompts";
const systemPrompt = buildPrompt('hook-generation', {
  stimm_matching: voiceProfile ? voiceMatchingText : '',
  topic_title: topic.title,
  topic_description: topic.description,
  competitor_hooks: competitorHooksList,
  used_patterns: usedPatternsList,
  laenge_regeln: `Max ${maxWords} Wörter...`,
  // foundational files auto-loaded: hook-regeln, hook-muster, verboten-ai-sprache, etc.
});
```

Update all pipeline steps:
1. Topic selection step → `buildPrompt('topic-selection', { ... })`
2. Hook generation step → `buildPrompt('hook-generation', { ... })`
3. Body writing step → `buildPrompt('body-writing', { ... })`
4. Quality review step → `buildPrompt('quality-review', { ... })`
5. Voice profile generation → `buildPrompt('voice-profile', { ... })`
6. Script structure generation → `buildPrompt('script-structure', { ... })`
7. Trend research → `buildPrompt('trend-research', { ... })`
8. Strategy analysis → `buildPrompt('strategy-analysis', { ... })`
9. Strategy creation → `buildPrompt('strategy-creation', { ... })`
10. Strategy review → `buildPrompt('strategy-review', { ... })`

Also update any routes that use the old composed prompts (`weekScriptsSystemPrompt`, `singleScriptSystemPrompt`, `topicScriptSystemPrompt`, `topicPlanSystemPrompt`).

**Files affected:**
- `src/app/api/configs/[id]/generate-week-scripts/route.ts`
- `src/app/api/configs/[id]/generate-voice-profile/route.ts`
- `src/app/api/configs/[id]/generate-strategy/route.ts` (if exists)
- Any other routes importing from `@/lib/prompts`

---

### Step 9: Delete Old Files

Remove all TypeScript prompt files that have been migrated to markdown.

**Actions:**

Delete:
- `src/lib/prompts/hooks.ts`
- `src/lib/prompts/language.ts`
- `src/lib/prompts/quality.ts`
- `src/lib/prompts/scripting.ts`
- `src/lib/prompts/hook-generation.ts`
- `src/lib/prompts/body-writing.ts`
- `src/lib/prompts/topic-selection.ts`
- `src/lib/prompts/quality-review.ts`
- `src/lib/prompts/voice-profile.ts`
- `src/lib/prompts/script-structure.ts`
- `src/lib/prompts/trend-research.ts`
- `src/lib/prompts/strategy-analysis.ts`
- `src/lib/prompts/strategy-creation.ts`
- `src/lib/prompts/strategy-review.ts`
- `src/lib/prompts/strategy-generation.ts`

**Keep:**
- `src/lib/prompts/analysis.ts` (Gemini pipeline, separate)

**Files affected:**
- 15 files deleted

---

### Step 10: Build Verification & Testing

Verify everything compiles and the pipeline still works.

**Actions:**

- Run `npm run build` — verify no TypeScript errors
- Grep the codebase for any remaining imports from deleted files
- Check that `buildPrompt` correctly resolves all placeholders (no `[Missing: ...]` in output)
- Test one pipeline run end-to-end (or at minimum, log the assembled prompts and verify they match expected output)

**Files affected:**
- None (verification only)

---

## Connections & Dependencies

### Files That Reference This Area

All API routes importing from `@/lib/prompts`:
- `src/app/api/configs/[id]/generate-week-scripts/route.ts`
- `src/app/api/configs/[id]/generate-voice-profile/route.ts`
- `src/app/api/configs/[id]/generate-strategy/route.ts`
- `src/app/api/pipeline/route.ts` (uses `ANALYSIS_PROMPT` — unchanged)
- `src/lib/pipeline.ts` (uses `buildConceptsPrompt` — unchanged)
- `src/lib/voice-profile.ts` (uses voice profile prompts)

### Updates Needed for Consistency

- `CLAUDE.md` — update the workspace structure section to document `foundational/` and `agents/` directories
- `context/strategy.md` — note the prompt architecture upgrade

### Impact on Existing Workflows

- **No behavioral change** — the assembled prompts should produce identical (or better) output
- **Developer workflow improves** — edit markdown files instead of TypeScript strings
- **Non-developer review** — Aysun can read/edit `.md` files directly in any text editor or GitHub

---

## Validation Checklist

- [ ] `npm run build` passes clean
- [ ] No remaining imports from deleted `.ts` prompt files anywhere in codebase
- [ ] `buildPrompt()` resolves all placeholders (test with console.log)
- [ ] Every agent template has numbered PART sections with clear `{{placeholder}}` references
- [ ] Every `{{placeholder}}` in agent templates either maps to a foundational `.md` file or is documented as a required substitution
- [ ] Banned AI language list contains 100+ patterns across 12 categories
- [ ] New modules exist: anti-monotone-formatierung, natuerliche-satzstruktur, hook-framework, skript-beispiele
- [ ] Tool schemas all exported from `tools.ts` and importable via `@/lib/prompts`
- [ ] `CLAUDE.md` updated with new prompt directory structure
- [ ] Pipeline generates scripts successfully (end-to-end test)

---

## Success Criteria

The implementation is complete when:

1. **All prompt text lives in markdown files** — `foundational/` has 20+ sub-prompt files, `agents/` has 10 mother templates
2. **`buildPrompt()` is the only prompt API** — all API routes use it, no direct TypeScript prompt string imports remain
3. **AI language ban list has 100+ patterns** — organized in 12 categories with German examples
4. **New prompt modules are integrated** — anti-monotonous formatting, natural sentence structure, hook/retain/reward framework
5. **Build passes clean and pipeline works** — no TypeScript errors, scripts generate correctly

---

## Notes

- The Authority AI project uses `fs.readFileSync` for loading prompts, which works fine in Next.js server-side code (API routes run on Node.js). Same approach works here.
- Future improvement: add a `foundational/index.md` manifest file listing all available sub-prompts with descriptions, making it even easier to discover and review.
- The script examples strategy (training scripts as examples) is powerful — it means the AI learns from the client's own proven content, not generic examples.
- Consider adding a `/prompts` admin page in the future where Aysun can browse/edit foundational prompts through the UI.

---

## Implementation Notes

**Implemented:** 2026-03-25

### Summary

Migrated the entire prompt system from TypeScript template literals to a markdown-based modular architecture. Created 21 foundational sub-prompt files, 13 agent templates (10 original + 3 additional for single-script, topic-script, topic-plan), a `buildPrompt()` loader, consolidated tool schemas in `tools.ts`, updated all 5 consuming files (4 API routes + voice-profile.ts), deleted 15 old TypeScript prompt files, and updated CLAUDE.md.

### Deviations from Plan

- Created 3 additional agent templates not in the original plan: `single-script.md`, `topic-script.md`, `topic-plan.md` — these were needed for the composed prompts in the old `index.ts` (`singleScriptSystemPrompt`, `topicScriptSystemPrompt`, `topicPlanSystemPrompt`).

### Issues Encountered

- Pre-existing build errors for `@supabase/ssr` and `googleapis` modules (unrelated to prompt changes). No prompt-related build errors.
