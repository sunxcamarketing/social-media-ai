import { NextResponse } from "next/server";
import { readConfigs } from "@/lib/csv";
import { generateVoiceProfile, getVoiceProfile, generateScriptStructure, getScriptStructure } from "@/lib/voice-profile";

export const maxDuration = 120;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = await readConfigs();
  const config = configs.find(c => c.id === id);
  if (!config) return NextResponse.json({ error: "Config not found" }, { status: 404 });

  const clientName = config.name || config.configName || "Kunde";

  // Generate both profiles in parallel
  const [voiceResult, structureResult] = await Promise.allSettled([
    generateVoiceProfile(id, clientName),
    generateScriptStructure(id, clientName),
  ]);

  const profile = voiceResult.status === "fulfilled" ? voiceResult.value : null;
  const structure = structureResult.status === "fulfilled" ? structureResult.value : null;

  if (!profile && !structure) {
    return NextResponse.json({ error: "Keine Training-Scripts vorhanden" }, { status: 400 });
  }

  return NextResponse.json({ profile, structure });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, structure] = await Promise.all([
    getVoiceProfile(id),
    getScriptStructure(id),
  ]);
  return NextResponse.json({ profile, structure });
}
