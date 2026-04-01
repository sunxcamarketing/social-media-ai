import { NextResponse } from "next/server";
import { readConfig, updateConfig } from "@/lib/csv";
import { enrichFromLinks } from "@/lib/enrich";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = await readConfig(id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const enriched = await enrichFromLinks({
      instagram: config.instagram || "",
      website: config.website || "",
      linkedin: config.linkedin || "",
      tiktok: config.tiktok || "",
      youtube: config.youtube || "",
    });

    // Only write non-empty enriched fields
    const fields = Object.fromEntries(
      Object.entries(enriched).filter(([, v]) => v !== "")
    );

    const updated = await updateConfig(id, fields);
    return NextResponse.json({ config: updated, enriched });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Enrichment failed" }, { status: 500 });
  }
}
