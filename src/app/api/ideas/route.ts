import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readIdeas, readIdeasByClient } from "@/lib/csv";
import { supabase } from "@/lib/supabase";

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

  if (clientId && normalized) {
    const existing = await readIdeasByClient(clientId);
    const dup = existing.find((i) => normalizeTitle(i.title) === normalized);
    if (dup) return NextResponse.json(dup, { status: 200 });
  }

  const newIdea = {
    id: uuid(),
    client_id: clientId,
    title,
    description: body.description || "",
    content_type: body.contentType || "",
    status: body.status || "idea",
    created_at: new Date().toISOString().split("T")[0],
  };

  const { error } = await supabase.from("ideas").insert(newIdea);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id: newIdea.id,
    clientId,
    title,
    description: newIdea.description,
    contentType: newIdea.content_type,
    status: newIdea.status,
    createdAt: newIdea.created_at,
  }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.contentType !== undefined) patch.content_type = body.contentType;
  if (body.status !== undefined) patch.status = body.status;

  const { data, error } = await supabase
    .from("ideas")
    .update(patch)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    clientId: data.client_id,
    title: data.title,
    description: data.description,
    contentType: data.content_type,
    status: data.status,
    createdAt: data.created_at,
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("ideas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
