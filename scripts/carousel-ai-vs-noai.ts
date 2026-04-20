import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import puppeteer from "puppeteer";

const ROOT = resolve(__dirname, "..");
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT_DIR = join(ROOT, "output", "carousels", `ai-vs-noai_${TIMESTAMP}`);
const SLIDES_DIR = join(OUT_DIR, "slides");
mkdirSync(SLIDES_DIR, { recursive: true });

const HANDLE = "aysun.caliskan";

interface SplitSlide {
  num: string;
  topic: string;
  badSubtitle: string;
  badMetric: string;
  badDetail: string;
  goodSubtitle: string;
  goodMetric: string;
  goodDetail: string;
  tools: Array<{ name: string; slug: string }>;
  factor: string;
}

const SLIDES: SplitSlide[] = [
  {
    num: "01",
    topic: "Content-Ideen finden",
    badSubtitle: "OHNE AI",
    badMetric: "3 Ideen",
    badDetail: "pro Woche · 1h pro Idee · manuelle Recherche",
    goodSubtitle: "MIT AI",
    goodMetric: "30 Ideen",
    goodDetail: "in 10 Min · datengetrieben · sofort nutzbar",
    tools: [
      { name: "ChatGPT", slug: "openai" },
      { name: "Claude", slug: "anthropic" },
      { name: "Notion", slug: "notion" },
    ],
    factor: "10× mehr",
  },
  {
    num: "02",
    topic: "Reel-Skript schreiben",
    badSubtitle: "OHNE AI",
    badMetric: "2 Stunden",
    badDetail: "pro Draft · Writer's Block · 1 Version",
    goodSubtitle: "MIT AI",
    goodMetric: "10 Minuten",
    goodDetail: "für 5 Varianten · bessere Hooks · Voice-Matching",
    tools: [
      { name: "Claude", slug: "anthropic" },
      { name: "ChatGPT", slug: "openai" },
    ],
    factor: "12× schneller",
  },
  {
    num: "03",
    topic: "Carousel & Grafiken",
    badSubtitle: "OHNE AI",
    badMetric: "4 Stunden",
    badDetail: "jede Slide einzeln in Canva · manuelles Layout",
    goodSubtitle: "MIT AI",
    goodMetric: "5 Minuten",
    goodDetail: "vom Prompt direkt zum fertigen Post",
    tools: [
      { name: "Claude", slug: "anthropic" },
      { name: "Canva", slug: "canva" },
      { name: "Figma", slug: "figma" },
    ],
    factor: "48× schneller",
  },
];

function renderSplitSection(s: SplitSlide, total: string): string {
  const toolPills = s.tools
    .map(
      (t) => `
      <div class="tool-pill">
        <img src="https://cdn.simpleicons.org/${t.slug}/FFFFFF" alt="${t.name}" />
        <span>${t.name}</span>
      </div>`
    )
    .join("");

  return `
  <section class="slide">
    <div class="header-bar">
      <span>@${HANDLE}</span>
      <span class="topic-tag">${s.topic}</span>
      <span>${s.num}/${total}</span>
    </div>

    <!-- TOP HALF — OHNE AI (bad) -->
    <div class="half bad">
      <div class="half-bg"></div>
      <div class="half-content">
        <div class="badge badge-bad">
          <span class="dot"></span>
          ${s.badSubtitle}
        </div>
        <div class="metric">${s.badMetric}</div>
        <div class="detail">${s.badDetail}</div>
      </div>
    </div>

    <div class="split-divider">
      <div class="vs-chip">vs</div>
    </div>

    <!-- BOTTOM HALF — MIT AI (good) -->
    <div class="half good">
      <div class="half-bg"></div>
      <div class="half-content">
        <div class="badge badge-good">
          <span class="dot"></span>
          ${s.goodSubtitle}
        </div>
        <div class="metric">${s.goodMetric}</div>
        <div class="detail">${s.goodDetail}</div>
        <div class="tool-row">${toolPills}</div>
      </div>
      <div class="factor-badge">${s.factor}</div>
    </div>
  </section>`;
}

const total = String(SLIDES.length).padStart(2, "0");
const slidesHtml = SLIDES.map((s) => renderSplitSection(s, total)).join("\n");

const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Mit AI vs. Ohne AI — Content Creation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --green:       #22C55E;
      --green-soft:  #16A34A;
      --red:         #EF4444;
      --red-soft:    #DC2626;
      --dark:        #0A0A0A;
      --dark-2:      #171717;
      --text-light:  #FFFFFF;
      --text-dim:    rgba(255,255,255,0.65);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', sans-serif;
      background: #000;
    }

    .slide {
      width: 1080px;
      height: 1350px;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .header-bar {
      position: absolute;
      top: 28px;
      left: 40px;
      right: 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--text-light);
      opacity: 0.95;
      z-index: 10;
      text-shadow: 0 1px 8px rgba(0,0,0,0.8);
    }
    .topic-tag {
      background: rgba(255,255,255,0.12);
      padding: 8px 16px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.18);
      backdrop-filter: blur(10px);
      font-size: 13px;
      letter-spacing: 0.1em;
    }

    /* ── HALVES ───────────────────────────────── */
    .half {
      flex: 1;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 120px 90px;
    }
    .half-bg {
      position: absolute;
      inset: 0;
      z-index: 0;
    }
    .half.bad .half-bg {
      background:
        radial-gradient(ellipse at top right, rgba(239,68,68,0.28) 0%, transparent 55%),
        radial-gradient(ellipse at bottom left, rgba(220,38,38,0.22) 0%, transparent 55%),
        linear-gradient(180deg, #2a0a0a 0%, #0a0a0a 100%);
    }
    .half.good .half-bg {
      background:
        radial-gradient(ellipse at top left, rgba(34,197,94,0.32) 0%, transparent 55%),
        radial-gradient(ellipse at bottom right, rgba(22,163,74,0.24) 0%, transparent 55%),
        linear-gradient(180deg, #0a2a16 0%, #0a1a10 100%);
    }
    .half::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px);
      background-size: 22px 22px;
      z-index: 1;
      opacity: 0.6;
    }
    .half-content {
      position: relative;
      z-index: 2;
      color: var(--text-light);
    }

    /* ── BADGE ─────────────────────────────────── */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 12px 24px;
      border-radius: 999px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.18em;
      margin-bottom: 28px;
    }
    .badge .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }
    .badge-bad {
      background: rgba(239,68,68,0.18);
      color: #FCA5A5;
      border: 1.5px solid rgba(239,68,68,0.5);
    }
    .badge-bad .dot { background: var(--red); box-shadow: 0 0 12px var(--red); }
    .badge-good {
      background: rgba(34,197,94,0.2);
      color: #86EFAC;
      border: 1.5px solid rgba(34,197,94,0.55);
    }
    .badge-good .dot { background: var(--green); box-shadow: 0 0 14px var(--green); }

    /* ── METRIC ────────────────────────────────── */
    .metric {
      font-family: 'Inter', sans-serif;
      font-weight: 900;
      font-size: 132px;
      line-height: 0.95;
      letter-spacing: -0.045em;
      margin-bottom: 24px;
    }
    .half.bad .metric {
      color: var(--text-light);
      text-decoration: line-through;
      text-decoration-color: rgba(239,68,68,0.8);
      text-decoration-thickness: 6px;
      text-underline-offset: 0;
    }
    .half.good .metric {
      background: linear-gradient(180deg, #BBF7D0 0%, #22C55E 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .detail {
      font-size: 26px;
      font-weight: 500;
      line-height: 1.35;
      color: var(--text-dim);
      max-width: 85%;
    }

    /* ── TOOL PILLS ────────────────────────────── */
    .tool-row {
      display: flex;
      gap: 12px;
      margin-top: 40px;
      flex-wrap: wrap;
    }
    .tool-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 18px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 999px;
      backdrop-filter: blur(8px);
      font-size: 18px;
      font-weight: 600;
      color: var(--text-light);
    }
    .tool-pill img {
      width: 22px;
      height: 22px;
      filter: brightness(1.1);
    }

    /* ── FACTOR BADGE ──────────────────────────── */
    .factor-badge {
      position: absolute;
      top: 48px;
      right: 80px;
      background: var(--green);
      color: var(--dark);
      font-family: 'Inter', sans-serif;
      font-weight: 900;
      font-size: 24px;
      padding: 14px 28px;
      border-radius: 999px;
      letter-spacing: -0.01em;
      z-index: 3;
      box-shadow: 0 8px 32px rgba(34,197,94,0.35);
      transform: rotate(3deg);
    }

    /* ── DIVIDER ───────────────────────────────── */
    .split-divider {
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 0;
      transform: translateY(-50%);
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .split-divider::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 2px;
      background: rgba(255,255,255,0.12);
      transform: translateY(-50%);
    }
    .vs-chip {
      position: relative;
      z-index: 2;
      width: 88px;
      height: 88px;
      border-radius: 50%;
      background: var(--dark);
      border: 2px solid rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', sans-serif;
      font-weight: 800;
      font-size: 26px;
      letter-spacing: 0.1em;
      color: var(--text-light);
      text-transform: uppercase;
      box-shadow: 0 8px 40px rgba(0,0,0,0.8);
    }
  </style>
</head>
<body>
${slidesHtml}
</body>
</html>`;

const htmlPath = join(OUT_DIR, "carousel.html");
writeFileSync(htmlPath, html);
console.log(`✓ HTML written → ${htmlPath}`);

async function main() {
  console.log("→ Launching Puppeteer...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 30000 });
  await page.evaluateHandle("document.fonts.ready");
  await new Promise((r) => setTimeout(r, 800));

  const sections = await page.$$eval("section", (els) => els.length);
  console.log(`✓ Found ${sections} slides`);
  for (let i = 0; i < sections; i++) {
    const el = await page.$(`section:nth-of-type(${i + 1})`);
    if (!el) continue;
    const n = String(i + 1).padStart(2, "0");
    const out = join(SLIDES_DIR, `slide-${n}.png`);
    await el.screenshot({ path: out as `${string}.png`, omitBackground: false });
    console.log(`  ✓ slide-${n}.png`);
  }
  await browser.close();

  console.log(`\n── Done ──`);
  console.log(`HTML:   ${htmlPath}`);
  console.log(`Slides: ${SLIDES_DIR}`);
  console.log(`Open:   open "${OUT_DIR}"`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
