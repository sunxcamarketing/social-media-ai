# SUNXCA — Features Roadmap

Living document. Alles was wir besprochen haben, aber (noch) nicht gebaut haben.
Beim Pflegen: Status updaten, neue Ideen unten ergänzen, Prioritäten verschieben.

## Legende

**Prio:** 🔴 Hoch · 🟡 Mittel · 🟢 Niedrig
**Aufwand:** S = <2h · M = 2-8h · L = 1-3 Tage · XL = mehrtägig
**Status:** ⏳ Backlog · 📋 Geplant · 🚧 In Arbeit · ✅ Done

---

## 🎙️ Voice Agent

### 🟡 M · ⏳ — Voice-Live-Interview-Modi konsolidieren
Drei Prompts (`voice-agent`, `voice-agent-onboarding`, `voice-profile-topic`) machen alle „Agent führt Live-Interview" mit anderem Frage-Set. Konsolidieren: 1 Prompt mit Mode-Variable + 3 Question-Sets als Substitution. **Gewinn:** Wartung — gemeinsame Frage-Regeln, Sprach-Stil etc. in 1 Datei.
**Risiko:** mittel — Verhaltens-Drift möglich.

### 🟡 M · ⏳ — VAD-Sensitivität konfigurierbar (Hintergrundgeräusche)
Gemini Live ist standardmäßig MEDIUM-empfindlich auf Mic-Input. Bei lauter Umgebung (Café, Auto, Kinder) bricht der Agent mitten im Satz ab. Setze `realtimeInputConfig.automaticActivityDetection.startOfSpeechSensitivity = LOW` per Default.
**Code:** `src/lib/gemini-live.ts:60-78` (config-Objekt erweitern).

### 🟢 S · ⏳ — Voice-Foundationals: gemeinsame Regeln extrahieren
`voice-frage-regeln.md` und `voice-sprache.md` als Foundationals — werden in mehreren Voice-Prompts dupliziert. Heute: Drift-Risiko zwischen den Prompts. **Gewinn:** DRY, eine Quelle der Wahrheit.

### 🟢 M · ⏳ — Audio-Backup pro Voice-Session
Aktuell nur Transcript in DB. Wenn Gemini transkribiert falsch (passiert bei lauter Umgebung), sind Worte verloren. Idee: Browser zeichnet Audio parallel auf, lädt am Ende in Storage (R2/Supabase). Nur für Recovery, nicht für Replay.
**Stolperstein:** Storage-Kosten + DSGVO bei Audio-Speicherung von Kunden.

---

## 📝 Scripts / Generation

### 🔴 M · ⏳ — Status „Aufgenommen" + IG-Link-Feld
Lifecycle-Erweiterung: `Entwurf → Bereit → Review → Aufgenommen → Live`. Button im Portal „Ich hab das aufgenommen" → Status. Optional: IG-Link-Feld wenn Reel live ist.
**Kosten:** 0 € — kein Video-Storage nötig, nur Status + URL.

### 🟡 L · ⏳ — Video-Upload direkt im Portal (Cloudflare R2)
Statt Drive-Polling: Browser uploadet Video direkt zu R2 via Presigned URL. Vorteile: kein Drive-Setup, kein Polling-Lag, sauber in der App.
**Kosten:** ~$1/Monat bei 50 GB/Jahr Volumen. Zero Egress-Cost bei R2.
**Voraussetzung:** Klärung ob Kunden bereit sind ihren Drive-Workflow aufzugeben.

### 🟡 L · ⏳ — Drive-Polling für Skript-Status
Cron-Job alle 30 Min, listet `googleDriveFolder` neuer Files. Match auf Skript-Titel/ID via Filename → Status auto auf „Aufgenommen". Voraussetzung: Filename-Convention.
**Risiko:** kreative Filenames brechen das Matching.

### 🟡 M · ⏳ — Skript-Generator füllt visualHook/bRoll/caption
Heute: die 3 neuen Felder sind in der DB, aber der Skript-Writer generiert sie nicht. Tool-Schema erweitern (`submit_script`) + Prompt-Anweisung hinzufügen damit Claude diese Felder gleich mitliefert.

### 🟢 M · ⏳ — Skript-Detail-Sektion mit visualHook/bRoll/caption
UI-Anzeige für die neuen Felder: A) Detail-Expand pro Skript-Zeile, B) eigene Sektion unter ScriptCell. Plus: Edit-Form für Admin.

### 🟢 S · ⏳ — Default-Status „Bereit" einstellbar pro Client
Manche Kunden wollen jedes Skript vor Freigabe sehen → Default „Entwurf". Andere wollen direkt sehen → Default „Bereit". Heute: hardcoded „entwurf".

### 🟡 M · ⏳ — Anhänge bei Ideen & Skripten speichern
Bei Ideen UND Skripten sollen Anhänge mit gespeichert werden können — Bilder, PDFs, Screenshots, Voice-Memos, Referenz-Reels, Inspirations-Material. Heute: nur Text. Idee: Upload-Button im Idea-Card und Script-Card, Files landen in Supabase Storage / R2, gespeichert als URL-Liste am Datensatz. Use-Case: Kunde sammelt während der Woche Inspos auf dem Handy → wirft sie zur Idee dazu → beim Ausformulieren hat der Content Agent Kontext + Aysun sieht beim Filmen was visuell gemeint war.
**Was gebaut werden muss:**
- DB: `ideas.attachments` und `scripts.attachments` (JSONB-Array von `{url, name, mime, size}`)
- Storage: Bucket-Setup (Supabase Storage am simpelsten, da schon dort)
- Upload-UI: Drag&Drop + File-Picker im Idea/Script-Card-Detail
- Preview-UI: Thumbnail-Grid für Bilder, Icon+Name für andere Dateien, Klick öffnet/lädt
- Optional: Content Agent Tool um Anhänge bei Idea-Develop mitzulesen (für Bilder via Vision)
**Aufwand:** M (4-6h) — Storage + UI + DB-Migration. Vision-Integration optional als L-Erweiterung.

---

## 🔌 Integrations

### 🟡 M · ⏳ — Stripe Payment Links pro Kunde (Subscription-Verwaltung)
Aysuns Stripe-Account ist die zentrale Kassa, jeder Kunde hat individuellen Deal/Preis. Lösung: pro Client einen **Payment Link** im Stripe Dashboard anlegen (recurring monthly mit Custom-Preis), Link in der App speichern. Portal zeigt Buttons "💳 Jetzt abonnieren" und "Abo verwalten".
**Was gebaut werden muss:**
- `configs.stripePaymentLink` (TEXT) — pro Kunde individueller Payment Link aus Stripe Dashboard
- (Optional) globale `STRIPE_CUSTOMER_PORTAL_URL` env — Stripe's Login-by-Email-Portal für bestehende Kunden zum Verwalten (Karte/Kündigung)
- Admin-UI: Feld auf Client-Information-Seite zum Reinpasten des Links
- Portal-UI: Account/Abo-Sektion oder Header-Button "Subscription verwalten" → öffnet Link in neuem Tab
- **Keine Stripe-API-Integration nötig** — App ist nur Link-Container, Aysun behält volle Kontrolle im Stripe Dashboard
**Aufwand:** M (2-4h) — minimal, weil keine API/Webhook/SDK-Integration. Reine UI + 1 DB-Feld.
**Erweiterung später (separater Eintrag):** Stripe Webhook + API für automatischen Status-Sync ("aktiv / überfällig / gekündigt") in der Admin-Übersicht. Lohnt erst ab >5 Kunden.

### 🔴 L · ⏳ — Auto-Card in ClickUp wenn Skript approved
Wenn Kunde im Portal ein Skript abhakt („passt, geht ins Filmen") → automatisch ClickUp-Card in seinem Workspace mit dem kompletten Skript als Beschreibung. Damit Editor direkt sehen kann was zu filmen ist, ohne dass Aysun manuell rüberkopieren muss.
**Was rein muss in die Card:** Titel, Format, Pillar, Audio-Hook, Visual-Hook, Text-Hook, Body, CTA, B-Roll-Liste, Caption, Shot-List, Link zurück zum Portal-Skript.
**Was gebaut werden muss:**
- Pro Client: ClickUp-API-Token + List-ID Speicherung (encrypted in `configs` oder neue `client_integrations` Tabelle)
- Admin-UI in Client-Information-Seite: „ClickUp verbinden" + List-Picker
- Trigger: neuer Skript-Status z.B. „Geht ins Filmen" (oder direkt bei `approved`-Feedback) → Backend erstellt Card via ClickUp API
- Idempotenz: wenn Skript schon eine Card hat → Update statt Insert (Card-ID auf Skript speichern)
- Async + Retry: API-Call darf den Feedback-Klick nicht blockieren
**Aufwand:** L (1-3 Tage) — nicht trivial wegen Per-Client-Config + Token-Sicherheit + Error-Handling.
**Voraussetzungen:** ClickUp API-Token von Aysuns Workspace, MCP-Integration ist schon im Repo (`.mcp.json`) — könnte adaptiert werden für Backend-API-Calls.

---

## 🔗 Idea ↔ Skript Pipeline

### 🟡 M · ⏳ — Skript-Generator nutzt Voice-Transcript proaktiv anzeigen
Heute: Wenn Idea eine `sourceSessionId` hat, wird Transcript in Chat-Seed gepackt. Aber im **Skripte-Tab** sieht man nicht, dass ein Skript aus einer Voice-Session entstanden ist. Idee: Badge „Aus Voice-Gespräch" auf der Skript-Zeile, plus Link zum Original-Transcript.

### 🟢 S · ⏳ — Idea retroactively to existing scripts
Bestehende alte Skripte haben kein `source_session_id` (nur neue). Falls jemand alte Skripte später überarbeiten will mit dem Voice-Material, könnte ein Admin-Tool nachträglich verknüpfen.

---

## 🧠 Operations / Observability

### 🟡 L · ⏳ — Prompt-Versionierung
Heute: `voice-agent.md` editieren → sofort live für alle. Kein Rollback. Idee: `voice-agent.v2.md`, `v3.md` — Code wählt Version per env oder Feature-Flag. **Gewinn:** Sicheres iterieren, A/B-Tests möglich.

### 🟡 L · ⏳ — Eval-Suite für Agents
Pro kritischem Agent (script-writer, voice-agent, weekly-ideas): Test-Suite mit Beispiel-Inputs + erwarteten Output-Eigenschaften. Vor jedem Prompt-Edit laufen lassen — du siehst Regressionen sofort statt erst wenn sich Kunden beschweren.
**Beispiel-Tests:**
- Voice-Agent öffnet immer mit Vorname + Pillar + Open Door
- Skript-Writer enthält keine verbotenen AI-Phrasen
- Strategy-Pipeline produziert mindestens 3 Pillars

### 🟡 M · ⏳ — Quality-Score pro Voice-Session
Post-hoc Bewertung: Claude liest das Transcript, gibt 1-10 Score (Engagement, Substanz, Materialqualität). Sammeln in DB → Trends sichtbar (welche Kunden geben gutes Material? welche Sessions waren Müll?). Hilft beim Tuning.

### 🟢 M · ⏳ — Cost Dashboard erweitern
Aktuell: tracking pro Operation. Erweitern um: Budget-Alarm bei Überschreitung, Top-Kostentreiber pro Kunde, Trend-View (Monat über Monat).

### 🟢 S · ⏳ — Sentry / Error-Tracking
Aktuell: Errors landen nur in Fly/Vercel Logs. Idee: Sentry für Frontend + Backend → Stack-Traces + User-Context bei Fehlern. ~$0/Monat im Free Tier.

---

## 🏗️ Architecture / Code Quality

### 🟡 S · ⏳ — Restliche Sonnet-Hardcodes auf MODEL_SONNET migrieren
16 Files nutzen noch `"claude-sonnet-4-6"` als String. Auf `MODEL_SONNET` Konstante umstellen — nur kosmetisch, aber konsistent.

### 🟢 M · ⏳ — voice-server: Prompt-Cache disable in dev
NODE_ENV check funktioniert, aber wenn Voice-Server prod läuft, müssen wir bei Prompt-Updates `fly deploy` machen. Idee: Hot-Reload via File-Watcher oder Webhook von Git Push.

### 🟢 S · ⏳ — Reprocess-Skript als Cron statt manuell
`scripts/reprocess-voice-sessions.ts` ist heute manuell. Idee: täglich automatisch laufen lassen für alle voice_sessions mit ideas_generated=0. Sicherheitsnetz wenn Live-Extraktion crasht.

### 🟢 M · ⏳ — DB-Migration-Pipeline
Heute: Migrations werden manuell im Supabase SQL Editor ausgeführt. Idee: Supabase CLI mit gepushten Migrations + automatischer Apply bei Deploy. **Aufwand:** mittel, aber dauerhaft Zeit sparend.

---

## 🎨 UI / UX

### 🟡 M · ⏳ — Multi-Client-Switcher (Owner-Konzept)
Wenn mehrere Personen auf der App arbeiten + jede mehrere eigene Brands hat → Sidebar zeigt „Meine Brands" pro User. Heute: nur Aysun hat dieses Konstrukt, hardcoded via `isOwner`-Flag.
**Wann lohnt es:** wenn ein Kunde mehrere eigene Brands hat oder du mehrere Admins ranziehst.

### 🟢 S · ⏳ — Skript-Tabelle: spaltensortierbar + filterbar
Heute: nur per-Status-Tab. Idee: Sortier-Klick auf Spalten (Datum, Pillar, Feedback). Multi-Filter (Status + Pillar gleichzeitig).

### 🟢 M · ⏳ — Bulk-Operations im Skript-Tab
Heute: ausgewählte Skripte können nur gelöscht werden. Idee: Bulk-Status setzen, Bulk-Release, Bulk-Pillar-Änderung.

### 🟢 S · ⏳ — Notifications / Activity-Feed
Wenn Kunde Feedback gibt → kurze Benachrichtigung in der Admin-UI (Top-Bar Badge). Heute: Aysun muss aktiv die Skripte-Seite aufrufen.

---

## 📦 Erledigt heute (29.-30. April 2026)

Für die Erinnerung was schon gebaut wurde — falls du in 3 Monaten denkst „haben wir das nicht schon mal angefasst":

- ✅ Voice-Server: Idea-Extraktion mit `ANTHROPIC_API_KEY` repariert
- ✅ Voice-Agent: kompletter Prompt-Rewrite (Pillar-fokussiert, Themen-Bündelung, intelligenter Wechsel statt Zähler)
- ✅ Voice-Agent: rotierende Begrüßung mit Vorname, Themenvorschlag aus Pillars/subTopics, Open-Door
- ✅ Voice-Agent: Multi-Session-Memory (3 letzte Sessions) + Already-Extracted-Ideas + Pillar-Coverage
- ✅ Voice-Server: Modell-Upgrade auf `gemini-2.5-flash-native-audio-preview-12-2025`
- ✅ Voice-Server: inkrementelles Transcript-Save alle 15s + Last-Resort-Save bei Crash
- ✅ Headphones/Speakers Toggle in der Voice-Page (Default Headphones)
- ✅ Voice-Agent: Audio bricht sofort ab beim Auflegen (kein Nachreden mehr)
- ✅ Owner-Brands: Sidebar-Trennung „Meine Brands" / „Kunden", Default-Routing
- ✅ Middleware-Fix: Favicon/Icon-Routes ohne Auth (Logo erscheint für Nicht-Eingeloggte)
- ✅ Cleanup: 12 Dead-Prompts gelöscht, Viral-Script-Builder komplett entfernt (~1900 Zeilen)
- ✅ Idea→Script-Verlinkung: `ideas.source_session_id` + Develop-Idea lädt Voice-Transcript
- ✅ Skript-Writer-Prompts respektieren Voice-Material (keine doppelten Fragen)
- ✅ Modell-Tiering: 10 Calls auf Haiku 4.5 (Quality-Gates, Extraction)
- ✅ Skript-Konsolidierung: `topic-script` → `single-script` (1 Agent statt 2)
- ✅ Repo-Hygiene: Git-Repo komplett re-cloned (19 MB → 2.9 MB, 0 fsck-Warnings)
- ✅ Voice-Server-Deploy: alle Secrets korrekt auf Fly gesetzt
- ✅ Hero-Insight-Card auf Dashboard ist klickbar
- ✅ Scripts: 3 neue Felder geplant (`visual_hook`, `b_roll`, `caption`)
- ✅ Scripts: Status-Dropdown statt Cycle, gekoppelt mit Client-Sichtbarkeit
- ✅ Scripts: Status „Veröffentlicht" raus, „Review" rein (auto bei Kunden-Feedback)
- ✅ Scripts: „Kunden-Feedback"-Spalte sichtbar in Admin + Portal-Tabelle
- ✅ Scripts: 12 verlorene Voice-Session-Ideen recovered (Anna 8 + Aysun Personal 4)

---

## Ideen-Sammelpunkt (noch nicht eingeordnet)

Hier landen Spontan-Ideen die noch keine Priorität haben. Beim nächsten Aufräumen einsortieren oder verwerfen.

- _(leer — füll dich mit dem nächsten „wäre cool wenn…")_
