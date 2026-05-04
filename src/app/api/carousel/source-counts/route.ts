import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// Returns a map of "<type>:<id>" → count for all carousels linked to a script
// or idea of the given client. Single round-trip the Scripts/Ideas pages can
// use to render "🎨 N" badges per row without N+1 queries.

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const requestedClientId = url.searchParams.get("clientId");

  // Clients can only ever see their own data; admins can scope by query.
  const isClientView = user.role === "client" || !!user.impersonating;
  const clientId = isClientView
    ? getEffectiveClientId(user)
    : requestedClientId;
  if (!clientId) return Response.json({});

  const { data, error } = await supabase
    .from("carousels")
    .select("source_type, source_id")
    .eq("client_id", clientId)
    .not("source_id", "is", null);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    if (!row.source_type || !row.source_id) continue;
    const key = `${row.source_type}:${row.source_id}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Response.json(counts);
}
