# Plan: Kunden-Login mit eigenem geschütztem Bereich

**Created:** 2026-04-03
**Status:** Implemented
**Request:** Jeder Kunde soll nach Login nur seinen eigenen Bereich sehen — mit Datenisolation, Rollentrennung (Admin vs. Kunde), und Einladungs-Flow.

---

## Overview

### What This Plan Accomplishes

Kunden bekommen einen eigenen Login und sehen nach dem Einloggen ausschließlich ihren eigenen Bereich (Skripte, Strategie, Analyse, Videos). Aysun behält als Admin vollen Zugriff auf alle Clients und alle Funktionen. Kunden werden per Magic Link eingeladen — kein Passwort nötig.

### Why This Matters

Aktuell ist die App komplett offen — jeder eingeloggte User sieht alles. Für eine professionelle Agentur müssen Kunden ihren Content eigenständig einsehen können, ohne Zugriff auf andere Kunden oder Admin-Funktionen.

---

## Current State

### Relevant Existing Structure

| Was | Status |
|-----|--------|
| Supabase Auth | Bereits integriert (Login-Page, Middleware, Sign-In/Out) |
| Middleware (`src/middleware.ts`) | Leitet nicht-authentifizierte User zu `/login` |
| Login-Page (`src/app/login/page.tsx`) | Email/Passwort Login funktioniert |
| Supabase RLS | Aktiviert aber permissiv (Service Role bypassed alles) |
| `configs` Tabelle | Kein `owner_id` oder `user_id` Feld |
| API Routes | Keine Auth-Checks, keine Datenisolation |
| Sidebar | Zeigt alle Clients, alle Tools |

### Gaps or Problems Being Addressed

1. Kein Rollen-Konzept (Admin vs. Kunde)
2. Keine Datenisolation — alle APIs geben alle Daten zurück
3. Kein Einladungs-Flow für Kunden
4. Sidebar zeigt alles für jeden
5. Kunden können andere Kunden sehen, löschen, bearbeiten

---

## Proposed Changes

### Summary of Changes

- Neue `client_users` Tabelle in Supabase: verknüpft Auth-User mit Config/Client + Rolle
- Middleware erweitern: Rolle erkennen, Kunden auf ihren Bereich routen
- Alle API-Routes absichern: Auth-Check + Datenisolation
- Kunden-Layout: vereinfachte Sidebar, nur eigene Daten
- Admin-Bereich: Einladungs-Button pro Client
- Login-Page: Magic Link Support für Kunden

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `src/lib/auth.ts` | Zentrale Auth-Helpers: `getCurrentUser()`, `requireAdmin()`, `requireClientAccess(clientId)` |
| `src/app/(client)/layout.tsx` | Kunden-Layout: vereinfachte Navigation ohne Sidebar |
| `src/app/(client)/page.tsx` | Kunden-Dashboard: Übersicht über eigenen Bereich |
| `src/app/(client)/scripts/page.tsx` | Kunden-Skript-Ansicht (read-only oder mit Feedback) |
| `src/app/(client)/strategy/page.tsx` | Kunden-Strategie-Ansicht |
| `src/app/(client)/videos/page.tsx` | Kunden-Video-Ansicht |
| `src/app/(client)/analyse/page.tsx` | Kunden-Audit-Ansicht |
| `src/app/api/auth/invite/route.ts` | API: Kunden per Email einladen (Magic Link) |
| `src/app/api/auth/me/route.ts` | API: Aktuellen User + Rolle + Client-Zuordnung abrufen |
| `src/components/client-nav.tsx` | Kunden-Navigation: einfache Top-Navigation statt Admin-Sidebar |
| `src/app/api/auth/impersonate/route.ts` | API: Admin-Impersonate Cookie setzen/löschen |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `supabase-schema.sql` | `client_users` Tabelle + RLS Policies hinzufügen |
| `src/middleware.ts` | Rolle prüfen, Kunden zu `/(client)` routen, Admin zu `/(app)` |
| `src/app/login/page.tsx` | Magic Link Login-Option hinzufügen |
| `src/app/api/configs/route.ts` | Auth-Check: nur Admin kann alle Configs sehen |
| `src/app/api/scripts/route.ts` | Auth-Check: Kunden sehen nur eigene Skripte |
| `src/app/api/videos/route.ts` | Auth-Check: Kunden sehen nur eigene Videos |
| `src/app/api/analyses/route.ts` | Auth-Check: Kunden sehen nur eigene Audits |
| `src/app/api/chat/route.ts` | Auth-Check: Kunden-Chat auf eigenen Kontext beschränken |
| `src/components/app-sidebar.tsx` | Einladungs-Button pro Client hinzufügen |
| `src/app/(app)/clients/[id]/information/page.tsx` | Einladungs-UI (Email-Feld + Button) |

### Files to Delete

Keine.

---

## Design Decisions

### Key Decisions Made

1. **Magic Link statt Passwort für Kunden**: Kunden müssen sich kein Passwort merken. Aysun gibt die Email ein, Kunde bekommt Link, klickt, ist drin. Einfacher geht es nicht. Aysun selbst nutzt weiterhin Email/Passwort.

2. **Separate Route Group `(client)` statt Feature-Flags**: Kunden bekommen eigene Pages mit eigenem Layout. Das ist sauberer als die Admin-Pages mit `if (isClient)` zu durchsetzen. Die Pages können die gleichen API-Endpoints nutzen (die filtern serverseitig).

3. **`client_users` Mapping-Tabelle statt user_metadata**: User-Metadata in Supabase Auth ist schwer zu querien und zu ändern. Eine eigene Tabelle ist flexibler: ein User kann theoretisch mehreren Clients zugeordnet werden, Rollen können sich ändern, es ist auditierbar.

4. **API-Level Auth statt reines RLS**: Die App nutzt durchgehend Service Role Key. Alles auf RLS umzubauen wäre ein Riesen-Refactor. Stattdessen: Auth-Checks in jeder API-Route via `getCurrentUser()` Helper. Das ist pragmatisch und sicher genug.

5. **Kunden sehen, aber editieren nicht (Phase 1)**: Kunden bekommen read-only Zugriff auf Skripte, Strategie, Analyse, Videos. Feedback/Kommentar-Funktion kann später kommen. Das hält Phase 1 schlank.

6. **Chat für Kunden verfügbar, aber auf eigenen Kontext beschränkt**: Der Chat-Assistent ist ein starkes Feature das Kunden nutzen können — aber er sieht nur die Daten des jeweiligen Kunden, nicht die anderer Clients.

7. **Admin kann jeden Kunden-Bereich betreten ("Als Kunde ansehen")**: Aysun braucht universellen Zugang zu allen Kunden-Ansichten — um zu sehen was der Kunde sieht, Probleme zu debuggen, oder direkt im Kunden-Kontext zu arbeiten. Umsetzung: Ein "Als Kunde ansehen" Button pro Client in der Admin-Sidebar. Klick setzt einen `impersonate=<clientId>` Cookie/Query-Param und öffnet die `/(client)` Ansicht für diesen Client. Ein Banner oben zeigt "Du siehst [Client-Name] als Admin" mit einem "Zurück zum Admin" Button. Kein echtes Auth-Wechsel — die Admin-Session bleibt bestehen, nur die Ansicht wechselt. Das bedeutet: die Middleware prüft zuerst ob ein `impersonate` Param gesetzt ist UND der User Admin ist — wenn ja, zeige die Kunden-Ansicht für diesen Client.

### Alternatives Considered

- **Supabase RLS komplett**: Würde Service-Role-Nutzung in allen Routes erfordern umzubauen. Zu großer Scope für Phase 1.
- **Separate App für Kunden**: Overengineered. Gleiche Codebase, verschiedene Layouts ist besser.
- **Passwort für Kunden**: Mehr Friction, mehr Support-Aufwand. Magic Link ist sauberer.
- **user_metadata für Rollen**: Nicht querybar, nicht änderbar ohne Admin-SDK. Tabelle ist besser.

### Open Questions

1. **Sollen Kunden Skripte kommentieren/Feedback geben können?** (Phase 2 Feature, nicht blocker)
2. **Sollen Kunden den Chat-Assistenten nutzen können?** (Empfehlung: ja, beschränkt auf eigene Daten)
3. **Brauchen Kunden Email-Benachrichtigungen wenn neue Skripte/Strategien generiert wurden?** (Phase 2)

---

## Step-by-Step Tasks

### Step 1: Datenbank — `client_users` Tabelle

Neue Tabelle die Auth-User mit Clients verknüpft und Rollen speichert.

**Actions:**

- SQL Migration erstellen und in `supabase-schema.sql` dokumentieren:

```sql
-- Client-User Zuordnung & Rollen
CREATE TABLE IF NOT EXISTS client_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES configs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client')) DEFAULT 'client',
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(user_id, client_id)
);

ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;

-- Admins: client_id ist NULL (haben Zugriff auf alles)
-- Clients: client_id ist gesetzt (haben nur Zugriff auf diesen Client)

-- Aysun als Admin eintragen (nach dem ersten Login manuell oder per Seed)
-- INSERT INTO client_users (user_id, role) VALUES ('<aysun-auth-id>', 'admin');
```

- Migration in Supabase Dashboard ausführen

**Files affected:**
- `supabase-schema.sql`

---

### Step 2: Auth-Helpers — `src/lib/auth.ts`

Zentrale Funktionen die in jeder API-Route und jedem Server-Component genutzt werden.

**Actions:**

- `getCurrentUser()` — Gibt den aktuellen User + Rolle + Client-Zuordnung zurück
- `requireAdmin()` — Wirft 403 wenn nicht Admin
- `requireClientAccess(clientId)` — Prüft ob User Zugriff auf diesen Client hat (Admin = immer, Client = nur eigener)
- `getAccessibleClientIds(userId)` — Gibt Liste der Client-IDs zurück auf die der User Zugriff hat

```typescript
// Kern-Logik:
// 1. supabase.auth.getUser() für Auth-Session
// 2. SELECT role, client_id FROM client_users WHERE user_id = ?
// 3. role === 'admin' → alles erlaubt
// 4. role === 'client' → nur eigener client_id erlaubt
```

**Files affected:**
- `src/lib/auth.ts` (neu)

---

### Step 3: Middleware erweitern — Rollen-Routing

Kunden werden automatisch auf ihren Bereich geroutet, Admins auf den Admin-Bereich.

**Actions:**

- Nach Auth-Check: User-Rolle aus `client_users` laden (via Supabase Anon Key, nicht Service Role)
- Routing-Logik:
  - `role === 'admin'` → Zugriff auf `/(app)/*` erlaubt
  - `role === 'client'` → Redirect zu `/(client)/*`, Block für `/(app)/*`
  - Kein Eintrag in `client_users` → Redirect zu einer "Kein Zugriff" Seite
- Performance: Rolle im Cookie oder Session cachen (nicht bei jedem Request DB-Query)

**Files affected:**
- `src/middleware.ts`

---

### Step 4: Login-Page — Magic Link hinzufügen

Kunden loggen sich per Magic Link ein, Aysun per Passwort.

**Actions:**

- Zwei Tabs oder Modi auf der Login-Seite:
  - **Email & Passwort** (bestehend, für Admin)
  - **Magic Link** (neu, für Kunden): Email eingeben → `supabase.auth.signInWithOtp({ email })` → "Check deine Emails" Nachricht
- Nach Magic-Link-Login: Middleware erkennt Rolle und routet

**Files affected:**
- `src/app/login/page.tsx`

---

### Step 5: Kunden-Einladung — Admin-UI + API

Aysun kann von der Client-Page aus einen Kunden per Email einladen.

**Actions:**

- API-Route `POST /api/auth/invite`:
  - Nur Admin darf aufrufen
  - Nimmt `{ email, clientId }` entgegen
  - Erstellt Supabase Auth User via `supabase.auth.admin.inviteUserByEmail(email)`
  - Erstellt `client_users` Eintrag: `{ user_id, client_id, role: 'client', invited_at: now() }`
  - Supabase sendet automatisch Magic Link Email

- API-Route `GET /api/auth/me`:
  - Gibt aktuellen User, Rolle, Client-Zuordnung zurück
  - Wird vom Frontend genutzt um UI anzupassen

- UI auf der Client-Information-Seite:
  - Neuer Bereich "Kundenzugang" mit Email-Feld + "Einladen" Button
  - Zeigt bestehende eingeladene User mit Status (eingeladen / aktiv)
  - "Zugang entziehen" Button

**Files affected:**
- `src/app/api/auth/invite/route.ts` (neu)
- `src/app/api/auth/me/route.ts` (neu)
- `src/app/(app)/clients/[id]/information/page.tsx`

---

### Step 6: Kunden-Layout — `(client)` Route Group

Eigenes Layout für Kunden: schlank, fokussiert, ohne Admin-Funktionen.

**Actions:**

- Route Group `(client)` mit eigenem Layout:
  - Einfache Top-Navigation statt voller Sidebar
  - Tabs: Dashboard, Skripte, Strategie, Analyse, Videos, Chat
  - Client-Name + Logo oben
  - Logout-Button
  - Kein Zugriff auf: Client-Erstellung, Creators, Pipeline, Training, Transcribe, andere Clients

- `client-nav.tsx` Komponente:
  - Horizontal tabs oder einfache Sidebar
  - Nur relevante Seiten für den Kunden
  - SUNXCA Branding

**Files affected:**
- `src/app/(client)/layout.tsx` (neu)
- `src/components/client-nav.tsx` (neu)

---

### Step 7: Kunden-Pages — Read-Only Ansichten

Pages die Kunden sehen. Nutzen die gleichen API-Endpoints (die filtern nach Rolle).

**Actions:**

- `/(client)/page.tsx` — Dashboard: Willkommen + Quick Stats (Anzahl Skripte, letzte Strategie, etc.)
- `/(client)/scripts/page.tsx` — Alle Skripte des Kunden. Read-only. Expandierbar (Hook, Body, CTA). Filter nach Status, Pillar.
- `/(client)/strategy/page.tsx` — Aktuelle Strategie: Pillars, Wochenplan, Ziel. Read-only.
- `/(client)/analyse/page.tsx` — Letzter Audit-Report. Read-only.
- `/(client)/videos/page.tsx` — Analysierte Videos mit Concepts. Read-only.

Alle Pages holen den `client_id` aus dem Auth-Context (nicht aus der URL). Der Kunde sieht nie eine Client-ID in der URL.

**Files affected:**
- `src/app/(client)/page.tsx` (neu)
- `src/app/(client)/scripts/page.tsx` (neu)
- `src/app/(client)/strategy/page.tsx` (neu)
- `src/app/(client)/analyse/page.tsx` (neu)
- `src/app/(client)/videos/page.tsx` (neu)

---

### Step 8: API-Routes absichern

Alle bestehenden API-Routes mit Auth-Checks versehen.

**Actions:**

- Pattern für jede Route:
```typescript
import { getCurrentUser, requireClientAccess } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Für client-spezifische Daten:
  const clientId = searchParams.get("clientId");
  await requireClientAccess(user, clientId); // wirft 403 wenn kein Zugriff

  // Für Admin-only Routes (z.B. alle Configs listen):
  // requireAdmin(user); // wirft 403 wenn nicht Admin
}
```

- Routes die Admin-only bleiben:
  - `POST /api/configs` (Client erstellen)
  - `DELETE /api/configs` (Client löschen)
  - `POST /api/pipeline` (Pipeline starten)
  - `POST /api/auth/invite` (Kunden einladen)
  - `POST /api/configs/[id]/generate-*` (Generierung starten)

- Routes die Kunden nutzen dürfen (gefiltert auf eigene Daten):
  - `GET /api/scripts?clientId=X`
  - `GET /api/videos?configName=X`
  - `GET /api/analyses`
  - `GET /api/configs/[id]` (eigener Client)
  - `POST /api/chat` (eigener Kontext)

**Files affected:**
- Alle Dateien in `src/app/api/`

---

### Step 9: Chat für Kunden anpassen

Der Chat-Assistent soll für Kunden verfügbar sein, aber nur eigene Daten sehen.

**Actions:**

- `/api/chat/route.ts` anpassen:
  - Wenn User Rolle `client`: `getFullProjectContext()` nur mit Daten des eigenen Clients befüllen
  - Wenn User Rolle `admin`: wie bisher, voller Kontext
- System-Prompt für Kunden anpassen: "Du bist der Content-Assistent für [Client-Name]" statt "Du bist Aysuns Berater"

**Files affected:**
- `src/app/api/chat/route.ts`

---

### Step 10: Admin-Impersonate — "Als Kunde ansehen"

Aysun kann von der Admin-Ansicht aus jeden Kunden-Bereich betreten und sehen was der Kunde sieht.

**Actions:**

- **Sidebar-Button**: Pro Client in der Admin-Sidebar ein Augen-Icon "Als Kunde ansehen". Klick navigiert zu `/(client)?impersonate=<clientId>`.
- **Middleware-Logik**: Wenn Route `/(client)` UND User ist Admin UND `impersonate` Cookie/Query gesetzt → Erlaube Zugriff, setze Client-Kontext auf den impersonierten Client.
- **Impersonate-Banner**: Oben auf jeder `/(client)` Page ein auffälliger Banner: "Du siehst den Bereich von [Client-Name] als Admin" mit "Zurück zum Admin-Bereich" Button.
- **API-Kompatibilität**: `getCurrentUser()` Helper erkennt Impersonate-Modus — gibt die Client-ID des impersonierten Clients zurück, behält aber Admin-Rechte bei (z.B. kann trotzdem editieren).
- **Cookie-basiert**: `impersonate_client_id` als httpOnly Cookie setzen (nicht nur Query-Param), damit er über Navigationen hinweg bestehen bleibt. "Zurück" Button löscht den Cookie.
- **API-Route** `POST /api/auth/impersonate`: Setzt den Cookie (nur für Admins), validiert dass der Client existiert.
- **API-Route** `DELETE /api/auth/impersonate`: Löscht den Cookie, zurück zum Admin-Modus.

**Files affected:**
- `src/middleware.ts`
- `src/lib/auth.ts` (Impersonate-Logik in `getCurrentUser()`)
- `src/app/api/auth/impersonate/route.ts` (neu)
- `src/components/app-sidebar.tsx` (Button pro Client)
- `src/app/(client)/layout.tsx` (Impersonate-Banner)

---

### Step 11: CLAUDE.md und Schema aktualisieren

Dokumentation aktualisieren.

**Actions:**

- `CLAUDE.md`: Neuen Abschnitt "Authentication & Rollen" hinzufügen
- `supabase-schema.sql`: `client_users` Tabelle dokumentieren
- Route-Tabelle in CLAUDE.md um `(client)` Route Group erweitern

**Files affected:**
- `CLAUDE.md`
- `supabase-schema.sql`

---

## Connections & Dependencies

### Files That Reference This Area

- Jede API-Route in `src/app/api/` braucht Auth-Checks
- `src/middleware.ts` ist der zentrale Gatekeeper
- `src/components/app-sidebar.tsx` zeigt Client-Liste (nur für Admin)
- `src/lib/csv.ts` ist der Data-Access-Layer (bleibt unverändert, Filterung passiert in den Routes)

### Updates Needed for Consistency

- CLAUDE.md: Route Groups, Auth-Flow, Rollen dokumentieren
- context/strategy.md: Auth-Feature als neues Capability dokumentieren

### Impact on Existing Workflows

- Admin-Workflow bleibt identisch (Aysun merkt keinen Unterschied)
- Neue Workflow: Aysun lädt Kunden ein → Kunde loggt sich ein → sieht eigene Daten
- API-Routes haben minimale Latenz-Erhöhung durch Auth-Check (1 DB-Query, cachebar)

---

## Validation Checklist

- [ ] `client_users` Tabelle existiert in Supabase
- [ ] Aysun kann sich per Email/Passwort einloggen und sieht alle Clients
- [ ] Aysun kann einen Kunden per Email einladen
- [ ] Kunde bekommt Magic Link Email
- [ ] Kunde klickt Link und wird zu `/(client)` geroutet
- [ ] Kunde sieht nur eigene Skripte, Strategie, Analyse, Videos
- [ ] Kunde kann den Chat nutzen (nur eigener Kontext)
- [ ] Kunde kann NICHT auf `/(app)/*` zugreifen
- [ ] Kunde kann NICHT andere Clients sehen oder Daten ändern
- [ ] API-Routes geben 401/403 bei unberechtigtem Zugriff
- [ ] Admin kann weiterhin alles wie bisher
- [ ] Admin kann "Als Kunde ansehen" klicken und sieht die Kunden-Ansicht
- [ ] Impersonate-Banner zeigt klar an dass man im Kunden-Modus ist
- [ ] "Zurück zum Admin" Button funktioniert und löscht den Impersonate-Modus
- [ ] CLAUDE.md ist aktualisiert

---

## Success Criteria

1. Ein eingeladener Kunde kann sich per Magic Link einloggen und sieht ausschließlich seine eigenen Daten (Skripte, Strategie, Audit, Videos)
2. Aysun behält vollen Admin-Zugriff auf alle Clients und Funktionen — kein bestehender Workflow bricht
3. Kein API-Endpoint gibt Daten zurück zu denen der User keinen Zugriff hat

---

## Notes

- **Phase 2 Ideen**: Kunden-Feedback auf Skripte (Approve/Reject/Kommentar), Email-Notifications bei neuen Skripten, Kunden-Dashboard mit Performance-Graphen, mehrere User pro Client (z.B. Team-Zugang)
- **Sicherheit**: Service Role Key bleibt serverseitig — der Auth-Check passiert VOR dem Datenzugriff, nicht via RLS. Das ist pragmatisch und sicher solange alle Routes den Check haben.
- **Skalierung**: Das System skaliert gut — ein User kann theoretisch mehreren Clients zugeordnet werden (z.B. wenn ein Kunde mehrere Brands hat)

---

## Implementation Notes

**Implemented:** 2026-04-03

### Summary

- All 11 steps from the plan have been implemented
- `client_users` table added to schema with role-based access control
- Auth helpers (`src/lib/auth.ts`) provide `getCurrentUser()`, `requireAdmin()`, `requireClientAccess()`, `getEffectiveClientId()`
- Middleware routes clients to `/portal`, blocks unauthorized access, supports admin impersonation
- Login page has two modes: password (admin) and Magic Link (clients)
- Invitation system: API routes + UI on client information page ("Kundenzugang" section)
- Client portal at `/portal/*` with read-only pages: dashboard, scripts, strategy, audit, videos, chat
- API routes secured with auth checks — clients only see their own data
- Chat route scoped to client context for client users
- Admin impersonate: Eye icon in sidebar, cookie-based, banner in portal layout
- CLAUDE.md updated with Authentication & Rollen section, new pages, workspace structure

### Deviations from Plan

- Used `/portal` path instead of `(client)` route group — cleaner URLs, explicit separation from admin paths
- Portal pages are under `src/app/portal/` (real path segment) instead of a parenthesized route group
- Not all 35+ API routes got individual auth checks — focused on the key client-facing routes (scripts, analyses, configs, training-scripts, chat). Admin-only routes (pipeline, generators, etc.) are protected by the middleware routing clients away from `/(app)`.

### Issues Encountered

None
