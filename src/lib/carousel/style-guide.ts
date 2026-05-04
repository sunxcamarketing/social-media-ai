// ── Carousel Style Guide loader ───────────────────────────────────────────
// Tiny helper used by both the generation pipeline and the chat-refine route
// to fetch a saved style-guide row and format it as a markdown block ready
// for {{style_guide}} substitution. Empty string if no guide is selected.

import { supabase } from "../supabase";

interface StyleGuideRow {
  id: string;
  name: string;
  prompt: string;
  client_id: string | null;
}

/**
 * Loads the style guide by id and returns a markdown block formatted for
 * insertion into the carousel prompt. Returns "" if no id given or the row
 * isn't found, so callers can pass the result straight into buildPrompt.
 */
export async function loadStyleGuideBlock(
  styleGuideId: string | null | undefined,
  lang: "de" | "en",
): Promise<string> {
  if (!styleGuideId) return "";

  const { data, error } = await supabase
    .from("carousel_style_guides")
    .select("id, name, prompt, client_id")
    .eq("id", styleGuideId)
    .single();

  if (error || !data) return "";
  const row = data as StyleGuideRow;

  const header = lang === "en" ? "Active Style Guide" : "Aktiver Style Guide";
  const subhead =
    lang === "en"
      ? `The user picked the "${row.name}" guide. This guide is the **highest authority** for visual decisions on this run — fonts, colors, spacing, layout patterns mentioned here OVERRIDE the curated font palette and any other styling defaults further down in this prompt. If the guide names a specific font (e.g. "Manrope", "Söhne", "DIN"), use that font name literally in fontFamily declarations even if it's not in the default palette — the host loads it dynamically. Only fall back to defaults for things the guide doesn't address.`
      : `Der User hat den Guide "${row.name}" gewählt. Dieser Guide ist die **höchste Autorität** für visuelle Entscheidungen in diesem Run — Schriftarten, Farben, Spacing, Layout-Muster die hier genannt werden ÜBERSCHREIBEN die kuratierte Font-Palette und alle anderen Styling-Defaults weiter unten im Prompt. Wenn der Guide eine spezifische Schriftart nennt (z.B. "Manrope", "Söhne", "DIN"), nutze den Font-Namen wörtlich in fontFamily-Deklarationen, auch wenn er nicht in der Default-Palette steht — der Host lädt ihn dynamisch nach. Nur bei Dingen die der Guide nicht adressiert greifen die Defaults.`;

  return [`## ${header}: ${row.name}`, "", subhead, "", row.prompt.trim()].join("\n");
}
