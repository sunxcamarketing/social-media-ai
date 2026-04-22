import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days") || 30)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("api_costs")
    .select("client_id, provider, operation, cost_usd, initiator, created_at")
    .gte("created_at", since);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type CostRow = { client_id: string | null; provider: string; operation: string; cost_usd: number | string; initiator: "admin" | "client"; created_at: string };
  const rows = (data || []) as CostRow[];

  let adminTotal = 0;
  let clientTotal = 0;
  const byClient: Record<string, { admin: number; client: number; total: number }> = {};
  const byOperation: Record<string, number> = {};
  const byProvider: Record<string, number> = {};

  for (const row of rows) {
    const cost = Number(row.cost_usd);
    const cid = row.client_id || "__global__";

    if (!byClient[cid]) byClient[cid] = { admin: 0, client: 0, total: 0 };
    byClient[cid][row.initiator] += cost;
    byClient[cid].total += cost;

    if (row.initiator === "admin") adminTotal += cost;
    else clientTotal += cost;

    byOperation[row.operation] = (byOperation[row.operation] || 0) + cost;
    byProvider[row.provider] = (byProvider[row.provider] || 0) + cost;
  }

  return NextResponse.json({
    days,
    entryCount: rows.length,
    adminTotal,
    clientTotal,
    grandTotal: adminTotal + clientTotal,
    byClient,
    byOperation,
    byProvider,
  });
}
