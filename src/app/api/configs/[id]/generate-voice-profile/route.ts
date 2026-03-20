import { NextResponse } from "next/server";
import { readConfigs } from "@/lib/csv";
import { generateVoiceProfile, getVoiceProfile } from "@/lib/voice-profile";

export const maxDuration = 30;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = await readConfigs();
  const config = configs.find(c => c.id === id);
  if (!config) return NextResponse.json({ error: "Config not found" }, { status: 404 });

  const profile = await generateVoiceProfile(id, config.name || config.configName || "Kunde");
  if (!profile) {
    return NextResponse.json({ error: "Keine Training-Scripts vorhanden" }, { status: 400 });
  }

  return NextResponse.json({ profile });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getVoiceProfile(id);
  return NextResponse.json({ profile });
}
