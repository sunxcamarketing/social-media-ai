import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readConfig, updateConfig } from "@/lib/csv";
import { getAnthropicClient } from "@/lib/anthropic";

export const maxDuration = 60;

/**
 * GET — Return current voice training notes + generated profile.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = await readConfig(id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    voiceNotes: config.voiceNotes || "",
    voiceExamples: config.voiceExamples || "",
    voiceProfile: config.voiceProfile || "",
  });
}

/**
 * POST — Save voice training notes + example scripts, then auto-generate
 * a voice profile from them using Claude.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const config = await readConfig(id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { voiceNotes, voiceExamples } = await req.json();

  // Save the raw notes
  await updateConfig(id, {
    voiceNotes: voiceNotes || "",
    voiceExamples: voiceExamples || "",
  } as Record<string, string>);

  // Auto-generate structured voice profile from notes + examples
  const hasContent = (voiceNotes || "").trim().length > 20 || (voiceExamples || "").trim().length > 50;
  if (!hasContent) {
    // Not enough data — clear profile
    await updateConfig(id, { voiceProfile: "" });
    return NextResponse.json({ success: true, profileGenerated: false });
  }

  try {
    const claude = getAnthropicClient();
    const clientName = config.configName || config.name || "Client";
    const lang: "de" | "en" = config.language === "en" ? "en" : "de";

    const system = lang === "en"
      ? "You are a language analyst. Extract a structured voice profile from the given notes and example scripts. Respond in English."
      : "Du bist ein Sprachanalyst. Extrahiere ein strukturiertes Stimmprofil aus den gegebenen Notizen und Beispielskripten.";

    const toolDescription = lang === "en" ? "Save the extracted voice profile" : "Speichere das extrahierte Stimmprofil";
    const toolProps = lang === "en"
      ? {
          summary: { type: "string", description: "1-2 sentence summary of the speaking style" },
          tone: { type: "string", description: "Base tone (e.g. direct, warm, provocative, matter-of-fact)" },
          energy: { type: "string", description: "Energy level (e.g. high, calm, variable)" },
          avgSentenceLength: { type: "number", description: "Average sentence length in words" },
          favoriteWords: { type: "array", items: { type: "string" }, description: "5-10 typical words/phrases" },
          slangMarkers: { type: "array", items: { type: "string" }, description: "Colloquialisms, dialect, slang" },
          avoidedPatterns: { type: "array", items: { type: "string" }, description: "What this person does NOT say" },
          sentencePatterns: { type: "string", description: "How are sentences built? Short? Nested? Questions?" },
          exampleSentences: { type: "array", items: { type: "string" }, description: "3-5 typical example sentences in this person's style" },
        }
      : {
          summary: { type: "string", description: "1-2 Sätze Zusammenfassung des Sprechstils" },
          tone: { type: "string", description: "Grundton (z.B. direkt, warm, provokant, sachlich)" },
          energy: { type: "string", description: "Energielevel (z.B. hoch, ruhig, wechselnd)" },
          avgSentenceLength: { type: "number", description: "Durchschnittliche Satzlänge in Wörtern" },
          favoriteWords: { type: "array", items: { type: "string" }, description: "5-10 typische Wörter/Phrasen" },
          slangMarkers: { type: "array", items: { type: "string" }, description: "Umgangssprache, Dialekt, Slang" },
          avoidedPatterns: { type: "array", items: { type: "string" }, description: "Was diese Person NICHT sagt" },
          sentencePatterns: { type: "string", description: "Wie sind Sätze aufgebaut? Kurz? Verschachtelt? Fragen?" },
          exampleSentences: { type: "array", items: { type: "string" }, description: "3-5 typische Beispielsätze im Stil dieser Person" },
        };

    const userPrompt = lang === "en"
      ? `Create a voice profile for ${clientName} based on the following information:

## STYLE NOTES
${voiceNotes || "(no notes)"}

## EXAMPLE SCRIPTS / TEXTS
${voiceExamples || "(no examples)"}

Extract a precise voice profile. Pay particular attention to: favorite words, sentence length, tone, energy, and what this person does NOT say.`
      : `Erstelle ein Stimmprofil für ${clientName} basierend auf diesen Informationen:

## NOTIZEN ZUM STIL
${voiceNotes || "(keine Notizen)"}

## BEISPIEL-SKRIPTE / TEXTE
${voiceExamples || "(keine Beispiele)"}

Extrahiere daraus ein präzises Stimmprofil. Achte besonders auf: Lieblingswörter, Satzlänge, Ton, Energie, was die Person NICHT sagt.`;

    const response = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system,
      tools: [{
        name: "save_voice_profile",
        description: toolDescription,
        input_schema: {
          type: "object" as const,
          properties: toolProps,
          required: ["summary", "tone", "energy", "avgSentenceLength", "favoriteWords", "slangMarkers", "avoidedPatterns", "sentencePatterns", "exampleSentences"],
        },
      }],
      tool_choice: { type: "tool", name: "save_voice_profile" },
      messages: [{
        role: "user",
        content: userPrompt,
      }],
    });

    const toolBlock = response.content.find(b => b.type === "tool_use");
    if (toolBlock && toolBlock.type === "tool_use") {
      await updateConfig(id, { voiceProfile: JSON.stringify(toolBlock.input) });
      return NextResponse.json({ success: true, profileGenerated: true, profile: toolBlock.input });
    }

    return NextResponse.json({ success: true, profileGenerated: false });
  } catch (err) {
    console.error("[voice-training] profile generation failed:", err);
    // Notes are saved even if profile generation fails
    return NextResponse.json({ success: true, profileGenerated: false, error: "Profil konnte nicht generiert werden" });
  }
}
