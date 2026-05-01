// ── ClickUp Sync (shared) ──────────────────────────────────────────────────
// Loads a script + its client config, builds the Script object, calls the
// upsert. Used by both the auto-trigger (client approval) and the admin
// "manuell senden" button. The two callers want different shapes:
//
//   - feedback route: fire-and-forget, errors logged not surfaced
//   - admin button:   needs success/error result to show in the UI
//
// So the core helper returns a structured result. Callers decide how to
// react to errors.

import { supabase } from "@/lib/supabase";
import { readConfig, mapScript } from "@/lib/csv";
import { upsertScriptCard } from "@/lib/clickup";

export type SyncResult =
  | { ok: true; taskId: string; created: boolean }
  | { ok: false; reason: "no-config" | "no-list" | "no-script" | "api-error"; message: string };

export async function syncScriptToClickUp(scriptId: string): Promise<SyncResult> {
  const { data: scriptRow, error: sErr } = await supabase
    .from("scripts")
    .select("*")
    .eq("id", scriptId)
    .maybeSingle();
  if (sErr || !scriptRow) {
    return { ok: false, reason: "no-script", message: sErr?.message || "Script nicht gefunden" };
  }

  const script = mapScript(scriptRow);
  const config = await readConfig(script.clientId);
  if (!config) {
    return { ok: false, reason: "no-config", message: `Kein Config für Client ${script.clientId}` };
  }
  if (!config.clickupListId) {
    return { ok: false, reason: "no-list", message: "Für diesen Kunden ist keine ClickUp-Liste verknüpft" };
  }

  try {
    const { taskId, created } = await upsertScriptCard({ config, script });
    if (created) {
      await supabase.from("scripts").update({ clickup_card_id: taskId }).eq("id", scriptId);
    }
    return { ok: true, taskId, created };
  } catch (err) {
    return { ok: false, reason: "api-error", message: err instanceof Error ? err.message : String(err) };
  }
}
