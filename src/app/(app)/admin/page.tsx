"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  Users,
  ArrowRight,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Send,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Section } from "@/components/ui/section";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { Script } from "@/lib/types";

interface Config {
  id: string;
  configName?: string;
  name?: string;
  isOwner?: boolean;
  clickupListId?: string;
}

interface CostsResponse {
  days: number;
  adminTotal: number;
  clientTotal: number;
  grandTotal: number;
  byClient: Record<string, { admin: number; client: number; total: number }>;
}

const DAY_MS = 24 * 3600 * 1000;
const fmtUsd = (n: number) => `$${n.toFixed(2)}`;

export default function AdminDashboard() {
  const { user } = useCurrentUser();
  const [clients, setClients] = useState<Config[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [costs7, setCosts7] = useState<CostsResponse | null>(null);
  const [costs30, setCosts30] = useState<CostsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // `Date.now()` is impure, so React's purity rules forbid calling it
  // during render. Lazy-init useState captures it once at mount.
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    Promise.all([
      fetch("/api/configs").then((r) => r.json()).catch(() => []),
      fetch("/api/scripts").then((r) => r.json()).catch(() => []),
      fetch("/api/admin/costs?days=7").then((r) => r.json()).catch(() => null),
      fetch("/api/admin/costs?days=30").then((r) => r.json()).catch(() => null),
    ]).then(([cfgs, scs, c7, c30]) => {
      setClients(Array.isArray(cfgs) ? cfgs : []);
      setScripts(Array.isArray(scs) ? scs : []);
      setCosts7(c7);
      setCosts30(c30);
      setLoading(false);
    });
  }, []);

  const clientById = useMemo(() => {
    const map = new Map<string, Config>();
    for (const c of clients) map.set(c.id, c);
    return map;
  }, [clients]);

  const clientName = (id: string) => {
    const c = clientById.get(id);
    return c?.configName || c?.name || "Client";
  };

  const weekAgo = mountedAt - 7 * DAY_MS;
  const threeDaysAgo = mountedAt - 3 * DAY_MS;
  const fiveDaysAgo = mountedAt - 5 * DAY_MS;

  const ts = (s: string | null | undefined) => (s ? new Date(s).getTime() : 0);

  const deliveredScripts = scripts.filter((s) => !!s.clickupCardId);
  const deliveredThisWeek = deliveredScripts.filter((s) => {
    // Use feedback_at as proxy if approved, else releasedAt, else createdAt
    const t = ts(s.clientFeedbackAt) || ts(s.releasedAt) || ts(s.createdAt);
    return t >= weekAgo;
  });

  // ── Action queue (Was muss ich tun) ──────────────────────────────────────
  // Sorted by urgency: revisions/rejected first, then stale states.
  const revisions = scripts
    .filter((s) => s.clientFeedbackStatus === "revision_requested")
    .sort((a, b) => ts(b.clientFeedbackAt) - ts(a.clientFeedbackAt));

  const rejected = scripts
    .filter((s) => s.clientFeedbackStatus === "rejected")
    .sort((a, b) => ts(b.clientFeedbackAt) - ts(a.clientFeedbackAt));

  // Approved but not in ClickUp — auto-sync may have failed, needs manual push
  const approvedNotInClickUp = scripts.filter(
    (s) => s.clientFeedbackStatus === "approved" && !s.clickupCardId,
  );

  // Drafts older than 3 days — work-in-progress that's stuck
  const staleDrafts = scripts.filter(
    (s) =>
      s.status === "entwurf" &&
      !s.releasedAt &&
      ts(s.createdAt) > 0 &&
      ts(s.createdAt) < threeDaysAgo,
  );

  // Released > 5 days without any client feedback — chase the client
  const ghostedScripts = scripts.filter((s) => {
    if (!s.releasedAt) return false;
    if (s.clientFeedbackStatus) return false;
    if (ts(s.releasedAt) > fiveDaysAgo) return false;
    // Don't chase owner brands — they don't go through portal feedback
    const cfg = clientById.get(s.clientId);
    return !cfg?.isOwner;
  });

  const totalTodo =
    revisions.length +
    rejected.length +
    approvedNotInClickUp.length +
    staleDrafts.length +
    ghostedScripts.length;

  // ── Recent deliveries (Was wurde geliefert) ──────────────────────────────
  const recentDeliveries = [...deliveredScripts]
    .sort((a, b) => {
      const ta = ts(a.clientFeedbackAt) || ts(a.releasedAt) || ts(a.createdAt);
      const tb = ts(b.clientFeedbackAt) || ts(b.releasedAt) || ts(b.createdAt);
      return tb - ta;
    })
    .slice(0, 6);

  // ── Top costs ────────────────────────────────────────────────────────────
  const topCostClients = costs30
    ? Object.entries(costs30.byClient)
        .filter(([cid]) => cid !== "__global__")
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 4)
    : [];

  // ── Per-client snapshot ──────────────────────────────────────────────────
  const clientRows = clients.map((c) => {
    const cs = scripts.filter((s) => s.clientId === c.id);
    const delivered = cs.filter((s) => !!s.clickupCardId).length;
    const open = cs.filter(
      (s) =>
        s.clientFeedbackStatus === "revision_requested" ||
        s.clientFeedbackStatus === "rejected",
    ).length;
    const cost30 = costs30?.byClient[c.id]?.total ?? 0;
    return { client: c, total: cs.length, delivered, open, cost30 };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <PageHeader
        tone="hero"
        icon={Sparkles}
        eyebrow={new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
        title={user?.firstName ? `Hallo ${user.firstName}` : "Hallo"}
        subtitle={
          totalTodo > 0
            ? `${totalTodo} Punkte warten auf dich · ${deliveredThisWeek.length} Skripte diese Woche geliefert`
            : `Alles im grünen Bereich · ${deliveredThisWeek.length} Skripte diese Woche geliefert`
        }
      />

      {/* Top stats — focused on the 4 things she cares about */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          label="Geliefert · 7 Tage"
          value={deliveredThisWeek.length}
          sublabel={`${deliveredScripts.length} insgesamt in ClickUp`}
          icon={<Send className="h-3.5 w-3.5" />}
          accent="green"
          loading={loading}
        />
        <StatTile
          label="Offen für mich"
          value={totalTodo}
          sublabel={totalTodo === 0 ? "nichts dringend" : "siehe Liste unten"}
          icon={<Inbox className="h-3.5 w-3.5" />}
          accent={totalTodo > 0 ? "amber" : "ocean"}
          loading={loading}
        />
        <StatTile
          label="Kosten · 7 Tage"
          value={loading ? "…" : fmtUsd(costs7?.grandTotal ?? 0)}
          sublabel={costs30 ? `${fmtUsd(costs30.grandTotal)} (30 Tage)` : ""}
          icon={<DollarSign className="h-3.5 w-3.5" />}
          accent="ocean"
          loading={loading}
        />
        <StatTile
          label="Clients"
          value={clients.length}
          sublabel={`${clients.filter((c) => c.isOwner).length} eigene · ${clients.filter((c) => !c.isOwner).length} Kunden`}
          icon={<Users className="h-3.5 w-3.5" />}
          accent="blush"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        {/* LEFT (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Action queue */}
          <Section
            title="Was muss ich tun"
            icon={AlertTriangle}
            action={
              <span className={`text-[11px] font-medium ${totalTodo > 0 ? "text-amber-600" : "text-green-600"}`}>
                {totalTodo} offen
              </span>
            }
          >
            {totalTodo === 0 ? (
              <div className="rounded-xl bg-green-50/40 border border-green-200/40 p-6 text-center">
                <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-green-700 font-medium">Alles erledigt</p>
                <p className="text-xs text-green-600/70 mt-1">Keine Revisionen, keine offenen Drafts, keine Geister-Skripte.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {revisions.slice(0, 4).map((s, i) => (
                  <ActionRow
                    key={s.id}
                    delay={i}
                    href={`/clients/${s.clientId}/scripts`}
                    icon={<RotateCcw className="h-4 w-4 text-amber-600" />}
                    bg="bg-amber-50"
                    border="border-amber-200/60 hover:border-amber-300"
                    title={s.title || "Unbenannt"}
                    label="Verbesserung gewünscht"
                    labelClass="text-amber-700"
                    sublabel={clientName(s.clientId)}
                    quote={s.clientFeedbackText || undefined}
                  />
                ))}
                {rejected.slice(0, 3).map((s, i) => (
                  <ActionRow
                    key={s.id}
                    delay={revisions.length + i}
                    href={`/clients/${s.clientId}/scripts`}
                    icon={<ThumbsDown className="h-4 w-4 text-red-500" />}
                    bg="bg-red-50"
                    border="border-red-200/60 hover:border-red-300"
                    title={s.title || "Unbenannt"}
                    label="Abgelehnt"
                    labelClass="text-red-600"
                    sublabel={clientName(s.clientId)}
                    quote={s.clientFeedbackText || undefined}
                  />
                ))}
                {approvedNotInClickUp.slice(0, 3).map((s, i) => (
                  <ActionRow
                    key={s.id}
                    delay={revisions.length + rejected.length + i}
                    href={`/clients/${s.clientId}/scripts`}
                    icon={<ExternalLink className="h-4 w-4 text-purple-600" />}
                    bg="bg-purple-50"
                    border="border-purple-200/60 hover:border-purple-300"
                    title={s.title || "Unbenannt"}
                    label="Approved aber nicht in ClickUp"
                    labelClass="text-purple-700"
                    sublabel={`${clientName(s.clientId)} · klick & sende manuell`}
                  />
                ))}
                {staleDrafts.slice(0, 3).map((s, i) => (
                  <ActionRow
                    key={s.id}
                    delay={revisions.length + rejected.length + approvedNotInClickUp.length + i}
                    href={`/clients/${s.clientId}/scripts`}
                    icon={<Clock className="h-4 w-4 text-ocean/60" />}
                    bg="bg-ocean/5"
                    border="border-ocean/[0.1] hover:border-ocean/20"
                    title={s.title || "Unbenannt"}
                    label="Entwurf > 3 Tage"
                    labelClass="text-ocean/70"
                    sublabel={`${clientName(s.clientId)} · entweder finalisieren oder löschen`}
                  />
                ))}
                {ghostedScripts.slice(0, 3).map((s, i) => (
                  <ActionRow
                    key={s.id}
                    delay={revisions.length + rejected.length + approvedNotInClickUp.length + staleDrafts.length + i}
                    href={`/clients/${s.clientId}/scripts`}
                    icon={<Inbox className="h-4 w-4 text-slate-500" />}
                    bg="bg-slate-100"
                    border="border-slate-200/60 hover:border-slate-300"
                    title={s.title || "Unbenannt"}
                    label="Kunde ghostet > 5 Tage"
                    labelClass="text-slate-600"
                    sublabel={`${clientName(s.clientId)} · vielleicht erinnern`}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Was wurde geliefert */}
          <Section
            title="Letzte Lieferungen"
            icon={CheckCircle2}
            action={
              <span className="text-[11px] text-ocean/40 uppercase tracking-wider">
                {deliveredThisWeek.length} diese Woche
              </span>
            }
            delay={0.05}
          >
            {recentDeliveries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ocean/[0.1] bg-warm-white/50 p-6 text-center">
                <Send className="h-6 w-6 text-ocean/20 mx-auto mb-2" />
                <p className="text-sm text-ocean/50">Noch keine Skripte an ClickUp geliefert.</p>
                <p className="text-[11px] text-ocean/40 mt-1">Push manuell mit dem &bdquo;CU&rdquo;-Button auf der Skript-Seite.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white border border-ocean/[0.06] divide-y divide-ocean/[0.04] overflow-hidden">
                {recentDeliveries.map((s, i) => {
                  const isApproved = s.clientFeedbackStatus === "approved";
                  const cfg = clientById.get(s.clientId);
                  const isOwner = !!cfg?.isOwner;
                  const dt = ts(s.clientFeedbackAt) || ts(s.releasedAt) || ts(s.createdAt);
                  const dateStr = dt
                    ? new Date(dt).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })
                    : "—";
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.02 * i }}
                    >
                      <Link
                        href={`/clients/${s.clientId}/scripts`}
                        className="group flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-ocean/[0.02] transition-colors"
                      >
                        <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                          <Send className="h-3.5 w-3.5 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-ocean break-words line-clamp-1 flex-1 min-w-0">{s.title || "Unbenannt"}</p>
                            {isApproved && (
                              <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-md px-1.5 py-0.5 font-medium shrink-0 inline-flex items-center gap-1">
                                <ThumbsUp className="h-2.5 w-2.5" /> Approved
                              </span>
                            )}
                            {isOwner && (
                              <span className="text-[10px] text-blush-dark bg-blush-light/40 border border-blush/30 rounded-md px-1.5 py-0.5 font-medium shrink-0">eigene Brand</span>
                            )}
                          </div>
                          <p className="text-[11px] text-ocean/45 mt-0.5 truncate">
                            {clientName(s.clientId)} · {dateStr}
                          </p>
                        </div>
                        {s.clickupCardId && (
                          <a
                            href={`https://app.clickup.com/t/${s.clickupCardId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md px-2 py-0.5 font-medium shrink-0"
                          >
                            ClickUp →
                          </a>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 text-ocean/15 group-hover:text-ocean/50 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        {/* RIGHT (1/3) */}
        <div className="space-y-5">
          {/* Costs */}
          <Section
            title="Kosten"
            icon={DollarSign}
            action={
              <Link href="/costs" className="text-[11px] text-ocean/40 hover:text-ocean transition-colors">
                Details →
              </Link>
            }
          >
            <div className="rounded-2xl bg-gradient-to-br from-ocean via-ocean to-ocean-light p-4 text-white relative overflow-hidden">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/[0.04]" />
              <div className="relative">
                <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1">7 Tage</p>
                <p className="text-3xl font-light tabular-nums">
                  {loading ? "…" : fmtUsd(costs7?.grandTotal ?? 0)}
                </p>
                <div className="mt-3 pt-3 border-t border-white/10 flex justify-between text-xs">
                  <div>
                    <p className="text-white/50 text-[10px]">Admin</p>
                    <p className="tabular-nums text-white/90">{fmtUsd(costs7?.adminTotal ?? 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/50 text-[10px]">Client-Portal</p>
                    <p className="tabular-nums text-white/90">{fmtUsd(costs7?.clientTotal ?? 0)}</p>
                  </div>
                </div>
              </div>
            </div>
            {topCostClients.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-ocean/40">Top 30 Tage</p>
                {topCostClients.map(([cid, amt]) => (
                  <div key={cid} className="flex items-center justify-between text-[12px] py-0.5">
                    <span className="text-ocean/70 truncate">{clientName(cid)}</span>
                    <span className="tabular-nums text-ocean/90 font-medium">{fmtUsd(amt.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Clients snapshot */}
          {clientRows.length > 0 && (
            <Section title="Clients" icon={Users} delay={0.1}>
              <div className="rounded-2xl bg-white border border-ocean/[0.06] divide-y divide-ocean/[0.04] overflow-hidden">
                {clientRows.map((row, i) => {
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
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-medium ${
                          row.client.isOwner
                            ? "bg-gradient-to-br from-blush to-blush-dark text-white"
                            : "bg-gradient-to-br from-blush-light to-blush-light/40 text-blush-dark"
                        }`}>
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ocean font-medium truncate">{name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                            <span className="text-ocean/50">{row.delivered}/{row.total} geliefert</span>
                            {row.open > 0 && (
                              <span className="text-amber-600 font-medium">· {row.open} offen</span>
                            )}
                            {row.cost30 > 0 && (
                              <span className="text-ocean/40">· {fmtUsd(row.cost30)}</span>
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
        </div>
      </div>
    </div>
  );
}

// ── ActionRow: one entry in the "Was muss ich tun" list ─────────────────────

function ActionRow({
  delay, href, icon, bg, border, title, label, labelClass, sublabel, quote,
}: {
  delay: number;
  href: string;
  icon: React.ReactNode;
  bg: string;
  border: string;
  title: string;
  label: string;
  labelClass: string;
  sublabel: string;
  quote?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.04 * delay, duration: 0.3 }}
    >
      <Link
        href={href}
        className={`group flex items-start gap-3 rounded-xl bg-white border p-3 sm:p-4 transition-all hover:-translate-y-0.5 ${border}`}
      >
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-medium text-ocean break-words line-clamp-1 flex-1 min-w-0">{title}</p>
            <span className={`text-[10px] font-medium ${labelClass}`}>{label}</span>
          </div>
          <p className="text-[11px] text-ocean/50 truncate">{sublabel}</p>
          {quote && (
            <p className="text-xs text-ocean/70 mt-1.5 line-clamp-2 break-words italic">&ldquo;{quote}&rdquo;</p>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-ocean/20 group-hover:text-ocean/60 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
      </Link>
    </motion.div>
  );
}
