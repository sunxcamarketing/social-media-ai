// DEV-SCRIPT — not used in production. Run via: npx tsx --require dotenv/config scripts/<this-file>
// One-off: pull all of Roman's voice sessions + all his voice-derived ideas
// to compare topics across sessions and surface satisfaction signals.
//
// Usage:  npx tsx --require dotenv/config scripts/analyze-roman-voice.ts

import { supabase } from "../src/lib/supabase";

interface TranscriptEntry { role: "user" | "model"; text: string }

const ROMAN_ID = "0357b2bf-f65a-42cb-922e-2cb36517645a";

async function main() {
  const { data: sessions, error: sErr } = await supabase
    .from("voice_sessions")
    .select("id, transcript, ideas_generated, duration_seconds, created_at, feedback_rating, feedback_comment")
    .eq("client_id", ROMAN_ID)
    .order("created_at", { ascending: false });
  if (sErr) throw sErr;

  console.log(`\nAll voice sessions for Roman: ${(sessions || []).length}\n`);
  for (const s of sessions || []) {
    let transcript: TranscriptEntry[] = [];
    if (Array.isArray(s.transcript)) transcript = s.transcript as TranscriptEntry[];
    else if (typeof s.transcript === "string") {
      try { transcript = JSON.parse(s.transcript); } catch { /* ignore */ }
    }
    const userTurns = transcript.filter((t) => t.role === "user");
    console.log(`  ${s.id.slice(0, 8)} · ${s.created_at} · dur=${s.duration_seconds}s · ideas=${s.ideas_generated} · user-turns=${userTurns.length}`);
  }

  // All ideas Roman has — voice-linked first, then orphans
  const { data: allIdeas } = await supabase
    .from("ideas")
    .select("id, title, description, contentType, source_session_id, createdAt, status")
    .eq("client_id", ROMAN_ID)
    .order("createdAt", { ascending: false });

  console.log(`\nAll ideas for Roman: ${(allIdeas || []).length}\n`);
  const linked = (allIdeas || []).filter((i) => !!i.source_session_id);
  const orphan = (allIdeas || []).filter((i) => !i.source_session_id);

  console.log(`Linked to a voice session (${linked.length}):`);
  for (const i of linked) {
    console.log(`  · [${i.contentType}] ${i.title}`);
    console.log(`    src=${(i.source_session_id || "").slice(0, 8)}  status=${i.status}  ${i.createdAt}`);
    console.log(`    ${(i.description || "").slice(0, 200)}`);
  }

  console.log(`\nNot linked to any voice session (${orphan.length}):`);
  for (const i of orphan) {
    console.log(`  · [${i.contentType}] ${i.title}    ${i.createdAt}  status=${i.status}`);
    console.log(`    ${(i.description || "").slice(0, 200)}`);
  }

  // Print full transcript of every substantial session so we can read tone
  console.log(`\n\n══════════════ Full transcripts (substantial sessions) ══════════════`);
  for (const s of sessions || []) {
    let transcript: TranscriptEntry[] = [];
    if (Array.isArray(s.transcript)) transcript = s.transcript as TranscriptEntry[];
    else if (typeof s.transcript === "string") {
      try { transcript = JSON.parse(s.transcript); } catch { /* ignore */ }
    }
    if (transcript.length === 0) continue;
    console.log(`\n── ${s.id.slice(0, 8)} · ${s.created_at} · ${s.duration_seconds}s ──`);
    for (const t of transcript) {
      const tag = t.role === "user" ? "ROMAN" : "AGENT";
      console.log(`  ${tag}: ${(t.text || "").trim()}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });