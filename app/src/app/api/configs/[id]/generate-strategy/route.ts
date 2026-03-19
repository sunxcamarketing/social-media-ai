import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readConfigs, writeConfigs, readTrainingScripts } from "@/lib/csv";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

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

  // Load training scripts as few-shot examples
  const trainingScripts = readTrainingScripts();
  const trainingContext = trainingScripts.length > 0
    ? `\n\nTRAINING SCRIPT EXAMPLES (real successful scripts — use these to understand tone, style, and format combinations that work well):\n${trainingScripts.map(s => [
        `[Format: ${s.format || "–"}]`,
        s.textHook   && `Text Hook: ${s.textHook}`,
        s.visualHook && `Visual Hook: ${s.visualHook}`,
        s.audioHook  && `Audio Hook: ${s.audioHook}`,
        s.script     && `Script: ${s.script.slice(0, 300)}${s.script.length > 300 ? "…" : ""}`,
        s.cta        && `CTA: ${s.cta}`,
      ].filter(Boolean).join("\n")).join("\n\n---\n\n")}`
    : "";

  // Use a standalone client — not tied to the request signal so navigation doesn't abort it
  const client = new Anthropic({ apiKey, timeout: 110_000 });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `You are a social media content strategist using the following framework:

CONTENT STRATEGY FRAMEWORK (Content = Pillar + Type + Format):

1. CONTENT PILLARS (3–5 core topics the account is known for)
   - Each pillar must connect directly to the offer, expertise, or dream customer problems
   - Pillars answer: "What should this account be known for?"

2. CONTENT TYPES & THEIR GOALS:
   - Authority → Establish expertise & credibility (high-ticket positioning)
   - Story / Personality → Emotional connection & trust (brand differentiation)
   - Social Proof → Trigger buying decisions (converting followers)
   - Education / Value → Drive saves, shares & reach (algorithm performance)
   - Opinion / Polarisation → Drive comments & engagement (visibility boost)
   - Behind the Scenes → Authenticity & process (humanising the brand)
   - Inspiration / Motivation → Emotional resonance (shares & saves)
   - Entertainment → Retention & virality (new audience discovery)
   - Community / Interaction → Engagement & loyalty (relationship building)
   - Promotion / Offer → Direct sales or sign-ups (conversion & revenue)

3. CONTENT FORMATS (how the content is presented):
   - Face to Camera: personal, direct, best for Opinion/Authority/Story
   - Voice Over + B-Roll: no face needed, best for Education/Authority
   - Storytelling: narrative arc, best for Story/Social Proof
   - Carousel / Slideshow: list/educational, best for Education/Authority
   - Screen Recording: tutorials, best for Education/BTS
   - Reaction: respond to existing content, best for Opinion/Entertainment
   - Behind the Scenes: raw/authentic, best for Story/Community
   - Talking Head (sit-down): longer interview-style, best for Authority/Education

POSTING FORMULA: Each post = Pillar + Type + Format

Based on the client profile below, create a complete content strategy for their Instagram/social media presence.

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
