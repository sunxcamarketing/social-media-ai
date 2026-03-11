# Plan: Leadmagnet Landing Page — Instagram Profil-Audit

**Created:** 2026-03-12
**Status:** Implemented
**Request:** Landing Page als Leadmagnet mit Formular (Email, Name, Nachname, Instagram Handle). Nach Submit wird das Instagram-Profil analysiert und ein KI-Report mit Verbesserungsvorschlägen erstellt.

---

## Overview

### What This Plan Accomplishes

Eine standalone Landing Page im SUNXCA Design, die als Leadmagnet fungiert. Besucher geben ihre Kontaktdaten + Instagram Handle ein, das System scrapt ihr Profil via Apify, analysiert es mit Claude, und zeigt einen personalisierten Audit-Report mit konkreten Verbesserungsvorschlägen direkt auf der Seite an. Leads werden in einer CSV gespeichert.

### Why This Matters

Lead-Generierung ist zentral für Aysuns Business. Ein kostenloser Instagram-Audit zeigt sofort Kompetenz, liefert dem Interessenten echten Mehrwert, und sammelt gleichzeitig qualifizierte Kontakte. Die bestehende Infrastruktur (Apify, Claude, CSV) wird wiederverwendet.

---

## Current State

### Relevant Existing Structure

- `app/src/app/(landing)/layout.tsx` — Leeres Landing-Layout (bereit)
- `app/src/lib/apify.ts` — `scrapeCreatorStats()` holt Profildaten + `scrapeReels()` holt Reels
- `app/src/lib/claude.ts` — Claude SDK Integration
- `app/src/lib/csv.ts` — CSV read/write Utilities
- `SUNXCA-Design-System.md` — Komplettes Design System
- `app/src/lib/i18n.tsx` — DE/EN Übersetzungen

### Gaps Being Addressed

- Keine Landing Pages vorhanden
- Kein Lead-Capture-Mechanismus
- Kein Instagram-Audit-Feature (nur Competitor-Analyse für bestehende Clients)

---

## Proposed Changes

### Summary of Changes

- Landing Page mit Formular + animiertem Audit-Report
- API Route für Lead-Speicherung + Instagram-Scraping + Claude-Analyse (SSE-Stream)
- CSV-Datei für Lead-Speicherung
- i18n Translations für Landing Page Texte

### New Files to Create

| File Path | Purpose |
|---|---|
| `app/src/app/(landing)/audit/page.tsx` | Landing Page: Hero, Formular, Report-Anzeige |
| `app/src/app/api/audit/route.ts` | API: Lead speichern → Profil scrapen → Claude Audit → SSE Stream |
| `data/leads.csv` | Lead-Datenbank (Name, Email, Handle, Datum, Report-Status) |

### Files to Modify

| File Path | Changes |
|---|---|
| `app/src/lib/csv.ts` | `readLeads()` / `writeLead()` Funktionen hinzufügen |
| `app/src/lib/i18n.tsx` | Landing Page Translations (DE/EN) hinzufügen |

---

## Design Decisions

### Key Decisions

1. **SSE-Stream statt einfacher Response**: Die Analyse dauert 15-30s (Apify + Claude). Mit SSE sieht der User Live-Fortschritt (Profil geladen → Reels analysiert → Report generiert) statt einem leeren Loading Screen.

2. **Report inline auf der Seite anzeigen**: Kein Redirect auf eine separate Seite. Das Formular wird durch den Report ersetzt — weniger Friction, bessere UX.

3. **URL: `/audit`**: Kurz, klar, teilbar. Keine verschachtelten Pfade.

4. **SUNXCA Design System**: Landing Page nutzt das bestehende Design (Ocean, Blush, Warm White, Geist Font, Gradient Orbs) für Brand Consistency.

5. **CSV für Leads**: Konsistent mit dem Rest der App. Keine Datenbank nötig für den Anfang.

6. **Claude für Audit-Report**: Nutzt Claude Sonnet mit einem spezialisierten Audit-Prompt. Bekommt Profildaten + Reel-Metriken als Input und generiert strukturierten Report.

7. **Kein Email-Versand im ersten Schritt**: Report wird direkt angezeigt. Email-Versand kann später ergänzt werden.

---

## Step-by-Step Tasks

### Step 1: CSV Lead-Speicherung

Erweitere `app/src/lib/csv.ts` um Lead-Management.

**Actions:**
- Lead-Typ definieren: `{ id, firstName, lastName, email, instagramHandle, createdAt, reportGenerated }`
- `readLeads()` und `appendLead()` Funktionen nach bestehendem Muster (analog zu `appendVideo`)
- CSV-Datei: `data/leads.csv`

**Files affected:**
- `app/src/lib/csv.ts`

---

### Step 2: API Route `/api/audit`

Erstelle die API Route mit SSE-Streaming.

**Actions:**
- POST Handler empfängt `{ firstName, lastName, email, instagramHandle }`
- Validierung: Alle Felder required, Email-Format prüfen, Instagram Handle bereinigen (@-Prefix entfernen)
- Lead in CSV speichern
- SSE Stream starten mit Phasen:
  1. `{ phase: "scraping", message: "Profil wird geladen..." }` → `scrapeCreatorStats(handle)`
  2. `{ phase: "reels", message: "Reels werden analysiert..." }` → `scrapeReels(handle, 12, 30)` (letzte 12 Reels, 30 Tage)
  3. `{ phase: "analyzing", message: "KI-Report wird erstellt..." }` → Claude Audit mit Profil + Reel-Daten
  4. `{ phase: "done", report: { ... } }` → Fertiger Report als JSON
- Error handling: `{ phase: "error", message: "..." }`

**Claude Audit Prompt** — Input: Profilname, Bio, Follower, Following, Posts, letzte 12 Reels (Views, Likes, Comments, Duration). Output strukturiert als:

```
1. PROFIL-ÜBERBLICK — Zusammenfassung des aktuellen Stands
2. STÄRKEN — Was bereits gut funktioniert (2-3 Punkte)
3. VERBESSERUNGSPOTENZIAL — Konkrete Schwächen (3-4 Punkte)
4. CONTENT-ANALYSE — Muster in den letzten Reels (Engagement-Rate, beste/schlechteste Performance, optimale Videolänge)
5. SOFORT-MASSNAHMEN — 3 konkrete Tipps die sofort umgesetzt werden können
6. WACHSTUMSPROGNOSE — Realistisches Potenzial bei Umsetzung
```

**Files affected:**
- `app/src/app/api/audit/route.ts`

---

### Step 3: Landing Page UI

Erstelle die Landing Page im SUNXCA Design.

**Actions:**

**Layout-Struktur:**
```
┌──────────────────────────────────────┐
│  Navbar (Logo links, DE/EN rechts)   │
├──────────────────────────────────────┤
│                                      │
│  Hero Section (Warm White bg)        │
│  - Section Label: "KOSTENLOS"        │
│  - H1: "Dein Instagram Profil-Audit" │
│  - Subtitle: Wert-Versprechen        │
│  - Gradient Orbs (Blush + Wind)      │
│                                      │
├──────────────────────────────────────┤
│                                      │
│  Formular (zentriert, max-w-md)      │
│  - Vorname + Nachname (2 Spalten)    │
│  - Email                             │
│  - Instagram Handle (@...)           │
│  - Submit Button (Ocean, full width) │
│                                      │
├──────────────────────────────────────┤
│                                      │
│  Social Proof / Trust Section        │
│  - "100+ Profile analysiert"         │
│  - "In 30 Sekunden"                  │
│  - "Konkrete Tipps"                  │
│                                      │
├──────────────────────────────────────┤
│                                      │
│  Footer (minimal)                    │
│                                      │
└──────────────────────────────────────┘
```

**Nach Submit → Report View:**
```
┌──────────────────────────────────────┐
│  Navbar                              │
├──────────────────────────────────────┤
│                                      │
│  Fortschritts-Anzeige (während SSE)  │
│  - Animierte Schritte mit Checks     │
│  - "Profil wird geladen..." ✓        │
│  - "Reels werden analysiert..." ✓    │
│  - "Report wird erstellt..." ●       │
│                                      │
├──────────────────────────────────────┤
│                                      │
│  Profil-Header                       │
│  - Profilbild + Name + Bio           │
│  - Follower / Following / Posts      │
│                                      │
├──────────────────────────────────────┤
│                                      │
│  Audit Report (Markdown gerendert)   │
│  - 6 Sektionen mit Icons             │
│  - Cards pro Sektion                 │
│                                      │
├──────────────────────────────────────┤
│                                      │
│  CTA: "Willst du mehr? Lass uns      │
│  gemeinsam eine Strategie bauen."    │
│  [Termin buchen] Button              │
│                                      │
└──────────────────────────────────────┘
```

**Styling:**
- `"use client"` für interaktive State
- SUNXCA Farben via Tailwind custom classes (ocean, blush, warm-white, cream, ivory)
- Gradient Orbs als Hintergrund-Dekoration
- Input-Styling: `rounded-xl border border-ocean/10 bg-warm-white px-5 py-3.5`
- Button: `rounded-full bg-ocean px-8 py-4 text-white font-medium`
- Animationen: CSS transitions für Formular → Report Übergang
- Responsive: Mobile-first

**Files affected:**
- `app/src/app/(landing)/audit/page.tsx`

---

### Step 4: i18n Translations

Füge DE/EN Translations für alle Landing Page Texte hinzu.

**Actions:**
- Alle sichtbaren Texte in i18n Keys:
  - `audit.hero.label`, `audit.hero.title`, `audit.hero.subtitle`
  - `audit.form.firstName`, `audit.form.lastName`, `audit.form.email`, `audit.form.instagram`, `audit.form.submit`
  - `audit.progress.scraping`, `audit.progress.reels`, `audit.progress.analyzing`, `audit.progress.done`
  - `audit.report.overview`, `audit.report.strengths`, `audit.report.improvements`, `audit.report.content`, `audit.report.actions`, `audit.report.growth`
  - `audit.cta.title`, `audit.cta.button`
  - `audit.trust.*` (Social Proof Badges)

**Files affected:**
- `app/src/lib/i18n.tsx`

---

### Step 5: Landing Layout erweitern

Das Landing Layout bekommt eine minimale Navbar (Logo + Sprach-Toggle).

**Actions:**
- Logo: "SUNXCA" im Design System Stil (font-light, tracking-[0.3em], uppercase, "x" in ivory)
- Rechts: DE/EN Toggle (aus bestehendem TopBar Pattern)
- Keine Sidebar, kein App-Navigation

**Files affected:**
- `app/src/app/(landing)/layout.tsx`

---

## Validation Checklist

- [ ] `/audit` zeigt Landing Page mit Formular
- [ ] Formular-Validierung funktioniert (alle Felder required, Email-Format)
- [ ] Submit speichert Lead in `data/leads.csv`
- [ ] Instagram-Profil wird korrekt gescrapt
- [ ] Claude generiert strukturierten Audit-Report
- [ ] SSE-Stream zeigt Live-Fortschritt
- [ ] Report wird sauber dargestellt
- [ ] DE/EN Toggle funktioniert
- [ ] Mobile-responsive
- [ ] Build kompiliert fehlerfrei
- [ ] CLAUDE.md aktualisiert

---

## Success Criteria

1. Besucher kann unter `/audit` das Formular ausfüllen und abschicken
2. Nach ~20-30 Sekunden erscheint ein personalisierter Instagram-Audit-Report
3. Lead-Daten sind in `data/leads.csv` gespeichert
4. Seite sieht professionell aus im SUNXCA Design und funktioniert auf Mobile

---

## Notes

- **Spätere Erweiterungen**: Email-Versand des Reports (z.B. via Resend), PDF-Export, Rate Limiting, Honeypot Spam-Schutz
- **Kosten pro Lead**: ~1 Apify-Call + 1 Claude-Call ≈ wenige Cent pro Audit
- **Datenschutz**: Für DSGVO-Konformität später Checkbox für Einwilligung ergänzen

---

## Implementation Notes

**Implemented:** 2026-03-12

### Summary

All 5 steps executed successfully. Landing page at `/audit` with form, SSE-streamed progress, Claude-generated audit report, SUNXCA design system styling, and DE/EN i18n support.

### Deviations from Plan

- Markdown rendering done with custom inline parser instead of a markdown library (keeps bundle small, sufficient for the structured report format)
- Audit prompt supports both DE and EN based on user's language toggle selection

### Issues Encountered

- Pre-existing build lock file from concurrent build — removed and rebuilt successfully
