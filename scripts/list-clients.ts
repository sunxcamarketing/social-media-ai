// One-off cleanup helper: list all clients with key identifiers so we can
// decide which to keep and which to delete.
//
// Usage:  npx tsx --require dotenv/config scripts/list-clients.ts

import { supabase } from "../src/lib/supabase";

async function main() {
  const { data: configs, error } = await supabase
    .from("configs")
    .select(`id, "configName", name, instagram, "voiceOnboarding"`);
  if (error) throw error;

  console.log(`\nFound ${configs.length} client(s):\n`);
  for (const c of configs) {
    const vo = (c.voiceOnboarding as string) || "";
    let doneCount = 0;
    try {
      const parsed = JSON.parse(vo || "{}");
      if (Array.isArray(parsed.blocks)) {
        doneCount = parsed.blocks.filter((b: { status?: string }) => b?.status === "done").length;
      }
    } catch { /* ignore */ }
    console.log(`- ${c.id}`);
    console.log(`    configName: ${c.configName || "(empty)"}`);
    console.log(`    name:       ${c.name || "(empty)"}`);
    console.log(`    instagram:  ${c.instagram || "(empty)"}`);
    console.log(`    voice:      ${doneCount}/8 blocks done`);
    console.log("");
  }

  const { data: sessions } = await supabase
    .from("voice_sessions")
    .select("id, client_id, ideas_generated, duration_seconds, created_at");
  console.log(`\n${(sessions || []).length} voice_session(s) in DB:`);
  for (const s of sessions || []) {
    console.log(`- ${s.id.slice(0, 8)} · client=${s.client_id?.slice(0, 8)} · ideas=${s.ideas_generated} · ${s.duration_seconds}s`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
