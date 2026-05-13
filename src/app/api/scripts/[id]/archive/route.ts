import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";

// Toggle a script's archived state. Body: { archived: true | false }.
// archived=true  → set archived_at = NOW(), hidden from main table, shown in archive view
// archived=false → set archived_at = NULL,  back in main table
// Admin: can archive/unarchive any script.
// Client: can archive/unarchive only their own released scripts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const archive = body.archived !== false; // default = archive

  if (user.role === "client") {
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
  }

  const archivedAt = archive ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("scripts")
    .update({ archived_at: archivedAt })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, archivedAt });
}
