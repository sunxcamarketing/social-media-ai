// DEV-SCRIPT — not used in production. Run via: npx tsx --require dotenv/config scripts/<this-file>
// Sweep: find clients who have voice-profile training samples but no
// voiceProfile JSON saved (i.e. extraction never ran or got eaten by the
// snake_case-vs-camelCase column bug). Report only — no writes.

import { config as loadEnv } from "dotenv";
loadEnv();

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: configs } = await supabase
    .from("configs")
    .select("id, name, configName, voiceProfile, scriptStructure");
  const { data: samples } = await supabase
    .from("training_scripts")
    .select("client_id, format");

  const samplesByClient = new Map<string, string[]>();
  for (const s of samples || []) {
    if (!samplesByClient.has(s.client_id)) samplesByClient.set(s.client_id, []);
    samplesByClient.get(s.client_id)!.push(s.format);
  }

  console.log(`Total configs: ${configs?.length || 0}`);
  console.log(`Clients with ANY training_scripts: ${samplesByClient.size}\n`);

  const voiceOrphans: { id: string; name: string; sampleCount: number }[] = [];
  const structOrphans: { id: string; name: string; sampleCount: number }[] = [];

  for (const [clientId, formats] of samplesByClient.entries()) {
    const cfg = (configs || []).find((c) => c.id === clientId);
    const name = cfg?.name || cfg?.configName || clientId.slice(0, 8);
    const hasVoice = !!(cfg?.voiceProfile && cfg.voiceProfile.length > 10);
    const hasStruct = !!(cfg?.scriptStructure && cfg.scriptStructure.length > 10);
    console.log(` ${name} · ${formats.length} samples · voiceProfile=${hasVoice ? "✓" : "✗"} scriptStructure=${hasStruct ? "✓" : "✗"}`);
    if (!hasVoice) voiceOrphans.push({ id: clientId, name, sampleCount: formats.length });
    if (!hasStruct) structOrphans.push({ id: clientId, name, sampleCount: formats.length });
  }

  console.log("\n=== ORPHANS ===");
  console.log(`voiceProfile: ${voiceOrphans.length === 0 ? "none" : voiceOrphans.map(o => o.name).join(", ")}`);
  console.log(`scriptStructure: ${structOrphans.length === 0 ? "none" : structOrphans.map(o => o.name).join(", ")}`);
}
main();