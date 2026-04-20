/**
 * Carousel generation pipeline — shared between CLI script and admin API.
 *
 * Takes a topic + client config + style + optional photos,
 * streams progress via onProgress callback,
 * returns slide PNGs + HTML output.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, existsSync } from "fs";
import { resolve, join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import puppeteer from "puppeteer";
import { getAnthropicClient } from "@/lib/anthropic";
import { supabase } from "@/lib/supabase";
import { generateImages } from "@/lib/nano-banana";

export interface CarouselProgressEvent {
  stage:
    | "config"
    | "photos"
    | "claude"
    | "normalize"
    | "nano-banana"
    | "puppeteer"
    | "slide"
    | "done"
    | "error";
  status: "loading" | "done" | "error";
  message?: string;
  index?: number;
  total?: number;
  data?: Record<string, unknown>;
}

export interface CarouselPipelineInput {
  clientId: string;
  topic: string;
  styleId: string;
  handleOverride?: string;
  /** Optional extra photos uploaded via UI. Merged with client's persistent library. */
  additionalPhotos?: Array<{ filename: string; buffer: Buffer }>;
  /** Absolute path where runs are stored. Defaults to `<cwd>/output/carousels`. */
  outputRoot?: string;
  onProgress?: (ev: CarouselProgressEvent) => void | Promise<void>;
}

export interface CarouselRunResult {
  runId: string;
  outDir: string;
  htmlPath: string;
  slideFiles: string[];
  slideCount: number;
  photoCount: number;
  generatedImages: number;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
}

interface PhotoEntry {
  filename: string;
  buffer: Buffer;
  visionBase64: string;
}

function projectRoot(): string {
  return process.cwd();
}

function loadStyleAssets(styleId: string): { designSpec: string; templateHtml: string } {
  const styleDir = join(projectRoot(), "data", "carousel-styles", styleId);
  if (!existsSync(styleDir)) throw new Error(`Style not found: ${styleId}`);
  return {
    designSpec: readFileSync(join(styleDir, "design-spec.md"), "utf8"),
    templateHtml: readFileSync(join(styleDir, "template.html"), "utf8"),
  };
}

function loadSystemPrompt(): string {
  return readFileSync(join(projectRoot(), "prompts", "agents", "carousel-generator.md"), "utf8");
}

async function loadPersistentPhotos(clientId: string): Promise<Array<{ filename: string; path: string; buffer: Buffer }>> {
  const photosDir = join(projectRoot(), "data", "clients", clientId, "photos");
  if (!existsSync(photosDir)) return [];
  const files = readdirSync(photosDir).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f));
  return files.map((f) => {
    const p = join(photosDir, f);
    return { filename: f, path: p, buffer: readFileSync(p) };
  });
}

async function processPhotos(
  raw: Array<{ filename: string; buffer: Buffer }>,
): Promise<PhotoEntry[]> {
  const out: PhotoEntry[] = [];
  for (const p of raw) {
    const resized = await sharp(p.buffer)
      .rotate()
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    out.push({
      filename: p.filename,
      buffer: p.buffer,
      visionBase64: resized.toString("base64"),
    });
  }
  return out;
}

export async function runCarouselPipeline(input: CarouselPipelineInput): Promise<CarouselRunResult> {
  const start = Date.now();
  const emit = async (ev: CarouselProgressEvent) => {
    if (input.onProgress) await input.onProgress(ev);
  };

  // ── Setup paths ────────────────────────────────────────────
  const outputRoot = input.outputRoot ?? join(projectRoot(), "output", "carousels");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runId = `${input.clientId}_${timestamp}`;
  const outDir = join(outputRoot, runId);
  const slidesDir = join(outDir, "slides");
  mkdirSync(slidesDir, { recursive: true });

  // ── Step 1: Load client config ─────────────────────────────
  await emit({ stage: "config", status: "loading" });
  const { data: config, error: configErr } = await supabase
    .from("configs")
    .select("*")
    .eq("id", input.clientId)
    .single();
  if (configErr || !config) throw new Error(`Client ${input.clientId} not found`);

  const effectiveHandle = (input.handleOverride || (config as Record<string, string>).instagram || "")
    .replace(/^@/, "");
  await emit({
    stage: "config",
    status: "done",
    data: { name: config.configName || config.name, handle: effectiveHandle },
  });

  // ── Step 2: Load + process photos ──────────────────────────
  await emit({ stage: "photos", status: "loading" });
  const persistent = await loadPersistentPhotos(input.clientId);
  const combined = [
    ...persistent.map((p) => ({ filename: p.filename, buffer: p.buffer })),
    ...(input.additionalPhotos ?? []),
  ];
  const photos = await processPhotos(combined);

  // Copy raw photos into outDir so Puppeteer can load via relative path
  if (photos.length > 0) {
    const outPhotosDir = join(outDir, "photos");
    mkdirSync(outPhotosDir, { recursive: true });
    for (const p of photos) {
      writeFileSync(join(outPhotosDir, p.filename), p.buffer);
    }
  }
  await emit({ stage: "photos", status: "done", data: { count: photos.length } });

  // ── Step 3: Claude generation ──────────────────────────────
  await emit({ stage: "claude", status: "loading" });
  const { designSpec, templateHtml } = loadStyleAssets(input.styleId);
  const systemPrompt = loadSystemPrompt();

  const brandBlock = [
    `Brand: ${config.name || config.configName || "—"}`,
    effectiveHandle ? `Instagram: @${effectiveHandle}` : "",
    config.brandFeeling ? `Brand feeling: ${config.brandFeeling}` : "",
    config.brandingStatement ? `Brand statement: ${config.brandingStatement}` : "",
    config.humanDifferentiation ? `Differentiation: ${config.humanDifferentiation}` : "",
    config.coreOffer ? `Core offer: ${config.coreOffer}` : "",
    config.voiceProfile ? `Voice profile:\n${config.voiceProfile}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const userContent: Anthropic.ContentBlockParam[] = [
    { type: "text", text: `## INHALT\n\nTopic: ${input.topic}\n\n## CLIENT-BRAND\n\n${brandBlock}` },
    {
      type: "text",
      text: `## DESIGN-STYLE: ${input.styleId}\n\n### Design Spec:\n\n${designSpec}\n\n### HTML Template (nutze dieses als Ausgangspunkt — struktur/CSS übernehmen, Slides reingenerieren):\n\n\`\`\`html\n${templateHtml}\n\`\`\``,
    },
  ];

  if (photos.length > 0) {
    userContent.push({
      type: "text",
      text: `## BILDER-BIBLIOTHEK\n\nVerfügbare Fotos (du siehst sie unten). Embedde passende Fotos in die Slides über:\n<img src="photos/EXAKTER-DATEINAME"> — z.B. <img src="photos/${photos[0].filename}">\n\nNicht jede Slide muss ein Foto haben. Wähle pro Slide das emotional und inhaltlich passendste. Wenn kein Foto passt, nutze <img data-generate="PROMPT"> für AI-generierte Szenen (siehe System-Prompt).`,
    });
    for (const p of photos) {
      userContent.push({ type: "text", text: `--- photos/${p.filename} ---` });
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: p.visionBase64 },
      });
    }
  } else {
    userContent.push({
      type: "text",
      text: `## KEINE CLIENT-FOTOS\n\nDer Client hat keine Foto-Bibliothek angelegt. Nutze AI-generierte Bilder über <img data-generate="PROMPT"> für alle Szenen die ein Bild brauchen (siehe System-Prompt für Prompt-Qualität).`,
    });
  }

  userContent.push({
    type: "text",
    text: `\n## GENERIERE JETZT\n\nGeneriere das komplette Karussell-HTML. **Harte Regel: Minimum 3 Slides** (Hook → Kern → CTA). Alle weiteren Slides sind OPTIONAL — nur wenn der Topic echt mehr eigenständige Aussagen hat. Kein Strecken, kein Filler. Ein 3-Slide-Karussell mit klarer Message schlägt ein 8-Slide-Karussell mit Filler IMMER. Nur HTML zurückgeben, kein Prosa-Kommentar. Starte mit <!DOCTYPE html>.`,
  });

  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Claude returned no text");
  let html = textBlock.text.trim();
  if (html.startsWith("```")) {
    html = html.replace(/^```(?:html)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  await emit({
    stage: "claude",
    status: "done",
    data: {
      chars: html.length,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
    },
  });

  // ── Step 4: Normalize counters + handle ────────────────────
  await emit({ stage: "normalize", status: "loading" });
  const totalSlides = (html.match(/<section\b/g) || []).length;
  const totalStr = String(totalSlides).padStart(2, "0");
  let slideIdx = 0;
  html = html.replace(/<section\b[\s\S]*?<\/section>/g, (sectionHtml) => {
    slideIdx += 1;
    const num = String(slideIdx).padStart(2, "0");
    return sectionHtml.replace(/\b\d{1,2}\s*\/\s*\d{1,2}\b/g, `${num}/${totalStr}`);
  });
  if (effectiveHandle) {
    html = html.replace(/@[A-Z0-9._]+/gi, `@${effectiveHandle}`);
  }
  await emit({ stage: "normalize", status: "done", data: { slides: totalSlides } });

  // ── Step 5: Nano Banana image generation ───────────────────
  const MAX_GENERATIONS = 12;
  const generateTagRegex = /<img\b[^>]*\bdata-generate\s*=\s*(["'])(.*?)\1[^>]*>/gi;
  const generationRequests: Array<{ prompt: string; fullMatch: string }> = [];
  let genMatch: RegExpExecArray | null;
  while ((genMatch = generateTagRegex.exec(html)) !== null) {
    const prompt = genMatch[2].replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
    generationRequests.push({ prompt, fullMatch: genMatch[0] });
  }

  let generatedCount = 0;
  if (generationRequests.length > 0) {
    const toGenerate = generationRequests.slice(0, MAX_GENERATIONS);
    await emit({ stage: "nano-banana", status: "loading", total: toGenerate.length });
    const genDir = join(outDir, "generated");
    mkdirSync(genDir, { recursive: true });
    try {
      const prompts = toGenerate.map((r) => r.prompt);
      const results = await generateImages(prompts, { concurrency: 3, timeoutMs: 120000 });
      for (let i = 0; i < results.length; i++) {
        const filename = `generated-${String(i + 1).padStart(2, "0")}.jpg`;
        await sharp(results[i].buffer)
          .resize({ width: 2160, height: 2700, fit: "cover", withoutEnlargement: false })
          .jpeg({ quality: 88 })
          .toFile(join(genDir, filename));
        const original = toGenerate[i].fullMatch;
        const withSrc = original.replace(
          /\bdata-generate\s*=\s*(["']).*?\1/i,
          `src="generated/${filename}"`,
        );
        html = html.replace(original, withSrc);
        generatedCount += 1;
      }
      await emit({ stage: "nano-banana", status: "done", data: { count: generatedCount } });
    } catch (err) {
      await emit({
        stage: "nano-banana",
        status: "error",
        message: (err as Error).message,
      });
      for (const r of toGenerate) {
        html = html.replace(
          r.fullMatch,
          r.fullMatch.replace(/\bdata-generate\s*=\s*(["']).*?\1/i, 'src=""'),
        );
      }
    }
  }

  // ── Step 6: Write HTML + Puppeteer render ──────────────────
  const htmlPath = join(outDir, "carousel.html");
  writeFileSync(htmlPath, html);

  await emit({ stage: "puppeteer", status: "loading" });
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 30000 });
  await page.evaluateHandle("document.fonts.ready");
  await new Promise((r) => setTimeout(r, 600));

  const sectionCount = await page.$$eval("section", (els) => els.length);
  const slideFiles: string[] = [];
  for (let i = 0; i < sectionCount; i++) {
    const section = await page.$(`section:nth-of-type(${i + 1})`);
    if (!section) continue;
    const slideNum = String(i + 1).padStart(2, "0");
    const outPath = join(slidesDir, `slide-${slideNum}.png`);
    await section.screenshot({ path: outPath as `${string}.png`, omitBackground: false });
    slideFiles.push(`slides/slide-${slideNum}.png`);
    await emit({
      stage: "slide",
      status: "done",
      index: i + 1,
      total: sectionCount,
      data: { filename: `slide-${slideNum}.png` },
    });
  }
  await browser.close();
  await emit({ stage: "puppeteer", status: "done" });

  const durationMs = Date.now() - start;
  const result: CarouselRunResult = {
    runId,
    outDir,
    htmlPath,
    slideFiles,
    slideCount: sectionCount,
    photoCount: photos.length,
    generatedImages: generatedCount,
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
    durationMs,
  };

  // Persist to DB so the admin can list / edit / re-download later.
  try {
    await supabase.from("carousels").upsert({
      id: runId,
      client_id: input.clientId,
      run_id: runId,
      topic: input.topic,
      style_id: input.styleId,
      handle: effectiveHandle,
      slide_count: sectionCount,
      meta: {
        photoCount: photos.length,
        generatedImages: generatedCount,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
        durationMs,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "run_id" });
  } catch (err) {
    console.error("[carousel] failed to persist to DB:", (err as Error).message);
  }

  await emit({ stage: "done", status: "done", data: result as unknown as Record<string, unknown> });
  return result;
}

// ── Regeneration pipeline ──────────────────────────────────────────────────

export interface CarouselRegenerateInput {
  runId: string;
  clientId: string;
  feedback: string;
  /** If null/undefined, regenerate ALL slides. If 0-indexed number, regenerate just that slide. */
  slideIndex?: number | null;
  /** Optional replacement image uploaded by user. Saved into photos/ and made available to Claude. */
  replacementImage?: { filename: string; buffer: Buffer };
  outputRoot?: string;
  onProgress?: (ev: CarouselProgressEvent) => void | Promise<void>;
}

export async function regenerateCarousel(input: CarouselRegenerateInput): Promise<CarouselRunResult> {
  const start = Date.now();
  const emit = async (ev: CarouselProgressEvent) => {
    if (input.onProgress) await input.onProgress(ev);
  };

  const outputRoot = input.outputRoot ?? join(projectRoot(), "output", "carousels");
  const outDir = join(outputRoot, input.runId);
  const htmlPath = join(outDir, "carousel.html");
  const slidesDir = join(outDir, "slides");
  const photosDir = join(outDir, "photos");

  if (!existsSync(htmlPath)) throw new Error(`Original carousel not found for run ${input.runId}`);
  let html = readFileSync(htmlPath, "utf8");

  // ── Step 1: Load client config ─────────────────────────────
  await emit({ stage: "config", status: "loading" });
  const { data: config, error: configErr } = await supabase
    .from("configs")
    .select("*")
    .eq("id", input.clientId)
    .single();
  if (configErr || !config) throw new Error(`Client ${input.clientId} not found`);
  await emit({ stage: "config", status: "done" });

  // ── Step 2: Save replacement image if provided ─────────────
  if (input.replacementImage) {
    mkdirSync(photosDir, { recursive: true });
    const replacementPath = join(photosDir, input.replacementImage.filename);
    writeFileSync(replacementPath, input.replacementImage.buffer);
    await emit({ stage: "photos", status: "done", data: { replacement: input.replacementImage.filename } });
  }

  // ── Step 3: Claude re-generation ───────────────────────────
  await emit({ stage: "claude", status: "loading" });
  const systemPrompt = loadSystemPrompt();
  const anthropic = getAnthropicClient();

  // Build feedback instructions for Claude
  const feedbackBlock = input.feedback.trim()
    ? `## USER FEEDBACK\n\nThe user has this specific feedback — apply it carefully:\n\n"${input.feedback.trim()}"\n`
    : "";
  const imageNote = input.replacementImage
    ? `\n## USER-PROVIDED REPLACEMENT IMAGE\n\nThe user has uploaded a new image: photos/${input.replacementImage.filename}. Use it in the regenerated output (replace the most visually prominent image of the target section, or integrate it thoughtfully).\n`
    : "";

  let tokensIn = 0;
  let tokensOut = 0;

  if (input.slideIndex !== null && input.slideIndex !== undefined) {
    // ── Single-slide regeneration ─────────────────────────────
    const sections = html.match(/<section\b[\s\S]*?<\/section>/g) || [];
    if (input.slideIndex >= sections.length) throw new Error(`Slide index ${input.slideIndex} out of range (have ${sections.length})`);
    const targetSection = sections[input.slideIndex];
    const totalStr = String(sections.length).padStart(2, "0");
    const slideNum = String(input.slideIndex + 1).padStart(2, "0");

    const userText = `## CURRENT SLIDE ${input.slideIndex + 1} / ${sections.length}\n\nHere is the current HTML of the slide:\n\n\`\`\`html\n${targetSection}\n\`\`\`\n\n${feedbackBlock}${imageNote}\n## TASK\n\nReturn ONLY the revised <section>...</section> HTML for this single slide. Keep the same structure, page counter format (${slideNum}/${totalStr}), and design language as the original. Apply the feedback precisely. Do not add commentary.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userText }],
    });
    tokensIn = response.usage.input_tokens;
    tokensOut = response.usage.output_tokens;

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("Claude returned no text");
    let newSection = textBlock.text.trim();
    if (newSection.startsWith("```")) newSection = newSection.replace(/^```(?:html)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    // Extract just the <section> block if Claude returned extra wrapping
    const sectionMatch = newSection.match(/<section\b[\s\S]*?<\/section>/);
    if (sectionMatch) newSection = sectionMatch[0];

    // Replace in HTML
    html = html.replace(targetSection, newSection);
    writeFileSync(htmlPath, html);
  } else {
    // ── Full carousel regeneration ────────────────────────────
    const userText = `## CURRENT CAROUSEL\n\nHere is the current HTML:\n\n\`\`\`html\n${html}\n\`\`\`\n\n${feedbackBlock}${imageNote}\n## TASK\n\nReturn the COMPLETE revised carousel HTML. Apply the feedback carefully. Keep the overall structure (same number of slides, same page counters, same design language). Do not add commentary — just return the HTML starting with <!DOCTYPE html>.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: "user", content: userText }],
    });
    tokensIn = response.usage.input_tokens;
    tokensOut = response.usage.output_tokens;

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("Claude returned no text");
    let newHtml = textBlock.text.trim();
    if (newHtml.startsWith("```")) newHtml = newHtml.replace(/^```(?:html)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    html = newHtml;
    writeFileSync(htmlPath, html);
  }
  await emit({ stage: "claude", status: "done", data: { tokensIn, tokensOut } });

  // ── Step 4: Re-run Nano Banana for any new data-generate tags ────
  const generateTagRegex = /<img\b[^>]*\bdata-generate\s*=\s*(["'])(.*?)\1[^>]*>/gi;
  const generationRequests: Array<{ prompt: string; fullMatch: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = generateTagRegex.exec(html)) !== null) {
    generationRequests.push({ prompt: m[2].replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim(), fullMatch: m[0] });
  }
  let generatedCount = 0;
  if (generationRequests.length > 0) {
    await emit({ stage: "nano-banana", status: "loading", total: generationRequests.length });
    const genDir = join(outDir, "generated");
    mkdirSync(genDir, { recursive: true });
    try {
      const prompts = generationRequests.slice(0, 12).map((r) => r.prompt);
      const results = await generateImages(prompts, { concurrency: 3, timeoutMs: 120000 });
      const existingGen = existsSync(genDir) ? readdirSync(genDir).length : 0;
      for (let i = 0; i < results.length; i++) {
        const filename = `regen-${Date.now()}-${String(existingGen + i + 1).padStart(2, "0")}.jpg`;
        await sharp(results[i].buffer)
          .resize({ width: 2160, height: 2700, fit: "cover", withoutEnlargement: false })
          .jpeg({ quality: 88 })
          .toFile(join(genDir, filename));
        const original = generationRequests[i].fullMatch;
        const withSrc = original.replace(/\bdata-generate\s*=\s*(["']).*?\1/i, `src="generated/${filename}"`);
        html = html.replace(original, withSrc);
        generatedCount += 1;
      }
      writeFileSync(htmlPath, html);
      await emit({ stage: "nano-banana", status: "done", data: { count: generatedCount } });
    } catch (err) {
      await emit({ stage: "nano-banana", status: "error", message: (err as Error).message });
    }
  }

  // ── Step 5: Re-render slides ────────────────────────────────
  await emit({ stage: "puppeteer", status: "loading" });
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 30000 });
  await page.evaluateHandle("document.fonts.ready");
  await new Promise((r) => setTimeout(r, 600));

  const sectionCount = await page.$$eval("section", (els) => els.length);
  mkdirSync(slidesDir, { recursive: true });
  const slideFiles: string[] = [];

  // If single-slide regen, only re-render that slide. Else all.
  const indicesToRender = input.slideIndex !== null && input.slideIndex !== undefined
    ? [input.slideIndex]
    : Array.from({ length: sectionCount }, (_, i) => i);

  for (let i = 0; i < sectionCount; i++) {
    const slideNum = String(i + 1).padStart(2, "0");
    const outPath = join(slidesDir, `slide-${slideNum}.png`);
    if (indicesToRender.includes(i)) {
      const section = await page.$(`section:nth-of-type(${i + 1})`);
      if (section) {
        await section.screenshot({ path: outPath as `${string}.png`, omitBackground: false });
        await emit({ stage: "slide", status: "done", index: i + 1, total: sectionCount, data: { filename: `slide-${slideNum}.png` } });
      }
    }
    slideFiles.push(`slides/slide-${slideNum}.png`);
  }
  await browser.close();
  await emit({ stage: "puppeteer", status: "done" });

  const durationMs = Date.now() - start;
  const result: CarouselRunResult = {
    runId: input.runId,
    outDir,
    htmlPath,
    slideFiles,
    slideCount: sectionCount,
    photoCount: 0,
    generatedImages: generatedCount,
    tokensIn,
    tokensOut,
    durationMs,
  };

  // Update the saved DB row so the edit history reflects the latest regen.
  try {
    await supabase.from("carousels").update({
      slide_count: sectionCount,
      meta: {
        regeneratedAt: new Date().toISOString(),
        lastFeedback: input.feedback.slice(0, 500),
        lastSlideIndex: input.slideIndex ?? null,
        tokensIn,
        tokensOut,
        durationMs,
      },
      updated_at: new Date().toISOString(),
    }).eq("run_id", input.runId);
  } catch (err) {
    console.error("[carousel] failed to update DB row on regenerate:", (err as Error).message);
  }

  await emit({ stage: "done", status: "done", data: result as unknown as Record<string, unknown> });
  return result;
}

export interface CarouselStyleInfo {
  id: string;
  name: string;
  /** Name of the preview file (preview.png|jpg|webp) if present. Null otherwise. */
  previewFile: string | null;
  /** Primary BRAND color extracted from design-spec.md (for placeholder cards). */
  primaryColor: string | null;
}

/** List available carousel styles (directories under `data/carousel-styles/`). */
export function listAvailableStyles(): CarouselStyleInfo[] {
  const stylesRoot = join(projectRoot(), "data", "carousel-styles");
  if (!existsSync(stylesRoot)) return [];
  const dirs = readdirSync(stylesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return dirs.map((id) => {
    const dir = join(stylesRoot, id);
    let name = id;
    let primaryColor: string | null = null;
    try {
      const spec = readFileSync(join(dir, "design-spec.md"), "utf8");
      const nameMatch = spec.match(/^#\s+(.+)/m);
      if (nameMatch) name = nameMatch[1].trim();
      // Try to pick up the first hex code (likely the primary brand color)
      const hexMatch = spec.match(/#[0-9A-Fa-f]{6}\b/);
      if (hexMatch) primaryColor = hexMatch[0];
    } catch {
      // fallback to id
    }
    const previewCandidates = ["preview.png", "preview.jpg", "preview.jpeg", "preview.webp"];
    let previewFile: string | null = null;
    for (const c of previewCandidates) {
      if (existsSync(join(dir, c))) { previewFile = c; break; }
    }
    return { id, name, previewFile, primaryColor };
  });
}
