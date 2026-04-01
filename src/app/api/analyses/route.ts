import { NextResponse } from "next/server";
import { readAnalyses, writeAnalyses } from "@/lib/csv";
import { v4 as uuidv4 } from "uuid";
import { persistImage } from "@/lib/persist-image";

export async function GET() {
  const analyses = await readAnalyses();
  return NextResponse.json(analyses);
}

export async function POST(request: Request) {
  const body = await request.json();
  const analyses = await readAnalyses();

  const analysisId = uuidv4();
  const permanentPicUrl = await persistImage(body.profilePicUrl || "", "analyses", analysisId);

  const newAnalysis = {
    id: analysisId,
    clientId: body.clientId || "",
    instagramHandle: body.instagramHandle || "",
    lang: body.lang || "de",
    report: body.report || "",
    profileFollowers: body.profileFollowers || 0,
    profileReels30d: body.profileReels30d || 0,
    profileAvgViews30d: body.profileAvgViews30d || 0,
    profilePicUrl: permanentPicUrl,
    createdAt: new Date().toISOString(),
  };

  analyses.push(newAnalysis);
  await writeAnalyses(analyses);

  return NextResponse.json(newAnalysis);
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
