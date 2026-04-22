import 'dotenv/config';

const token = process.env.APIFY_API_TOKEN;
const sinceDate = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

const res = await fetch(
  `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=180`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: [`https://www.instagram.com/marketing.mona/`],
      resultsLimit: 60,
      resultsType: "posts",
      addParentData: true,
      onlyPostsNewerThan: sinceDate,
    }),
  }
);
if (!res.ok) { console.error("err", res.status, (await res.text()).slice(0, 300)); process.exit(1); }
const data = await res.json();

// Filter non-video posts (carousels + single photos)
const nonVideo = data.filter(p => {
  const isVideo = p.productType === "clips" || p.type === "Video" || !!p.videoUrl;
  return !isVideo;
});

console.log(`Total posts: ${data.length}`);
console.log(`Non-video: ${nonVideo.length}`);
console.log(`---\n`);

// Sort by engagement (likes + 2x comments as proxy for viral)
const scored = nonVideo.map(p => ({
  url: p.url,
  type: p.type || (p.childPosts?.length > 1 ? "Carousel" : "Image"),
  slides: p.childPosts?.length || 1,
  caption: (p.caption || "").slice(0, 800),
  likes: p.likesCount || 0,
  comments: p.commentsCount || 0,
  score: (p.likesCount || 0) + 2 * (p.commentsCount || 0),
  date: p.timestamp ? p.timestamp.slice(0, 10) : "",
  firstDisplayUrl: p.displayUrl || p.childPosts?.[0]?.displayUrl,
  altTexts: (p.childPosts || []).map(c => c.alt).filter(Boolean).slice(0, 10),
})).sort((a, b) => b.score - a.score).slice(0, 20);

console.log(JSON.stringify(scored, null, 2));
