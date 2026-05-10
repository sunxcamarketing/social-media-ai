import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { readConfig, mapScript } from "@/lib/csv";
import { renderScriptsToPdf, buildExportPdfFilename } from "@/lib/exports/scripts-to-pdf";
import { uploadScriptExportPdf } from "@/lib/exports/save-pdf";

export const maxDuration = 60;

// POST: export selected scripts as a single PDF, stored in Supabase Storage.
// Body: { scriptIds: string[] }
// Returns: { url, filename, count }
//
// Admin-only — clients shouldn't trigger heavy server work like PDF rendering.
// Also validates that all requested scripts belong to the URL-scoped client so
// a stale browser tab can't bundle cross-client content.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;

  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const scriptIds: string[] = Array.isArray(body.scriptIds)
    ? body.scriptIds.filter((s: unknown): s is string => typeof s === "string" && s.length > 0)
    : [];

  if (scriptIds.length === 0) {
    return NextResponse.json({ error: "Mindestens ein Skript auswählen." }, { status: 400 });
  }
  if (scriptIds.length > 50) {
    return NextResponse.json({ error: "Maximal 50 Skripte pro Export." }, { status: 400 });
  }

  const config = await readConfig(clientId);
  if (!config) return NextResponse.json({ error: "Client nicht gefunden." }, { status: 404 });

  const { data, error } = await supabase
    .from("scripts")
    .select("*")
    .eq("client_id", clientId)
    .in("id", scriptIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Keine Skripte gefunden für die ausgewählten IDs." }, { status: 404 });
  }

  // Preserve the user's selection order so the PDF reads in the order the
  // boxes were ticked — falls back to created_at desc for stragglers.
  const order = new Map(scriptIds.map((id, i) => [id, i] as const));
  const scripts = data
    .map(mapScript)
    .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));

  const clientName = config.name || config.configName || "Client";

  try {
    const buffer = await renderScriptsToPdf({ clientName, scripts });
    const filename = buildExportPdfFilename(clientName, scripts.length);
    const { url } = await uploadScriptExportPdf(clientId, filename, buffer);
    return NextResponse.json({ url, filename, count: scripts.length });
  } catch (e) {
    console.error("[export-scripts] PDF generation failed:", e);
    const message = e instanceof Error ? e.message : "PDF-Erstellung fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
