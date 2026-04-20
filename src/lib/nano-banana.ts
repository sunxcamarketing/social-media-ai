/**
 * Nano Banana — Gemini 2.5 Flash Image
 *
 * Generates images from text prompts via Google's Gemini Image API.
 * Best-in-class text-in-image accuracy, <2s latency, ~$0.04/image.
 *
 * Use cases in this project:
 * - Carousel backgrounds when client has no matching photos
 * - Generated illustrations / isometric scenes
 * - Icon clusters / branded visual anchors
 * - Split-screen "bad vs good" scene generation
 */

const MODEL_ID = "gemini-2.5-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return key;
}

export interface GenerateImageOptions {
  /** Reference images passed to the model (base64 JPEG). Enables image-to-image editing. */
  referenceImages?: Array<{ base64: string; mimeType?: string }>;
  /** Optional timeout in ms. Default 60000. */
  timeoutMs?: number;
}

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Generate an image from a text prompt. Returns raw bytes + mimeType.
 * Throws on API failure or if the response contains no image.
 */
export async function generateImage(
  prompt: string,
  opts: GenerateImageOptions = {}
): Promise<GeneratedImage> {
  const key = getApiKey();
  const timeout = opts.timeoutMs ?? 60000;

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (opts.referenceImages?.length) {
    for (const ref of opts.referenceImages) {
      parts.push({
        inlineData: {
          mimeType: ref.mimeType ?? "image/jpeg",
          data: ref.base64,
        },
      });
    }
  }

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };

  const res = await fetch(`${ENDPOINT}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nano Banana error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const candidates = data.candidates ?? [];
  for (const c of candidates) {
    const parts = c.content?.parts ?? [];
    for (const p of parts) {
      if (p.inlineData?.data) {
        return {
          buffer: Buffer.from(p.inlineData.data, "base64"),
          mimeType: p.inlineData.mimeType ?? "image/png",
        };
      }
    }
  }
  throw new Error(`Nano Banana returned no image. Raw: ${JSON.stringify(data).slice(0, 400)}`);
}

/**
 * Generate multiple images in parallel with a concurrency cap.
 * Returns results in the same order as prompts. Failed prompts throw.
 */
export async function generateImages(
  prompts: string[],
  opts: GenerateImageOptions & { concurrency?: number } = {}
): Promise<GeneratedImage[]> {
  const concurrency = opts.concurrency ?? 3;
  const results: GeneratedImage[] = new Array(prompts.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= prompts.length) return;
      results[idx] = await generateImage(prompts[idx], opts);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, prompts.length) }, worker));
  return results;
}
