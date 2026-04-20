// Gemini text-embedding-004 — 768-dim vectors.
// Used for semantic duplicate detection of topic titles.
//
// Two modes:
//   - In-memory (findDuplicateTitles): embed candidates + recent titles every run.
//   - Persisted (findDuplicatesByDB): query the script_embeddings pgvector table.
//     Requires the 2026-04-17 migration. Falls back to in-memory if it errors.

import { supabase } from "@/lib/supabase";

const EMBEDDING_URL = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";
const BATCH_URL = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents";

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return key;
}

export async function embedText(text: string): Promise<number[]> {
  const key = getApiKey();
  const resp = await fetch(`${EMBEDDING_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/text-embedding-004",
      content: { parts: [{ text }] },
      taskType: "SEMANTIC_SIMILARITY",
    }),
  });
  if (!resp.ok) throw new Error(`Gemini embedding error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.embedding?.values || [];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const key = getApiKey();
  const resp = await fetch(`${BATCH_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map(text => ({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] },
        taskType: "SEMANTIC_SIMILARITY",
      })),
    }),
  });
  if (!resp.ok) throw new Error(`Gemini batch-embedding error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return (data.embeddings || []).map((e: { values: number[] }) => e.values || []);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export interface DuplicateCheck {
  index: number;          // topic index
  similarity: number;     // max similarity found
  matchedTitle: string;   // which recent title triggered the match
}

export async function findDuplicateTitles(
  candidateTitles: string[],
  recentTitles: string[],
  threshold = 0.85,
): Promise<DuplicateCheck[]> {
  if (candidateTitles.length === 0 || recentTitles.length === 0) return [];
  const [candidateEmbs, recentEmbs] = await Promise.all([
    embedTexts(candidateTitles),
    embedTexts(recentTitles),
  ]);
  const duplicates: DuplicateCheck[] = [];
  for (let i = 0; i < candidateTitles.length; i++) {
    let maxSim = 0;
    let matched = "";
    for (let j = 0; j < recentTitles.length; j++) {
      const sim = cosineSimilarity(candidateEmbs[i], recentEmbs[j]);
      if (sim > maxSim) {
        maxSim = sim;
        matched = recentTitles[j];
      }
    }
    if (maxSim >= threshold) {
      duplicates.push({ index: i, similarity: maxSim, matchedTitle: matched });
    }
  }
  return duplicates;
}

// ── pgvector-backed duplicate check ────────────────────────────────────────

export async function saveScriptEmbedding(
  scriptId: string,
  clientId: string,
  title: string,
): Promise<void> {
  if (!title.trim()) return;
  try {
    const embedding = await embedText(title);
    if (embedding.length === 0) return;
    // Supabase accepts pgvector as a JS number[] via the REST layer.
    const { error } = await supabase.from("script_embeddings").upsert(
      { script_id: scriptId, client_id: clientId, title, embedding },
      { onConflict: "script_id" },
    );
    if (error) throw error;
  } catch (err) {
    console.error(`saveScriptEmbedding(${scriptId}) failed:`, err);
  }
}

export async function saveScriptEmbeddings(
  rows: Array<{ scriptId: string; clientId: string; title: string }>,
): Promise<void> {
  if (rows.length === 0) return;
  const valid = rows.filter(r => r.title.trim());
  if (valid.length === 0) return;
  try {
    const embeddings = await embedTexts(valid.map(r => r.title));
    const payload = valid.map((r, i) => ({
      script_id: r.scriptId, client_id: r.clientId, title: r.title, embedding: embeddings[i],
    })).filter(r => r.embedding && r.embedding.length > 0);
    if (payload.length === 0) return;
    const { error } = await supabase.from("script_embeddings").upsert(payload, { onConflict: "script_id" });
    if (error) throw error;
  } catch (err) {
    console.error(`saveScriptEmbeddings(${rows.length}) failed:`, err);
  }
}

/**
 * Find semantic duplicates by querying the script_embeddings table via the
 * match_script_titles SQL function. Returns one duplicate per candidate
 * (the closest match above threshold). Falls back to an empty array on error
 * so callers can default to in-memory comparison.
 */
export async function findDuplicatesByDB(
  clientId: string,
  candidateTitles: string[],
  threshold = 0.85,
): Promise<DuplicateCheck[]> {
  if (!clientId || candidateTitles.length === 0) return [];
  try {
    const embeddings = await embedTexts(candidateTitles);
    const duplicates: DuplicateCheck[] = [];
    await Promise.all(embeddings.map(async (embedding, i) => {
      if (!embedding || embedding.length === 0) return;
      const { data, error } = await supabase.rpc("match_script_titles", {
        query_embedding: embedding,
        match_client_id: clientId,
        match_threshold: threshold,
        match_count: 1,
      });
      if (error) throw error;
      const match = Array.isArray(data) && data[0];
      if (match) {
        duplicates.push({
          index: i,
          similarity: match.similarity as number,
          matchedTitle: match.title as string,
        });
      }
    }));
    return duplicates;
  } catch (err) {
    console.error("findDuplicatesByDB failed, falling back to in-memory:", err);
    return [];
  }
}
