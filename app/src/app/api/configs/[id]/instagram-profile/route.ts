import { NextResponse } from "next/server";
import { readConfigs } from "@/lib/csv";

export interface InstagramProfileData {
  username: string;
  fullName: string;
  bio: string;
  followers: number;
  following: number;
  postsCount: number;
  profilePicUrl: string;
  category: string;
  verified: boolean;
  externalUrl: string;
}

export const maxDuration = 30;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = readConfigs();
  const config = configs.find((c) => c.id === id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const handle = config.instagram;
  if (!handle) return NextResponse.json({ error: "No Instagram handle" }, { status: 400 });

  const token = process.env.APIFY_API_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_API_TOKEN not set" }, { status: 500 });

  const username = handle
    .replace(/^@/, "")
    .replace(/.*instagram\.com\//, "")
    .replace(/\/$/, "")
    .split("?")[0];

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: [`https://www.instagram.com/${username}/`],
          resultsType: "details",
          resultsLimit: 1,
        }),
        signal: AbortSignal.timeout(25000),
      }
    );

    if (!res.ok) return NextResponse.json({ error: "Apify error" }, { status: 502 });

    const data = await res.json();
    const p = data[0];
    if (!p) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const profile: InstagramProfileData = {
      username: p.username || username,
      fullName: p.fullName || "",
      bio: p.biography || "",
      followers: p.followersCount || 0,
      following: p.followsCount || 0,
      postsCount: p.mediaCount || p.postsCount || 0,
      profilePicUrl: p.profilePicUrl || p.profilePicUrlHD || "",
      category: p.businessCategoryName || "",
      verified: p.verified || false,
      externalUrl: p.externalUrl || "",
    };

    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
