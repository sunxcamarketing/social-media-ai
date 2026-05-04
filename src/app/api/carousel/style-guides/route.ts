import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
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

// ── GET: list global guides + optional client-scoped guides ────────────────
//
// Query params:
//   ?clientId=<id>  → returns globals + that client's guides (admin sees both
//                     buckets so the picker can show "Global" vs the client).
//   (no clientId)   → returns only global guides.

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");

  let query = supabase
    .from("carousel_style_guides")
    .select("id, client_id, name, prompt, created_at, updated_at")
    .order("name", { ascending: true });

  // Globals (client_id IS NULL) plus optionally a specific client's guides.
  if (clientId) {
    query = query.or(`client_id.is.null,client_id.eq.${clientId}`);
  } else {
    query = query.is("client_id", null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json((data || []).map((r) => dbRowToGuide(r as DbRow)));
}

// ── POST: create a guide ───────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const prompt = String(body.prompt || "").trim();
  const clientId =
    typeof body.clientId === "string" && body.clientId.trim().length > 0
      ? body.clientId.trim()
      : null;

  if (!name) return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "Prompt fehlt" }, { status: 400 });

  const { data, error } = await supabase
    .from("carousel_style_guides")
    .insert({ name, prompt, client_id: clientId })
    .select("id, client_id, name, prompt, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(dbRowToGuide(data as DbRow));
}
