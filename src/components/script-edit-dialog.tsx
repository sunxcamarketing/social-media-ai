"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Script } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "entwurf", label: "Entwurf" },
  { value: "bereit", label: "Bereit" },
  { value: "review", label: "Review" },
];

export type ScriptEditForm = {
  title: string;
  pillar: string;
  contentType: string;
  format: string;
  status: string;
  hook: string;
  body: string;
  cta: string;
  textHook: string;
  visualHook: string;
  bRoll: string;
  shotList: string;
  caption: string;
};

export const EMPTY_SCRIPT_FORM: ScriptEditForm = {
  title: "",
  pillar: "",
  contentType: "",
  format: "",
  status: "entwurf",
  hook: "",
  body: "",
  cta: "",
  textHook: "",
  visualHook: "",
  bRoll: "",
  shotList: "",
  caption: "",
};

export function scriptToForm(s: Script): ScriptEditForm {
  return {
    title: s.title || "",
    pillar: s.pillar || "",
    contentType: s.contentType || "",
    format: s.format || "",
    status: s.status || "entwurf",
    hook: s.hook || "",
    body: s.body || "",
    cta: s.cta || "",
    textHook: s.textHook || "",
    visualHook: s.visualHook || "",
    bRoll: s.bRoll || "",
    shotList: s.shotList || "",
    caption: s.caption || "",
  };
}

function DocField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 md:gap-8 items-start py-4 border-b border-ocean/[0.05] last:border-0">
      <div className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-ocean">{label}</p>
        {hint && <p className="text-[11px] text-ocean/45 mt-1 leading-snug">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ScriptEditDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  mode,
  saving = false,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ScriptEditForm;
  onFormChange: (form: ScriptEditForm) => void;
  mode: "new" | "edit";
  saving?: boolean;
  onSave: () => void | Promise<void>;
}) {
  const setForm = onFormChange;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-[1200px] w-[95vw] max-h-[92vh] overflow-y-auto rounded-2xl border-ocean/[0.06] bg-warm-white p-0"
        showCloseButton={false}
      >
        <div className="sticky top-0 z-10 bg-warm-white/95 backdrop-blur border-b border-ocean/[0.06] px-8 py-4 flex items-center justify-between gap-4">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-xs font-medium text-ocean/45 uppercase tracking-wider">
              {mode === "edit" ? "Skript bearbeiten" : "Neues Skript"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onOpenChange(false)} className="text-xs text-ocean/55 hover:text-ocean px-2">
              Abbrechen
            </button>
            <Button
              onClick={() => onSave()}
              disabled={saving}
              className="h-9 px-5 rounded-xl bg-ocean hover:bg-ocean-light border-0 text-white text-xs"
            >
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </div>

        <div className="px-12 py-10">
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Skript-Titel"
            className="w-full bg-transparent text-3xl font-semibold text-ocean leading-tight outline-none placeholder:text-ocean/25 focus:placeholder:text-ocean/15 mb-6"
          />

          <div className="flex flex-wrap items-center gap-3 text-xs mb-6">
            <div className="flex items-center gap-1.5">
              <span className="text-ocean/40 uppercase text-[10px] tracking-wider">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="bg-white border border-ocean/[0.08] rounded-md px-2 py-1 text-xs text-ocean focus:outline-none focus:border-ocean/30"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-ocean/40 uppercase text-[10px] tracking-wider">Pillar</span>
              <Input
                value={form.pillar}
                onChange={(e) => setForm({ ...form, pillar: e.target.value })}
                placeholder="—"
                className="h-7 w-32 rounded-md border-ocean/[0.08] bg-white text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-ocean/40 uppercase text-[10px] tracking-wider">Content-Type</span>
              <Input
                value={form.contentType}
                onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                placeholder="—"
                className="h-7 w-36 rounded-md border-ocean/[0.08] bg-white text-xs"
              />
            </div>
          </div>

          <div className="border-t border-ocean/[0.08]" />

          <DocField label="Format">
            <Input
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value })}
              placeholder='z.B. Talking Head, Voiceover + B-Roll, Storytelling'
              className="rounded-lg border-ocean/[0.08] h-10 text-sm bg-white"
            />
          </DocField>

          <DocField label="Text Hook" hint="Was on-screen eingeblendet wird">
            <Input
              value={form.textHook}
              onChange={(e) => setForm({ ...form, textHook: e.target.value })}
              placeholder='z.B. „94 kg → 65 kg"'
              className="rounded-lg border-ocean/[0.08] h-10 text-sm bg-white"
            />
          </DocField>

          <DocField label="Visual Hook" hint="Was visuell zu sehen ist in den ersten Sekunden">
            <Input
              value={form.visualHook}
              onChange={(e) => setForm({ ...form, visualHook: e.target.value })}
              placeholder="z.B. Talking head + Spiegel-Cut"
              className="rounded-lg border-ocean/[0.08] h-10 text-sm bg-white"
            />
          </DocField>

          <DocField label="Audio Hook" hint="Erster gesprochener Satz">
            <Textarea
              value={form.hook}
              onChange={(e) => setForm({ ...form, hook: e.target.value })}
              rows={2}
              placeholder='z.B. „Letzte Woche bot mir ein Makler 15 % Rendite."'
              className="rounded-lg border-ocean/[0.08] text-sm leading-relaxed bg-white"
            />
          </DocField>

          <DocField label="Skript" hint="Der Body — Hauptteil zwischen Hook und CTA">
            <Textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={12}
              placeholder="Skript-Text…"
              className="rounded-lg border-ocean/[0.08] text-[15px] leading-relaxed bg-white"
            />
          </DocField>

          <DocField label="CTA" hint="Schlussaufruf — was soll der Zuschauer tun">
            <Textarea
              value={form.cta}
              onChange={(e) => setForm({ ...form, cta: e.target.value })}
              rows={2}
              placeholder='z.B. „Schreib REAL in die DMs für echte Netto-Renditen."'
              className="rounded-lg border-ocean/[0.08] text-sm leading-relaxed bg-white"
            />
          </DocField>

          <DocField label="Shot Liste" hint="Was der Kunde zusätzlich filmen muss — eine Zeile pro Shot. Leer lassen wenn nichts zusätzlich nötig.">
            <Textarea
              value={form.bRoll}
              onChange={(e) => setForm({ ...form, bRoll: e.target.value })}
              rows={4}
              placeholder='z.B.&#10;Hände am Laptop, Trading-Chart auf dem Bildschirm&#10;Kaffee am Küchentisch, Schulterblick&#10;Spaziergang draußen, Sonnenuntergang'
              className="rounded-lg border-ocean/[0.08] text-sm leading-relaxed bg-white"
            />
          </DocField>

          <DocField label="Videobeschreibung" hint="Caption mit Hashtags, Emojis, Folge-CTA">
            <Textarea
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              rows={4}
              placeholder="Instagram-Caption…"
              className="rounded-lg border-ocean/[0.08] text-sm leading-relaxed bg-white"
            />
          </DocField>

          <details className="border-t border-ocean/[0.08] pt-5 group">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-ocean/45 hover:text-ocean inline-flex items-center gap-1 list-none">
              <span className="inline-block transition-transform group-open:rotate-90">▸</span>
              Production Notes (für Editor)
            </summary>
            <div className="mt-4">
              <DocField label="Schnitt & Pacing" hint="Sekunden-Regie, Schnitte, Pacing-Hinweise — nur für den Editor">
                <Textarea
                  value={form.shotList}
                  onChange={(e) => setForm({ ...form, shotList: e.target.value })}
                  rows={3}
                  className="rounded-lg border-ocean/[0.08] text-sm bg-white"
                />
              </DocField>
            </div>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}
