// DEV-SCRIPT — not used in production. Run via: npx tsx --require dotenv/config scripts/<this-file>
// Re-runs the post-session idea extractor over voice_sessions that ended up
// with ideas_generated = 0. Used to recover sessions that ran while the Fly
// voice-server was missing ANTHROPIC_API_KEY (discovered 2026-04-29).
//
// Reads voice_sessions, for each: extracts ideas via Claude, inserts deduped
// rows into ideas, bumps ideas_generated. Skips sessions whose transcript is
// too thin (same threshold as session-extractors.ts).
//
// Dry-run by default. Pass --apply to actually write.
//
// Usage:
//   npx tsx --require dotenv/config scripts/reprocess-voice-sessions.ts
//   npx tsx --require dotenv/config scripts/reprocess-voice-sessions.ts --apply
//   npx tsx --require dotenv/config scripts/reprocess-voice-sessions.ts --apply --client <id>

import { v4 as uuid } from "uuid";
import { supabase } from "../src/lib/supabase";
import { generateSessionSummary } from "../src/lib/voice/session-extractors";
import type { TranscriptEntry } from "../src/lib/gemini-live";

const APPLY = process.argv.includes("--apply");
const clientFlag = process.argv.indexOf("--client");
const ONLY_CLIENT = clientFlag !== -1 ? process.argv[clientFlag + 1] : null;

function normalizeTitle(s: string): string {
  return (s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, "").trim();
}

async function main() {
  const query = supabase
    .from("voice_sessions")
    .select("id, client_id, transcript, duration_seconds, created_at, ideas_generated")
    .eq("ideas_generated", 0);
  if (ONLY_CLIENT) query.eq("client_id", ONLY_CLIENT);
  const { data: sessions, error } = await query;
  if (error) throw error;

  console.log(`Found ${sessions?.length ?? 0} voice_session(s) with ideas_generated=0${ONLY_CLIENT ? ` for client ${ONLY_CLIENT}` : ""}`);
  console.log(`Mode: ${APPLY ? "APPLY (writing)" : "DRY-RUN (no writes)"}\n`);

  let totalIdeasExtracted = 0;
  let totalIdeasNew = 0;
  let totalIdeasSkippedDup = 0;
  let totalSessionsProcessed = 0;
  let totalSessionsSkippedThin = 0;

  for (const s of sessions || []) {
    const rawTranscript = s.transcript;
    let transcript: TranscriptEntry[] = [];
    if (Array.isArray(rawTranscript)) transcript = rawTranscript as TranscriptEntry[];
    else if (typeof rawTranscript === "string") {
      try { transcript = JSON.parse(rawTranscript); } catch { transcript = []; }
    }
    const userTurns = transcript.filter((t) => t.role === "user" && (t.text || "").trim().length > 15).length;
    const modelTurns = transcript.filter((t) => t.role === "model" && (t.text || "").trim().length > 15).length;

    const header = `[${s.id.slice(0, 8)}] client=${s.client_id?.slice(0, 8)} ${s.duration_seconds}s ${s.created_at} (user=${userTurns} model=${modelTurns})`;

    if (userTurns < 2 || modelTurns < 1) {
      console.log(`${header}  → SKIP (transcript too thin)`);
      totalSessionsSkippedThin++;
      continue;
    }

    console.log(`${header}  → extracting…`);
    const ideas = await generateSessionSummary(s.client_id, transcript, "de");
    if (ideas.length === 0) {
      console.log(`  ↳ Claude returned 0 ideas`);
      totalSessionsProcessed++;
      continue;
    }
    console.log(`  ↳ ${ideas.length} idea(s) extracted`);
    totalIdeasExtracted += ideas.length;

    const { data: existing } = await supabase
      .from("ideas")
      .select("id, title")
      .eq("client_id", s.client_id);
    const existingNorms = new Set((existing || []).map((i) => normalizeTitle(i.title)));

    const toInsert: Array<{ id: string; client_id: string; title: string; description: string; content_type: string; status: string; created_at: string; source_session_id: string }> = [];
    for (const idea of ideas) {
      const norm = normalizeTitle(idea.title);
      if (existingNorms.has(norm)) {
        console.log(`     · "${idea.title}" — skipped (duplicate)`);
        totalIdeasSkippedDup++;
        continue;
      }
      existingNorms.add(norm);
      toInsert.push({
        id: uuid(),
        client_id: s.client_id,
        title: idea.title,
        description: idea.description,
        content_type: idea.contentType || "",
        status: "idea",
        created_at: s.created_at || new Date().toISOString().split("T")[0],
        source_session_id: s.id,
      });
      console.log(`     · "${idea.title}"`);
    }

    if (APPLY && toInsert.length > 0) {
      const { error: insertErr } = await supabase.from("ideas").insert(toInsert);
      if (insertErr) {
        console.log(`     ✗ insert failed: ${insertErr.message}`);
        continue;
      }
      const { error: updateErr } = await supabase
        .from("voice_sessions")
        .update({ ideas_generated: toInsert.length })
        .eq("id", s.id);
      if (updateErr) console.log(`     ✗ update voice_sessions.ideas_generated failed: ${updateErr.message}`);
    }

    totalIdeasNew += toInsert.length;
    totalSessionsProcessed++;
  }

  console.log(`\n──────────────────────────────`);
  console.log(`Sessions processed:        ${totalSessionsProcessed}`);
  console.log(`Sessions skipped (thin):   ${totalSessionsSkippedThin}`);
  console.log(`Ideas extracted total:     ${totalIdeasExtracted}`);
  console.log(`Ideas new (would insert):  ${totalIdeasNew}`);
  console.log(`Ideas skipped (duplicate): ${totalIdeasSkippedDup}`);
  if (!APPLY) console.log(`\nDRY-RUN: re-run with --apply to actually write.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});