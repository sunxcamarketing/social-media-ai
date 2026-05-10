import { NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";
import { trackClaudeCost } from "@/lib/cost-tracking";
import { MODEL_SONNET } from "@/lib/models";
import { validateTsx } from "@/lib/carousel/validate-tsx";

export const maxDuration = 120;

// Auto-repair a carousel whose TSX has a syntax error. We hand the broken
// code + the parse error message to Sonnet with strict "fix syntax only,
// don't change content/layout" instructions. Used by the preview's
// "Auto-Reparieren" button when Babel fails to parse the current code.

const REPAIR_SYSTEM_PROMPT = `Du bekommst einen Instagram-Carousel-TSX-Code der einen Syntax-Fehler enthält. Deine EINZIGE Aufgabe: den Syntax-Fehler reparieren.

VERBOTEN:
- Inhalte ändern (Texte, Slide-Anzahl, Layout, Farben, Klassen)
- Helper-Komponenten umbenennen oder entfernen
- Slides hinzufügen / entfernen
- Design-Entscheidungen anders treffen

ERLAUBT:
- Fehlende JSX-Bodies vervollständigen (typisch: "const Foo = (props) => (" ohne schließenden Body — füg den fehlenden JSX + ");" zurück basierend auf dem Pattern der anderen Helper-Komponenten)
- Fehlende schließende Klammern/Tags ergänzen
- Typografische-Quote-Probleme reparieren ("…„text"" → "…„text"")
- Trailing-Comma-Probleme

Gib NUR den reparierten TSX-Code zurück, kein Markdown, kein Kommentar, keine Erklärung. Beginne direkt mit den const/function-Deklarationen, ende nach der letzten });`;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: runId } = await params;

  const { data: carousel, error: loadErr } = await supabase
    .from("carousels")
    .select("client_id, tsx_code")
    .eq("run_id", runId)
    .single();
  if (loadErr || !carousel) {
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }
  if (!carousel.tsx_code) {
    return NextResponse.json({ error: "Kein TSX-Code zum Reparieren" }, { status: 400 });
  }

  // Clients can only repair their own carousels.
  const isClientView = user.role === "client" || !!user.impersonating;
  if (isClientView) {
    const effective = getEffectiveClientId(user);
    if (effective !== carousel.client_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const userPrompt = `Repariere den Syntax-Fehler in diesem TSX-Code. Inhalt UNVERÄNDERT lassen.\n\n\`\`\`tsx\n${carousel.tsx_code}\n\`\`\``;

  const client = getAnthropicClient();
  let response;
  try {
    response = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 16000,
      system: REPAIR_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
  } catch (err) {
    return NextResponse.json({ error: `Repair-Call fehlgeschlagen: ${(err as Error).message}` }, { status: 500 });
  }

  trackClaudeCost({
    usage: response.usage,
    model: MODEL_SONNET,
    clientId: carousel.client_id,
    userId: user.id,
    operation: "carousel_repair",
    initiator: "admin",
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  if (!text) {
    return NextResponse.json({ error: "Sonnet hat leeren Output zurückgegeben" }, { status: 502 });
  }

  // Strip code fences if Sonnet ignored the instruction
  let repaired = text;
  if (repaired.startsWith("```")) {
    repaired = repaired.replace(/^```(?:tsx|jsx|javascript|js|typescript|ts)?\s*\n?/i, "");
    repaired = repaired.replace(/\n?```\s*$/i, "");
    repaired = repaired.trim();
  }

  // Quick sanity: must contain `function Carousel`. Otherwise Sonnet went off-script.
  if (!/\bfunction\s+Carousel\s*\(/.test(repaired)) {
    return NextResponse.json({ error: "Reparatur ungültig — function Carousel fehlt im Output" }, { status: 502 });
  }

  // Hard validate — if the "repair" still doesn't parse, refuse to save.
  // Otherwise we'd just swap one broken state for another.
  const validation = validateTsx(repaired);
  if (!validation.ok) {
    return NextResponse.json(
      { error: `Reparatur hat den Syntax-Fehler nicht behoben: ${validation.error}` },
      { status: 502 },
    );
  }

  const { error: saveErr } = await supabase
    .from("carousels")
    .update({ tsx_code: repaired, updated_at: new Date().toISOString() })
    .eq("run_id", runId);
  if (saveErr) {
    return NextResponse.json({ error: `DB-Save fehlgeschlagen: ${saveErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tsxCode: repaired });
}
