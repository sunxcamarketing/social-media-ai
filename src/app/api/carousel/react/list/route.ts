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
  const clientId = url.searchParams.get("clientId");
  if (!clientId) {
    return Response.json({ error: "clientId required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("carousels")
    .select("id, run_id, topic, slide_count, meta, created_at, updated_at")
    .eq("client_id", clientId)
    .eq("type", "react")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ carousels: data || [] });
}
