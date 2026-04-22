import { NextResponse } from "next/server";
import { readIdeasByClient, writeIdeas, readIdeas } from "@/lib/csv";

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

  const toDelete = new Set<string>();
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const keeper = sorted[0];
    for (const idea of group) if (idea.id !== keeper.id) toDelete.add(idea.id);
  }

  if (toDelete.size === 0) {
    return NextResponse.json({ removed: 0, remaining: clientIdeas.length });
  }

  const allIdeas = await readIdeas();
  const filtered = allIdeas.filter((i) => !toDelete.has(i.id));
  await writeIdeas(filtered);

  return NextResponse.json({
    removed: toDelete.size,
    remaining: clientIdeas.length - toDelete.size,
  });
}
