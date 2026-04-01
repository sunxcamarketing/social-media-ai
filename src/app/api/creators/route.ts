import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readCreators, insertCreator, updateCreator, deleteCreator } from "@/lib/csv";
import { scrapeCreatorStats } from "@/lib/apify";
import { persistImage } from "@/lib/persist-image";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  let creators = await readCreators();
  if (category) creators = creators.filter((c) => c.category === category);
  return NextResponse.json(creators);
}

export async function POST(request: Request) {
  const body = await request.json();

  const id = uuid();
  const row = {
    id,
    username: body.username,
    category: body.category,
    profile_pic_url: body.profilePicUrl || "",
    followers: body.followers || 0,
    reels_count_30d: 0,
    avg_views_30d: 0,
    last_scraped_at: null,
  };

  await insertCreator(row);

  // Return camelCase shape for the frontend
  const newCreator = {
    id,
    username: body.username,
    category: body.category,
    profilePicUrl: body.profilePicUrl || "",
    followers: body.followers || 0,
    reelsCount30d: 0,
    avgViews30d: 0,
    lastScrapedAt: "",
  };

  // Scrape full stats in the background — don't block the response
  scrapeCreatorStats(body.username).then(async (stats) => {
    try {
      const permanentPic = await persistImage(
        stats.profilePicUrl || row.profile_pic_url,
        "creators",
        id,
      );
      await updateCreator(id, {
        profile_pic_url: permanentPic,
        followers: stats.followers,
        reels_count_30d: stats.reelsCount30d,
        avg_views_30d: stats.avgViews30d,
        last_scraped_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Failed to update stats for @${body.username}:`, err);
    }
  }).catch((err) => {
    console.error(`Failed to scrape stats for @${body.username}:`, err);
  });

  return NextResponse.json(newCreator, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Map camelCase fields to snake_case for Supabase
  const fields: Record<string, unknown> = {};
  if (body.username !== undefined) fields.username = body.username;
  if (body.category !== undefined) fields.category = body.category;
  if (body.profilePicUrl !== undefined) fields.profile_pic_url = body.profilePicUrl;
  if (body.followers !== undefined) fields.followers = body.followers;
  if (body.reelsCount30d !== undefined) fields.reels_count_30d = body.reelsCount30d;
  if (body.avgViews30d !== undefined) fields.avg_views_30d = body.avgViews30d;
  if (body.lastScrapedAt !== undefined) fields.last_scraped_at = body.lastScrapedAt;

  await updateCreator(body.id, fields);

  // Read back the updated creator to return it
  const creators = await readCreators();
  const updated = creators.find((c) => c.id === body.id);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteCreator(id);
  return NextResponse.json({ success: true });
}
