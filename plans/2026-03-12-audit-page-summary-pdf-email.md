# Plan: Audit Landing Page — Summary on Page + Detailed PDF per Email

**Created:** 2026-03-12
**Status:** Implemented
**Request:** Restructure /audit so the page shows a beautiful, concise summary (fix ugly text rendering), while the detailed analysis gets generated as PDF and emailed to the customer from info@sunxca.com.

---

## Overview

### What This Plan Accomplishes

Splits the audit experience into two parts: (1) a visually appealing summary with key metrics and highlights shown immediately on the landing page, and (2) a comprehensive PDF report sent to the customer's email in the background. This reduces perceived loading time (shorter summary = fewer tokens = faster response) and creates a stronger lead magnet (email delivery gives a reason to collect the email).

### Why This Matters

The current page dumps a long markdown report directly into the page, which looks unstructured and overwhelming. By showing a clean visual summary and delivering the detail via email, we improve UX, reduce bounce risk, and create a proper email touchpoint for follow-up marketing.

---

## Current State

### Relevant Existing Structure

| File | Role |
|------|------|
| `app/src/app/(landing)/audit/page.tsx` | Client component — form, SSE streaming, full report rendering |
| `app/src/app/api/audit/route.ts` | API — lead capture, Apify scraping, Claude analysis, SSE stream |
| `app/src/lib/csv.ts` | CSV utilities including `appendLead()` |
| `app/src/lib/apify.ts` | `scrapeCreatorStats()`, `scrapeReels()` |
| `data/leads.csv` | Lead storage with `reportGenerated` flag (currently always "false") |

### Gaps or Problems Being Addressed

1. **Ugly report rendering** — Raw markdown parsed line-by-line with `dangerouslySetInnerHTML`, no visual hierarchy
2. **No email sending** — Email is collected but never used
3. **No PDF generation** — Everything rendered as HTML text only
4. **Long wait time** — Full 4096-token report must complete before "done" phase
5. **`reportGenerated` flag** — Exists in leads.csv but never updated to "true"

---

## Proposed Changes

### Summary of Changes

- **New packages**: `resend` (email), `@react-pdf/renderer` (PDF generation)
- **Split Claude prompts**: Short summary prompt (page) + detailed report prompt (PDF/email)
- **Redesign page result section**: Visual score cards, icon-based highlights, structured layout instead of raw markdown
- **New API route** `/api/audit/send-report` — Background endpoint that generates full report, builds PDF, sends email
- **Email template** — Branded HTML email from info@sunxca.com with PDF attachment
- **Update leads.csv** — Set `reportGenerated: "true"` after email is sent

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `app/src/app/api/audit/send-report/route.ts` | Background API: full Claude report → PDF → email |
| `app/src/lib/pdf.ts` | PDF template using @react-pdf/renderer |
| `app/src/lib/email.ts` | Resend email client + branded HTML email template |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `app/src/app/(landing)/audit/page.tsx` | Redesign result section: visual summary cards instead of raw markdown; trigger background email after "done" |
| `app/src/app/api/audit/route.ts` | Split into summary prompt (shorter, structured JSON output) instead of full markdown report |
| `app/package.json` | Add `resend` and `@react-pdf/renderer` dependencies |
| `app/src/lib/csv.ts` | Add `updateLeadReport(id, status)` function |

### Files to Delete

None.

---

## Design Decisions

### Key Decisions Made

1. **Resend for email**: Modern API, generous free tier (100 emails/day, 3000/month), excellent DX, supports custom domains (info@sunxca.com). Alternative: SendGrid, Nodemailer — but Resend is simpler and purpose-built for transactional email from Next.js.

2. **@react-pdf/renderer for PDF**: Runs server-side in Node, produces styled PDFs from React components, no headless browser needed. Alternative: Puppeteer (too heavy), jsPDF (too basic for branded design).

3. **Two separate Claude calls (summary vs. full report)**: The page summary uses a shorter prompt that returns structured JSON (score, strengths, improvements as arrays). The full report uses the existing detailed prompt. This lets the page render fast while the email generation runs in the background.

4. **Fire-and-forget background email**: After the page shows the summary, the client calls `/api/audit/send-report` which runs async. The user sees the summary immediately and gets the email within 1-2 minutes. No need to wait.

5. **Summary as structured JSON, not markdown**: Instead of parsing markdown, the summary prompt returns JSON with `score`, `strengths[]`, `improvements[]`, `quickWins[]`. This allows rendering with proper visual components (cards, icons, progress bars) instead of raw text.

### Alternatives Considered

- **Single Claude call, split on client**: Generate full report, extract summary client-side. Rejected because it doesn't reduce loading time — still waiting for the full report.
- **Nodemailer + SMTP**: More setup, requires SMTP credentials, less reliable deliverability. Resend handles this better.
- **HTML-to-PDF (Puppeteer)**: Very heavy dependency (~400MB), slow cold starts. @react-pdf/renderer is lightweight and purpose-built.

### Open Questions

1. **Resend API key**: User needs to create a Resend account, add `RESEND_API_KEY` to `.env`, and verify `sunxca.com` domain in Resend dashboard. Without domain verification, emails can only be sent from `onboarding@resend.dev` (for testing).
2. **Calendly / Booking link**: The CTA "Termin buchen" currently links to `#`. Need the actual booking URL.

---

## Step-by-Step Tasks

### Step 1: Install Dependencies

**Actions:**
- Install `resend` and `@react-pdf/renderer` in the app directory

**Files affected:**
- `app/package.json`

---

### Step 2: Create Email Client (`app/src/lib/email.ts`)

**Actions:**
- Initialize Resend client with `RESEND_API_KEY` env var
- Create `sendAuditReport()` function that:
  - Takes: `{to, firstName, username, pdfBuffer}`
  - Sends branded HTML email from `info@sunxca.com` (fallback: `onboarding@resend.dev` for dev)
  - Subject: "Dein Instagram Strategie-Scan — @{username}"
  - Body: Branded HTML with SUNXCA colors (ocean, blush, warm-white), greeting, brief teaser text, CTA button for booking
  - Attaches PDF as `strategie-scan-{username}.pdf`

**Email HTML design:**
- Header: SUNXCA logo text
- Greeting: "Hallo {firstName},"
- Teaser: "Dein persönlicher Instagram Strategie-Scan für @{username} ist fertig."
- Brief bullet list of what's inside the PDF
- CTA button: "Termin für Strategiegespräch buchen"
- Footer: © SUNXCA, unsubscribe note

**Files affected:**
- `app/src/lib/email.ts` (new)

---

### Step 3: Create PDF Template (`app/src/lib/pdf.ts`)

**Actions:**
- Create a React PDF document component using `@react-pdf/renderer`
- Takes the full markdown report + profile data as props
- Renders a branded PDF:
  - **Page 1 — Cover**: SUNXCA branding, "Instagram Strategie-Scan", @username, date
  - **Page 2+ — Report**: Parsed sections with proper typography
    - Section headings in ocean color
    - Bullet points with blush accent
    - Stats displayed prominently
    - Professional spacing and layout
  - **Last page — CTA**: "Bereit für den nächsten Schritt?" + booking link + contact info
- Export `generateAuditPDF(report, profile)` → returns Buffer

**Files affected:**
- `app/src/lib/pdf.ts` (new)

---

### Step 4: Modify Main Audit API — Summary Mode (`app/src/app/api/audit/route.ts`)

**Actions:**
- Change the Claude prompt for the SSE response to a **summary prompt** that returns structured JSON:

```
Analysiere das Profil und gib eine kurze Zusammenfassung als JSON zurück:
{
  "score": 1-10,
  "scoreLabel": "Gut/Ausbaufähig/Stark/etc.",
  "strengths": ["Punkt 1", "Punkt 2", "Punkt 3"],
  "improvements": ["Punkt 1", "Punkt 2", "Punkt 3"],
  "quickWins": ["Tipp 1", "Tipp 2", "Tipp 3"],
  "summary": "2-3 Sätze Gesamteinschätzung"
}
```

- Keep max_tokens low (~1024) for speed
- The "done" event now sends `summary` (JSON object) instead of `report` (markdown string)
- Also include `leadId` in the done event so the client can reference it for the email trigger

**Files affected:**
- `app/src/app/api/audit/route.ts`

---

### Step 5: Create Background Email API (`app/src/app/api/audit/send-report/route.ts`)

**Actions:**
- POST endpoint accepting: `{leadId, firstName, email, username, profile, reelsData}`
- Generates the FULL detailed report via Claude (using existing `buildAuditPrompt`)
- Generates PDF from the report using `generateAuditPDF()`
- Sends email with PDF attachment using `sendAuditReport()`
- Updates leads.csv: `reportGenerated = "true"`
- Returns `{success: true}` immediately (fire-and-forget from client perspective)

**Files affected:**
- `app/src/app/api/audit/send-report/route.ts` (new)

---

### Step 6: Redesign Audit Page Result Section (`app/src/app/(landing)/audit/page.tsx`)

**Actions:**

Replace the current raw markdown report rendering with a beautiful visual summary:

**New result layout:**

1. **Profile Header Card** (keep existing but refine)
   - Avatar, @username, follower count
   - Three stat boxes (Followers, Reels 30d, Ø Views)

2. **Score Ring** — Large circular score indicator (1-10)
   - Color-coded: green (7-10), yellow (4-6), red (1-3)
   - Score label underneath (e.g., "Ausbaufähig")

3. **Summary Text** — 2-3 sentences, clean typography

4. **Three Visual Sections** side by side (or stacked on mobile):
   - **Stärken** — Green accent, checkmark icons, 3 bullet points
   - **Verbesserungspotenzial** — Orange accent, arrow icons, 3 bullet points
   - **Sofort-Tipps** — Blue accent, lightning icons, 3 bullet points

5. **Email Confirmation Banner**
   - "Die vollständige Analyse wird gerade erstellt und an {email} gesendet."
   - Subtle animation (pulse or check after sent)

6. **CTA Section** (keep existing ocean-colored block)

**State changes:**
- New interface `AuditSummary` with `score`, `scoreLabel`, `strengths[]`, `improvements[]`, `quickWins[]`, `summary`
- Parse JSON from SSE "done" event instead of markdown
- After receiving "done", fire POST to `/api/audit/send-report` in the background
- Show email confirmation after firing

**Files affected:**
- `app/src/app/(landing)/audit/page.tsx`

---

### Step 7: Update CSV Utilities (`app/src/lib/csv.ts`)

**Actions:**
- Add function `updateLeadReport(leadId: string)` that:
  - Reads leads.csv
  - Finds the row with matching id
  - Updates `reportGenerated` to `"true"`
  - Writes back

**Files affected:**
- `app/src/lib/csv.ts`

---

### Step 8: Update Environment Variables

**Actions:**
- Add `RESEND_API_KEY` to `.env`
- Document in CLAUDE.md

**Files affected:**
- `.env`
- `CLAUDE.md` (add RESEND_API_KEY to required env vars)

---

### Step 9: Test End-to-End

**Actions:**
- Test with a real Instagram handle
- Verify: form submission → progress → visual summary appears → email sent with PDF
- Check PDF renders correctly with proper branding
- Check email arrives from correct sender
- Check leads.csv updated

---

## Connections & Dependencies

### Files That Reference This Area

- `app/src/app/(landing)/layout.tsx` — Landing layout (no changes needed)
- `app/src/lib/apify.ts` — Used by audit API (no changes needed)
- `data/leads.csv` — Will be updated with reportGenerated flag

### Updates Needed for Consistency

- `CLAUDE.md` — Add RESEND_API_KEY to env vars, update audit page description
- Update workspace structure table if new lib files added

### Impact on Existing Workflows

- The `/audit` page flow changes from "wait for full report → show on page" to "wait for summary → show on page → email full report in background"
- Lead capture still works the same (CSV append on submission)
- No impact on (app) route group pages

---

## Validation Checklist

- [ ] `npm run dev` starts without errors
- [ ] `/audit` form submits and shows visual summary with score, strengths, improvements, quick wins
- [ ] Summary loads noticeably faster than before (fewer tokens)
- [ ] Email arrives at the submitted address with PDF attachment
- [ ] PDF is properly branded with all report sections
- [ ] Email is sent from info@sunxca.com (or dev fallback)
- [ ] `leads.csv` shows `reportGenerated: true` after email sent
- [ ] No TypeScript errors (`npm run build` succeeds)
- [ ] Mobile responsive — summary cards stack properly
- [ ] CLAUDE.md updated with new env var and structure

---

## Success Criteria

The implementation is complete when:

1. The /audit page shows a visually appealing summary with score ring, strengths/improvements/quick-wins cards — no raw markdown
2. A branded PDF with the full detailed analysis is emailed to the customer within ~2 minutes of submission
3. Page perceived loading time is reduced (summary prompt generates faster than full report)
4. Email is nicely designed with SUNXCA branding and sent from info@sunxca.com

---

## Notes

- **Resend domain verification**: To send from info@sunxca.com, the sunxca.com domain must be verified in Resend's dashboard (add DNS records: MX, SPF, DKIM). Until then, use `onboarding@resend.dev` for testing.
- **Free tier limits**: Resend free = 100 emails/day, 3000/month. More than sufficient for a lead magnet.
- **Future enhancement**: Could store the generated PDF URL and add a "Download PDF" button on the page too.
- **Future enhancement**: Could add a follow-up email sequence (e.g., 3 days later: "Hast du die Tipps schon umgesetzt?").
