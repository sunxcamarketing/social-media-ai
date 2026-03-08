import { NextResponse } from "next/server";
import { readConfigs, writeConfigs } from "@/lib/csv";
import { enrichFromLinks } from "@/lib/enrich";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = readConfigs();
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

    // Only overwrite fields that are currently empty
    const updated = { ...config };
    if (enriched.name && !config.name) updated.name = enriched.name;
    if (enriched.company && !config.company) updated.company = enriched.company;
    if (enriched.role && !config.role) updated.role = enriched.role;
    if (enriched.location && !config.location) updated.location = enriched.location;
    if (enriched.businessContext && !config.businessContext) updated.businessContext = enriched.businessContext;
    if (enriched.professionalBackground && !config.professionalBackground) updated.professionalBackground = enriched.professionalBackground;
    if (enriched.keyAchievements && !config.keyAchievements) updated.keyAchievements = enriched.keyAchievements;
    // Brand positioning fields
    if (enriched.brandFeeling && !config.brandFeeling) updated.brandFeeling = enriched.brandFeeling;
    if (enriched.brandProblem && !config.brandProblem) updated.brandProblem = enriched.brandProblem;
    if (enriched.dreamCustomer && !config.dreamCustomer) updated.dreamCustomer = enriched.dreamCustomer;
    if (enriched.customerProblems && !config.customerProblems) updated.customerProblems = enriched.customerProblems;
    if (enriched.providerRole && !config.providerRole) updated.providerRole = enriched.providerRole;
    if (enriched.providerBeliefs && !config.providerBeliefs) updated.providerBeliefs = enriched.providerBeliefs;
    if (enriched.providerStrengths && !config.providerStrengths) updated.providerStrengths = enriched.providerStrengths;
    if (enriched.authenticityZone && !config.authenticityZone) updated.authenticityZone = enriched.authenticityZone;
    if (enriched.brandingStatement && !config.brandingStatement) updated.brandingStatement = enriched.brandingStatement;
    if (enriched.humanDifferentiation && !config.humanDifferentiation) updated.humanDifferentiation = enriched.humanDifferentiation;

    configs[index] = updated;
    writeConfigs(configs);
    return NextResponse.json({ config: updated, enriched });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Enrichment failed" }, { status: 500 });
  }
}
