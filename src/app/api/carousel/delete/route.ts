import { rmSync, existsSync } from "fs";
import { join } from "path";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Delete a saved carousel (DB row + filesystem directory). Admin-only.
 * DELETE /api/carousel/delete?runId=xxx
 */
export async function DELETE(request: Request) {
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
  if (runId.includes("..") || runId.includes("/") || runId.includes("\\")) {
    return new Response(JSON.stringify({ error: "Invalid runId" }), { status: 400 });
  }

  const { error } = await supabase.from("carousels").delete().eq("run_id", runId);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Also remove on-disk files
  const runDir = join(process.cwd(), "output", "carousels", runId);
  if (existsSync(runDir)) {
    try {
      rmSync(runDir, { recursive: true, force: true });
    } catch (err) {
      console.error("[carousel delete] fs removal failed:", (err as Error).message);
    }
  }

  return Response.json({ success: true });
}
