import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readConfigs, writeConfigs } from "@/lib/csv";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { text } = await request.json();
  if (!text?.trim()) return NextResponse.json({ error: "No text provided" }, { status: 400 });

  const configs = await readConfigs();
  const index = configs.findIndex((c) => c.id === id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = configs[index];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const client = new Anthropic({ apiKey });

  // Build a readable snapshot of current profile
  const currentProfile = JSON.stringify({
    name: config.name,
    company: config.company,
    role: config.role,
    location: config.location,
    businessContext: config.businessContext,
    professionalBackground: config.professionalBackground,
    keyAchievements: config.keyAchievements,
    brandFeeling: config.brandFeeling,
    brandProblem: config.brandProblem,
    dreamCustomer: config.dreamCustomer ? JSON.parse(config.dreamCustomer || "{}") : {},
    customerProblems: config.customerProblems ? JSON.parse(config.customerProblems || "{}") : {},
    providerRole: config.providerRole,
    providerBeliefs: config.providerBeliefs,
    providerStrengths: config.providerStrengths,
    authenticityZone: config.authenticityZone,
    brandingStatement: config.brandingStatement,
    humanDifferentiation: config.humanDifferentiation,
  }, null, 2);

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `You are updating a client profile. Given the current profile and new information, determine which fields should be updated.

RULES:
- Only update fields where the new information adds genuinely new, non-redundant content
- If a field already contains the same information, skip it
- If a field is empty, fill it with relevant information from the new text
- If a field has content, only update it if the new text adds something meaningfully different (append or enrich, don't replace)
- For dreamCustomer and customerProblems, return the full merged object (preserving existing values, adding new ones)
- Return ONLY a JSON object with the fields to update — omit fields that don't need changing
- If nothing needs updating, return {}
- Return only the JSON, no explanation

AVAILABLE FIELDS:
- name, company, role, location
- businessContext, professionalBackground, keyAchievements
- brandFeeling, brandProblem
- dreamCustomer (object: tonality, age, gender, income, country, profession, values, description)
- customerProblems (object: mental, physical, financial, social, aesthetic)
- providerRole, providerBeliefs, providerStrengths, authenticityZone
- brandingStatement, humanDifferentiation

CURRENT PROFILE:
${currentProfile}

NEW INFORMATION TO ADD:
${text}`,
    }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ updated: {} });

  let updates: Record<string, unknown>;
  try {
    updates = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ updated: {} });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ updated: {}, message: "No new information to add — already captured in profile." });
  }

  // Serialize JSON sub-fields back to strings
  const toSave: Record<string, string> = {};
  for (const [key, val] of Object.entries(updates)) {
    if (key === "dreamCustomer" || key === "customerProblems") {
      toSave[key] = typeof val === "object" ? JSON.stringify(val) : String(val);
    } else {
      toSave[key] = String(val);
    }
  }

  configs[index] = { ...config, ...toSave };
  await writeConfigs(configs);

  return NextResponse.json({ updated: toSave });
}
