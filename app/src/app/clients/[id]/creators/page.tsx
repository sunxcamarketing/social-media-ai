"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, Users, Eye, Film, UserCheck,
  RefreshCw, Loader2, ExternalLink, Search, Sparkles,
  ChevronDown, ChevronUp, UserPlus, Star,
} from "lucide-react";
import Link from "next/link";
import type { Creator, Config } from "@/lib/types";
import type { CreatorSuggestion } from "@/app/api/configs/[id]/research-creators/route";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

const TIER_STYLES: Record<string, { label: string; color: string }> = {
  mega:  { label: "Mega",  color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  macro: { label: "Macro", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  mid:   { label: "Mid",   color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  micro: { label: "Micro", color: "bg-green-500/10 text-green-400 border-green-500/20" },
};

function SuggestionCard({
  s, onAdd, adding, added,
}: {
  s: CreatorSuggestion;
  onAdd: () => void;
  adding: boolean;
  added: boolean;
}) {
  const tier = TIER_STYLES[s.tier] || TIER_STYLES.mid;
  return (
    <div className={`glass rounded-2xl p-4 border transition-all duration-200 ${added ? "border-green-500/30 bg-green-500/5" : "border-white/[0.06] hover:border-white/[0.1]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`https://www.instagram.com/${s.username}/`} target="_blank" rel="noopener noreferrer"
              className="text-sm font-semibold hover:text-rose-400 transition-colors">
              @{s.username}
            </a>
            {s.name && s.name !== s.username && (
              <span className="text-xs text-muted-foreground">— {s.name}</span>
            )}
            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tier.color}`}>
              {tier.label}
            </span>
            {s.estimatedFollowers && (
              <span className="text-[11px] text-muted-foreground">{s.estimatedFollowers}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{s.why}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {s.strength && (
              <span className="text-[10px] rounded-lg bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 text-muted-foreground">
                ⚡ {s.strength}
              </span>
            )}
            {s.contentStyle && (
              <span className="text-[10px] rounded-lg bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 text-muted-foreground">
                🎬 {s.contentStyle}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {added ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-green-400">
              <UserCheck className="h-3.5 w-3.5" /> Hinzugefügt
            </span>
          ) : (
            <Button size="sm" onClick={onAdd} disabled={adding}
              className="h-8 rounded-xl gap-1.5 text-xs bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 border-0">
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
              {adding ? "Wird hinzugefügt…" : "Hinzufügen"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClientCreatorsPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Config | null>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Creator | null>(null);
  const [form, setForm] = useState({ username: "", category: "" });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Research state
  const [researchOpen, setResearchOpen] = useState(false);
  const [focusHint, setFocusHint] = useState("");
  const [researching, setResearching] = useState(false);
  const [suggestions, setSuggestions] = useState<CreatorSuggestion[]>([]);
  const [researchSource, setResearchSource] = useState<"instagram" | "ai" | null>(null);
  const [researchHashtag, setResearchHashtag] = useState<string | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [addingUsername, setAddingUsername] = useState<string | null>(null);
  const [addedUsernames, setAddedUsernames] = useState<Set<string>>(new Set());

  const loadCreators = () => {
    fetch("/api/creators").then((r) => r.json()).then(setCreators);
  };

  useEffect(() => {
    fetch(`/api/configs/${id}`).then((r) => r.json()).then(setClient);
    loadCreators();
  }, [id]);

  const clientCreators = client
    ? creators.filter((c) => c.category === client.creatorsCategory)
    : [];

  // Mark already-added usernames
  const existingUsernames = new Set(clientCreators.map(c => c.username.toLowerCase()));

  const openNew = () => {
    setEditing(null);
    setForm({ username: "", category: client?.creatorsCategory || "" });
    setDialogOpen(true);
  };

  const openEdit = (creator: Creator) => {
    setEditing(creator);
    setForm({ username: creator.username, category: creator.category });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await fetch("/api/creators", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...form }),
        });
      } else {
        await fetch("/api/creators", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setDialogOpen(false);
      loadCreators();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (creatorId: string) => {
    if (!confirm("Creator löschen?")) return;
    await fetch(`/api/creators?id=${creatorId}`, { method: "DELETE" });
    loadCreators();
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/creators/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [] }),
      });
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "progress" && data.status === "scraping") {
                const c = creators.find((cr) => cr.username === data.username);
                if (c) setRefreshingId(c.id);
              } else if (data.type === "progress" && data.status === "done") {
                loadCreators();
              } else if (data.type === "complete") {
                setRefreshingId(null);
              }
            } catch { /* skip */ }
          }
        }
      }
    } finally {
      setRefreshing(false);
      setRefreshingId(null);
      loadCreators();
    }
  };

  const handleRefreshOne = async (creatorId: string) => {
    setRefreshingId(creatorId);
    try {
      const response = await fetch("/api/creators/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [creatorId] }),
      });
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }
      loadCreators();
    } finally {
      setRefreshingId(null);
    }
  };

  const runResearch = async () => {
    setResearching(true);
    setResearchError(null);
    setSuggestions([]);
    setResearchSource(null);
    setResearchHashtag(null);
    try {
      const res = await fetch(`/api/configs/${id}/research-creators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: focusHint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Recherche fehlgeschlagen");
      setSuggestions(data.suggestions || []);
      setResearchSource(data.source || null);
      setResearchHashtag(data.hashtag || null);
    } catch (e) {
      setResearchError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setResearching(false);
    }
  };

  const addSuggestion = async (s: CreatorSuggestion) => {
    if (addingUsername) return;
    setAddingUsername(s.username);
    try {
      await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: s.username, category: client?.creatorsCategory || "" }),
      });
      setAddedUsernames(prev => new Set([...prev, s.username.toLowerCase()]));
      loadCreators();
      // Trigger stats scrape in background
      fetch("/api/creators/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [] }),
      }).then(() => loadCreators()).catch(() => {});
    } finally {
      setAddingUsername(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Creators</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verfolgte Competitor-Accounts für {client?.configName || "diesen Kunden"}
            {client?.creatorsCategory && (
              <Badge variant="secondary" className="ml-2 rounded-md text-[10px] bg-white/[0.05] border border-white/[0.06]">
                {client.creatorsCategory}
              </Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleRefreshAll} disabled={refreshing}
            className="rounded-xl glass border-white/[0.08] gap-1.5 text-xs">
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh All
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} variant="ghost"
                className="rounded-xl glass border border-white/[0.08] gap-1.5 text-xs">
                <Plus className="h-4 w-4" /> Manuell hinzufügen
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong rounded-2xl border-white/[0.08]">
              <DialogHeader>
                <DialogTitle>{editing ? "Creator bearbeiten" : "Creator hinzufügen"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Instagram Username</Label>
                  <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="z.B. garyvee" className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Kategorie</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" readOnly={!editing} />
                  {!editing && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Automatisch gesetzt: {client?.creatorsCategory}
                    </p>
                  )}
                </div>
                {!editing && (
                  <p className="text-[11px] text-muted-foreground">
                    Profilbild, Follower und Aktivitätsdaten werden automatisch gescrapt.
                  </p>
                )}
                <Button onClick={handleSave} disabled={saving || !form.username || !form.category}
                  className="w-full rounded-xl h-11 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 border-0">
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? "Speichert…" : "Füge hinzu…"}</> : editing ? "Speichern" : "Hinzufügen"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={() => setResearchOpen(!researchOpen)}
            className="rounded-xl h-10 gap-1.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 border-0 text-xs">
            <Search className="h-3.5 w-3.5" /> Creators recherchieren
            {researchOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Research Panel */}
      {researchOpen && (
        <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-red-500/5 p-5 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/30">
              <Sparkles className="h-4 w-4 text-rose-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">KI-Recherche</p>
              <p className="text-xs text-muted-foreground">
                Findet die besten Creator, größten Persönlichkeiten und interessantesten Charaktere in der Nische <strong className="text-foreground/70">{client?.creatorsCategory}</strong>
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              value={focusHint}
              onChange={(e) => setFocusHint(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !researching) runResearch(); }}
              placeholder="Optionaler Fokus, z.B. 'nur Dubai-basierte', 'unter 500K', 'besonders polarisierende Charaktere'…"
              className="flex-1 rounded-xl glass border-white/[0.08] h-11 text-sm"
            />
            <Button onClick={runResearch} disabled={researching}
              className="h-11 px-5 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 border-0 gap-2 shrink-0">
              {researching
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Recherchiert…</>
                : <><Search className="h-4 w-4" /> Recherchieren</>}
            </Button>
          </div>

          {researchError && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{researchError}</p>
          )}

          {researching && (
            <div className="space-y-2 px-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
                KI generiert Hashtags → sucht echte Creator auf Instagram…
              </div>
              <p className="text-xs text-muted-foreground/60 pl-6">Echte Accounts direkt aus Instagram-Hashtags der Nische. Kann bis zu 60 Sekunden dauern.</p>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-4">
              {/* Source banner */}
              {researchSource === "instagram" ? (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-400">
                    Echte Instagram-Accounts aus <strong>#{researchHashtag}</strong> — verifiziert, kein KI-Raten
                  </p>
                </div>
              ) : researchSource === "ai" ? (
                <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                  <p className="text-xs text-amber-400">
                    KI-Vorschläge (Apify nicht verfügbar) — Usernames vor dem Hinzufügen auf Instagram prüfen
                  </p>
                </div>
              ) : null}

              {/* Tier summary */}
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-xs text-muted-foreground">{suggestions.length} Vorschläge gefunden:</p>
                {(["mega", "macro", "mid", "micro"] as const).map(tier => {
                  const count = suggestions.filter(s => s.tier === tier).length;
                  if (!count) return null;
                  const style = TIER_STYLES[tier];
                  return (
                    <span key={tier} className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-medium ${style.color}`}>
                      {style.label} · {count}
                    </span>
                  );
                })}
              </div>

              {/* Suggestions grouped by tier */}
              {(["mega", "macro", "mid", "micro"] as const).map(tier => {
                const group = suggestions.filter(s => s.tier === tier);
                if (!group.length) return null;
                const style = TIER_STYLES[tier];
                return (
                  <div key={tier} className="space-y-2">
                    <p className={`text-[10px] font-medium uppercase tracking-wider ${style.color.split(" ")[1]}`}>
                      {style.label}
                    </p>
                    {group.map(s => {
                      const alreadyExists = existingUsernames.has(s.username.toLowerCase());
                      const wasAdded = addedUsernames.has(s.username.toLowerCase());
                      return (
                        <SuggestionCard
                          key={s.username}
                          s={s}
                          onAdd={() => addSuggestion(s)}
                          adding={addingUsername === s.username}
                          added={alreadyExists || wasAdded}
                        />
                      );
                    })}
                  </div>
                );
              })}

              <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] px-4 py-3">
                <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
                  <Star className="h-3 w-3 text-amber-400/60 shrink-0" />
                  {researchSource === "instagram"
                    ? "Accounts stammen direkt aus echten Instagram-Posts — Follower-Zahlen werden nach dem Hinzufügen per Apify live abgerufen."
                    : "KI-Vorschläge aus Trainingswissen — bitte auf Instagram verifizieren, bevor du hinzufügst."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Creator Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clientCreators.map((creator) => {
          const isRefreshing = refreshingId === creator.id;
          return (
            <div key={creator.id}
              className={`group glass rounded-2xl p-5 transition-all duration-300 hover:bg-white/[0.05] hover:border-white/[0.1] ${isRefreshing ? "animate-pulse" : ""}`}>
              <div className="flex items-start justify-between">
                <a href={`https://www.instagram.com/${creator.username}/`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="relative h-12 w-12 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-rose-500/20 to-red-500/20 border border-white/[0.1]">
                    {creator.profilePicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/proxy-image?url=${encodeURIComponent(creator.profilePicUrl)}`}
                        alt={`@${creator.username}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground/50">
                        {creator.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold hover:text-rose-400 transition-colors">@{creator.username}</p>
                    <Badge variant="secondary" className="mt-0.5 rounded-md text-[10px] bg-white/[0.05] border border-white/[0.06]">
                      {creator.category}
                    </Badge>
                  </div>
                </a>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" onClick={() => handleRefreshOne(creator.id)} disabled={isRefreshing}
                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground">
                    {isRefreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(creator)}
                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(creator.id)}
                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-red-400">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {(creator.followers > 0 || creator.lastScrapedAt) ? (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-black/20 border border-white/[0.04] p-2.5 text-center">
                    <UserCheck className="mx-auto h-3.5 w-3.5 text-blue-400 mb-1" />
                    <p className="text-sm font-bold">{formatNumber(creator.followers)}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Follower</p>
                  </div>
                  <div className="rounded-xl bg-black/20 border border-white/[0.04] p-2.5 text-center">
                    <Film className="mx-auto h-3.5 w-3.5 text-rose-400 mb-1" />
                    <p className="text-sm font-bold">{creator.reelsCount30d}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Reels/30d</p>
                  </div>
                  <div className="rounded-xl bg-black/20 border border-white/[0.04] p-2.5 text-center">
                    <Eye className="mx-auto h-3.5 w-3.5 text-emerald-400 mb-1" />
                    <p className="text-sm font-bold">{formatNumber(creator.avgViews30d)}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Ø Views</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl bg-black/20 border border-white/[0.04] p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">
                    Noch keine Daten — <RefreshCw className="inline h-3 w-3" /> klicken zum Scrapen
                  </p>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between">
                {creator.lastScrapedAt ? (
                  <p className="text-[10px] text-muted-foreground/60">
                    Gescrapt {new Date(creator.lastScrapedAt).toLocaleDateString("de-DE")}
                  </p>
                ) : <span />}
                <Link href={`/clients/${id}/videos?creator=${creator.username}`}
                  className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 transition-colors">
                  Videos ansehen <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          );
        })}

        {clientCreators.length === 0 && !researchOpen && (
          <div className="col-span-full glass rounded-2xl p-12 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <h3 className="mt-4 font-semibold">Noch keine Creators</h3>
            <p className="mt-1 text-sm text-muted-foreground mb-5">Lass die KI die besten Creators in der Nische finden oder füge manuell hinzu.</p>
            <Button onClick={() => setResearchOpen(true)}
              className="rounded-xl h-9 gap-1.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 border-0 text-xs">
              <Search className="h-3.5 w-3.5" /> KI-Recherche starten
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
