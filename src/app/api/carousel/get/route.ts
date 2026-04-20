import { readdirSync, existsSync } from "fs";
import { join } from "path";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Load a single saved carousel with its current slide files.
 * Admin-only. Returns result shape compatible with the carousel page's CompleteResult.
 * GET /api/carousel/get?runId=xxx
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");
  if (!runId) {
    return new Response(JSON.stringify({ error: "runId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Sanitize path segments
  if (runId.includes("..") || runId.includes("/") || runId.includes("\\")) {
    return new Response(JSON.stringify({ error: "Invalid runId" }), { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("carousels")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!row) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  // Scan disk for the slide files that still exist
  const slidesDir = join(process.cwd(), "output", "carousels", runId, "slides");
  const slideFiles: string[] = [];
  if (existsSync(slidesDir)) {
    const files = readdirSync(slidesDir)
      .filter((f) => /^slide-\d+\.png$/i.test(f))
      .sort();
    for (const f of files) slideFiles.push(`slides/${f}`);
  }

  const meta = (row.meta ?? {}) as Record<string, unknown>;
  return Response.json({
    runId: row.run_id,
    clientId: row.client_id,
    topic: row.topic,
    styleId: row.style_id,
    handle: row.handle,
    slideCount: row.slide_count,
    slideFiles,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photoCount: Number(meta.photoCount ?? 0),
    generatedImages: Number(meta.generatedImages ?? 0),
    tokensIn: Number(meta.tokensIn ?? 0),
    tokensOut: Number(meta.tokensOut ?? 0),
    durationMs: Number(meta.durationMs ?? 0),
  });
}
