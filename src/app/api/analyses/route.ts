import { NextResponse } from "next/server";
import { readAnalyses, writeAnalyses } from "@/lib/csv";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const analyses = await readAnalyses();
  return NextResponse.json(analyses);
}

export async function POST(request: Request) {
  const body = await request.json();
  const analyses = await readAnalyses();

  const newAnalysis = {
    id: uuidv4(),
    clientId: body.clientId || "",
    instagramHandle: body.instagramHandle || "",
    lang: body.lang || "de",
    report: body.report || "",
    profileFollowers: body.profileFollowers || 0,
    profileReels30d: body.profileReels30d || 0,
    profileAvgViews30d: body.profileAvgViews30d || 0,
    profilePicUrl: body.profilePicUrl || "",
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

  const analyses = await readAnalyses();
  const filtered = analyses.filter((a) => a.id !== id);
  await writeAnalyses(filtered);

  return NextResponse.json({ ok: true });
}
