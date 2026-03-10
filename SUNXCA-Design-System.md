# SUNXCA Design System

Dieses Dokument beschreibt das komplette Design System der SUNXCA Website. Nutze es als Referenz, um andere Projekte im gleichen Stil zu gestalten.

---

## Farbpalette

### Primärfarben
| Name | HEX | Verwendung |
|------|-----|------------|
| **Ocean** | `#202345` | Haupttextfarbe, Buttons, dunkle Hintergründe |
| **Ocean Light** | `#2a2d55` | Button Hover-States |
| **Ivory (Red)** | `#D42E35` | Akzentfarbe für wichtige Wörter in Überschriften, Labels unter Case Study Bildern |

### Sekundärfarben
| Name | HEX | Verwendung |
|------|-----|------------|
| **Blush** | `#F2C8D2` | Rosa Akzente, Badges, Highlight-Hintergründe, Text-Selection |
| **Blush Light** | `#f9e4e9` | Hover-States auf hellem Hintergrund |
| **Blush Dark** | `#e0a3b1` | Section-Labels (z.B. "Services", "Echte Ergebnisse") |

### Hintergrundfarben
| Name | HEX | Verwendung |
|------|-----|------------|
| **White** | `#FFFFFF` | Standard-Hintergrund |
| **Warm White** | `#FAF8F5` | Hero-Hintergrund, leicht warmes Weiß |
| **Cream** | `#FDFBF7` | Alternative Sektionshintergründe (Results, Contact) |

### Akzentfarben
| Name | HEX | Verwendung |
|------|-----|------------|
| **Bee** | `#FFFAC7` | Dekorative Akzente (gelb) |
| **Wind** | `#91D6F8` | Dekorative Gradient-Orbs (hellblau) |
| **Dark Red** | `#170103` | Reserviert |
| **Light Red** | `#530012` | Reserviert |

---

## Typografie

### Schriftart
- **Primär**: `Geist` (Google Font) — clean, modern, geometrisch
- **Fallback**: Arial, Helvetica, sans-serif
- **Mono**: `Geist Mono` (für Code, falls benötigt)

### Schriftgewichte
| Gewicht | Tailwind-Klasse | Verwendung |
|---------|----------------|------------|
| **Extra Light** | `font-extralight` | Dekorative Nummern (z.B. "01", "02") |
| **Light (300)** | `font-light` | Überschriften, Fließtext, Beschreibungen — Hauptgewicht |
| **Normal (400)** | `font-normal` | Standard |
| **Medium (500)** | `font-medium` | Buttons, Labels, Navigation, Highlights |

### Schriftgrößen (Überschriften)
| Element | Mobile | Desktop | Klasse |
|---------|--------|---------|--------|
| **H1 (Hero)** | 36px (`text-4xl`) | 72px (`text-7xl`) | `text-4xl sm:text-5xl md:text-6xl lg:text-7xl` |
| **H2 (Sections)** | 30px (`text-3xl`) | 48px (`text-5xl`) | `text-3xl md:text-4xl lg:text-5xl` |
| **H3 (Cards)** | 24px (`text-2xl`) | 30px (`text-3xl`) | `text-2xl md:text-3xl` |
| **Body** | 18px (`text-lg`) | 20px (`text-xl`) | `text-lg md:text-xl` |
| **Small/Labels** | 14px (`text-sm`) | 14px (`text-sm`) | `text-sm` |

### Text-Stilregeln
- Überschriften sind immer `font-light` mit `tracking-tight`
- Fließtext ist `font-light` mit reduzierter Opacity: `text-ocean/50` oder `text-ocean/60`
- Section-Labels: `text-sm tracking-[0.2em] uppercase text-blush-dark font-medium`
- Trust Indicators: `text-sm tracking-widest uppercase text-ocean/30`

---

## Abstände & Layout

### Sektionen
- Vertikaler Padding: `py-28 md:py-36` (112px / 144px)
- Max-Breite Container: `max-w-7xl` (1280px)
- Horizontaler Padding: `px-6 lg:px-8`

### Cards
- Padding: `p-8 md:p-10`
- Border-Radius: `rounded-2xl` (16px)
- Border: `border border-ocean/5`
- Hover: `hover:border-blush/40 hover:shadow-lg hover:shadow-blush/5`

---

## Komponenten-Styles

### Buttons

**Primär (CTA)**:
```
rounded-full bg-ocean px-8 py-4 text-white font-medium tracking-wide
hover:bg-ocean-light transition-all duration-300
hover:shadow-lg hover:shadow-ocean/20
```

**Sekundär (Ghost)**:
```
rounded-full border border-ocean/15 px-8 py-4 text-ocean/70 font-medium tracking-wide
hover:border-ocean/30 hover:text-ocean transition-all duration-300
```

**Invertiert (auf dunklem Hintergrund)**:
```
rounded-full bg-white px-8 py-4 text-ocean font-medium tracking-wide
hover:bg-blush-light transition-colors duration-300
```

### Badges/Pills
```
inline-flex items-center gap-2 rounded-full border border-blush
bg-white/60 backdrop-blur-sm px-5 py-2
```

### Highlight-Tags
```
rounded-full bg-blush/10 px-4 py-1.5 text-sm text-ocean/70 font-medium
```

### Input-Felder
```
w-full rounded-xl border border-ocean/10 bg-warm-white px-5 py-3.5
text-ocean placeholder:text-ocean/25
focus:outline-none focus:border-blush transition-colors font-light
```

---

## Effekte & Dekorationen

### Gradient Orbs (Hintergrund-Dekoration)
- Blush: `w-[500px] h-[500px] rounded-full bg-blush/20 blur-[120px]`
- Wind: `w-[400px] h-[400px] rounded-full bg-wind/10 blur-[100px]`
- Positioniert mit `absolute` und `pointer-events-none`

### Text-Highlights
- **Rosa Unterstreichung** (Desktop Hero): `absolute bottom-1 left-0 w-full h-3 bg-blush/40`
- **Ivory Red Unterstreichung** (Mobile Hero): `absolute bottom-1 left-0 w-full h-3 bg-ivory/60`
- **Ivory Red Textfarbe**: `text-ivory` für einzelne wichtige Wörter in Überschriften

### Text-Selection
```css
::selection {
  background-color: #F2C8D2;
  color: #202345;
}
```

### Animationen (Framer Motion)
- **Fade-up Eingang**: `initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}`
- **Duration**: 0.6s - 0.8s, ease: "easeOut"
- **Stagger-Delay**: 0.1s - 0.15s zwischen Elementen
- **Viewport-Trigger**: `whileInView` mit `viewport={{ once: true, margin: "-100px" }}`
- **Pulse-Dot**: `animate-pulse` für Status-Indikatoren

---

## Dunkle Sektionen (z.B. Prozess)

- Hintergrund: `bg-ocean`
- Text: `text-white`
- Subtexte: `text-white/40`
- Labels: `text-blush/70`
- Dekorative Nummern: `text-white/10`
- Akzente: `bg-blush/5 blur-[150px]`

---

## Navigation

### Navbar
- Höhe: `h-20` (80px)
- Fixiert: `fixed top-0 z-50`
- Transparent → Scrolled: `bg-white/80 backdrop-blur-xl shadow-sm border-b border-blush/20`
- Logo: `text-2xl font-light tracking-[0.3em] uppercase` — "Sun**x**ca" wobei "x" in `text-ivory`
- Logo-Farbe: Weiß vor Scroll, Ocean nach Scroll

---

## Responsive Breakpoints
- Mobile: default (< 768px)
- Tablet: `md:` (768px+)
- Desktop: `lg:` (1024px+)

---

## Zusammenfassung der Design-Prinzipien
1. **Minimalistisch & elegant** — viel Weißraum, leichte Schriftgewichte
2. **Warme Tonalität** — Warm White, Cream, Blush statt kaltes Grau
3. **Dezente Akzente** — Ivory Red nur für die wichtigsten Wörter
4. **Weiche Übergänge** — Gradient Orbs, Blur-Effekte, smooth Animationen
5. **Klare Hierarchie** — Section-Labels → Überschrift → Beschreibung → CTA
6. **Runde Formen** — rounded-full Buttons, rounded-2xl Cards
