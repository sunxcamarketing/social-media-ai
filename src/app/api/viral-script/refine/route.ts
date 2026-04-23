import { getAnthropicClient } from "@/lib/anthropic";
import { readConfig } from "@/lib/csv";

export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { instruction, hook, body: scriptBody, cta, clientId } = body as {
    instruction?: string;
    hook?: string;
    body?: string;
    cta?: string;
    clientId?: string;
  };

  if (!instruction) return new Response(JSON.stringify({ error: "instruction required" }), { status: 400 });
  if (!hook && !scriptBody && !cta) return new Response(JSON.stringify({ error: "script content required" }), { status: 400 });

  let lang: "de" | "en" = "de";
  if (clientId) {
    const config = await readConfig(clientId);
    if (config?.language === "en") lang = "en";
  }

  const claude = getAnthropicClient();

  const system = lang === "en"
    ? `You are an elite scriptwriter for Instagram Reels. You receive an existing script and an instruction on what to change. Execute ONLY the requested change. Keep everything else exactly as it was — length, style, structure, tone. Respond with ONLY a JSON object: { "hook": "...", "body": "...", "cta": "..." }. No other text. Write in English.`
    : `Du bist ein Elite-Skriptschreiber für Instagram Reels. Du bekommst ein bestehendes Skript und eine Anweisung was geändert werden soll. Führe NUR die gewünschte Änderung durch. Behalte alles andere exakt bei — Länge, Stil, Struktur, Tonfall. Antworte NUR mit einem JSON-Objekt: { "hook": "...", "body": "...", "cta": "..." }. Kein anderer Text.`;

  const userContent = lang === "en"
    ? `Current script:\n\nHook: ${hook || ""}\n\nBody: ${scriptBody || ""}\n\nCTA: ${cta || ""}\n\n---\n\nInstruction: ${instruction}`
    : `Aktuelles Skript:\n\nHook: ${hook || ""}\n\nBody: ${scriptBody || ""}\n\nCTA: ${cta || ""}\n\n---\n\nAnweisung: ${instruction}`;

  const msg = await claude.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system,
    messages: [{
      role: "user",
      content: userContent,
    }],
  });

  const text = msg.content.find(b => b.type === "text")?.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parseError = lang === "en" ? "Could not parse AI response" : "KI-Antwort konnte nicht geparst werden";
  if (!jsonMatch) return new Response(JSON.stringify({ error: parseError }), { status: 500 });

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify({
      hook: parsed.hook || hook || "",
      body: parsed.body || scriptBody || "",
      cta: parsed.cta || cta || "",
    }));
  } catch {
    return new Response(JSON.stringify({ error: parseError }), { status: 500 });
  }
}
