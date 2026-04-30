import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

// Toggle a script's release state. Body: { released: true | false }.
// released=true  → set released_at = NOW(),   visible in the client portal
// released=false → set released_at = NULL,    hidden again (admin draft)
export async function PATCH(
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
  const release = body.released !== false; // default = release

  const releasedAt = release ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("scripts")
    .update({ released_at: releasedAt })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, releasedAt });
}
