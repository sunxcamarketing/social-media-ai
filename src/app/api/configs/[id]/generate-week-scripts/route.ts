import { getAnthropicClient } from "@/lib/anthropic";
import { sendEvent, sseResponse } from "@/lib/sse";
import {
  loadPipelineContext,
  loadVoiceProfiles,
  runResearch,
  selectTopics,
  generateHooks,
  writeBodies,
  reviewQuality,
} from "@/lib/pipelines/weekly-steps";
import type { AssembledScript } from "@/lib/pipelines/weekly-steps";

export const maxDuration = 300;

// ── Weekly Script Pipeline — SSE Orchestrator ──────────────────────────────

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claude = getAnthropicClient();

        // ── Step 1: Load Context ──────────────────────────────────────
        sendEvent(controller, { step: "context", status: "loading" });
        const ctx = await loadPipelineContext(id);
        sendEvent(controller, { step: "context", status: "done" });

        // ── Step 2: Voice Profiles ────────────────────────────────────
        sendEvent(controller, { step: "voice", status: "loading" });
        const voice = await loadVoiceProfiles(id, ctx.clientName);
        sendEvent(controller, {
          step: "voice", status: "done",
          hasVoice: !!voice.voiceProfile, hasStructure: !!voice.scriptStructure,
        });

        // ── Step 2.5: Research ────────────────────────────────────────
        sendEvent(controller, { step: "trends", status: "loading" });
        const research = await runResearch(id, ctx.config, ctx.clientName, ctx.recentBlock, ctx.platformContext, claude);
        sendEvent(controller, { step: "trends", status: "done", count: research.trendBlock ? 1 : 0 });

        // ── Step 3: Topic Selection ───────────────────────────────────
        sendEvent(controller, { step: "topics", status: "loading" });
        const topics = await selectTopics(ctx, research, claude);
        sendEvent(controller, {
          step: "topics", status: "done",
          topics: topics.map(t => ({ day: t.day, title: t.title, pillar: t.pillar })),
        });

        // ── Step 4: Hook Generation (parallel) ───────────────────────
        sendEvent(controller, { step: "hooks", status: "loading", total: topics.length });
        const hooks = await generateHooks(topics, ctx, voice, claude, (idx, hook) => {
          sendEvent(controller, { step: "hooks", status: "done", index: idx, hook });
        });
        sendEvent(controller, { step: "hooks", status: "all_done" });

        // ── Step 5: Body Writing (parallel) ──────────────────────────
        sendEvent(controller, { step: "bodies", status: "loading", total: topics.length });
        const bodies = await writeBodies(topics, hooks, ctx, voice, claude, (idx, day, title) => {
          sendEvent(controller, { step: "bodies", status: "done", index: idx, title, day });
        });
        sendEvent(controller, { step: "bodies", status: "all_done" });

        // ── Step 6: Quality Review ───────────────────────────────────
        sendEvent(controller, { step: "review", status: "loading" });
        const assembled: AssembledScript[] = topics.map((t, i) => ({
          day: t.day, pillar: t.pillar, contentType: t.contentType, format: t.format,
          title: t.title, hook: hooks[i].hook, hookPattern: hooks[i].pattern || "",
          body: bodies[i].body, cta: bodies[i].cta, reasoning: t.reasoning,
        }));
        const { finalScripts, issues } = await reviewQuality(assembled, voice, ctx.platformContext, claude);
        sendEvent(controller, { step: "review", status: "done", issueCount: issues.length, issues: issues.slice(0, 10) });

        // ── Step 7: Done ─────────────────────────────────────────────
        sendEvent(controller, {
          step: "done",
          scripts: finalScripts,
          _meta: {
            hasAudit: ctx.auditBlock.length > 0,
            hasVoiceProfile: !!voice.voiceProfile,
            ownVideosUsed: ctx.ownTopVideos.length,
            creatorVideosUsed: ctx.competitorHooksBlock ? 1 : 0,
            avgViralDurationSeconds: ctx.avgDuration || null,
            targetWords: ctx.maxWords || null,
            reviewIssuesFixed: issues.length,
            hasLearnings: research.learnings.length,
            hasTrendSnapshot: research.hasTrendSnapshot,
          },
        });

        // Fire-and-forget: trigger background research for next run
        if (process.env.NEXT_PUBLIC_APP_URL && process.env.JOB_SECRET) {
          fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/research-cycle`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${process.env.JOB_SECRET}`, "Content-Type": "application/json" },
            body: JSON.stringify({ clientId: id }),
          }).catch(() => {});
        }

        controller.close();
      } catch (err) {
        sendEvent(controller, { step: "error", message: err instanceof Error ? err.message : "Unbekannter Fehler" });
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
