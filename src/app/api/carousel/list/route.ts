import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * List saved carousels for a client. Admin-only.
 * GET /api/carousel/list?clientId=xxx
 */
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
    return new Response(JSON.stringify({ error: "clientId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("carousels")
    .select("id, run_id, topic, style_id, handle, slide_count, meta, created_at, updated_at")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({ carousels: data ?? [] });
}
