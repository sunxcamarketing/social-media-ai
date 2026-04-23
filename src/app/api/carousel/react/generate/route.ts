import { requireAdmin } from "@/lib/auth";
import { sendEvent, sseResponse } from "@/lib/sse";
import { runCarouselReactPipeline } from "@/lib/carousel/react-pipeline";
import { supabase } from "@/lib/supabase";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const body = await request.json().catch(() => ({}));
  const clientId = String(body.clientId || "");
  const topic = String(body.topic || "").trim();

  if (!clientId || !topic) {
    return Response.json({ error: "clientId und topic sind Pflicht" }, { status: 400 });
  }

  const runId = `${clientId}_react_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await runCarouselReactPipeline({
          clientId,
          topic,
          onProgress: (ev) => sendEvent(controller, ev as unknown as Record<string, unknown>),
        });

        // Persist to DB so the carousel shows up in the history.
        try {
          await supabase.from("carousels").upsert(
            {
              id: runId,
              client_id: clientId,
              run_id: runId,
              topic,
              style_id: "",
              handle: "",
              type: "react",
              tsx_code: result.tsxCode,
              slide_count: 0, // unknown until rendered client-side
              meta: {
                tokensIn: result.tokensIn,
                tokensOut: result.tokensOut,
                durationMs: result.durationMs,
                chars: result.tsxCode.length,
              },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "run_id" },
          );
        } catch (err) {
          console.error("[carousel/react] failed to persist:", (err as Error).message);
        }

        sendEvent(controller, {
          stage: "complete",
          status: "done",
          result: {
            runId,
            tsxCode: result.tsxCode,
            topic: result.topic,
            clientId: result.clientId,
            tokensIn: result.tokensIn,
            tokensOut: result.tokensOut,
            durationMs: result.durationMs,
          },
        });
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
