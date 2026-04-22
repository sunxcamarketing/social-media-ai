import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readIdeas, readIdeasByClient, writeIdeas } from "@/lib/csv";

function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const ideas = clientId ? await readIdeasByClient(clientId) : await readIdeas();
  return NextResponse.json(ideas);
}

export async function POST(request: Request) {
  const body = await request.json();
  const clientId = body.clientId || "";
  const title = body.title || "";
  const normalized = normalizeTitle(title);

  const ideas = await readIdeas();

  if (clientId && normalized) {
    const dup = ideas.find(
      (i) => i.clientId === clientId && normalizeTitle(i.title) === normalized,
    );
    if (dup) return NextResponse.json(dup, { status: 200 });
  }

  const newIdea = {
    id: uuid(),
    clientId,
    title,
    description: body.description || "",
    contentType: body.contentType || "",
    status: body.status || "idea",
    createdAt: new Date().toISOString().split("T")[0],
  };
  ideas.push(newIdea);
  await writeIdeas(ideas);
  return NextResponse.json(newIdea, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const ideas = await readIdeas();
  const index = ideas.findIndex((i) => i.id === body.id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  ideas[index] = { ...ideas[index], ...body };
  await writeIdeas(ideas);
  return NextResponse.json(ideas[index]);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ideas = await readIdeas();
  await writeIdeas(ideas.filter((i) => i.id !== id));
  return NextResponse.json({ success: true });
}
