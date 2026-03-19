import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readCreators, writeCreators } from "@/lib/csv";
import { scrapeCreatorStats } from "@/lib/apify";
import type { Creator } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  let creators = readCreators();
  if (category) creators = creators.filter((c) => c.category === category);
  return NextResponse.json(creators);
}

export async function POST(request: Request) {
  const body = await request.json();
  const creators = readCreators();

  const newCreator: Creator = {
    id: uuid(),
    username: body.username,
    category: body.category,
    profilePicUrl: "",
    followers: 0,
    reelsCount30d: 0,
    avgViews30d: 0,
    lastScrapedAt: "",
  };

  // Scrape stats in the background — save immediately, then update
  creators.push(newCreator);
  writeCreators(creators);

  // Try to scrape stats (non-blocking for the response)
  try {
    const stats = await scrapeCreatorStats(body.username);
    const updated = readCreators();
    const idx = updated.findIndex((c) => c.id === newCreator.id);
    if (idx !== -1) {
      updated[idx] = {
        ...updated[idx],
        profilePicUrl: stats.profilePicUrl,
        followers: stats.followers,
        reelsCount30d: stats.reelsCount30d,
        avgViews30d: stats.avgViews30d,
        lastScrapedAt: new Date().toISOString(),
      };
      writeCreators(updated);
      return NextResponse.json(updated[idx], { status: 201 });
    }
  } catch (err) {
    console.error(`Failed to scrape stats for @${body.username}:`, err);
  }

  return NextResponse.json(newCreator, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const creators = readCreators();
  const index = creators.findIndex((c) => c.id === body.id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  creators[index] = { ...creators[index], ...body };
  writeCreators(creators);
  return NextResponse.json(creators[index]);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const creators = readCreators();
  const filtered = creators.filter((c) => c.id !== id);
  writeCreators(filtered);
  return NextResponse.json({ success: true });
}
