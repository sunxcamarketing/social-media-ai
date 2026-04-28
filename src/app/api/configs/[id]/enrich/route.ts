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

    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: "Auto-fill couldn't extract any info from the linked profiles. Check that the links are public and reachable." },
        { status: 422 },
      );
    }

    const updated = await updateConfig(id, fields);
    return NextResponse.json({ config: updated, enriched });
  } catch (e) {
    console.error("[enrich] failed", e);
    const msg =
      e instanceof Error ? e.message :
      (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string")
        ? (e as { message: string }).message
        : "Enrichment failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
