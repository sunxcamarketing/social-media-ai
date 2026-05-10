import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// Returns the carousel-quota state for a client: the configured monthly
// limit and the count of carousels created since the start of the month.
// UI renders "X / N" badge and disables the generate button at the cap.

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  let clientId = url.searchParams.get("clientId");

  const isClientView = user.role === "client" || !!user.impersonating;
  if (isClientView) {
    clientId = getEffectiveClientId(user);
  }
  if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 });

  const { data: cfg } = await supabase
    .from("configs")
    .select(`"carouselQuotaMonthly"`)
    .eq("id", clientId)
    .single();
  const limit = cfg?.carouselQuotaMonthly ?? 10;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("carousels")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("created_at", monthStart.toISOString());
  const used = count || 0;

  return Response.json({ limit, used, remaining: Math.max(0, limit - used) });
}
