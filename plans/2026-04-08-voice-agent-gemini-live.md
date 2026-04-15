# Plan: Voice Agent — Content-Interview mit Gemini Live API

**Created:** 2026-04-08
**Status:** Draft
**Request:** Voice Agent im Client-Portal der gezielte Fragen stellt um Content-Ideen und Skripte zu generieren, basierend auf Gemini Multimodal Live API.

---

## Overview

### What This Plan Accomplishes

Eine neue `/portal/voice` Seite auf der Clients per Mikrofon mit einem KI-Interviewer sprechen. Der Voice Agent kennt den Client-Kontext (Nische, Strategie, Pillars, Audit, Performance) und stellt gezielte Fragen um Stories, Meinungen, Erfahrungen und kontroverse Takes zu extrahieren. Am Ende der Session werden die Erkenntnisse in strukturierte Content-Ideen umgewandelt und als Ideas in Supabase gespeichert.

### Why This Matters

Clients haben oft großartige Stories und Meinungen — aber sie kommen nicht von alleine darauf, das als Content zu verpacken. Ein Voice Agent senkt die Barriere massiv: statt ein Formular auszufüllen oder zu tippen, redet der Client einfach. Der Agent steuert das Gespräch, extrahiert die Gold-Nuggets und verwandelt sie in Video-Ideen die direkt in die Pipeline fließen.

---

## Current State

### Relevant Existing Structure

| File/Area | Relevance |
|-----------|-----------|
| `src/app/portal/chat/page.tsx` | Bestehender Text-Chat — UI-Pattern für Portal-Seiten |
| `src/app/api/chat/route.ts` | Content Agent API — Tool-Pattern, Auth, SSE |
| `src/lib/agent-tools.ts` | 12 Tool-Implementierungen — wiederverwendbar für Voice Agent |
| `prompts/agents/content-agent.md` | Content Agent Prompt — Basis für Voice Agent Prompt |
| `prompts/loader.ts` | `buildPrompt()` — nutzen wir für den Voice Agent Prompt |
| `src/components/client-nav.tsx` | Portal-Navigation — braucht neuen Tab |
| `src/lib/sse.ts` | SSE Helpers — Pattern für Streaming |
| `src/lib/gemini.ts` | Bestehender Gemini-Client (Video-Analyse, kein Live API) |
| `src/lib/csv.ts` | Supabase CRUD — `writeIdeas()` für Ideen-Speicherung |
| `supabase-schema.sql` | DB Schema — `ideas` Tabelle existiert bereits |

### Gaps or Problems Being Addressed

- Clients müssen aktuell tippen um mit dem Content Agent zu interagieren
- Content-Ideen entstehen nur wenn der Client von sich aus weiß was er will
- Es gibt keinen strukturierten Interview-Prozess der Stories und Meinungen extrahiert
- Kein WebSocket-Support im Projekt (nur SSE bisher)
- `@google/genai` SDK ist noch nicht installiert

---

## Proposed Changes

### Summary of Changes

- `@google/genai` SDK installieren
- Neuer Voice Agent Prompt (`prompts/agents/voice-agent.md`) — Interview-Spezialist
- Neues Gemini Live API Modul (`src/lib/gemini-live.ts`) — WebSocket-Verbindung + Function Calling
- Neue API Route (`src/app/api/voice-session/route.ts`) — WebSocket-Proxy zwischen Browser und Gemini
- Neue Portal-Seite (`src/app/portal/voice/page.tsx`) — Mikrofon-UI mit Session-Steuerung
- Audio-Capture Hook (`src/hooks/use-audio-capture.ts`) — Browser-Mikrofon + PCM-Encoding
- Voice-Session-Zusammenfassung → Ideas Pipeline
- Portal-Navigation um Voice-Tab erweitern
- Supabase: `voice_sessions` Tabelle für Session-Transkripte

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `prompts/agents/voice-agent.md` | Interview-Agent Prompt: gezielte Fragen stellen, WICK-Methode, Content-Extraktion |
| `src/lib/gemini-live.ts` | Gemini Live API Client: WebSocket-Verbindung, Audio-Streaming, Function Calling |
| `src/app/api/voice-session/route.ts` | API Route: Upgrade zu WebSocket, Proxy zu Gemini Live, Auth-Check |
| `src/app/portal/voice/page.tsx` | Voice-Seite: Mikrofon-Button, Live-Transkript, Session-Zusammenfassung |
| `src/hooks/use-audio-capture.ts` | React Hook: Mikrofon-Zugriff, AudioWorklet, PCM 16kHz Encoding |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `src/components/client-nav.tsx` | Neuer "Voice" Tab mit Mic-Icon |
| `supabase-schema.sql` | `voice_sessions` Tabelle hinzufügen |
| `package.json` | `@google/genai` Dependency |
| `prompts/index.ts` | Export für Voice Agent Prompt |
| `prompts/tools.ts` | Gemini Function Declarations für Voice Tools |
| `CLAUDE.md` | Voice Agent Dokumentation |

---

## Design Decisions

### Key Decisions Made

1. **Gemini Live API statt OpenAI Realtime:** Gemini ist bereits im Stack (Video-Analyse), gleicher API Key, deutlich günstiger, und `gemini-2.0-flash` unterstützt die Live API nativ.

2. **Server-side WebSocket Proxy:** Browser → Next.js Server → Gemini. Der API Key bleibt server-seitig. Der Server hält die Gemini-Session und injiziert den Client-Kontext als System Instruction.

3. **Eigene `/portal/voice` Seite statt Integration in Chat:** Klare Trennung der UX — Voice ist ein anderes Interaktionsmodell. Chat bleibt text-basiert, Voice ist session-basiert mit Start/Stop.

4. **Interview-First, nicht Chat:** Der Voice Agent ist kein Sprach-Chat. Er hat ein klares Ziel: Content-Material extrahieren. Er stellt Fragen, hört zu, hakt nach. Am Ende der Session fasst er zusammen und speichert Ideas.

5. **Gemini Function Calling für Client-Daten:** Der Voice Agent nutzt Function Calling um beim Session-Start den Client-Kontext zu laden. So weiß er in welcher Nische der Client ist, welche Pillars existieren, was performt hat — und kann gezielt fragen.

6. **Session-Zusammenfassung am Ende:** Wenn der Client die Session beendet, macht der Server einen finalen Claude-Call der das Transkript in strukturierte Content-Ideen umwandelt und als Ideas speichert.

7. **Transkript in Supabase:** Jede Voice Session wird mit Transkript gespeichert — als Rohstoff für spätere Skript-Generierung und um den Verlauf zu sehen.

### Alternatives Considered

- **Direct Browser → Gemini:** Schneller zu implementieren, aber exponiert den API Key. Verworfen wegen Sicherheit.
- **Whisper STT + Claude TTS:** Zwei separate Modelle für Speech-to-Text und Text-to-Speech. Deutlich höhere Latenz (2-3s statt 500ms), komplexere Architektur. Gemini Live macht beides in einem.
- **Voice in bestehender Chat-UI:** Hybrid Text+Voice in einer UI. Zu komplex für V1, Voice braucht eigene UX (Mikrofon-Button, Waveform, Session-Konzept).

### Open Questions

1. **Next.js WebSocket Support:** Next.js App Router hat keinen nativen WebSocket-Support. Optionen:
   - **Option A:** Separater WebSocket-Server (z.B. auf Port 4001) — einfach, aber extra Prozess
   - **Option B:** Custom Server (`server.ts`) der Next.js + WS hostet — ein Prozess, aber custom setup
   - **Option C:** Server-Sent Events für Gemini→Browser + POST für Browser→Gemini Audio-Chunks — kein WebSocket nötig, aber höhere Latenz
   - **Empfehlung:** Option A für V1 — separater WS-Server, schnell zu implementieren

2. **Stimme:** Welche Gemini-Stimme passt zu SUNXCA? (Kore, Puck, Aoede, etc.) — kann beim Testen entschieden werden.

---

## Step-by-Step Tasks

### Step 1: SDK installieren

Installiere `@google/genai` für die Gemini Live API.

**Actions:**
- `npm install @google/genai`

**Files affected:**
- `package.json`

---

### Step 2: Gemini Live API Client

Erstelle `src/lib/gemini-live.ts` — die serverseitige Gemini Live API Verbindung.

**Actions:**
- Erstelle eine `GeminiLiveSession` Klasse die:
  - Eine WebSocket-Verbindung zu `wss://generativelanguage.googleapis.com/ws/...` aufbaut
  - System Instructions mit Client-Kontext setzt
  - Function Declarations für `load_client_context`, `load_voice_profile`, `check_performance`, `load_audit`, `save_idea` registriert
  - Audio-Chunks (PCM 16kHz) an Gemini sendet
  - Audio-Responses + Transkript empfängt
  - Function Calls abfängt, über `agent-tools.ts` ausführt, und Tool-Responses zurücksendet
  - Transkript (User + Agent) mitschreibt

```typescript
import { GoogleGenAI, Modality } from "@google/genai";

export interface VoiceSessionConfig {
  clientId: string;
  systemPrompt: string;
  tools: GeminiFunctionDeclaration[];
  onAudioOutput: (audioData: ArrayBuffer) => void;
  onTranscript: (role: "user" | "model", text: string) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<string>;
  onError: (error: Error) => void;
}

export class GeminiLiveSession {
  private session: any;
  private transcript: { role: string; text: string; timestamp: string }[] = [];

  async connect(config: VoiceSessionConfig): Promise<void> { ... }
  async sendAudio(pcmData: ArrayBuffer): Promise<void> { ... }
  async close(): Promise<{ transcript: typeof this.transcript }> { ... }
  getTranscript() { return this.transcript; }
}
```

**Files affected:**
- `src/lib/gemini-live.ts` (new)

---

### Step 3: Voice Agent Prompt

Erstelle `prompts/agents/voice-agent.md` — der Interview-Spezialist.

**Actions:**
- Agent-Template das auf Content-Extraktion durch Fragen optimiert ist
- WICK-Methode (Wound, Identity Shift, Cost, Key Lesson) integriert für Storytelling
- Regeln: Eine Frage auf einmal, tief statt breit, nachhaken
- Kontextwissen: Nutzt Client-Profil, Strategie, Audit-Findings um relevante Fragen zu stellen
- Session-Phasen: Warm-up → Themen-Exploration → Deep-Dive → Zusammenfassung
- Foundational Sub-Prompts wiederverwenden: `{{konkretion-regeln}}`, `{{themen-spezifizitaet}}`

```markdown
Du bist der Voice-Interview-Agent von SUNXCA. Dein Job: durch gezielte Fragen Content-Gold aus dem Client herausholen.

Du SPRICHST mit dem Client — kurze, natürliche Sätze. Kein AI-Monolog.

# DEIN ZIEL

Du führst ein Content-Interview. Am Ende sollen 3-5 konkrete Video-Ideen entstehen, basierend auf echten Stories, Meinungen und Erfahrungen des Clients.

# INTERVIEW-PHASEN

## Phase 1: Warm-up (1-2 Fragen)
- Frag was gerade bei ihnen im Business los ist
- Oder was sie in letzter Zeit beschäftigt hat
- Nutze den Client-Kontext den du schon hast — zeig dass du weißt wer sie sind

## Phase 2: Themen-Exploration (3-5 Fragen)
- Basierend auf ihren Antworten: Was davon wäre ein gutes Video?
- Frag nach kontroversen Meinungen ("Was glaubst du was die meisten in deiner Branche falsch machen?")
- Frag nach persönlichen Erfahrungen ("Was war dein größter Fehler dabei?")
- Frag nach Kunden-Geschichten ("Was war die krasseste Transformation?")

## Phase 3: Deep-Dive (pro vielversprechendem Thema)
Nutze die WICK-Methode für Storytelling:
- **W — Wound:** Frag nach dem konkreten Schmerzpunkt. Szene, Gefühl, Details.
- **I — Identity Shift:** Was war der Wendepunkt? Der eine Moment?
- **C — Cost:** Was hat es gekostet? Was musste aufgegeben werden?
- **K — Key Lesson:** Die EINE Erkenntnis daraus.

## Phase 4: Zusammenfassung
- Fasse die besten Ideen zusammen
- Frag ob sie noch etwas ergänzen wollen
- Speichere die Ideen

# FRAGE-REGELN

1. IMMER nur EINE Frage auf einmal
2. Kurze Sätze — du sprichst, nicht schreibst
3. Hake nach wenn die Antwort vage ist ("Kannst du das konkreter machen?")
4. Beziehe dich auf vorherige Antworten ("Du hast gerade gesagt dass... — wie genau war das?")
5. Vermeide Ja/Nein-Fragen — offene Fragen die zum Erzählen einladen
6. Wenn der Client abschweift, bringe ihn sanft zurück zum Kern

# KONTEXT-NUTZUNG

Du hast den Client-Kontext geladen. Nutze ihn:
- Frag zu ihren spezifischen Content-Pillars
- Beziehe dich auf Audit-Findings ("Dein Audit zeigt dass deine Hooks zu generisch sind — was ist deine Meinung dazu?")
- Nutze Performance-Daten ("Dein Video über X hatte die meisten Views — warum glaubst du?")

{{konkretion-regeln}}
{{themen-spezifizitaet}}
```

**Files affected:**
- `prompts/agents/voice-agent.md` (new)
- `prompts/index.ts` (add export)

---

### Step 4: Function Declarations für Gemini

Gemini Live API nutzt ein anderes Tool-Format als Anthropic. Erstelle die Gemini-kompatiblen Function Declarations.

**Actions:**
- In `prompts/tools.ts`: Neuer Abschnitt `VOICE_AGENT_TOOLS` mit Gemini-Format Function Declarations
- Reduziertes Tool-Set: `load_client_context`, `load_voice_profile`, `check_performance`, `load_audit`, `save_idea`, `check_learnings`
- Kein `generate_script` (Voice Agent generiert keine Skripte, er sammelt Material)
- Kein `search_web` / `research_trends` (zu langsam für Real-Time Voice)

```typescript
export const VOICE_AGENT_TOOLS = [
  {
    name: "load_client_context",
    description: "Lade das vollständige Client-Profil mit Brand, Strategie und Zielgruppe",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "load_audit",
    description: "Lade den neuesten Audit-Report mit Stärken und Schwächen",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "check_performance",
    description: "Lade Performance-Daten: Top-Videos, Views, Hook-Patterns",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "save_idea",
    description: "Speichere eine Content-Idee die aus dem Gespräch entstanden ist",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titel der Video-Idee" },
        description: { type: "string", description: "Beschreibung mit Kontext aus dem Gespräch" },
        content_type: { type: "string", description: "Art des Contents (Storytelling, Meinung, Tipp, etc.)" },
      },
      required: ["title", "description"],
    },
  },
];
```

**Files affected:**
- `prompts/tools.ts` (add Gemini tool declarations)

---

### Step 5: WebSocket Server

Da Next.js App Router keine nativen WebSockets unterstützt, erstelle einen separaten WS-Server.

**Actions:**
- Erstelle `src/voice-server.ts` — standalone WebSocket-Server auf Port 4001
- Der Server:
  1. Akzeptiert WebSocket-Verbindungen vom Browser
  2. Validiert Auth (Session-Cookie oder Token als Query-Param)
  3. Erstellt eine `GeminiLiveSession` pro Verbindung
  4. Proxied Audio-Chunks: Browser → Gemini
  5. Proxied Audio-Output: Gemini → Browser
  6. Sendet Transkript-Updates als JSON-Nachrichten
  7. Bei Disconnect: Speichert Session-Transkript + generiert Zusammenfassung

- Erstelle npm Script: `"voice-server": "tsx src/voice-server.ts"`

```typescript
import { WebSocketServer, WebSocket } from "ws";
import { GeminiLiveSession } from "./lib/gemini-live";
import { buildPrompt } from "../prompts";
import { executeAgentTool } from "./lib/agent-tools";
import { VOICE_AGENT_TOOLS } from "../prompts/tools";

const wss = new WebSocketServer({ port: 4001 });

wss.on("connection", async (ws: WebSocket, req) => {
  // 1. Extract clientId from auth (query param token or cookie)
  // 2. Load client context
  // 3. Build voice agent prompt
  // 4. Create Gemini Live session with tools
  // 5. Proxy audio bidirectionally
  // 6. Handle tool calls via executeAgentTool
  // 7. Send transcript updates to browser
  // 8. On close: save session
});
```

**Files affected:**
- `src/voice-server.ts` (new)
- `package.json` (add script)

---

### Step 6: Audio Capture Hook

React Hook für Browser-Mikrofon-Zugriff und PCM-Encoding.

**Actions:**
- Erstelle `src/hooks/use-audio-capture.ts`
- Nutzt `navigator.mediaDevices.getUserMedia()` für Mikrofon
- AudioWorklet oder ScriptProcessorNode für PCM 16kHz Mono Encoding
- Liefert: `start()`, `stop()`, `isRecording`, `audioLevel` (für Visualisierung)
- Sendet PCM-Chunks über Callback

```typescript
export function useAudioCapture(options: {
  onAudioChunk: (pcmData: ArrayBuffer) => void;
  sampleRate?: number; // default 16000
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const start = async () => { ... };
  const stop = () => { ... };

  return { isRecording, audioLevel, start, stop };
}
```

**Files affected:**
- `src/hooks/use-audio-capture.ts` (new)

---

### Step 7: Voice Portal Page

Die Haupt-UI für den Voice Agent.

**Actions:**
- Erstelle `src/app/portal/voice/page.tsx`
- UI-Phasen:
  1. **Idle:** Großer Mikrofon-Button, kurze Erklärung ("Erzähl mir von deinem Business — ich finde die besten Video-Ideen daraus")
  2. **Recording:** Pulsierender Mikrofon-Button, Live-Waveform/Audio-Level, Transkript das mitscrollt
  3. **Agent Speaking:** Visuelles Feedback dass der Agent spricht, Transkript-Update
  4. **Session End:** Zusammenfassung der extrahierten Ideen, "Als Ideen speichern" Button
- WebSocket-Verbindung zu `ws://localhost:4001` (dev) / Production-URL
- Audio-Wiedergabe: Web Audio API für Gemini-Audio-Output
- SUNXCA Design System: ocean/blush/warm-white Farben

```tsx
"use client";

export default function PortalVoice() {
  // States: idle | connecting | active | processing | summary
  // WebSocket connection to voice server
  // Audio capture via useAudioCapture hook
  // Audio playback via Web Audio API
  // Transcript display
  // Session summary + save ideas
}
```

**Files affected:**
- `src/app/portal/voice/page.tsx` (new)

---

### Step 8: Session-Zusammenfassung & Ideen-Speicherung

Am Ende einer Voice Session werden die gesammelten Informationen in Content-Ideen umgewandelt.

**Actions:**
- Im `voice-server.ts`: Wenn die Session endet (Client drückt Stop oder Timeout):
  1. Hole das vollständige Transkript aus der `GeminiLiveSession`
  2. Sende das Transkript an Claude (via Anthropic API) mit einem Summary-Prompt
  3. Claude extrahiert: 3-5 strukturierte Video-Ideen (Titel, Beschreibung, Typ, Story-Elements)
  4. Speichere jede Idee über `toolSaveIdea()` in der `ideas` Tabelle
  5. Speichere das Session-Transkript in `voice_sessions` Tabelle
  6. Sende die Zusammenfassung an den Browser

- Neuer Prompt für Zusammenfassung (inline, kein eigenes Agent-Template nötig):
  ```
  Du bist ein Content-Stratege. Analysiere dieses Interview-Transkript und extrahiere die besten Video-Ideen.
  Für jede Idee: Titel (max 10 Wörter, spezifisch), Beschreibung (1-2 Sätze mit dem Kern der Geschichte/Meinung),
  Content-Typ (Storytelling/Meinung/Tipp/Erfahrung). Nur Ideen die echtes Potenzial haben.
  ```

**Files affected:**
- `src/voice-server.ts` (add summary logic)
- `src/lib/agent-tools.ts` (reuse `toolSaveIdea`)

---

### Step 9: Supabase Schema + Migration

Neue Tabelle für Voice Sessions.

**Actions:**
- Erstelle Supabase Migration für `voice_sessions` Tabelle
- Aktualisiere `supabase-schema.sql`

```sql
CREATE TABLE voice_sessions (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES configs(id),
  transcript JSONB DEFAULT '[]'::jsonb,
  ideas_generated INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  created_at TEXT
);

ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON voice_sessions FOR ALL USING (true);
```

**Files affected:**
- `supabase-schema.sql`

---

### Step 10: Portal Navigation Update

Füge den Voice-Tab zur Client-Navigation hinzu.

**Actions:**
- In `src/components/client-nav.tsx`: Neuer Tab zwischen "Chat" und Logout
- Icon: `Mic` aus lucide-react

```typescript
import { Mic } from "lucide-react";
// Add to tabs array:
{ title: "Voice", href: "/portal/voice", icon: Mic },
```

**Files affected:**
- `src/components/client-nav.tsx`

---

### Step 11: CLAUDE.md Update

Dokumentiere den Voice Agent im CLAUDE.md.

**Actions:**
- Neue Sektion "Voice Agent Pipeline" unter "How The System Works"
- Voice-Server Doku unter "How to Run"
- Neue Dateien in der Workspace Structure
- Voice-Tab in der Portal Pages Tabelle

**Files affected:**
- `CLAUDE.md`

---

## Connections & Dependencies

### Files That Reference This Area

| File | Connection |
|------|-----------|
| `src/middleware.ts` | `/portal/voice` Route muss durchgelassen werden (passiert automatisch da `/portal/*` erlaubt) |
| `src/app/portal/layout.tsx` | Layout wird automatisch angewendet |
| `src/lib/agent-tools.ts` | Tool-Implementierungen werden wiederverwendet |
| `prompts/loader.ts` | `buildPrompt("voice-agent", ...)` muss funktionieren |

### Updates Needed for Consistency

- `prompts/index.ts` — Export für `VOICE_AGENT_TOOLS`
- `CLAUDE.md` — Dokumentation
- `supabase-schema.sql` — Schema-Doku

### Impact on Existing Workflows

- **Kein Breaking Change** — alles ist additiv
- Content Agent (Chat) bleibt unverändert
- Ideas die der Voice Agent speichert erscheinen automatisch überall wo Ideas geladen werden
- Bestehende Agent-Tools werden wiederverwendet ohne Änderung

---

## Validation Checklist

- [ ] `@google/genai` installiert und importierbar
- [ ] Voice Server startet auf Port 4001 ohne Fehler
- [ ] Browser kann WebSocket-Verbindung aufbauen
- [ ] Mikrofon-Zugriff funktioniert, Audio wird gestreamt
- [ ] Gemini antwortet mit Audio (Agent spricht)
- [ ] Transkript wird live im Browser angezeigt
- [ ] Function Calling funktioniert (Client-Kontext wird geladen)
- [ ] Agent stellt relevante Fragen basierend auf Client-Daten
- [ ] Session-Ende generiert Content-Ideen
- [ ] Ideen werden in Supabase `ideas` Tabelle gespeichert
- [ ] Session-Transkript wird in `voice_sessions` gespeichert
- [ ] Portal-Navigation zeigt Voice-Tab
- [ ] CLAUDE.md ist aktualisiert

---

## Success Criteria

1. Ein Client kann auf `/portal/voice` eine Voice Session starten, der Agent stellt kontextbezogene Fragen, und am Ende entstehen 3-5 gespeicherte Content-Ideen
2. Die Latenz ist unter 1.5 Sekunden (Agent antwortet flüssig)
3. Der Agent nutzt Client-Daten (Nische, Strategie, Audit) um relevante Fragen zu stellen — kein generisches Interview

---

## Notes

### V2 Überlegungen (nicht in V1)
- **Voice → Script Pipeline:** Direkt aus Voice Session ein Skript generieren (Voice Agent übergibt Material an Script Agent)
- **Session History:** Frühere Voice Sessions auf der Seite anzeigen mit den generierten Ideen
- **Audio Playback:** Aufnahmen der Sessions speichern und abspielen
- **Admin Voice:** Aysun kann Voice Sessions für beliebige Clients starten (Admin-Modus)
- **Scheduled Voice Sessions:** Client bekommt Reminder "Zeit für dein wöchentliches Content-Interview"
- **Multi-Language:** Gemini kann Sprache erkennen — automatisch Deutsch/Englisch switchen
