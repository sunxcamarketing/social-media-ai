import { requireAdmin } from "@/lib/auth";
import { sendEvent, sseResponse } from "@/lib/sse";
import { runCarouselPipeline } from "@/lib/carousel/pipeline";

export const maxDuration = 600;

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const form = await request.formData();
  const clientId = String(form.get("clientId") || "");
  const topic = String(form.get("topic") || "").trim();
  const styleId = String(form.get("styleId") || "02-split-screen");
  const handleOverride = (form.get("handle") as string | null)?.trim() || undefined;

  if (!clientId || !topic) {
    return new Response(JSON.stringify({ error: "clientId und topic sind Pflicht" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Collect uploaded photos
  const additionalPhotos: Array<{ filename: string; buffer: Buffer }> = [];
  for (const [key, value] of form.entries()) {
    if (key.startsWith("photo_") && value instanceof File) {
      const ab = await value.arrayBuffer();
      additionalPhotos.push({ filename: value.name, buffer: Buffer.from(ab) });
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await runCarouselPipeline({
          clientId,
          topic,
          styleId,
          handleOverride,
          additionalPhotos,
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
