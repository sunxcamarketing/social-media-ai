import { NextResponse } from "next/server";
import { readVideo } from "@/lib/csv";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const video = await readVideo(id);
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(video);
}
