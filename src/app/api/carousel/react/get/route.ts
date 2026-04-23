import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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
    return Response.json({ error: "runId required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("carousels")
    .select("*")
    .eq("run_id", runId)
    .eq("type", "react")
    .single();

  if (error || !data) {
    return Response.json({ error: error?.message || "Not found" }, { status: 404 });
  }

  return Response.json({
    runId: data.run_id,
    clientId: data.client_id,
    topic: data.topic,
    tsxCode: data.tsx_code,
    meta: data.meta,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
