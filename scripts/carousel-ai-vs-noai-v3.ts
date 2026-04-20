import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import puppeteer from "puppeteer";
import sharp from "sharp";
import { generateImages } from "../src/lib/nano-banana";

const ROOT = resolve(__dirname, "..");
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT_DIR = join(ROOT, "output", "carousels", `ai-vs-noai-v3_${TIMESTAMP}`);
const SLIDES_DIR = join(OUT_DIR, "slides");
const IMAGES_DIR = join(OUT_DIR, "images");
mkdirSync(SLIDES_DIR, { recursive: true });
mkdirSync(IMAGES_DIR, { recursive: true });

const HANDLE = "aysun.caliskan";

interface Slide {
  num: string;
  painHeadline: string;
  painAccent: string;
  painStat: string;
  painImagePrompt: string;
  valueHeadline: string;
  valueAccent: string;
  valueStat: string;
  valueImagePrompt: string;
  factor: string;
  tools: Array<{ name: string; slug: string }>;
}

const SLIDES: Slide[] = [
  {
    num: "01",
    painHeadline: "1 Stunde pro Idee — und meistens ist keine gute dabei.",
    painAccent: "keine gute dabei",
    painStat: "Alter Workflow · 3 Ideen pro Woche",
    painImagePrompt: `Cinematic dark photograph, shot from slightly above: a young woman content creator slumped at her desk late at night, warm desk lamp casting orange glow, laptop screen dim, notebooks scattered with crossed-out ideas and coffee stains. Mood: exhausted, stuck, creative burnout. Color grading: deep reds and browns, heavy shadows, slight film grain. No text. Vertical 4:5 aspect composition. Photorealistic.`,
    valueHeadline: "30 Ideen in 10 Minuten — datengetrieben und sofort nutzbar.",
    valueAccent: "datengetrieben",
    valueStat: "Neuer Workflow · 3 Min pro Idee",
    valueImagePrompt: `Cinematic bright photograph: a young woman content creator smiling at her laptop in a modern bright workspace, morning light, clean organized desk, plants, notebook open with clear structured list, coffee. Mood: confident, in flow, energized. Color grading: soft greens and warm whites, airy highlights. No text or UI mockups visible on screen. Vertical 4:5 aspect composition. Photorealistic.`,
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
    painImagePrompt: `Cinematic overhead photograph of a desk: crumpled paper balls, half-written script pages with red strikethroughs, an old pen lying across a page, a clock reading 2:47 AM, cold coffee mug. Mood: frustration, paralysis, writer's block. Color grading: muted reds, deep shadows, moody. No text legible on pages (blurred). Vertical 4:5 composition. Photorealistic.`,
    valueHeadline: "5 Hook-Varianten in 10 Minuten — im Voice deiner Brand.",
    valueAccent: "Voice deiner Brand",
    valueStat: "Neuer Workflow · 5 Hooks pro Skript",
    valueImagePrompt: `Cinematic photograph: a young woman at her laptop, wearing a headset, confidently typing in a bright modern home office with soft morning light. Notebook beside her with a clean numbered list visible but unreadable. Warm plants in background. Mood: flow state, confident, creative. Color grading: soft green tones and warm sunlight. Vertical 4:5 composition. Photorealistic.`,
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
    painImagePrompt: `Cinematic close-up photograph of a tired woman staring at a laptop screen in a dim room, her face illuminated by the cool blue light of design software, tension visible in her expression. Desktop cluttered with coffee cups. Evening light through window. Mood: drained, tedious task. Color grading: cool blue-grey shadows, deep contrast. No legible text on screen. Vertical 4:5 composition. Photorealistic.`,
    valueHeadline: "5 Minuten vom Prompt zum fertigen 8-Slide-Post.",
    valueAccent: "zum fertigen 8-Slide-Post",
    valueStat: "Neuer Workflow · 10 Posts pro Tag möglich",
    valueImagePrompt: `Cinematic photograph: a young woman in a modern loft workspace, stepping back and smiling at her laptop, arms relaxed, a phone in her hand showing a finished social media post (unreadable). Clean desk, minimal setup, golden hour light from large window. Mood: accomplished, fast, empowered. Color grading: warm greens and honey tones. Vertical 4:5 composition. Photorealistic.`,
    factor: "48× SCHNELLER",
    tools: [
      { name: "Claude", slug: "anthropic" },
      { name: "Canva", slug: "canva" },
      { name: "Figma", slug: "figma" },
    ],
  },
];

async function generateAllImages(): Promise<string[]> {
  const prompts = SLIDES.flatMap((s) => [s.painImagePrompt, s.valueImagePrompt]);
  console.log(`\n→ Generating ${prompts.length} images via Nano Banana (Gemini 2.5 Flash Image)...`);
  const start = Date.now();
  const results = await generateImages(prompts, { concurrency: 3, timeoutMs: 120000 });
  console.log(`✓ All ${results.length} images generated in ${((Date.now() - start) / 1000).toFixed(1)}s`);

  const paths: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const slideIdx = Math.floor(i / 2);
    const half = i % 2 === 0 ? "bad" : "good";
    const slide = SLIDES[slideIdx];
    const filename = `slide-${slide.num}_${half}.jpg`;
    const outPath = join(IMAGES_DIR, filename);

    // Resize to fit a slide-half (1080x675 @ 2x = 2160x1350) and save as JPEG
    await sharp(results[i].buffer)
      .resize({ width: 2160, height: 1350, fit: "cover" })
      .jpeg({ quality: 88 })
      .toFile(outPath);

    paths.push(filename);
    console.log(`  ✓ ${filename}`);
  }
  return paths;
}

function renderSlide(s: Slide, total: string, badImg: string, goodImg: string): string {
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

    <div class="half bad">
      <img class="half-photo" src="images/${badImg}" alt="">
      <div class="half-overlay"></div>
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

    <div class="half good">
      <img class="half-photo" src="images/${goodImg}" alt="">
      <div class="half-overlay"></div>
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

async function main() {
  const imagePaths = await generateAllImages();
  // imagePaths ordered: [slide1-bad, slide1-good, slide2-bad, slide2-good, ...]
  const total = String(SLIDES.length).padStart(2, "0");
  const slidesHtml = SLIDES.map((s, i) =>
    renderSlide(s, total, imagePaths[i * 2], imagePaths[i * 2 + 1])
  ).join("\n");

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Mit AI vs. Ohne AI — V3</title>
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
      --text-dim:   rgba(255,255,255,0.6);
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
      opacity: 0.85;
      z-index: 20;
      text-shadow: 0 1px 6px rgba(0,0,0,0.8);
    }

    .half {
      flex: 1;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 100px 80px;
    }

    .half-photo {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 0;
    }
    .half-overlay {
      position: absolute;
      inset: 0;
      z-index: 1;
    }
    .half.bad .half-overlay {
      background:
        linear-gradient(135deg, rgba(10,10,10,0.92) 0%, rgba(26,8,8,0.78) 40%, rgba(10,10,10,0.55) 100%),
        radial-gradient(ellipse at 100% 100%, rgba(239,68,68,0.18) 0%, transparent 60%);
    }
    .half.good .half-overlay {
      background:
        linear-gradient(135deg, rgba(10,36,22,0.55) 0%, rgba(10,20,14,0.78) 60%, rgba(10,10,10,0.92) 100%),
        radial-gradient(ellipse at 0% 0%, rgba(34,197,94,0.22) 0%, transparent 60%);
    }
    .half::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
      background-size: 22px 22px;
      z-index: 2;
      opacity: 0.5;
    }

    .half-content {
      position: relative;
      z-index: 3;
      color: var(--text);
    }

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
      margin-bottom: 32px;
      backdrop-filter: blur(6px);
    }
    .badge .dot {
      width: 8px; height: 8px; border-radius: 50%; display: inline-block;
    }
    .badge-bad {
      background: rgba(239,68,68,0.18);
      color: var(--red-soft);
      border: 1px solid rgba(239,68,68,0.45);
    }
    .badge-bad .dot { background: var(--red); box-shadow: 0 0 10px var(--red); }
    .badge-good {
      background: rgba(34,197,94,0.22);
      color: var(--green-soft);
      border: 1px solid rgba(34,197,94,0.55);
    }
    .badge-good .dot { background: var(--green); box-shadow: 0 0 12px var(--green); }

    .hero-line {
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      font-size: 60px;
      line-height: 1.1;
      letter-spacing: -0.025em;
      color: var(--text);
      margin-bottom: 28px;
      max-width: 100%;
      text-shadow: 0 2px 16px rgba(0,0,0,0.7);
    }
    .half.bad .hero-line { color: rgba(255,255,255,0.85); }
    .accent-bad {
      color: #FDA4A4;
      text-decoration: underline;
      text-decoration-color: rgba(239,68,68,0.85);
      text-decoration-thickness: 4px;
      text-underline-offset: 6px;
    }
    .accent-good {
      color: var(--green-soft);
      background: linear-gradient(180deg, transparent 62%, rgba(34,197,94,0.45) 62%);
      padding: 0 4px;
    }

    .stat-line {
      font-family: 'JetBrains Mono', monospace;
      font-size: 16px;
      font-weight: 500;
      letter-spacing: 0.14em;
      color: var(--text-dim);
      text-transform: uppercase;
      margin-top: 20px;
      text-shadow: 0 1px 6px rgba(0,0,0,0.8);
    }

    .tool-row {
      display: flex;
      gap: 10px;
      margin-top: 28px;
      flex-wrap: wrap;
    }
    .tool-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 18px;
      background: rgba(10,10,10,0.55);
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 999px;
      backdrop-filter: blur(10px);
      font-size: 18px;
      font-weight: 600;
      color: var(--text);
    }
    .tool-pill img {
      width: 22px; height: 22px; filter: brightness(1.15);
    }

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
      white-space: nowrap;
      box-shadow:
        0 10px 40px rgba(34,197,94,0.55),
        0 0 0 6px rgba(10,10,10,1),
        0 0 0 7px rgba(34,197,94,0.3);
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

  console.log("→ Launching Puppeteer...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 30000 });
  await page.evaluateHandle("document.fonts.ready");
  await new Promise((r) => setTimeout(r, 1000));

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
  console.log(`Images: ${IMAGES_DIR}`);
  console.log(`Slides: ${SLIDES_DIR}`);
  console.log(`Open:   open "${OUT_DIR}"`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
