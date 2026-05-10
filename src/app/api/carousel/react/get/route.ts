import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

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

  // Ownership: clients (and impersonate-admins) only see their own.
  const isClientView = user.role === "client" || !!user.impersonating;
  if (isClientView) {
    const effective = getEffectiveClientId(user);
    if (effective !== data.client_id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return Response.json({
    runId: data.run_id,
    clientId: data.client_id,
    topic: data.topic,
    tsxCode: data.tsx_code,
    styleGuideId: data.style_guide_id ?? null,
    sourceType: data.source_type ?? null,
    sourceId: data.source_id ?? null,
    meta: data.meta,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
