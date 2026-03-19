import { NextResponse } from "next/server";
import { readConfigs, writeConfigs } from "@/lib/csv";

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
  lastUpdated: string;
}

export const maxDuration = 30;

// GET — return cached profile from CSV (no Apify call)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = readConfigs();
  const config = configs.find((c) => c.id === id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!config.instagram) return NextResponse.json({ error: "No Instagram handle" }, { status: 400 });
  if (!config.igLastUpdated) return NextResponse.json({ error: "No cached profile" }, { status: 404 });

  return NextResponse.json({
    username: config.instagram.replace(/^@/, "").replace(/.*instagram\.com\//, "").replace(/\/$/, "").split("?")[0] || config.instagram,
    fullName: config.igFullName || "",
    bio: config.igBio || "",
    followers: parseInt(config.igFollowers || "0", 10),
    following: parseInt(config.igFollowing || "0", 10),
    postsCount: parseInt(config.igPostsCount || "0", 10),
    profilePicUrl: config.igProfilePicUrl || "",
    category: config.igCategory || "",
    verified: config.igVerified === "true",
    lastUpdated: config.igLastUpdated || "",
  } satisfies InstagramProfileData);
}

// POST — fetch fresh data from Apify and save to CSV
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = readConfigs();
  const index = configs.findIndex((c) => c.id === id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = configs[index];
  if (!config.instagram) return NextResponse.json({ error: "No Instagram handle" }, { status: 400 });

  const token = process.env.APIFY_API_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_API_TOKEN not set" }, { status: 500 });

  const username = config.instagram
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

    const lastUpdated = new Date().toISOString();

    // Save to CSV
    configs[index] = {
      ...config,
      igFullName: p.fullName || "",
      igBio: p.biography || "",
      igFollowers: String(p.followersCount || 0),
      igFollowing: String(p.followsCount || 0),
      igPostsCount: String(p.mediaCount || p.postsCount || 0),
      igProfilePicUrl: p.profilePicUrl || p.profilePicUrlHD || "",
      igCategory: p.businessCategoryName || "",
      igVerified: String(p.verified || false),
      igLastUpdated: lastUpdated,
    };
    writeConfigs(configs);

    return NextResponse.json({
      username,
      fullName: p.fullName || "",
      bio: p.biography || "",
      followers: p.followersCount || 0,
      following: p.followsCount || 0,
      postsCount: p.mediaCount || p.postsCount || 0,
      profilePicUrl: p.profilePicUrl || p.profilePicUrlHD || "",
      category: p.businessCategoryName || "",
      verified: p.verified || false,
      lastUpdated,
    } satisfies InstagramProfileData);
  } catch {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
