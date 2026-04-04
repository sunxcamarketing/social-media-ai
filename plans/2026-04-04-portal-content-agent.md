# Plan: Portal Chat → Content Agent mit Tool-Use

**Created:** 2026-04-04
**Status:** Implemented
**Request:** Portal-Chat in einen echten AI-Agenten umbauen, der selbstständig Client-Daten laden, Skripte generieren, Performance prüfen und Audits lesen kann.

---

## Overview

### What This Plan Accomplishes

Der simple Portal-Chat (350 Tokens, keine Tools, kein Datenzugriff) wird zu einem vollwertigen Content-Agenten der Claude's native `tool_use` nutzt. Der Agent entscheidet selbstständig welche Tools er aufruft — Kontext laden, Skripte suchen, Performance prüfen, Audit lesen, Skripte generieren — und antwortet conversational auf Deutsch. Clients können direkt im Chat Skripte generieren lassen statt auf die wöchentliche Pipeline zu warten.

### Why This Matters

Das ist der größte Hebel für Skalierung: Kunden werden selbstständig. Statt dass Aysun jede Woche manuell Pipelines anwirft, können Clients on-demand Content generieren. Das spart Zeit, erhöht die Kundenzufriedenheit und macht das Agency-Modell skalierbarer.

---

## Current State

### Relevant Existing Structure

| File | Zweck |
|------|-------|
| `src/app/api/chat/route.ts` | Admin+Portal Chat — lädt Kontext vorab in System-Prompt, SSE-Stream, web_search Tool |
| `src/app/portal/chat/page.tsx` | Chat-UI — Messages, Streaming, einfaches Input-Feld |
| `prompts/agents/chat-assistant.md` | System-Prompt — Strategieberater-Rolle, WICK-Storytelling, Sprach-Regeln |
| `src/lib/voice-profile.ts` | Voice Profile laden/generieren, Prompt-Block Builder |
| `src/lib/csv.ts` | Supabase-Wrapper: readConfig, readScripts, readAnalyses etc. |
| `prompts/tools.ts` | Alle bestehenden Tool-Schemas (HOOK_GENERATION_TOOL etc.) |
| `prompts/loader.ts` | buildPrompt() — Agent-Template + Foundational-Resolver |

### Gaps or Problems Being Addressed

1. **Kein Tool-Zugriff:** Chat kann nichts nachschlagen — ALLES wird vorab in den System-Prompt geladen (oft >50k Tokens Kontext, teuer und langsam)
2. **Keine Skript-Generierung:** Chat kann über Skripte reden aber keine erstellen
3. **Kein dynamischer Datenzugriff:** Wenn ein Client fragt "Welcher Hook hat am besten performt?" hat der Chat keine Antwort weil Performance-Daten nicht im Kontext sind
4. **Ineffizient:** Jede Chat-Nachricht lädt den GESAMTEN Kontext neu in den System-Prompt
5. **Keine Iteration:** Client kann kein generiertes Skript im Chat überarbeiten lassen

---

## Proposed Changes

### Summary of Changes

- Neuen Agent-System-Prompt erstellen (`prompts/agents/content-agent.md`) — schlanker als chat-assistant, keine vorab-geladenen Daten, dafür Tool-Instruktionen
- 7 Agent-Tools als Funktionen in `src/lib/agent-tools.ts` implementieren — jedes Tool ist eine selbstständige Funktion die Supabase/Claude aufruft
- Tool-Schemas in `prompts/tools.ts` ergänzen — die Agent-Tools folgen dem gleichen Pattern wie bestehende Tools
- API-Route `src/app/api/configs/[id]/chat/route.ts` komplett neu schreiben — Agent-Loop mit tool_use, SSE-Streaming, max 10 Tool-Calls pro Turn
- Chat-UI upgraden — Tool-Status anzeigen (z.B. "Lade Voice Profile..."), Markdown-Rendering für Skripte
- Bestehenden `/api/chat` Route unverändert lassen (bleibt für Admin-Chat)

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `src/lib/agent-tools.ts` | 7 Tool-Funktionen: loadClientContext, loadVoiceProfile, searchScripts, checkPerformance, loadAudit, generateScript, checkCompetitors |
| `prompts/agents/content-agent.md` | Agent-System-Prompt — Rolle, Tool-Nutzungs-Regeln, Sprach-Regeln (auto-loads foundationals) |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `prompts/tools.ts` | 7 neue AGENT_*_TOOL Schemas hinzufügen |
| `src/app/api/configs/[id]/chat/route.ts` | Komplett neu: Agent-Loop mit tool_use, Tool-Execution, SSE-Streaming |
| `src/app/portal/chat/page.tsx` | Tool-Status-Anzeige, Markdown-Rendering, besseres Streaming |
| `prompts/index.ts` | Re-export der neuen Tool-Schemas |
| `CLAUDE.md` | Content Agent dokumentieren |

### Files to Delete

Keine.

---

## Design Decisions

### Key Decisions Made

1. **Claude's native tool_use statt Framework:** Kein LangChain, kein Anthropic Agent SDK. Direkte Nutzung der `tool_use` API mit manuellem Agent-Loop. Grund: Weniger Dependencies, volle Kontrolle, passt zum bestehenden Pattern.

2. **Tools laden Daten on-demand statt vorab:** Der System-Prompt enthält NUR die Rolle und Regeln — keine Client-Daten. Der Agent ruft `load_client_context` auf wenn er es braucht. Grund: Spart Tokens, schnellere Antworten, Agent entscheidet was er braucht.

3. **Bestehende `/api/chat` Route bleibt:** Der Admin-Chat mit vollem Projekt-Kontext bleibt unverändert. Nur die Portal-Route (`/api/configs/[id]/chat`) wird zum Agent. Grund: Admin braucht den breiten Überblick, Clients brauchen Tools.

4. **generate_script Tool als eigene Claude-Sub-Call:** Das Tool ruft intern Claude mit dem bestehenden single-script Prompt auf (gleiche Qualität wie die Pipeline). Grund: Konsistente Skript-Qualität, Wiederverwendung der bewährten Prompts.

5. **Max 10 Tool-Calls pro Turn:** Verhindert endlose Loops und kontrolliert Kosten. Der Agent bekommt eine klare Anweisung: Maximal 3 Tools pro Nachricht, nur wenn nötig.

6. **Skripte immer in kurz + lang:** Wie von Aysun gewünscht — das generate_script Tool produziert automatisch beide Versionen.

### Alternatives Considered

- **Anthropic Agent SDK:** Zu schwer, zu abstrakt für diesen Use Case. Wir brauchen SSE-Streaming und volle Kontrolle über den Loop.
- **Alles im System-Prompt laden (Status Quo erweitern):** Skaliert nicht — bei 10+ Clients und 100+ Skripten pro Client wird der Kontext zu groß.
- **Separater Agent-Endpoint:** Statt die bestehende Chat-Route zu ersetzen. Abgelehnt weil das eine zweite Chat-UI brauchen würde.

### Open Questions

Keine — alle Entscheidungen basieren auf bestehenden Patterns im Codebase.

---

## Step-by-Step Tasks

### Step 1: Agent Tool Schemas definieren

Neue Tool-Schemas in `prompts/tools.ts` hinzufügen. Folgen dem bestehenden Pattern (name, description, input_schema mit required fields).

**Actions:**

- Am Ende von `prompts/tools.ts` einen neuen Abschnitt `// ── Agent Tools ──` hinzufügen
- 7 Tool-Schemas definieren:

```typescript
// Schema-Definitionen:

AGENT_LOAD_CONTEXT_TOOL = {
  name: "load_client_context",
  description: "Lade das vollständige Profil, Branding, Strategie und Zielgruppe des Clients",
  input_schema: { type: "object", properties: {}, required: [] }
}

AGENT_LOAD_VOICE_TOOL = {
  name: "load_voice_profile",
  description: "Lade das Voice Profile und die Skript-Struktur des Clients",
  input_schema: { type: "object", properties: {}, required: [] }
}

AGENT_SEARCH_SCRIPTS_TOOL = {
  name: "search_scripts",
  description: "Suche in den bisherigen Skripten des Clients",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Suchbegriff (Titel, Pillar, Hook)" },
      pillar: { type: "string", description: "Optional: Filter nach Content-Pillar" },
      limit: { type: "number", description: "Maximale Anzahl Ergebnisse (default 10)" }
    },
    required: []
  }
}

AGENT_CHECK_PERFORMANCE_TOOL = {
  name: "check_performance",
  description: "Lade Performance-Daten: Top-Videos, Ø Views, beste Hooks, Hook-Pattern-Verteilung",
  input_schema: { type: "object", properties: {}, required: [] }
}

AGENT_LOAD_AUDIT_TOOL = {
  name: "load_audit",
  description: "Lade den neuesten Audit-Report mit Stärken, Schwächen und Empfehlungen",
  input_schema: { type: "object", properties: {}, required: [] }
}

AGENT_GENERATE_SCRIPT_TOOL = {
  name: "generate_script",
  description: "Generiere ein neues Skript (kurz + lang) basierend auf einem Thema",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Skript-Titel (max 10 Wörter)" },
      description: { type: "string", description: "Kurzbeschreibung was das Skript behandelt" },
      pillar: { type: "string", description: "Content-Pillar (z.B. aus der Strategie)" },
      contentType: { type: "string", description: "Content-Typ (z.B. Edutainment, Storytelling)" },
      format: { type: "string", description: "Format (z.B. Talking Head, Listicle)" },
      tone: { type: "string", description: "Optional: Gewünschte Tonalität (provokant, ruhig, motivierend)" }
    },
    required: ["title", "description"]
  }
}

AGENT_CHECK_COMPETITORS_TOOL = {
  name: "check_competitors",
  description: "Lade analysierte Competitor-Videos mit Hooks, Views und Konzepten",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Maximale Anzahl Videos (default 10)" }
    },
    required: []
  }
}
```

- Re-Export in `prompts/index.ts` hinzufügen

**Files affected:**
- `prompts/tools.ts`
- `prompts/index.ts`

---

### Step 2: Agent Tool Implementierungen

Neue Datei `src/lib/agent-tools.ts` mit 7 Funktionen. Jede Funktion nimmt `clientId` + Tool-Input und gibt einen String zurück (der Tool-Result Content).

**Actions:**

- Datei `src/lib/agent-tools.ts` erstellen
- Imports aus bestehenden Modulen: `readConfig`, `readScriptsByClient`, `readAnalysesByClient`, `readVideosList` aus `csv.ts`, `getVoiceProfile`, `getScriptStructure`, `voiceProfileToPromptBlock` aus `voice-profile.ts`
- Hilfsfunktion `safeJsonParse` aus bestehender csv.ts oder inline

**Tool-Implementierungen:**

```
loadClientContext(clientId):
  - readConfig(clientId)
  - Parse: name, role, company, niche, businessContext, brandProblem, brandingStatement
  - Parse: dreamCustomer, customerProblems, providerRole, authenticityZone
  - Parse: strategyGoal, strategyPillars (JSON → Pillar-Namen + Subtopics), strategyWeekly
  - Return: Formatierter Text-Block mit allen Client-Daten

loadVoiceProfile(clientId):
  - getVoiceProfile(clientId) + getScriptStructure(clientId)
  - Wenn vorhanden: voiceProfileToPromptBlock() + scriptStructureToPromptBlock()
  - Wenn nicht vorhanden: "Kein Voice Profile vorhanden. Empfehlung: Training-Skripte hochladen."
  - Return: Formatierter Voice+Structure Block

searchScripts(clientId, { query?, pillar?, limit? }):
  - readScriptsByClient(clientId)
  - Filter: query matched gegen title, hook, body (case-insensitive)
  - Filter: pillar exact match (wenn gegeben)
  - Sortiere nach createdAt desc
  - Limit (default 10)
  - Return: Formatierte Liste mit Title, Hook (gekürzt), Pillar, Datum, Status

checkPerformance(clientId):
  - readConfig(clientId) → performanceInsights (JSON parse)
  - readVideosList() → filter by configName → sort by views → top 10
  - readScriptsByClient(clientId) → hook_pattern Verteilung zählen
  - Return: Top-Videos, Ø Views, Hook-Pattern-Statistik, Performance-Insights

loadAudit(clientId):
  - readAnalysesByClient(clientId) → neuester Eintrag
  - Return: Follower, Reels/30d, Ø Views, Report (komplett)

generateScript(clientId, { title, description, pillar?, contentType?, format?, tone? }):
  - readConfig(clientId) für Kontext
  - getVoiceProfile + getScriptStructure für Voice Matching
  - buildPrompt("topic-script", { laenge_regeln, ... }) — gleicher Prompt wie generate-script/route.ts
  - Anthropic API Call mit tool_choice für strukturierten Output
  - Ergebnis in ZWEI Versionen: kurz (max 120 Wörter) und lang (max 220 Wörter)
  - Return: Formatiertes Skript (Kurz + Lang) mit Hook, Body, CTA

checkCompetitors(clientId, { limit? }):
  - readConfig(clientId) → configName
  - readVideosList() → filter by configName → sort by views → top N
  - Return: Formatierte Video-Liste mit Creator, Views, Hook, Konzept
```

**Files affected:**
- `src/lib/agent-tools.ts` (NEU)

---

### Step 3: Agent System-Prompt erstellen

Neuer Agent-Prompt der KEINE vorab-geladenen Daten enthält, aber klare Instruktionen für Tool-Nutzung.

**Actions:**

- Datei `prompts/agents/content-agent.md` erstellen
- Prompt-Struktur:

```markdown
Du bist der Content-Agent von SUNXCA. Du hilfst dem Client bei allem rund um Instagram Reels Content.

# DEINE TOOLS

Du hast Zugriff auf folgende Tools. Nutze sie AKTIV — rate nicht, schau nach.

- **load_client_context** — Ruf das ZUERST auf wenn du den Client nicht kennst
- **load_voice_profile** — Bevor du Skripte schreibst, IMMER laden
- **search_scripts** — Wenn der Client nach bestehenden Skripten fragt
- **check_performance** — Wenn es um Performance, Top-Hooks oder Statistiken geht
- **load_audit** — Wenn es um Stärken, Schwächen oder Verbesserungen geht
- **generate_script** — Wenn der Client ein neues Skript will
- **check_competitors** — Wenn es um Inspiration oder Wettbewerber-Analyse geht

# TOOL-REGELN

1. Lade den Client-Kontext EINMAL am Anfang des Gesprächs
2. Vor Skript-Generierung IMMER Voice Profile laden
3. Nutze maximal 3 Tools pro Antwort
4. Wenn ein Tool keine Daten liefert, sag das ehrlich

# STORYTELLING-MODUS
[WICK Framework — gleich wie in chat-assistant.md]

# SKRIPT-REGELN
Wenn du Skripte schreibst oder generierst:
{{hook-regeln}}
{{hook-muster}}
{{body-regeln}}
{{cta-regeln}}
{{konkretion-regeln}}
{{storytelling-formel}}

# SPRACH-REGELN (KRITISCH)
{{verboten-ai-sprache}}
{{sprach-stil}}
{{natuerliche-satzstruktur}}
{{anti-monotone-formatierung}}

# VERHALTEN
- Sprich Deutsch, direkt, wie eine echte Person
- Keine Listen mit Bindestrichen
- Frag nach wenn etwas unklar ist
- Bei Skript-Anfragen: Frag kurz nach Thema/Pillar wenn nicht angegeben, dann generiere
- Skripte kommen immer in ZWEI Versionen: kurz (30-40 Sek) und lang (60+ Sek)
```

**Files affected:**
- `prompts/agents/content-agent.md` (NEU)

---

### Step 4: API-Route neu schreiben — Agent Loop

Die bestehende `/api/configs/[id]/chat/route.ts` komplett ersetzen mit dem Agent-Loop.

**Actions:**

- Bestehende Route ersetzen
- Agent-Loop Pattern:

```
1. Empfange messages[] vom Client
2. Baue system prompt: buildPrompt("content-agent")
3. Sende an Claude mit tools: [alle 7 Agent-Tools] + web_search
4. LOOP:
   a. Wenn response.stop_reason === "tool_use":
      - Für jeden tool_use Block: Führe Tool-Funktion aus
      - SSE Event senden: { type: "tool_status", tool: "load_voice_profile", status: "running" }
      - Tool-Result zurück an Claude als tool_result message
      - SSE Event senden: { type: "tool_status", tool: "load_voice_profile", status: "done" }
      - Weiter bei Schritt 3 mit erweiterten messages
   b. Wenn response.stop_reason === "end_turn":
      - Text-Chunks als SSE streamen
      - Loop beenden
5. Max 10 Loop-Iterationen (Safety)
```

- SSE Event Format:
```
data: { "type": "text", "text": "..." }        // Streaming text
data: { "type": "tool_status", "tool": "...", "status": "running|done" }
data: { "type": "done" }
```

- Auth: `requireClientAccess(id)` am Anfang — Client sieht nur eigene Daten
- Timeout: 120 Sekunden (maxDuration)
- Model: `claude-sonnet-4-6`
- Max tokens: 4096

**Wichtig für den Agent-Loop:**
- Die erste Iteration verwendet `stream()` für Text-Streaming
- Wenn ein tool_use kommt, wird die Antwort NICHT gestreamt sondern als messages.create() (nicht stream) ausgeführt, weil wir die tool_use Blocks brauchen
- Erst die LETZTE Iteration (die mit Text-Antwort) wird gestreamt
- Alternative: Alle Iterationen als stream, tool_use Events erkennen und Tools ausführen

**Empfohlener Ansatz (einfacher):**
- Verwende `messages.create()` (nicht stream) für Tool-Iterations
- Verwende `messages.stream()` nur für die finale Text-Antwort
- Das spart Komplexität und ist zuverlässiger

```typescript
// Pseudo-Code für den Agent Loop:
let currentMessages = [...userMessages];
let iteration = 0;

while (iteration < 10) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    system: systemPrompt,
    messages: currentMessages,
    tools: agentTools,
    max_tokens: 4096,
  });

  // Check for tool use
  const toolUseBlocks = response.content.filter(b => b.type === "tool_use");
  
  if (toolUseBlocks.length === 0) {
    // Final text response — stream it
    // Re-run as stream for the same messages
    break;
  }

  // Execute tools
  const toolResults = [];
  for (const toolBlock of toolUseBlocks) {
    // Send SSE: tool running
    const result = await executeAgentTool(clientId, toolBlock.name, toolBlock.input);
    toolResults.push({ type: "tool_result", tool_use_id: toolBlock.id, content: result });
    // Send SSE: tool done
  }

  // Add assistant response + tool results to messages
  currentMessages.push({ role: "assistant", content: response.content });
  currentMessages.push({ role: "user", content: toolResults });
  iteration++;
}

// Stream final response
const stream = anthropic.messages.stream({ ...sameParams });
for await (const event of stream) {
  // SSE text chunks
}
```

**Files affected:**
- `src/app/api/configs/[id]/chat/route.ts`

---

### Step 5: Chat-UI upgraden

Die Portal Chat UI erweitern um Tool-Status und besseres Rendering.

**Actions:**

- SSE Parsing erweitern: `type: "text"`, `type: "tool_status"`, `type: "done"` unterscheiden
- Tool-Status anzeigen als kleine Inline-Badges im Chat:
  ```
  🔍 Lade Voice Profile...  ✓
  🔍 Lade Performance-Daten...  ✓
  ```
- Simple Markdown-Rendering für Skript-Output (fett, kursiv, Absätze — kein voller Markdown-Parser nötig, `whitespace-pre-wrap` reicht meistens)
- Textarea statt Input für mehrzeilige Eingaben (Shift+Enter für neue Zeile, Enter zum Senden — bestehendes Pattern beibehalten)

**Neues State:**
```typescript
interface ToolStatus {
  tool: string;
  status: "running" | "done";
  label: string; // User-friendly: "Lade Profil...", "Suche Skripte..."
}

const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);
```

**Tool-Labels (Mapping):**
```
load_client_context → "Lade Client-Profil"
load_voice_profile → "Lade Voice Profile"
search_scripts → "Suche Skripte"
check_performance → "Prüfe Performance"
load_audit → "Lade Audit"
generate_script → "Generiere Skript"
check_competitors → "Analysiere Wettbewerber"
```

**Files affected:**
- `src/app/portal/chat/page.tsx`

---

### Step 6: CLAUDE.md aktualisieren

Content Agent in der Dokumentation ergänzen.

**Actions:**

- Unter "### Script Generation Pipeline" einen neuen Abschnitt einfügen:

```markdown
### Content Agent (Portal Chat)

AI-Agent im Client-Portal mit Tool-Zugriff. Nutzt Claude's native tool_use für autonome Datenabfragen und Skript-Generierung.

**Tools:** load_client_context, load_voice_profile, search_scripts, check_performance, load_audit, generate_script, check_competitors

Key endpoint: `POST /api/configs/[id]/chat` (SSE stream mit Agent-Loop)
```

- Im Workspace Structure die neuen Dateien ergänzen:
  - `src/lib/agent-tools.ts`
  - `prompts/agents/content-agent.md`

**Files affected:**
- `CLAUDE.md`

---

### Step 7: Testen

**Actions:**

- Dev-Server auf Port 4000 starten
- Als Admin einloggen → Client impersonieren → Portal Chat öffnen
- Test-Nachrichten:
  1. "Was weißt du über mich?" → Agent sollte `load_client_context` aufrufen
  2. "Welche Hooks haben am besten funktioniert?" → `check_performance`
  3. "Schreib mir ein Skript über Trading-Fehler" → `load_voice_profile` + `generate_script`
  4. "Zeig mir meine letzten Skripte" → `search_scripts`
  5. "Was sagt mein Audit?" → `load_audit`
  6. "Was machen meine Konkurrenten?" → `check_competitors`
- Prüfen: Tool-Status wird in UI angezeigt, Skripte kommen in kurz+lang, Streaming funktioniert

**Files affected:**
- Keine (manueller Test)

---

## Connections & Dependencies

### Files That Reference This Area

| File | Referenz |
|------|----------|
| `src/app/portal/chat/page.tsx` | Ruft `/api/chat` auf (wird auf `/api/configs/[id]/chat` umgestellt) |
| `src/components/client-nav.tsx` | Link zu `/portal/chat` (bleibt gleich) |
| `src/app/portal/use-portal-client.ts` | Auth Hook für Portal (wird weiter genutzt) |

### Updates Needed for Consistency

- `prompts/index.ts` muss die neuen Tool-Schemas re-exportieren
- Die Chat-UI muss die API-URL von `/api/chat` auf `/api/configs/${clientId}/chat` ändern (clientId-scoped)

### Impact on Existing Workflows

- **Admin-Chat (`/api/chat`):** Keine Änderung — bleibt als eigenständiger Strategieberater
- **Portal-Chat:** Wird komplett ersetzt — von simplem Chat zu Agent mit Tools
- **Bestehende Pipelines:** Keine Änderung — der Agent nutzt dieselben Datenquellen

---

## Validation Checklist

- [ ] TypeScript kompiliert ohne Fehler (`npx tsc --noEmit`)
- [ ] Agent ruft Tools korrekt auf und liefert Ergebnisse zurück
- [ ] Skripte werden in kurz + lang generiert
- [ ] Tool-Status wird in der Chat-UI angezeigt
- [ ] SSE-Streaming funktioniert (Text + Tool-Status Events)
- [ ] Auth-Scoping funktioniert (Client sieht nur eigene Daten)
- [ ] Admin-Impersonate funktioniert im Portal-Chat
- [ ] Max 10 Iterationen Safety-Limit greift
- [ ] CLAUDE.md ist aktualisiert
- [ ] Bestehender Admin-Chat funktioniert weiterhin

---

## Success Criteria

1. Client kann im Portal-Chat "Schreib mir ein Skript über [Thema]" sagen und bekommt ein fertiges Skript (kurz + lang) mit Voice Matching
2. Agent ruft selbstständig die richtigen Tools auf basierend auf der Nachricht
3. Tool-Execution ist im UI sichtbar (Status-Badges)
4. Keine Regression: Admin-Chat, bestehende Pipelines funktionieren weiterhin

---

## Notes

- Der Agent nutzt `claude-sonnet-4-6` — gleich wie alle anderen Pipelines. Wenn Opus zu teuer ist für Chat, Sonnet ist die richtige Wahl.
- Das `generate_script` Tool macht intern einen eigenen Claude-Call. Das bedeutet: ein Chat-Turn mit Skript-Generierung kostet 2 Claude-Calls (1x Agent-Loop, 1x Skript-Generierung). Das ist OK — die Skript-Qualität bleibt konsistent mit der Pipeline.
- Zukünftige Erweiterung: Agent könnte auch `save_script` Tool bekommen um generierte Skripte direkt in Supabase zu speichern. Vorerst weglassen — Client soll erst reviewen.
- Zukünftige Erweiterung: Admin-Chat könnte ebenfalls zu einem Agent mit cross-client Tools werden (Phase 2).

---

## Implementation Notes

**Implemented:** 2026-04-04

### Summary

Implemented all 7 steps of the plan. The portal chat is now a full Content Agent with 7 tools, an agent loop with tool_use, SSE streaming with tool status events, and an upgraded UI with tool status badges and suggestion chips.

### Deviations from Plan

- The agent loop uses non-streaming `messages.create()` for ALL iterations (including the final text response), then sends the text in small chunks via SSE. This is simpler than the plan's suggested hybrid approach (non-streaming for tool iterations, streaming for final) and avoids the complexity of detecting whether to stream or not. The UX is nearly identical since chunks are sent in 10-character batches.
- Added suggestion chips in the empty chat state ("Schreib mir ein Skript", "Was sagt mein Audit?", etc.) for better discoverability.
- The `generate_script` tool generates two separate Claude calls (one per version) sequentially rather than in parallel, to keep implementation simple and avoid hitting rate limits.

### Issues Encountered

None — clean TypeScript build on first pass.
