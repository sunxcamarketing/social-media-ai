// ── Profile Enrichment (Auto-fill) ─────────────────────────────────────────
// Tool used by the auto-fill enrichment pipeline that takes scraped social
// presence data (Instagram/LinkedIn/TikTok) and produces a structured brand
// positioning profile.

export const ENRICH_PROFILE_TOOL = {
  name: "submit_enriched_profile",
  description: "Submit the brand-positioning profile inferred from scraped online presence data.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: { type: "string" as const, description: "Full name of the person" },
      company: { type: "string" as const, description: "Company or brand name" },
      role: { type: "string" as const, description: "Job title or role (e.g. Founder & CEO, Coach, Real Estate Agent)" },
      location: { type: "string" as const, description: "City, Country" },
      businessContext: { type: "string" as const, description: "What they do, their target market, unique value proposition (2-4 sentences)" },
      professionalBackground: { type: "string" as const, description: "Career history, expertise, credentials (2-3 sentences)" },
      keyAchievements: { type: "string" as const, description: "Notable wins, milestones, numbers, social proof (2-3 sentences)" },
      brandFeeling: { type: "string" as const, description: "Core emotional feeling they sell (e.g. 'Sicherheit, Klarheit'). Infer from messaging and positioning." },
      brandProblem: { type: "string" as const, description: "The single core problem they solve for their clients. Specific and concise (1-2 sentences)." },
      dreamCustomer: {
        type: "object" as const,
        description: "Concrete dream customer profile",
        properties: {
          tonality:    { type: "string" as const, description: "Communication style of their ideal client" },
          age:         { type: "string" as const, description: "Age range (e.g. 28-45)" },
          gender:      { type: "string" as const, description: "Primary gender or 'all'" },
          income:      { type: "string" as const, description: "Income level or range" },
          country:     { type: "string" as const, description: "Primary country or region" },
          profession:  { type: "string" as const, description: "Typical profession or industry" },
          values:      { type: "string" as const, description: "Core values their ideal client holds" },
          description: { type: "string" as const, description: "Concrete 2-3 sentence persona description" },
        },
        required: ["tonality", "age", "gender", "income", "country", "profession", "values", "description"],
      },
      customerProblems: {
        type: "object" as const,
        description: "The ideal client's struggles across 5 categories",
        properties: {
          mental:    { type: "string" as const, description: "Mental/psychological struggles" },
          physical:  { type: "string" as const, description: "Physical or time-related challenges (burnout, overwork)" },
          financial: { type: "string" as const, description: "Financial problems or goals" },
          social:    { type: "string" as const, description: "Social/relational challenges" },
          aesthetic: { type: "string" as const, description: "Aesthetic or image-related challenges" },
        },
        required: ["mental", "physical", "financial", "social", "aesthetic"],
      },
      providerRole: { type: "string" as const, description: "Role this person plays for clients — Mentor, Strategist, Coach, Sparring partner (1-2 sentences)" },
      providerBeliefs: { type: "string" as const, description: "What they believe in their industry that sets them apart — contrarian or distinctive viewpoint (2-3 sentences)" },
      providerStrengths: { type: "string" as const, description: "Key strengths and skills clients value most (2-3 sentences)" },
      authenticityZone: { type: "string" as const, description: "Where the client's core problem overlaps with their unique strength (2-3 sentences)" },
      brandingStatement: { type: "string" as const, description: "Formula: 'I help [target group], from [transformation], so that [result].' In the language used in their profile." },
      humanDifferentiation: { type: "string" as const, description: "AND factor — what makes them human and non-interchangeable beyond their offer (2-3 sentences)" },
    },
    required: [
      "name", "company", "role", "location",
      "businessContext", "professionalBackground", "keyAchievements",
      "brandFeeling", "brandProblem", "dreamCustomer", "customerProblems",
      "providerRole", "providerBeliefs", "providerStrengths",
      "authenticityZone", "brandingStatement", "humanDifferentiation",
    ],
  },
};
