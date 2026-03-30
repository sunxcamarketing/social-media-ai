import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), { status: 500 });

  const body = await request.json().catch(() => ({}));
  const { instruction, hook, body: scriptBody, cta } = body as {
    instruction?: string;
    hook?: string;
    body?: string;
    cta?: string;
  };

  if (!instruction) return new Response(JSON.stringify({ error: "instruction required" }), { status: 400 });
  if (!hook && !scriptBody && !cta) return new Response(JSON.stringify({ error: "script content required" }), { status: 400 });

  const claude = new Anthropic({ apiKey });

  const msg = await claude.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: `Du bist ein Elite-Skriptschreiber für Instagram Reels. Du bekommst ein bestehendes Skript und eine Anweisung was geändert werden soll. Führe NUR die gewünschte Änderung durch. Behalte alles andere exakt bei — Länge, Stil, Struktur, Tonfall. Antworte NUR mit einem JSON-Objekt: { "hook": "...", "body": "...", "cta": "..." }. Kein anderer Text.`,
    messages: [{
      role: "user",
      content: `Aktuelles Skript:\n\nHook: ${hook || ""}\n\nBody: ${scriptBody || ""}\n\nCTA: ${cta || ""}\n\n---\n\nAnweisung: ${instruction}`,
    }],
  });

  const text = msg.content.find(b => b.type === "text")?.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return new Response(JSON.stringify({ error: "KI-Antwort konnte nicht geparst werden" }), { status: 500 });

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify({
      hook: parsed.hook || hook || "",
      body: parsed.body || scriptBody || "",
      cta: parsed.cta || cta || "",
    }));
  } catch {
    return new Response(JSON.stringify({ error: "KI-Antwort konnte nicht geparst werden" }), { status: 500 });
  }
}
