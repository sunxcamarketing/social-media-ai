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
import { buildPrompt } from "@prompts";
import { readConfig } from "@/lib/csv";
import { toolLoadClientContext, toolLoadVoiceProfile } from "@/lib/agent-tools";

export interface CarouselReactProgressEvent {
  stage: "config" | "context" | "claude" | "sanitize" | "done" | "error";
  status: "loading" | "done" | "error";
  message?: string;
  data?: Record<string, unknown>;
}

export interface CarouselReactInput {
  clientId: string;
  topic: string;
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
 * The prompt asks for ONLY the component, but we defensively clean:
 *   1. Leading/trailing markdown fences (```tsx ... ```, ``` ... ```)
 *   2. Any prefix/suffix outside the function block
 *   3. Stray `import` / `export default` statements
 */
function sanitizeTsx(raw: string): string {
  let code = raw.trim();

  // Strip markdown fences if Claude ignored the instruction
  if (code.startsWith("```")) {
    code = code.replace(/^```(?:tsx|jsx|javascript|js|typescript|ts)?\s*\n?/i, "");
    code = code.replace(/\n?```\s*$/i, "");
    code = code.trim();
  }

  // Drop any leading prose — find the first `function Carousel`
  const funcStart = code.search(/\bfunction\s+Carousel\s*\(/);
  if (funcStart > 0) {
    code = code.slice(funcStart);
  }

  // Drop `import ...` lines (not usable in our Babel-standalone sandbox)
  code = code.replace(/^\s*import\s+[^\n]+\n?/gm, "");

  // Drop `export default` — we render <Carousel /> ourselves
  code = code.replace(/^\s*export\s+default\s+/gm, "");

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

  // ── Load brand + voice context in parallel ─────────────────────
  await emit({ stage: "context", status: "loading" });
  const [clientContext, voiceProfile] = await Promise.all([
    toolLoadClientContext(input.clientId),
    toolLoadVoiceProfile(input.clientId),
  ]);
  await emit({
    stage: "context",
    status: "done",
    data: {
      clientContextChars: clientContext.length,
      voiceProfileChars: voiceProfile.length,
    },
  });

  // ── Build prompt + call Claude with thinking enabled ───────────
  await emit({ stage: "claude", status: "loading" });
  const systemPrompt = buildPrompt(
    "carousel-react-generator",
    {
      client_context: clientContext,
      voice_profile: voiceProfile,
    },
    lang,
  );

  const userMessage = lang === "en"
    ? `Create the carousel now. Topic:\n\n${input.topic}`
    : `Erstelle das Karussell jetzt. Thema:\n\n${input.topic}`;

  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    thinking: { type: "enabled", budget_tokens: 8000 },
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

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
