const GEMINI_UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const generateUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return key;
}

export async function uploadVideo(
  videoBuffer: Buffer,
  mimeType: string
): Promise<{ uri: string; mimeType: string }> {
  const key = getApiKey();

  const response = await fetch(`${GEMINI_UPLOAD_URL}?key=${key}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Command": "start, upload, finalize",
      "X-Goog-Upload-Header-Content-Length": String(videoBuffer.length),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": mimeType,
    },
    body: new Uint8Array(videoBuffer),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini upload error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const fileName = data.file.name; // e.g. "files/abc123"
  const fileUri = data.file.uri;
  const fileMimeType = data.file.mimeType;

  // Poll until file is ACTIVE (Gemini needs to process the upload)
  await waitForFileActive(fileName);

  return { uri: fileUri, mimeType: fileMimeType };
}

async function waitForFileActive(fileName: string, maxWaitMs = 120000): Promise<void> {
  const key = getApiKey();
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${key}`
    );

    if (!response.ok) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    const data = await response.json();
    const state = data.state;

    if (state === "ACTIVE") return;
    if (state === "FAILED") throw new Error(`Gemini file processing failed for ${fileName}`);

    // Still PROCESSING — wait and retry
    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error(`Gemini file ${fileName} did not become ACTIVE within ${maxWaitMs / 1000}s`);
}

export async function analyzeVideo(
  fileUri: string,
  mimeType: string,
  analysisPrompt: string,
  maxRetries = 3
): Promise<string> {
  const key = getApiKey();
  let lastError: unknown = null;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(`${generateUrl(model)}?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { fileData: { fileUri, mimeType } },
                  { text: analysisPrompt },
                ],
              },
            ],
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          const err = new Error(`Gemini analysis error ${response.status} (${model}): ${text}`);
          // Retry only on overload/rate-limit; otherwise fail fast
          if (response.status !== 503 && response.status !== 429) throw err;
          lastError = err;
          const backoff = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const hashIndex = text.indexOf("#");
        return hashIndex >= 0 ? text.substring(hashIndex) : text;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          const backoff = 2000 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini analysis failed after retries");
}
