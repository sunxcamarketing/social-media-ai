import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readIdeas, readIdeasByClient } from "@/lib/csv";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";

function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "");
}

/** For client users and impersonating admins the clientId is forced. */
async function resolveWritableClientId(requested: string): Promise<{ ok: true; clientId: string } | { ok: false; status: number; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  if (user.role === "client") {
    if (!user.clientId) return { ok: false, status: 403, error: "Forbidden" };
    return { ok: true, clientId: user.clientId };
  }

  // Admin: impersonation forces the scope; otherwise accept the requested clientId.
  const effective = getEffectiveClientId(user);
  if (effective) return { ok: true, clientId: effective };
  if (!requested) return { ok: false, status: 400, error: "clientId required" };
  return { ok: true, clientId: requested };
}

async function assertIdeaAccess(id: string): Promise<{ ok: true; clientId: string } | { ok: false; status: number; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  const { data: row } = await supabase
    .from("ideas")
    .select("id, client_id")
    .eq("id", id)
    .single();
  if (!row) return { ok: false, status: 404, error: "Not found" };

  const effective = getEffectiveClientId(user);
  if (user.role === "client" && user.clientId !== row.client_id) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  if (user.role === "admin" && effective && effective !== row.client_id) {
    return { ok: false, status: 403, error: "Forbidden (impersonation scope)" };
  }
  return { ok: true, clientId: row.client_id };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");

  if (user.role === "client") clientId = user.clientId;
  else if (user.role === "admin") {
    const effective = getEffectiveClientId(user);
    if (effective) clientId = effective;
  }

  const ideas = clientId ? await readIdeasByClient(clientId) : await readIdeas();
  return NextResponse.json(ideas);
}

export async function POST(request: Request) {
  const body = await request.json();
  const title = (body.title || "") as string;
  const normalized = normalizeTitle(title);

  const scope = await resolveWritableClientId(body.clientId || "");
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const clientId = scope.clientId;

  if (normalized) {
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

  const access = await assertIdeaAccess(body.id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

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

  const access = await assertIdeaAccess(id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { error } = await supabase.from("ideas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
