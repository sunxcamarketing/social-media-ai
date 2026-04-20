# Style 02 — Split-Screen Contrast

## Mood
Cinematic, emotional, unmittelbar. Inspired by @kienobifilms (841k Likes auf ein einziges Format). Content ist **zwei Zustände gegenübergestellt** — Foto/Szene + harter Urteils-Badge. Kein klassisches Design-Tooling, keine überladenen Layouts. Text ist Untertitel, nicht Komposition. Passt für: Identitäts-Kontraste (Stuck Creator vs. Fast Creator), Alt/Neu-Vergleiche, Fehler/Richtig-Posts, Persona-Gegenüberstellungen, Transformation-Arc.

## Wann einsetzen
- Topic ist ein **Kontrast zwischen 2 Zuständen** (gut/schlecht, alt/neu, Anfänger/Profi)
- Post soll emotional treffen, nicht nur informieren
- Client hat authentische Fotos in 2 verschiedenen Modi/Szenen

**Nicht einsetzen für:** Listen mit 5+ Punkten, Deep-Dives, Educational Explainer — dafür nimm `01-bold-punchy` oder `03-editorial-premium`.

## Fonts
- **Heading:** Inter (600-800, tight tracking, All-Caps auf Labels)
- **Body (Untertitel-Stil):** Inter (400-500)
- Import: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap`

## Color Tokens

```css
:root {
  --brand-primary:  #22C55E;   /* GREEN — richtig/Gewinn */
  --brand-negative: #EF4444;   /* RED — falsch/Verlust */
  --brand-dark:     #0A0A0A;   /* tiefstes Schwarz für CTA / Hook */
  --light-bg:       #FAF7F3;   /* off-white für wenige Light-Slides */
  --text-dark:      #0A0A0A;
  --text-light:     #FFFFFF;
  --badge-green-bg: rgba(34,197,94,0.9);
  --badge-red-bg:   rgba(239,68,68,0.9);
  --overlay-dark:   linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.75) 100%);
}
```

## Slide-System

### Slide-Größe
1080x1350px hart. Fotos füllen **100% der Fläche** (object-fit: cover). Kein Rand, kein Padding um das Foto.

### Typografie-Regeln
- **Badge/Label** (oben): Inter Bold, 32-40px, All-Caps, letter-spacing 0.1em, in weißer Schrift auf farbigem Pill-Hintergrund (grün oder rot)
- **Body-Untertitel** (unten): Inter Medium 500, 38-48px, weiß, line-height 1.2, max. 15 Wörter, Text-Shadow `0 2px 12px rgba(0,0,0,0.8)` für Lesbarkeit
- **Headline auf Hook/CTA-Slides** (ohne Foto-BG): Inter Bold 800, 80-96px

### Layout-Typen

#### .slide-hook (Slide 01)
- Background: `--brand-dark` oder Foto + Overlay (starker Gradient nach unten)
- Große Headline in Weiß, Zahl-basiert (z.B. "500 / 500k")
- Keine Badges — Hook steht allein

#### .slide-split (Slide 02 bis N-1 — das Kern-Format)
Zwei Layouts erlaubt:

**A) Vertikaler Split (50/50 horizontal geteilt)**
```
┌─────────────────┐
│  [FOTO Zustand A]│
│  [GRÜNER BADGE] │
│  Untertitel A   │
├─────────────────┤  ← harte Trennlinie
│  [FOTO Zustand B]│
│  [ROTER BADGE]  │
│  Untertitel B   │
└─────────────────┘
```
Foto A oben (675px Höhe), Foto B unten (675px Höhe). Jede Hälfte: Badge links-oben, Untertitel links-unten.

**B) Single-Foto mit Badge (eine Seite der Geschichte pro Slide)**
```
┌─────────────────┐
│  [FOTO füllt    │
│   alles]        │
│                 │
│  [BADGE]        │
│  Untertitel     │
└─────────────────┘
```
Nützlich wenn pro Slide nur **ein Zustand** gezeigt wird und die Kontrast-Logik über Slide-Reihenfolge läuft (z.B. Slide 2 = grün/Richtig, Slide 3 = rot/Falsch).

#### .slide-payoff
Pure Text auf `--brand-dark` — die philosophische Core-Aussage, max. 2 Sätze, 56px Inter Bold.

#### .slide-cta
Background: `--brand-dark` oder Foto + schwarzem Overlay. Headline in Grün-Akzent auf **1 Wort**. CTA ist thematische Brücke zum Hook (nicht "Folge für mehr").

## Design-Prinzipien (Playbook-Implementation)

- **Regel 1 (Hook=Zahl+Bild):** Hook-Slide braucht Zahl + identitätsstarkes Foto oder kontrastreiche Szene
- **Regel 2 (Template-Reinheit):** Slide 02 bis N-1 nutzen **nur** die Split-Layout-Varianten — kein Wechsel in Listen oder Hero-Number
- **Regel 3 (Farbsemantik):** Grün = Richtig/Gewinn, Rot = Falsch/Verlust — konsistent ab Slide 2
- **Regel 5 (Pattern-Break letzter Slide):** CTA-Slide ist IMMER ohne Split — entweder pure Text auf Dark oder Foto mit schwarzem Overlay
- **Regel 7 (Split für Kontraste):** Wenn Topic ein Gut/Schlecht-Post ist → Layout A, wenn Parallel-Narrative → Layout B
- **Regel 10 (Grid-Textur):** Auf Text-only Slides: subtiles Dot-Grid 5% Opazität als CSS-Background
- **Regel 11 (Takeaway-Satz als Hero):** Hero-Line ist der vollständige Satz — nicht die Zahl. Siehe Hierarchie-Spec unten.
- **Regel 12 (Accent auf 1 Phrase):** Pain-Phrase rot unterstrichen, Value-Phrase grün markiert. Nie beide, max. 3-5 Wörter.
- **Regel 15 (Divider-Chip zentriert):** Faktor-Chip (z.B. "10× MEHR") sitzt exakt auf der 50%-Linie mit Dark-Ring + Glow.
- **Regel 16 (Asymmetrisches Gewicht):** Bad-Hero bei 72% Opazität, Good-Hero volles Weiß + Accent.

---

## Typografie-Hierarchie (konkrete Pixel-Werte)

Jede Content-Slide hat 4 Ebenen in dieser exakten Reihenfolge und Größe:

### Ebene 1: Badge (Marker)
```css
font-family: 'JetBrains Mono', monospace;
font-size: 15px;
font-weight: 700;
letter-spacing: 0.2em;
text-transform: uppercase;
padding: 9px 18px;
border-radius: 999px;
border: 1px solid (rgba Akzent 0.35);
```
Inhalt: "OHNE AI" / "MIT AI" / "SCHRITT 3" / etc. Mit kleinem Dot-Indikator (8px, Glow).

### Ebene 2: Hero-Line (der Satz)
```css
font-family: 'Inter', sans-serif;
font-weight: 700;
font-size: 62px;
line-height: 1.1;
letter-spacing: -0.025em;
margin-bottom: 32px;
```
- **Bad-Hälfte:** `color: rgba(255,255,255,0.72)` (gedimmt)
- **Good-Hälfte:** `color: #FFFFFF` (volles Weiß)
- Innerhalb des Satzes: genau EINE Phrase mit Accent-Highlight (siehe Accent-Spec)

### Ebene 3: Support-Line (Mono-Footer)
```css
font-family: 'JetBrains Mono', monospace;
font-size: 17px;
font-weight: 500;
letter-spacing: 0.12em;
text-transform: uppercase;
color: rgba(255,255,255,0.55);
margin-top: 24px;
```
Format: `ALTER WORKFLOW · 3 IDEEN PRO WOCHE` — Elemente durch ` · ` getrennt.

### Ebene 4: Tool-Pills (nur Good-Hälfte)
```css
display: inline-flex; gap: 10px;
padding: 10px 18px;
background: rgba(255,255,255,0.07);
border: 1px solid rgba(255,255,255,0.2);
border-radius: 999px;
font-size: 18px; font-weight: 600;
```
Mit Logo (22px, `https://cdn.simpleicons.org/SLUG/FFFFFF`) + Name.

---

## Accent-Highlight-Spec

### Pain-Phrase (Bad-Hälfte)
```css
.accent-bad {
  color: #FCA5A5;
  text-decoration: underline;
  text-decoration-color: rgba(239,68,68,0.7);
  text-decoration-thickness: 4px;
  text-underline-offset: 6px;
}
```

### Value-Phrase (Good-Hälfte)
```css
.accent-good {
  color: #86EFAC;
  background: linear-gradient(180deg, transparent 65%, rgba(34,197,94,0.35) 65%);
  padding: 0 4px;
}
```
Der Gradient simuliert einen Marker-Strich auf den unteren 35% der Zeile.

---

## Divider-Chip-Spec

Bei Split-Screen-Slides sitzt der Faktor-Chip (z.B. "10× MEHR OUTPUT") auf der 50%-Linie:

```css
.factor-chip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(135deg, #4ADE80 0%, #16A34A 100%);
  color: #0A0A0A;
  font-weight: 900;
  font-size: 24px;
  padding: 18px 36px;
  border-radius: 999px;
  letter-spacing: -0.01em;
  z-index: 6;
  white-space: nowrap;
  box-shadow:
    0 10px 40px rgba(34,197,94,0.55),
    0 0 0 6px rgba(10,10,10,1),
    0 0 0 7px rgba(34,197,94,0.3);
}
```

Der triple-layered `box-shadow` (Glow + Dark-Ring + Accent-Ring) lässt den Chip visuell auf der Linie "sitzen" ohne die Halves zu brechen.

---

## Header-Bar (entrümpelt)

Nur 2 Elemente — links @handle, rechts Seitenzahl. KEIN Topic-Tag in der Mitte.

```css
.header-bar {
  position: absolute;
  top: 28px; left: 40px; right: 40px;
  display: flex;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.7;
}
```

## Foto-Auswahl (wichtig bei diesem Style)

Du brauchst pro Slide **emotional ausdrucksstarke Fotos**. Kriterien:
- Person im Foto erkennbar (nicht anonym)
- Klare Emotion oder Szene (kein generisches Product-Shot)
- Hoher Kontrast zum Partner-Foto auf derselben Slide
- Landscape oder Portrait-Crop beides ok (wird zu 50% Slide gecropt)

## Wichtig

- **KEIN Grid-Textur auf Foto-Slides** — Foto steht allein, Textur nur auf Text-only Slides
- **Badges IMMER halbtransparent** (rgba mit 0.9 Alpha) über dem Foto — nicht opak
- **Text-Shadow auf allen Weiß-auf-Foto-Texten** — sonst unlesbar
- **Keine Tailwind-Klassen** — inline CSS via `<style>`-Tag
- **Keine Shadows auf Buttons/Badges** — clean, harte Kanten
