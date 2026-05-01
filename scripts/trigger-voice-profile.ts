// DEV-SCRIPT — not used in production. Run via: npx tsx --require dotenv/config scripts/<this-file>
// One-shot: trigger voiceProfile extraction for a specific client.
// Run with: npx tsx scripts/trigger-voice-profile.ts <clientNameSubstring>

import { config as loadEnv } from "dotenv";
loadEnv();

async function main() {
  // Dynamic imports — must happen AFTER dotenv loads .env so the supabase
  // singleton sees the URL/key when it initialises.
  const { createClient } = await import("@supabase/supabase-js");
  const { generateVoiceProfile } = await import("../src/lib/voice-profile");

  const needle = (process.argv[2] || "").toLowerCase();
  if (!needle) {
    console.error("Usage: npx tsx scripts/trigger-voice-profile.ts <name>");
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: configs, error } = await supabase
    .from("configs")
    .select("id, name, configName, language");
  if (error) throw error;

  const match = (configs || []).find((c) => {
    const haystack = `${c.name || ""} ${c.configName || ""}`.toLowerCase();
    return haystack.includes(needle);
  });

  if (!match) {
    console.error(`No client matching "${needle}" found.`);
    process.exit(1);
  }

  console.log(`Found: ${match.configName || match.name} (${match.id})`);

  const lang: "de" | "en" = match.language === "en" ? "en" : "de";
  const clientName = match.name || match.configName || "Client";

  console.log(`Running generateVoiceProfile…`);
  const profile = await generateVoiceProfile(match.id, clientName, lang, "admin");
  if (!profile) {
    console.error("No profile returned (likely no training samples).");
    process.exit(1);
  }

  console.log(`✓ Saved. Tone: ${profile.tone}`);
  console.log(`  Energy: ${profile.energy}`);
  console.log(`  Top words: ${profile.favoriteWords.slice(0, 5).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});