import { requireAdmin } from "@/lib/auth";
import { sendEvent, sseResponse } from "@/lib/sse";
import { regenerateCarousel } from "@/lib/carousel/pipeline";

export const maxDuration = 600;

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const form = await request.formData();
  const runId = String(form.get("runId") || "").trim();
  const clientId = String(form.get("clientId") || "").trim();
  const feedback = String(form.get("feedback") || "").trim();
  const slideIndexRaw = form.get("slideIndex");
  const slideIndex = slideIndexRaw === null || slideIndexRaw === ""
    ? null
    : Number(slideIndexRaw);

  if (!runId || !clientId) {
    return new Response(JSON.stringify({ error: "runId and clientId are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Optional replacement image
  let replacementImage: { filename: string; buffer: Buffer } | undefined;
  const imgFile = form.get("replacementImage");
  if (imgFile instanceof File) {
    const ab = await imgFile.arrayBuffer();
    replacementImage = { filename: imgFile.name, buffer: Buffer.from(ab) };
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await regenerateCarousel({
          runId,
          clientId,
          feedback,
          slideIndex: slideIndex !== null && !isNaN(slideIndex) ? slideIndex : null,
          replacementImage,
          onProgress: (ev) => {
            sendEvent(controller, ev as unknown as Record<string, unknown>);
          },
        });
        sendEvent(controller, { stage: "complete", status: "done", result });
      } catch (err) {
        sendEvent(controller, {
          stage: "error",
          status: "error",
          message: (err as Error).message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
