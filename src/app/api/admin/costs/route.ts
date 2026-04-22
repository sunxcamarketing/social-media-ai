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
    .select("client_id, user_id, provider, operation, cost_usd, initiator, created_at")
    .gte("created_at", since);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type CostRow = {
    client_id: string | null;
    user_id: string | null;
    provider: string;
    operation: string;
    cost_usd: number | string;
    initiator: "admin" | "client";
    created_at: string;
  };
  const rows = (data || []) as CostRow[];

  let adminTotal = 0;
  let clientTotal = 0;
  const byClient: Record<string, { admin: number; client: number; total: number }> = {};
  const byOperation: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  // Per-admin-user breakdown: shows which specific admin (Aysun vs future team
  // members) burned what. Client-initiated spend is split separately — we
  // already track it at the client level (byClient above).
  const byAdminUser: Record<string, { total: number; calls: number }> = {};

  // Resolve admin user_ids → email via auth.users for readable labels.
  const adminUserIds = new Set<string>();
  for (const row of rows) {
    if (row.initiator === "admin" && row.user_id) adminUserIds.add(row.user_id);
  }
  const userLabels: Record<string, string> = {};
  if (adminUserIds.size > 0) {
    try {
      const { data: authUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const emailsById: Record<string, string> = {};
      for (const u of authUsers?.users || []) {
        if (u.id && u.email) emailsById[u.id] = u.email;
      }
      for (const id of adminUserIds) {
        userLabels[id] = emailsById[id] || id.slice(0, 8);
      }
    } catch (e) {
      // auth.admin listing may be rate-limited or perm-gated — fall back to ids.
      console.warn("[costs] admin user resolution failed:", e);
      for (const id of adminUserIds) userLabels[id] = id.slice(0, 8);
    }
  }

  for (const row of rows) {
    const cost = Number(row.cost_usd);
    const cid = row.client_id || "__global__";

    if (!byClient[cid]) byClient[cid] = { admin: 0, client: 0, total: 0 };
    byClient[cid][row.initiator] += cost;
    byClient[cid].total += cost;

    if (row.initiator === "admin") {
      adminTotal += cost;
      const uid = row.user_id || "__unknown_admin__";
      if (!byAdminUser[uid]) byAdminUser[uid] = { total: 0, calls: 0 };
      byAdminUser[uid].total += cost;
      byAdminUser[uid].calls += 1;
    } else {
      clientTotal += cost;
    }

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
    byAdminUser,
    userLabels,
  });
}
