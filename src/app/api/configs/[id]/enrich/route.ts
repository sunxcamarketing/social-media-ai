import { NextResponse } from "next/server";
import { readConfigs, writeConfigs } from "@/lib/csv";
import { enrichFromLinks } from "@/lib/enrich";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = await readConfigs();
  const index = configs.findIndex((c) => c.id === id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = configs[index];

  try {
    const enriched = await enrichFromLinks({
      instagram: config.instagram || "",
      website: config.website || "",
      linkedin: config.linkedin || "",
      tiktok: config.tiktok || "",
      youtube: config.youtube || "",
    });

    // Overwrite all fields from enriched data
    const updated = {
      ...config,
      ...Object.fromEntries(
        Object.entries(enriched).filter(([, v]) => v !== "")
      ),
    };

    configs[index] = updated;
    await writeConfigs(configs);
    return NextResponse.json({ config: updated, enriched });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Enrichment failed" }, { status: 500 });
  }
}
