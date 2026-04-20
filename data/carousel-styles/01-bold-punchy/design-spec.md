# Style 01 — Bold Punchy

## Mood
Laut, aufmerksamkeitsstark, junge Brand-Energie. Schwere Schrift, hoher Kontrast, kein Weichspüler. Passt für: Kontroverse Meinungen, harte Facts, bold Business-Takes, Anti-Status-quo Content.

## Fonts
- **Heading:** Space Grotesk (700-800, tight tracking)
- **Body:** Inter (400-500)
- Import: `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap`

## Color Tokens

Primary brand color für dieses Style-Default = `#FF3B30` (signal red). Wenn der Client eigene Brand-Color im Config hat, override:

```css
:root {
  --brand-primary: #FF3B30;
  --brand-light:   #FF6B63;
  --brand-dark:    #CC2F26;
  --light-bg:      #FAF7F3;
  --light-border:  #E8E2DA;
  --dark-bg:       #141414;
  --text-dark:     #141414;
  --text-light:    #FAF7F3;
}
```

## Layout-Regeln

- **Slide-Größe:** 1080x1350px hart
- **Padding:** 80px links/rechts, 100px oben/unten
- **Header-Bar:** oben mittig, Handle in Mono-Caps, fontsize 18px, letter-spacing 0.15em
- **Slide-Counter:** oben rechts `02/08`, fontsize 18px, weight 500, Space Grotesk
- **Light/Dark-Rhythmus:** Slide 1 DARK (Hook), Slide 2 LIGHT (Problem), Slide 3 DARK, Slide 4-6 alternierend, Slide 7 (CTA) gradient
- **Hero-Numbers auf Value-Slides:** 240px Space Grotesk 800, BRAND_LIGHT 15% opacity, absolut positioniert, wird von der eigentlichen Headline überlagert

## Slide-Typ-Styling

### .slide-hook
- Background: `--dark-bg`
- Headline: 88px Space Grotesk 800, `--light-bg`, Zeilenhöhe 1.0
- Ein einzelner Akzent-Balken in `--brand-primary` unter oder über der Headline (8px Höhe, ~200px Breite)
- Optional: Foto als Hintergrund mit 0.4 Opacity + dark overlay

### .slide-problem / .slide-value
- Background: alternierend `--light-bg` oder `--dark-bg`
- Heading-Kategorie-Label oben: 16px Mono-Caps in `--brand-primary`
- Headline: 56-64px Space Grotesk 700
- Body: 22px Inter 400, Zeilenhöhe 1.45
- Optional: Foto rechts oder links, 50% der Slide

### .slide-proof
- Background: `--light-bg`
- Großes Zitat oder Case-Number als Hero-Element
- Foto klein unten rechts als Proof

### .slide-recap
- Background: `--dark-bg`
- Numbered Bullet-List, jedes Item in eigenem Satz-Block
- Hero-Numbers 120px in `--brand-primary`

### .slide-cta
- Background: Brand-Gradient 165deg
- Headline 72px, `--light-bg`
- Button-Optik: white pill, `--brand-dark` text, 24px padding y / 48px padding x
- Footer-Handle

## Wichtig

- **Nie Tailwind-Klassen** — pures inline CSS oder Style-Tag
- **Fonts immer via Google Fonts importieren** am Anfang des `<head>`
- **Images:** `object-fit: cover` + optional `filter: grayscale(20%)` für konsistente Ästhetik
- **Shadows** nie — diesem Style tun harte Kanten gut
