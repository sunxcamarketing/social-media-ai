import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { supabase } from "@/lib/supabase";
import { readScripts, readScriptsByClient } from "@/lib/csv";
import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");

  // Clients can only see their own scripts
  if (user.role === "client") {
    clientId = user.clientId;
  }

  const scripts = clientId ? await readScriptsByClient(clientId) : await readScripts();
  return NextResponse.json(scripts);
}

export async function POST(request: Request) {
  const body = await request.json();
  const row = {
    id: uuid(),
    client_id: body.clientId || "",
    title: body.title || "",
    pillar: body.pillar || "",
    content_type: body.contentType || "",
    format: body.format || "",
    hook: body.hook || "",
    hook_pattern: body.hookPattern || "",
    text_hook: body.textHook || "",
    body: body.body || "",
    cta: body.cta || "",
    status: body.status || "entwurf",
    source: body.source || "",
    shot_list: body.shotList || "",
    created_at: new Date().toISOString().split("T")[0],
  };
  const { data, error } = await supabase.from("scripts").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Map camelCase to snake_case for any fields provided
  const update: Record<string, unknown> = {};
  if (rest.title !== undefined) update.title = rest.title;
  if (rest.pillar !== undefined) update.pillar = rest.pillar;
  if (rest.contentType !== undefined) update.content_type = rest.contentType;
  if (rest.format !== undefined) update.format = rest.format;
  if (rest.hook !== undefined) update.hook = rest.hook;
  if (rest.hookPattern !== undefined) update.hook_pattern = rest.hookPattern;
  if (rest.textHook !== undefined) update.text_hook = rest.textHook;
  if (rest.body !== undefined) update.body = rest.body;
  if (rest.cta !== undefined) update.cta = rest.cta;
  if (rest.status !== undefined) update.status = rest.status;
  if (rest.source !== undefined) update.source = rest.source;
  if (rest.shotList !== undefined) update.shot_list = rest.shotList;

  const { data, error } = await supabase.from("scripts").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("id");
  if (!ids) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Support deleting multiple IDs at once: ?id=abc,def,ghi
  const idList = ids.split(",").map(s => s.trim()).filter(Boolean);
  const { error } = await supabase.from("scripts").delete().in("id", idList);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, deleted: idList.length });
}
