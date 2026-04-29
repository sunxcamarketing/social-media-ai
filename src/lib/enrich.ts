import Anthropic from "@anthropic-ai/sdk";
import { ENRICH_PROFILE_TOOL } from "@prompts/tools";
import { MODEL_HAIKU } from "./models";

export interface EnrichedProfile {
  // Basic info
  name: string;
  company: string;
  role: string;
  location: string;
  businessContext: string;
  professionalBackground: string;
  keyAchievements: string;
  // Brand positioning
  brandFeeling: string;
  brandProblem: string;
  dreamCustomer: string; // JSON string
  customerProblems: string; // JSON string
  providerRole: string;
  providerBeliefs: string;
  providerStrengths: string;
  authenticityZone: string;
  brandingStatement: string;
  humanDifferentiation: string;
}

function normalizeUrl(value: string, kind: "website" | "linkedin" | "tiktok" | "youtube"): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.startsWith("http")) return trimmed;
  const stripped = trimmed.replace(/^@/, "");
  switch (kind) {
    case "tiktok":
      if (stripped.includes("tiktok.com")) return `https://${stripped}`;
      return `https://www.tiktok.com/@${stripped}`;
    case "linkedin":
      if (stripped.includes("linkedin.com")) return `https://${stripped}`;
      return `https://www.linkedin.com/in/${stripped}`;
    case "youtube":
      if (stripped.includes("youtube.com") || stripped.includes("youtu.be")) return `https://${stripped}`;
      return `https://www.youtube.com/@${stripped}`;
    default:
      return `https://${stripped}`;
  }
}

async function fetchWebsiteText(url: string, kind: "website" | "linkedin" | "tiktok" | "youtube"): Promise<string> {
  const fullUrl = normalizeUrl(url, kind);
  if (!fullUrl) return "";
  try {
    const res = await fetch(fullUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`[enrich] ${kind} ${fullUrl} → HTTP ${res.status}`);
      return "";
    }
    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
    console.log(`[enrich] ${kind} ${fullUrl} → ${text.length} chars`);
    return text;
  } catch (e) {
    console.warn(`[enrich] ${kind} ${fullUrl} failed:`, e instanceof Error ? e.message : e);
    return "";
  }
}

async function callApifyActor(
  actorId: string,
  input: object,
  label: string,
): Promise<Record<string, unknown> | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.warn(`[enrich] APIFY_API_TOKEN missing — skipping ${label}`);
    return null;
  }
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(90_000),
      },
    );
    if (!res.ok) {
      console.warn(`[enrich] Apify ${label} → HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first || typeof first !== "object") {
      console.warn(`[enrich] Apify ${label} → empty result`);
      return null;
    }
    return first as Record<string, unknown>;
  } catch (e) {
    console.warn(`[enrich] Apify ${label} failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

function summarizeApifyItem(item: Record<string, unknown>, fields: string[]): string {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = item[f];
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    out[f] = v;
  }
  return JSON.stringify(out, null, 2).slice(0, 4000);
}

async function fetchInstagramProfile(handle: string): Promise<string> {
  if (!handle) return "";
  const username = handle
    .replace(/^@/, "")
    .replace(/.*instagram\.com\//, "")
    .replace(/\/$/, "")
    .split("?")[0];
  const item = await callApifyActor(
    "apify~instagram-scraper",
    {
      directUrls: [`https://www.instagram.com/${username}/`],
      resultsType: "details",
      resultsLimit: 1,
    },
    `IG @${username}`,
  );
  if (!item) return "";
  const text = [
    item.fullName && `Name: ${item.fullName}`,
    item.biography && `Bio: ${item.biography}`,
    item.businessCategoryName && `Category: ${item.businessCategoryName}`,
    item.city && `City: ${item.city}`,
    item.externalUrl && `Website: ${item.externalUrl}`,
    item.followersCount && `Followers: ${item.followersCount}`,
  ].filter(Boolean).join("\n");
  console.log(`[enrich] Apify IG @${username} → ${text.length} chars`);
  return text;
}

async function fetchLinkedInProfile(url: string): Promise<string> {
  if (!url) return "";
  const fullUrl = normalizeUrl(url, "linkedin");
  const actor = process.env.APIFY_LINKEDIN_ACTOR || "dev_fusion~Linkedin-Profile-Scraper";
  const item = await callApifyActor(actor, { profileUrls: [fullUrl] }, `LinkedIn ${fullUrl}`);
  if (!item) return "";
  const text = summarizeApifyItem(item, [
    "fullName", "firstName", "lastName", "headline", "about", "summary",
    "addressWithCountry", "addressCountryOnly", "addressWithoutCountry",
    "location", "geoCountryName", "geoUrn",
    "publicIdentifier", "occupation", "jobTitle", "currentJob", "currentCompany",
    "experiences", "experience", "educations", "education", "skills", "languages",
    "connectionsCount", "followersCount",
  ]);
  console.log(`[enrich] Apify LinkedIn ${fullUrl} → ${text.length} chars`);
  return text;
}

async function fetchTikTokProfile(handle: string): Promise<string> {
  if (!handle) return "";
  const username = handle
    .replace(/^@/, "")
    .replace(/.*tiktok\.com\/@?/, "")
    .replace(/\/$/, "")
    .split("?")[0];
  const actor = process.env.APIFY_TIKTOK_ACTOR || "clockworks~tiktok-profile-scraper";
  const item = await callApifyActor(
    actor,
    { profiles: [username], resultsPerPage: 1 },
    `TikTok @${username}`,
  );
  if (!item) return "";
  // Some TikTok actors nest profile data under authorMeta — pull it up if present
  const profile = (item.authorMeta && typeof item.authorMeta === "object")
    ? { ...item, ...(item.authorMeta as Record<string, unknown>) }
    : item;
  const text = summarizeApifyItem(profile, [
    "name", "nickName", "fullName", "uniqueId", "id",
    "signature", "bio", "biography",
    "verified", "private",
    "fans", "followers", "followerCount", "followingCount", "heart", "heartCount",
    "video", "videoCount",
    "category", "categoryName", "language", "region", "ttSeller",
    "bioLink",
  ]);
  console.log(`[enrich] Apify TikTok @${username} → ${text.length} chars`);
  return text;
}

export async function enrichFromLinks(links: {
  instagram?: string;
  website?: string;
  linkedin?: string;
  tiktok?: string;
  youtube?: string;
}): Promise<EnrichedProfile> {
  const empty: EnrichedProfile = {
    name: "", company: "", role: "", location: "",
    businessContext: "", professionalBackground: "", keyAchievements: "",
    brandFeeling: "", brandProblem: "",
    dreamCustomer: "", customerProblems: "",
    providerRole: "", providerBeliefs: "", providerStrengths: "",
    authenticityZone: "", brandingStatement: "", humanDifferentiation: "",
  };

  // Scrape all sources in parallel — Instagram/LinkedIn/TikTok via Apify
  // (those platforms block plain HTTP fetches), website/YouTube via direct fetch.
  const [instagramText, websiteText, linkedinText, tiktokText, youtubeText] = await Promise.all([
    fetchInstagramProfile(links.instagram || ""),
    fetchWebsiteText(links.website || "", "website"),
    fetchLinkedInProfile(links.linkedin || ""),
    fetchTikTokProfile(links.tiktok || ""),
    fetchWebsiteText(links.youtube || "", "youtube"),
  ]);

  const sections = [
    instagramText && `INSTAGRAM PROFILE:\n${instagramText}`,
    websiteText && `WEBSITE:\n${websiteText}`,
    linkedinText && `LINKEDIN:\n${linkedinText}`,
    tiktokText && `TIKTOK:\n${tiktokText}`,
    youtubeText && `YOUTUBE:\n${youtubeText}`,
  ].filter(Boolean).join("\n\n---\n\n");

  console.log(`[enrich] total sections: ${sections.length} chars`);
  if (!sections) {
    console.warn("[enrich] all sources returned empty — nothing to extract");
    return empty;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey, timeout: 110_000 });

  const prompt = `You are a brand positioning expert using the following framework to analyze clients:

FRAMEWORK — Brand & Positioning Workbook:

Phase 1 — Brand Identity:
- What FEELING does the person sell? (Sicherheit, Klarheit, Selbstvertrauen, Freiheit...) — People don't buy methods, they buy feelings and clarity.
- What is their core problem they want to be THE solution for?

Phase 2 — Dream Customer & Authenticity Zone:
- Concrete dream customer profile: tonality, age, gender, income, country, profession, values, and a concrete person description
- Customer problems across 5 categories: mental, physical, financial, social, aesthetic
- Authenticity Zone = where the client's core problem overlaps with the provider's identity and strength

Phase 3 — Brand Message:
- Branding Statement formula: "Ich helfe [Zielgruppe], von [Transformation], damit [Ergebnis]."
- Human differentiation (AND factor): "Ich bin [Anbieter] UND...?" — what makes them human and non-interchangeable

Use this framework to analyze the scraped profile data below. Make intelligent inferences even when not explicitly stated — a positioning expert reads between the lines of someone's messaging. For strategic fields (brandFeeling, dreamCustomer, providerBeliefs, etc.) make your best inference; only return an empty string for a simple field if it truly cannot be determined. Write the brandingStatement in the language used in their profile.

PROFILE DATA:
${sections}`;

  const message = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 2048,
    tools: [ENRICH_PROFILE_TOOL],
    tool_choice: { type: "tool", name: ENRICH_PROFILE_TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    console.warn("[enrich] Claude returned no tool_use block");
    return empty;
  }

  const parsed = toolUse.input as Record<string, unknown>;
  console.log(`[enrich] tool_use returned ${Object.keys(parsed).length} fields`);

  return {
    name: (parsed.name as string) || "",
    company: (parsed.company as string) || "",
    role: (parsed.role as string) || "",
    location: (parsed.location as string) || "",
    businessContext: (parsed.businessContext as string) || "",
    professionalBackground: (parsed.professionalBackground as string) || "",
    keyAchievements: (parsed.keyAchievements as string) || "",
    brandFeeling: (parsed.brandFeeling as string) || "",
    brandProblem: (parsed.brandProblem as string) || "",
    dreamCustomer: parsed.dreamCustomer ? JSON.stringify(parsed.dreamCustomer) : "",
    customerProblems: parsed.customerProblems ? JSON.stringify(parsed.customerProblems) : "",
    providerRole: (parsed.providerRole as string) || "",
    providerBeliefs: (parsed.providerBeliefs as string) || "",
    providerStrengths: (parsed.providerStrengths as string) || "",
    authenticityZone: (parsed.authenticityZone as string) || "",
    brandingStatement: (parsed.brandingStatement as string) || "",
    humanDifferentiation: (parsed.humanDifferentiation as string) || "",
  };
}
