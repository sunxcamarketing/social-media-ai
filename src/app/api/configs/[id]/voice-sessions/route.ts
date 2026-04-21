import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/** GET — list voice sessions for a client, with their transcripts normalized.
 *  Legacy rows stored the transcript as a JSON-stringified string (instead of
 *  a JSONB array). We parse those back to arrays so the UI gets a uniform shape. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (user.role === "client" && user.clientId !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("voice_sessions")
    .select("id, transcript, ideas_generated, duration_seconds, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sessions = (data || []).map((s) => {
    let transcript: Array<{ role: string; text: string; timestamp?: string }> = [];
    if (Array.isArray(s.transcript)) {
      transcript = s.transcript;
    } else if (typeof s.transcript === "string" && s.transcript.length > 0) {
      try { transcript = JSON.parse(s.transcript); } catch { transcript = []; }
    }
    const userTurns = transcript.filter((e) => e.role === "user").length;
    const modelTurns = transcript.filter((e) => e.role === "model").length;
    const totalChars = transcript.reduce((n, e) => n + (e.text?.length || 0), 0);
    return {
      id: s.id,
      createdAt: s.created_at,
      durationSeconds: s.duration_seconds,
      ideasGenerated: s.ideas_generated,
      userTurns,
      modelTurns,
      totalChars,
      transcript,
    };
  });

  return NextResponse.json({ sessions });
}
