"use client";

import { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, BookOpen, Filter,
  ChevronDown, ChevronUp, Target, FileText, Lock, Mic, Sparkles, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import type { ContentType, ContentFormat } from "@/lib/strategy";
// BUILT_IN_CONTENT_TYPES used in ContentTypesTab only
import type { TrainingScript, Config } from "@/lib/types";

// ── Colour map ──────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  "Authority":                "bg-blush/20 text-blush-dark border-blush/40",
  "Story / Personality":      "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "Social Proof":             "bg-green-50 text-green-600 border-green-200",
  "Education / Value":        "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Opinion / Polarisation":   "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Behind the Scenes":        "bg-slate-500/10 text-slate-400 border-slate-500/20",
  "Inspiration / Motivation": "bg-blush/20 text-blush-dark border-blush/40",
  "Entertainment":            "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Community / Interaction":  "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "Promotion / Offer":        "bg-blush/20 text-blush-dark border-blush/40",
};

function formatDate(iso: string, lang: string = "de") {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(lang === "de" ? "de-DE" : "en-US", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso.split("T")[0]; }
}

// ── Tab bar ─────────────────────────────────────────────────────────────────
type Tab = "scripts" | "voice" | "types" | "formats";

function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const { t } = useI18n();
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "scripts", label: "Training Scripts", icon: BookOpen },
    { id: "voice",   label: "Voice-Training",   icon: Mic },
    { id: "types",   label: "Content Types",    icon: Target },
    { id: "formats", label: t("training.contentFormats"),  icon: FileText },
  ];
  return (
    <div className="flex gap-1 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] p-1 w-fit">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${
            active === id
              ? "bg-warm-white text-ocean"
              : "text-ocean/60 hover:text-ocean"
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
  clientId: "", format: "", textHook: "", visualHook: "", audioHook: "", script: "", cta: "", sourceId: "",
};

function ScriptCard({ script, onEdit, onDelete, clientLabel }: {
  script: TrainingScript;
  onEdit: (s: TrainingScript) => void;
  onDelete: (id: string) => void;
  clientLabel?: string;
}) {
  const { t, lang } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const long = script.script.split("\n").length > 5 || script.script.length > 320;

  return (
    <div className="glass rounded-2xl border border-ocean/[0.06] p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {clientLabel && (
            <Badge className="rounded-lg border text-[11px] font-medium px-2 py-0.5 bg-ocean/[0.02] text-ocean/60 border-ocean/[0.06]">
              {clientLabel}
            </Badge>
          )}
          {script.format && (
            <Badge className="rounded-lg border text-[11px] font-medium px-2 py-0.5 bg-ocean/[0.02] text-ocean/60 border-ocean/5">
              {script.format}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(script)}
            className="p-1.5 rounded-lg text-ocean/60 hover:text-ocean hover:bg-warm-white transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { if (confirm(t("training.confirmDelete"))) onDelete(script.id); }}
            className="p-1.5 rounded-lg text-ocean/60 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {script.textHook && (
          <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1">{t("training.textHook")}</p>
            <p className="text-[13px] text-ocean/80 leading-relaxed">{script.textHook}</p>
          </div>
        )}
        {script.visualHook && (
          <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1">{t("training.visualHook")}</p>
            <p className="text-[13px] text-ocean/80 leading-relaxed">{script.visualHook}</p>
          </div>
        )}
        {script.audioHook && (
          <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1">{t("training.audioHook")}</p>
            <p className="text-[13px] text-ocean/80 leading-relaxed">{script.audioHook}</p>
          </div>
        )}
        {script.script && (
          <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1">{t("training.scriptLabel")}</p>
            <p className={`text-[13px] text-ocean/80 leading-relaxed whitespace-pre-wrap ${!expanded ? "line-clamp-5" : ""}`}>
              {script.script}
            </p>
            {long && (
              <button onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-[11px] text-ocean/60 hover:text-ocean/80 transition-colors mt-1">
                {expanded ? <><ChevronUp className="h-3 w-3" /> {t("common.less")}</> : <><ChevronDown className="h-3 w-3" /> {t("common.more")}</>}
              </button>
            )}
          </div>
        )}
        {script.cta && (
          <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1">{t("training.cta")}</p>
            <p className="text-[13px] text-ocean/80 leading-relaxed">{script.cta}</p>
          </div>
        )}
      </div>

      <div className="pt-1 border-t border-ocean/5">
        <span className="text-[11px] text-ocean/70">{formatDate(script.createdAt, lang)}</span>
      </div>
    </div>
  );
}

function ScriptsTab() {
  const { t } = useI18n();
  const [scripts, setScripts] = useState<TrainingScript[]>([]);
  const [allFormats, setAllFormats] = useState<ContentFormat[]>(BUILT_IN_FORMATS);
  const [clients, setClients] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFormat, setFilterFormat] = useState("Alle");
  const [filterClient, setFilterClient] = useState("Alle");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingScript | null>(null);
  const [form, setForm] = useState<Omit<TrainingScript, "id" | "createdAt">>(EMPTY_SCRIPT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/training-scripts").then(r => r.json()),
      fetch("/api/strategy").then(r => r.json()),
      fetch("/api/configs").then(r => r.json()),
    ]).then(([scripts, strategy, configs]) => {
      setScripts(scripts);
      setAllFormats([...BUILT_IN_FORMATS, ...(strategy.customFormats || [])]);
      setClients(configs);
    }).finally(() => setLoading(false));
  }, []);

  function openAdd() { setEditing(null); setForm(EMPTY_SCRIPT); setDialogOpen(true); }
  function openEdit(s: TrainingScript) {
    setEditing(s);
    setForm({ clientId: s.clientId, format: s.format, textHook: s.textHook, visualHook: s.visualHook, audioHook: s.audioHook, script: s.script, cta: s.cta, sourceId: s.sourceId || "" });
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
      // Regenerate voice profile in background
      if (form.clientId) {
        fetch(`/api/configs/${form.clientId}/generate-voice-profile`, { method: "POST" }).catch(() => {});
      }
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const deleted = scripts.find(s => s.id === id);
    await fetch(`/api/training-scripts?id=${id}`, { method: "DELETE" });
    setScripts(prev => prev.filter(s => s.id !== id));
    // Regenerate voice profile in background
    if (deleted?.clientId) {
      fetch(`/api/configs/${deleted.clientId}/generate-voice-profile`, { method: "POST" }).catch(() => {});
    }
  }

  const clientName = (id: string) => {
    const c = clients.find(cl => cl.id === id);
    return c ? (c.name || c.configName) : "";
  };
  const filtered = scripts.filter(s =>
    (filterFormat === "Alle" || s.format === filterFormat) &&
    (filterClient === "Alle" || (filterClient === "_none" ? !s.clientId : s.clientId === filterClient))
  );

  return (
    <>
      {/* Filter bar + Add button */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="flex items-center gap-2 text-[12px] text-ocean/60">
          <Filter className="h-3.5 w-3.5" /> Filter:
        </div>
        <div className="relative">
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            className="h-8 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] px-3 pr-8 text-[12px] text-ocean appearance-none cursor-pointer focus:outline-none">
            <option value="Alle">{t("training.allClients")}</option>
            <option value="_none">{t("training.noClientGeneral")}</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.configName}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/60 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={filterFormat} onChange={e => setFilterFormat(e.target.value)}
            className="h-8 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] px-3 pr-8 text-[12px] text-ocean appearance-none cursor-pointer focus:outline-none">
            <option value="Alle">{t("training.allFormats")}</option>
            {allFormats.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/60 pointer-events-none" />
        </div>
        {(filterFormat !== "Alle" || filterClient !== "Alle") && (
          <button onClick={() => { setFilterFormat("Alle"); setFilterClient("Alle"); }}
            className="text-[11px] text-ocean/60 hover:text-ocean underline underline-offset-2">
            {t("training.reset")}
          </button>
        )}
        <span className="text-[12px] text-ocean/70">{filtered.length} {filtered.length === 1 ? t("training.scriptCount") : t("training.scriptsCount")}</span>
        <Button onClick={openAdd}
          className="ml-auto rounded-xl h-9 px-4 bg-ocean hover:bg-ocean-light border-0 gap-1.5 text-[13px]">
          <Plus className="h-4 w-4" /> {t("training.newScript")}
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-ocean/60 text-[13px]">{t("training.loadingScripts")}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ocean/[0.02] border border-ocean/[0.06]">
            <BookOpen className="h-6 w-6 text-ocean/65" />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-medium text-ocean/60">
              {scripts.length === 0 ? t("training.noScripts") : t("training.noResults")}
            </p>
            <p className="text-[12px] text-ocean/70 mt-1">
              {scripts.length === 0 ? t("training.addFirst") : t("training.adjustFilter")}
            </p>
          </div>
          {scripts.length === 0 && (
            <Button onClick={openAdd} variant="outline" className="rounded-xl border-ocean/[0.06] text-[13px] gap-1.5">
              <Plus className="h-4 w-4" /> {t("training.addFirstBtn")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(s => (
            <ScriptCard key={s.id} script={s} onEdit={openEdit} onDelete={handleDelete}
              clientLabel={s.clientId ? clientName(s.clientId) : undefined} />
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-xl glass border-ocean/[0.06] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editing ? t("training.editScript") : t("training.newTrainingScript")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("training.client")}</Label>
              <div className="relative">
                <select value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })}
                  className="w-full h-10 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] px-3 pr-8 text-[13px] text-ocean appearance-none cursor-pointer focus:outline-none">
                  <option value="">{t("training.noClient")}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.configName}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/60 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("training.format")}</Label>
              <div className="relative">
                <select autoFocus value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}
                  className="w-full h-10 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] px-3 pr-8 text-[13px] text-ocean appearance-none cursor-pointer focus:outline-none">
                  <option value="">{t("training.select")}</option>
                  {allFormats.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/60 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("training.textHook")}</Label>
              <Input placeholder={t("training.textHookPlaceholder")} value={form.textHook}
                onChange={e => setForm({ ...form, textHook: e.target.value })}
                className="h-10 rounded-xl bg-ocean/[0.02] border-ocean/[0.06]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("training.visualHook")}</Label>
              <Input placeholder={t("training.visualHookPlaceholder")} value={form.visualHook}
                onChange={e => setForm({ ...form, visualHook: e.target.value })}
                className="h-10 rounded-xl bg-ocean/[0.02] border-ocean/[0.06]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("training.audioHook")}</Label>
              <Input placeholder={t("training.audioHookPlaceholder")} value={form.audioHook}
                onChange={e => setForm({ ...form, audioHook: e.target.value })}
                className="h-10 rounded-xl bg-ocean/[0.02] border-ocean/[0.06]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("training.scriptLabel")}</Label>
              <Textarea rows={8} placeholder={t("training.scriptPlaceholder")} value={form.script}
                onChange={e => setForm({ ...form, script: e.target.value })}
                className="rounded-xl bg-ocean/[0.02] border-ocean/[0.06] resize-y" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("training.cta")}</Label>
              <Input placeholder={t("training.ctaPlaceholder")} value={form.cta}
                onChange={e => setForm({ ...form, cta: e.target.value })}
                className="h-10 rounded-xl bg-ocean/[0.02] border-ocean/[0.06]" />
            </div>
            <Button onClick={handleSave} disabled={saving}
              className="w-full rounded-xl h-10 bg-ocean hover:bg-ocean-light border-0 mt-1">
              {saving ? t("common.saving") : editing ? t("training.saveChanges") : t("training.addScript")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB — Voice-Training (Notizen + Beispieltexte → Auto-Profil)
// ═══════════════════════════════════════════════════════════════════════════

interface VoiceProfileData {
  summary?: string;
  tone?: string;
  energy?: string;
  avgSentenceLength?: number;
  favoriteWords?: string[];
  slangMarkers?: string[];
  avoidedPatterns?: string[];
  sentencePatterns?: string;
  exampleSentences?: string[];
}

function VoiceTrainingTab() {
  const [clients, setClients] = useState<Config[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [voiceNotes, setVoiceNotes] = useState("");
  const [voiceExamples, setVoiceExamples] = useState("");
  const [profile, setProfile] = useState<VoiceProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingClient, setLoadingClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/configs").then(r => r.json()).then((cfgs: Config[]) => {
      setClients(cfgs);
      if (cfgs.length > 0) setSelectedId(cfgs[0].id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingClient(true);
    setError(null);
    setProfile(null);
    fetch(`/api/configs/${selectedId}/voice-training`)
      .then(r => r.json())
      .then(d => {
        setVoiceNotes(d.voiceNotes || "");
        setVoiceExamples(d.voiceExamples || "");
        if (d.voiceProfile) {
          try { setProfile(JSON.parse(d.voiceProfile)); } catch { /* not JSON */ }
        }
      })
      .finally(() => setLoadingClient(false));
  }, [selectedId]);

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/configs/${selectedId}/voice-training`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceNotes, voiceExamples }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");
      if (data.profile) setProfile(data.profile);
      else if (!data.profileGenerated) setProfile(null);
      if (data.error) setError(data.error);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  };

  const enoughContent = voiceNotes.trim().length > 20 || voiceExamples.trim().length > 50;

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ocean/60 text-[13px]">Lädt Clients…</div>;
  }
  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ocean/[0.02] border border-ocean/[0.06]">
          <Mic className="h-6 w-6 text-ocean/65" />
        </div>
        <p className="text-[14px] font-medium text-ocean/60">Noch keine Clients angelegt</p>
        <p className="text-[12px] text-ocean/70">Lege zuerst einen Client an, um sein Voice-Profil zu trainieren.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      {/* Left: Input */}
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label className="text-xs text-ocean/60">Client</Label>
          <div className="relative">
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
              className="w-full h-10 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] px-3 pr-8 text-[13px] text-ocean appearance-none cursor-pointer focus:outline-none">
              {clients.map(c => <option key={c.id} value={c.id}>{c.configName || c.name || "Unbenannt"}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/60 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-ocean/60">Notizen zum Sprechstil</Label>
          <Textarea
            rows={6}
            placeholder="z.B.: Spricht direkt, ohne Filter. Nutzt oft 'krass' und 'ehrlich gesagt'. Kurze Sätze, dann mal ein langer Gedanke. Kein Smalltalk im Hook."
            value={voiceNotes}
            onChange={e => setVoiceNotes(e.target.value)}
            disabled={loadingClient}
            className="rounded-xl bg-ocean/[0.02] border-ocean/[0.06] resize-y text-[13px]"
          />
          <p className="text-[10px] text-ocean/45">Was macht die Stimme aus? Tonalität, typische Wörter, Energielevel, was die Person nie sagen würde.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-ocean/60">Beispiel-Texte</Label>
          <Textarea
            rows={12}
            placeholder={"Texte die typisch für diese Person sind. WhatsApp-Sprachnachrichten transkribiert, Captions, alte Skripte, Voicenotes…\n\nMehrere Beispiele mit Leerzeile trennen."}
            value={voiceExamples}
            onChange={e => setVoiceExamples(e.target.value)}
            disabled={loadingClient}
            className="rounded-xl bg-ocean/[0.02] border-ocean/[0.06] resize-y text-[13px] font-mono"
          />
          <p className="text-[10px] text-ocean/45">Je authentischer und mehr Beispiele, desto besser das Profil.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={save}
            disabled={saving || loadingClient || !enoughContent}
            className="rounded-xl h-10 px-4 bg-ocean hover:bg-ocean-light border-0 gap-1.5 text-[13px]"
          >
            {saving ? (
              <>Generiere Profil…</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" /> Speichern & Profil generieren</>
            )}
          </Button>
          {savedAt && !saving && (
            <span className="flex items-center gap-1 text-[12px] text-green-600">
              <Check className="h-3.5 w-3.5" /> Gespeichert
            </span>
          )}
          {!enoughContent && !loadingClient && (
            <span className="text-[11px] text-ocean/45">Mind. 20 Zeichen Notizen oder 50 Zeichen Beispieltext</span>
          )}
        </div>
        {error && <p className="text-[12px] text-red-500">{error}</p>}
      </div>

      {/* Right: Profile preview */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/70">Generiertes Profil</p>
        {!profile ? (
          <div className="rounded-2xl border border-dashed border-ocean/[0.08] p-6 text-center">
            <Mic className="h-5 w-5 text-ocean/35 mx-auto mb-2" />
            <p className="text-[12px] text-ocean/55">
              {loadingClient ? "Lädt…" : "Noch kein Profil generiert. Fülle Notizen oder Beispiele aus und klicke speichern."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-ocean/[0.06] bg-white p-5 space-y-4 shadow-[0_1px_8px_rgba(32,35,69,0.03)]">
            {profile.summary && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1">Zusammenfassung</p>
                <p className="text-[12px] text-ocean/80 leading-relaxed">{profile.summary}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profile.tone && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1">Ton</p>
                  <p className="text-[12px] text-ocean">{profile.tone}</p>
                </div>
              )}
              {profile.energy && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1">Energie</p>
                  <p className="text-[12px] text-ocean">{profile.energy}</p>
                </div>
              )}
              {typeof profile.avgSentenceLength === "number" && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1">Ø Satzlänge</p>
                  <p className="text-[12px] text-ocean">{profile.avgSentenceLength} Wörter</p>
                </div>
              )}
            </div>
            {profile.favoriteWords && profile.favoriteWords.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1.5">Lieblingswörter</p>
                <div className="flex flex-wrap gap-1">
                  {profile.favoriteWords.map((w, i) => (
                    <Badge key={i} className="rounded-md text-[10px] bg-blush/15 text-blush-dark border-blush/30 border px-1.5 py-0.5">{w}</Badge>
                  ))}
                </div>
              </div>
            )}
            {profile.slangMarkers && profile.slangMarkers.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1.5">Slang / Umgangssprache</p>
                <div className="flex flex-wrap gap-1">
                  {profile.slangMarkers.map((w, i) => (
                    <Badge key={i} className="rounded-md text-[10px] bg-ocean/[0.04] text-ocean/70 border-ocean/[0.06] border px-1.5 py-0.5">{w}</Badge>
                  ))}
                </div>
              </div>
            )}
            {profile.avoidedPatterns && profile.avoidedPatterns.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1.5">Vermeidet</p>
                <ul className="space-y-0.5">
                  {profile.avoidedPatterns.map((p, i) => (
                    <li key={i} className="text-[11px] text-ocean/70 leading-snug">— {p}</li>
                  ))}
                </ul>
              </div>
            )}
            {profile.sentencePatterns && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1">Satzbau</p>
                <p className="text-[11px] text-ocean/70 leading-snug">{profile.sentencePatterns}</p>
              </div>
            )}
            {profile.exampleSentences && profile.exampleSentences.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1.5">Typische Sätze</p>
                <ul className="space-y-1">
                  {profile.exampleSentences.map((s, i) => (
                    <li key={i} className="text-[11px] text-ocean/75 italic leading-snug">&ldquo;{s}&rdquo;</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — Content Types
// ═══════════════════════════════════════════════════════════════════════════

const EMPTY_TYPE = { name: "", goal: "", bestFor: "" };

function ContentTypesTab() {
  const { t } = useI18n();
  const [custom, setCustom] = useState<ContentType[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContentType | null>(null);
  const [form, setForm] = useState(EMPTY_TYPE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/strategy").then(r => r.json()).then(d => setCustom(d.customContentTypes || []));
  }, []);

  function openAdd() { setEditing(null); setForm(EMPTY_TYPE); setDialogOpen(true); }
  function openEdit(ct: ContentType) { setEditing(ct); setForm({ name: ct.name, goal: ct.goal, bestFor: ct.bestFor }); setDialogOpen(true); }

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
    if (!confirm(t("training.deleteType"))) return;
    const data = await fetch(`/api/strategy?id=${id}&kind=contentType`, { method: "DELETE" }).then(r => r.json());
    setCustom(data.customContentTypes || []);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-[13px] text-ocean/60">
          {t("training.typesReadonly")}
        </p>
        <Button onClick={openAdd}
          className="rounded-xl h-9 px-4 bg-ocean hover:bg-ocean-light border-0 gap-1.5 text-[13px]">
          <Plus className="h-4 w-4" /> {t("training.newType")}
        </Button>
      </div>

      <div className="space-y-8">
        {/* Built-in */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lock className="h-3 w-3 text-ocean/70" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-ocean/70">{t("training.builtIn")}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {BUILT_IN_CONTENT_TYPES.map(ct => {
              const color = TYPE_COLORS[ct.name] ?? "bg-ocean/[0.02] text-ocean/60 border-ocean/5";
              return (
                <div key={ct.id} className="glass rounded-xl border border-ocean/[0.06] p-4 opacity-70">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`rounded-lg border text-[11px] font-medium px-2 py-0.5 ${color}`}>{ct.name}</Badge>
                  </div>
                  <p className="text-[12px] text-ocean/60 leading-snug">{ct.goal}</p>
                  {ct.bestFor && <p className="text-[11px] text-ocean/70 mt-1 leading-snug">{t("training.idealFor")} {ct.bestFor}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom */}
        {custom.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ocean/70">{t("training.custom")}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {custom.map(ct => (
                <div key={ct.id} className="glass rounded-xl border border-blush/40 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge className="rounded-lg border text-[11px] font-medium px-2 py-0.5 bg-blush/20 text-blush-dark border-blush/40">
                      {ct.name}
                    </Badge>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(ct)}
                        className="p-1 rounded-lg text-ocean/60 hover:text-ocean hover:bg-warm-white transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(ct.id)}
                        className="p-1 rounded-lg text-ocean/60 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[12px] text-ocean/60 leading-snug">{ct.goal}</p>
                  {ct.bestFor && <p className="text-[11px] text-ocean/70 mt-1 leading-snug">{t("training.idealFor")} {ct.bestFor}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md glass border-ocean/[0.06]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editing ? t("training.editType") : t("training.newContentType")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("training.name")}</Label>
              <Input autoFocus placeholder={t("training.typeNamePlaceholder")} value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="h-10 rounded-xl bg-ocean/[0.02] border-ocean/[0.06]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("training.typeGoal")}</Label>
              <Textarea rows={2} placeholder={t("training.typeGoalPlaceholder")} value={form.goal}
                onChange={e => setForm({ ...form, goal: e.target.value })}
                className="rounded-xl bg-ocean/[0.02] border-ocean/[0.06] resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("training.typeBestFor")}</Label>
              <Textarea rows={2} placeholder={t("training.typeBestForPlaceholder")} value={form.bestFor}
                onChange={e => setForm({ ...form, bestFor: e.target.value })}
                className="rounded-xl bg-ocean/[0.02] border-ocean/[0.06] resize-none" />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="w-full rounded-xl h-10 bg-ocean hover:bg-ocean-light border-0">
              {saving ? t("common.saving") : editing ? t("common.save") : t("common.add")}
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
  const { t } = useI18n();
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
    if (!confirm(t("training.deleteFormat"))) return;
    const data = await fetch(`/api/strategy?id=${id}&kind=format`, { method: "DELETE" }).then(r => r.json());
    setCustom(data.customFormats || []);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-[13px] text-ocean/60">
          {t("training.formatsReadonly")}
        </p>
        <Button onClick={openAdd}
          className="rounded-xl h-9 px-4 bg-ocean hover:bg-ocean-light border-0 gap-1.5 text-[13px]">
          <Plus className="h-4 w-4" /> {t("training.newFormat")}
        </Button>
      </div>

      <div className="space-y-8">
        {/* Built-in */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lock className="h-3 w-3 text-ocean/70" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-ocean/70">{t("training.builtIn")}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {BUILT_IN_FORMATS.map(f => (
              <div key={f.id} className="glass rounded-xl border border-ocean/[0.06] p-4 opacity-70">
                <p className="text-[13px] font-semibold mb-1">{f.name}</p>
                <p className="text-[12px] text-ocean/60 leading-snug">{f.description}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {f.bestContentType && (
                    <span className="text-[10px] text-ocean/60 bg-ocean/[0.02] border border-ocean/5 rounded-md px-1.5 py-0.5">
                      Types: {f.bestContentType}
                    </span>
                  )}
                  {f.platform && (
                    <span className="text-[10px] text-ocean/60 bg-ocean/[0.02] border border-ocean/5 rounded-md px-1.5 py-0.5">
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
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ocean/70">{t("training.custom")}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {custom.map(f => (
                <div key={f.id} className="glass rounded-xl border border-ocean/[0.06] p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[13px] font-semibold">{f.name}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(f)}
                        className="p-1 rounded-lg text-ocean/60 hover:text-ocean hover:bg-warm-white transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(f.id)}
                        className="p-1 rounded-lg text-ocean/60 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[12px] text-ocean/60 leading-snug">{f.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {f.bestContentType && (
                      <span className="text-[10px] text-ocean/60 bg-ocean/[0.02] border border-ocean/5 rounded-md px-1.5 py-0.5">
                        Types: {f.bestContentType}
                      </span>
                    )}
                    {f.platform && (
                      <span className="text-[10px] text-ocean/60 bg-ocean/[0.02] border border-ocean/5 rounded-md px-1.5 py-0.5">
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
        <DialogContent className="sm:max-w-md glass border-ocean/[0.06]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editing ? t("training.editFormat") : t("training.newContentFormat")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("training.name")}</Label>
              <Input autoFocus placeholder={t("training.formatNamePlaceholder")} value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="h-10 rounded-xl bg-ocean/[0.02] border-ocean/[0.06]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("training.formatDesc")}</Label>
              <Textarea rows={2} placeholder={t("training.formatDescPlaceholder")} value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="rounded-xl bg-ocean/[0.02] border-ocean/[0.06] resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("training.formatTypes")}</Label>
              <Input placeholder={t("training.formatTypesPlaceholder")} value={form.bestContentType}
                onChange={e => setForm({ ...form, bestContentType: e.target.value })}
                className="h-10 rounded-xl bg-ocean/[0.02] border-ocean/[0.06]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("training.platform")}</Label>
              <Input placeholder={t("training.platformPlaceholder")} value={form.platform}
                onChange={e => setForm({ ...form, platform: e.target.value })}
                className="h-10 rounded-xl bg-ocean/[0.02] border-ocean/[0.06]" />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="w-full rounded-xl h-10 bg-ocean hover:bg-ocean-light border-0">
              {saving ? t("common.saving") : editing ? t("common.save") : t("common.add")}
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

// ── Voice Profile Status Dashboard ─────────────────────────────────────────

function VoiceProfileDashboard() {
  const [clients, setClients] = useState<Array<{
    id: string; name: string; scriptCount: number;
    hasVoiceProfile: boolean; hasScriptStructure: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/configs").then(r => r.json()),
      fetch("/api/training-scripts").then(r => r.json()),
    ]).then(([configs, scripts]: [Config[], TrainingScript[]]) => {
      setClients(configs.map(c => ({
        id: c.id,
        name: c.configName || c.name || "Client",
        scriptCount: scripts.filter((s: TrainingScript) => s.clientId === c.id).length,
        hasVoiceProfile: Boolean(c.voiceProfile),
        hasScriptStructure: Boolean(c.scriptStructure),
      })));
    }).finally(() => setLoading(false));
  }, []);

  const regenerate = async (clientId: string) => {
    setRegeneratingId(clientId);
    try {
      await fetch(`/api/configs/${clientId}/generate-voice-profile`, { method: "POST" });
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, hasVoiceProfile: true, hasScriptStructure: true } : c));
    } finally { setRegeneratingId(null); }
  };

  if (loading) return null;
  if (clients.length === 0) return null;

  return (
    <div className="rounded-2xl border border-ocean/[0.06] bg-white p-5 shadow-[0_1px_8px_rgba(32,35,69,0.03)]">
      <h2 className="text-xs font-medium text-ocean uppercase tracking-wider mb-4">Voice-Profile Status</h2>
      <div className="space-y-2">
        {clients.map(c => {
          const confidence = c.scriptCount >= 15 ? "high" : c.scriptCount >= 8 ? "medium" : c.scriptCount >= 1 ? "low" : "none";
          const confidenceLabel = { high: "Stark", medium: "Solide", low: "Schwach", none: "Keine Daten" }[confidence];
          const confidenceColor = {
            high: "text-green-600 bg-green-50 border-green-200",
            medium: "text-amber-600 bg-amber-50 border-amber-200",
            low: "text-red-500 bg-red-50 border-red-200",
            none: "text-ocean/40 bg-ocean/[0.03] border-ocean/[0.06]",
          }[confidence];
          const isRegenerating = regeneratingId === c.id;

          return (
            <div key={c.id} className="flex items-center gap-3 rounded-xl bg-ocean/[0.01] px-4 py-3 hover:bg-ocean/[0.03] transition-colors">
              <span className="text-sm text-ocean font-medium flex-1 truncate">{c.name}</span>
              <span className="text-xs text-ocean/50 tabular-nums">{c.scriptCount} Skripte</span>
              <span className={`text-[10px] font-medium rounded-md border px-2 py-0.5 ${confidenceColor}`}>
                {confidenceLabel}
              </span>
              {c.hasVoiceProfile ? (
                <span className="text-[10px] text-green-600">Profil aktiv</span>
              ) : c.scriptCount > 0 ? (
                <button
                  onClick={() => regenerate(c.id)}
                  disabled={isRegenerating}
                  className="text-[10px] text-ocean/60 hover:text-ocean underline transition-colors disabled:opacity-50"
                >
                  {isRegenerating ? "Generiere..." : "Profil generieren"}
                </button>
              ) : (
                <span className="text-[10px] text-ocean/35">—</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-ocean/40 mt-3 leading-relaxed">
        Empfehlung: Mind. 8 Skripte pro Client für ein solides Profil, 15+ für starke Voice-Erkennung.
        Nutze <span className="font-medium">Transkribieren</span> um schnell Videos in Training-Skripte umzuwandeln.
      </p>
    </div>
  );
}

export default function TrainingPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("scripts");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light text-ocean">Training & Voice-Profile</h1>
        <p className="text-sm text-ocean/50 mt-1">
          Training-Skripte hochladen, Voice-Profile verwalten, Content-Formate definieren
        </p>
      </div>

      <VoiceProfileDashboard />

      <TabBar active={tab} onChange={setTab} />

      <div>
        {tab === "scripts"  && <ScriptsTab />}
        {tab === "voice"    && <VoiceTrainingTab />}
        {tab === "types"    && <ContentTypesTab />}
        {tab === "formats"  && <ContentFormatsTab />}
      </div>
    </div>
  );
}
