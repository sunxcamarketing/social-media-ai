import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import type { CarouselStyleGuide } from "@/lib/types";

interface DbRow {
  id: string;
  client_id: string | null;
  name: string;
  prompt: string;
  created_at: string;
  updated_at: string;
}

function dbRowToGuide(r: DbRow): CarouselStyleGuide {
  return {
    id: r.id,
    clientId: r.client_id,
    name: r.name,
    prompt: r.prompt,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── PUT: update name / prompt / scope ──────────────────────────────────────

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.prompt === "string") update.prompt = body.prompt.trim();
  // clientId can be set to a specific id, null (global), or omitted (untouched).
  if (Object.prototype.hasOwnProperty.call(body, "clientId")) {
    update.client_id =
      typeof body.clientId === "string" && body.clientId.trim().length > 0
        ? body.clientId.trim()
        : null;
  }

  if (typeof update.name === "string" && update.name === "") {
    return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
  }
  if (typeof update.prompt === "string" && update.prompt === "") {
    return NextResponse.json({ error: "Prompt fehlt" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("carousel_style_guides")
    .update(update)
    .eq("id", id)
    .select("id, client_id, name, prompt, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(dbRowToGuide(data as DbRow));
}

// ── DELETE ─────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const { id } = await params;
  const { error } = await supabase
    .from("carousel_style_guides")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
