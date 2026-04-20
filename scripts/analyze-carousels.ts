import "dotenv/config";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

const CREATORS = ["creatorclass.de", "roman.knox", "kienobifilms"];
const TOP_PER_CREATOR = 5;
const LOOKBACK_DAYS = 180;
const MAX_POSTS_SCRAPE = 50;

const ROOT = resolve(__dirname, "..");
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT_DIR = join(ROOT, "output", "carousel-research", TIMESTAMP);
mkdirSync(OUT_DIR, { recursive: true });

interface ApifyPost {
  type?: string;
  productType?: string;
  url: string;
  shortCode?: string;
  ownerUsername: string;
  caption?: string;
  likesCount: number;
  commentsCount: number;
  videoPlayCount?: number;
  videoUrl?: string;
  images?: string[];
  displayUrl?: string;
  childPosts?: Array<{ displayUrl?: string; images?: string[]; type?: string }>;
  timestamp: string;
}

function getToken(): string {
  const t = process.env.APIFY_API_TOKEN;
  if (!t) throw new Error("APIFY_API_TOKEN missing");
  return t;
}

async function scrapePosts(username: string): Promise<ApifyPost[]> {
  const token = getToken();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400 * 1000).toISOString().slice(0, 10);
  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsType: "posts",
        resultsLimit: MAX_POSTS_SCRAPE,
        onlyPostsNewerThan: since,
        addParentData: false,
      }),
      signal: AbortSignal.timeout(180000),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify ${res.status} for @${username}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as ApifyPost[];
}

function isCarousel(p: ApifyPost): boolean {
  if (p.type === "Sidecar") return true;
  if ((p.childPosts?.length ?? 0) > 1) return true;
  if (!p.videoUrl && (p.images?.length ?? 0) > 1) return true;
  return false;
}

function collectSlideUrls(p: ApifyPost): string[] {
  const urls: string[] = [];
  if (p.childPosts?.length) {
    for (const c of p.childPosts) {
      if (c.displayUrl) urls.push(c.displayUrl);
      else if (c.images?.[0]) urls.push(c.images[0]);
    }
  }
  if (urls.length === 0 && p.images?.length) urls.push(...p.images);
  if (urls.length === 0 && p.displayUrl) urls.push(p.displayUrl);
  return urls;
}

async function downloadSlide(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`slide fetch ${res.status}`);
  const ab = await res.arrayBuffer();
  const resized = await sharp(Buffer.from(ab))
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return resized.toString("base64");
}

const SYSTEM_PROMPT = `Du bist ein Experte für Instagram-Karussell-Design-Analyse. Deine Aufgabe: analysiere den Karussell-Post systematisch anhand aller Slides die du siehst. Antworte strukturiert auf Deutsch.

## Was du analysieren sollst

### 1. CONTENT-ARC (Storytelling-Struktur)
- Welchen narrativen Bogen zeichnet der Post? (Hook → Problem → Value → CTA? Oder anders?)
- Wie viele Slides und was ist die Funktion jeder Slide? (Slide 1 = Hook, Slide 2 = ..., etc.)
- Wo liegt der Payoff / die Kern-Message?
- Wie wird Spannung aufgebaut und aufgelöst?

### 2. HOOK-SLIDE
- Text 1:1 (abschreiben)
- Welcher psychologische Trigger? (Kontrast, Neugier, Provokation, Zahl, Pattern-Break, etc.)
- Visuelle Mechanik: Was macht dass man swipet? (Cliffhanger, offene Frage, Listen-Intro, Schock-Zahl, etc.)

### 3. TEXT-ELEMENTE — Schriftgröße & Hierarchie pro Slide
- Headline-Font-Größe relativ zur Slide-Fläche (klein / medium / riesig / dominant)
- Gibt es Hierarchie? (Headline → Subline → Body → Meta/Nummerierung)
- Ist Text kurz oder lang? Wie viele Wörter pro Slide im Schnitt?
- Wird Text als Design-Element genutzt (z.B. riesige Zahlen, typografie-dominante Layouts)?

### 4. ELEMENT-ANORDNUNG / LAYOUT
- Wo sitzt Headline? (oben, mittig, unten, asymmetrisch)
- Gibt es Raster / Grid-System das wiederkehrt?
- Whitespace-Nutzung (luftig vs. dicht)
- Visuelle Gewichtung (zentriert vs. links vs. split 50/50)
- Wiederkehrende Design-Elemente (Nummerierung, Badges, Icons, Pfeile)

### 5. FARBSYSTEM
- Welche Farben dominieren?
- Light/Dark-Wechsel zwischen Slides?
- Akzentfarben und wofür sie benutzt werden

### 6. SLIDE-NUMMERIERUNG & NAVIGATIONS-HINWEISE
- Werden Slides nummeriert? Wie? (01/07, 1 of 7, nur Zahl, gar nicht)
- Swipe-Cues? (Pfeile, "→", "Next")

### 7. CTA-SLIDE
- Wie endet der Post?
- Welche Handlung wird erbeten (Follow, Save, Kommentieren, Link-in-Bio)?
- Wie stark ist der CTA visuell?

### 8. TAKEAWAYS FÜR UNSERE PRODUCTION
3-5 konkrete Learnings die wir für unsere eigenen Karussells übernehmen sollten. Sei SPEZIFISCH (keine Plattitüden). Z.B. "Hero-Number als Outline-Text 60% der Slide-Höhe" nicht "große Zahlen nutzen".

## Output-Format
Markdown mit ## Überschriften pro Abschnitt. Kurz und scanbar, keine Fülltexte.`;

async function analyzeCarousel(
  anthropic: Anthropic,
  handle: string,
  url: string,
  caption: string | undefined,
  slideB64: string[]
): Promise<string> {
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text: `## POST-META\n\nCreator: @${handle}\nURL: ${url}\nSlides: ${slideB64.length}\n\nCaption:\n${caption?.slice(0, 1500) || "(keine)"}`,
    },
    { type: "text", text: `## SLIDES (in Reihenfolge)\n` },
  ];
  for (let i = 0; i < slideB64.length; i++) {
    content.push({ type: "text", text: `--- Slide ${i + 1}/${slideB64.length} ---` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: slideB64[i] },
    });
  }
  content.push({ type: "text", text: `\nJetzt die komplette Analyse nach Schema.` });

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });
  const tb = res.content.find((b) => b.type === "text");
  if (!tb || tb.type !== "text") throw new Error("No text in Claude response");
  return tb.text;
}

const META_SYNTHESIS_PROMPT = `Du bist Senior-Stratege für Instagram-Karussell-Design. Du bekommst einzelne Analysen mehrerer viraler Karussell-Posts von 3 deutschen Content-Creatorn. Deine Aufgabe: extrahiere übergreifende Muster, Gemeinsamkeiten und Unterschiede — und destilliere daraus eine konkrete PLAYBOOK für unser eigenes Karussell-System.

Struktur der Synthese:

## 1. ÜBERGREIFENDE MUSTER
Was machen ALLE drei Creator gleich? (Content-Arc, Hook-Mechaniken, Text-Länge, Layout-Prinzipien)

## 2. CREATOR-DNA im Vergleich
Pro Creator: 2-3 Sätze über den charakteristischen Stil. Was unterscheidet @creatorclass.de von @roman.knox von @kienobifilms?

## 3. STORYTELLING-PATTERNS
Welche narrativen Muster tauchen wiederholt auf? (Listicle, Case Study, Myth-Bust, Transformation-Arc, etc.) Mit Frequenz-Einschätzung.

## 4. HOOK-PATTERNS mit Beispielen
Sammle die stärksten Hooks aus allen Posts und kategorisiere sie.

## 5. LAYOUT & TYPOGRAFIE-PRINZIPIEN
Konkrete Regeln die sich herauskristallisieren (z.B. "Headline nimmt 40-60% der Höhe ein", "Slide-Nummerierung immer als NN/MM oben rechts", etc.)

## 6. FARB-SYSTEMATIK
Welche Farb-Logik wird sichtbar?

## 7. PLAYBOOK für unsere Karussells
10 konkrete, umsetzbare Regeln die wir in unseren carousel-generator.md Prompt und unser Style-Template einbauen sollten. Priorisiert nach Impact.

## 8. STYLE-TEMPLATE EMPFEHLUNGEN
Welche 3-5 Style-Varianten sollten wir als Vorlagen pflegen? (Basierend auf was wir gesehen haben — z.B. "Bold Typography Dark", "Editorial Light", "Magazine-Style", etc.)

Antwort auf Deutsch, dicht formuliert, keine Plattitüden, spezifische Regeln mit Zahlen wo möglich.`;

async function synthesize(anthropic: Anthropic, analyses: string[]): Promise<string> {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: META_SYNTHESIS_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `Hier sind ${analyses.length} einzelne Karussell-Analysen:\n\n` +
          analyses.map((a, i) => `=== ANALYSE ${i + 1} ===\n${a}`).join("\n\n---\n\n") +
          `\n\nJetzt die übergreifende Synthese.`,
      },
    ],
  });
  const tb = res.content.find((b) => b.type === "text");
  if (!tb || tb.type !== "text") throw new Error("No text in synth response");
  return tb.text;
}

async function main() {
  console.log(`── Carousel Research ──`);
  console.log(`Creators: ${CREATORS.join(", ")}`);
  console.log(`Top per creator: ${TOP_PER_CREATOR} · Lookback: ${LOOKBACK_DAYS}d`);
  console.log(`Output: ${OUT_DIR}\n`);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const allAnalyses: Array<{ handle: string; url: string; likes: number; analysis: string }> = [];

  for (const handle of CREATORS) {
    console.log(`\n━━━ @${handle} ━━━`);
    let posts: ApifyPost[];
    try {
      posts = await scrapePosts(handle);
    } catch (e) {
      console.error(`  ! Scrape failed: ${(e as Error).message}`);
      continue;
    }
    console.log(`  Scraped ${posts.length} posts`);
    const carousels = posts.filter(isCarousel);
    console.log(`  Carousels: ${carousels.length}`);
    carousels.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    const top = carousels.slice(0, TOP_PER_CREATOR);
    console.log(`  Top ${top.length} by likes:`);
    top.forEach((p, i) =>
      console.log(`    ${i + 1}. ${p.likesCount} likes · ${collectSlideUrls(p).length} slides · ${p.url}`)
    );

    for (let i = 0; i < top.length; i++) {
      const post = top[i];
      const slideUrls = collectSlideUrls(post);
      if (slideUrls.length === 0) {
        console.log(`    [${i + 1}] skipped — no slide urls`);
        continue;
      }
      console.log(`    [${i + 1}] downloading ${slideUrls.length} slides...`);
      const slides: string[] = [];
      for (const u of slideUrls.slice(0, 12)) {
        try {
          slides.push(await downloadSlide(u));
        } catch (e) {
          console.log(`       slide download failed: ${(e as Error).message}`);
        }
      }
      if (slides.length === 0) {
        console.log(`    [${i + 1}] skipped — all downloads failed`);
        continue;
      }
      console.log(`    [${i + 1}] analyzing with Claude Vision (${slides.length} slides)...`);
      try {
        const analysis = await analyzeCarousel(anthropic, handle, post.url, post.caption, slides);
        allAnalyses.push({ handle, url: post.url, likes: post.likesCount, analysis });
        const fn = `${handle}_${post.shortCode || i + 1}.md`;
        writeFileSync(
          join(OUT_DIR, fn),
          `# @${handle} — ${post.url}\n\nLikes: ${post.likesCount} · Comments: ${post.commentsCount} · Slides: ${slides.length}\n\n---\n\n${analysis}\n`
        );
        console.log(`    [${i + 1}] ✓ saved → ${fn}`);
      } catch (e) {
        console.log(`    [${i + 1}] ! analysis failed: ${(e as Error).message}`);
      }
    }
  }

  if (allAnalyses.length === 0) {
    console.error("\nNo analyses produced — aborting synthesis.");
    process.exit(1);
  }

  console.log(`\n━━━ SYNTHESIS over ${allAnalyses.length} posts ━━━`);
  const synthesis = await synthesize(
    anthropic,
    allAnalyses.map((a) => `[@${a.handle} · ${a.likes} likes · ${a.url}]\n${a.analysis}`)
  );
  const synthPath = join(OUT_DIR, "_SYNTHESIS.md");
  writeFileSync(
    synthPath,
    `# Carousel Research Synthesis\n\nDate: ${new Date().toISOString()}\nCreators: ${CREATORS.join(", ")}\nPosts analyzed: ${allAnalyses.length}\n\n---\n\n${synthesis}\n`
  );
  console.log(`\n✓ Synthesis saved → ${synthPath}`);
  console.log(`\nDone. Open: open "${OUT_DIR}"`);
}

main().catch((err) => {
  console.error("\nFAILED:", err);
  process.exit(1);
});
