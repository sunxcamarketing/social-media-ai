/**
 * Centralized client context builders — replaces 8+ duplicated inline context arrays.
 * Each function takes a config record and returns a formatted string for AI prompts.
 */

import { safeJsonParse } from "./safe-json";

type ConfigRecord = Record<string, string>;

/** Core identity: name, role, company, niche, background */
export function buildClientProfile(config: ConfigRecord): string {
  return [
    config.name && `Name: ${config.name}`,
    config.role && `Rolle: ${config.role}`,
    config.company && `Unternehmen: ${config.company}`,
    config.creatorsCategory && `Nische: ${config.creatorsCategory}`,
    config.businessContext && `Business-Kontext: ${config.businessContext}`,
    config.professionalBackground && `Hintergrund: ${config.professionalBackground}`,
    config.keyAchievements && `Erfolge: ${config.keyAchievements}`,
    config.igBio && `Instagram Bio: ${config.igBio}`,
    config.igFollowers && `Instagram Follower: ${config.igFollowers}`,
    config.igCategory && `Instagram Kategorie: ${config.igCategory}`,
  ].filter(Boolean).join("\n");
}

/** Brand positioning: feeling, problem, statement, differentiators, target audience */
export function buildBrandContext(config: ConfigRecord): string {
  const dreamCustomer = safeJsonParse(config.dreamCustomer);
  const customerProblems = safeJsonParse(config.customerProblems);

  return [
    config.brandFeeling && `Marken-Gefühl: ${config.brandFeeling}`,
    config.brandProblem && `Kernproblem: ${config.brandProblem}`,
    config.brandingStatement && `Branding-Statement: ${config.brandingStatement}`,
    config.humanDifferentiation && `AND-Faktor: ${config.humanDifferentiation}`,
    config.providerRole && `Anbieter-Rolle: ${config.providerRole}`,
    config.providerBeliefs && `Überzeugungen: ${config.providerBeliefs}`,
    config.providerStrengths && `Stärken: ${config.providerStrengths}`,
    config.authenticityZone && `Authentizitätszone: ${config.authenticityZone}`,
    dreamCustomer.description && `Traumkunde: ${dreamCustomer.description}`,
    dreamCustomer.profession && `Traumkunde Beruf: ${dreamCustomer.profession}`,
    dreamCustomer.values && `Traumkunde Werte: ${dreamCustomer.values}`,
    customerProblems.mental && `Mentale Probleme: ${customerProblems.mental}`,
    customerProblems.financial && `Finanzielle Probleme: ${customerProblems.financial}`,
    customerProblems.social && `Soziale Probleme: ${customerProblems.social}`,
  ].filter(Boolean).join("\n");
}

/** Combined profile + brand — used when the full picture is needed */
export function buildFullClientContext(config: ConfigRecord): string {
  const profile = buildClientProfile(config);
  const brand = buildBrandContext(config);
  return [profile, brand].filter(Boolean).join("\n");
}
