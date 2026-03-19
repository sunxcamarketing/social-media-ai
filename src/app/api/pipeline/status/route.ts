import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  // Query Inngest API for the function run status
  const signingKey = process.env.INNGEST_SIGNING_KEY;
  if (!signingKey) {
    return NextResponse.json({ status: "running" });
  }

  try {
    const res = await fetch(`https://api.inngest.com/v1/events/${eventId}/runs`, {
      headers: {
        Authorization: `Bearer ${signingKey}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ status: "running" });
    }

    const data = await res.json();
    const runs = data.data || [];

    if (runs.length === 0) {
      return NextResponse.json({ status: "running" });
    }

    const run = runs[0];

    if (run.status === "Completed") {
      const output = run.output || {};
      return NextResponse.json({
        status: "completed",
        videosAnalyzed: output.videosAnalyzed || 0,
        videosTotal: output.videosTotal || 0,
        creatorsScraped: output.creatorsScraped || 0,
      });
    }

    if (run.status === "Failed") {
      return NextResponse.json({
        status: "failed",
        error: run.output?.error || "Pipeline failed",
      });
    }

    return NextResponse.json({ status: "running" });
  } catch {
    return NextResponse.json({ status: "running" });
  }
}
