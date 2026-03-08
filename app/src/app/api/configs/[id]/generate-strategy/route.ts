import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { readConfigs, writeConfigs } from "@/lib/csv";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import type { TrainingExample } from "@/app/api/strategy/route";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = readConfigs();
  const index = configs.findIndex((c) => c.id === id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = configs[index];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  // Parse JSON sub-fields safely
  const dreamCustomer = (() => { try { return JSON.parse(config.dreamCustomer || "{}"); } catch { return {}; } })();
  const customerProblems = (() => { try { return JSON.parse(config.customerProblems || "{}"); } catch { return {}; } })();

  const clientContext = [
    config.name && `Name: ${config.name}`,
    config.role && `Role: ${config.role}`,
    config.company && `Company: ${config.company}`,
    config.creatorsCategory && `Niche/Category: ${config.creatorsCategory}`,
    config.businessContext && `Business Context: ${config.businessContext}`,
    config.professionalBackground && `Background: ${config.professionalBackground}`,
    config.keyAchievements && `Key Achievements: ${config.keyAchievements}`,
    config.brandFeeling && `Feeling they sell: ${config.brandFeeling}`,
    config.brandProblem && `Core problem they solve: ${config.brandProblem}`,
    config.brandingStatement && `Branding Statement: ${config.brandingStatement}`,
    config.providerRole && `Their role: ${config.providerRole}`,
    config.providerBeliefs && `Their beliefs: ${config.providerBeliefs}`,
    config.providerStrengths && `Their strengths: ${config.providerStrengths}`,
    config.authenticityZone && `Authenticity zone: ${config.authenticityZone}`,
    config.humanDifferentiation && `AND factor: ${config.humanDifferentiation}`,
    dreamCustomer.description && `Dream customer: ${dreamCustomer.description}`,
    dreamCustomer.profession && `Dream customer profession: ${dreamCustomer.profession}`,
    dreamCustomer.values && `Dream customer values: ${dreamCustomer.values}`,
    customerProblems.mental && `Mental problems: ${customerProblems.mental}`,
    customerProblems.financial && `Financial problems: ${customerProblems.financial}`,
    customerProblems.social && `Social problems: ${customerProblems.social}`,
  ].filter(Boolean).join("\n");

  const contentTypeNames = BUILT_IN_CONTENT_TYPES.map(t => t.name).join(", ");
  const formatNames = BUILT_IN_FORMATS.map(f => f.name).join(", ");

  const postsPerWeek = Math.min(7, Math.max(1, parseInt(config.postsPerWeek || "5", 10)));
  const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activeDays = ALL_DAYS.slice(0, postsPerWeek);

  // Load training examples
  const strategyFile = path.join(process.cwd(), "..", "data", "strategy.json");
  let trainingExamples: TrainingExample[] = [];
  if (existsSync(strategyFile)) {
    try {
      const parsed = JSON.parse(readFileSync(strategyFile, "utf-8"));
      trainingExamples = parsed.trainingExamples || [];
    } catch { /* ignore */ }
  }
  const trainingContext = trainingExamples.length > 0
    ? `\n\nTRAINING EXAMPLES (real content links classified by the user — use these to understand what good content of each type looks like and align the strategy accordingly):\n${trainingExamples.map(e => `- ${e.contentType} / ${e.format}: ${e.url}${e.note ? ` (note: ${e.note})` : ""}`).join("\n")}`
    : "";

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `You are a social media content strategist. Based on the client profile below, create a complete content strategy for their Instagram/social media presence.

CLIENT PROFILE:
${clientContext}

AVAILABLE CONTENT TYPES: ${contentTypeNames}
AVAILABLE FORMATS: ${formatNames}

POSTING FREQUENCY: ${postsPerWeek} posts per week (days: ${activeDays.join(", ")})

Return ONLY a valid JSON object with this exact structure:

{
  "strategyGoal": "reach" | "trust" | "revenue",
  "pillars": [
    { "name": "Pillar name (short, 2-4 words)", "subTopics": "3-4 specific sub-topics or post ideas for this pillar" },
    ...
  ],
  "weekly": {
    ${activeDays.map(d => `"${d}": { "type": "one of the AVAILABLE CONTENT TYPES", "format": "one or more AVAILABLE FORMATS" }`).join(",\n    ")}
  }
}

Rules:
- strategyGoal: "reach" if they need audience growth, "trust" if they need credibility/community, "revenue" if they're converting
- pillars: exactly 3-5 pillars directly tied to their niche, expertise, and dream customer problems. Each pillar name is short and clear. subTopics gives 3-4 concrete topic ideas.
- weekly: ONLY include the ${postsPerWeek} active days (${activeDays.join(", ")}). Assign content types and formats that match the strategyGoal. Vary types across the week (no type used twice). Choose formats that fit their personality/style based on the profile.
- Use exact names from AVAILABLE CONTENT TYPES and AVAILABLE FORMATS lists
- Formats can be combined using " + " (e.g. "Voice Over + B-Roll", "Face to Camera + Text-based Post"). Use combined formats where the combination makes creative sense for the content type
- If training examples are provided, use them to learn which format combinations work well for this niche, and apply that knowledge when choosing formats for the weekly calendar
- Return only the JSON, no explanation${trainingContext}`,
    }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "AI did not return valid JSON" }, { status: 500 });

  let generated: { strategyGoal: string; pillars: { name: string; subTopics: string }[]; weekly: Record<string, { type: string; format: string }> };
  try {
    generated = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  // Save to config
  configs[index] = {
    ...config,
    strategyGoal: generated.strategyGoal || config.strategyGoal,
    strategyPillars: JSON.stringify(generated.pillars || []),
    strategyWeekly: JSON.stringify(generated.weekly || {}),
  };
  writeConfigs(configs);

  return NextResponse.json({ generated });
}
