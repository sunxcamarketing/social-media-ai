import { getAnthropicClient } from "@/lib/anthropic";
import { sendEvent, sseResponse } from "@/lib/sse";
import {
  loadPipelineContext,
  loadVoiceProfiles,
  runResearch,
} from "@/lib/pipelines/weekly-steps";
import { generateWeekScripts } from "@/lib/pipelines/weekly-oneshot";
import { acquirePipelineLock, releasePipelineLock } from "@/lib/pipeline-lock";

export const maxDuration = 300;

// ── Weekly Script Pipeline — One-Shot Orchestrator ─────────────────────────
// Single Opus call generates the entire coherent content week. The heavy
// context prep (audit, voice, performance, research) still runs upstream so
// Opus sees the full picture in one pass.

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const lock = await acquirePipelineLock(id, "weekly-scripts", 5);
  if (!lock.acquired) {
    return new Response(
      JSON.stringify({
        error: "Eine Wochen-Generierung läuft bereits für diesen Client. Bitte warte bis sie durch ist.",
        holderRunId: lock.holderRunId,
      }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claude = getAnthropicClient();

        // ── Step 1+2: Context + Voice Profiles (parallel) ───────────────
        sendEvent(controller, { step: "context", status: "loading" });
        sendEvent(controller, { step: "voice", status: "loading" });

        const [ctx, voice] = await Promise.all([
          loadPipelineContext(id),
          loadVoiceProfiles(id, ""),
        ]);
        sendEvent(controller, { step: "context", status: "done" });
        sendEvent(controller, {
          step: "voice", status: "done",
          hasVoice: !!voice.voiceProfile, hasStructure: !!voice.scriptStructure,
        });

        // ── Step 3: Research (trends, learnings) ────────────────────────
        sendEvent(controller, { step: "trends", status: "loading" });
        const research = await runResearch(id, ctx.config, ctx.clientName, ctx.recentBlock, ctx.platformContext, claude, ctx.weekRng, ctx.lang);
        sendEvent(controller, { step: "trends", status: "done", count: research.trendBlock ? 1 : 0 });

        // ── Step 4: One-Shot Script Generation (Opus) ───────────────────
        sendEvent(controller, { step: "generate", status: "loading", total: ctx.activeDays.length });
        const { scripts, weekReasoning } = await generateWeekScripts(ctx, voice, research, claude);
        sendEvent(controller, {
          step: "generate", status: "done",
          weekReasoning,
          scriptTitles: scripts.map(s => ({ day: s.day, title: s.title, pillar: s.pillar })),
        });

        // ── Step 5: Done ────────────────────────────────────────────────
        sendEvent(controller, {
          step: "done",
          scripts,
          _meta: {
            hasAudit: ctx.auditBlock.length > 0,
            hasVoiceProfile: !!voice.voiceProfile,
            ownVideosUsed: ctx.ownTopVideos.length,
            creatorVideosUsed: ctx.competitorHooksBlock ? 1 : 0,
            avgViralDurationSeconds: ctx.avgDuration || null,
            targetWords: ctx.maxWords || null,
            reviewIssuesFixed: 0,
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
      } finally {
        await releasePipelineLock(lock);
      }
    },
  });

  return sseResponse(stream);
}
