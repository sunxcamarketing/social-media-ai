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
import type { Config } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

interface SaveForm {
  clientId: string;
  title: string;
  script: string;
  contentType: string;
  format: string;
  niche: string;
  notes: string;
}

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
    youtube:   { label: "YouTube",   color: "text-red-500",  Icon: Youtube },
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
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveForm, setSaveForm] = useState<SaveForm>({
    clientId: "", title: "", script: "", contentType: "", format: "", niche: "", notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [allTypes, setAllTypes] = useState<ContentType[]>(BUILT_IN_CONTENT_TYPES);
  const [allFormats, setAllFormats] = useState<ContentFormat[]>(BUILT_IN_FORMATS);
  const [clients, setClients] = useState<Config[]>([]);

  const platform = detectPlatform(url);

  useEffect(() => {
    fetch("/api/strategy").then(r => r.json()).then(d => {
      setAllTypes([...BUILT_IN_CONTENT_TYPES, ...(d.customContentTypes || [])]);
      setAllFormats([...BUILT_IN_FORMATS, ...(d.customFormats || [])]);
    });
    fetch("/api/configs").then(r => r.json()).then(d => setClients(d));
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
      if (!res.ok) throw new Error(data.error || t("transcribe.errorGeneric"));
      setTranscript(data.transcript || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("transcribe.errorUnknown"));
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
    setSaveForm({ clientId: "", title: "", script: transcript, contentType: "", format: "", niche: "", notes: "" });
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

      // Auto-regenerate voice profile in the background if a client was selected.
      if (saveForm.clientId) {
        fetch(`/api/configs/${saveForm.clientId}/generate-voice-profile`, { method: "POST" })
          .catch(() => {}); // fire-and-forget
      }
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean">
          <Mic className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("nav.transcribe")}</h1>
          <p className="text-[12px] text-ocean/60 mt-0.5">
            {t("transcribe.subtitle")}
          </p>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Supported platforms */}
        <div className="flex items-center gap-5 text-[12px] text-ocean/60">
          <span className="inline-flex items-center gap-1.5 text-red-500"><Youtube className="h-3.5 w-3.5" /> YouTube</span>
          <span className="inline-flex items-center gap-1.5 text-pink-400"><Instagram className="h-3.5 w-3.5" /> Instagram Reels</span>
          <span className="inline-flex items-center gap-1.5 text-cyan-400"><TikTokIcon className="h-3.5 w-3.5" /> TikTok</span>
        </div>

        {/* URL input */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder={t("transcribe.placeholder")}
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !loading) handleTranscribe(); }}
                className="h-11 rounded-xl bg-ocean/[0.02] border-ocean/[0.06] pr-28"
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
              className="h-11 px-5 rounded-xl bg-ocean hover:bg-ocean-light border-0 gap-2 shrink-0"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("transcribe.transcribing")}</>
                : <><Mic className="h-4 w-4" /> {t("transcribe.transcribe")}</>}
            </Button>
          </div>

          {loading && (
            <div className="rounded-xl bg-blush/20 border border-blush/40 px-4 py-3 space-y-1">
              <p className="text-[13px] text-ocean/60">
                {platform === "instagram"
                  ? t("transcribe.igLoading")
                  : platform === "youtube"
                  ? t("transcribe.ytLoading")
                  : t("transcribe.genericLoading")}
              </p>
              <p className="text-[11px] text-ocean/70">{t("transcribe.duration")}</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-500">
              {error}
            </div>
          )}
        </div>

        {/* Result */}
        {transcript && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ocean/70">{t("transcribe.transcript")}</span>
              <div className="flex items-center gap-2">
                <button onClick={handleCopy}
                  className="flex items-center gap-1.5 text-[12px] text-ocean/60 hover:text-ocean transition-colors">
                  {copied
                    ? <><Check className="h-3.5 w-3.5 text-green-600" /> {t("transcribe.copied")}</>
                    : <><Copy className="h-3.5 w-3.5" /> {t("transcribe.copy")}</>}
                </button>
                <Button onClick={openSave} size="sm"
                  className="h-7 rounded-lg px-3 text-[12px] bg-ocean hover:bg-ocean-light border-0 gap-1.5">
                  <Plus className="h-3 w-3" /> {t("transcribe.saveAsTraining")}
                </Button>
              </div>
            </div>
            <div className="glass rounded-2xl border border-ocean/[0.06] p-5">
              <p className="text-[13px] text-ocean/80 leading-relaxed whitespace-pre-wrap">{transcript}</p>
            </div>
          </div>
        )}
      </div>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={v => { if (!v) setSaveOpen(false); }}>
        <DialogContent className="sm:max-w-xl glass border-ocean/[0.06] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{t("transcribe.saveTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("transcribe.client")}</Label>
              <div className="relative">
                <select value={saveForm.clientId} onChange={e => setSaveForm({ ...saveForm, clientId: e.target.value })}
                  className="w-full h-10 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] px-3 pr-8 text-[13px] text-ocean appearance-none cursor-pointer focus:outline-none">
                  <option value="">{t("transcribe.noClient")}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.configName}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/60 pointer-events-none" />
              </div>
              <p className="text-[11px] text-ocean/60">{t("transcribe.clientHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("transcribe.titleLabel")}</Label>
              <Input autoFocus placeholder={t("transcribe.titlePlaceholder")} value={saveForm.title}
                onChange={e => setSaveForm({ ...saveForm, title: e.target.value })}
                className="h-10 rounded-xl bg-ocean/[0.02] border-ocean/[0.06]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-ocean/60">{t("transcribe.contentType")}</Label>
                <div className="relative">
                  <select value={saveForm.contentType} onChange={e => setSaveForm({ ...saveForm, contentType: e.target.value })}
                    className="w-full h-10 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] px-3 pr-8 text-[13px] text-ocean appearance-none cursor-pointer focus:outline-none">
                    <option value="">{t("transcribe.selectOption")}</option>
                    {allTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/60 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-ocean/60">{t("transcribe.format")}</Label>
                <div className="relative">
                  <select value={saveForm.format} onChange={e => setSaveForm({ ...saveForm, format: e.target.value })}
                    className="w-full h-10 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] px-3 pr-8 text-[13px] text-ocean appearance-none cursor-pointer focus:outline-none">
                    <option value="">{t("transcribe.selectOption")}</option>
                    {allFormats.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/60 pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("transcribe.niche")}</Label>
              <Input placeholder={t("transcribe.nichePlaceholder")} value={saveForm.niche}
                onChange={e => setSaveForm({ ...saveForm, niche: e.target.value })}
                className="h-10 rounded-xl bg-ocean/[0.02] border-ocean/[0.06]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("transcribe.script")}</Label>
              <Textarea rows={8} value={saveForm.script}
                onChange={e => setSaveForm({ ...saveForm, script: e.target.value })}
                className="rounded-xl bg-ocean/[0.02] border-ocean/[0.06] resize-y" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">{t("transcribe.notes")}</Label>
              <Textarea rows={2} placeholder={t("transcribe.notesPlaceholder")} value={saveForm.notes}
                onChange={e => setSaveForm({ ...saveForm, notes: e.target.value })}
                className="rounded-xl bg-ocean/[0.02] border-ocean/[0.06] resize-none" />
            </div>
            <Button onClick={handleSave} disabled={saving || !saveForm.title.trim()}
              className="w-full rounded-xl h-10 bg-ocean hover:bg-ocean-light border-0">
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
