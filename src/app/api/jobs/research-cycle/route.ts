// ── Research Cycle Job Orchestrator ────────────────────────────────────────
// Runs all background research jobs for a client.
// Triggered: after pipeline runs, via cron, or manually via admin UI.

import { getCurrentUser } from "@/lib/auth";
import { readConfigs } from "@/lib/csv";
import { refreshTrends } from "@/lib/jobs/trend-refresh";
import { refreshCompetitors } from "@/lib/jobs/competitor-refresh";
import { analyzePerformanceFeedback } from "@/lib/jobs/performance-feedback";

export const maxDuration = 120;

export async function POST(request: Request) {
  // Auth: JOB_SECRET header or admin user
  const auth = request.headers.get("Authorization");
  const isJobSecret = auth === `Bearer ${process.env.JOB_SECRET}`;

  if (!isJobSecret) {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => ({}));
  let clientIds: string[] = body.clientId ? [body.clientId] : [];

  // If no specific client, run for all clients
  if (clientIds.length === 0) {
    const configs = await readConfigs();
    clientIds = configs.map(c => c.id);
  }

  const results: Record<string, { trends: string; competitors: string; feedback: string }> = {};

  for (const clientId of clientIds) {
    const result = { trends: "skipped", competitors: "skipped", feedback: "skipped" };

    const jobs = await Promise.allSettled([
      refreshTrends(clientId).then(r => { result.trends = `done (${r.totalResults} results)`; }),
      refreshCompetitors(clientId).then(r => { result.competitors = `done (${r.totalVideos} videos)`; }),
      analyzePerformanceFeedback(clientId).then(r => { result.feedback = `done (${r.matchedCount} matched, ${r.learningsExtracted} learnings)`; }),
    ]);

    // Mark failures
    if (jobs[0].status === "rejected") result.trends = `error: ${(jobs[0].reason as Error).message}`;
    if (jobs[1].status === "rejected") result.competitors = `error: ${(jobs[1].reason as Error).message}`;
    if (jobs[2].status === "rejected") result.feedback = `error: ${(jobs[2].reason as Error).message}`;

    results[clientId] = result;
  }

  return Response.json({ results });
}
