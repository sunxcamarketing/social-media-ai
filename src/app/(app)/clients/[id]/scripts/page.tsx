"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Copy,
  Check,
  Lightbulb,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import type { Script, Config } from "@/lib/types";
import { useClientData } from "@/context/client-data-context";
import { ClientIdeasTab } from "@/components/client-ideas-tab";
import { WeekIdeasPanel } from "@/components/week-ideas-panel";

// ── Helpers ─────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
  Mon: "Montag", Tue: "Dienstag", Wed: "Mittwoch",
  Thu: "Donnerstag", Fri: "Freitag", Sat: "Samstag", Sun: "Sonntag",
};
const DAY_SHORT: Record<string, string> = {
  Mon: "Mo", Tue: "Di", Wed: "Mi", Thu: "Do", Fri: "Fr", Sat: "Sa", Sun: "So",
};

function baseTitle(title: string): string {
  return title.replace(/\s*(?:\(Kurz\)|\(Lang\)|—\s*Kurz|—\s*Lang)\s*$/, "").trim();
}

function scriptVariant(title: string): "kurz" | "lang" | null {
  if (/(?:\(Kurz\)|—\s*Kurz)\s*$/.test(title)) return "kurz";
  if (/(?:\(Lang\)|—\s*Lang)\s*$/.test(title)) return "lang";
  return null;
}

type ScriptGroup = {
  base: string;
  kurz?: Script;
  lang?: Script;
  single?: Script; // no variant suffix
};

function groupScripts(scripts: Script[]): ScriptGroup[] {
  const map = new Map<string, ScriptGroup>();
  for (const s of scripts) {
    const variant = scriptVariant(s.title);
    const base = baseTitle(s.title);
    if (!map.has(base)) map.set(base, { base });
    const group = map.get(base)!;
    if (variant === "kurz") group.kurz = s;
    else if (variant === "lang") group.lang = s;
    else group.single = s;
  }
  return Array.from(map.values());
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const STATUS_OPTIONS = [
  { value: "entwurf", label: "Entwurf", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  { value: "bereit", label: "Bereit", color: "bg-green-50 text-green-600 border-green-200" },
  { value: "veröffentlicht", label: "Veröffentlicht", color: "bg-blush/20 text-blush-dark border-blush/40" },
];

function statusColor(s: string) {
  return STATUS_OPTIONS.find(o => o.value === s)?.color || "bg-ocean/[0.02] text-ocean/70 border-ocean/[0.06]";
}


// ── Script Cell (renders script content inside a table cell) ────────────────

function ScriptCell({ script }: { script?: Script }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!script) {
    return <td className="px-4 py-4 align-top text-xs text-ocean/25 italic">—</td>;
  }

  const fullText = [script.hook, script.body, script.cta].filter(Boolean).join("\n\n");
  const isLong = (script.body || "").length > 200;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fbStatus = script.clientFeedbackStatus;
  const fbLabel = fbStatus === "approved"
    ? { text: "Client: Gefällt mir", cls: "bg-green-50 text-green-700 border-green-200" }
    : fbStatus === "rejected"
    ? { text: "Client: Abgelehnt", cls: "bg-red-50 text-red-600 border-red-200" }
    : fbStatus === "revision_requested"
    ? { text: "Client: Verbesserung", cls: "bg-amber-50 text-amber-700 border-amber-200" }
    : null;

  return (
    <td className="px-4 py-4 align-top">
      <div
        className="space-y-2 max-w-md cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {fbLabel && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${fbLabel.cls}`}>
              {fbLabel.text}
            </span>
            {script.clientFeedbackAt && (
              <span className="text-[10px] text-ocean/40">{script.clientFeedbackAt.slice(0, 10)}</span>
            )}
          </div>
        )}
        {script.hook && (
          <p className="text-[13px] text-ocean/90 leading-relaxed font-semibold">{script.hook}</p>
        )}
        {script.body && (
          <p className={`text-[13px] text-ocean/65 leading-relaxed whitespace-pre-wrap ${!expanded && isLong ? "line-clamp-4" : ""}`}>{script.body}</p>
        )}
        {!script.hook && !script.cta && script.body && (
          <p className={`text-[13px] text-ocean/65 leading-relaxed whitespace-pre-wrap ${!expanded && isLong ? "line-clamp-4" : ""}`}>{script.body}</p>
        )}
        {script.cta && (
          <p className="text-[13px] text-green-700/70 leading-relaxed italic">{script.cta}</p>
        )}
        {isLong && !expanded && (
          <span className="text-[11px] text-blush-dark/60 hover:text-blush-dark">... mehr anzeigen</span>
        )}
        {fbLabel && script.clientFeedbackText && (
          <div className="rounded-lg border border-ocean/[0.06] bg-ocean/[0.02] p-2">
            <p className="text-[10px] uppercase tracking-wider text-ocean/45 font-medium mb-0.5">Client-Kommentar</p>
            <p className="text-[12px] text-ocean/75 leading-relaxed whitespace-pre-wrap break-words">{script.clientFeedbackText}</p>
          </div>
        )}
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[10px] text-ocean/40 hover:text-ocean transition-colors"
        >
          {copied ? <><Check className="h-2.5 w-2.5 text-green-600" /> Kopiert</> : <><Copy className="h-2.5 w-2.5" /> Kopieren</>}
        </button>
      </div>
    </td>
  );
}


// ── Main Page ───────────────────────────────────────────────────────────────

const emptyForm = {
  title: "", pillar: "", contentType: "", format: "",
  hook: "", body: "", cta: "", status: "entwurf", fullScript: "",
};

type ScriptTab = "scripts" | "ideas";

export default function ClientScriptsPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<ScriptTab>("scripts");

  // Client data
  const [client, setClient] = useState<Config | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [hasAudit, setHasAudit] = useState<boolean | null>(null);

  // Saved scripts
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Script | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadScripts = useCallback(() =>
    fetch(`/api/scripts?clientId=${id}`).then(r => r.json()).then((data: Script[]) => {
      setScripts(data);
      setSelectedIds(new Set()); // clear selection after reload
    }),
  [id]);

  const { loadClient: loadClientCached } = useClientData();

  useEffect(() => {
    loadScripts();
    loadClientCached(id).then(setClient);
    fetch(`/api/analyses?clientId=${id}`).then(r => r.json()).then((analyses: unknown[]) => setHasAudit(analyses.length > 0));
  }, [id, loadScripts]);

  // ── Saved scripts CRUD ──────────────────────────────────────────────────
  const openEdit = (script: Script) => {
    setEditing(script);
    const fullScript = [script.hook, script.body, script.cta].filter(Boolean).join("\n\n");
    setForm({
      title: script.title, pillar: script.pillar, contentType: script.contentType,
      format: script.format, hook: "", body: "", cta: "", status: script.status, fullScript,
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      title: form.title, pillar: form.pillar, contentType: form.contentType,
      format: form.format, status: form.status,
      hook: "", body: form.fullScript, cta: "",
    };
    if (editing) {
      await fetch("/api/scripts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...payload }) });
    } else {
      await fetch("/api/scripts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: id, ...payload }) });
    }
    setDialogOpen(false);
    loadScripts();
  };

  const deleteScriptIds = async (ids: string[]) => {
    // Optimistic: remove from UI immediately
    setScripts(prev => prev.filter(s => !ids.includes(s.id)));
    setSelectedIds(new Set());
    // Single request — all IDs comma-separated
    await fetch(`/api/scripts?id=${ids.join(",")}`, { method: "DELETE" });
  };

  const handleDelete = async (scriptId: string) => {
    await deleteScriptIds([scriptId]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size} Skript(e) löschen?`)) return;
    await deleteScriptIds(Array.from(selectedIds));
  };

  const handleStatusChange = async (scriptId: string, newStatus: string) => {
    await fetch("/api/scripts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: scriptId, status: newStatus }),
    });
    loadScripts();
  };

  const toggleSelect = (ids: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const filtered = useMemo(() => filterStatus === "all" ? scripts : scripts.filter(s => s.status === filterStatus), [scripts, filterStatus]);
  const grouped = useMemo(() => groupScripts(filtered), [filtered]);
  const allScriptIds = useMemo(() => filtered.map(s => s.id), [filtered]);
  const allSelected = allScriptIds.length > 0 && allScriptIds.every(id => selectedIds.has(id));

  return (
    <div className="space-y-8">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skripte</h1>
          <p className="mt-1 text-sm text-ocean/60">
            Strategische Video-Skripte für {client?.name || client?.configName || "..."}
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] p-1">
          <button onClick={() => setActiveTab("scripts")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${activeTab === "scripts" ? "bg-warm-white text-ocean" : "text-ocean/60 hover:text-ocean"}`}>
            <FileText className="h-3.5 w-3.5" /> Skripte
          </button>
          <button onClick={() => setActiveTab("ideas")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${activeTab === "ideas" ? "bg-warm-white text-ocean" : "text-ocean/60 hover:text-ocean"}`}>
            <Lightbulb className="h-3.5 w-3.5" /> Ideen
          </button>
        </div>
      </div>

      {activeTab === "ideas" ? (
        <ClientIdeasTab clientId={id} />
      ) : (
      <>
      <WeekIdeasPanel clientId={id} hasAudit={hasAudit} onScriptSaved={loadScripts} />

      {/* ── Saved Scripts — Table Layout ────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {[{ value: "all", label: "Alle" }, ...STATUS_OPTIONS].map((s) => (
              <button key={s.value} onClick={() => setFilterStatus(s.value)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
                  filterStatus === s.value
                    ? "bg-blush/30 text-blush-dark border border-blush/50"
                    : "border border-ocean/[0.06] text-ocean/60 hover:text-ocean"
                }`}>
                {s.label}
              </button>
            ))}
            <span className="ml-1 text-[11px] text-ocean/50">{grouped.length} Skripte</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button variant="ghost" onClick={handleBulkDelete}
                className="rounded-xl h-9 gap-1.5 border border-red-200 text-xs text-red-500 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" /> {selectedIds.size} löschen
              </Button>
            )}
            <Button variant="ghost" onClick={openNew}
              className="rounded-xl h-9 gap-1.5 border border-ocean/[0.06] text-xs text-ocean/60">
              <Plus className="h-3.5 w-3.5" /> Manuell
            </Button>
          </div>
        </div>

        {grouped.length > 0 ? (
          <div className="rounded-xl border border-ocean/[0.06] overflow-hidden bg-white/50">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ocean/[0.08] bg-ocean/[0.02]">
                  <th className="pl-4 pr-1 py-3 w-[40px]">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => toggleSelect(allScriptIds)}
                      className="h-3.5 w-3.5 rounded border-ocean/20 text-ocean accent-ocean cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50 w-[200px]">Titel</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50">Post Short</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50">Post Long</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50 w-[100px]">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50 w-[100px]">Datum</th>
                  <th className="px-4 py-3 w-[80px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ocean/[0.05]">
                {grouped.map((g) => {
                  const primary = g.single || g.lang || g.kurz;
                  if (!primary) return null;

                  const cycleStatus = () => {
                    const order = STATUS_OPTIONS.map(o => o.value);
                    const idx = order.indexOf(primary.status);
                    const next = order[(idx + 1) % order.length];
                    handleStatusChange(primary.id, next);
                  };

                  const groupIds = [g.kurz?.id, g.lang?.id, g.single?.id].filter(Boolean) as string[];
                  const isGroupSelected = groupIds.some(gid => selectedIds.has(gid));

                  const handleDeleteGroup = async () => {
                    if (!confirm("Skript löschen?")) return;
                    await deleteScriptIds(groupIds);
                  };

                  const dateStr = primary.createdAt
                    ? new Date(primary.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })
                    : "—";

                  return (
                    <tr key={g.base} className={`group/row hover:bg-ocean/[0.01] transition-colors ${isGroupSelected ? "bg-blush/[0.04]" : ""}`}>
                      {/* Checkbox */}
                      <td className="pl-4 pr-1 py-4 align-top">
                        <input
                          type="checkbox"
                          checked={isGroupSelected}
                          onChange={() => toggleSelect(groupIds)}
                          className="h-3.5 w-3.5 rounded border-ocean/20 text-ocean accent-ocean cursor-pointer"
                        />
                      </td>
                      {/* Title + meta */}
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1.5">
                          <p className="text-sm font-medium text-ocean/90 leading-snug">{g.base || primary.title || "Ohne Titel"}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {primary.source === "viral-script" && (
                              <span className="text-[9px] text-purple-600 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 font-medium">Viral Script</span>
                            )}
                            {primary.pillar && (
                              <span className="text-[9px] text-blush-dark/60 rounded bg-blush/15 border border-blush/25 px-1.5 py-0.5">{primary.pillar}</span>
                            )}
                            {primary.contentType && (
                              <span className="text-[9px] text-ocean/45">{primary.contentType}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Post Short */}
                      <ScriptCell script={g.kurz || (g.single ? g.single : undefined)} />

                      {/* Post Long */}
                      <ScriptCell script={g.lang} />

                      {/* Status */}
                      <td className="px-4 py-4 align-top">
                        <button onClick={cycleStatus} className="cursor-pointer">
                          <Badge className={`rounded-md text-[10px] border ${statusColor(primary.status)} hover:opacity-80 transition-opacity`}>
                            {STATUS_OPTIONS.find(o => o.value === primary.status)?.label || primary.status}
                          </Badge>
                        </button>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4 align-top">
                        <span className="text-xs text-ocean/45">{dateStr}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 align-top">
                        <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(primary)} className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/40 hover:text-ocean hover:bg-ocean/5 transition-colors">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={handleDeleteGroup} className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/40 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-ocean/5 bg-ocean/[0.01] p-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-ocean/15 mb-3" />
            <p className="text-sm text-ocean/50">Noch keine gespeicherten Skripte.</p>
            <p className="text-xs text-ocean/40 mt-1">Generiere eine Woche um loszulegen.</p>
          </div>
        )}
      </div>

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-ocean/[0.06]">
          <DialogHeader>
            <DialogTitle>{editing ? "Skript bearbeiten" : "Neues Skript"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-ocean/60">Titel</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1.5 rounded-xl border-ocean/[0.06] h-10 text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-ocean/60">Pillar</Label>
                <Input value={form.pillar} onChange={(e) => setForm({ ...form, pillar: e.target.value })}
                  className="mt-1.5 rounded-xl border-ocean/[0.06] h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-ocean/60">Content-Type</Label>
                <Input value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                  className="mt-1.5 rounded-xl border-ocean/[0.06] h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-ocean/60">Format</Label>
                <Input value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}
                  className="mt-1.5 rounded-xl border-ocean/[0.06] h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-ocean/60">Skript</Label>
              <Textarea value={form.fullScript} onChange={(e) => setForm({ ...form, fullScript: e.target.value })}
                rows={10} className="mt-1.5 rounded-xl border-ocean/[0.06] text-sm" />
            </div>
            <div className="flex items-center gap-3 justify-end pt-2">
              <button onClick={() => setDialogOpen(false)} className="text-xs text-ocean/60 hover:text-ocean">Abbrechen</button>
              <Button onClick={handleSave} className="h-9 px-5 rounded-xl bg-ocean hover:bg-ocean-light border-0 text-white text-xs">
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      </>
      )}
    </div>
  );
}
