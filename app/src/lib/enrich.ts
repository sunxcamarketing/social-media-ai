import Anthropic from "@anthropic-ai/sdk";

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

async function fetchWebsiteText(url: string): Promise<string> {
  if (!url) return "";
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;
  try {
    const res = await fetch(fullUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
  } catch {
    return "";
  }
}

async function fetchInstagramProfile(handle: string): Promise<string> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token || !handle) return "";

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
      }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const p = data[0];
    if (!p) return "";
    return [
      p.fullName && `Name: ${p.fullName}`,
      p.biography && `Bio: ${p.biography}`,
      p.businessCategoryName && `Category: ${p.businessCategoryName}`,
      p.city && `City: ${p.city}`,
      p.externalUrl && `Website: ${p.externalUrl}`,
      p.followersCount && `Followers: ${p.followersCount}`,
    ].filter(Boolean).join("\n");
  } catch {
    return "";
  }
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

  // Scrape all sources in parallel
  const [instagramText, websiteText, linkedinText, tiktokText, youtubeText] = await Promise.all([
    fetchInstagramProfile(links.instagram || ""),
    fetchWebsiteText(links.website || ""),
    fetchWebsiteText(links.linkedin || ""),
    fetchWebsiteText(links.tiktok || ""),
    fetchWebsiteText(links.youtube || ""),
  ]);

  const sections = [
    instagramText && `INSTAGRAM PROFILE:\n${instagramText}`,
    websiteText && `WEBSITE:\n${websiteText}`,
    linkedinText && `LINKEDIN:\n${linkedinText}`,
    tiktokText && `TIKTOK:\n${tiktokText}`,
    youtubeText && `YOUTUBE:\n${youtubeText}`,
  ].filter(Boolean).join("\n\n---\n\n");

  if (!sections) return empty;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: `You are a brand positioning expert using the following framework to analyze clients:

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

Use this framework to analyze the scraped profile data and extract/infer all fields. Make intelligent inferences even when not explicitly stated — a positioning expert reads between the lines of someone's messaging.

Based on the following profile data scraped from a client's online presence, extract and infer their information. Return ONLY a valid JSON object with these exact fields:

{
  "name": "Full name of the person",
  "company": "Company or brand name",
  "role": "Job title or role (e.g. Founder & CEO, Coach, Consultant)",
  "location": "City, Country",
  "businessContext": "What they do, their target market, unique value proposition (2-4 sentences)",
  "professionalBackground": "Career history, expertise, credentials (2-3 sentences)",
  "keyAchievements": "Notable wins, milestones, numbers, social proof (2-3 sentences)",
  "brandFeeling": "The core emotional feeling they sell to clients (e.g. 'Sicherheit, Klarheit und Selbstvertrauen' or 'Freedom and confidence in business'). Infer from their messaging and positioning.",
  "brandProblem": "The single core problem they solve for their clients. Be specific and concise (1-2 sentences).",
  "dreamCustomer": {
    "tonality": "Communication style of their ideal client (e.g. professional, ambitious, authentic)",
    "age": "Age range (e.g. 28-45)",
    "gender": "Primary gender or 'all'",
    "income": "Income level or range",
    "country": "Primary country or region",
    "profession": "Typical profession or industry",
    "values": "Core values their ideal client holds",
    "description": "A concrete 2-3 sentence description of one specific ideal client persona"
  },
  "customerProblems": {
    "mental": "Mental/psychological struggles the ideal client faces",
    "physical": "Physical or time-related challenges (burnout, overwork, etc.)",
    "financial": "Financial problems or goals",
    "social": "Social/relational challenges",
    "aesthetic": "Aesthetic or image-related challenges (how they want to be perceived)"
  },
  "providerRole": "The role this person plays for clients — Mentor, Strategist, Coach, Sparring partner, etc. (1-2 sentences)",
  "providerBeliefs": "What they believe in their industry that sets them apart — their contrarian or distinctive viewpoint (2-3 sentences)",
  "providerStrengths": "Their key strengths and skills that clients value most (2-3 sentences)",
  "authenticityZone": "Where their client's core problem overlaps with their unique strength — the sweet spot of their positioning (2-3 sentences)",
  "brandingStatement": "A branding statement in the formula: I help [target group], from [transformation/starting point], so that [result]. Write it in the language used in their profile.",
  "humanDifferentiation": "What makes them human and non-interchangeable beyond their offer — their AND factor (e.g. 'I am a business strategist AND a mother of 3 who believes...'). 2-3 sentences."
}

Rules:
- Use information clearly present in the data, but also make intelligent inferences based on their messaging, tone, and positioning
- For brand positioning fields (brandFeeling, dreamCustomer, etc.), make your best inference even if not explicitly stated — these are strategic interpretations
- If a simple string field truly cannot be determined, use an empty string ""
- For dreamCustomer and customerProblems, always return the full object structure (use empty strings for unknown sub-fields)
- The brandingStatement should feel authentic to their voice and language
- Return only the JSON object, no other text

PROFILE DATA:
${sections}`,
    }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return empty;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
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
  } catch {
    return empty;
  }
}
