import { NextResponse } from "next/server";
import { readIdeasByClient } from "@/lib/csv";
import { supabase } from "@/lib/supabase";

function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "");
}

export async function POST(request: Request) {
  const { clientId } = await request.json();
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const clientIdeas = await readIdeasByClient(clientId);

  const groups = new Map<string, typeof clientIdeas>();
  for (const idea of clientIdeas) {
    const key = normalizeTitle(idea.title);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(idea);
  }

  const toDelete: string[] = [];
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const keeper = sorted[0];
    for (const idea of group) if (idea.id !== keeper.id) toDelete.push(idea.id);
  }

  if (toDelete.length === 0) {
    return NextResponse.json({ removed: 0, remaining: clientIdeas.length });
  }

  const { error } = await supabase.from("ideas").delete().in("id", toDelete);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    removed: toDelete.length,
    remaining: clientIdeas.length - toDelete.length,
  });
}
