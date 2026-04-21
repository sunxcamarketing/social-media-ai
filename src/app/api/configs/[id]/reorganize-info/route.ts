// Admin-only: rewrites the client's profile fields using Claude.
// Source material: existing form-filled fields + voice onboarding synthesis
// and block summaries. Claude produces clean, complete, well-phrased values
// per field — returns them as a preview for the admin to accept per-field.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/auth";
import { readConfig, updateConfig } from "@/lib/csv";
import { safeJsonParse } from "@/lib/safe-json";
import { loadVoiceOnboarding } from "@/lib/voice-onboarding";
import type { VoiceOnboarding } from "@/lib/types";

const REORG_FIELDS = [
  "name", "company", "role", "location", "creatorsCategory",
  "businessContext", "professionalBackground", "keyAchievements",
  "brandFeeling", "brandProblem", "brandingStatement", "humanDifferentiation",
  "dreamCustomer", "customerProblems",
  "providerRole", "providerBeliefs", "providerStrengths", "authenticityZone",
  "coreOffer", "mainGoal",
] as const;

type ReorgField = typeof REORG_FIELDS[number];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const apply: Partial<Record<ReorgField, string>> | null = body.apply || null;

  const config = await readConfig(id);
  if (!config) return NextResponse.json({ error: "not found" }, { status: 404 });

  // APPLY MODE: admin confirmed specific rewrites → save them.
  if (apply && typeof apply === "object") {
    const patch: Record<string, string> = {};
    for (const f of REORG_FIELDS) {
      const v = apply[f];
      if (typeof v === "string" && v.trim().length > 0) patch[f] = v.trim();
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "no fields to apply" }, { status: 400 });
    }
    await updateConfig(id, patch);
    return NextResponse.json({ applied: Object.keys(patch).length });
  }

  // PREVIEW MODE: generate Claude suggestions but don't save yet.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const voiceOnboarding: VoiceOnboarding | null = await loadVoiceOnboarding(id).catch(() => null);
  const lang: "de" | "en" = config.language === "en" ? "en" : "de";

  // Build input: current field values + voice DNA material
  const currentFields = REORG_FIELDS
    .map((f) => `- ${f}: ${(safeJsonParse<string>((config as unknown as Record<string, unknown>)[f] as string, "") || (config as unknown as Record<string, unknown>)[f] || "(empty)")}`)
    .join("\n");

  const voiceMaterial = voiceOnboarding?.synthesis
    ? `## Voice DNA synthesis\n${voiceOnboarding.synthesis}\n\n## Per-block summaries\n${(voiceOnboarding.blocks || [])
        .filter((b) => b.status === "done")
        .map((b) => `[${b.id}] ${b.summary}\n  ${b.quotes.slice(0, 3).map((q) => `"${q}"`).join("\n  ")}`)
        .join("\n\n")}`
    : "(no voice onboarding data)";

  const systemPrompt = lang === "en"
    ? `You reorganize a creator's quickly-typed profile fields using their voice onboarding material as the source of truth. The form fields were typed in a hurry during an intake call — fragments, typos, half-sentences. Your job is to rewrite each field into a clean, complete, well-phrased value that any team member could read and understand.

Rules:
(1) PRESERVE the concrete meaning from the original input — do not invent facts.
(2) Combine scattered bits from form + voice into one coherent value per field.
(3) Keep values concise: 1 sentence for name/role/location fields; 2-4 sentences for context/belief fields.
(4) If a field has no meaningful content anywhere, output an empty string "".
(5) Write in the creator's language (their form input language is ${lang}).
(6) Do not add marketing fluff. Plain, factual, first-person when natural.`
    : `Du organisierst die schnell getippten Profil-Felder eines Creators neu, mit dem Voice-Onboarding-Material als Quelle der Wahrheit. Die Form-Felder wurden während eines Intake-Calls schnell getippt — Fragmente, Tippfehler, halbe Sätze. Deine Aufgabe: jedes Feld in einen sauberen, vollständigen, gut formulierten Wert umschreiben.

Regeln:
(1) BEWAHRE die konkrete Bedeutung vom Original — erfinde keine Fakten.
(2) Kombiniere verstreute Teile aus Form + Voice in einen kohärenten Wert pro Feld.
(3) Halte Werte knapp: 1 Satz für name/role/location; 2-4 Sätze für context/beliefs.
(4) Wenn ein Feld nirgends sinnvollen Inhalt hat, gib einen leeren String "" aus.
(5) Schreibe in der Sprache des Creators (Input-Sprache: ${lang}).
(6) Kein Marketing-Fluff. Klar, faktisch, erste Person wenn natürlich.`;

  const userContent = `## Current form field values\n${currentFields}\n\n${voiceMaterial}`;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    tools: [{
      name: "reorganize_profile",
      description: "Return clean, well-phrased values for every profile field.",
      input_schema: {
        type: "object",
        properties: Object.fromEntries(REORG_FIELDS.map((f) => [f, { type: "string" }])),
        required: [...REORG_FIELDS],
      },
    }],
    tool_choice: { type: "tool", name: "reorganize_profile" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return NextResponse.json({ error: "Claude returned no rewrite" }, { status: 502 });

  const rewrites = toolUse.input as Record<ReorgField, string>;
  // Build per-field diff: { field, before, after, changed }
  const preview = REORG_FIELDS.map((f) => {
    const before = ((config as unknown as Record<string, unknown>)[f] as string) || "";
    const after = (rewrites[f] || "").trim();
    return {
      field: f,
      before,
      after,
      changed: after !== "" && after !== before.trim(),
    };
  });

  return NextResponse.json({ preview });
}
