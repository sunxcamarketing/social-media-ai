"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Target, Trash2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// ── Types ─────────────────────────────────────────────────────────────────

export interface Story {
  /** Generischer Step-Name für DIESE Position in der Sequenz (z.B. "Intro",
   *  "Pain antesern", "Wunschbild", "CTA"). Macht die Strategie wiederverwendbar
   *  als Template — die `text` ist nur das konkrete Beispiel. */
  label?: string;
  /** Was soll im Bild zu sehen sein — in Layman-Sprache (z.B. "Du im Bild",
   *  "Selfie", "Kunde", "Lifestyle-Foto", "Screenshot"). Max 3-5 Wörter. */
  visual: string;
  /** Konkretes Text-Beispiel — Hook/Caption/Voice-Over Inhalt. Wird im UI
   *  als "Beispiel:" gelabelt damit klar ist dass der Kunde anpassen darf. */
  text: string;
}

export interface StoryStrategyContent {
  /** Sprechender Titel der Strategie, was der Kunde in der Liste sieht. */
  title: string;
  /** Kurzer Goal-Tag — z.B. "Verkauf", "Community", "Lead-Gen". */
  goal: string;
  /** Die Story-Sequenz — 3-7 Stories die nacheinander gepostet werden. */
  stories: Story[];
}

// ── Goal label palette — keeps the tag visually distinguishable ───────────

const GOAL_TONE: Record<string, { bg: string; text: string }> = {
  verkauf: { bg: "bg-violet-50", text: "text-violet-700" },
  pitch: { bg: "bg-violet-50", text: "text-violet-700" },
  community: { bg: "bg-blue-50", text: "text-blue-700" },
  engagement: { bg: "bg-blue-50", text: "text-blue-700" },
  authority: { bg: "bg-amber-50", text: "text-amber-700" },
  "lead-gen": { bg: "bg-emerald-50", text: "text-emerald-700" },
  leadgen: { bg: "bg-emerald-50", text: "text-emerald-700" },
};

function goalTone(goal: string) {
  return GOAL_TONE[goal.toLowerCase().trim()] || { bg: "bg-ocean/[0.06]", text: "text-ocean/70" };
}

// ── Single story tile (smartphone 9:16) ───────────────────────────────────

function StoryTile({
  story,
  index,
  total,
  onEdit,
}: {
  story: Story;
  index: number;
  total: number;
  onEdit?: () => void;
}) {
  return (
    <div className="shrink-0 w-[200px] sm:w-[220px] group/tile">
      {/* Step counter above the tile — label moves INTO the tile below */}
      <div className="mb-2 px-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ocean/45">
          Story {index + 1} / {total}
        </span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="opacity-0 group-hover/tile:opacity-100 transition-opacity text-ocean/40 hover:text-blush-dark text-[10px] font-medium uppercase tracking-widest flex items-center gap-1"
            title="Story bearbeiten"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      {/* The 9:16 tile */}
      <div className="aspect-[9/16] rounded-2xl bg-gradient-to-br from-ocean to-ocean-light p-4 text-white relative overflow-hidden flex flex-col">
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/[0.06]" />
        <div className="absolute -left-6 bottom-0 h-20 w-20 rounded-full bg-white/[0.04]" />

        {/* Visual hint */}
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/55 mb-1">
            Was zu sehen
          </p>
          <p className="text-[13px] font-medium leading-snug text-white/95">
            {story.visual}
          </p>
        </div>

        {/* Step label — psychological function. Sits in the dead middle of
            the tile so the reader sees the "why" before the concrete text. */}
        {story.label ? (
          <div className="relative flex-1 flex items-center justify-center px-2 py-3">
            <p className="text-[15px] font-semibold leading-tight text-blush text-center">
              {story.label}
            </p>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Concrete example text — labeled as "Beispiel" so the client knows to adapt */}
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/55 mb-1">
            Beispiel
          </p>
          <p className="text-sm leading-snug text-white">
            {story.text}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Connector arrow between tiles ─────────────────────────────────────────

function StepArrow() {
  return (
    <div className="shrink-0 flex items-center self-center">
      <div className="h-9 w-9 rounded-full bg-blush-light/60 flex items-center justify-center">
        <ChevronRight className="h-4 w-4 text-blush-dark" />
      </div>
    </div>
  );
}

// ── Main detail view (single strategy, sequence layout) ───────────────────

export function StoryStrategyDetail({
  content: initialContent,
  strategyId,
  clientId,
  onContentUpdated,
}: {
  content: StoryStrategyContent;
  /** When set together with clientId, story tiles get an edit affordance and
   *  changes get persisted via PATCH on the story-strategies endpoint. */
  strategyId?: string;
  clientId?: string;
  /** Called after a successful save so the parent list can sync its copy. */
  onContentUpdated?: (next: StoryStrategyContent) => void;
}) {
  const [content, setContent] = useState(initialContent);
  // Re-sync when the parent switches to a different strategy.
  useEffect(() => { setContent(initialContent); }, [initialContent]);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState({ label: "", visual: "", text: "" });
  const [saving, setSaving] = useState(false);

  const canEdit = !!strategyId && !!clientId;
  const stories = Array.isArray(content?.stories) ? content.stories : [];
  const tone = goalTone(content?.goal || "");

  const openEdit = (idx: number) => {
    const s = stories[idx];
    setForm({ label: s.label || "", visual: s.visual || "", text: s.text || "" });
    setEditingIndex(idx);
  };

  const saveEdit = async () => {
    if (editingIndex === null || !canEdit || saving) return;
    setSaving(true);
    try {
      const updatedStories = stories.map((s, i) =>
        i === editingIndex
          ? { ...s, label: form.label.trim(), visual: form.visual.trim(), text: form.text.trim() }
          : s,
      );
      const updated: StoryStrategyContent = { ...content, stories: updatedStories };
      const res = await fetch(`/api/configs/${clientId}/story-strategies`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyId, content: updated }),
      });
      if (res.ok) {
        setContent(updated);
        onContentUpdated?.(updated);
        setEditingIndex(null);
      }
    } finally {
      setSaving(false);
    }
  };

  if (stories.length === 0) {
    return (
      <div className="rounded-3xl border border-ocean/10 bg-white p-8 text-center">
        <Target className="h-6 w-6 text-ocean/30 mx-auto mb-2" />
        <p className="text-sm text-ocean/60">Diese Strategie hat noch keine Stories.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header: goal tag + title */}
      <div className="space-y-2">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest rounded-full px-3 py-1 ${tone.bg} ${tone.text}`}>
          <Target className="h-3 w-3" />
          {content.goal || "Story-Strategie"}
        </span>
        <h2 className="text-xl sm:text-2xl font-semibold text-ocean leading-tight">
          {content.title}
        </h2>
        <p className="text-xs text-ocean/55">
          {stories.length} Stories nacheinander posten — von links nach rechts.
          {canEdit && <span className="ml-1 text-ocean/40">· Hover über eine Story für „Edit&quot;.</span>}
        </p>
      </div>

      {/* Horizontal scroll of tiles with arrows between */}
      <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-2">
        <div className="flex items-stretch gap-3 min-w-min">
          {stories.map((s, i) => (
            <div key={i} className="flex items-stretch gap-3">
              <StoryTile
                story={s}
                index={i}
                total={stories.length}
                onEdit={canEdit ? () => openEdit(i) : undefined}
              />
              {i < stories.length - 1 && <StepArrow />}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={editingIndex !== null} onOpenChange={(v) => { if (!v) setEditingIndex(null); }}>
        <DialogContent className="max-w-md glass-strong rounded-2xl border-ocean/[0.06]">
          <DialogHeader>
            <DialogTitle>
              Story {editingIndex !== null ? editingIndex + 1 : ""} bearbeiten
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-ocean/60">Label (z.B. „Interesse wecken&quot;)</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Interesse wecken"
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-ocean/60">Was zu sehen</Label>
              <Input
                value={form.visual}
                onChange={(e) => setForm({ ...form, visual: e.target.value })}
                placeholder="Du im Bild · Selfie · Screenshot DM …"
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-ocean/60">Beispiel-Text</Label>
              <Textarea
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                rows={6}
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] text-sm leading-relaxed"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setEditingIndex(null)} className="rounded-xl">
                Abbrechen
              </Button>
              <Button
                onClick={saveEdit}
                disabled={saving}
                className="rounded-xl bg-ocean hover:bg-ocean-light border-0"
              >
                {saving ? "Speichere…" : "Speichern"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Strategy list card (used by stories page list view) ───────────────────

export function StoryStrategyListCard({
  content,
  active,
  onClick,
  onDelete,
}: {
  content: StoryStrategyContent;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const stories = Array.isArray(content?.stories) ? content.stories : [];
  const tone = goalTone(content?.goal || "");
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left rounded-2xl p-4 transition-all border ${
          active
            ? "bg-blush-light/40 border-blush-dark/30 ring-1 ring-blush-dark/20"
            : "bg-white border-ocean/[0.06] hover:border-blush/30 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(32,35,69,0.05)]"
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5 ${tone.bg} ${tone.text}`}>
            {content.goal || "Story"}
          </span>
          <span className="text-[10px] font-medium text-ocean/40 tabular-nums">
            {stories.length} Stories
          </span>
        </div>
        <p className="text-sm font-semibold text-ocean leading-snug mb-3 line-clamp-2">
          {content.title}
        </p>
        {/* Mini-strip: tiny phone-shaped previews */}
        <div className="flex items-center gap-1">
          {stories.slice(0, 6).map((_, i) => (
            <div
              key={i}
              className="h-4 w-2.5 rounded-sm bg-gradient-to-b from-ocean/40 to-ocean/10"
            />
          ))}
          {stories.length > 6 && (
            <span className="ml-1 text-[10px] text-ocean/40 tabular-nums">
              +{stories.length - 6}
            </span>
          )}
        </div>
      </button>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Diese Strategie löschen?")) onDelete();
          }}
          type="button"
          className="absolute top-3 right-3 h-6 w-6 rounded-md bg-white/0 hover:bg-white text-ocean/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
          title="Löschen"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
