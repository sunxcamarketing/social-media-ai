// ── Voice Onboarding: per-block progress store ─────────────────────────────
// Called by the voice server during the onboarding interview. Each time the
// agent finishes a block it calls mark_block_complete; we persist the block
// data to configs.voiceOnboarding (JSON-encoded string, same pattern as
// voiceProfile).
//
// The synthesis step (holistic "voice-DNA" doc) runs at session end in the
// voice server — see synthesizeVoiceOnboarding below.

import Anthropic from "@anthropic-ai/sdk";
import { readConfig, updateConfig } from "./csv";
import { safeJsonParse } from "./safe-json";
import {
  type VoiceOnboarding,
  type VoiceBlock,
  type VoiceBlockId,
  VOICE_BLOCK_ORDER,
  emptyVoiceOnboarding,
} from "./types";

const VALID_BLOCK_IDS = new Set<VoiceBlockId>(VOICE_BLOCK_ORDER);

function isVoiceBlockId(v: unknown): v is VoiceBlockId {
  return typeof v === "string" && VALID_BLOCK_IDS.has(v as VoiceBlockId);
}

export async function loadVoiceOnboarding(clientId: string): Promise<VoiceOnboarding> {
  const config = await readConfig(clientId);
  const raw = config?.voiceOnboarding;
  if (!raw) return emptyVoiceOnboarding();
  const parsed = safeJsonParse<Partial<VoiceOnboarding>>(raw, {});
  if (!Array.isArray(parsed.blocks)) return emptyVoiceOnboarding();

  // Repair: ensure all 8 blocks are present in the canonical order
  const existing = new Map(parsed.blocks.filter((b): b is VoiceBlock => !!b && isVoiceBlockId(b.id)).map((b) => [b.id, b]));
  const blocks: VoiceBlock[] = VOICE_BLOCK_ORDER.map((id) =>
    existing.get(id) || { id, status: "pending", summary: "", quotes: [] },
  );

  const nextOpen = blocks.find((b) => b.status === "pending")?.id;
  return {
    blocks,
    currentBlockId: isVoiceBlockId(parsed.currentBlockId) ? parsed.currentBlockId : (nextOpen || "resources"),
    synthesis: typeof parsed.synthesis === "string" ? parsed.synthesis : "",
    updatedAt: parsed.updatedAt || new Date().toISOString(),
  };
}

export async function saveVoiceOnboarding(clientId: string, data: VoiceOnboarding): Promise<void> {
  await updateConfig(clientId, { voiceOnboarding: JSON.stringify(data) } as Partial<import("./types").Config>);
}

export interface MarkBlockCompleteArgs {
  block_id: string;
  summary: string;
  quotes: string[];
}

/**
 * Mark a block as complete. Called by the voice agent via function-call.
 * Returns the updated onboarding so the server can push progress to the UI.
 */
export async function markBlockComplete(
  clientId: string,
  args: MarkBlockCompleteArgs,
): Promise<{ onboarding: VoiceOnboarding; accepted: boolean; reason?: string }> {
  if (!isVoiceBlockId(args.block_id)) {
    return { onboarding: await loadVoiceOnboarding(clientId), accepted: false, reason: `unknown block_id: ${args.block_id}` };
  }

  const onboarding = await loadVoiceOnboarding(clientId);
  const block = onboarding.blocks.find((b) => b.id === args.block_id)!;
  block.status = "done";
  block.summary = (args.summary || "").trim();
  block.quotes = Array.isArray(args.quotes) ? args.quotes.map((q) => String(q).trim()).filter(Boolean).slice(0, 5) : [];
  block.completedAt = new Date().toISOString();

  const nextOpen = onboarding.blocks.find((b) => b.status === "pending");
  onboarding.currentBlockId = nextOpen?.id || "resources";
  onboarding.updatedAt = new Date().toISOString();

  await saveVoiceOnboarding(clientId, onboarding);
  return { onboarding, accepted: true };
}

// ── Resume: build context for the agent about what's already done ────────

const BLOCK_LABEL_DE: Record<VoiceBlockId, string> = {
  identity: "1. Identität (wer bist du jenseits des Business)",
  positioning: "2. Positionierung (wofür sollst du bekannt sein)",
  audience: "3. Zielgruppe (wen anziehen / abstoßen)",
  beliefs: "4. Audience-Beliefs (was denken sie vorher)",
  offer: "5. Emotionales Ergebnis (was verkaufst du wirklich)",
  feel: "6. Content-Feel (Ton, Vibe)",
  vision: "7. Instagram-Vision & KPIs",
  resources: "8. Ressourcen & Reality-Check",
};

const BLOCK_LABEL_EN: Record<VoiceBlockId, string> = {
  identity: "1. Identity (who you are beyond the business)",
  positioning: "2. Positioning (what you should be known for)",
  audience: "3. Audience (who to attract / repel)",
  beliefs: "4. Audience beliefs (what they think beforehand)",
  offer: "5. Emotional outcome (what you're really selling)",
  feel: "6. Content feel (tone, vibe)",
  vision: "7. Instagram vision & KPIs",
  resources: "8. Resources & reality check",
};

export function buildOnboardingProgressBlock(onboarding: VoiceOnboarding, lang: "de" | "en"): string {
  const labels = lang === "en" ? BLOCK_LABEL_EN : BLOCK_LABEL_DE;
  const done = onboarding.blocks.filter((b) => b.status === "done");
  const pending = onboarding.blocks.filter((b) => b.status === "pending");

  const header = lang === "en"
    ? "# ONBOARDING PROGRESS\n\nSome blocks may already be covered from a previous session. Skip those — start with the next open block."
    : "# ONBOARDING-FORTSCHRITT\n\nEinige Blöcke sind evtl. schon aus einer früheren Session abgeschlossen. Überspringe die — starte mit dem nächsten offenen Block.";

  const doneHeader = lang === "en" ? "## Already done" : "## Schon erledigt";
  const nextHeader = lang === "en" ? "## Next open block" : "## Nächster offener Block";
  const openHeader = lang === "en" ? "## Remaining open blocks" : "## Weitere offene Blöcke";
  const noneDone = lang === "en" ? "_None — this is a fresh session._" : "_Keiner — das ist eine neue Session._";

  const lines: string[] = [header];

  lines.push(`\n${doneHeader}`);
  if (done.length === 0) {
    lines.push(noneDone);
  } else {
    for (const b of done) {
      lines.push(`- **${labels[b.id]}** — ${b.summary || "(no summary)"}`);
    }
  }

  if (pending.length > 0) {
    lines.push(`\n${nextHeader}`);
    lines.push(`- **${labels[pending[0].id]}**`);
    if (pending.length > 1) {
      lines.push(`\n${openHeader}`);
      for (const b of pending.slice(1)) lines.push(`- ${labels[b.id]}`);
    }
  }

  return lines.join("\n");
}

// ── Synthesis: holistic voice-DNA doc from all 8 blocks ──────────────────

export async function synthesizeVoiceOnboarding(
  clientId: string,
  lang: "de" | "en",
): Promise<string> {
  const onboarding = await loadVoiceOnboarding(clientId);
  const done = onboarding.blocks.filter((b) => b.status === "done");
  if (done.length === 0) return "";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[voice-onboarding] ANTHROPIC_API_KEY not set, skipping synthesis");
    return "";
  }

  const labels = lang === "en" ? BLOCK_LABEL_EN : BLOCK_LABEL_DE;
  const blockDump = done
    .map((b) => {
      const quotes = b.quotes.length > 0 ? `\nQuotes:\n${b.quotes.map((q) => `  > "${q}"`).join("\n")}` : "";
      return `### ${labels[b.id]}\n${b.summary}${quotes}`;
    })
    .join("\n\n");

  const system = lang === "en"
    ? "You are a senior content strategist. Given 8 interview blocks about a creator, write a dense 'voice DNA' document (300-500 words) capturing: personality, tonality, storytelling style, positioning, audience, emotional offer, content feel, vision. Output ONLY the document — no meta-commentary, no section headers, just flowing prose. Use the creator's own words where possible. Write in the same language as the input."
    : "Du bist ein erfahrener Content-Stratege. Basierend auf 8 Interview-Blöcken über einen Creator, schreibe ein dichtes 'Voice-DNA'-Dokument (300-500 Wörter) das erfasst: Persönlichkeit, Tonalität, Storytelling-Stil, Positionierung, Zielgruppe, emotionales Angebot, Content-Feel, Vision. Gib NUR das Dokument aus — keine Meta-Kommentare, keine Abschnitts-Überschriften, einfach Fließtext. Nutze wenn möglich die eigenen Worte des Creators. Schreibe in der gleichen Sprache wie der Input.";

  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: blockDump }],
  });

  const textBlock = resp.content.find((b) => b.type === "text");
  const synthesis = textBlock && "text" in textBlock ? textBlock.text.trim() : "";

  if (synthesis) {
    onboarding.synthesis = synthesis;
    onboarding.updatedAt = new Date().toISOString();
    await saveVoiceOnboarding(clientId, onboarding);
  }

  return synthesis;
}

// ── Context loader for script/chat/strategy pipelines ────────────────────

export async function voiceOnboardingToPromptBlock(clientId: string, lang: "de" | "en" = "de"): Promise<string> {
  const onboarding = await loadVoiceOnboarding(clientId);
  const done = onboarding.blocks.filter((b) => b.status === "done");
  if (done.length === 0) return "";

  const labels = lang === "en" ? BLOCK_LABEL_EN : BLOCK_LABEL_DE;

  if (onboarding.synthesis) {
    const header = lang === "en" ? "# VOICE PROFILE (from onboarding interview)" : "# STIMMPROFIL (aus Onboarding-Interview)";
    return `${header}\n\n${onboarding.synthesis}`;
  }

  // Fallback: no synthesis yet, dump per-block summaries
  const header = lang === "en" ? "# VOICE PROFILE (per-block summaries)" : "# STIMMPROFIL (Block-Zusammenfassungen)";
  const body = done.map((b) => `## ${labels[b.id]}\n${b.summary}`).join("\n\n");
  return `${header}\n\n${body}`;
}
