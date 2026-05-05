import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// Story strategies are now created by the Content Agent via the
// `save_story_strategy` tool — the old generate endpoint is gone.

// ── GET: list story strategies for this client (newest first) ────────────

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("story_strategies")
    .select("id, content, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// ── PATCH: replace content (full JSON) for one strategy ─────────────────

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const strategyId = String(body.strategyId || "").trim();
  const content = body.content;
  if (!strategyId) return NextResponse.json({ error: "strategyId required" }, { status: 400 });
  if (!content || typeof content !== "object") {
    return NextResponse.json({ error: "content must be an object" }, { status: 400 });
  }

  const { error } = await supabase
    .from("story_strategies")
    .update({ content })
    .eq("id", strategyId)
    .eq("client_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── DELETE: remove a story strategy by ?strategyId=… ─────────────────────

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const strategyId = url.searchParams.get("strategyId");
  if (!strategyId) return NextResponse.json({ error: "strategyId required" }, { status: 400 });

  const { error } = await supabase
    .from("story_strategies")
    .delete()
    .eq("id", strategyId)
    .eq("client_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
