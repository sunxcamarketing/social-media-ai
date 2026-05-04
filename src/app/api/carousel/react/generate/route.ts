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
  const styleGuideId =
    typeof body.styleGuideId === "string" && body.styleGuideId.trim().length > 0
      ? body.styleGuideId.trim()
      : null;

  // Optional link to a source script or idea. We persist the pair so the
  // carousel library can show a "from: …" badge and the scripts/ideas pages
  // can show a reverse "N carousels from this" count.
  const sourceTypeRaw = typeof body.sourceType === "string" ? body.sourceType : "";
  const sourceType: "script" | "idea" | null =
    sourceTypeRaw === "script" || sourceTypeRaw === "idea" ? sourceTypeRaw : null;
  const sourceId =
    sourceType && typeof body.sourceId === "string" && body.sourceId.trim().length > 0
      ? body.sourceId.trim()
      : null;

  if (!clientId || !topic) {
    return Response.json({ error: "clientId und topic sind Pflicht" }, { status: 400 });
  }

  // Belt-and-suspenders: confirm the source row belongs to this client,
  // otherwise drop the link so we don't store cross-client references.
  let safeSourceType: "script" | "idea" | null = sourceType;
  let safeSourceId: string | null = sourceId;
  if (sourceType && sourceId) {
    const table = sourceType === "script" ? "scripts" : "ideas";
    const { data: source } = await supabase
      .from(table)
      .select("client_id")
      .eq("id", sourceId)
      .single();
    if (!source || source.client_id !== clientId) {
      safeSourceType = null;
      safeSourceId = null;
    }
  }

  const runId = `${clientId}_react_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await runCarouselReactPipeline({
          clientId,
          topic,
          styleGuideId,
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
              style_guide_id: styleGuideId,
              source_type: safeSourceType,
              source_id: safeSourceId,
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
