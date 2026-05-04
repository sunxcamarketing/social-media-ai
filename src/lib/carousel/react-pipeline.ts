/**
 * React-based carousel generation pipeline.
 *
 * Takes a topic + client config, asks Claude Sonnet 4.6 (with thinking enabled)
 * to produce a self-contained React component, and returns the TSX string.
 *
 * Unlike the classic HTML pipeline, this one does NOT:
 * - Render via Puppeteer (client previews in a sandboxed iframe)
 * - Generate AI images (relies on typography + color + layout)
 * - Persist slide PNGs (export happens client-side via html-to-image)
 *
 * What it DOES do:
 * - Load client brand context + voice profile
 * - Call Claude with the carousel-react-generator agent
 * - Sanitize the output (strip markdown fences, import/export statements)
 * - Return the TSX string + token usage
 */

import { getAnthropicClient } from "@/lib/anthropic";
import { MODEL_SONNET } from "@/lib/models";
import { buildPrompt } from "@prompts";
import { readConfig } from "@/lib/csv";
import { toolLoadClientContext, toolLoadVoiceProfile } from "@/lib/agent-tools";
import { loadStyleGuideBlock } from "@/lib/carousel/style-guide";

export interface CarouselReactProgressEvent {
  stage: "config" | "context" | "claude" | "text-delta" | "sanitize" | "done" | "error";
  status: "loading" | "streaming" | "done" | "error";
  message?: string;
  /** Token delta (text-delta stage only). Receivers append to a buffer and re-render. */
  delta?: string;
  data?: Record<string, unknown>;
}

export interface CarouselReactInput {
  clientId: string;
  topic: string;
  /** Optional saved style guide to apply (id from carousel_style_guides). */
  styleGuideId?: string | null;
  onProgress?: (ev: CarouselReactProgressEvent) => void | Promise<void>;
}

export interface CarouselReactResult {
  tsxCode: string;
  topic: string;
  clientId: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
}

/**
 * Strip any non-code prose that Claude might have leaked before/after the TSX.
 * Prose comes from style guides asking for "think first" steps, or from Claude
 * adding a preamble. We keep top-level code (helpers, constants, components)
 * because the new prompt explicitly allows the style guide to ship literal
 * helpers like `Base`, `Counter`, `RED`, etc. before `function Carousel`.
 */
/**
 * Walk through a code prefix (everything before `function Carousel`) line by
 * line. Keep lines that look like top-level JS (const/let/var/function/class
 * declarations, comments, blank lines, JSDoc, lines inside an unclosed brace).
 * Drop everything else (free-form prose from "think first" steps).
 */
function stripProseLines(prefix: string): string {
  const out: string[] = [];
  let depth = 0; // brace depth — keep continuation lines of a multi-line decl
  for (const line of prefix.split("\n")) {
    const t = line.trim();
    const startsCode =
      t === "" ||
      t.startsWith("//") ||
      t.startsWith("/*") ||
      t.startsWith("*") ||
      /^(?:const|let|var|function|class|async\s+function)\b/.test(t) ||
      /^\}/.test(t);
    if (depth > 0 || startsCode) {
      out.push(line);
      // Track brace depth so multi-line `function X() {` blocks stay intact
      for (const ch of line) {
        if (ch === "{") depth++;
        else if (ch === "}") depth = Math.max(0, depth - 1);
      }
    }
    // else: drop (prose line outside any code block)
  }
  return out.join("\n");
}

function sanitizeTsx(raw: string): string {
  let code = raw.trim();

  // Strip markdown fences if Claude ignored the instruction
  if (code.startsWith("```")) {
    code = code.replace(/^```(?:tsx|jsx|javascript|js|typescript|ts)?\s*\n?/i, "");
    code = code.replace(/\n?```\s*$/i, "");
    code = code.trim();
  }

  // Find `function Carousel` — there must be exactly one. Anything before it
  // is either prose to strip OR top-level helpers/constants/components to
  // keep. Heuristic: a line is "code" if it starts with const/let/var/function/
  // class/// or is empty/whitespace. Otherwise it's prose.
  const funcStart = code.search(/\bfunction\s+Carousel\s*\(/);
  if (funcStart > 0) {
    const prefix = code.slice(0, funcStart);
    const suffix = code.slice(funcStart);
    const cleanPrefix = stripProseLines(prefix);
    code = cleanPrefix + suffix;
  }

  // Drop `import ...` lines (not usable in our Babel-standalone sandbox)
  code = code.replace(/^\s*import\s+[^\n]+\n?/gm, "");

  // Drop `export default` — we render <Carousel /> ourselves
  code = code.replace(/^\s*export\s+default\s+/gm, "");

  // Auto-repair typographic-quote mistakes: Claude often writes
  //   body: "...„moderne Sklaverei"...",
  // where the second " is a closing typographic quote that the JS parser
  // reads as the string terminator, breaking the rest of the file. We
  // detect the pattern „TEXT" (German low-9 opening + ASCII closing) and
  // replace the closing ASCII quote with a Unicode right-double-quote so
  // the parser stays inside the string. Safe because this exact sequence
  // is virtually never legitimate JS.
  code = code.replace(/„([^"„]*)"/g, "„$1”");

  // Same defensive pass for English typographic openers '"' (U+201C)
  code = code.replace(/“([^"“]*)"/g, "“$1”");

  // Trim trailing whitespace/newlines
  return code.trim();
}

export async function runCarouselReactPipeline(
  input: CarouselReactInput,
): Promise<CarouselReactResult> {
  const start = Date.now();
  const emit = async (ev: CarouselReactProgressEvent) => {
    if (input.onProgress) await input.onProgress(ev);
  };

  // ── Load client config ─────────────────────────────────────────
  await emit({ stage: "config", status: "loading" });
  const config = await readConfig(input.clientId);
  if (!config) throw new Error(`Client ${input.clientId} not found`);
  const lang: "de" | "en" = config.language === "en" ? "en" : "de";
  await emit({
    stage: "config",
    status: "done",
    data: { name: config.configName || config.name, lang },
  });

  // ── Load brand + voice context (+ optional style guide) in parallel ─
  await emit({ stage: "context", status: "loading" });
  const [clientContext, voiceProfile, styleGuide] = await Promise.all([
    toolLoadClientContext(input.clientId),
    toolLoadVoiceProfile(input.clientId),
    loadStyleGuideBlock(input.styleGuideId ?? null, lang),
  ]);
  await emit({
    stage: "context",
    status: "done",
    data: {
      clientContextChars: clientContext.length,
      voiceProfileChars: voiceProfile.length,
      styleGuideChars: styleGuide.length,
    },
  });

  // ── Build prompt + call Claude with thinking enabled ───────────
  await emit({ stage: "claude", status: "loading" });
  const systemPrompt = buildPrompt(
    "carousel-react-generator",
    {
      client_context: clientContext,
      voice_profile: voiceProfile,
      style_guide: styleGuide,
    },
    lang,
  );

  const userMessage = lang === "en"
    ? `Create the carousel now. Topic:\n\n${input.topic}`
    : `Erstelle das Karussell jetzt. Thema:\n\n${input.topic}`;

  const anthropic = getAnthropicClient();
  const stream = anthropic.messages.stream({
    model: MODEL_SONNET,
    max_tokens: 16000,
    thinking: { type: "enabled", budget_tokens: 4000 },
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  // Forward each text delta to the UI so the TSX appears live as Claude writes it.
  // Thinking blocks don't emit through the 'text' event, so the first delta only
  // arrives after the reasoning pass completes — that pause is the thinking budget.
  stream.on("text", (delta) => {
    void emit({ stage: "text-delta", status: "streaming", delta });
  });

  const response = await stream.finalMessage();

  // Collect text blocks (thinking blocks are not in response.content for extraction)
  const textBlocks = response.content.filter((b) => b.type === "text");
  if (textBlocks.length === 0) throw new Error("Claude returned no text output");
  const rawText = textBlocks
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();

  await emit({
    stage: "claude",
    status: "done",
    data: {
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      rawChars: rawText.length,
    },
  });

  // ── Sanitize the output ────────────────────────────────────────
  await emit({ stage: "sanitize", status: "loading" });
  const tsxCode = sanitizeTsx(rawText);
  if (!tsxCode.includes("function Carousel")) {
    throw new Error(
      "Generated output does not contain a Carousel function. First 500 chars:\n" +
        rawText.slice(0, 500),
    );
  }
  await emit({
    stage: "sanitize",
    status: "done",
    data: { finalChars: tsxCode.length },
  });

  const durationMs = Date.now() - start;
  const result: CarouselReactResult = {
    tsxCode,
    topic: input.topic,
    clientId: input.clientId,
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
    durationMs,
  };

  await emit({
    stage: "done",
    status: "done",
    data: {
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      durationMs: result.durationMs,
      chars: result.tsxCode.length,
    },
  });

  return result;
}
