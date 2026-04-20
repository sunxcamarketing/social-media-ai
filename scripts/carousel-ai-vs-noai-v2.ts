import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import puppeteer from "puppeteer";

const ROOT = resolve(__dirname, "..");
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT_DIR = join(ROOT, "output", "carousels", `ai-vs-noai-v2_${TIMESTAMP}`);
const SLIDES_DIR = join(OUT_DIR, "slides");
mkdirSync(SLIDES_DIR, { recursive: true });

const HANDLE = "aysun.caliskan";

interface Slide {
  num: string;
  painHeadline: string; // HERO — the sentence the reader must feel
  painAccent: string; // highlighted fragment within painHeadline
  painStat: string; // small footer context
  valueHeadline: string; // HERO — the sentence the reader must feel
  valueAccent: string; // highlighted fragment within valueHeadline
  valueStat: string; // small footer context
  factor: string; // chip on divider
  tools: Array<{ name: string; slug: string }>;
}

const SLIDES: Slide[] = [
  {
    num: "01",
    painHeadline: "1 Stunde pro Idee — und meistens ist keine gute dabei.",
    painAccent: "keine gute dabei",
    painStat: "Alter Workflow · 3 Ideen pro Woche",
    valueHeadline: "30 Ideen in 10 Minuten — datengetrieben und sofort nutzbar.",
    valueAccent: "datengetrieben",
    valueStat: "Neuer Workflow · 3 Min pro Idee",
    factor: "10× MEHR OUTPUT",
    tools: [
      { name: "ChatGPT", slug: "openai" },
      { name: "Claude", slug: "anthropic" },
      { name: "Notion", slug: "notion" },
    ],
  },
  {
    num: "02",
    painHeadline: "2 Stunden Writer's Block für einen einzigen, mittelmäßigen Hook.",
    painAccent: "mittelmäßigen Hook",
    painStat: "Alter Workflow · 1 Version pro Reel",
    valueHeadline: "5 Hook-Varianten in 10 Minuten — im Voice deiner Brand.",
    valueAccent: "Voice deiner Brand",
    valueStat: "Neuer Workflow · 5 Hooks pro Skript",
    factor: "12× SCHNELLER",
    tools: [
      { name: "Claude", slug: "anthropic" },
      { name: "ChatGPT", slug: "openai" },
    ],
  },
  {
    num: "03",
    painHeadline: "4 Stunden in Canva — jede Slide einzeln, jedes Alignment manuell.",
    painAccent: "jede Slide einzeln",
    painStat: "Alter Workflow · 1 Post pro halber Tag",
    valueHeadline: "5 Minuten vom Prompt zum fertigen 8-Slide-Post.",
    valueAccent: "zum fertigen 8-Slide-Post",
    valueStat: "Neuer Workflow · 10 Posts pro Tag möglich",
    factor: "48× SCHNELLER",
    tools: [
      { name: "Claude", slug: "anthropic" },
      { name: "Canva", slug: "canva" },
      { name: "Figma", slug: "figma" },
    ],
  },
];

function renderSlide(s: Slide, total: string): string {
  const painHtml = s.painHeadline.replace(
    s.painAccent,
    `<span class="accent-bad">${s.painAccent}</span>`
  );
  const valueHtml = s.valueHeadline.replace(
    s.valueAccent,
    `<span class="accent-good">${s.valueAccent}</span>`
  );
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
      <span>${s.num} / ${total}</span>
    </div>

    <!-- BAD HALF -->
    <div class="half bad">
      <div class="half-bg"></div>
      <div class="half-content">
        <div class="badge badge-bad">
          <span class="dot"></span>
          OHNE AI
        </div>
        <h2 class="hero-line">${painHtml}</h2>
        <div class="stat-line">${s.painStat}</div>
      </div>
    </div>

    <div class="factor-chip">${s.factor}</div>

    <!-- GOOD HALF -->
    <div class="half good">
      <div class="half-bg"></div>
      <div class="half-content">
        <div class="badge badge-good">
          <span class="dot"></span>
          MIT AI
        </div>
        <h2 class="hero-line">${valueHtml}</h2>
        <div class="tool-row">${toolPills}</div>
        <div class="stat-line">${s.valueStat}</div>
      </div>
    </div>
  </section>`;
}

const total = String(SLIDES.length).padStart(2, "0");
const slidesHtml = SLIDES.map((s) => renderSlide(s, total)).join("\n");

const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Mit AI vs. Ohne AI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --green:      #22C55E;
      --green-soft: #86EFAC;
      --red:        #EF4444;
      --red-soft:   #FCA5A5;
      --dark:       #0A0A0A;
      --text:       #FFFFFF;
      --text-dim:   rgba(255,255,255,0.55);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body { font-family: 'Inter', sans-serif; background: #000; }

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
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--text);
      opacity: 0.7;
      z-index: 20;
    }

    /* ── HALVES ───────────────────────────────── */
    .half {
      flex: 1;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 100px 80px;
    }

    .half-bg {
      position: absolute;
      inset: 0;
      z-index: 0;
    }
    .half.bad .half-bg {
      background:
        radial-gradient(ellipse at 20% 30%, rgba(239,68,68,0.18) 0%, transparent 60%),
        linear-gradient(180deg, #1a0808 0%, #0a0a0a 100%);
    }
    .half.good .half-bg {
      background:
        radial-gradient(ellipse at 80% 70%, rgba(34,197,94,0.28) 0%, transparent 60%),
        linear-gradient(180deg, #08180f 0%, #0a2416 100%);
    }
    .half::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
      background-size: 22px 22px;
      z-index: 1;
      opacity: 0.7;
    }

    .half-content {
      position: relative;
      z-index: 2;
      color: var(--text);
    }

    /* ── BADGE (small, understated) ──────────── */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 9px 18px;
      border-radius: 999px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.2em;
      margin-bottom: 36px;
    }
    .badge .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .badge-bad {
      background: rgba(239,68,68,0.1);
      color: var(--red-soft);
      border: 1px solid rgba(239,68,68,0.35);
    }
    .badge-bad .dot { background: var(--red); box-shadow: 0 0 10px var(--red); }
    .badge-good {
      background: rgba(34,197,94,0.15);
      color: var(--green-soft);
      border: 1px solid rgba(34,197,94,0.45);
    }
    .badge-good .dot { background: var(--green); box-shadow: 0 0 12px var(--green); }

    /* ── HERO LINE — the sentence the reader must feel ── */
    .hero-line {
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      font-size: 62px;
      line-height: 1.1;
      letter-spacing: -0.025em;
      color: var(--text);
      margin-bottom: 32px;
      max-width: 100%;
    }
    .half.bad .hero-line {
      color: rgba(255,255,255,0.72);
    }
    .accent-bad {
      color: var(--red-soft);
      text-decoration: underline;
      text-decoration-color: rgba(239,68,68,0.7);
      text-decoration-thickness: 4px;
      text-underline-offset: 6px;
    }
    .accent-good {
      color: var(--green-soft);
      background: linear-gradient(180deg, transparent 65%, rgba(34,197,94,0.35) 65%);
      padding: 0 4px;
    }

    /* ── STAT LINE (context, understated) ────── */
    .stat-line {
      font-family: 'JetBrains Mono', monospace;
      font-size: 17px;
      font-weight: 500;
      letter-spacing: 0.12em;
      color: var(--text-dim);
      text-transform: uppercase;
      margin-top: 24px;
    }

    /* ── TOOL PILLS ──────────────────────────── */
    .tool-row {
      display: flex;
      gap: 10px;
      margin-top: 36px;
      flex-wrap: wrap;
    }
    .tool-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 18px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 999px;
      backdrop-filter: blur(8px);
      font-size: 18px;
      font-weight: 600;
      color: var(--text);
    }
    .tool-pill img {
      width: 22px;
      height: 22px;
      filter: brightness(1.15);
    }

    /* ── FACTOR CHIP — centered on divider, straddling halves ── */
    .factor-chip {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #4ADE80 0%, #16A34A 100%);
      color: var(--dark);
      font-family: 'Inter', sans-serif;
      font-weight: 900;
      font-size: 24px;
      padding: 18px 36px;
      border-radius: 999px;
      letter-spacing: -0.01em;
      z-index: 6;
      box-shadow:
        0 10px 40px rgba(34,197,94,0.55),
        0 0 0 6px rgba(10,10,10,1),
        0 0 0 7px rgba(34,197,94,0.3);
      white-space: nowrap;
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
  console.log(`Slides: ${SLIDES_DIR}`);
  console.log(`Open:   open "${OUT_DIR}"`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
