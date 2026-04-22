import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";

const STATUSES = ["approved", "rejected", "revision_requested"] as const;
type FeedbackStatus = (typeof STATUSES)[number];

function isValidStatus(v: unknown): v is FeedbackStatus {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const status = body.status;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const clearing = status === null || status === undefined;

  if (!clearing && !isValidStatus(status)) {
    return NextResponse.json({ error: "status must be approved | rejected | revision_requested" }, { status: 400 });
  }
  if ((status === "rejected" || status === "revision_requested") && !text) {
    return NextResponse.json({ error: "text is required for rejected / revision_requested" }, { status: 400 });
  }

  // Scope check: clients can only feedback their own scripts.
  const { data: existing, error: readErr } = await supabase
    .from("scripts")
    .select("id, client_id")
    .eq("id", id)
    .single();

  if (readErr || !existing) {
    return NextResponse.json({ error: "Script not found" }, { status: 404 });
  }

  const effectiveClientId = getEffectiveClientId(user);
  if (user.role === "client" && effectiveClientId !== existing.client_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch = clearing
    ? {
        client_feedback_status: null,
        client_feedback_text: null,
        client_feedback_at: null,
      }
    : {
        client_feedback_status: status,
        client_feedback_text: text || null,
        client_feedback_at: new Date().toISOString(),
      };

  const { error: updErr } = await supabase.from("scripts").update(patch).eq("id", id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...patch });
}
