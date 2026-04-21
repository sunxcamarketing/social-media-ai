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
    ? `You clean up a creator's messy profile fields. Two input sources:

(A) FORM FIELDS — typed quickly during an intake call by someone transcribing what the client said. Expect: raw transcript fragments, third-person references ("he constructed our own house"), half-sentences, typos ("Cutstom" instead of "Custom"), fillers ("in a way", "you know"), random capitalization, abrupt topic jumps within one field, filler like "Nice!" or "let's just do it".

(B) VOICE ONBOARDING — the authoritative source. Structured per-block summaries, verbatim client quotes, and a holistic Voice-DNA synthesis. This was analyzed from a real voice interview.

Your job: rewrite each profile field into clean, structured, first-person information that reads like a polished CRM entry. Not marketing copy, not transcript, not fragments.

REWRITE RULES:
(1) Write in FIRST PERSON whenever the field describes the client themselves ("I design holiday homes…", not "She designs…" or "Designing holiday homes…"). Fields about their OFFER/CUSTOMER stay third-person where natural.
(2) Fix all typos silently (Cutstom→Custom, Airb B→Airbnb, etc.).
(3) Prefer voice-onboarding content over form content when they conflict — voice is the source of truth. Merge where complementary.
(4) Turn transcript fragments into complete sentences. "In a way, he constructed our own house" → "Mein Vater hat unser Haus selbst konzipiert — daher kommt meine Design-Affinität." (or equivalent in target language).
(5) For context/background/beliefs fields: 3–5 complete sentences. For role/location/company/name: 1 line. For coreOffer/mainGoal: 1–2 crisp sentences.
(6) Remove all conversational fillers: "Nice!", "let's just do it", "I think", "you know", "actually", "in a way", "means".
(7) Preserve ALL concrete facts — names, numbers, company names, credentials, places. Never invent anything. If a fact isn't in either source, don't fabricate it.
(8) If a field has no meaningful content anywhere, output "". Do not pad.
(9) Target language: ${lang} (use the client's own language — if they spoke German in the interview but some form fields are English, normalize to ${lang}).
(10) One cohesive paragraph per field — never bullet lists, never numbered items.`
    : `Du räumst die chaotischen Profil-Felder eines Creators auf. Zwei Input-Quellen:

(A) FORMULAR-FELDER — schnell getippt während eines Intake-Calls, jemand hat mitgeschrieben was der Client gesagt hat. Erwarte: rohe Transkript-Fragmente, dritte Person ("he constructed our own house"), halbe Sätze, Tippfehler ("Cutstom" statt "Custom"), Füllwörter ("in a way", "you know"), zufällige Großschreibung, abrupte Themenwechsel innerhalb eines Felds, Füllwörter wie "Nice!" oder "let's just do it".

(B) VOICE-ONBOARDING — die autoritative Quelle. Strukturierte Block-Zusammenfassungen, wörtliche Client-Zitate, und eine ganzheitliche Voice-DNA-Synthese. Analysiert aus einem echten Voice-Interview.

Deine Aufgabe: Schreibe jedes Profil-Feld sauber und strukturiert neu in **ERSTER PERSON**, so dass es wie ein gepflegter CRM-Eintrag liest. Keine Marketing-Phrasen, kein Transkript, keine Fragmente.

REGELN:
(1) Schreibe in ERSTER PERSON wenn das Feld den Client selbst beschreibt ("Ich designe Holiday Homes…", nicht "Sie designt…" oder "Designing holiday homes…"). Felder über ANGEBOT/KUNDEN bleiben in dritter Person wo natürlich.
(2) Korrigiere alle Tippfehler stillschweigend (Cutstom→Custom, Airb B→Airbnb, usw.).
(3) Bevorzuge Voice-Onboarding-Content über Form-Content bei Konflikt — Voice ist die Wahrheit. Merge bei Ergänzung.
(4) Verwandle Transkript-Fragmente in vollständige Sätze. "In a way, he constructed our own house" → "Mein Vater hat unser Haus selbst konzipiert — daher kommt meine Design-Affinität."
(5) Für context/background/beliefs Felder: 3–5 vollständige Sätze. Für role/location/company/name: 1 Zeile. Für coreOffer/mainGoal: 1–2 knackige Sätze.
(6) Entferne alle Conversational-Füllwörter: "Nice!", "let's just do it", "I think", "you know", "actually", "in a way", "means".
(7) Bewahre ALLE konkreten Fakten — Namen, Zahlen, Firmennamen, Credentials, Orte. Erfinde NIEMALS etwas. Wenn ein Fakt in keiner Quelle steht, erfinde ihn nicht.
(8) Wenn ein Feld nirgends sinnvollen Inhalt hat, gib "" aus. Nicht auffüllen.
(9) Zielsprache: ${lang} (nutze die Sprache des Clients — wenn er deutsch gesprochen hat aber Form-Felder englisch sind, normalisiere auf ${lang}).
(10) Ein kohärenter Absatz pro Feld — nie Bullet-Lists, nie Nummerierungen.`;

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
