import { NextResponse } from "next/server";
import { enrichFromLinks } from "@/lib/enrich";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json();
  try {
    const result = await enrichFromLinks({
      instagram: body.instagram || "",
      website: body.website || "",
      linkedin: body.linkedin || "",
      tiktok: body.tiktok || "",
      youtube: body.youtube || "",
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Enrichment failed" }, { status: 500 });
  }
}
