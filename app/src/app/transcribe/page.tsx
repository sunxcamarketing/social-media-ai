"use client";

import { useEffect, useState } from "react";
import { Mic, Copy, Check, Youtube, Instagram, Loader2, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import type { ContentType, ContentFormat } from "@/lib/strategy";
import type { TrainingScript } from "@/lib/types";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.2 8.2 0 0 0 4.79 1.52V6.75a4.85 4.85 0 0 1-1.02-.06z" />
    </svg>
  );
}

function detectPlatform(url: string): "youtube" | "instagram" | "tiktok" | null {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/tiktok\.com/.test(url)) return "tiktok";
  return null;
}

function PlatformBadge({ platform }: { platform: "youtube" | "instagram" | "tiktok" | null }) {
  if (!platform) return null;
  const map = {
    youtube:   { label: "YouTube",   color: "text-red-400",  Icon: Youtube },
    instagram: { label: "Instagram", color: "text-pink-400", Icon: Instagram },
    tiktok:    { label: "TikTok",    color: "text-cyan-400", Icon: TikTokIcon },
  };
  const { label, color, Icon } = map[platform];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

export default function TranscribePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveForm, setSaveForm] = useState<Omit<TrainingScript, "id" | "createdAt">>({
    title: "", script: "", contentType: "", format: "", niche: "", notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [allTypes, setAllTypes] = useState<ContentType[]>(BUILT_IN_CONTENT_TYPES);
  const [allFormats, setAllFormats] = useState<ContentFormat[]>(BUILT_IN_FORMATS);

  const platform = detectPlatform(url);

  useEffect(() => {
    fetch("/api/strategy").then(r => r.json()).then(d => {
      setAllTypes([...BUILT_IN_CONTENT_TYPES, ...(d.customContentTypes || [])]);
      setAllFormats([...BUILT_IN_FORMATS, ...(d.customFormats || [])]);
    });
  }, []);

  async function handleTranscribe() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setTranscript("");
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler beim Transkribieren");
      setTranscript(data.transcript || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openSave() {
    setSaveForm({ title: "", script: transcript, contentType: "", format: "", niche: "", notes: "" });
    setSaveOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/training-scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saveForm),
      });
      setSaveOpen(false);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600">
          <Mic className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Transcribe</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Reels, TikToks und YouTube Shorts transkribieren
          </p>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Supported platforms */}
        <div className="flex items-center gap-5 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-red-400"><Youtube className="h-3.5 w-3.5" /> YouTube</span>
          <span className="inline-flex items-center gap-1.5 text-pink-400"><Instagram className="h-3.5 w-3.5" /> Instagram Reels</span>
          <span className="inline-flex items-center gap-1.5 text-cyan-400"><TikTokIcon className="h-3.5 w-3.5" /> TikTok</span>
        </div>

        {/* URL input */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Video-URL einfügen…"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !loading) handleTranscribe(); }}
                className="h-11 rounded-xl bg-white/[0.04] border-white/[0.08] pr-28"
              />
              {platform && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <PlatformBadge platform={platform} />
                </div>
              )}
            </div>
            <Button
              onClick={handleTranscribe}
              disabled={!url.trim() || loading}
              className="h-11 px-5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0 gap-2 shrink-0"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Transkribiert…</>
                : <><Mic className="h-4 w-4" /> Transkribieren</>}
            </Button>
          </div>

          {loading && (
            <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 px-4 py-3 space-y-1">
              <p className="text-[13px] text-muted-foreground">
                {platform === "instagram"
                  ? "Reel wird über Apify geladen und bei Gemini hochgeladen…"
                  : platform === "youtube"
                  ? "YouTube-Video wird mit Gemini verarbeitet…"
                  : "Video wird verarbeitet…"}
              </p>
              <p className="text-[11px] text-muted-foreground/50">Das kann 30–60 Sekunden dauern.</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-[13px] text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Result */}
        {transcript && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Transkript</span>
              <div className="flex items-center gap-2">
                <button onClick={handleCopy}
                  className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  {copied
                    ? <><Check className="h-3.5 w-3.5 text-green-400" /> Kopiert</>
                    : <><Copy className="h-3.5 w-3.5" /> Kopieren</>}
                </button>
                <Button onClick={openSave} size="sm"
                  className="h-7 rounded-lg px-3 text-[12px] bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0 gap-1.5">
                  <Plus className="h-3 w-3" /> Als Training-Skript speichern
                </Button>
              </div>
            </div>
            <div className="glass rounded-2xl border border-white/[0.06] p-5">
              <p className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{transcript}</p>
            </div>
          </div>
        )}
      </div>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={v => { if (!v) setSaveOpen(false); }}>
        <DialogContent className="sm:max-w-xl glass border-white/[0.08] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Als Training-Skript speichern</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Titel</Label>
              <Input autoFocus placeholder="z.B. Starker Authority-Hook" value={saveForm.title}
                onChange={e => setSaveForm({ ...saveForm, title: e.target.value })}
                className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Content-Typ</Label>
                <div className="relative">
                  <select value={saveForm.contentType} onChange={e => setSaveForm({ ...saveForm, contentType: e.target.value })}
                    className="w-full h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 pr-8 text-[13px] text-foreground appearance-none cursor-pointer focus:outline-none">
                    <option value="">Auswählen…</option>
                    {allTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Format</Label>
                <div className="relative">
                  <select value={saveForm.format} onChange={e => setSaveForm({ ...saveForm, format: e.target.value })}
                    className="w-full h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 pr-8 text-[13px] text-foreground appearance-none cursor-pointer focus:outline-none">
                    <option value="">Auswählen…</option>
                    {allFormats.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nische</Label>
              <Input placeholder="z.B. Business Coaching, Fitness…" value={saveForm.niche}
                onChange={e => setSaveForm({ ...saveForm, niche: e.target.value })}
                className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Skript</Label>
              <Textarea rows={8} value={saveForm.script}
                onChange={e => setSaveForm({ ...saveForm, script: e.target.value })}
                className="rounded-xl bg-white/[0.04] border-white/[0.08] resize-y" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notizen (optional)</Label>
              <Textarea rows={2} placeholder="Warum funktioniert das Skript?" value={saveForm.notes}
                onChange={e => setSaveForm({ ...saveForm, notes: e.target.value })}
                className="rounded-xl bg-white/[0.04] border-white/[0.08] resize-none" />
            </div>
            <Button onClick={handleSave} disabled={saving || !saveForm.title.trim()}
              className="w-full rounded-xl h-10 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0">
              {saving ? "Speichert…" : "Speichern"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
