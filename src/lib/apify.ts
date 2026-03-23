export interface ApifyReel {
  videoUrl: string;
  url: string;
  videoPlayCount: number;
  likesCount: number;
  commentsCount: number;
  videoDuration?: number;
  ownerUsername: string;
  images: string[];
  displayUrl?: string;
  thumbnailSrc?: string;
  timestamp: string;
}

interface ApifyProfileResult {
  profilePicUrl: string;
  profilePicUrlHD?: string;
  followersCount: number;
}

export interface CreatorStats {
  profilePicUrl: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
}

function getToken(): string {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN not set");
  return token;
}

export async function scrapeReels(
  username: string,
  maxVideos: number,
  nDays: number
): Promise<ApifyReel[]> {
  const token = getToken();

  const sinceDate = new Date(Date.now() - nDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const response = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addParentData: false,
        directUrls: [`https://www.instagram.com/${username}/`],
        enhanceUserSearchWithFacebookPage: false,
        isUserReelFeedURL: false,
        isUserTaggedFeedURL: false,
        onlyPostsNewerThan: sinceDate,
        resultsLimit: maxVideos,
        resultsType: "posts",
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apify error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data as ApifyReel[];
}

export interface CreatorStatsWithReels extends CreatorStats {
  reels: ApifyReel[];
}

async function fetchApify(token: string, body: Record<string, unknown>, timeoutMs = 90000): Promise<Response> {
  return fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=60`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    }
  );
}

async function fetchProfileWithRetry(token: string, username: string, retries = 2): Promise<ApifyProfileResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetchApify(token, {
      directUrls: [`https://www.instagram.com/${username}/`],
      resultsType: "details",
      resultsLimit: 1,
    });

    if (!res.ok) {
      const text = await res.text();
      if (attempt < retries) {
        console.log(`Apify profile attempt ${attempt + 1} failed (${res.status}), retrying in 3s...`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw new Error(`Apify-Fehler ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json() as ApifyProfileResult[];
    if (data[0]) return data[0];

    if (attempt < retries) {
      console.log(`Apify returned empty for @${username}, retrying in 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
  }
  throw new Error(`Instagram-Profil @${username} wurde nicht gefunden. Bitte prüfe ob der Handle existiert und das Profil öffentlich ist.`);
}

export async function scrapeCreatorStats(username: string): Promise<CreatorStatsWithReels> {
  const token = getToken();
  const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Fetch profile with retry, posts in parallel
  const [profile, postsRes] = await Promise.all([
    fetchProfileWithRetry(token, username),
    fetchApify(token, {
      directUrls: [`https://www.instagram.com/${username}/`],
      resultsType: "posts",
      resultsLimit: 50,
      onlyPostsNewerThan: sinceDate,
      addParentData: false,
    }),
  ]);

  const profilePicUrl = profile.profilePicUrl || profile.profilePicUrlHD || "";
  const followers = profile.followersCount || 0;

  let recentReels: ApifyReel[] = [];
  if (postsRes.ok) {
    const posts = await postsRes.json() as ApifyReel[];
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    recentReels = posts.filter(
      (p) => p.videoUrl && p.timestamp && new Date(p.timestamp) >= cutoff
    );
  }

  const reelsCount30d = recentReels.length;
  const avgViews30d = reelsCount30d > 0
    ? Math.round(recentReels.reduce((sum, r) => sum + (r.videoPlayCount || 0), 0) / reelsCount30d)
    : 0;

  return { profilePicUrl, followers, reelsCount30d, avgViews30d, reels: recentReels };
}
