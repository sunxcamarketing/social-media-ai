import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { supabase } from "@/lib/supabase";
import { readScripts, readScriptsByClient } from "@/lib/csv";
import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";
import { saveScriptEmbedding } from "@/lib/embeddings";

// Fields a client may edit on a released script via the portal. Anything else
// (pillar, post_type, status, source, …) is admin-only.
const CLIENT_EDITABLE_FIELDS = ["title", "textHook", "hook", "body", "cta"] as const;
type ClientEditableField = (typeof CLIENT_EDITABLE_FIELDS)[number];

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  // Admin pages always pass an explicit ?clientId — honour that over the
  // impersonate cookie so admins viewing /clients/[X]/* never see another
  // client's data just because they previously clicked "Als Y ansehen".
  if (user.role === "admin" && clientId) {
    const scripts = await readScriptsByClient(clientId);
    return NextResponse.json(scripts);
  }

  // Real clients OR admins inside /portal/* (no clientId param): scope to
  // the effective client and hide drafts so the preview matches what the
  // client actually sees.
  const isClientView = user.role === "client" || !!user.impersonating;
  if (isClientView) {
    const effectiveId = getEffectiveClientId(user);
    if (!effectiveId) return NextResponse.json([]);
    const scripts = await readScriptsByClient(effectiveId, { releasedOnly: true });
    return NextResponse.json(scripts);
  }

  // Admin without clientId param and not impersonating: global view.
  const scripts = await readScripts();
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
    pattern_type: body.patternType || "",
    post_type: body.postType || "",
    anchor_ref: body.anchorRef || "",
    cta_type: body.ctaType || "",
    funnel_stage: body.funnelStage || "",
    created_at: new Date().toISOString().split("T")[0],
  };
  const { data, error } = await supabase.from("scripts").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Fire-and-forget: persist title embedding for future semantic dup-check
  if (row.title && row.client_id) {
    saveScriptEmbedding(row.id, row.client_id, row.title).catch(() => {});
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Map camelCase → snake_case for any provided fields. Then we'll filter
  // this map down to what the caller is actually allowed to write.
  const patch: Record<string, unknown> = {};
  if (rest.title !== undefined) patch.title = rest.title;
  if (rest.pillar !== undefined) patch.pillar = rest.pillar;
  if (rest.contentType !== undefined) patch.content_type = rest.contentType;
  if (rest.format !== undefined) patch.format = rest.format;
  if (rest.hook !== undefined) patch.hook = rest.hook;
  if (rest.hookPattern !== undefined) patch.hook_pattern = rest.hookPattern;
  if (rest.textHook !== undefined) patch.text_hook = rest.textHook;
  if (rest.visualHook !== undefined) patch.visual_hook = rest.visualHook;
  if (rest.body !== undefined) patch.body = rest.body;
  if (rest.cta !== undefined) patch.cta = rest.cta;
  if (rest.bRoll !== undefined) patch.b_roll = rest.bRoll;
  if (rest.caption !== undefined) patch.caption = rest.caption;
  if (rest.status !== undefined) patch.status = rest.status;
  if (rest.source !== undefined) patch.source = rest.source;
  if (rest.shotList !== undefined) patch.shot_list = rest.shotList;
  if (rest.patternType !== undefined) patch.pattern_type = rest.patternType;
  if (rest.postType !== undefined) patch.post_type = rest.postType;
  if (rest.anchorRef !== undefined) patch.anchor_ref = rest.anchorRef;
  if (rest.ctaType !== undefined) patch.cta_type = rest.ctaType;
  if (rest.funnelStage !== undefined) patch.funnel_stage = rest.funnelStage;

  if (user.role === "client") {
    // Look up the script to enforce ownership + release-gate.
    const { data: existing, error: readErr } = await supabase
      .from("scripts")
      .select("client_id, released_at")
      .eq("id", id)
      .single();
    if (readErr || !existing) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }
    if (existing.client_id !== getEffectiveClientId(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!existing.released_at) {
      return NextResponse.json({ error: "Script noch nicht freigegeben" }, { status: 403 });
    }

    // Restrict to the client-editable allowlist + tag the edit timestamp.
    const allowed: Record<string, unknown> = {};
    const fieldMap: Record<ClientEditableField, string> = {
      title: "title",
      textHook: "text_hook",
      hook: "hook",
      body: "body",
      cta: "cta",
    };
    for (const f of CLIENT_EDITABLE_FIELDS) {
      const dbCol = fieldMap[f];
      if (patch[dbCol] !== undefined) allowed[dbCol] = patch[dbCol];
    }
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "Keine erlaubten Felder im Update" }, { status: 400 });
    }
    allowed.client_edited_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("scripts").update(allowed).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Admin: full update.
  const { data, error } = await supabase.from("scripts").update(patch).eq("id", id).select().single();
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
