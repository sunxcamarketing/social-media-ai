import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  let clientId = url.searchParams.get("clientId");

  // Clients (and admins viewing via impersonate) are scoped to their own
  // effective client. Real admins use the query param.
  const isClientView = user.role === "client" || !!user.impersonating;
  if (isClientView) {
    clientId = getEffectiveClientId(user);
  }
  if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 });

  const { data, error } = await supabase
    .from("carousels")
    .select("id, run_id, topic, slide_count, meta, source_type, source_id, created_at, updated_at")
    .eq("client_id", clientId)
    .eq("type", "react")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ carousels: data || [] });
}
