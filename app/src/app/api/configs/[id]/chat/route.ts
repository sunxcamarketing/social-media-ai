import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readConfigs } from "@/lib/csv";

export const maxDuration = 60;

const OPENING_MESSAGE =
  "Lass uns gemeinsam eine Idee entwickeln. **Was ist dir diese Woche passiert — mit einem Kunden, in deiner Arbeit, oder als Erkenntnis — das andere wissen sollten?**";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const configs = readConfigs();
  const config = configs.find((c) => c.id === id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const messages: { role: "user" | "assistant"; content: string }[] = body.messages || [];

  // Return opening message if no conversation yet
  if (messages.length === 0) {
    return NextResponse.json({ message: OPENING_MESSAGE });
  }

  const dreamCustomer = (() => {
    try { return JSON.parse(config.dreamCustomer || "{}"); } catch { return {}; }
  })();

  const pillars: { name: string; description?: string }[] = (() => {
    try { return JSON.parse(config.strategyPillars || "[]") || []; } catch { return []; }
  })();

  const clientContext = [
    config.name              && `Name: ${config.name}`,
    config.role              && `Rolle: ${config.role}`,
    config.company           && `Unternehmen: ${config.company}`,
    config.creatorsCategory  && `Nische: ${config.creatorsCategory}`,
    config.businessContext   && `Business-Kontext: ${config.businessContext}`,
    config.brandProblem      && `Kernproblem den Kunden: ${config.brandProblem}`,
    config.brandingStatement && `Branding-Statement: ${config.brandingStatement}`,
    dreamCustomer.description && `Traumkunde: ${dreamCustomer.description}`,
    dreamCustomer.profession  && `Traumkunden-Beruf: ${dreamCustomer.profession}`,
    pillars.length > 0 && `Content-Pillars: ${pillars.map(p => p.name).join(", ")}`,
  ].filter(Boolean).join("\n");

  const systemPrompt = `Du bist ein erfahrener Content-Stratege. Du hilfst ${config.name || "diesem Creator"} dabei, echte Ideen für Instagram Reels zu entwickeln — basierend auf seinen eigenen Erfahrungen, Geschichten und Erkenntnissen.

KUNDENPROFIL:
${clientContext}

DEINE AUFGABE:
Stelle gezielte Fragen, um echte Stories, Insights und konkrete Erfahrungen herauszufinden, die als Grundlage für ein virales Instagram Reel dienen.

REGELN:
- Stelle immer nur EINE Frage auf einmal — kurz, direkt, neugierig
- Gehe tief: Hake nach wenn Antworten vage sind. "Was genau passierte dann?", "Wie viel genau?", "Was hast du dabei gefühlt?", "Wie hat der Kunde reagiert?"
- Suche nach: konkreten Ergebnissen mit Zahlen, echten Fehlern und Learnings, überraschenden Momenten, Kontrast (vorher/nachher), Widersprüchen zu gängigen Meinungen
- Wenn du nach 3-4 Austauschen genug Kontext für ein starkes Skript hast, beende deine Antwort mit dem exakten Satz: "Ich habe genug um ein starkes Skript zu schreiben. Soll ich?"
- Antworte kurz (2-4 Sätze max) — du führst ein Gespräch, kein Interview

Antworte auf Deutsch.`;

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 350,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
