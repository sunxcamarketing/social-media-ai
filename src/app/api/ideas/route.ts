import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readIdeas, writeIdeas } from "@/lib/csv";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const ideas = readIdeas();
  return NextResponse.json(clientId ? ideas.filter((i) => i.clientId === clientId) : ideas);
}

export async function POST(request: Request) {
  const body = await request.json();
  const ideas = readIdeas();
  const newIdea = {
    id: uuid(),
    clientId: body.clientId || "",
    title: body.title || "",
    description: body.description || "",
    contentType: body.contentType || "",
    status: body.status || "idea",
    createdAt: new Date().toISOString().split("T")[0],
  };
  ideas.push(newIdea);
  writeIdeas(ideas);
  return NextResponse.json(newIdea, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const ideas = readIdeas();
  const index = ideas.findIndex((i) => i.id === body.id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  ideas[index] = { ...ideas[index], ...body };
  writeIdeas(ideas);
  return NextResponse.json(ideas[index]);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ideas = readIdeas();
  writeIdeas(ideas.filter((i) => i.id !== id));
  return NextResponse.json({ success: true });
}
