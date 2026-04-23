import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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
    return Response.json({ error: "runId required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("carousels")
    .delete()
    .eq("run_id", runId)
    .eq("type", "react");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
