import Anthropic from "@anthropic-ai/sdk";
import { readConfig, readVideos } from "@/lib/csv";
import { scrapeSinglePost } from "@/lib/apify";
import { uploadVideo, analyzeVideo } from "@/lib/gemini";
import {
  getVoiceProfile, generateVoiceProfile, voiceProfileToPromptBlock,
  getScriptStructure, generateScriptStructure, scriptStructureToPromptBlock,
} from "@/lib/voice-profile";
import { getAuditBlock } from "@/app/api/configs/[id]/generate-week-scripts/route";
import {
  buildPrompt, HOOK_GENERATION_TOOL, VIRAL_STRUCTURE_TOOL, VIRAL_ADAPT_TOOL, VIRAL_PRODUCTION_TOOL, VIRAL_CRITIC_TOOL, VIRAL_REVISE_TOOL, VIRAL_SCRIPT_ANALYSIS_PROMPT,
} from "@prompts";

export const maxDuration = 300;

const MODEL = "claude-sonnet-4-6";

// ── SSE helper ──────────────────────────────────────────────────────────────

function sendEvent(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

// ── Build client context ────────────────────────────────────────────────────

function buildClientContext(config: Record<string, string>): string {
  const dreamCustomer = (() => { try { return JSON.parse(config.dreamCustomer || "{}"); } catch { return {}; } })();
  return [
    config.name              && `Name: ${config.name}`,
    config.role              && `Rolle: ${config.role}`,
    config.company           && `Unternehmen: ${config.company}`,
    config.creatorsCategory  && `Nische: ${config.creatorsCategory}`,
    config.businessContext   && `Business-Kontext: ${config.businessContext}`,
    config.brandFeeling      && `Marken-Gefühl: ${config.brandFeeling}`,
    config.brandProblem      && `Kernproblem: ${config.brandProblem}`,
    config.brandingStatement && `Branding-Statement: ${config.brandingStatement}`,
    config.providerRole      && `Anbieter-Rolle: ${config.providerRole}`,
    config.providerBeliefs   && `Überzeugungen: ${config.providerBeliefs}`,
    config.authenticityZone  && `Authentizitätszone: ${config.authenticityZone}`,
    config.humanDifferentiation && `Einzigartigkeit: ${config.humanDifferentiation}`,
    dreamCustomer.description && `Traumkunde: ${dreamCustomer.description}`,
    dreamCustomer.profession  && `Traumkunden-Beruf: ${dreamCustomer.profession}`,
  ].filter(Boolean).join("\n");
}

// ── Main endpoint ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), { status: 500 });

  const body = await request.json().catch(() => ({}));
  const { clientId, videoId, videoUrl } = body as { clientId?: string; videoId?: string; videoUrl?: string };

  if (!clientId) return new Response(JSON.stringify({ error: "clientId required" }), { status: 400 });
  if (!videoId && !videoUrl) return new Response(JSON.stringify({ error: "videoId or videoUrl required" }), { status: 400 });

  const config = await readConfig(clientId);
  if (!config) return new Response(JSON.stringify({ error: "Client not found" }), { status: 404 });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claude = new Anthropic({ apiKey });
        const clientName = config.name || config.configName || "der Kunde";
        const clientContext = buildClientContext(config as unknown as Record<string, string>);

        // ── Step 0: Load context ────────────────────────────────────────
        sendEvent(controller, { step: "context", status: "loading" });

        const [voiceResult, structureResult, auditBlock] = await Promise.all([
          getVoiceProfile(clientId),
          getScriptStructure(clientId),
          getAuditBlock(clientId),
        ]);

        const voiceBlock = voiceResult ? voiceProfileToPromptBlock(voiceResult, clientName) : "";
        const structureBlock = structureResult ? scriptStructureToPromptBlock(structureResult) : "";
        const missingProfiles = !voiceResult || !structureResult;

        sendEvent(controller, {
          step: "context",
          status: "done",
          ...(missingProfiles ? { warning: "Voice Profile oder Skript-Struktur fehlt. Für bessere Ergebnisse: Client-Seite → Drive verbinden." } : {}),
        });

        // ── Step 1: Get reference video analysis ────────────────────────
        let referenceAnalysis = "";
        let referenceCreator = "";
        let referenceViews = 0;

        if (videoId) {
          // Use existing video from database
          const videos = await readVideos();
          const video = videos.find(v => v.id === videoId);
          if (!video) throw new Error("Video nicht gefunden");
          referenceAnalysis = video.analysis || "";
          referenceCreator = video.creator || "";
          referenceViews = video.views || 0;
        } else if (videoUrl) {
          // Scrape + analyze from URL
          sendEvent(controller, { step: "reference", status: "loading", message: "Video wird geladen..." });

          const post = await scrapeSinglePost(videoUrl);
          referenceCreator = post.ownerUsername || "";
          referenceViews = post.videoPlayCount || 0;

          if (!post.videoUrl) throw new Error("Kein Video in diesem Post gefunden. Ist es ein Reel?");

          sendEvent(controller, { step: "reference", status: "loading", message: "Video wird analysiert..." });

          // Download video
          const videoRes = await fetch(post.videoUrl);
          if (!videoRes.ok) throw new Error("Video konnte nicht heruntergeladen werden");
          const buffer = Buffer.from(await videoRes.arrayBuffer());

          // Upload to Gemini + analyze
          const { uri, mimeType } = await uploadVideo(buffer, "video/mp4");
          referenceAnalysis = await analyzeVideo(uri, mimeType, VIRAL_SCRIPT_ANALYSIS_PROMPT);

          sendEvent(controller, { step: "reference", status: "done" });
        }

        if (!referenceAnalysis) throw new Error("Keine Analyse für das Referenz-Video verfügbar");

        // ── Step 2: Extract reference structure ─────────────────────────
        sendEvent(controller, { step: "structure", status: "loading" });

        const structureMsg = await claude.messages.create({
          model: MODEL,
          max_tokens: 4500,
          system: buildPrompt("viral-script-structure"),
          tools: [VIRAL_STRUCTURE_TOOL],
          tool_choice: { type: "tool", name: "submit_structure" },
          messages: [{
            role: "user",
            content: `Analysiere die Struktur dieses viralen Videos (${referenceCreator ? `@${referenceCreator}, ` : ""}${referenceViews > 0 ? `${referenceViews.toLocaleString()} Views` : ""}):\n\n${referenceAnalysis}`,
          }],
        });

        const structureTool = structureMsg.content.find(b => b.type === "tool_use");
        if (!structureTool || structureTool.type !== "tool_use") throw new Error("Struktur-Analyse fehlgeschlagen");
        const rawStructure = structureTool.input as Record<string, unknown>;
        const refStructure = {
          sentences: (rawStructure.sentences as { text: string; role: string; technique: string; contentDescription: string }[]) || [],
          pattern: (rawStructure.pattern as string) || "",
          hookType: (rawStructure.hookType as string) || "",
          hookAnalysis: (rawStructure.hookAnalysis as string) || "",
          videoType: (rawStructure.videoType as string) || "",
          energy: (rawStructure.energy as string) || "",
        };

        if (refStructure.sentences.length === 0) throw new Error("Struktur-Analyse hat keine Sätze extrahiert. Bitte erneut versuchen.");

        sendEvent(controller, { step: "structure", status: "done", data: { pattern: refStructure.pattern, hookType: refStructure.hookType, videoType: refStructure.videoType, energy: refStructure.energy, sentenceCount: refStructure.sentences.length } });

        // ── Step 3: Generate 3 hook variants ────────────────────────────
        sendEvent(controller, { step: "hooks", status: "loading" });

        const refHookSentence = refStructure.sentences.find(s => s.role === "HOOK")?.text || refStructure.sentences[0]?.text || "";

        const hookMsg = await claude.messages.create({
          model: MODEL,
          max_tokens: 2500,
          system: buildPrompt("viral-hook-generation"),
          tools: [HOOK_GENERATION_TOOL],
          tool_choice: { type: "tool", name: "submit_hooks" },
          messages: [{
            role: "user",
            content: `<client>\n${clientContext}\n</client>\n${voiceBlock}\n\n<reference_hook>\nOriginal-Hook: "${refHookSentence}"\nHook-Typ: ${refStructure.hookType}\nWarum er funktioniert: ${refStructure.hookAnalysis}\n</reference_hook>\n\nAdaptiere diesen BEWIESENEN Hook für ${clientName} (Nische: ${(config as unknown as Record<string, string>).creatorsCategory || "unbekannt"}).\n\nMethode: "Change 2-3 Words" — nimm den Original-Hook, tausche NUR die nischen-spezifischen Wörter. Die Satzstruktur und der Mechanismus bleiben IDENTISCH.\n\nErstelle 3 Varianten die alle dem gleichen Mechanismus folgen, aber die Nischen-Wörter leicht anders austauschen.`,
          }],
        });

        const hookTool = hookMsg.content.find(b => b.type === "tool_use");
        if (!hookTool || hookTool.type !== "tool_use") throw new Error("Hook-Generierung fehlgeschlagen");
        const rawHook = hookTool.input as Record<string, unknown>;
        const hookResult = {
          options: (rawHook.options as { hook: string; pattern: string }[]) || [],
          selected: (rawHook.selected as number) ?? 0,
          selectionReason: (rawHook.selectionReason as string) || "",
        };

        if (hookResult.options.length === 0) throw new Error("Hook-Generierung hat keine Optionen erstellt. Bitte erneut versuchen.");

        sendEvent(controller, { step: "hooks", status: "done", data: hookResult });

        // ── Step 4: Adapt body (Copy → Adapt → Simplify) ───────────────
        sendEvent(controller, { step: "adapt", status: "loading" });

        const selectedHook = hookResult.options[hookResult.selected]?.hook || hookResult.options[0]?.hook || "";
        const structureMap = refStructure.sentences.map((s, i) => `Satz ${i + 1} [${s.role}]: "${s.text}"\n  → Technik: ${s.technique}\n  → Inhalt: ${s.contentDescription}`).join("\n\n");

        const adaptMsg = await claude.messages.create({
          model: MODEL,
          max_tokens: 5000,
          system: buildPrompt("viral-script-adapt"),
          tools: [VIRAL_ADAPT_TOOL],
          tool_choice: { type: "tool", name: "submit_adapted_script" },
          messages: [{
            role: "user",
            content: `<client>\n${clientContext}\n</client>\n${voiceBlock}\n${structureBlock}\n${auditBlock}\n\n<reference_video>\nDieses Video hat ${referenceViews > 0 ? `${referenceViews.toLocaleString()} Views` : "viral performt"}${referenceCreator ? ` von @${referenceCreator}` : ""}. Es ist BEWIESENER Erfolg.\n</reference_video>\n\n<full_video_analysis>\nDas ist die VOLLSTÄNDIGE Analyse des Original-Videos. Lies sie KOMPLETT — sie enthält das Transkript, die Visuals, die Text-Overlays, den Editing-Stil. Dein adaptiertes Video muss die gleiche VIDEO-ART und den gleichen AUFBAU haben:\n\n${referenceAnalysis}\n</full_video_analysis>\n\n<reference_structure>\nMuster: ${refStructure.pattern}\nAnzahl Sätze: ${refStructure.sentences.length}\n\nDas Original hat exakt diese Satz-für-Satz-Struktur. Dein Skript MUSS diese Reihenfolge 1:1 einhalten:\n\n${structureMap}\n</reference_structure>\n\n<selected_hook>\n${selectedHook}\n</selected_hook>\n\nWICHTIG — COPY → ADAPT REGELN:\n1. STRUKTUR ist heilig: ${refStructure.sentences.length} Sätze im Original = ${refStructure.sentences.length} Sätze in deinem Skript. Gleiche Reihenfolge der Rollen.\n2. VIDEO-ART kopieren: Das Original ist "${refStructure.videoType}" mit "${refStructure.energy}" Energie. Dein Video MUSS die gleiche Art und Energie haben.\n3. HOOK-TYP beibehalten: Der Hook-Mechanismus (${refStructure.hookType}) muss identisch sein. Nur die Nischen-Wörter ändern.\n4. INHALT kopieren: Lies die "Inhalt"-Beschreibung jedes Satzes in der Referenz-Struktur. Dein Satz muss INHALTLICH das Gleiche tun — nur in der Nische von ${clientName}. Wenn das Original "3 Fehler" nennt, nennst du "3 Fehler". Wenn es eine "Schritt-für-Schritt Anleitung" gibt, gibst du eine "Schritt-für-Schritt Anleitung". Das THEMA wird adaptiert, nicht ersetzt.\n5. "Change 2-3 Words" Prinzip: Je weniger du änderst, desto besser. Tausche nur Nischen-Wörter. Erfinde NICHTS Neues.`,
          }],
        });

        const adaptTool = adaptMsg.content.find(b => b.type === "tool_use");
        if (!adaptTool || adaptTool.type !== "tool_use") throw new Error("Skript-Adaption fehlgeschlagen");
        const rawAdapt = adaptTool.input as {
          textHookShort: string; textHookLong: string;
          hookShort: string; bodyShort: string; ctaShort: string;
          hookLong: string; bodyLong: string; ctaLong: string;
          title: string; videoType: string; reasoning: string;
        };

        // Fix literal \n that Claude sometimes puts in tool output
        const fixNewlines = (s: string) => s.replace(/\\n/g, "\n");
        const adaptResult = {
          ...rawAdapt,
          hookShort: fixNewlines(rawAdapt.hookShort),
          bodyShort: fixNewlines(rawAdapt.bodyShort),
          ctaShort: fixNewlines(rawAdapt.ctaShort),
          hookLong: fixNewlines(rawAdapt.hookLong),
          bodyLong: fixNewlines(rawAdapt.bodyLong),
          ctaLong: fixNewlines(rawAdapt.ctaLong),
        };

        sendEvent(controller, { step: "adapt", status: "done", data: { title: adaptResult.title, videoType: adaptResult.videoType || "" } });

        // ── Step 5: Critic Agent Loop ─────────────────────────────────
        sendEvent(controller, { step: "review", status: "loading" });

        let currentShort = { hook: adaptResult.hookShort, body: adaptResult.bodyShort, cta: adaptResult.ctaShort, textHook: adaptResult.textHookShort || "" };
        let currentLong = { hook: adaptResult.hookLong, body: adaptResult.bodyLong, cta: adaptResult.ctaLong, textHook: adaptResult.textHookLong || "" };

        const criticSystemPrompt = buildPrompt("viral-script-critic");
        const MAX_ITERATIONS = 3;
        const allCritiqueRounds: { round: number; scoreShort: number; scoreLong: number; issues: string[]; changes?: string }[] = [];

        for (let round = 1; round <= MAX_ITERATIONS; round++) {
          // ── Critic bewertet ──
          sendEvent(controller, { step: "review", status: "loading", message: `Critic Agent bewertet (Runde ${round}/${MAX_ITERATIONS})...` });

          const criticMsg = await claude.messages.create({
            model: MODEL,
            max_tokens: 4000,
            system: criticSystemPrompt,
            tools: [VIRAL_CRITIC_TOOL],
            tool_choice: { type: "tool", name: "submit_critique" },
            messages: [{
              role: "user",
              content: `<reference_structure>\nMuster: ${refStructure.pattern}\nAnzahl Sätze: ${refStructure.sentences.length}\n\n${structureMap}\n</reference_structure>\n\n<full_video_analysis>\n${referenceAnalysis}\n</full_video_analysis>\n\n${voiceBlock}\n\n<adapted_script>\n--- KURZ ---\nText-Hook: ${currentShort.textHook}\nHook: ${currentShort.hook}\nBody: ${currentShort.body}\nCTA: ${currentShort.cta}\n\n--- LANG ---\nText-Hook: ${currentLong.textHook}\nHook: ${currentLong.hook}\nBody: ${currentLong.body}\nCTA: ${currentLong.cta}\n</adapted_script>\n\nBewerte dieses adaptierte Skript. Sei streng.`,
            }],
          });

          const criticTool = criticMsg.content.find(b => b.type === "tool_use");
          if (!criticTool || criticTool.type !== "tool_use") break;

          const rawCritique = criticTool.input as Record<string, unknown>;
          const critique = {
            scoreShort: (rawCritique.scoreShort as number) ?? 5,
            scoreLong: (rawCritique.scoreLong as number) ?? 5,
            issuesShort: (rawCritique.issuesShort as { what: string; why: string; fix: string }[]) || [],
            issuesLong: (rawCritique.issuesLong as { what: string; why: string; fix: string }[]) || [],
            passedShort: (rawCritique.passedShort as boolean) ?? false,
            passedLong: (rawCritique.passedLong as boolean) ?? false,
            summary: (rawCritique.summary as string) || "",
          };

          const allIssues = [
            ...critique.issuesShort.map(i => `[KURZ] ${i.what}: ${i.why}`),
            ...critique.issuesLong.map(i => `[LANG] ${i.what}: ${i.why}`),
          ];

          allCritiqueRounds.push({ round, scoreShort: critique.scoreShort, scoreLong: critique.scoreLong, issues: allIssues });

          sendEvent(controller, {
            step: "review",
            status: "loading",
            data: {
              round,
              scoreShort: critique.scoreShort,
              scoreLong: critique.scoreLong,
              issueCount: allIssues.length,
              summary: critique.summary,
              passed: critique.passedShort && critique.passedLong,
            },
          });

          // ── Beide bestanden? → Fertig ──
          if (critique.passedShort && critique.passedLong) break;

          // ── Letzte Runde? → Nicht mehr überarbeiten ──
          if (round === MAX_ITERATIONS) break;

          // ── Writer überarbeitet basierend auf Feedback ──
          sendEvent(controller, { step: "review", status: "loading", message: `Writer Agent überarbeitet (Runde ${round}/${MAX_ITERATIONS})...` });

          const feedbackForWriter = [
            ...critique.issuesShort.map(i => `[KURZ] Problem: ${i.what} — Grund: ${i.why} — Fix: ${i.fix}`),
            ...critique.issuesLong.map(i => `[LANG] Problem: ${i.what} — Grund: ${i.why} — Fix: ${i.fix}`),
          ].join("\n");

          const reviseMsg = await claude.messages.create({
            model: MODEL,
            max_tokens: 5000,
            system: buildPrompt("viral-script-adapt"),
            tools: [VIRAL_REVISE_TOOL],
            tool_choice: { type: "tool", name: "submit_revised_script" },
            messages: [{
              role: "user",
              content: `<client>\n${clientContext}\n</client>\n${voiceBlock}\n\n<reference_structure>\nMuster: ${refStructure.pattern}\nAnzahl Sätze: ${refStructure.sentences.length}\n\n${structureMap}\n</reference_structure>\n\n<full_video_analysis>\n${referenceAnalysis}\n</full_video_analysis>\n\n<current_script>\n--- KURZ ---\nText-Hook: ${currentShort.textHook}\nHook: ${currentShort.hook}\nBody: ${currentShort.body}\nCTA: ${currentShort.cta}\n\n--- LANG ---\nText-Hook: ${currentLong.textHook}\nHook: ${currentLong.hook}\nBody: ${currentLong.body}\nCTA: ${currentLong.cta}\n</current_script>\n\n<critic_feedback>\nScore Kurz: ${critique.scoreShort}/10 | Score Lang: ${critique.scoreLong}/10\n\n${feedbackForWriter}\n</critic_feedback>\n\nÜberarbeite das Skript basierend auf dem Critic-Feedback. Behebe JEDES genannte Problem. Behalte alles bei was gut ist. Die Referenz-Struktur und der Referenz-Inhalt bleiben heilig.`,
            }],
          });

          const reviseTool = reviseMsg.content.find(b => b.type === "tool_use");
          if (!reviseTool || reviseTool.type !== "tool_use") break;

          const rawRevise = reviseTool.input as Record<string, unknown>;
          currentShort = {
            textHook: fixNewlines((rawRevise.textHookShort as string) || currentShort.textHook),
            hook: fixNewlines((rawRevise.hookShort as string) || currentShort.hook),
            body: fixNewlines((rawRevise.bodyShort as string) || currentShort.body),
            cta: fixNewlines((rawRevise.ctaShort as string) || currentShort.cta),
          };
          currentLong = {
            textHook: fixNewlines((rawRevise.textHookLong as string) || currentLong.textHook),
            hook: fixNewlines((rawRevise.hookLong as string) || currentLong.hook),
            body: fixNewlines((rawRevise.bodyLong as string) || currentLong.body),
            cta: fixNewlines((rawRevise.ctaLong as string) || currentLong.cta),
          };

          const changesApplied = (rawRevise.changesApplied as string) || "";
          allCritiqueRounds[allCritiqueRounds.length - 1].changes = changesApplied;
        }

        const finalShort = currentShort;
        const finalLong = currentLong;
        const reviewIssues = allCritiqueRounds.flatMap(r => r.issues);

        sendEvent(controller, {
          step: "review",
          status: "done",
          data: {
            rounds: allCritiqueRounds,
            finalScoreShort: allCritiqueRounds[allCritiqueRounds.length - 1]?.scoreShort ?? 0,
            finalScoreLong: allCritiqueRounds[allCritiqueRounds.length - 1]?.scoreLong ?? 0,
          },
        });

        // ── Step 6: Production notes ────────────────────────────────────
        sendEvent(controller, { step: "production", status: "loading" });

        const productionMsg = await claude.messages.create({
          model: MODEL,
          max_tokens: 4000,
          system: buildPrompt("viral-script-production"),
          tools: [VIRAL_PRODUCTION_TOOL],
          tool_choice: { type: "tool", name: "submit_production_notes" },
          messages: [{
            role: "user",
            content: `Erstelle eine einfache Shot-Liste für dieses Skript. Welche Shots müssen aufgenommen werden?\n\n--- KURZE VERSION ---\nText-Hook: ${finalShort.textHook}\nHook: ${finalShort.hook}\nBody: ${finalShort.body}\nCTA: ${finalShort.cta}\n\n--- LANGE VERSION ---\nText-Hook: ${finalLong.textHook}\nHook: ${finalLong.hook}\nBody: ${finalLong.body}\nCTA: ${finalLong.cta}\n\nErstelle die Shot-Liste basierend auf der LANGEN Version. Der erste Shot sollte den Text-Hook als On-Screen-Text enthalten.`,
          }],
        });

        const productionTool = productionMsg.content.find(b => b.type === "tool_use");
        const rawProduction = productionTool && productionTool.type === "tool_use"
          ? productionTool.input as Record<string, unknown>
          : null;
        const production = rawProduction ? {
          shots: (rawProduction.shots as { nr: number; text: string; action: string; onScreen?: string; duration: string }[]) || [],
          musicMood: (rawProduction.musicMood as string) || "",
        } : null;

        sendEvent(controller, { step: "production", status: "done" });

        // ── Final result ────────────────────────────────────────────────
        sendEvent(controller, {
          step: "done",
          result: {
            title: adaptResult.title,
            reasoning: adaptResult.reasoning,
            short: finalShort,
            long: finalLong,
            hooks: hookResult,
            structure: { pattern: refStructure.pattern, hookType: refStructure.hookType, videoType: adaptResult.videoType || "" },
            production,
            reviewIssues,
            criticScores: {
              short: allCritiqueRounds[allCritiqueRounds.length - 1]?.scoreShort ?? 0,
              long: allCritiqueRounds[allCritiqueRounds.length - 1]?.scoreLong ?? 0,
              rounds: allCritiqueRounds.length,
            },
            reference: {
              creator: referenceCreator,
              views: referenceViews,
            },
          },
        });

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unbekannter Fehler";
        sendEvent(controller, { step: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
