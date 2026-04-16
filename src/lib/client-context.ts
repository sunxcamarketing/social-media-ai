/**
 * Centralized client-context builders. Each returns a formatted prompt block
 * for a specific aspect of the config — profile, brand, audience, strategy,
 * social. Callers compose the sections they need. Replaces inline duplication
 * across agent-tools.ts, pipelines, and voice-server.
 */

import { safeJsonParse } from "./safe-json";

type ConfigRecord = Record<string, string>;

/** Core identity: name, role, company, niche, location, background. */
export function buildClientProfile(config: ConfigRecord): string {
  return [
    config.name && `Name: ${config.name}`,
    config.role && `Rolle: ${config.role}`,
    config.company && `Unternehmen: ${config.company}`,
    config.creatorsCategory && `Nische: ${config.creatorsCategory}`,
    config.location && `Standort: ${config.location}`,
    config.businessContext && `Business-Kontext: ${config.businessContext}`,
    config.professionalBackground && `Hintergrund: ${config.professionalBackground}`,
    config.keyAchievements && `Erfolge: ${config.keyAchievements}`,
  ].filter(Boolean).join("\n");
}

/** Brand positioning: feeling, problem, statement, differentiators. */
export function buildBrandContext(config: ConfigRecord): string {
  return [
    config.brandFeeling && `Marken-Gefühl: ${config.brandFeeling}`,
    config.brandProblem && `Kernproblem: ${config.brandProblem}`,
    config.brandingStatement && `Branding-Statement: ${config.brandingStatement}`,
    config.humanDifferentiation && `AND-Faktor: ${config.humanDifferentiation}`,
    config.providerRole && `Anbieter-Rolle: ${config.providerRole}`,
    config.providerBeliefs && `Überzeugungen: ${config.providerBeliefs}`,
    config.providerStrengths && `Stärken: ${config.providerStrengths}`,
    config.authenticityZone && `Authentizitätszone: ${config.authenticityZone}`,
    config.coreOffer && `Core Offer: ${config.coreOffer}`,
    config.mainGoal && `Konkretes Ziel: ${config.mainGoal}`,
  ].filter(Boolean).join("\n");
}

/** Target audience: dream customer + their problems. */
export function buildAudienceContext(config: ConfigRecord): string {
  const dreamCustomer = safeJsonParse(config.dreamCustomer);
  const customerProblems = safeJsonParse(config.customerProblems);
  return [
    dreamCustomer.description && `Traumkunde: ${dreamCustomer.description}`,
    dreamCustomer.profession && `Beruf: ${dreamCustomer.profession}`,
    dreamCustomer.values && `Werte: ${dreamCustomer.values}`,
    customerProblems.mental && `Mentale Probleme: ${customerProblems.mental}`,
    customerProblems.emotional && `Emotionale Probleme: ${customerProblems.emotional}`,
    customerProblems.practical && `Praktische Probleme: ${customerProblems.practical}`,
    customerProblems.financial && `Finanzielle Probleme: ${customerProblems.financial}`,
    customerProblems.social && `Soziale Probleme: ${customerProblems.social}`,
  ].filter(Boolean).join("\n");
}

/** Strategy: goal, pillars, weekly plan, cadence. */
export function buildStrategyContext(config: ConfigRecord): string {
  const pillars: { name: string; subTopics?: string }[] = safeJsonParse(config.strategyPillars, []);
  const weekly = safeJsonParse(config.strategyWeekly);

  const parts: string[] = [];
  if (config.strategyGoal) parts.push(`Ziel: ${config.strategyGoal}`);
  if (pillars.length > 0) {
    parts.push("Content-Pillars:\n" + pillars.map(p => {
      let line = `  - ${p.name}`;
      if (p.subTopics) line += ` (${p.subTopics})`;
      return line;
    }).join("\n"));
  }
  if (weekly && Object.keys(weekly).length > 0) {
    parts.push("Wochenplan:\n" + Object.entries(weekly).map(([day, d]) => {
      const info = d as { type?: string; format?: string; pillar?: string };
      return `  ${day}: ${info.type || "?"} | ${info.format || "?"} | ${info.pillar || "?"}`;
    }).join("\n"));
  }
  if (config.postsPerWeek) parts.push(`Posts/Woche: ${config.postsPerWeek}`);
  return parts.join("\n");
}

/** Social channels: Instagram, TikTok, YouTube, website. */
export function buildSocialContext(config: ConfigRecord): string {
  return [
    config.instagram && `Instagram: @${config.instagram.replace(/^@/, "")}`,
    config.igBio && `Bio: ${config.igBio}`,
    config.igFollowers && `Follower: ${config.igFollowers}`,
    config.igCategory && `Kategorie: ${config.igCategory}`,
    config.tiktok && `TikTok: ${config.tiktok}`,
    config.youtube && `YouTube: ${config.youtube}`,
    config.website && `Website: ${config.website}`,
  ].filter(Boolean).join("\n");
}

/** Profile + brand combined — common "full intro" context for AI calls. */
export function buildFullClientContext(config: ConfigRecord): string {
  return [buildClientProfile(config), buildBrandContext(config)].filter(Boolean).join("\n");
}

/** All sections with labeled headers. Used by tools that want everything. */
export function buildAllClientSections(config: ConfigRecord): string {
  const sections: Array<[string, string]> = [
    ["PROFIL", buildClientProfile(config)],
    ["BRAND", buildBrandContext(config)],
    ["ZIELGRUPPE", buildAudienceContext(config)],
    ["STRATEGIE", buildStrategyContext(config)],
    ["SOCIAL MEDIA", buildSocialContext(config)],
  ];
  return sections
    .filter(([, content]) => content.length > 0)
    .map(([label, content]) => `${label}:\n${content}`)
    .join("\n\n");
}
