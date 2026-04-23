import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readConfig } from "@/lib/csv";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { buildPrompt, STORY_STRATEGY_TOOL } from "@prompts";
import { buildFullClientContext } from "@/lib/client-context";
import { buildPlatformContext, parseTargetPlatforms, DEFAULT_PLATFORM } from "@/lib/platforms";
import { trackClaudeCost, type Initiator } from "@/lib/cost-tracking";

const MODEL = "claude-sonnet-4-6";

// ── GET: list past story strategies for this client ──────────────────────

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("story_strategies")
    .select("id, content, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// ── POST: generate a new story strategy ──────────────────────────────────

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const initiator: Initiator = user.role === "client" ? "client" : "admin";
  const userId = user.id;

  const config = await readConfig(id);
  if (!config) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const lang: "de" | "en" = config.language === "en" ? "en" : "de";
  const platforms = parseTargetPlatforms(config.targetPlatforms);
  const platformContext = buildPlatformContext(platforms[0] || DEFAULT_PLATFORM);
  const systemPrompt = buildPrompt("story-strategist", { platform_context: platformContext }, lang);

  const clientContext = buildFullClientContext(config as unknown as Record<string, string>);
  const clientName = config.name || config.configName || "der Kunde";

  const userPrompt = lang === "en"
    ? `<account>\n${clientContext}\n</account>\n\nAccount name: ${clientName}\nNiche: ${config.creatorsCategory || "(not set)"}\n\nGenerate the full Instagram Story strategy for this account.`
    : `<account>\n${clientContext}\n</account>\n\nAccount Name: ${clientName}\nNische: ${config.creatorsCategory || "(nicht gesetzt)"}\n\nErstelle die vollständige Instagram Story Strategie für diesen Account.`;

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: systemPrompt,
    tools: [STORY_STRATEGY_TOOL],
    tool_choice: { type: "tool", name: "submit_story_strategy" },
    messages: [{ role: "user", content: userPrompt }],
  });
  trackClaudeCost({
    usage: message.usage,
    model: MODEL,
    clientId: id,
    userId,
    operation: "story_strategy",
    initiator,
  });

  const toolUse = message.content.find(b => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ error: "KI hat keine Strategie generiert." }, { status: 500 });
  }

  const content = toolUse.input as Record<string, unknown>;

  const { data: saved, error: saveErr } = await supabase
    .from("story_strategies")
    .insert({ client_id: id, content })
    .select("id, content, created_at")
    .single();

  if (saveErr) {
    console.error("[story-strategies] Save failed:", saveErr);
    // Return the generated content anyway — user shouldn't lose the work
    return NextResponse.json({ id: null, content, created_at: new Date().toISOString() });
  }

  return NextResponse.json(saved);
}

// ── DELETE: remove a story strategy by query param ──────────────────────

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const strategyId = url.searchParams.get("strategyId");
  if (!strategyId) return NextResponse.json({ error: "strategyId required" }, { status: 400 });

  const { error } = await supabase
    .from("story_strategies")
    .delete()
    .eq("id", strategyId)
    .eq("client_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
