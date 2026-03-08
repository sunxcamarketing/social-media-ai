"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  Copy,
  Check,
  TrendingUp,
  Users,
  Brain,
  Sparkles,
  Clock,
  RefreshCw,
  Save,
  Calendar,
  AlertCircle,
  MessageCircle,
  Send,
  Lightbulb,
} from "lucide-react";

function fmtDuration(s: number): string {
  if (!s) return "?s";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 > 0 ? `${s % 60}s` : ""}`;
}
import type { Script, Config } from "@/lib/types";
import type { PerformanceInsights } from "@/app/api/configs/[id]/performance/route";

// Local type for weekly-generated scripts (not saved yet)
type WeekScript = {
  day: string;
  pillar: string;
  contentType: string;
  format: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  reasoning: string;
  error?: string;
};

type WeekSlotState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; script: WeekScript }
  | { status: "error"; error: string; day: string; pillar: string; contentType: string; format: string }
  | { status: "saved" };

const STATUS_OPTIONS = [
  { value: "entwurf",        label: "Entwurf",        color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  { value: "bereit",         label: "Bereit",          color: "bg-green-500/10 text-green-400 border-green-500/20" },
  { value: "veröffentlicht", label: "Veröffentlicht",  color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
];

function statusColor(s: string) {
  return STATUS_OPTIONS.find(o => o.value === s)?.color || "bg-white/[0.05] text-muted-foreground border-white/[0.08]";
}
function statusLabel(s: string) {
  return STATUS_OPTIONS.find(o => o.value === s)?.label || s;
}

function ScriptCard({ script, onEdit, onDelete }: {
  script: Script;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyScript = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const full = [
      script.hook && `HOOK:\n${script.hook}`,
      script.body && `\nSKRIPT:\n${script.body}`,
      script.cta  && `\nCTA:\n${script.cta}`,
    ].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const words = script.body ? script.body.split(/\s+/).filter(Boolean).length : 0;
  const dur = words > 0 ? fmtDuration(Math.round((words / 125) * 60)) : null;

  return (
    <div className="glass rounded-xl border border-white/[0.06] overflow-hidden group transition-all duration-150 hover:border-white/[0.1]">
      {/* Row — always visible, click to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 shrink-0 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{script.title || "Unbenanntes Skript"}</span>
            {script.hook && (
              <span className="text-[11px] text-amber-400/70 truncate hidden sm:block max-w-[260px]">
                — {script.hook.slice(0, 60)}{script.hook.length > 60 ? "…" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Meta tags */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {script.contentType && (
            <span className="text-[10px] text-muted-foreground/50 rounded-md bg-white/[0.04] border border-white/[0.06] px-2 py-0.5">{script.contentType}</span>
          )}
          {dur && (
            <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />{dur}
            </span>
          )}
          <Badge className={`rounded-md text-[10px] border ${statusColor(script.status)}`}>
            {statusLabel(script.status)}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={copyScript} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/[0.05] transition-colors">
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/[0.05] transition-colors">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/[0.04]">
          {script.hook && (
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 px-3 py-2.5">
              <p className="text-[10px] font-medium text-amber-400/70 uppercase tracking-wider mb-1">Hook</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{script.hook}</p>
            </div>
          )}
          {script.body && (
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] px-3 py-2.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Skript</p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{script.body}</p>
            </div>
          )}
          {script.cta && (
            <div className="rounded-xl bg-green-500/5 border border-green-500/15 px-3 py-2.5">
              <p className="text-[10px] font-medium text-green-400/70 uppercase tracking-wider mb-1">CTA</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{script.cta}</p>
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            {script.pillar && <span className="text-[10px] text-purple-300/70 rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5">{script.pillar}</span>}
            {script.format && <span className="text-[10px] text-muted-foreground/50">{script.format}</span>}
            <button onClick={copyScript} className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              {copied ? <><Check className="h-3 w-3 text-green-400" /> Kopiert</> : <><Copy className="h-3 w-3" /> Skript kopieren</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Week Script Row ────────────────────────────────────────────────────────
const DAY_LABELS: Record<string, string> = { Mon: "Mo", Tue: "Di", Wed: "Mi", Thu: "Do", Fri: "Fr", Sat: "Sa", Sun: "So" };
const ALL_DAYS_LIST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function WeekScriptCard({
  slot,
  dayIndex,
  onRegenerate,
  onSave,
}: {
  slot: WeekSlotState;
  dayIndex: number;
  onRegenerate: (dayIndex: number) => void;
  onSave: (script: WeekScript) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setSaved(false); setExpanded(false); }, [slot]);

  const dayKey = slot.status === "done" ? slot.script.day : slot.status === "error" ? slot.day : ALL_DAYS_LIST[dayIndex];
  const dayLabel = DAY_LABELS[dayKey] || dayKey;

  // ── loading / idle
  if (slot.status === "idle" || slot.status === "loading") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.05] bg-white/[0.01]">
        <span className="text-[11px] font-bold text-muted-foreground/30 w-6 shrink-0">{dayLabel}</span>
        {slot.status === "loading"
          ? <Loader2 className="h-3.5 w-3.5 text-purple-400/60 animate-spin" />
          : <div className="h-3.5 w-24 rounded bg-white/[0.04]" />}
      </div>
    );
  }

  // ── error
  if (slot.status === "error") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
        <span className="text-[11px] font-bold text-red-300/60 w-6 shrink-0">{dayLabel}</span>
        <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
        <span className="text-[11px] text-red-300/70 flex-1 truncate">{slot.error}</span>
        <button onClick={() => onRegenerate(dayIndex)} className="h-6 w-6 flex items-center justify-center rounded-lg text-red-400/60 hover:text-red-400 transition-colors" title="Erneut versuchen">
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // ── saved
  if (slot.status === "saved") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-500/20 bg-green-500/5">
        <span className="text-[11px] font-bold text-green-300/60 w-6 shrink-0">{dayLabel}</span>
        <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />
        <span className="text-[11px] text-green-300/70">Gespeichert</span>
      </div>
    );
  }

  // ── done
  const s = slot.script;
  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    await onSave(s);
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="rounded-xl border border-white/[0.07] overflow-hidden transition-all duration-150 hover:border-white/[0.12]">
      {/* Compact row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-[11px] font-bold text-purple-300/80 w-6 shrink-0">{dayLabel}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground/30 shrink-0 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} />

        <span className="flex-1 text-sm font-medium truncate">{s.title || "Skript"}</span>

        <span className="hidden sm:block text-[10px] text-amber-400/60 truncate max-w-[200px]">
          {s.hook?.slice(0, 55)}{(s.hook?.length ?? 0) > 55 ? "…" : ""}
        </span>

        <div className="hidden md:flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {s.contentType && <span className="text-[10px] text-muted-foreground/40 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">{s.contentType}</span>}
          <button
            onClick={() => onRegenerate(dayIndex)}
            className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground/30 hover:text-muted-foreground hover:bg-white/[0.05] transition-colors"
            title="Neu generieren"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`h-6 flex items-center gap-1 px-2 rounded-lg text-[10px] transition-colors ${
              saved ? "text-green-400 bg-green-500/10" : "text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.05]"
            }`}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {saved ? "Gespeichert" : "Speichern"}
          </button>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/[0.04]">
          {s.hook && (
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 px-3 py-2.5">
              <p className="text-[10px] font-medium text-amber-400/70 uppercase tracking-wider mb-1">Hook</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{s.hook}</p>
            </div>
          )}
          {s.body && (
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] px-3 py-2.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Skript</p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{s.body}</p>
            </div>
          )}
          {s.cta && (
            <div className="rounded-xl bg-green-500/5 border border-green-500/15 px-3 py-2.5">
              <p className="text-[10px] font-medium text-green-400/70 uppercase tracking-wider mb-1">CTA</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.cta}</p>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            {s.pillar && <span className="text-[10px] text-purple-300/60 rounded bg-purple-500/10 border border-purple-500/20 px-2 py-0.5">{s.pillar}</span>}
            {s.format && <span className="text-[10px] text-muted-foreground/40">{s.format}</span>}
            {/* Mobile save */}
            <button onClick={handleSave} disabled={saving || saved}
              className={`md:hidden ml-auto flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-colors ${saved ? "text-green-400 bg-green-500/10" : "text-muted-foreground/60 hover:text-foreground bg-white/[0.04] border border-white/[0.06]"}`}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
              {saved ? "Gespeichert" : "Speichern"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

const emptyForm = {
  title: "", pillar: "", contentType: "", format: "",
  hook: "", body: "", cta: "", status: "entwurf",
};

export default function ClientScriptsPage() {
  const { id } = useParams<{ id: string }>();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [client, setClient] = useState<Config | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Script | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Data availability indicators
  const [ownVideoCount, setOwnVideoCount] = useState(0);
  const [creatorVideoCount, setCreatorVideoCount] = useState(0);

  // Week generation state
  const [weekSlots, setWeekSlots] = useState<WeekSlotState[]>([]);
  const [weekGenerating, setWeekGenerating] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [postsPerWeek, setPostsPerWeek] = useState(5);
  const [allSaving, setAllSaving] = useState(false);

  // Chat agent state
  type ChatMessage = { role: "user" | "assistant"; content: string };
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInitialized, setChatInitialized] = useState(false);
  const [chatScriptLoading, setChatScriptLoading] = useState(false);
  const [chatScriptResult, setChatScriptResult] = useState<WeekScript | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const loadScripts = useCallback(() =>
    fetch(`/api/scripts?clientId=${id}`).then(r => r.json()).then(setScripts),
  [id]);

  // ── Chat agent ──────────────────────────────────────────────────────────────
  const initChat = async () => {
    if (chatInitialized) return;
    setChatLoading(true);
    try {
      const res = await fetch(`/api/configs/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      });
      const data = await res.json();
      setChatMessages([{ role: "assistant", content: data.message }]);
      setChatInitialized(true);
    } catch {
      setChatMessages([{ role: "assistant", content: "Lass uns eine Idee entwickeln. Was ist dir zuletzt passiert, das andere wissen sollten?" }]);
      setChatInitialized(true);
    } finally {
      setChatLoading(false);
    }
  };

  const openChat = () => {
    setChatOpen(true);
    if (!chatInitialized) initChat();
    setTimeout(() => chatInputRef.current?.focus(), 100);
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch(`/api/configs/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      if (!res.ok || !res.body) throw new Error("Fehler");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";

      setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiText += decoder.decode(value, { stream: true });
        setChatMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: aiText };
          return updated;
        });
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Ein Fehler ist aufgetreten. Bitte erneut versuchen." }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatInputRef.current?.focus(), 50);
    }
  };

  const resetChat = () => {
    setChatMessages([]);
    setChatInitialized(false);
    setChatScriptResult(null);
    initChat();
  };

  // Check if AI is suggesting script generation
  const lastAiMessage = chatMessages.filter(m => m.role === "assistant").at(-1)?.content || "";
  const aiSuggestsScript = lastAiMessage.includes("Ich habe genug");
  const hasEnoughContext = chatMessages.filter(m => m.role === "user").length >= 3;

  const generateScriptFromChat = async () => {
    setChatScriptLoading(true);
    setChatScriptResult(null);
    try {
      // Format conversation as rich hint
      const transcript = chatMessages
        .map(m => `${m.role === "user" ? "Creator" : "Stratege"}: ${m.content}`)
        .join("\n\n");
      const hint = `Basiere das Skript auf diesem echten Gespräch mit dem Creator:\n\n${transcript}\n\nNutze die konkreten Details, Zahlen und Erfahrungen aus dem Gespräch. Das Skript soll authentisch klingen — wie der Creator selbst spricht.`;

      const res = await fetch(`/api/configs/${id}/generate-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      setChatScriptResult({
        day: "",
        pillar: data.pillar || "",
        contentType: data.contentType || "",
        format: data.format || "",
        title: data.title || "",
        hook: data.hook || "",
        body: data.body || "",
        cta: data.cta || "",
        reasoning: data.reasoning || "",
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Generierung fehlgeschlagen");
    } finally {
      setChatScriptLoading(false);
    }
  };

  const saveChatScript = async () => {
    if (!chatScriptResult) return;
    await saveWeekScript(chatScriptResult);
    setChatScriptResult(null);
    setChatMessages(prev => [...prev, { role: "assistant", content: "Das Skript wurde gespeichert! Möchtest du eine weitere Idee entwickeln?" }]);
  };

  useEffect(() => {
    loadScripts();
    fetch(`/api/configs/${id}`).then(r => r.json()).then((cfg: Config) => {
      setClient(cfg);
      const ppw = parseInt(cfg.postsPerWeek || "5", 10);
      setPostsPerWeek(ppw);
      const insights: PerformanceInsights | null = (() => { try { return JSON.parse(cfg.performanceInsights || ""); } catch { return null; } })();
      if (insights) {
        setOwnVideoCount((insights.top30Days?.length || 0) + (insights.topAllTime?.length || 0));
      }
      fetch(`/api/videos?configName=${encodeURIComponent(cfg.configName)}`).then(r => r.json()).then((vids: { views: number }[]) => {
        setCreatorVideoCount(vids.filter(v => v.views > 0).length);
      }).catch(() => {});
    });
  }, [id, loadScripts]);

  // ── Week generation ────────────────────────────────────────────────────────
  const generateWeek = async () => {
    setWeekGenerating(true);
    setWeekError(null);
    // Initialize all slots as loading
    setWeekSlots(Array.from({ length: postsPerWeek }, () => ({ status: "loading" as const })));

    try {
      const res = await fetch(`/api/configs/${id}/generate-week`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generierung fehlgeschlagen");

      const scripts: WeekScript[] = data.scripts || [];
      setWeekSlots(scripts.map((s) => {
        if (s.error) {
          return {
            status: "error" as const,
            error: s.error,
            day: s.day,
            pillar: s.pillar,
            contentType: s.contentType,
            format: s.format,
          };
        }
        return { status: "done" as const, script: s };
      }));
    } catch (e) {
      setWeekError(e instanceof Error ? e.message : "Fehler");
      setWeekSlots([]);
    } finally {
      setWeekGenerating(false);
    }
  };

  // Regenerate a single slot
  const regenerateSlot = async (dayIndex: number) => {
    const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const slot = weekSlots[dayIndex];

    // Extract day info from the current slot
    let dayInfo: { day: string; contentType: string; format: string; pillar: string };
    if (slot.status === "done") {
      dayInfo = {
        day: slot.script.day,
        contentType: slot.script.contentType,
        format: slot.script.format,
        pillar: slot.script.pillar,
      };
    } else if (slot.status === "error") {
      dayInfo = {
        day: slot.day,
        contentType: slot.contentType,
        format: slot.format,
        pillar: slot.pillar,
      };
    } else {
      dayInfo = { day: ALL_DAYS[dayIndex], contentType: "", format: "", pillar: "" };
    }

    // Set this slot to loading
    setWeekSlots(prev => prev.map((s, i) => i === dayIndex ? { status: "loading" as const } : s));

    try {
      const res = await fetch(`/api/configs/${id}/generate-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hint: "", dayOverride: dayInfo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generierung fehlgeschlagen");

      const script: WeekScript = {
        day: dayInfo.day,
        pillar: data.pillar || dayInfo.pillar,
        contentType: data.contentType || dayInfo.contentType,
        format: data.format || dayInfo.format,
        title: data.title || "",
        hook: data.hook || "",
        body: data.body || "",
        cta: data.cta || "",
        reasoning: data.reasoning || "",
      };
      setWeekSlots(prev => prev.map((s, i) => i === dayIndex ? { status: "done" as const, script } : s));
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Fehler";
      setWeekSlots(prev => prev.map((s, i) =>
        i === dayIndex
          ? { status: "error" as const, error: errMsg, day: dayInfo.day, contentType: dayInfo.contentType, format: dayInfo.format, pillar: dayInfo.pillar }
          : s
      ));
    }
  };

  // Save a single week script
  const saveWeekScript = async (script: WeekScript) => {
    await fetch("/api/scripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: id,
        title: script.title,
        pillar: script.pillar,
        contentType: script.contentType,
        format: script.format,
        hook: script.hook,
        body: script.body,
        cta: script.cta,
        status: "entwurf",
      }),
    });
    loadScripts();
  };

  // Save all week scripts that are "done"
  const saveAllWeekScripts = async () => {
    setAllSaving(true);
    const doneSlots = weekSlots.filter((s) => s.status === "done") as { status: "done"; script: WeekScript }[];
    await Promise.allSettled(doneSlots.map(s => saveWeekScript(s.script)));

    // Mark all done slots as saved
    setWeekSlots(prev => prev.map(s => s.status === "done" ? { status: "saved" as const } : s));
    setAllSaving(false);
    loadScripts();
  };

  // ── Saved scripts CRUD ─────────────────────────────────────────────────────
  const openEdit = (script: Script) => {
    setEditing(script);
    setForm({
      title: script.title, pillar: script.pillar, contentType: script.contentType,
      format: script.format, hook: script.hook, body: script.body,
      cta: script.cta, status: script.status,
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      await fetch("/api/scripts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...form }) });
    } else {
      await fetch("/api/scripts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: id, ...form }) });
    }
    setDialogOpen(false);
    loadScripts();
  };

  const handleDelete = async (scriptId: string) => {
    if (!confirm("Skript löschen?")) return;
    await fetch(`/api/scripts?id=${scriptId}`, { method: "DELETE" });
    loadScripts();
  };

  const filtered = filterStatus === "all" ? scripts : scripts.filter(s => s.status === filterStatus);

  const hasWeekSlots = weekSlots.length > 0;
  const doneCount = weekSlots.filter(s => s.status === "done").length;
  const hasSaveable = doneCount > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skripte</h1>
          <p className="mt-1 text-sm text-muted-foreground">Video-Skripte für {client?.configName || "diesen Kunden"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={openNew}
            className="rounded-xl h-10 gap-1.5 border border-white/[0.08] text-xs">
            <Plus className="h-3.5 w-3.5" /> Manuell
          </Button>
        </div>
      </div>

      {/* ── Week Generation Panel ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-indigo-500/5 p-5 space-y-5">
        {/* Panel header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/30 shrink-0">
              <Calendar className="h-4 w-4 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Wochenplanung</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generiert {postsPerWeek} Skripte auf einmal — eines pro Posting-Tag.
              </p>
            </div>
          </div>

          {/* Data sources */}
          <div className="hidden sm:flex flex-col gap-1 items-end shrink-0">
            <div className={`flex items-center gap-1.5 text-[11px] ${ownVideoCount > 0 ? "text-green-400" : "text-muted-foreground/40"}`}>
              <TrendingUp className="h-3 w-3 shrink-0" />
              {ownVideoCount > 0 ? <span>{ownVideoCount} eigene Videos</span> : <span>Keine eigene Analyse</span>}
            </div>
            <div className={`flex items-center gap-1.5 text-[11px] ${creatorVideoCount > 0 ? "text-blue-400" : "text-muted-foreground/40"}`}>
              <Users className="h-3 w-3 shrink-0" />
              {creatorVideoCount > 0 ? <span>{creatorVideoCount} Creator-Videos</span> : <span>Keine Creator-Videos</span>}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-purple-400/80">
              <Brain className="h-3 w-3 shrink-0" />
              <span>Strategie + Profil</span>
            </div>
          </div>
        </div>

        {/* Generate button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={generateWeek}
            disabled={weekGenerating}
            className="h-10 px-6 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0 gap-2 shrink-0"
          >
            {weekGenerating
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generiert…</>
              : <><Sparkles className="h-4 w-4" /> Woche generieren</>}
          </Button>
          {hasWeekSlots && !weekGenerating && hasSaveable && (
            <Button
              onClick={saveAllWeekScripts}
              disabled={allSaving}
              variant="ghost"
              className="h-10 px-4 rounded-xl border border-white/[0.08] gap-2 text-xs"
            >
              {allSaving
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Speichert…</>
                : <><Save className="h-3.5 w-3.5" /> Alle speichern ({doneCount})</>}
            </Button>
          )}
        </div>

        {weekError && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{weekError}</p>
        )}

        {/* Week slots — compact list */}
        {hasWeekSlots && (
          <div className="space-y-1.5">
            {weekSlots.map((slot, i) => (
              <WeekScriptCard
                key={i}
                slot={slot}
                dayIndex={i}
                onRegenerate={regenerateSlot}
                onSave={saveWeekScript}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Ideen-Chat ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 overflow-hidden">
        {/* Chat header — always visible */}
        <button
          onClick={() => { if (chatOpen) { setChatOpen(false); } else { openChat(); } }}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 shrink-0">
            <MessageCircle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Ideen-Chat</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Entwickle Ideen im Gespräch — basierend auf echten Erfahrungen
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground/40 shrink-0 transition-transform duration-200 ${chatOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Chat body */}
        {chatOpen && (
          <div className="border-t border-amber-500/15">
            {/* Messages */}
            <div className="h-80 overflow-y-auto px-4 py-4 space-y-3">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-amber-500/20 border border-amber-500/25 text-foreground/90 rounded-br-sm"
                        : "bg-white/[0.05] border border-white/[0.07] text-muted-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.content
                      ? msg.content.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                          part.startsWith("**") && part.endsWith("**")
                            ? <strong key={j} className="text-foreground">{part.slice(2, -2)}</strong>
                            : part
                        )
                      : <span className="opacity-40">…</span>
                    }
                  </div>
                </div>
              ))}
              {chatLoading && chatMessages.at(-1)?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-2.5">
                    <Loader2 className="h-4 w-4 text-muted-foreground/40 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Script suggestion banner */}
            {(aiSuggestsScript || hasEnoughContext) && !chatScriptResult && (
              <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-purple-500/10 border border-purple-500/20 px-4 py-3">
                <Lightbulb className="h-4 w-4 text-purple-400 shrink-0" />
                <p className="text-xs text-purple-300/80 flex-1">Genug Input für ein starkes Skript.</p>
                <Button
                  onClick={generateScriptFromChat}
                  disabled={chatScriptLoading}
                  size="sm"
                  className="h-7 px-3 text-xs rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 gap-1.5"
                >
                  {chatScriptLoading
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Generiert…</>
                    : <><Sparkles className="h-3 w-3" /> Skript erstellen</>}
                </Button>
              </div>
            )}

            {/* Generated script from chat */}
            {chatScriptResult && (
              <div className="mx-4 mb-3 rounded-xl border border-purple-500/25 bg-purple-500/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-purple-500/15 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-purple-300">{chatScriptResult.title}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{chatScriptResult.contentType} · {chatScriptResult.pillar}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setChatScriptResult(null)} className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">Verwerfen</button>
                    <Button onClick={saveChatScript} size="sm" className="h-7 px-3 text-xs rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 gap-1.5">
                      <Save className="h-3 w-3" /> Speichern
                    </Button>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2.5 max-h-60 overflow-y-auto">
                  {chatScriptResult.hook && (
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-amber-400/60 font-medium mb-1">Hook</p>
                      <p className="text-xs text-foreground/80 leading-relaxed">{chatScriptResult.hook}</p>
                    </div>
                  )}
                  {chatScriptResult.body && (
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium mb-1">Skript</p>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{chatScriptResult.body}</p>
                    </div>
                  )}
                  {chatScriptResult.cta && (
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-green-400/60 font-medium mb-1">CTA</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{chatScriptResult.cta}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2 px-4 pb-4">
              <input
                ref={chatInputRef}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                placeholder="Schreibe hier…"
                disabled={chatLoading}
                className="flex-1 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:border-amber-500/30 disabled:opacity-50 transition-colors"
              />
              <button
                onClick={sendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/25 text-amber-400 hover:bg-amber-500/30 disabled:opacity-30 transition-colors shrink-0"
              >
                {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
              <button
                onClick={resetChat}
                title="Neues Gespräch"
                className="h-10 w-10 flex items-center justify-center rounded-xl text-muted-foreground/30 hover:text-muted-foreground hover:bg-white/[0.04] transition-colors shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Saved Scripts List ─────────────────────────────────────────────── */}
      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {[{ value: "all", label: "Alle" }, ...STATUS_OPTIONS].map((s) => (
          <button key={s.value} onClick={() => setFilterStatus(s.value)}
            className={`rounded-xl px-4 py-1.5 text-xs font-medium transition-all ${
              filterStatus === s.value
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "glass border-white/[0.06] text-muted-foreground hover:text-foreground"
            }`}>
            {s.label}
          </button>
        ))}
        <span className="ml-1 text-[11px] text-muted-foreground">{filtered.length} Skripte</span>
      </div>

      {/* Script list */}
      <div className="space-y-3">
        {filtered.map(script => (
          <ScriptCard key={script.id} script={script} onEdit={() => openEdit(script)} onDelete={() => handleDelete(script.id)} />
        ))}
        {filtered.length === 0 && (
          <div className="glass rounded-2xl p-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground font-medium">Noch keine gespeicherten Skripte.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Generiere eine Woche und speichere die Skripte.</p>
          </div>
        )}
      </div>

      {/* Edit / Save Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setDialogOpen(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-strong rounded-2xl border-white/[0.08]">
          <DialogHeader>
            <DialogTitle>{editing ? "Skript bearbeiten" : "Neues Skript"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Titel / Thema</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="z.B. Wie ich meinen ersten Deal abgeschlossen habe"
                className="mt-1.5 rounded-xl glass border-white/[0.08] h-11 text-sm" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Pillar</Label>
                <Input value={form.pillar} onChange={(e) => setForm({ ...form, pillar: e.target.value })}
                  className="mt-1.5 rounded-xl glass border-white/[0.08] h-10 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Content Type</Label>
                <Input value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                  className="mt-1.5 rounded-xl glass border-white/[0.08] h-10 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="mt-1.5 w-full h-10 rounded-xl glass border border-white/[0.08] bg-transparent px-3 text-sm text-foreground focus:outline-none">
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Format</Label>
              <Input value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}
                placeholder="z.B. Face to Camera + B-Roll"
                className="mt-1.5 rounded-xl glass border-white/[0.08] h-10 text-sm" />
            </div>

            <div>
              <Label className="text-xs text-amber-400/80">Hook</Label>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5 mb-1.5">Der erste Satz — fesselt die Aufmerksamkeit sofort.</p>
              <Textarea value={form.hook} onChange={(e) => setForm({ ...form, hook: e.target.value })}
                rows={2} placeholder="z.B. Ich hatte keine Ahnung, wie das laufen würde — und dann passierte das hier."
                className="rounded-xl glass border-white/[0.08] text-sm leading-relaxed" />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Skript / Hauptteil</Label>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={8} placeholder="Vollständiger Skripttext…"
                className="rounded-xl glass border-white/[0.08] text-sm leading-relaxed font-mono" />
            </div>

            <div>
              <Label className="text-xs text-green-400/80">Call to Action</Label>
              <Textarea value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })}
                rows={2} placeholder="z.B. Wenn du mehr darüber erfahren willst, schreib mir eine DM mit 'INFO'."
                className="rounded-xl glass border-white/[0.08] text-sm leading-relaxed" />
            </div>

            <Button onClick={handleSave} disabled={!form.title}
              className="w-full rounded-xl h-11 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0">
              {editing ? "Änderungen speichern" : "Skript speichern"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
