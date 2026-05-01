// DEV-SCRIPT — not used in production. Run via: npx tsx --require dotenv/config scripts/<this-file>
// One-shot backfill: re-runs voiceProfile + scriptStructure extraction for
// every client that has training_scripts but no saved profile/structure
// (silent victims of the snake_case-vs-camelCase column bug).

import { config as loadEnv } from "dotenv";
loadEnv();

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { generateVoiceProfile, generateScriptStructure } = await import("../src/lib/voice-profile");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: configs } = await supabase
    .from("configs")
    .select("id, name, configName, language, voiceProfile, scriptStructure");
  const { data: samples } = await supabase
    .from("training_scripts")
    .select("client_id");

  const haveSamples = new Set((samples || []).map((s) => s.client_id));

  for (const cfg of configs || []) {
    if (!haveSamples.has(cfg.id)) continue;

    const name = cfg.name || cfg.configName || "Client";
    const lang: "de" | "en" = cfg.language === "en" ? "en" : "de";
    const needsVoice = !cfg.voiceProfile || cfg.voiceProfile.length < 10;
    const needsStruct = !cfg.scriptStructure || cfg.scriptStructure.length < 10;

    if (!needsVoice && !needsStruct) {
      console.log(`✓ ${name} — already complete, skipping`);
      continue;
    }

    console.log(`→ ${name} (${cfg.id})`);
    if (needsVoice) {
      try {
        const p = await generateVoiceProfile(cfg.id, name, lang, "admin");
        console.log(`  ✓ voiceProfile: ${p ? "saved" : "no profile"}`);
      } catch (err) {
        console.error(`  ✗ voiceProfile failed:`, (err as Error).message);
      }
    }
    if (needsStruct) {
      try {
        const s = await generateScriptStructure(cfg.id, name, lang, "admin");
        console.log(`  ✓ scriptStructure: ${s ? "saved" : "no structure"}`);
      } catch (err) {
        console.error(`  ✗ scriptStructure failed:`, (err as Error).message);
      }
    }
  }
  console.log("\nDone.");
}
main();