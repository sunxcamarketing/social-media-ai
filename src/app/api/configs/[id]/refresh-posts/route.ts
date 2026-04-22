// ── Refresh Posts (lightweight scrape, no Gemini) ────────────────────────
// Triggered on-demand from the admin UI (Post-Aktivität "Aktualisieren" button).
// Cheap — Apify-only, no video analysis.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { refreshClientPosts } from "@/lib/jobs/refresh-posts";

export const maxDuration = 120;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await refreshClientPosts(id);

  if (result.status === "scrape-failed" && result.reason?.includes("limit")) {
    return NextResponse.json(
      { error: "Apify-Monatslimit erreicht. Bitte erhöhe dein Limit unter console.apify.com/billing.", result },
      { status: 429 },
    );
  }

  return NextResponse.json(result);
}
