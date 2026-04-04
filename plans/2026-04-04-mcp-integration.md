# Plan: MCP-Integration — Social Media AI auf das nächste Level

**Created:** 2026-04-04
**Status:** Draft
**Request:** MCP-Server strategisch einbinden, um die Social Media Agents und den Entwicklungs-Workflow zu verbessern.

---

## Overview

### Was MCP ist

Model Context Protocol (MCP) ist ein offener Standard, der AI-Modelle mit externen Tools und Datenquellen verbindet. Statt dass der Agent nur gespeicherte Daten nutzt, kann er live auf echte Systeme zugreifen — Web durchsuchen, Dateien lesen, E-Mails senden.

### Was dieser Plan erreicht

Drei Ebenen von MCP-Integration:

1. **Claude Code Workflow** (für dich als Entwicklerin) — Mehr MCP-Server in `.mcp.json` für schnelleres Arbeiten
2. **Content Agent aufrüsten** — Live-Daten statt nur gespeicherte Supabase-Daten
3. **Pipeline-Automatisierung** — Google Drive Sync, Benachrichtigungen, Content-Kalender

### Warum das wichtig ist

- **Trend Research** basiert aktuell auf Claudes Wissen (Cutoff-Datum) — keine echten Live-Trends
- **Training Scripts** werden manuell über Google Drive importiert — könnte automatisch laufen
- **Content Agent** kann nur interne Daten lesen — kein Web-Zugriff, keine Live-Recherche
- **Entwicklung** wird schneller wenn Claude Code direkt auf alle Services zugreifen kann

---

## Aktueller Stand

### Was schon da ist

| Service | Status | Integration |
|---------|--------|-------------|
| Supabase MCP | Konfiguriert in `.mcp.json` | Claude Code kann direkt SQL ausführen |
| Google Drive | Custom Code in `src/lib/google-drive.ts` | Manueller Sync über `/api/configs/[id]/sync-drive` |
| Apify | Custom Code in `src/lib/apify.ts` | Scraping in Video-Pipeline |
| Gemini | Custom Code in `src/lib/gemini.ts` | Video-Analyse |

### Was fehlt

- Kein Web-Zugriff für Live-Trend-Recherche
- Kein automatischer Drive-Sync (nur manuell über Button)
- Content Agent hat keinen Zugriff auf externe Datenquellen
- Keine Benachrichtigungen wenn Pipelines fertig sind

---

## Implementierung — 3 Phasen

---

### Phase 1: Claude Code Workflow verbessern (Quick Wins)

**Aufwand:** 15 Min — nur `.mcp.json` erweitern

Neue MCP-Server für den Entwicklungs-Workflow hinzufügen, damit Claude Code mehr kann:

#### 1.1 — Web Search MCP für Claude Code

```json
// In .mcp.json hinzufügen
"brave-search": {
  "command": "npx",
  "args": ["-y", "@anthropic-ai/mcp-server-brave-search"],
  "env": { "BRAVE_API_KEY": "${BRAVE_API_KEY}" }
}
```

**Nutzen:** Claude Code kann live im Web recherchieren — NPM-Pakete vergleichen, Docs lesen, Best Practices finden.

#### 1.2 — Google Drive MCP für Claude Code

```json
"google-drive": {
  "command": "npx",
  "args": ["-y", "@anthropic-ai/mcp-server-google-drive"],
  "env": { "GOOGLE_SERVICE_ACCOUNT_KEY": "${GOOGLE_SERVICE_ACCOUNT_KEY}" }
}
```

**Nutzen:** Training-Transkripte direkt lesen und analysieren ohne manuellen Export.

#### 1.3 — Gmail MCP (optional)

Bereits in Claude Code verfügbar als `mcp__claude_ai_Gmail__authenticate`. Nur authentifizieren.

**Nutzen:** Client-E-Mails direkt aus Claude Code senden (Audit-Reports, Einladungen).

---

### Phase 2: Content Agent mit Live-Daten aufrüsten (Größter Impact)

**Aufwand:** 1-2 Tage — neues Tool + Prompt-Update

Das ist der größte Hebel: Der Content Agent bekommt Zugang zu echten Live-Daten.

#### 2.1 — Neues Agent-Tool: `search_web`

**Datei:** `src/lib/agent-tools.ts`

```typescript
// Neues Tool: Web-Suche für Live-Trends und Recherche
{
  name: "search_web",
  description: "Durchsuche das Web nach aktuellen Trends, News und Informationen zur Nische des Clients. Nutze dies für: aktuelle Branchentrends, virale Themen, saisonale Events, Wettbewerber-News.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Suchbegriff — spezifisch für die Nische" },
      market: { type: "string", default: "DE", description: "Markt (DE/AT/CH)" }
    },
    required: ["query"]
  }
}
```

**Implementierung:** Brave Search API direkt aufrufen (kein MCP nötig im App-Code — MCP ist für Claude Code, die App nutzt die API direkt).

#### 2.2 — Neues Agent-Tool: `research_trends`

Kombiniert Web-Suche mit Nischen-Kontext:

```typescript
{
  name: "research_trends",
  description: "Recherchiere aktuelle Trends für die Nische. Findet virale Themen, saisonale Chancen und Content-Lücken basierend auf echten Live-Daten.",
  input_schema: {
    type: "object",
    properties: {
      niche: { type: "string" },
      focus: { type: "string", enum: ["viral", "seasonal", "news", "competitor"] }
    },
    required: ["niche"]
  }
}
```

#### 2.3 — Content Agent Prompt updaten

**Datei:** `prompts/agents/content-agent.md`

Neue Sektion für Web-Tools hinzufügen:

```markdown
## Live-Recherche Tools

Du hast Zugriff auf das Web. Nutze `search_web` und `research_trends` wenn:
- Der Client nach aktuellen Trends fragt
- Du Skripte zu einem Thema schreibst und aktuelle Daten brauchst
- Du saisonale Content-Ideen generierst
- Du Wettbewerber-Aktivitäten recherchierst

WICHTIG: Kombiniere Live-Daten mit dem gespeicherten Client-Kontext.
Nie nur Web-Ergebnisse wiedergeben — immer durch die Brille der Client-Strategie filtern.
```

#### 2.4 — Trend Research Pipeline mit echten Daten

**Datei:** `src/app/api/configs/[id]/generate-week-scripts/route.ts` (Step 2.5)

Aktuell: Claude denkt sich Trends basierend auf seinem Wissen aus.
Neu: Erst Web-Suche nach echten Trends, dann Claude zur Einordnung.

```
Vorher:  Claude → "Denk dir Trends aus" → Trends
Nachher: Brave Search → echte Trends → Claude → "Ordne diese Trends ein" → Trends
```

---

### Phase 3: Automatisierung & Workflows (Nice-to-Have)

**Aufwand:** 1-2 Tage — optional, wenn Phase 1+2 laufen

#### 3.1 — Automatischer Google Drive Sync

Statt manueller "Sync Drive" Button → automatischer Check:
- Supabase Edge Function die alle 6h Google Drive nach neuen Transkripten prüft
- Bei neuen Dateien: automatisch importieren + Voice Profile regenerieren
- Benachrichtigung an Admin

#### 3.2 — Pipeline-Completion Webhooks

Nach jeder fertigen Pipeline-Execution:
- Slack/Discord Notification: "Wöchentliche Skripte für [Client] sind fertig"
- Optional: E-Mail an Client über Resend

#### 3.3 — Content-Kalender Sync

Generierte Skripte automatisch in einen Google Calendar oder Notion eintragen:
- Jedes Skript → Kalender-Event am geplanten Tag
- Client sieht im Kalender was wann gepostet werden soll

---

## Priorisierte Reihenfolge

| Prio | Was | Aufwand | Impact |
|------|-----|---------|--------|
| 1 | Phase 1: MCP-Server in `.mcp.json` | 15 Min | Sofort besserer Dev-Workflow |
| 2 | Phase 2.1-2.2: Web-Suche Tools für Content Agent | 3-4h | Content Agent mit Live-Daten |
| 3 | Phase 2.4: Trend Research Pipeline upgraden | 2-3h | Bessere wöchentliche Skripte |
| 4 | Phase 2.3: Agent Prompt updaten | 30 Min | Agent weiß wann er Web nutzt |
| 5 | Phase 3.1: Auto Drive Sync | 4-6h | Weniger manuelle Arbeit |
| 6 | Phase 3.2-3.3: Notifications + Kalender | 4-6h | Nice-to-have Automation |

---

## Wichtige Unterscheidung: MCP vs. direkte API-Calls

| | MCP-Server (`.mcp.json`) | Direkte API-Calls (im App-Code) |
|---|---|---|
| **Wer nutzt es** | Claude Code (du + ich beim Entwickeln) | Deine App zur Laufzeit |
| **Beispiel** | Supabase MCP → ich kann SQL direkt ausführen | `src/lib/apify.ts` → App scrapt Instagram |
| **Wann MCP** | Entwicklung, Debugging, Ad-hoc-Queries | — |
| **Wann API** | — | Alles was die App selbst tun muss |

Für den **Content Agent** (Phase 2) bauen wir direkte API-Calls ein (z.B. Brave Search API), NICHT MCP — weil MCP für Claude Code ist, nicht für deine Next.js App.

Für **deinen Workflow** (Phase 1) fügen wir MCP-Server hinzu, damit ich dir besser helfen kann.

---

## Benötigte API Keys

| Service | Key | Kosten |
|---------|-----|--------|
| Brave Search API | `BRAVE_API_KEY` | Free Tier: 2000 Queries/Monat |
| Google Drive | Schon vorhanden (`GOOGLE_SERVICE_ACCOUNT_KEY`) | Kostenlos |
| Gmail | OAuth via Claude Code | Kostenlos |

---

## Files die geändert werden

| Datei | Änderung |
|-------|----------|
| `.mcp.json` | Neue MCP-Server hinzufügen |
| `.env` | `BRAVE_API_KEY` hinzufügen |
| `src/lib/agent-tools.ts` | `search_web` + `research_trends` Tools |
| `src/lib/brave-search.ts` | Neuer API Client (ähnlich wie apify.ts) |
| `prompts/agents/content-agent.md` | Web-Tool Instruktionen |
| `prompts/agents/trend-research.md` | Live-Daten statt pure Reasoning |
| `src/app/api/configs/[id]/generate-week-scripts/route.ts` | Trend-Step mit Web-Suche |
