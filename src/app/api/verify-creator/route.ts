import { NextResponse } from "next/server";

export const maxDuration = 40;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const username: string = (body.username || "").replace(/^@/, "").trim().toLowerCase();

  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

  const token = process.env.APIFY_API_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_API_TOKEN not set" }, { status: 500 });

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
        signal: AbortSignal.timeout(35_000),
      }
    );

    if (!res.ok) return NextResponse.json({ error: "Apify error" }, { status: 502 });

    const data = await res.json();
    const p = data[0];

    if (!p || !p.username) {
      return NextResponse.json({ error: `@${username} wurde auf Instagram nicht gefunden` }, { status: 404 });
    }

    return NextResponse.json({
      username: p.username,
      followers: p.followersCount || 0,
      profilePicUrl: p.profilePicUrl || "",
      verified: true,
    });
  } catch {
    return NextResponse.json({ error: "Profil konnte nicht verifiziert werden" }, { status: 500 });
  }
}
