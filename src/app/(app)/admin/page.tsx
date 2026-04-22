"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Users,
  FileText,
  Lightbulb,
  ArrowRight,
  Mic,
  Search,
  MessageSquare,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Clock,
  BarChart3,
  Eye,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Section } from "@/components/ui/section";
import type { Script } from "@/lib/types";

interface Config {
  id: string;
  configName?: string;
  name?: string;
  strategyGoal?: string;
  igFollowers?: string;
}

export default function AdminDashboard() {
  const [clients, setClients] = useState<Config[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [ideas, setIdeas] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/configs").then((r) => r.json()).catch(() => []),
      fetch("/api/scripts").then((r) => r.json()).catch(() => []),
      fetch("/api/ideas").then((r) => r.json()).catch(() => []),
    ]).then(([cfgs, scs, is]) => {
      setClients(Array.isArray(cfgs) ? cfgs : []);
      setScripts(Array.isArray(scs) ? scs : []);
      setIdeas(Array.isArray(is) ? is : []);
      setLoading(false);
    });
  }, []);

  const clientName = (id: string) => {
    const c = clients.find((cl) => cl.id === id);
    return c?.configName || c?.name || "Client";
  };

  // Derived insights
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 3600 * 1000;
  const scriptsThisWeek = scripts.filter((s) => {
    if (!s.createdAt) return false;
    const ts = new Date(s.createdAt).getTime();
    return !isNaN(ts) && ts >= weekAgo;
  }).length;

  const approved = scripts.filter((s) => s.clientFeedbackStatus === "approved");
  const rejected = scripts.filter((s) => s.clientFeedbackStatus === "rejected");
  const revisions = scripts.filter((s) => s.clientFeedbackStatus === "revision_requested");
  const feedbackGiven = approved.length + rejected.length + revisions.length;
  const feedbackQueue = [...rejected, ...revisions]
    .sort((a, b) => (b.clientFeedbackAt || "").localeCompare(a.clientFeedbackAt || ""))
    .slice(0, 5);

  const recentScripts = [...scripts]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 8);

  // Per-client activity: count scripts, ideas, pending feedback
  const clientsWithActivity = clients.map((c) => {
    const cScripts = scripts.filter((s) => s.clientId === c.id);
    const cPending = cScripts.filter((s) => !s.clientFeedbackStatus).length;
    const cRevision = cScripts.filter((s) => s.clientFeedbackStatus === "revision_requested").length;
    return { client: c, scripts: cScripts.length, pending: cPending, revision: cRevision };
  });

  const quickActions = [
    { title: "Content Agent", description: "Chat über alle Clients", href: "/chat", icon: MessageSquare, accent: "from-ocean/[0.04] to-ocean/[0.08] border-ocean/[0.1]" },
    { title: "Audit", description: "Instagram-Profil analysieren", href: "/analyse", icon: Search, accent: "from-blush-light/40 to-blush/20 border-blush/30" },
    { title: "Transkribieren", description: "Audio/Video → Text", href: "/transcribe", icon: Mic, accent: "from-ocean/[0.04] to-ivory/[0.08] border-ivory/15" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        tone="hero"
        icon={Sparkles}
        eyebrow={new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
        title="Hallo Aysun"
        subtitle={
          revisions.length > 0
            ? `${revisions.length} Überarbeitungen warten auf dich. ${approved.length} Skripte wurden freigegeben.`
            : feedbackGiven > 0
              ? `${approved.length} freigegeben · ${revisions.length} in Überarbeitung · ${scripts.length - feedbackGiven} ohne Feedback`
              : `Überblick über ${clients.length} Clients und ${scripts.length} Skripte`
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          label="Clients"
          value={clients.length}
          sublabel="aktive Accounts"
          icon={<Users className="h-3.5 w-3.5" />}
          accent="ocean"
          loading={loading}
        />
        <StatTile
          label="Skripte · 7 Tage"
          value={scriptsThisWeek}
          sublabel={`von ${scripts.length} insgesamt`}
          icon={<FileText className="h-3.5 w-3.5" />}
          accent="blush"
          loading={loading}
        />
        <StatTile
          label="Freigegeben"
          value={approved.length}
          sublabel={revisions.length > 0 ? `${revisions.length} Überarbeitungen offen` : "super, läuft"}
          icon={<ThumbsUp className="h-3.5 w-3.5" />}
          accent={revisions.length > 0 ? "amber" : "green"}
          loading={loading}
        />
        <StatTile
          label="Ideen-Pool"
          value={ideas.length}
          sublabel="über alle Clients"
          icon={<Lightbulb className="h-3.5 w-3.5" />}
          accent="blush"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        {/* LEFT (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Feedback Queue */}
          {feedbackQueue.length > 0 && (
            <Section
              title="Client-Feedback"
              icon={Clock}
              action={
                <span className="text-[11px] text-amber-600 font-medium">
                  {rejected.length + revisions.length} offen
                </span>
              }
            >
              <div className="space-y-2">
                {feedbackQueue.map((s, i) => {
                  const isRevision = s.clientFeedbackStatus === "revision_requested";
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i, duration: 0.3 }}
                    >
                      <Link
                        href={`/clients/${s.clientId}/scripts`}
                        className={`group flex items-start gap-3 rounded-xl bg-white border p-3 sm:p-4 transition-all hover:-translate-y-0.5 ${
                          isRevision
                            ? "border-amber-200/60 hover:border-amber-300 hover:shadow-[0_4px_16px_rgba(245,158,11,0.08)]"
                            : "border-red-200/60 hover:border-red-300 hover:shadow-[0_4px_16px_rgba(239,68,68,0.08)]"
                        }`}
                      >
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isRevision ? "bg-amber-50" : "bg-red-50"}`}>
                          {isRevision ? <RotateCcw className="h-4 w-4 text-amber-600" /> : <ThumbsDown className="h-4 w-4 text-red-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-medium text-ocean break-words line-clamp-1">{s.title || "Unbenannt"}</p>
                            <span className={`text-[10px] font-medium ${isRevision ? "text-amber-600" : "text-red-500"}`}>
                              {isRevision ? "Überarbeitung" : "Abgelehnt"}
                            </span>
                          </div>
                          <p className="text-[11px] text-ocean/50 truncate">{clientName(s.clientId)}</p>
                          {s.clientFeedbackText && (
                            <p className="text-xs text-ocean/70 mt-1.5 line-clamp-2 break-words italic">&ldquo;{s.clientFeedbackText}&rdquo;</p>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-ocean/20 group-hover:text-ocean/60 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Recent scripts */}
          {recentScripts.length > 0 && (
            <Section
              title="Neueste Skripte"
              icon={FileText}
              action={
                <span className="text-[11px] text-ocean/40 uppercase tracking-wider">
                  {recentScripts.length} von {scripts.length}
                </span>
              }
              delay={0.05}
            >
              <div className="rounded-2xl bg-white border border-ocean/[0.06] divide-y divide-ocean/[0.04] overflow-hidden">
                {recentScripts.map((s, i) => {
                  const fb = s.clientFeedbackStatus;
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.02 * i }}
                    >
                      <Link
                        href={`/clients/${s.clientId}/scripts`}
                        className="group flex items-start gap-3 px-4 sm:px-5 py-3 hover:bg-ocean/[0.02] transition-colors"
                      >
                        <div className="h-8 w-8 rounded-lg bg-blush-light/40 flex items-center justify-center shrink-0">
                          <FileText className="h-3.5 w-3.5 text-blush-dark" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-ocean break-words line-clamp-1 flex-1 min-w-0">{s.title || "Unbenannt"}</p>
                            {fb === "approved" && <FeedbackDot tone="green" label="Freigegeben" />}
                            {fb === "rejected" && <FeedbackDot tone="red" label="Abgelehnt" />}
                            {fb === "revision_requested" && <FeedbackDot tone="amber" label="Überarbeitung" />}
                          </div>
                          <p className="text-xs text-ocean/45 mt-0.5 truncate">
                            {clientName(s.clientId)}
                            {s.pillar && ` · ${s.pillar}`}
                            {s.createdAt && ` · ${s.createdAt.slice(0, 10)}`}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-ocean/15 group-hover:text-ocean/50 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </Section>
          )}

          {recentScripts.length === 0 && !loading && (
            <div className="rounded-2xl border-2 border-dashed border-ocean/[0.1] bg-warm-white/50 p-8 text-center">
              <Sparkles className="h-6 w-6 text-ocean/20 mx-auto mb-3" />
              <p className="text-sm text-ocean/50">Noch keine Skripte erstellt.</p>
            </div>
          )}
        </div>

        {/* RIGHT (1/3) */}
        <div className="space-y-5">
          {/* Quick Actions */}
          <Section title="Schnellzugriff" icon={Sparkles}>
            <div className="space-y-2">
              {quickActions.map((a, i) => (
                <motion.div
                  key={a.href}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.3 }}
                >
                  <Link
                    href={a.href}
                    className={`group flex items-center gap-3 rounded-xl bg-gradient-to-r ${a.accent} border p-3 hover:-translate-y-0.5 hover:shadow-md transition-all`}
                  >
                    <div className="h-9 w-9 rounded-lg bg-white/60 flex items-center justify-center shrink-0">
                      <a.icon className="h-4 w-4 text-ocean" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ocean">{a.title}</p>
                      <p className="text-[11px] text-ocean/55 truncate">{a.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-ocean/30 group-hover:text-ocean group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                </motion.div>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-ocean/[0.02] border border-ocean/[0.04] p-3">
              <p className="text-[11px] text-ocean/55 leading-relaxed">
                Drück <kbd className="font-mono bg-white rounded px-1 py-0.5 border border-ocean/[0.08]">⌘K</kbd> für die schnelle Suche.
              </p>
            </div>
          </Section>

          {/* Per-client activity */}
          {clientsWithActivity.length > 0 && (
            <Section title="Clients" icon={Users} delay={0.1}>
              <div className="rounded-2xl bg-white border border-ocean/[0.06] divide-y divide-ocean/[0.04] overflow-hidden">
                {clientsWithActivity.map((row, i) => {
                  const name = row.client.configName || row.client.name || "Unbenannt";
                  return (
                    <motion.div
                      key={row.client.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.03 * i }}
                    >
                      <Link
                        href={`/clients/${row.client.id}/dashboard`}
                        className="group flex items-center gap-3 px-3 py-2.5 hover:bg-ocean/[0.02] transition-colors"
                      >
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blush-light to-blush-light/40 flex items-center justify-center shrink-0 text-[10px] font-medium text-blush-dark">
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ocean font-medium truncate">{name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-ocean/50">{row.scripts} Skripte</span>
                            {row.pending > 0 && (
                              <span className="text-[10px] text-amber-600 font-medium">· {row.pending} ohne Feedback</span>
                            )}
                            {row.revision > 0 && (
                              <span className="text-[10px] text-red-500 font-medium">· {row.revision} Überarbeitung</span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-ocean/15 group-hover:text-ocean/60 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Momentum mini-chart placeholder */}
          {scripts.length > 0 && (
            <Section title="Momentum" icon={BarChart3} delay={0.15}>
              <div className="rounded-2xl bg-gradient-to-br from-ocean via-ocean to-ocean-light p-4 text-white relative overflow-hidden">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/[0.04]" />
                <div className="relative">
                  <p className="text-[10px] uppercase tracking-wider text-white/50 mb-3">Feedback-Rate</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-light tabular-nums">
                      {scripts.length > 0 ? Math.round((feedbackGiven / scripts.length) * 100) : 0}%
                    </p>
                    <p className="text-xs text-white/60">{feedbackGiven} von {scripts.length}</p>
                  </div>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${scripts.length > 0 ? (feedbackGiven / scripts.length) * 100 : 0}%` }}
                      transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-blush via-blush-dark to-ivory rounded-full"
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-[10px] text-white/60">
                    <span className="inline-flex items-center gap-1"><Eye className="h-2.5 w-2.5" /> {approved.length} ✓</span>
                    <span>{revisions.length} 🔄</span>
                    <span>{rejected.length} ✗</span>
                  </div>
                </div>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedbackDot({ tone, label }: { tone: "green" | "amber" | "red"; label: string }) {
  const map = {
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red:   "bg-red-50 text-red-600 border-red-200",
  } as const;
  return <span className={`text-[10px] border rounded-md px-1.5 py-0.5 font-medium shrink-0 ${map[tone]}`}>{label}</span>;
}
