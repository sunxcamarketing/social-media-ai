import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/** POST — attach client feedback to a voice session.
 *  Body: { rating: 1-5, comment?: string }
 *  The session id is in the URL. We look up the session's client_id and
 *  verify the caller owns it (admins pass through). Idempotent: re-submitting
 *  overwrites the previous rating/comment so the user can correct themselves
 *  before they navigate away. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = await params;
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const rating = Number(body?.rating);
  const commentRaw = typeof body?.comment === "string" ? body.comment.trim().slice(0, 2000) : null;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be an integer 1-5" }, { status: 400 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("voice_sessions")
    .select("client_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  if (user.role === "client" && user.clientId !== row.client_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("voice_sessions")
    .update({
      feedback_rating: rating,
      feedback_comment: commentRaw && commentRaw.length > 0 ? commentRaw : null,
      feedback_submitted_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
