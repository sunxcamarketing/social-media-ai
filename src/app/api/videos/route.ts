import { NextResponse } from "next/server";
import { readVideosList, updateVideo } from "@/lib/csv";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const configName = searchParams.get("configName");
  const creator = searchParams.get("creator");

  let videos = await readVideosList(configName || undefined);

  if (creator) videos = videos.filter((v) => v.creator === creator);

  // readVideosList already orders by date_added desc; apply secondary sort by views
  videos.sort((a, b) => {
    const dateDiff = (b.dateAdded || "").localeCompare(a.dateAdded || "");
    if (dateDiff !== 0) return dateDiff;
    return b.views - a.views;
  });

  return NextResponse.json(videos);
}

export async function PATCH(request: Request) {
  const { id, starred } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await updateVideo(id, { starred });
  return NextResponse.json({ success: true });
}
