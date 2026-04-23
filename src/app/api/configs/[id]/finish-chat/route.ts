import { NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { readConfig, readScripts, writeScripts, readTrainingScripts } from "@/lib/csv";
import { buildFullClientContext } from "@/lib/client-context";
import { safeJsonParse } from "@/lib/safe-json";
import { v4 as uuid } from "uuid";

export const maxDuration = 120;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = await readConfig(id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const messages: ChatMessage[] = body.messages || [];

  const lang: "de" | "en" = config.language === "en" ? "en" : "de";

  const transcript = messages
    .filter((m) => m.content)
    .map((m) => `${m.role === "user" ? "Creator" : lang === "en" ? "Strategist" : "Stratege"}: ${m.content}`)
    .join("\n\n");

  if (!transcript) return NextResponse.json({ error: lang === "en" ? "No conversation content" : "Kein Gesprächsinhalt" }, { status: 400 });

  const clientContext = buildFullClientContext(config as unknown as Record<string, string>);

  const pillars = safeJsonParse<{ name: string }[]>(config.strategyPillars, []);
  const pillarList = pillars.length > 0
    ? pillars.map((p) => p.name).join(", ")
    : (lang === "en" ? "(no pillars defined)" : "(keine Pillars definiert)");

  // Load training scripts as few-shot examples
  const trainingScripts = await readTrainingScripts();
  const trainingHeader = lang === "en"
    ? "EXAMPLE SCRIPTS (real successful scripts — learn from them for structure, tonality and flow):"
    : "BEISPIEL-SKRIPTE (echte erfolgreiche Skripte — lerne daraus für Struktur, Tonalität und Aufbau):";
  const scriptLabel = lang === "en" ? "Script" : "Skript";
  const trainingContext = trainingScripts.length > 0
    ? `\n\n${trainingHeader}\n${trainingScripts.map(s => [
        `[Format: ${s.format || "–"}]`,
        s.textHook   && `Text Hook: ${s.textHook}`,
        s.visualHook && `Visual Hook: ${s.visualHook}`,
        s.audioHook  && `Audio Hook: ${s.audioHook}`,
        s.script     && `${scriptLabel}: ${s.script}`,
        s.cta        && `CTA: ${s.cta}`,
      ].filter(Boolean).join("\n")).join("\n\n---\n\n")}`
    : "";

  const client = getAnthropicClient();

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    tools: [
      {
        name: "submit_scripts",
        description: "Submit 2-3 video scripts generated from the chat conversation",
        input_schema: {
          type: "object" as const,
          properties: {
            scripts: {
              type: "array",
              minItems: 2,
              maxItems: 3,
              items: {
                type: "object",
                properties: {
                  title:       { type: "string" },
                  pillar:      { type: "string" },
                  contentType: { type: "string", description: lang === "en" ? "e.g. Face-to-camera, Storytelling, Voiceover + B-Roll" : "z.B. Face-to-camera, Storytelling, Voiceover + B-Roll" },
                  format:      { type: "string" },
                  hook:        { type: "string", description: lang === "en" ? "Opening hook, max 1-2 sentences" : "Eröffnungs-Hook, max 1-2 Sätze" },
                  body:        { type: "string", description: lang === "en" ? "Main body of the script" : "Hauptteil des Skripts" },
                  cta:         { type: "string", description: lang === "en" ? "Call to Action, max 1-2 sentences" : "Call to Action, max 1-2 Sätze" },
                },
                required: ["title", "pillar", "contentType", "format", "hook", "body", "cta"],
              },
            },
          },
          required: ["scripts"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_scripts" },
    messages: [
      {
        role: "user",
        content: lang === "en"
          ? `You are an experienced social media copywriter. Create 2-3 strong video scripts from this conversation. WRITE ALL SCRIPTS IN ENGLISH.

CLIENT PROFILE:
${clientContext}

STRATEGY PILLARS: ${pillarList}

CONVERSATION (raw material):
${transcript}

TASK:
Create 2-3 distinct scripts based on concrete details, numbers and experiences from the conversation.
Each script should take a different approach — e.g.:
- Personal story (chronological, turning points)
- Controversial hot take or strong opinion
- List of concrete tips or learnings
- Directly addressing a problem of the dream customer

RULES:
- Authenticity: write how the creator actually speaks
- Use concrete numbers, names and phrasings from the conversation
- Hook: max 2 sentences, immediately gripping, no clichés
- Body: no filler words, spoken English
- CTA: clear and concrete
- Each script must stand on its own and be strong${trainingContext}`
          : `Du bist ein erfahrener Social-Media-Texter. Erstelle 2-3 starke Video-Skripte aus diesem Gespräch.

KUNDENPROFIL:
${clientContext}

STRATEGIE-PILLARS: ${pillarList}

GESPRÄCH (Rohmaterial):
${transcript}

AUFGABE:
Erstelle 2-3 verschiedene Skripte die auf den konkreten Details, Zahlen und Erfahrungen aus dem Gespräch basieren.
Jedes Skript soll eine andere Herangehensweise haben — z.B.:
- Persönliche Story (chronologisch, Wendepunkte)
- Kontroverser Hot Take oder starke Meinung
- Liste mit konkreten Tipps oder Learnings
- Direktes Ansprechen eines Problems des Traumkunden

REGELN:
- Authentizität: schreibe wie der Creator selbst spricht
- Verwende die konkreten Zahlen, Namen und Formulierungen aus dem Gespräch
- Hook: max 2 Sätze, sofort fesselnd, keine Floskel
- Body: kein Füllwort, gesprochenes Deutsch
- CTA: klar und konkret
- Jedes Skript muss eigenständig und stark sein${trainingContext}`,
      },
    ],
  });

  const tool = msg.content.find((b) => b.type === "tool_use");
  if (!tool || tool.type !== "tool_use") {
    return NextResponse.json({ error: lang === "en" ? "AI did not generate scripts" : "KI hat keine Skripte generiert" }, { status: 500 });
  }

  const { scripts } = tool.input as {
    scripts: { title: string; pillar: string; contentType: string; format: string; hook: string; hookPattern?: string; body: string; cta: string }[];
  };

  const existing = await readScripts();
  const now = new Date().toISOString();
  const newScripts = scripts.map((s) => ({
    id: uuid(),
    clientId: id,
    title: s.title || "",
    pillar: s.pillar || "",
    contentType: s.contentType || "",
    format: s.format || "",
    hook: s.hook || "",
    hookPattern: s.hookPattern || "",
    textHook: "",
    body: s.body || "",
    cta: s.cta || "",
    status: "entwurf",
    source: "",
    shotList: "",
    createdAt: now,
  }));

  await writeScripts([...existing, ...newScripts]);

  return NextResponse.json({ count: newScripts.length, scriptIds: newScripts.map((s) => s.id) });
}
