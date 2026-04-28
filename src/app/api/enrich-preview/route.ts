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
    console.error("[enrich-preview] failed", e);
    const msg =
      e instanceof Error ? e.message :
      (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string")
        ? (e as { message: string }).message
        : "Enrichment failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
