import { NextResponse } from "next/server";
import { readAnalyses, readAnalysesByClient, writeAnalyses } from "@/lib/csv";
import { v4 as uuidv4 } from "uuid";
import { persistImage } from "@/lib/persist-image";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");

  // Clients can only see their own analyses
  if (user.role === "client") {
    clientId = user.clientId;
  } else if (user.impersonatingClientId && !clientId) {
    clientId = user.impersonatingClientId;
  }

  const analyses = clientId ? await readAnalysesByClient(clientId) : await readAnalyses();
  return NextResponse.json(analyses);
}

export async function POST(request: Request) {
  const body = await request.json();

  const analysisId = uuidv4();
  const permanentPicUrl = await persistImage(body.profilePicUrl || "", "analyses", analysisId);

  const { supabase } = await import("@/lib/supabase");
  const row = {
    id: analysisId,
    client_id: body.clientId || "",
    instagram_handle: body.instagramHandle || "",
    lang: body.lang || "de",
    report: body.report || "",
    profile_followers: body.profileFollowers || 0,
    profile_reels_30d: body.profileReels30d || 0,
    profile_avg_views_30d: body.profileAvgViews30d || 0,
    profile_pic_url: permanentPicUrl,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("analyses").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Invalidate cache
  const { invalidateAnalysesCache } = await import("@/lib/csv");
  invalidateAnalysesCache();

  return NextResponse.json({
    id: analysisId,
    clientId: body.clientId || "",
    instagramHandle: body.instagramHandle || "",
    lang: body.lang || "de",
    report: body.report || "",
    profileFollowers: body.profileFollowers || 0,
    profileReels30d: body.profileReels30d || 0,
    profileAvgViews30d: body.profileAvgViews30d || 0,
    profilePicUrl: permanentPicUrl,
    createdAt: row.created_at,
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { supabase } = await import("@/lib/supabase");
  const { error } = await supabase.from("analyses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
