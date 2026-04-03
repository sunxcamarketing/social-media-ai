import Anthropic from "@anthropic-ai/sdk";
import {
  readConfigs,
  readConfig,
  readScripts,
  readScriptsByClient,
  readAnalyses,
  readAnalysesByClient,
  readCreators,
  readVideosList,
  readTrainingScripts,
  readTrainingScriptsByClient,
} from "@/lib/csv";
import { buildPrompt } from "@prompts";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";

export const maxDuration = 120;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Load full project context ────────────────────────────────────────────────

function loadContextFile(name: string): string {
  const p = join(process.cwd(), "context", name);
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf-8");
}

/** Client-scoped context — only this client's data */
async function getClientContext(clientId: string): Promise<string> {
  const sections: string[] = [];

  try {
    const config = await readConfig(clientId);
    if (config) {
      const parts: string[] = [`# DEIN PROFIL: ${config.configName || config.name || "Client"}`];
      if (config.instagram) parts.push(`**Instagram:** @${config.instagram.replace(/^@/, "")}`);
      if (config.company) parts.push(`**Unternehmen:** ${config.company}`);
      if (config.businessContext) parts.push(`**Business-Kontext:** ${config.businessContext}`);
      if (config.strategyGoal) parts.push(`**Strategie-Ziel:** ${config.strategyGoal}`);
      if (config.strategyPillars) {
        try { parts.push(`**Content-Pillars:**\n${JSON.stringify(JSON.parse(config.strategyPillars), null, 2)}`); } catch {}
      }
      sections.push(parts.join("\n"));
    }
  } catch {}

  try {
    const scripts = await readScriptsByClient(clientId);
    if (scripts.length > 0) {
      const scriptBlocks = scripts.slice(0, 30).map(s => {
        const p = [`- **${s.title || "Ohne Titel"}** (${s.createdAt?.slice(0, 10) || "?"})`];
        if (s.hook) p.push(`  Hook: ${s.hook.slice(0, 150)}`);
        return p.join("\n");
      });
      sections.push(`# DEINE SKRIPTE (${scripts.length} gesamt)\n\n${scriptBlocks.join("\n\n")}`);
    }
  } catch {}

  try {
    const analyses = await readAnalysesByClient(clientId);
    if (analyses.length > 0) {
      const a = analyses[0];
      sections.push(`# DEIN AUDIT\n\nFollower: ${a.profileFollowers}\nReels (30d): ${a.profileReels30d}\nØ Views: ${a.profileAvgViews30d}\n\n${a.report?.slice(0, 3000) || ""}`);
    }
  } catch {}

  return sections.join("\n\n---\n\n");
}

async function getFullProjectContext(): Promise<string> {
  const sections: string[] = [];

  // 1. All client configs (full detail)
  try {
    const configs = await readConfigs();
    if (configs.length > 0) {
      const clientBlocks = configs.map(cfg => {
        const parts: string[] = [`### ${cfg.configName || cfg.name || "Unnamed"} (ID: ${cfg.id})`];

        // Identity
        if (cfg.instagram) parts.push(`**Instagram:** @${cfg.instagram.replace(/^@/, "")}`);
        if (cfg.company) parts.push(`**Unternehmen:** ${cfg.company}`);
        if (cfg.role) parts.push(`**Rolle:** ${cfg.role}`);
        if (cfg.location) parts.push(`**Standort:** ${cfg.location}`);
        if (cfg.igFollowers) parts.push(`**Follower:** ${cfg.igFollowers}`);
        if (cfg.igBio) parts.push(`**Bio:** ${cfg.igBio}`);

        // Business & Brand
        if (cfg.businessContext) parts.push(`**Business-Kontext:** ${cfg.businessContext}`);
        if (cfg.professionalBackground) parts.push(`**Professioneller Hintergrund:** ${cfg.professionalBackground}`);
        if (cfg.keyAchievements) parts.push(`**Key Achievements:** ${cfg.keyAchievements}`);
        if (cfg.brandProblem) parts.push(`**Problem/Pain Point:** ${cfg.brandProblem}`);
        if (cfg.brandFeeling) parts.push(`**Brand Feeling:** ${cfg.brandFeeling}`);
        if (cfg.brandingStatement) parts.push(`**Branding Statement:** ${cfg.brandingStatement}`);
        if (cfg.humanDifferentiation) parts.push(`**Differenzierung:** ${cfg.humanDifferentiation}`);
        if (cfg.authenticityZone) parts.push(`**Authentizitätszone:** ${cfg.authenticityZone}`);
        if (cfg.providerRole) parts.push(`**Provider-Rolle:** ${cfg.providerRole}`);
        if (cfg.providerBeliefs) parts.push(`**Überzeugungen:** ${cfg.providerBeliefs}`);
        if (cfg.providerStrengths) parts.push(`**Stärken:** ${cfg.providerStrengths}`);

        // Customer
        if (cfg.dreamCustomer) parts.push(`**Zielgruppe:** ${cfg.dreamCustomer}`);
        if (cfg.customerProblems) parts.push(`**Kundenprobleme:** ${cfg.customerProblems}`);

        // Strategy
        if (cfg.strategyGoal) parts.push(`**Strategie-Ziel:** ${cfg.strategyGoal}`);
        if (cfg.strategyPillars) {
          try {
            const pillars = JSON.parse(cfg.strategyPillars);
            parts.push(`**Content-Pillars:**\n${JSON.stringify(pillars, null, 2)}`);
          } catch { parts.push(`**Content-Pillars:** ${cfg.strategyPillars.slice(0, 2000)}`); }
        }
        if (cfg.strategyWeekly) {
          try {
            const weekly = JSON.parse(cfg.strategyWeekly);
            parts.push(`**Wochenplan:**\n${JSON.stringify(weekly, null, 2)}`);
          } catch { parts.push(`**Wochenplan:** ${cfg.strategyWeekly.slice(0, 1000)}`); }
        }

        // Voice Profile
        if (cfg.voiceProfile) {
          try {
            const vp = JSON.parse(cfg.voiceProfile);
            parts.push(`**Voice Profile:**`);
            if (vp.summary) parts.push(`Zusammenfassung: ${vp.summary}`);
            if (vp.tone) parts.push(`Ton: ${vp.tone}`);
            if (vp.energy) parts.push(`Energie: ${vp.energy}`);
            if (vp.favoriteWords?.length) parts.push(`Lieblingswörter: ${vp.favoriteWords.join(", ")}`);
            if (vp.avoidedPatterns?.length) parts.push(`Vermeidet: ${vp.avoidedPatterns.join(", ")}`);
            if (vp.exampleSentences?.length) parts.push(`Beispielsätze:\n${vp.exampleSentences.map((s: string) => `- "${s}"`).join("\n")}`);
          } catch { parts.push(`**Voice Profile:** ${cfg.voiceProfile.slice(0, 500)}`); }
        }

        // Script Structure
        if (cfg.scriptStructure) {
          try {
            const ss = JSON.parse(cfg.scriptStructure);
            if (ss.summary) parts.push(`**Skript-Struktur:** ${ss.summary}`);
          } catch { /* skip */ }
        }

        // Performance
        if (cfg.performanceInsights) {
          try {
            const pi = JSON.parse(cfg.performanceInsights);
            parts.push(`**Performance-Insights:**\n${JSON.stringify(pi, null, 2).slice(0, 2000)}`);
          } catch { /* skip */ }
        }

        return parts.join("\n");
      });

      sections.push(`# CLIENTS\n\n${clientBlocks.join("\n\n---\n\n")}`);
    }
  } catch { sections.push("# CLIENTS\nKonnten nicht geladen werden."); }

  // 2. Scripts
  try {
    const scripts = await readScripts();
    if (scripts.length > 0) {
      const scriptBlocks = scripts.slice(0, 50).map(s => {
        const parts = [`- **${s.title || "Ohne Titel"}** (${s.clientId}, ${s.createdAt?.slice(0, 10) || "?"})`];
        if (s.pillar) parts.push(`  Pillar: ${s.pillar}`);
        if (s.hook) parts.push(`  Hook: ${s.hook.slice(0, 150)}`);
        if (s.body) parts.push(`  Body: ${s.body.slice(0, 300)}...`);
        if (s.cta) parts.push(`  CTA: ${s.cta.slice(0, 100)}`);
        if (s.textHook) parts.push(`  Text-Hook: ${s.textHook}`);
        if (s.status) parts.push(`  Status: ${s.status}`);
        return parts.join("\n");
      });
      sections.push(`# SKRIPTE (${scripts.length} gesamt, neueste ${Math.min(50, scripts.length)} gezeigt)\n\n${scriptBlocks.join("\n\n")}`);
    }
  } catch { /* skip */ }

  // 3. Audit reports
  try {
    const analyses = await readAnalyses();
    if (analyses.length > 0) {
      const auditBlocks = analyses.map(a => {
        const parts = [`### Audit: ${a.instagramHandle || a.clientId} (${a.createdAt?.slice(0, 10) || "?"})`];
        if (a.profileFollowers) parts.push(`Follower: ${a.profileFollowers}`);
        if (a.profileReels30d) parts.push(`Reels (30d): ${a.profileReels30d}`);
        if (a.profileAvgViews30d) parts.push(`Ø Views (30d): ${a.profileAvgViews30d}`);
        if (a.report) parts.push(`\n${a.report.slice(0, 3000)}`);
        return parts.join("\n");
      });
      sections.push(`# AUDIT-BERICHTE\n\n${auditBlocks.join("\n\n---\n\n")}`);
    }
  } catch { /* skip */ }

  // 4. Creators
  try {
    const creators = await readCreators();
    if (creators.length > 0) {
      const creatorList = creators.map(c =>
        `- @${c.username} (${c.category || "?"}) — ${c.followers || "?"} Follower, Ø ${c.avgViews30d || "?"} Views/30d`
      ).join("\n");
      sections.push(`# CREATORS (${creators.length})\n\n${creatorList}`);
    }
  } catch { /* skip */ }

  // 5. Videos (lightweight)
  try {
    const videos = await readVideosList();
    if (videos.length > 0) {
      const videoList = videos.slice(0, 30).map(v =>
        `- ${v.creator} — ${v.views} Views, ${v.datePosted?.slice(0, 10) || "?"} (${v.configName})`
      ).join("\n");
      sections.push(`# ANALYSIERTE VIDEOS (${videos.length} gesamt, Top 30)\n\n${videoList}`);
    }
  } catch { /* skip */ }

  // 6. Training scripts
  try {
    const training = await readTrainingScripts();
    if (training.length > 0) {
      const trainingList = training.slice(0, 20).map(t => {
        const parts = [`- ${t.format || "?"} (${t.clientId})`];
        if (t.audioHook) parts.push(`  Hook: ${t.audioHook.slice(0, 100)}`);
        if (t.script) parts.push(`  Script: ${t.script.slice(0, 200)}...`);
        return parts.join("\n");
      });
      sections.push(`# TRAINING-SKRIPTE (${training.length} gesamt)\n\n${trainingList.join("\n")}`);
    }
  } catch { /* skip */ }

  // 7. Context files (business knowledge)
  const contextFiles = [
    { file: "personal-info.md", label: "ÜBER AYSUN" },
    { file: "business-info.md", label: "BUSINESS-KONTEXT" },
    { file: "strategy.md", label: "PROJEKT-STRATEGIE" },
    { file: "content_strategy_workbook.md", label: "CONTENT-STRATEGIE WORKBOOK" },
    { file: "brand_positioning_workbook.md", label: "BRAND-POSITIONIERUNG WORKBOOK" },
    { file: "viral-reel-masterclass-transcript.md", label: "VIRAL-REEL METHODIK" },
  ];
  for (const { file, label } of contextFiles) {
    const content = loadContextFile(file);
    if (content) sections.push(`# ${label}\n\n${content}`);
  }

  return sections.join("\n\n---\n\n");
}

// ── API Route ────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), { status: 500 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const messages: ChatMessage[] = body.messages || [];

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages" }), { status: 400 });
  }

  // Build context based on role
  const effectiveClientId = getEffectiveClientId(user);
  let projectContext: string;
  if (user.role === "client" && effectiveClientId) {
    // Client: only their own data
    projectContext = await getClientContext(effectiveClientId);
  } else if (effectiveClientId) {
    // Admin impersonating: client-scoped context
    projectContext = await getClientContext(effectiveClientId);
  } else {
    // Admin: full context
    projectContext = await getFullProjectContext();
  }

  const systemPrompt = buildPrompt("chat-assistant", { client_context: projectContext });

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
