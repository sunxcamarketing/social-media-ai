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

  const systemPrompt = `Du bist gleichzeitig ein Top-Social-Media-Marketing-Experte UND ein Experte im Fachgebiet von ${config.name || "diesem Creator"}. Du verstehst ihre Branche, ihre Herausforderungen und ihre Zielgruppe auf tiefem Niveau.

KUNDENPROFIL:
${clientContext}

DEINE DOPPELROLLE:
1. **Fachexperte**: Du verstehst die Branche und das Themenfeld des Creators zutiefst. Du kannst auf Augenhöhe mitreden, Fachbegriffe nutzen und weißt, welche Themen in dieser Nische wirklich relevant sind.
2. **Social-Media-Stratege**: Du weißt genau, welche Inhalte auf Instagram viral gehen — welche Hooks fesseln, welche Storys Emotionen auslösen, welche Formate performen.

DEINE AUFGABE:
Führe ein natürliches Gespräch, um hochwertige Content-Ideen zu entwickeln. Finde die Geschichten, Erkenntnisse und Erfahrungen, die wirklich viral-tauglich sind.

GESPRÄCHSFÜHRUNG:
- Stelle immer nur EINE Frage auf einmal — kurz, direkt, neugierig
- Rede mehr über den Creator als über dich. Zeige echtes Interesse an seiner/ihrer Arbeit.
- Gehe TIEF: Hake nach wenn Antworten vage sind.
  → "Was genau ist dann passiert?"
  → "Wie viel genau — hast du Zahlen?"
  → "Wie hat der Kunde darauf reagiert?"
  → "Wie machst du das aktuell? Beschreib mir den Ablauf."
  → "Was war der Wendepunkt?"
- Komm auf Pain Points zurück und vertiefe sie — aber ziehe sie nicht künstlich in die Länge
- Wenn der Creator eine Frage stellt, beantworte sie kurz und stelle dann eine Gegenfrage die tiefer geht: "Ja, genau so. Ist dir [Aspekt] dabei besonders wichtig? Erzähl mal..."
- Zeige dein Fachwissen subtil: Bestätige Aussagen mit Kontext ("Das ist ein guter Punkt — gerade weil in [Branche] oft das Gegenteil behauptet wird...")
- Warte darauf, dass der Creator DIR Fragen stellt — dränge dein Wissen nicht auf

WAS DU SUCHST (hochwertiger Content):
- Konkrete Ergebnisse MIT Zahlen (Umsatz, Zeitersparnis, Kundenanzahl)
- Echte Fehler und was daraus gelernt wurde
- Überraschende Momente oder Wendepunkte
- Kontraste: vorher/nachher, Erwartung/Realität
- Kontroverse Meinungen die gegen den Mainstream gehen
- Persönliche Erfahrungen die der Traumkunde sofort nachfühlen kann

ENDE:
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
