"use client";

import { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, BookOpen, Filter,
  ChevronDown, ChevronUp, Target, FileText, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import type { ContentType, ContentFormat } from "@/lib/strategy";
// BUILT_IN_CONTENT_TYPES used in ContentTypesTab only
import type { TrainingScript } from "@/lib/types";

// ── Colour map ──────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  "Authority":                "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Story / Personality":      "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "Social Proof":             "bg-green-500/10 text-green-400 border-green-500/20",
  "Education / Value":        "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Opinion / Polarisation":   "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Behind the Scenes":        "bg-slate-500/10 text-slate-400 border-slate-500/20",
  "Inspiration / Motivation": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Entertainment":            "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Community / Interaction":  "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "Promotion / Offer":        "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function formatDate(iso: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso.split("T")[0]; }
}

// ── Tab bar ─────────────────────────────────────────────────────────────────
type Tab = "scripts" | "types" | "formats";

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "scripts", label: "Training Scripts", icon: BookOpen },
    { id: "types",   label: "Content Types",    icon: Target },
    { id: "formats", label: "Content Formate",  icon: FileText },
  ];
  return (
    <div className="flex gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1 w-fit">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${
            active === id
              ? "bg-white/[0.08] text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — Training Scripts
// ═══════════════════════════════════════════════════════════════════════════

const EMPTY_SCRIPT: Omit<TrainingScript, "id" | "createdAt"> = {
  format: "", textHook: "", visualHook: "", audioHook: "", script: "", cta: "",
};

function ScriptCard({ script, onEdit, onDelete }: {
  script: TrainingScript;
  onEdit: (s: TrainingScript) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = script.script.split("\n").length > 5 || script.script.length > 320;

  return (
    <div className="glass rounded-2xl border border-white/[0.06] p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {script.format && (
            <Badge className="rounded-lg border text-[11px] font-medium px-2 py-0.5 bg-white/5 text-muted-foreground border-white/10">
              {script.format}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(script)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { if (confirm("Skript wirklich löschen?")) onDelete(script.id); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {script.textHook && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">Text Hook</p>
            <p className="text-[13px] text-foreground/80 leading-relaxed">{script.textHook}</p>
          </div>
        )}
        {script.visualHook && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">Visual Hook</p>
            <p className="text-[13px] text-foreground/80 leading-relaxed">{script.visualHook}</p>
          </div>
        )}
        {script.audioHook && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">Audio Hook</p>
            <p className="text-[13px] text-foreground/80 leading-relaxed">{script.audioHook}</p>
          </div>
        )}
        {script.script && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">Skript</p>
            <p className={`text-[13px] text-foreground/80 leading-relaxed whitespace-pre-wrap ${!expanded ? "line-clamp-5" : ""}`}>
              {script.script}
            </p>
            {long && (
              <button onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors mt-1">
                {expanded ? <><ChevronUp className="h-3 w-3" /> Weniger</> : <><ChevronDown className="h-3 w-3" /> Mehr</>}
              </button>
            )}
          </div>
        )}
        {script.cta && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">CTA</p>
            <p className="text-[13px] text-foreground/80 leading-relaxed">{script.cta}</p>
          </div>
        )}
      </div>

      <div className="pt-1 border-t border-white/[0.05]">
        <span className="text-[11px] text-muted-foreground/50">{formatDate(script.createdAt)}</span>
      </div>
    </div>
  );
}

function ScriptsTab() {
  const [scripts, setScripts] = useState<TrainingScript[]>([]);
  const [allFormats, setAllFormats] = useState<ContentFormat[]>(BUILT_IN_FORMATS);
  const [loading, setLoading] = useState(true);
  const [filterFormat, setFilterFormat] = useState("Alle");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingScript | null>(null);
  const [form, setForm] = useState<Omit<TrainingScript, "id" | "createdAt">>(EMPTY_SCRIPT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/training-scripts").then(r => r.json()),
      fetch("/api/strategy").then(r => r.json()),
    ]).then(([scripts, strategy]) => {
      setScripts(scripts);
      setAllFormats([...BUILT_IN_FORMATS, ...(strategy.customFormats || [])]);
    }).finally(() => setLoading(false));
  }, []);

  function openAdd() { setEditing(null); setForm(EMPTY_SCRIPT); setDialogOpen(true); }
  function openEdit(s: TrainingScript) {
    setEditing(s);
    setForm({ format: s.format, textHook: s.textHook, visualHook: s.visualHook, audioHook: s.audioHook, script: s.script, cta: s.cta });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        const updated = await fetch("/api/training-scripts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: editing.id, createdAt: editing.createdAt }) }).then(r => r.json());
        setScripts(prev => prev.map(s => s.id === updated.id ? updated : s));
      } else {
        const created = await fetch("/api/training-scripts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then(r => r.json());
        setScripts(prev => [created, ...prev]);
      }
      setDialogOpen(false);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/training-scripts?id=${id}`, { method: "DELETE" });
    setScripts(prev => prev.filter(s => s.id !== id));
  }

  const filtered = scripts.filter(s => filterFormat === "Alle" || s.format === filterFormat);

  return (
    <>
      {/* Filter bar + Add button */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filter:
        </div>
        <div className="relative">
          <select value={filterFormat} onChange={e => setFilterFormat(e.target.value)}
            className="h-8 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 pr-8 text-[12px] text-foreground appearance-none cursor-pointer focus:outline-none">
            <option value="Alle">Alle Formate</option>
            {allFormats.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
        {filterFormat !== "Alle" && (
          <button onClick={() => setFilterFormat("Alle")}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2">
            Zurücksetzen
          </button>
        )}
        <span className="text-[12px] text-muted-foreground/50">{filtered.length} {filtered.length === 1 ? "Skript" : "Skripte"}</span>
        <Button onClick={openAdd}
          className="ml-auto rounded-xl h-9 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0 gap-1.5 text-[13px]">
          <Plus className="h-4 w-4" /> Neues Skript
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-[13px]">Lade Skripte…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06]">
            <BookOpen className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-medium text-muted-foreground">
              {scripts.length === 0 ? "Noch keine Skripte" : "Keine Ergebnisse"}
            </p>
            <p className="text-[12px] text-muted-foreground/50 mt-1">
              {scripts.length === 0 ? "Füge dein erstes erfolgreiches Skript hinzu" : "Passe den Filter an"}
            </p>
          </div>
          {scripts.length === 0 && (
            <Button onClick={openAdd} variant="outline" className="rounded-xl border-white/[0.08] text-[13px] gap-1.5">
              <Plus className="h-4 w-4" /> Erstes Skript hinzufügen
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(s => (
            <ScriptCard key={s.id} script={s} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-xl glass border-white/[0.08] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editing ? "Skript bearbeiten" : "Neues Training-Skript"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Format</Label>
              <div className="relative">
                <select autoFocus value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}
                  className="w-full h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 pr-8 text-[13px] text-foreground appearance-none cursor-pointer focus:outline-none">
                  <option value="">Auswählen…</option>
                  {allFormats.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Text Hook</Label>
              <Input placeholder="On-Screen Text…" value={form.textHook}
                onChange={e => setForm({ ...form, textHook: e.target.value })}
                className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Visual Hook</Label>
              <Input placeholder="Was ist zu sehen in der ersten Sekunde…" value={form.visualHook}
                onChange={e => setForm({ ...form, visualHook: e.target.value })}
                className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Audio Hook</Label>
              <Input placeholder="Was wird gesagt / welcher Sound…" value={form.audioHook}
                onChange={e => setForm({ ...form, audioHook: e.target.value })}
                className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Skript</Label>
              <Textarea rows={8} placeholder="Hauptteil des Skripts…" value={form.script}
                onChange={e => setForm({ ...form, script: e.target.value })}
                className="rounded-xl bg-white/[0.04] border-white/[0.08] resize-y" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CTA</Label>
              <Input placeholder="Call to Action…" value={form.cta}
                onChange={e => setForm({ ...form, cta: e.target.value })}
                className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08]" />
            </div>
            <Button onClick={handleSave} disabled={saving}
              className="w-full rounded-xl h-10 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0 mt-1">
              {saving ? "Speichert…" : editing ? "Änderungen speichern" : "Skript hinzufügen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — Content Types
// ═══════════════════════════════════════════════════════════════════════════

const EMPTY_TYPE = { name: "", goal: "", bestFor: "" };

function ContentTypesTab() {
  const [custom, setCustom] = useState<ContentType[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContentType | null>(null);
  const [form, setForm] = useState(EMPTY_TYPE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/strategy").then(r => r.json()).then(d => setCustom(d.customContentTypes || []));
  }, []);

  function openAdd() { setEditing(null); setForm(EMPTY_TYPE); setDialogOpen(true); }
  function openEdit(t: ContentType) { setEditing(t); setForm({ name: t.name, goal: t.goal, bestFor: t.bestFor }); setDialogOpen(true); }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        const data = await fetch("/api/strategy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "contentType", id: editing.id, ...form }) }).then(r => r.json());
        setCustom(data.customContentTypes || []);
      } else {
        const data = await fetch("/api/strategy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "contentType", ...form }) }).then(r => r.json());
        setCustom(data.customContentTypes || []);
      }
      setDialogOpen(false);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Content Type löschen?")) return;
    const data = await fetch(`/api/strategy?id=${id}&kind=contentType`, { method: "DELETE" }).then(r => r.json());
    setCustom(data.customContentTypes || []);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-[13px] text-muted-foreground">
          Eingebaute Types sind schreibgeschützt. Eigene können hinzugefügt, bearbeitet und gelöscht werden.
        </p>
        <Button onClick={openAdd}
          className="rounded-xl h-9 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0 gap-1.5 text-[13px]">
          <Plus className="h-4 w-4" /> Neuer Type
        </Button>
      </div>

      <div className="space-y-8">
        {/* Built-in */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lock className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Eingebaut</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {BUILT_IN_CONTENT_TYPES.map(t => {
              const color = TYPE_COLORS[t.name] ?? "bg-white/5 text-muted-foreground border-white/10";
              return (
                <div key={t.id} className="glass rounded-xl border border-white/[0.06] p-4 opacity-70">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`rounded-lg border text-[11px] font-medium px-2 py-0.5 ${color}`}>{t.name}</Badge>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-snug">{t.goal}</p>
                  {t.bestFor && <p className="text-[11px] text-muted-foreground/50 mt-1 leading-snug">Ideal für: {t.bestFor}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom */}
        {custom.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Eigene</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {custom.map(t => (
                <div key={t.id} className="glass rounded-xl border border-purple-500/20 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge className="rounded-lg border text-[11px] font-medium px-2 py-0.5 bg-purple-500/10 text-purple-400 border-purple-500/20">
                      {t.name}
                    </Badge>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(t)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(t.id)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-snug">{t.goal}</p>
                  {t.bestFor && <p className="text-[11px] text-muted-foreground/50 mt-1 leading-snug">Ideal für: {t.bestFor}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md glass border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editing ? "Content Type bearbeiten" : "Neuer Content Type"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input autoFocus placeholder="z.B. Case Study" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ziel — was soll dieser Type erreichen?</Label>
              <Textarea rows={2} placeholder="z.B. Vertrauen aufbauen durch echte Ergebnisse von Kunden" value={form.goal}
                onChange={e => setForm({ ...form, goal: e.target.value })}
                className="rounded-xl bg-white/[0.04] border-white/[0.08] resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ideal für — wann einsetzen?</Label>
              <Textarea rows={2} placeholder="z.B. Wenn Kunden bereits warm sind und kurz vor einer Kaufentscheidung stehen" value={form.bestFor}
                onChange={e => setForm({ ...form, bestFor: e.target.value })}
                className="rounded-xl bg-white/[0.04] border-white/[0.08] resize-none" />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="w-full rounded-xl h-10 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0">
              {saving ? "Speichert…" : editing ? "Speichern" : "Hinzufügen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — Content Formate
// ═══════════════════════════════════════════════════════════════════════════

const EMPTY_FORMAT = { name: "", description: "", bestContentType: "", platform: "" };

function ContentFormatsTab() {
  const [custom, setCustom] = useState<ContentFormat[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContentFormat | null>(null);
  const [form, setForm] = useState(EMPTY_FORMAT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/strategy").then(r => r.json()).then(d => setCustom(d.customFormats || []));
  }, []);

  function openAdd() { setEditing(null); setForm(EMPTY_FORMAT); setDialogOpen(true); }
  function openEdit(f: ContentFormat) { setEditing(f); setForm({ name: f.name, description: f.description, bestContentType: f.bestContentType, platform: f.platform }); setDialogOpen(true); }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        const data = await fetch("/api/strategy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "format", id: editing.id, ...form }) }).then(r => r.json());
        setCustom(data.customFormats || []);
      } else {
        const data = await fetch("/api/strategy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "format", ...form }) }).then(r => r.json());
        setCustom(data.customFormats || []);
      }
      setDialogOpen(false);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Format löschen?")) return;
    const data = await fetch(`/api/strategy?id=${id}&kind=format`, { method: "DELETE" }).then(r => r.json());
    setCustom(data.customFormats || []);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-[13px] text-muted-foreground">
          Eingebaute Formate sind schreibgeschützt. Eigene können hinzugefügt, bearbeitet und gelöscht werden.
        </p>
        <Button onClick={openAdd}
          className="rounded-xl h-9 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0 gap-1.5 text-[13px]">
          <Plus className="h-4 w-4" /> Neues Format
        </Button>
      </div>

      <div className="space-y-8">
        {/* Built-in */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lock className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Eingebaut</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {BUILT_IN_FORMATS.map(f => (
              <div key={f.id} className="glass rounded-xl border border-white/[0.06] p-4 opacity-70">
                <p className="text-[13px] font-semibold mb-1">{f.name}</p>
                <p className="text-[12px] text-muted-foreground leading-snug">{f.description}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {f.bestContentType && (
                    <span className="text-[10px] text-muted-foreground/60 bg-white/[0.03] border border-white/[0.05] rounded-md px-1.5 py-0.5">
                      Types: {f.bestContentType}
                    </span>
                  )}
                  {f.platform && (
                    <span className="text-[10px] text-muted-foreground/60 bg-white/[0.03] border border-white/[0.05] rounded-md px-1.5 py-0.5">
                      {f.platform}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom */}
        {custom.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Eigene</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {custom.map(f => (
                <div key={f.id} className="glass rounded-xl border border-indigo-500/20 p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[13px] font-semibold">{f.name}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(f)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(f.id)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-snug">{f.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {f.bestContentType && (
                      <span className="text-[10px] text-muted-foreground/60 bg-white/[0.03] border border-white/[0.05] rounded-md px-1.5 py-0.5">
                        Types: {f.bestContentType}
                      </span>
                    )}
                    {f.platform && (
                      <span className="text-[10px] text-muted-foreground/60 bg-white/[0.03] border border-white/[0.05] rounded-md px-1.5 py-0.5">
                        {f.platform}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md glass border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editing ? "Format bearbeiten" : "Neues Content Format"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input autoFocus placeholder="z.B. Split-Screen" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Beschreibung — was ist dieses Format?</Label>
              <Textarea rows={2} placeholder="z.B. Zwei Videos nebeneinander — eins zeigt das Problem, eins die Lösung" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="rounded-xl bg-white/[0.04] border-white/[0.08] resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Passt zu welchen Content Types?</Label>
              <Input placeholder="z.B. Education, Opinion, Social Proof" value={form.bestContentType}
                onChange={e => setForm({ ...form, bestContentType: e.target.value })}
                className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Plattform</Label>
              <Input placeholder="z.B. Reels, TikTok" value={form.platform}
                onChange={e => setForm({ ...form, platform: e.target.value })}
                className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08]" />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="w-full rounded-xl h-10 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0">
              {saving ? "Speichert…" : editing ? "Speichern" : "Hinzufügen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// (TranscribeTab moved to /transcribe page)


// ═══════════════════════════════════════════════════════════════════════════
// Root page
// ═══════════════════════════════════════════════════════════════════════════

export default function TrainingPage() {
  const [tab, setTab] = useState<Tab>("scripts");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600">
          <BookOpen className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Training & Framework</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Referenzskripte, Content Types und Formate für die KI
          </p>
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} />

      <div>
        {tab === "scripts"  && <ScriptsTab />}
        {tab === "types"    && <ContentTypesTab />}
        {tab === "formats"  && <ContentFormatsTab />}
      </div>
    </div>
  );
}
