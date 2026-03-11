"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useGeneration } from "@/context/generation-context";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
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

// 2-step topic plan types
import type { TopicPlanItem } from "@/lib/types";

type TopicSlot = {
  topic: TopicPlanItem;
  scriptStatus: "idle" | "loading" | "done" | "saved";
  script?: string;
  editing?: boolean;
};

const STATUS_OPTIONS = [
  { value: "entwurf",        labelKey: "scripts.draft" as const,     color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  { value: "bereit",         labelKey: "scripts.ready" as const,      color: "bg-green-50 text-green-600 border-green-200" },
  { value: "veröffentlicht", labelKey: "scripts.published" as const,  color: "bg-blush/20 text-blush-dark border-blush/40" },
];

function statusColor(s: string) {
  return STATUS_OPTIONS.find(o => o.value === s)?.color || "bg-ocean/[0.02] text-ocean/70 border-ocean/[0.06]";
}
function statusLabelKey(s: string) {
  return STATUS_OPTIONS.find(o => o.value === s)?.labelKey || null;
}

function ScriptCard({ script, onEdit, onDelete }: {
  script: Script;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyScript = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const full = [script.hook, script.body, script.cta].filter(Boolean).join("\n\n");
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const words = script.body ? script.body.split(/\s+/).filter(Boolean).length : 0;
  const dur = words > 0 ? fmtDuration(Math.round((words / 125) * 60)) : null;

  return (
    <div className="glass rounded-xl border border-ocean/[0.06] overflow-hidden group transition-all duration-150 hover:border-ocean/[0.1]">
      {/* Row — always visible, click to expand */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-warm-white transition-colors cursor-pointer"
      >
        <ChevronDown className={`h-3.5 w-3.5 text-ocean/65 shrink-0 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} />

        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate">{script.title || t("scripts.untitled")}</span>
        </div>

        {/* Meta tags */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {script.contentType && (
            <span className="text-[10px] text-ocean/70 rounded-md bg-ocean/[0.02] border border-ocean/[0.06] px-2 py-0.5">{script.contentType}</span>
          )}
          {dur && (
            <span className="text-[10px] text-ocean/65 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />{dur}
            </span>
          )}
          <Badge className={`rounded-md text-[10px] border ${statusColor(script.status)}`}>
            {statusLabelKey(script.status) ? t(statusLabelKey(script.status)!) : script.status}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={copyScript} className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/65 hover:text-ocean hover:bg-warm-white transition-colors">
            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/65 hover:text-ocean hover:bg-warm-white transition-colors">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/65 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-ocean/5">
          <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 px-4 py-3">
            <p className="text-sm text-ocean/80 leading-relaxed whitespace-pre-wrap">
              {[script.hook, script.body, script.cta].filter(Boolean).join("\n\n")}
            </p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            {script.pillar && <span className="text-[10px] text-blush-dark/70 rounded-md bg-blush/20 border border-blush/40 px-2 py-0.5">{script.pillar}</span>}
            {script.contentType && <span className="text-[10px] text-ocean/70 rounded-md bg-ocean/[0.02] border border-ocean/[0.06] px-2 py-0.5">{script.contentType}</span>}
            {script.format && <span className="text-[10px] text-ocean/70">{script.format}</span>}
            <button onClick={copyScript} className="ml-auto flex items-center gap-1.5 text-[11px] text-ocean/70 hover:text-ocean transition-colors">
              {copied ? <><Check className="h-3 w-3 text-green-600" /> {t("scripts.copied")}</> : <><Copy className="h-3 w-3" /> {t("scripts.copyScript")}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Topic Plan Card ──────────────────────────────────────────────────────────
const DAY_LABELS: Record<string, string> = { Mon: "Mo", Tue: "Di", Wed: "Mi", Thu: "Do", Fri: "Fr", Sat: "Sa", Sun: "So" };
const ALL_DAYS_LIST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function TopicCard({
  slot,
  onGenerateScript,
  onEditTopic,
  onSave,
}: {
  slot: TopicSlot;
  onGenerateScript: () => void;
  onEditTopic: (title: string, description: string) => void;
  onSave: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState(slot.topic.title);
  const [editDesc, setEditDesc] = useState(slot.topic.description);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const dayLabel = DAY_LABELS[slot.topic.day] || slot.topic.day;

  const handleSave = async () => {
    setSaving(true);
    await onSave();
    setSaving(false);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (slot.script) {
      await navigator.clipboard.writeText(slot.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const commitEdit = () => {
    onEditTopic(editTitle, editDesc);
    setIsEditing(false);
  };

  return (
    <div className="rounded-xl border border-ocean/[0.06] overflow-hidden transition-all duration-150 hover:border-ocean/[0.1]">
      {/* Compact row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-warm-white transition-colors cursor-pointer"
      >
        <span className="text-[11px] font-bold text-blush-dark/80 w-6 shrink-0">{dayLabel}</span>
        <ChevronDown className={`h-3 w-3 text-ocean/60 shrink-0 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} />

        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">{slot.topic.title}</span>
          <span className="text-[11px] text-ocean/70 truncate block">{slot.topic.description}</span>
        </div>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          {slot.topic.contentType && <span className="text-[10px] text-ocean/65 bg-ocean/[0.02] border border-ocean/[0.06] rounded px-1.5 py-0.5">{slot.topic.contentType}</span>}
          {slot.scriptStatus === "done" && <Badge className="rounded-md text-[10px] border bg-green-50 text-green-600 border-green-200">{t("training.scriptDone")}</Badge>}
          {slot.scriptStatus === "saved" && <Badge className="rounded-md text-[10px] border bg-blush/20 text-blush-dark border-blush/40">{t("training.saved")}</Badge>}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-ocean/5">
          {/* Topic editing */}
          {isEditing ? (
            <div className="space-y-2">
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="h-9 rounded-lg bg-ocean/[0.02] border-ocean/[0.06] text-sm" placeholder="Titel" />
              <Input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                className="h-9 rounded-lg bg-ocean/[0.02] border-ocean/[0.06] text-sm" placeholder="Beschreibung" />
              <div className="flex gap-2">
                <Button onClick={commitEdit} size="sm" className="h-7 rounded-lg px-3 text-[11px] bg-blush/30 hover:bg-blush/40 text-blush-dark border border-blush/50">{t("scripts.apply")}</Button>
                <button onClick={() => setIsEditing(false)} className="text-[11px] text-ocean/70 hover:text-ocean">{t("scripts.cancel")}</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-blush-dark/60 rounded bg-blush/20 border border-blush/40 px-2 py-0.5">{slot.topic.pillar}</span>
              <span className="text-[10px] text-ocean/65">{slot.topic.format}</span>
              <button onClick={(e) => { e.stopPropagation(); setEditTitle(slot.topic.title); setEditDesc(slot.topic.description); setIsEditing(true); }}
                className="ml-auto text-[11px] text-ocean/65 hover:text-ocean flex items-center gap-1 transition-colors">
                <Pencil className="h-3 w-3" /> {t("scripts.changeTopic")}
              </button>
            </div>
          )}

          {/* Script section */}
          {slot.scriptStatus === "idle" && (
            <Button onClick={(e) => { e.stopPropagation(); onGenerateScript(); }}
              className="h-9 rounded-xl bg-ocean hover:bg-ocean-light border-0 gap-2 text-[12px] text-white">
              <Sparkles className="h-3.5 w-3.5" /> {t("scripts.writeScript")}
            </Button>
          )}

          {slot.scriptStatus === "loading" && (
            <div className="flex items-center gap-2 py-3">
              <Loader2 className="h-4 w-4 text-blush-dark animate-spin" />
              <span className="text-[12px] text-ocean/60">{t("scripts.writing")}</span>
            </div>
          )}

          {(slot.scriptStatus === "done" || slot.scriptStatus === "saved") && slot.script && (
            <div className="space-y-3">
              <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 px-4 py-3">
                <p className="text-sm text-ocean/80 leading-relaxed whitespace-pre-wrap">{slot.script}</p>
              </div>
              <div className="flex items-center gap-2">
                {slot.scriptStatus === "done" && (
                  <>
                    <Button onClick={handleSave} disabled={saving} size="sm"
                      className="h-7 rounded-lg px-3 text-[11px] bg-green-500/20 hover:bg-green-500/30 text-green-600 border border-green-500/30 gap-1.5">
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} {t("scripts.save")}
                    </Button>
                    <Button onClick={(e) => { e.stopPropagation(); onGenerateScript(); }} variant="ghost" size="sm"
                      className="h-7 rounded-lg px-3 text-[11px] text-ocean/70 hover:text-ocean gap-1.5">
                      <RefreshCw className="h-3 w-3" /> {t("scripts.regenerate")}
                    </Button>
                  </>
                )}
                {slot.scriptStatus === "saved" && (
                  <span className="text-[11px] text-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> {t("scripts.saved")}</span>
                )}
                <button onClick={handleCopy} className="ml-auto flex items-center gap-1.5 text-[11px] text-ocean/70 hover:text-ocean transition-colors">
                  {copied ? <><Check className="h-3 w-3 text-green-600" /> {t("scripts.copied")}</> : <><Copy className="h-3 w-3" /> {t("scripts.copyScript")}</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-ocean/5 bg-ocean/[0.02]">
        <span className="text-[11px] font-bold text-ocean/60 w-6 shrink-0">{dayLabel}</span>
        {slot.status === "loading"
          ? <Loader2 className="h-3.5 w-3.5 text-blush-dark/60 animate-spin" />
          : <div className="h-3.5 w-24 rounded bg-ocean/[0.02]" />}
      </div>
    );
  }

  // ── error
  if (slot.status === "error") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
        <span className="text-[11px] font-bold text-red-500/60 w-6 shrink-0">{dayLabel}</span>
        <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
        <span className="text-[11px] text-red-500/70 flex-1 truncate">{slot.error}</span>
        <button onClick={() => onRegenerate(dayIndex)} className="h-6 w-6 flex items-center justify-center rounded-lg text-red-500/60 hover:text-red-500 transition-colors" title="Erneut versuchen">
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // ── saved
  if (slot.status === "saved") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-200 bg-green-50">
        <span className="text-[11px] font-bold text-green-600/60 w-6 shrink-0">{dayLabel}</span>
        <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
        <span className="text-[11px] text-green-600/70">{t("scripts.saved")}</span>
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
    <div className="rounded-xl border border-ocean/[0.06] overflow-hidden transition-all duration-150 hover:border-ocean/[0.1]">
      {/* Compact row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-warm-white transition-colors cursor-pointer"
      >
        <span className="text-[11px] font-bold text-blush-dark/80 w-6 shrink-0">{dayLabel}</span>
        <ChevronDown className={`h-3 w-3 text-ocean/60 shrink-0 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} />

        <span className="flex-1 text-sm font-medium truncate">{s.title || "Skript"}</span>

        <div className="hidden md:flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {s.contentType && <span className="text-[10px] text-ocean/65 bg-ocean/[0.02] border border-ocean/[0.06] rounded px-1.5 py-0.5">{s.contentType}</span>}
          <button
            onClick={() => onRegenerate(dayIndex)}
            className="h-6 w-6 flex items-center justify-center rounded-lg text-ocean/60 hover:text-ocean hover:bg-warm-white transition-colors"
            title={t("scripts.regenerate")}
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`h-6 flex items-center gap-1 px-2 rounded-lg text-[10px] transition-colors ${
              saved ? "text-green-600 bg-green-50" : "text-ocean/65 hover:text-ocean hover:bg-warm-white"
            }`}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {saved ? t("scripts.saved") : t("scripts.save")}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-ocean/5">
          <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 px-4 py-3">
            <p className="text-sm text-ocean/80 leading-relaxed whitespace-pre-wrap">
              {[s.hook, s.body, s.cta].filter(Boolean).join("\n\n")}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {s.pillar && <span className="text-[10px] text-blush-dark/60 rounded bg-blush/20 border border-blush/40 px-2 py-0.5">{s.pillar}</span>}
            {s.contentType && <span className="text-[10px] text-ocean/70 rounded bg-ocean/[0.02] border border-ocean/[0.06] px-2 py-0.5">{s.contentType}</span>}
            {s.format && <span className="text-[10px] text-ocean/65">{s.format}</span>}
            {/* Mobile save */}
            <button onClick={handleSave} disabled={saving || saved}
              className={`md:hidden ml-auto flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-colors ${saved ? "text-green-600 bg-green-50" : "text-ocean/60 hover:text-ocean bg-ocean/[0.02] border border-ocean/[0.06]"}`}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
              {saved ? t("scripts.saved") : t("scripts.save")}
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
  hook: "", body: "", cta: "", status: "entwurf", fullScript: "",
};

export default function ClientScriptsPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { generations, startChatGeneration, clearGeneration } = useGeneration();
  const genState = id ? generations.get(id) : undefined;
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

  // 2-step topic plan
  const [topicPlan, setTopicPlan] = useState<TopicSlot[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

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

  // Auto-reload when background generation completes
  useEffect(() => {
    if (genState?.status === "done") loadScripts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genState?.status]);

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

  // ── Topic Plan generation (Step 1) ─────────────────────────────────────────
  const generateTopicPlan = async () => {
    setPlanLoading(true);
    setPlanError(null);
    setTopicPlan([]);

    try {
      const res = await fetch(`/api/configs/${id}/generate-topic-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Plan-Generierung fehlgeschlagen");

      const topics: TopicPlanItem[] = data.topics || [];
      setTopicPlan(topics.map(t => ({ topic: t, scriptStatus: "idle" as const })));
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setPlanLoading(false);
    }
  };

  // Generate script for a specific topic (Step 2)
  const generateTopicScript = async (index: number) => {
    const slot = topicPlan[index];
    if (!slot) return;

    setTopicPlan(prev => prev.map((s, i) => i === index ? { ...s, scriptStatus: "loading" as const, script: undefined } : s));

    try {
      const res = await fetch(`/api/configs/${id}/generate-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicOverride: slot.topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Skript-Generierung fehlgeschlagen");

      const scriptText = data.script || data.body || "";
      setTopicPlan(prev => prev.map((s, i) => i === index ? { ...s, scriptStatus: "done" as const, script: scriptText } : s));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Fehler bei Skript-Generierung");
      setTopicPlan(prev => prev.map((s, i) => i === index ? { ...s, scriptStatus: "idle" as const } : s));
    }
  };

  // Edit a topic inline
  const editTopic = (index: number, title: string, description: string) => {
    setTopicPlan(prev => prev.map((s, i) =>
      i === index ? { ...s, topic: { ...s.topic, title, description }, scriptStatus: "idle" as const, script: undefined } : s
    ));
  };

  // Save a topic's script
  const saveTopicScript = async (index: number) => {
    const slot = topicPlan[index];
    if (!slot?.script) return;

    await fetch("/api/scripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: id,
        title: slot.topic.title,
        pillar: slot.topic.pillar,
        contentType: slot.topic.contentType,
        format: slot.topic.format,
        hook: "",
        body: slot.script,
        cta: "",
        status: "entwurf",
      }),
    });
    setTopicPlan(prev => prev.map((s, i) => i === index ? { ...s, scriptStatus: "saved" as const } : s));
    loadScripts();
  };

  // Legacy: save week script (used by chat)
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

  // ── Saved scripts CRUD ─────────────────────────────────────────────────────
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
          <p className="mt-1 text-sm text-ocean/70">Video-Skripte für {client?.configName || "diesen Kunden"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={openNew}
            className="rounded-xl h-10 gap-1.5 border border-ocean/[0.06] text-xs">
            <Plus className="h-3.5 w-3.5" /> Manuell
          </Button>
        </div>
      </div>

      {/* ── Background generation banner ────────────────────────────────────── */}
      {genState?.status === "generating" && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-5 py-3.5">
          <Loader2 className="h-4 w-4 animate-spin text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-600">Skripte werden generiert…</p>
            <p className="text-xs text-ocean/60 mt-0.5">Du kannst den Tab wechseln — die Generierung läuft im Hintergrund weiter.</p>
          </div>
        </div>
      )}
      {genState?.status === "done" && (
        <div className="flex items-center gap-3 rounded-2xl border border-green-500/25 bg-green-50 px-5 py-3.5">
          <div className="h-4 w-4 rounded-full bg-green-400 flex items-center justify-center shrink-0">
            <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-600">{genState.count} Skripte aus dem Gespräch erstellt</p>
            <p className="text-xs text-ocean/60 mt-0.5">Automatisch gespeichert — sieh sie unten in der Liste.</p>
          </div>
          <button onClick={() => clearGeneration(id)} className="text-[11px] text-ocean/65 hover:text-ocean transition-colors shrink-0">✕</button>
        </div>
      )}
      {genState?.status === "error" && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/25 bg-red-50 px-5 py-3.5">
          <p className="text-sm text-red-500 flex-1">Fehler: {genState.error}</p>
          <button onClick={() => clearGeneration(id)} className="text-[11px] text-ocean/65 hover:text-ocean transition-colors shrink-0">✕</button>
        </div>
      )}

      {/* ── Week Planning Panel (2-Step) ────────────────────────────────────── */}
      <div className="rounded-2xl border border-blush/40 bg-blush-light/20 p-5 space-y-5">
        {/* Panel header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blush/30 border border-blush/50 shrink-0">
              <Calendar className="h-4 w-4 text-blush-dark" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Wochenplanung</p>
              <p className="text-xs text-ocean/70 mt-0.5">
                {topicPlan.length === 0
                  ? "Schritt 1: Themenplan generieren — Schritt 2: Skripte für einzelne Themen schreiben"
                  : `${topicPlan.length} Themen geplant — klicke auf ein Thema um das Skript zu schreiben`}
              </p>
            </div>
          </div>

          {/* Data sources */}
          <div className="hidden sm:flex flex-col gap-1 items-end shrink-0">
            <div className={`flex items-center gap-1.5 text-[11px] ${ownVideoCount > 0 ? "text-green-600" : "text-ocean/65"}`}>
              <TrendingUp className="h-3 w-3 shrink-0" />
              {ownVideoCount > 0 ? <span>{ownVideoCount} {t("scripts.ownVideos")}</span> : <span>{t("scripts.noOwnAnalysis")}</span>}
            </div>
            <div className={`flex items-center gap-1.5 text-[11px] ${creatorVideoCount > 0 ? "text-ocean/60" : "text-ocean/65"}`}>
              <Users className="h-3 w-3 shrink-0" />
              {creatorVideoCount > 0 ? <span>{creatorVideoCount} {t("scripts.creatorVideos")}</span> : <span>{t("scripts.noCreatorVideos")}</span>}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-blush-dark/80">
              <Brain className="h-3 w-3 shrink-0" />
              <span>{t("scripts.strategyProfile")}</span>
            </div>
          </div>
        </div>

        {/* Generate button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={generateTopicPlan}
            disabled={planLoading}
            className="h-10 px-6 rounded-xl bg-ocean hover:bg-ocean-light border-0 gap-2 shrink-0 text-white"
          >
            {planLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Themen werden geplant…</>
              : topicPlan.length > 0
                ? <><RefreshCw className="h-4 w-4" /> Themen neu planen</>
                : <><Sparkles className="h-4 w-4" /> Woche planen</>}
          </Button>
        </div>

        {planError && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{planError}</p>
        )}

        {/* Topic plan list */}
        {topicPlan.length > 0 && (
          <div className="space-y-1.5">
            {topicPlan.map((slot, i) => (
              <TopicCard
                key={`${slot.topic.day}-${i}`}
                slot={slot}
                onGenerateScript={() => generateTopicScript(i)}
                onEditTopic={(title, desc) => editTopic(i, title, desc)}
                onSave={() => saveTopicScript(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Ideen-Chat ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-50/50 overflow-hidden">
        {/* Chat header — always visible */}
        <button
          onClick={() => { if (chatOpen) { setChatOpen(false); } else { openChat(); } }}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-warm-white transition-colors"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 shrink-0">
            <MessageCircle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Ideen-Chat</p>
            <p className="text-xs text-ocean/70 mt-0.5">
              Entwickle Ideen im Gespräch — basierend auf echten Erfahrungen
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 text-ocean/65 shrink-0 transition-transform duration-200 ${chatOpen ? "rotate-180" : ""}`} />
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
                        ? "bg-amber-500/20 border border-amber-500/25 text-ocean/80 rounded-br-sm"
                        : "bg-ocean/[0.02] border border-ocean/[0.06] text-ocean/60 rounded-bl-sm"
                    }`}
                  >
                    {msg.content
                      ? msg.content.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                          part.startsWith("**") && part.endsWith("**")
                            ? <strong key={j} className="text-ocean">{part.slice(2, -2)}</strong>
                            : part
                        )
                      : <span className="opacity-40">…</span>
                    }
                  </div>
                </div>
              ))}
              {chatLoading && chatMessages.at(-1)?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="bg-ocean/[0.02] border border-ocean/[0.06] rounded-2xl rounded-bl-sm px-4 py-2.5">
                    <Loader2 className="h-4 w-4 text-ocean/65 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Finish chat banner */}
            {(aiSuggestsScript || hasEnoughContext) && (
              <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-blush/20 border border-blush/40 px-4 py-3">
                <Lightbulb className="h-4 w-4 text-blush-dark shrink-0" />
                <p className="text-xs text-blush-dark/80 flex-1">Genug Input — ich erstelle automatisch 2–3 Skripte aus dem Gespräch.</p>
                <Button
                  onClick={() => {
                    startChatGeneration(id, chatMessages);
                    setChatOpen(false);
                    setChatMessages([]);
                    setChatInitialized(false);
                  }}
                  size="sm"
                  className="h-7 px-3 text-xs rounded-lg bg-blush/30 hover:bg-blush/40 text-blush-dark border border-blush/50 gap-1.5 shrink-0"
                >
                  <Sparkles className="h-3 w-3" /> Gespräch abschließen
                </Button>
              </div>
            )}

            {/* Generated script from chat */}
            {chatScriptResult && (
              <div className="mx-4 mb-3 rounded-xl border border-blush/50 bg-blush-light/30 overflow-hidden">
                <div className="px-4 py-3 border-b border-blush/30 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-blush-dark">{chatScriptResult.title}</p>
                    <p className="text-[10px] text-ocean/70 mt-0.5">{chatScriptResult.contentType} · {chatScriptResult.pillar}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setChatScriptResult(null)} className="text-[10px] text-ocean/65 hover:text-ocean transition-colors">{t("common.cancel")}</button>
                    <Button onClick={saveChatScript} size="sm" className="h-7 px-3 text-xs rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-600 border border-green-500/30 gap-1.5">
                      <Save className="h-3 w-3" /> {t("scripts.save")}
                    </Button>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2.5 max-h-60 overflow-y-auto">
                  {chatScriptResult.hook && (
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-ivory/60 font-medium mb-1">Hook</p>
                      <p className="text-xs text-ocean/80 leading-relaxed">{chatScriptResult.hook}</p>
                    </div>
                  )}
                  {chatScriptResult.body && (
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-ocean/70 font-medium mb-1">Skript</p>
                      <p className="text-xs text-ocean/60 leading-relaxed whitespace-pre-wrap">{chatScriptResult.body}</p>
                    </div>
                  )}
                  {chatScriptResult.cta && (
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-green-600/60 font-medium mb-1">CTA</p>
                      <p className="text-xs text-ocean/60 leading-relaxed">{chatScriptResult.cta}</p>
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
                className="flex-1 h-10 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] px-4 text-sm placeholder:text-ocean/60 focus:outline-none focus:border-amber-500/30 disabled:opacity-50 transition-colors"
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
                className="h-10 w-10 flex items-center justify-center rounded-xl text-ocean/60 hover:text-ocean hover:bg-warm-white transition-colors shrink-0"
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
        {[{ value: "all", labelKey: null as string | null }, ...STATUS_OPTIONS].map((s) => (
          <button key={s.value} onClick={() => setFilterStatus(s.value)}
            className={`rounded-xl px-4 py-1.5 text-xs font-medium transition-all ${
              filterStatus === s.value
                ? "bg-blush/30 text-blush-dark border border-blush/50"
                : "glass border-ocean/[0.06] text-ocean/70 hover:text-ocean"
            }`}>
            {s.labelKey ? t(s.labelKey) : "Alle"}
          </button>
        ))}
        <span className="ml-1 text-[11px] text-ocean/70">{filtered.length} Skripte</span>
      </div>

      {/* Script list */}
      <div className="space-y-3">
        {filtered.map(script => (
          <ScriptCard key={script.id} script={script} onEdit={() => openEdit(script)} onDelete={() => handleDelete(script.id)} />
        ))}
        {filtered.length === 0 && (
          <div className="glass rounded-2xl p-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-ocean/20 mb-4" />
            <p className="text-sm text-ocean/70 font-medium">Noch keine gespeicherten Skripte.</p>
            <p className="text-xs text-ocean/60 mt-1">Generiere eine Woche und speichere die Skripte.</p>
          </div>
        )}
      </div>

      {/* Edit / Save Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setDialogOpen(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-strong rounded-2xl border-ocean/[0.06]">
          <DialogHeader>
            <DialogTitle>{editing ? "Skript bearbeiten" : "Neues Skript"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <Label className="text-xs text-ocean/70">Titel / Thema</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="z.B. Wie ich meinen ersten Deal abgeschlossen habe"
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-11 text-sm" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-ocean/70">Pillar</Label>
                <Input value={form.pillar} onChange={(e) => setForm({ ...form, pillar: e.target.value })}
                  className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-ocean/70">Content Type</Label>
                <Input value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                  className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-ocean/70">Status</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="mt-1.5 w-full h-10 rounded-xl glass border border-ocean/[0.06] bg-transparent px-3 text-sm text-ocean focus:outline-none">
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-ocean/70">Format</Label>
              <Input value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}
                placeholder="z.B. Face to Camera + B-Roll"
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10 text-sm" />
            </div>

            <div>
              <Label className="text-xs text-ocean/70">Skript</Label>
              <p className="text-[11px] text-ocean/60 mt-0.5 mb-1.5">Der komplette gesprochene Text — vom Hook bis zum CTA.</p>
              <Textarea value={form.fullScript} onChange={(e) => setForm({ ...form, fullScript: e.target.value })}
                rows={12} placeholder="Das vollständige Skript zum Vorlesen…"
                className="rounded-xl glass border-ocean/[0.06] text-sm leading-relaxed" />
            </div>

            <Button onClick={handleSave} disabled={!form.title || !form.fullScript}
              className="w-full rounded-xl h-11 bg-ocean hover:bg-ocean-light border-0 text-white">
              {editing ? "Änderungen speichern" : "Skript speichern"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
