"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Lightbulb, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Script, Idea } from "@/lib/types";

export type SourceSelection = {
  type: "script" | "idea";
  id: string;
  label: string;
  prefillText: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string;
  onSelect: (selection: SourceSelection) => void;
}

type Tab = "scripts" | "ideas";

function buildScriptPrefill(s: Script): string {
  const parts: string[] = [];
  if (s.title) parts.push(s.title);
  if (s.hook) parts.push(`Hook: ${s.hook}`);
  if (s.body) parts.push(s.body);
  if (s.cta) parts.push(`CTA: ${s.cta}`);
  return parts.join("\n\n");
}

function buildIdeaPrefill(i: Idea): string {
  const parts: string[] = [];
  if (i.title) parts.push(i.title);
  if (i.description) parts.push(i.description);
  return parts.join("\n\n");
}

export function ScriptIdeaPicker({ open, onClose, clientId, onSelect }: Props) {
  const [tab, setTab] = useState<Tab>("scripts");
  const [scripts, setScripts] = useState<Script[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open || !clientId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/scripts?clientId=${encodeURIComponent(clientId)}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/ideas?clientId=${encodeURIComponent(clientId)}`).then((r) => r.json()).catch(() => []),
    ]).then(([s, i]) => {
      setScripts(Array.isArray(s) ? s : []);
      setIdeas(Array.isArray(i) ? i : []);
      setLoading(false);
    });
  }, [open, clientId]);

  const filteredScripts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scripts;
    return scripts.filter((s) =>
      [s.title, s.hook, s.body, s.cta].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [scripts, query]);

  const filteredIdeas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ideas;
    return ideas.filter((i) =>
      [i.title, i.description].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [ideas, query]);

  const handlePickScript = (s: Script) => {
    onSelect({
      type: "script",
      id: s.id,
      label: s.title || "Skript",
      prefillText: buildScriptPrefill(s),
    });
    onClose();
  };

  const handlePickIdea = (i: Idea) => {
    onSelect({
      type: "idea",
      id: i.id,
      label: i.title || "Idee",
      prefillText: buildIdeaPrefill(i),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col glass-strong rounded-2xl border-ocean/[0.06]">
        <DialogHeader>
          <DialogTitle>Quelle auswählen</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] p-1 w-fit">
          <button
            onClick={() => setTab("scripts")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "scripts" ? "bg-warm-white text-ocean" : "text-ocean/55 hover:text-ocean"
            }`}
          >
            <FileText className="h-3.5 w-3.5" /> Skripte ({scripts.length})
          </button>
          <button
            onClick={() => setTab("ideas")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "ideas" ? "bg-warm-white text-ocean" : "text-ocean/55 hover:text-ocean"
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5" /> Ideen ({ideas.length})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen..."
            className="pl-9 rounded-xl glass border-ocean/[0.06] h-10"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ocean/40 hover:text-ocean"
              aria-label="Suche zurücksetzen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
          {loading ? (
            <p className="text-xs text-ocean/50 text-center py-8">Lade…</p>
          ) : tab === "scripts" ? (
            filteredScripts.length === 0 ? (
              <p className="text-xs text-ocean/50 text-center py-8">
                {query ? "Keine Treffer." : "Noch keine Skripte für diesen Client."}
              </p>
            ) : (
              filteredScripts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handlePickScript(s)}
                  className="w-full text-left rounded-xl border border-ocean/[0.06] bg-white/60 hover:bg-blush-light/30 hover:border-blush/30 transition-colors p-3 group"
                >
                  <p className="text-sm font-medium text-ocean leading-snug break-words">
                    {s.title || "Ohne Titel"}
                  </p>
                  {s.hook && (
                    <p className="text-[11px] text-ocean/65 mt-1 line-clamp-2 break-words">{s.hook}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {s.pillar && (
                      <span className="text-[10px] text-blush-dark/70 bg-blush/15 border border-blush/25 rounded px-1.5 py-0.5">{s.pillar}</span>
                    )}
                    {s.format && (
                      <span className="text-[10px] text-ocean/50 bg-ocean/[0.04] border border-ocean/[0.06] rounded px-1.5 py-0.5">{s.format}</span>
                    )}
                    {s.createdAt && (
                      <span className="text-[10px] text-ocean/40 ml-auto">
                        {new Date(s.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )
          ) : filteredIdeas.length === 0 ? (
            <p className="text-xs text-ocean/50 text-center py-8">
              {query ? "Keine Treffer." : "Noch keine Ideen für diesen Client."}
            </p>
          ) : (
            filteredIdeas.map((i) => (
              <button
                key={i.id}
                onClick={() => handlePickIdea(i)}
                className="w-full text-left rounded-xl border border-ocean/[0.06] bg-white/60 hover:bg-blush-light/30 hover:border-blush/30 transition-colors p-3 group"
              >
                <p className="text-sm font-medium text-ocean leading-snug break-words">
                  {i.title || "Ohne Titel"}
                </p>
                {i.description && (
                  <p className="text-[11px] text-ocean/65 mt-1 line-clamp-3 break-words">{i.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {i.contentType && (
                    <span className="text-[10px] text-ocean/55 bg-ocean/[0.04] border border-ocean/[0.06] rounded px-1.5 py-0.5">{i.contentType}</span>
                  )}
                  {i.createdAt && (
                    <span className="text-[10px] text-ocean/40 ml-auto">{i.createdAt}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
