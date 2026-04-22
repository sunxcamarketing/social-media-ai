import { getAnthropicClient } from "@/lib/anthropic";
import { sendEvent, sseResponse } from "@/lib/sse";
import {
  loadPipelineContext,
  loadVoiceProfiles,
  runResearch,
} from "@/lib/pipelines/weekly-steps";
import { generateWeekIdeas } from "@/lib/pipelines/weekly-oneshot";
import { acquirePipelineLock, releasePipelineLock } from "@/lib/pipeline-lock";
import { getCurrentUser } from "@/lib/auth";
import type { Initiator } from "@/lib/cost-tracking";

export const maxDuration = 300;

// ── Weekly Ideas Pipeline — One-Shot Orchestrator ──────────────────────────
// Single Opus call generates {{num_ideas}} coherent video ideas for the week.
// Ideas are returned to the client and displayed inline — NOT persisted.
// The user picks which ideas to develop into full scripts via the Content
// Agent chat (see idea dialog in /clients/[id]/ideas/page.tsx).

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

  const user = await getCurrentUser();
  const initiator: Initiator = user?.role === "client" ? "client" : "admin";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claude = getAnthropicClient();

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

        sendEvent(controller, { step: "trends", status: "loading" });
        const research = await runResearch(id, ctx.config, ctx.clientName, ctx.recentBlock, ctx.platformContext, claude, ctx.weekRng, ctx.lang, initiator);
        sendEvent(controller, { step: "trends", status: "done", count: research.trendBlock ? 1 : 0 });

        // One-shot idea generation — Opus sees full context, plans the week
        sendEvent(controller, { step: "generate", status: "loading", total: ctx.activeDays.length });
        const { ideas, weekReasoning } = await generateWeekIdeas(ctx, voice, research, claude, initiator);
        sendEvent(controller, {
          step: "generate", status: "done",
          weekReasoning,
          ideaTitles: ideas.map(i => ({ day: i.day, title: i.title, pillar: i.pillar })),
        });

        sendEvent(controller, {
          step: "done",
          ideas,
          weekReasoning,
          _meta: {
            hasAudit: ctx.auditBlock.length > 0,
            hasVoiceProfile: !!voice.voiceProfile,
            ownVideosUsed: ctx.ownTopVideos.length,
            creatorVideosUsed: ctx.competitorHooksBlock ? 1 : 0,
            hasLearnings: research.learnings.length,
            hasTrendSnapshot: research.hasTrendSnapshot,
          },
        });

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
