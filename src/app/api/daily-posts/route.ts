import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";

interface DailyPostRow {
  client_id: string;
  date: string;
  posted_reel: boolean;
  posted_stories: boolean;
  posted_reel_at: string | null;
  posted_stories_at: string | null;
  note: string | null;
  updated_at: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function serialize(row: DailyPostRow | null, fallbackDate: string, fallbackClientId: string) {
  if (!row) {
    return {
      clientId: fallbackClientId,
      date: fallbackDate,
      postedReel: false,
      postedStories: false,
      postedReelAt: null,
      postedStoriesAt: null,
      note: "",
      updatedAt: null,
    };
  }
  return {
    clientId: row.client_id,
    date: row.date,
    postedReel: row.posted_reel,
    postedStories: row.posted_stories,
    postedReelAt: row.posted_reel_at,
    postedStoriesAt: row.posted_stories_at,
    note: row.note || "",
    updatedAt: row.updated_at,
  };
}

async function resolveScope(
  requestedClientId: string,
): Promise<{ ok: true; clientId: string; userId: string } | { ok: false; status: number; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  if (user.role === "client") {
    if (!user.clientId) return { ok: false, status: 403, error: "Forbidden" };
    return { ok: true, clientId: user.clientId, userId: user.id };
  }

  const effective = getEffectiveClientId(user);
  if (effective) return { ok: true, clientId: effective, userId: user.id };
  if (!requestedClientId) return { ok: false, status: 400, error: "clientId required" };
  return { ok: true, clientId: requestedClientId, userId: user.id };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedClient = searchParams.get("clientId") || "";
  const date = searchParams.get("date") || todayIso();

  const scope = await resolveScope(requestedClient);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await supabase
    .from("daily_posts")
    .select("*")
    .eq("client_id", scope.clientId)
    .eq("date", date)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(serialize(data as DailyPostRow | null, date, scope.clientId));
}

export async function PUT(request: Request) {
  const body = await request.json();
  const date = (body.date || todayIso()) as string;
  const requestedClient = (body.clientId || "") as string;

  const scope = await resolveScope(requestedClient);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data: existing } = await supabase
    .from("daily_posts")
    .select("*")
    .eq("client_id", scope.clientId)
    .eq("date", date)
    .maybeSingle();

  const now = new Date().toISOString();
  const nextReel = typeof body.postedReel === "boolean" ? body.postedReel : existing?.posted_reel ?? false;
  const nextStories = typeof body.postedStories === "boolean" ? body.postedStories : existing?.posted_stories ?? false;
  const nextNote = typeof body.note === "string" ? body.note : existing?.note ?? "";

  const row = {
    client_id: scope.clientId,
    date,
    posted_reel: nextReel,
    posted_stories: nextStories,
    posted_reel_at: nextReel
      ? existing?.posted_reel
        ? existing.posted_reel_at
        : now
      : null,
    posted_stories_at: nextStories
      ? existing?.posted_stories
        ? existing.posted_stories_at
        : now
      : null,
    note: nextNote,
    updated_by: scope.userId,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("daily_posts")
    .upsert(row, { onConflict: "client_id,date" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(serialize(data as DailyPostRow, date, scope.clientId));
}
