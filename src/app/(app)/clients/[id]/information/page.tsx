"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Globe,
  Instagram,
  Linkedin,
  Youtube,
  Twitter,
  MapPin,
  Briefcase,
  User,
  Pencil,
  Sparkles,
  Loader2,
  Heart,
  Users,
  MessageSquare,
  Plus,
  CheckCircle2,
  RefreshCw,
  UserCheck,
  Film,
  Mic,
  ArrowRight,
} from "lucide-react";
import type { Config, VoiceOnboarding, VoiceBlockId } from "@/lib/types";
import { VOICE_BLOCK_ORDER } from "@/lib/types";
import { VoiceAgent } from "@/components/voice-agent";
import { safeJsonParse } from "@/lib/safe-json";
import { useGeneration } from "@/context/generation-context";
import { useClientData } from "@/context/client-data-context";
import { useI18n } from "@/lib/i18n";
import { fmt } from "@/lib/format";
import { Mail, Trash2, Shield } from "lucide-react";

function ClientAccessSection({ clientId }: { clientId: string }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; userId: string; email: string; invitedAt: string; acceptedAt: string | null }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    fetch(`/api/auth/invite?clientId=${clientId}`)
      .then(r => r.json())
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [clientId]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteResult(null);
    setInviteError(null);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      setInviteResult(data.message);
      setInviteEmail("");
      // Refresh list
      const listRes = await fetch(`/api/auth/invite?clientId=${clientId}`);
      setUsers(await listRes.json());
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setInviting(false);
    }
  };

  const revokeAccess = async (id: string) => {
    if (!confirm("Zugang wirklich entziehen?")) return;
    await fetch(`/api/auth/invite?id=${id}`, { method: "DELETE" });
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Shield className="h-4 w-4 text-ocean/60" /> Kundenzugang
      </h2>

      {/* Invite form */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/40" />
          <Input
            type="email"
            placeholder="kunde@email.de"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
            className="pl-9 h-9 rounded-xl bg-warm-white border-ocean/10 text-sm"
          />
        </div>
        <Button
          onClick={handleInvite}
          disabled={inviting || !inviteEmail.trim()}
          size="sm"
          className="h-9 rounded-xl bg-ocean hover:bg-ocean-light text-white border-0 px-4 text-xs"
        >
          {inviting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Einladen"}
        </Button>
      </div>

      {inviteResult && (
        <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">{inviteResult}</p>
      )}
      {inviteError && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{inviteError}</p>
      )}

      {/* User list */}
      {loadingUsers ? (
        <div className="flex items-center gap-2 text-xs text-ocean/50">
          <Loader2 className="h-3 w-3 animate-spin" /> Lade...
        </div>
      ) : users.length > 0 ? (
        <div className="space-y-1.5">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between rounded-xl bg-warm-white px-3 py-2 text-xs group">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-ocean/40" />
                <span className="text-ocean/80">{u.email}</span>
                {u.acceptedAt ? (
                  <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Aktiv</span>
                ) : (
                  <span className="text-[10px] text-ocean/50 bg-ocean/5 px-1.5 py-0.5 rounded">Eingeladen</span>
                )}
              </div>
              <button
                onClick={() => revokeAccess(u.id)}
                className="h-6 w-6 flex items-center justify-center rounded-lg text-ocean/30 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                title="Zugang entziehen"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ocean/50">Noch keine Kunden eingeladen.</p>
      )}
    </div>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.2 8.2 0 0 0 4.79 1.52V6.75a4.85 4.85 0 0 1-1.02-.06z" />
    </svg>
  );
}

function SocialLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  if (!href) return null;
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-ocean/5 text-sm text-ocean/70 hover:text-ocean hover:border-ocean/[0.06] transition-all">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </a>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] text-ocean/70 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  iconColor,
  title,
  onEdit,
  children,
  empty,
  editLabel,
  noInfoLabel,
  addInfoLabel,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
  empty: boolean;
  editLabel: string;
  noInfoLabel: string;
  addInfoLabel: string;
}) {
  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} /> {title}
        </h2>
        <Button variant="ghost" size="sm" onClick={onEdit}
          className="h-7 gap-1 rounded-lg px-2 text-xs text-ocean/70 hover:text-ocean">
          <Pencil className="h-3 w-3" /> {editLabel}
        </Button>
      </div>
      {empty ? (
        <div className="text-center py-4">
          <p className="text-sm text-ocean/70">{noInfoLabel}</p>
          <Button variant="ghost" size="sm" onClick={onEdit}
            className="mt-2 rounded-xl text-xs text-ocean/70 hover:text-ocean gap-1">
            <Pencil className="h-3 w-3" /> {addInfoLabel}
          </Button>
        </div>
      ) : children}
    </div>
  );
}

interface DreamCustomer {
  tonality: string;
  age: string;
  gender: string;
  income: string;
  country: string;
  profession: string;
  values: string;
  description: string;
}

interface CustomerProblems {
  mental: string;
  physical: string;
  financial: string;
  social: string;
  aesthetic: string;
}

function parseDreamCustomer(val: string): DreamCustomer {
  return safeJsonParse<DreamCustomer>(val, { tonality: "", age: "", gender: "", income: "", country: "", profession: "", values: "", description: "" });
}

function parseCustomerProblems(val: string): CustomerProblems {
  return safeJsonParse<CustomerProblems>(val, { mental: "", physical: "", financial: "", social: "", aesthetic: "" });
}

interface InstagramProfile {
  username: string;
  fullName: string;
  bio: string;
  followers: number;
  following: number;
  postsCount: number;
  profilePicUrl: string;
  category: string;
  verified: boolean;
  lastUpdated: string;
}

function getFollowupQuestions(t: (key: string) => string): { field: keyof Config; label: string; question: string; rows?: number }[] {
  return [
    { field: "businessContext",        label: t("fq.businessContext.label"),       question: t("fq.businessContext.question"), rows: 3 },
    { field: "professionalBackground", label: t("fq.professionalBackground.label"), question: t("fq.professionalBackground.question"), rows: 2 },
    { field: "keyAchievements",        label: t("fq.keyAchievements.label"),  question: t("fq.keyAchievements.question"), rows: 2 },
    { field: "brandFeeling",           label: t("fq.brandFeeling.label"), question: t("fq.brandFeeling.question"), rows: 2 },
    { field: "brandProblem",           label: t("fq.brandProblem.label"),             question: t("fq.brandProblem.question"), rows: 2 },
    { field: "providerRole",           label: t("fq.providerRole.label"),             question: t("fq.providerRole.question"), rows: 2 },
    { field: "providerBeliefs",        label: t("fq.providerBeliefs.label"),     question: t("fq.providerBeliefs.question"), rows: 2 },
    { field: "providerStrengths",      label: t("fq.providerStrengths.label"),           question: t("fq.providerStrengths.question"), rows: 2 },
    { field: "brandingStatement",      label: t("fq.brandingStatement.label"),      question: t("fq.brandingStatement.question"), rows: 2 },
    { field: "humanDifferentiation",   label: t("fq.humanDifferentiation.label"),         question: t("fq.humanDifferentiation.question"), rows: 2 },
  ];
}

export default function ClientInformationPage() {
  return (
    <Suspense>
      <ClientInformationContent />
    </Suspense>
  );
}

function ClientInformationContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [client, setClient] = useState<Config | null>(null);
  const [igProfile, setIgProfile] = useState<InstagramProfile | null>(null);
  const [igLoading, setIgLoading] = useState(false);
  const setupMode = useRef(false);
  const { t, lang } = useI18n();

  const FOLLOWUP_QUESTIONS = getFollowupQuestions(t);

  const { enrichGen, startEnrich, clearEnrichGen } = useGeneration();
  const enrichState = enrichGen.get(id);
  const enriching = enrichState?.status === "running";
  const enrichError = enrichState?.status === "error" ? (enrichState.error ?? "Auto-fill failed") : null;

  // Follow-up dialog
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupIndex, setFollowupIndex] = useState(0);
  const [followupAnswer, setFollowupAnswer] = useState("");
  const [followupSaving, setFollowupSaving] = useState(false);
  const [missingFields, setMissingFields] = useState<typeof FOLLOWUP_QUESTIONS>([]);
  const [addInfoOpen, setAddInfoOpen] = useState(false);
  const [addInfoText, setAddInfoText] = useState("");
  const [addInfoLoading, setAddInfoLoading] = useState(false);
  const [addInfoResult, setAddInfoResult] = useState<string | null>(null);

  // Voice onboarding resume dialog
  const [voiceOnboardingOpen, setVoiceOnboardingOpen] = useState(false);
  const voiceOnboarding: VoiceOnboarding | null = client?.voiceOnboarding
    ? safeJsonParse<VoiceOnboarding | null>(client.voiceOnboarding, null)
    : null;
  const completedBlockIds: VoiceBlockId[] = voiceOnboarding?.blocks
    ? voiceOnboarding.blocks.filter((b) => b.status === "done").map((b) => b.id)
    : [];
  const voiceDoneCount = completedBlockIds.length;
  const voiceTotal = VOICE_BLOCK_ORDER.length;
  const voiceIncomplete = voiceDoneCount < voiceTotal;

  // Edit dialog state
  const [basicOpen, setBasicOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Forms
  const [basicForm, setBasicForm] = useState({
    configName: "", name: "", company: "", role: "", location: "",
    businessContext: "", professionalBackground: "", keyAchievements: "",
    coreOffer: "", mainGoal: "",
    website: "", instagram: "", tiktok: "", youtube: "", linkedin: "", twitter: "",
  });
  const [brandForm, setBrandForm] = useState({
    brandFeeling: "",
    brandProblem: "",
    dreamCustomer: { tonality: "", age: "", gender: "", income: "", country: "", profession: "", values: "", description: "" },
  });
  const [customerForm, setCustomerForm] = useState({
    customerProblems: { mental: "", physical: "", financial: "", social: "", aesthetic: "" },
    providerRole: "",
    providerBeliefs: "",
    providerStrengths: "",
    authenticityZone: "",
  });
  const [messageForm, setMessageForm] = useState({
    brandingStatement: "",
    humanDifferentiation: "",
  });

  const { loadClient: loadClientCached, invalidateClient } = useClientData();

  const loadClient = () => loadClientCached(id, true);

  useEffect(() => {
    const isSetup = searchParams.get("setup") === "1";
    const wantsFollowup = searchParams.get("followup") === "1";
    loadClientCached(id).then((c) => {
      setClient(c);
      if (c.instagram) loadIgProfile();
      if (isSetup && (c.instagram || c.website || c.linkedin || c.tiktok)) {
        setupMode.current = true;
        startEnrich(id);
        router.replace(`/clients/${id}/information`);
      } else if (wantsFollowup) {
        const fqs = getFollowupQuestions(t);
        const missing = fqs.filter((q) => {
          const v = c[q.field];
          return !v || (typeof v === "string" && !v.trim());
        });
        if (missing.length > 0) {
          setMissingFields(missing);
          setFollowupIndex(0);
          setFollowupOpen(true);
        }
        router.replace(`/clients/${id}/information`);
      }
    });
  }, [id]);

  // Reload and handle follow-up when background enrich completes
  useEffect(() => {
    if (enrichState?.status === "done") {
      loadClient().then((enriched) => {
        setClient(enriched);
        if (setupMode.current) {
          setupMode.current = false;
          const fqs = getFollowupQuestions(t);
          const missing = fqs.filter((q) => !enriched[q.field]);
          if (missing.length > 0) {
            setMissingFields(missing);
            setFollowupIndex(0);
            setFollowupOpen(true);
          }
        }
        clearEnrichGen(id);
      });
    }
  }, [enrichState?.status]);

  const [igError, setIgError] = useState<string | null>(null);

  const loadIgProfile = (refresh = false) => {
    setIgLoading(true);
    setIgError(null);
    fetch(`/api/configs/${id}/instagram-profile`, { method: refresh ? "POST" : "GET" })
      .then(async (r) => {
        if (r.ok) return r.json();
        const err = await r.json().catch(() => ({}));
        if (refresh || r.status !== 404) setIgError(err.error || "Profil nicht gefunden");
        return null;
      })
      .then((data) => { if (data) setIgProfile(data); })
      .catch(() => { if (refresh) setIgError("Verbindungsfehler"); })
      .finally(() => setIgLoading(false));
  };

  const handleAutoFill = () => startEnrich(id);

  const handleAddInfo = async () => {
    if (!addInfoText.trim()) return;
    setAddInfoLoading(true);
    setAddInfoResult(null);
    try {
      const res = await fetch(`/api/configs/${id}/add-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: addInfoText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const count = Object.keys(data.updated || {}).length;
      setAddInfoResult(data.message || `Updated ${count} field${count !== 1 ? "s" : ""}.`);
      setAddInfoText("");
      await loadClient().then(setClient);
    } catch (e) {
      setAddInfoResult(e instanceof Error ? e.message : "Failed to add information.");
    } finally {
      setAddInfoLoading(false);
    }
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  const savePartial = async (partial: Partial<Config>) => {
    if (!client) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: client.id, ...partial }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Save failed (${res.status})`);
      }
      await loadClient().then(setClient);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const openBasic = () => {
    if (!client) return;
    setBasicForm({
      configName: client.configName || "",
      name: client.name || "", company: client.company || "",
      role: client.role || "", location: client.location || "",
      businessContext: client.businessContext || "",
      professionalBackground: client.professionalBackground || "",
      keyAchievements: client.keyAchievements || "",
      coreOffer: client.coreOffer || "",
      mainGoal: client.mainGoal || "",
      website: client.website || "", instagram: client.instagram || "",
      tiktok: client.tiktok || "", youtube: client.youtube || "",
      linkedin: client.linkedin || "", twitter: client.twitter || "",
    });
    setSaveError(null);
    setBasicOpen(true);
  };

  const openBrand = () => {
    if (!client) return;
    setBrandForm({
      brandFeeling: client.brandFeeling || "",
      brandProblem: client.brandProblem || "",
      dreamCustomer: parseDreamCustomer(client.dreamCustomer || ""),
    });
    setBrandOpen(true);
  };

  const openCustomer = () => {
    if (!client) return;
    setCustomerForm({
      customerProblems: parseCustomerProblems(client.customerProblems || ""),
      providerRole: client.providerRole || "",
      providerBeliefs: client.providerBeliefs || "",
      providerStrengths: client.providerStrengths || "",
      authenticityZone: client.authenticityZone || "",
    });
    setCustomerOpen(true);
  };

  const openMessage = () => {
    if (!client) return;
    setMessageForm({
      brandingStatement: client.brandingStatement || "",
      humanDifferentiation: client.humanDifferentiation || "",
    });
    setMessageOpen(true);
  };

  if (!client) {
    return <div className="flex items-center justify-center h-64 text-ocean/70 text-sm">{t("info.loading")}</div>;
  }

  const hasSocials = client.instagram || client.tiktok || client.youtube || client.linkedin || client.twitter || client.website;
  const dc = parseDreamCustomer(client.dreamCustomer || "");
  const cp = parseCustomerProblems(client.customerProblems || "");

  const dcRows = [
    { label: "Tonality", value: dc.tonality },
    { label: "Age", value: dc.age },
    { label: "Gender", value: dc.gender },
    { label: "Income", value: dc.income },
    { label: "Country", value: dc.country },
    { label: "Profession", value: dc.profession },
    { label: "Values", value: dc.values },
  ].filter((r) => r.value);

  const cpRows = [
    { label: "Mental", value: cp.mental },
    { label: "Physical", value: cp.physical },
    { label: "Financial", value: cp.financial },
    { label: "Social", value: cp.social },
    { label: "Aesthetic", value: cp.aesthetic },
  ].filter((r) => r.value);

  const basicEmpty = !client.name && !client.company && !client.role && !client.businessContext;
  const brandEmpty = !client.brandFeeling && !client.brandProblem && !client.dreamCustomer;
  const customerEmpty = !client.customerProblems && !client.providerRole && !client.providerBeliefs && !client.providerStrengths && !client.authenticityZone;
  const messageEmpty = !client.brandingStatement && !client.humanDifferentiation;

  const dateLocale = lang === "de" ? "de-DE" : "en-US";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blush/20 border border-blush/40">
            <User className="h-6 w-6 text-blush-dark" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.name || client.configName}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {client.role && <span className="text-sm text-ocean/70">{client.role}</span>}
              {client.role && client.company && <span className="text-ocean/65">·</span>}
              {client.company && <span className="text-sm text-ocean/70">{client.company}</span>}
              {client.location && (
                <>
                  <span className="text-ocean/65">·</span>
                  <span className="inline-flex items-center gap-1 text-sm text-ocean/70">
                    <MapPin className="h-3 w-3" />{client.location}
                  </span>
                </>
              )}
            </div>
            <div className="mt-2">
              <Badge variant="secondary" className="rounded-md text-[10px] bg-ocean/[0.02] border border-ocean/[0.06]">
                {client.creatorsCategory}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setAddInfoOpen(true); setAddInfoResult(null); }}
            className="h-8 gap-1.5 rounded-lg px-3 text-xs text-ocean/70 hover:text-ocean"
          >
            <Plus className="h-3 w-3" /> {t("info.addInfo")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAutoFill}
            disabled={enriching || (!client.instagram && !client.website && !client.linkedin && !client.tiktok && !client.youtube)}
            className="h-8 gap-1.5 rounded-lg px-3 text-xs text-blush-dark hover:text-blush-dark hover:bg-blush/20 disabled:opacity-40"
          >
            {enriching ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> {t("info.filling")}</>
            ) : (
              <><Sparkles className="h-3 w-3" /> {t("info.autoFill")}</>
            )}
          </Button>
        </div>
      </div>

      {enrichError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-500">
          {enrichError}
        </div>
      )}
      {enriching && (
        <div className="rounded-xl glass border border-blush/40 px-4 py-3 text-sm text-ocean/70">
          Scraping profiles and extracting information with AI… this takes 15–30 seconds.
        </div>
      )}

      {/* Social Links */}
      {hasSocials && (
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-ocean/70 uppercase tracking-wider">{t("info.links")}</h2>
          <div className="flex flex-wrap gap-2">
            <SocialLink href={client.website} icon={Globe} label={client.website} />
            <SocialLink href={client.instagram} icon={Instagram} label={`@${client.instagram.replace(/^@/, "")}`} />
            <SocialLink href={client.tiktok} icon={TikTokIcon} label={`@${client.tiktok.replace(/^@/, "")}`} />
            <SocialLink href={client.youtube} icon={Youtube} label={client.youtube} />
            <SocialLink href={client.linkedin} icon={Linkedin} label={client.linkedin} />
            <SocialLink href={client.twitter} icon={Twitter} label={`@${client.twitter.replace(/^@/, "")}`} />
          </div>
        </div>
      )}

      {/* Instagram Profile Card */}
      {client.instagram && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Instagram className="h-4 w-4 text-blush-dark" /> {t("info.igProfile")}
            </h2>
            <div className="flex items-center gap-3">
              {igProfile?.lastUpdated && (
                <span className="text-[10px] text-ocean/70">
                  {new Date(igProfile.lastUpdated).toLocaleDateString(dateLocale)}
                </span>
              )}
              <button
                onClick={() => loadIgProfile(true)}
                disabled={igLoading}
                className="flex items-center gap-1 text-[11px] text-ocean/70 hover:text-ocean transition-colors"
              >
                {igLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {igLoading ? t("info.refreshing") : t("info.refresh")}
              </button>
            </div>
          </div>

          {igLoading && !igProfile && (
            <div className="flex items-center gap-2 text-sm text-ocean/70 py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("info.profileLoading")}
            </div>
          )}

          {igError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-500">
              {igError}
            </div>
          )}

          {igProfile && (
            <div className="flex items-start gap-4">
              <a href={`https://www.instagram.com/${igProfile.username}/`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 hover:opacity-80 transition-opacity shrink-0">
                <div className="relative h-14 w-14 rounded-full overflow-hidden bg-blush/20 border border-ocean/5">
                  {igProfile.profilePicUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/proxy-image?url=${encodeURIComponent(igProfile.profilePicUrl)}`}
                      alt={`@${igProfile.username}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-bold text-ocean/70">
                      {igProfile.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </a>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold">@{igProfile.username}</p>
                  {igProfile.verified && <CheckCircle2 className="h-3.5 w-3.5 text-ocean/60 shrink-0" />}
                </div>
                {igProfile.fullName && <p className="text-xs text-ocean/70 mb-1">{igProfile.fullName}</p>}
                {igProfile.category && (
                  <span className="inline-block text-[10px] rounded-md bg-ocean/[0.02] border border-ocean/[0.06] px-2 py-0.5 text-ocean/70 mb-2">
                    {igProfile.category}
                  </span>
                )}
                {igProfile.bio && (
                  <p className="text-xs text-ocean/65 leading-relaxed line-clamp-3 mb-3">{igProfile.bio}</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 p-2.5 text-center">
                    <UserCheck className="mx-auto h-3.5 w-3.5 text-ocean/60 mb-1" />
                    <p className="text-sm font-bold">{fmt(igProfile.followers)}</p>
                    <p className="text-[9px] text-ocean/70 uppercase tracking-wider">{t("info.follower")}</p>
                  </div>
                  <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 p-2.5 text-center">
                    <Users className="mx-auto h-3.5 w-3.5 text-blush-dark mb-1" />
                    <p className="text-sm font-bold">{fmt(igProfile.following)}</p>
                    <p className="text-[9px] text-ocean/70 uppercase tracking-wider">{t("info.following")}</p>
                  </div>
                  <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 p-2.5 text-center">
                    <Film className="mx-auto h-3.5 w-3.5 text-emerald-400 mb-1" />
                    <p className="text-sm font-bold">{igProfile.postsCount}</p>
                    <p className="text-[9px] text-ocean/70 uppercase tracking-wider">{t("info.posts")}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Voice Profile Onboarding Card — only when incomplete */}
      {voiceIncomplete && (
        <div className="rounded-2xl border border-blush/30 bg-gradient-to-br from-blush-light/40 to-white p-5 flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blush/20">
            <Mic className="h-5 w-5 text-blush-dark" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ocean mb-0.5">
              {lang === "en" ? "Voice profile" : "Stimmprofil"}
              <span className="ml-2 text-xs text-ocean/50">{voiceDoneCount}/{voiceTotal}</span>
            </p>
            <p className="text-xs text-ocean/55 leading-relaxed">
              {lang === "en"
                ? "Complete the voice interview to deepen your voice DNA. Feeds directly into script generation."
                : "Schließe das Voice-Interview ab um deine Stimm-DNA zu vertiefen. Fließt direkt in die Skript-Generierung."}
            </p>
            <div className="mt-2 flex gap-1">
              {VOICE_BLOCK_ORDER.map((bid) => (
                <div
                  key={bid}
                  className={`h-1 flex-1 rounded-full ${completedBlockIds.includes(bid) ? "bg-ocean" : "bg-ocean/15"}`}
                />
              ))}
            </div>
          </div>
          <Button
            onClick={() => setVoiceOnboardingOpen(true)}
            size="sm"
            className="shrink-0 gap-2 bg-ocean text-white hover:bg-ocean-light"
          >
            {voiceDoneCount === 0
              ? (lang === "en" ? "Start" : "Starten")
              : (lang === "en" ? "Continue" : "Fortsetzen")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Basic Info */}
      <SectionCard icon={Briefcase} iconColor="text-blush-dark" title={t("info.basicInfo")} onEdit={openBasic} empty={basicEmpty} editLabel={t("common.edit")} noInfoLabel={t("info.noInfoYet")} addInfoLabel={t("info.addInformation")}>
        <div className="space-y-5">
          {(client.name || client.company || client.role || client.location) && (
            <div className="grid gap-5 md:grid-cols-2">
              <InfoRow label={t("label.name")} value={client.name} />
              <InfoRow label={t("label.company")} value={client.company} />
              <InfoRow label={t("label.role")} value={client.role} />
              <InfoRow label={t("label.location")} value={client.location} />
            </div>
          )}
          {(client.businessContext || client.professionalBackground || client.keyAchievements) && (
            <div className="border-t border-ocean/[0.06] pt-5 space-y-5">
              <InfoRow label={t("label.businessContext")} value={client.businessContext} />
              <InfoRow label={t("label.professionalBackground")} value={client.professionalBackground} />
              <InfoRow label={t("label.keyAchievements")} value={client.keyAchievements} />
            </div>
          )}
          {(client.coreOffer || client.mainGoal) && (
            <div className="border-t border-ocean/[0.06] pt-5 space-y-5">
              <InfoRow label="Core Offer" value={client.coreOffer || ""} />
              <InfoRow label="Konkretes Ziel" value={client.mainGoal || ""} />
            </div>
          )}
        </div>
      </SectionCard>

      {/* Brand Identity */}
      <SectionCard icon={Heart} iconColor="text-blush-dark" title={t("info.brandIdentity")} onEdit={openBrand} empty={brandEmpty} editLabel={t("common.edit")} noInfoLabel={t("info.noInfoYet")} addInfoLabel={t("info.addInformation")}>
        <div className="space-y-5">
          <InfoRow label={t("label.feelingYouSell")} value={client.brandFeeling} />
          <InfoRow label={t("label.coreProblem")} value={client.brandProblem} />
          {dcRows.length > 0 && (
            <div className="border-t border-ocean/[0.06] pt-5">
              <p className="text-[11px] text-ocean/70 uppercase tracking-wider mb-3">{t("label.dreamCustomerProfile")}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {dcRows.map((r) => (
                  <InfoRow key={r.label} label={r.label} value={r.value} />
                ))}
              </div>
              {dc.description && (
                <div className="mt-4">
                  <InfoRow label={t("label.description")} value={dc.description} />
                </div>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Customer & Problem */}
      <SectionCard icon={Users} iconColor="text-ocean/60" title={t("info.customerProblem")} onEdit={openCustomer} empty={customerEmpty} editLabel={t("common.edit")} noInfoLabel={t("info.noInfoYet")} addInfoLabel={t("info.addInformation")}>
        <div className="space-y-5">
          {cpRows.length > 0 && (
            <div>
              <p className="text-[11px] text-ocean/70 uppercase tracking-wider mb-3">{t("label.customerProblems")}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {cpRows.map((r) => (
                  <InfoRow key={r.label} label={r.label} value={r.value} />
                ))}
              </div>
            </div>
          )}
          {(client.providerRole || client.providerBeliefs || client.providerStrengths || client.authenticityZone) && (
            <div className="border-t border-ocean/[0.06] pt-5 space-y-5">
              <InfoRow label={t("label.providerRole")} value={client.providerRole} />
              <InfoRow label={t("label.beliefs")} value={client.providerBeliefs} />
              <InfoRow label={t("label.strengths")} value={client.providerStrengths} />
              <InfoRow label={t("label.authenticityZone")} value={client.authenticityZone} />
            </div>
          )}
        </div>
      </SectionCard>

      {/* Brand Message */}
      <SectionCard icon={MessageSquare} iconColor="text-ivory" title={t("info.brandMessage")} onEdit={openMessage} empty={messageEmpty} editLabel={t("common.edit")} noInfoLabel={t("info.noInfoYet")} addInfoLabel={t("info.addInformation")}>
        <div className="space-y-5">
          {client.brandingStatement && (
            <div>
              <p className="text-[11px] text-ocean/70 uppercase tracking-wider mb-2">{t("label.brandingStatement")}</p>
              <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 px-4 py-3">
                <p className="text-sm leading-relaxed italic">{client.brandingStatement}</p>
              </div>
            </div>
          )}
          <InfoRow label={t("label.humanDifferentiation")} value={client.humanDifferentiation} />
        </div>
      </SectionCard>

      {/* Kundenzugang */}
      <ClientAccessSection clientId={id} />

      {/* -- VOICE ONBOARDING DIALOG -- */}
      <Dialog open={voiceOnboardingOpen} onOpenChange={setVoiceOnboardingOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] glass-strong border-ocean/5 overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {lang === "en" ? "Voice profile interview" : "Stimmprofil-Interview"}
              <span className="ml-3 text-xs font-normal text-ocean/50">{voiceDoneCount}/{voiceTotal}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {voiceOnboardingOpen && (
              <VoiceAgent
                clientIdOverride={id}
                lang={lang === "en" ? "en" : "de"}
                mode="onboarding"
                initialCompletedBlocks={completedBlockIds}
                onSessionEnd={() => {
                  setVoiceOnboardingOpen(false);
                  // Invalidate the cached Config and reload — router.refresh()
                  // alone doesn't touch the client-data-context cache.
                  invalidateClient(id);
                  loadClient().then(setClient);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* -- FOLLOW-UP DIALOG -- */}
      {followupOpen && missingFields.length > 0 && (() => {
        const current = missingFields[followupIndex];
        const isLast = followupIndex >= missingFields.length - 1;
        const progress = followupIndex + 1;
        const total = missingFields.length;

        const saveAndNext = async () => {
          if (followupAnswer.trim()) {
            setFollowupSaving(true);
            await fetch(`/api/configs/${id}/add-info`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: `${current.label}: ${followupAnswer.trim()}` }),
            });
            await loadClient().then(setClient);
            setFollowupSaving(false);
          }
          setFollowupAnswer("");
          if (isLast) {
            setFollowupOpen(false);
          } else {
            setFollowupIndex((i) => i + 1);
          }
        };

        return (
          <Dialog open={followupOpen} onOpenChange={(v) => { if (!v) setFollowupOpen(false); }}>
            <DialogContent className="sm:max-w-md glass-strong border-ocean/5">
              <div className="flex items-center justify-between mb-1">
                <DialogTitle className="text-base font-semibold">{t("followup.title")}</DialogTitle>
                <span className="text-[11px] text-ocean/70">{progress} / {total}</span>
              </div>
              <div className="w-full h-1 bg-ocean/[0.06] rounded-full mb-4">
                <div className="h-full bg-ocean rounded-full transition-all" style={{ width: `${(progress / total) * 100}%` }} />
              </div>
              <p className="text-xs text-ocean/70 mb-1 uppercase tracking-wider">{current.label}</p>
              <p className="text-sm font-medium mb-3">{current.question}</p>
              <Textarea
                autoFocus
                value={followupAnswer}
                onChange={(e) => setFollowupAnswer(e.target.value)}
                rows={current.rows ?? 2}
                placeholder={t("followup.answer")}
                className="rounded-xl glass border-ocean/5 text-sm mb-4"
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => { setFollowupAnswer(""); if (isLast) setFollowupOpen(false); else setFollowupIndex((i) => i + 1); }}
                  className="flex-1 rounded-xl h-10 text-sm text-ocean/70"
                >
                  {t("followup.skip")}
                </Button>
                <Button
                  onClick={saveAndNext}
                  disabled={followupSaving}
                  className="flex-1 rounded-xl h-10 bg-ocean hover:bg-ocean-light border-0 text-sm text-white"
                >
                  {followupSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : isLast ? t("followup.done") : t("followup.next")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Add Info Dialog */}
      <Dialog open={addInfoOpen} onOpenChange={(v) => { if (!v) setAddInfoOpen(false); }}>
        <DialogContent className="max-w-lg glass-strong rounded-2xl border-ocean/5">
          <DialogHeader><DialogTitle>{t("addInfo.title")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-ocean/70">
              {t("addInfo.description")}
            </p>
            <Textarea
              value={addInfoText}
              onChange={(e) => setAddInfoText(e.target.value)}
              rows={6}
              placeholder={t("addInfo.placeholder")}
              className="rounded-xl glass border-ocean/5 text-sm"
            />
            {addInfoResult && (
              <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${addInfoResult.includes("already") ? "bg-ocean/[0.02] text-ocean/70" : "bg-green-50 border border-green-200 text-green-600"}`}>
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{addInfoResult}</span>
              </div>
            )}
            <Button
              onClick={handleAddInfo}
              disabled={addInfoLoading || !addInfoText.trim()}
              className="w-full rounded-xl h-11 bg-ocean hover:bg-ocean-light border-0 text-white"
            >
              {addInfoLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t("addInfo.processing")}</> : t("addInfo.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* -- EDIT DIALOGS -- */}

      {/* Basic Info Dialog */}
      <Dialog open={basicOpen} onOpenChange={(v) => { if (!v) setBasicOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-strong rounded-2xl border-ocean/5">
          <DialogHeader><DialogTitle>{t("editBasic.title")}</DialogTitle></DialogHeader>
          <div className="space-y-5 pt-2">
            {saveError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-500">{saveError}</div>
            )}
            <div>
              <Label className="text-xs text-ocean/70">{t("editBasic.displayName") || "Anzeigename"}</Label>
              <Input value={basicForm.configName} onChange={(e) => setBasicForm({ ...basicForm, configName: e.target.value })} className="mt-1.5 rounded-xl glass border-ocean/5 h-11" placeholder="Name in der Sidebar" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(["name", "company", "role", "location"] as const).map((key) => (
                <div key={key}>
                  <Label className="text-xs text-ocean/70 capitalize">{key === "name" ? t("editBasic.fullName") : key === "company" ? t("editBasic.company") : key === "role" ? t("editBasic.role") : t("editBasic.location")}</Label>
                  <Input value={basicForm[key]} onChange={(e) => setBasicForm({ ...basicForm, [key]: e.target.value })} className="mt-1.5 rounded-xl glass border-ocean/5 h-11" />
                </div>
              ))}
            </div>
            {(["businessContext", "professionalBackground", "keyAchievements"] as const).map((key) => (
              <div key={key}>
                <Label className="text-xs text-ocean/70">{key === "businessContext" ? t("editBasic.businessContext") : key === "professionalBackground" ? t("editBasic.professionalBackground") : t("editBasic.keyAchievements")}</Label>
                <Textarea value={basicForm[key]} onChange={(e) => setBasicForm({ ...basicForm, [key]: e.target.value })} rows={3} className="mt-1.5 rounded-xl glass border-ocean/5 text-sm" />
              </div>
            ))}
            <div className="border-t border-ocean/[0.06] pt-4 space-y-4">
              <p className="text-xs font-medium text-ocean/70">Angebot & Ziel</p>
              <div>
                <Label className="text-xs text-ocean/70">Core Offer — Was wird verkauft?</Label>
                <Textarea
                  value={basicForm.coreOffer}
                  onChange={(e) => setBasicForm({ ...basicForm, coreOffer: e.target.value })}
                  rows={2}
                  placeholder="z.B. 12-Wochen Coaching-Programm, 3.000€, Ergebnis: Traumfigur ohne Jojo-Effekt"
                  className="mt-1.5 rounded-xl glass border-ocean/5 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-ocean/70">Konkretes Ziel</Label>
                <Input
                  value={basicForm.mainGoal}
                  onChange={(e) => setBasicForm({ ...basicForm, mainGoal: e.target.value })}
                  placeholder="z.B. 5 Sales Calls/Woche, Launch in 6 Wochen"
                  className="mt-1.5 rounded-xl glass border-ocean/5 h-11"
                />
              </div>
            </div>
            <div className="border-t border-ocean/[0.06] pt-4 grid grid-cols-2 gap-3">
              {(["website", "instagram", "tiktok", "youtube", "linkedin", "twitter"] as const).map((key) => (
                <div key={key}>
                  <Label className="text-xs text-ocean/70 capitalize">{key === "twitter" ? "X / Twitter" : key.charAt(0).toUpperCase() + key.slice(1)}</Label>
                  <Input value={basicForm[key]} onChange={(e) => setBasicForm({ ...basicForm, [key]: e.target.value })} className="mt-1.5 rounded-xl glass border-ocean/5 h-11" />
                </div>
              ))}
            </div>
            <Button onClick={async () => { await savePartial(basicForm); setBasicOpen(false); }} disabled={saving}
              className="w-full rounded-xl h-11 bg-ocean hover:bg-ocean-light border-0 text-white">
              {saving ? t("info.saving") : t("info.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Brand Identity Dialog */}
      <Dialog open={brandOpen} onOpenChange={(v) => { if (!v) setBrandOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-strong rounded-2xl border-ocean/5">
          <DialogHeader><DialogTitle>{t("editBrand.title")}</DialogTitle></DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <Label className="text-xs text-ocean/70">{t("editBrand.feeling")}</Label>
              <Textarea value={brandForm.brandFeeling} onChange={(e) => setBrandForm({ ...brandForm, brandFeeling: e.target.value })} rows={2} className="mt-1.5 rounded-xl glass border-ocean/5 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-ocean/70">{t("editBrand.problem")}</Label>
              <Textarea value={brandForm.brandProblem} onChange={(e) => setBrandForm({ ...brandForm, brandProblem: e.target.value })} rows={2} className="mt-1.5 rounded-xl glass border-ocean/5 text-sm" />
            </div>
            <div className="border-t border-ocean/[0.06] pt-4">
              <p className="text-xs font-medium text-ocean/70 mb-3">{t("editBrand.dreamCustomer")}</p>
              <div className="grid grid-cols-2 gap-3">
                {(["tonality", "age", "gender", "income", "country", "profession", "values"] as const).map((key) => (
                  <div key={key}>
                    <Label className="text-xs text-ocean/70 capitalize">{key}</Label>
                    <Input value={brandForm.dreamCustomer[key]} onChange={(e) => setBrandForm({ ...brandForm, dreamCustomer: { ...brandForm.dreamCustomer, [key]: e.target.value } })} className="mt-1.5 rounded-xl glass border-ocean/5 h-11" />
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Label className="text-xs text-ocean/70">{t("editBrand.description")}</Label>
                <Textarea value={brandForm.dreamCustomer.description} onChange={(e) => setBrandForm({ ...brandForm, dreamCustomer: { ...brandForm.dreamCustomer, description: e.target.value } })} rows={3} className="mt-1.5 rounded-xl glass border-ocean/5 text-sm" />
              </div>
            </div>
            <Button onClick={async () => {
              await savePartial({
                brandFeeling: brandForm.brandFeeling,
                brandProblem: brandForm.brandProblem,
                dreamCustomer: JSON.stringify(brandForm.dreamCustomer),
              });
              setBrandOpen(false);
            }} disabled={saving}
              className="w-full rounded-xl h-11 bg-ocean hover:bg-ocean-light border-0 text-white">
              {saving ? t("info.saving") : t("info.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer & Problem Dialog */}
      <Dialog open={customerOpen} onOpenChange={(v) => { if (!v) setCustomerOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-strong rounded-2xl border-ocean/5">
          <DialogHeader><DialogTitle>{t("editCustomer.title")}</DialogTitle></DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <p className="text-xs font-medium text-ocean/70 mb-3">{t("editCustomer.problems")}</p>
              <div className="space-y-3">
                {(["mental", "physical", "financial", "social", "aesthetic"] as const).map((key) => (
                  <div key={key}>
                    <Label className="text-xs text-ocean/70 capitalize">{key === "mental" ? t("editCustomer.mental") : key === "physical" ? t("editCustomer.physical") : key === "financial" ? t("editCustomer.financial") : key === "social" ? t("editCustomer.social") : t("editCustomer.aesthetic")}</Label>
                    <Textarea value={customerForm.customerProblems[key]} onChange={(e) => setCustomerForm({ ...customerForm, customerProblems: { ...customerForm.customerProblems, [key]: e.target.value } })} rows={2} className="mt-1.5 rounded-xl glass border-ocean/5 text-sm" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-ocean/[0.06] pt-4 space-y-4">
              <div>
                <Label className="text-xs text-ocean/70">{t("editCustomer.providerRole")}</Label>
                <Textarea value={customerForm.providerRole} onChange={(e) => setCustomerForm({ ...customerForm, providerRole: e.target.value })} rows={2} className="mt-1.5 rounded-xl glass border-ocean/5 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-ocean/70">{t("editCustomer.beliefs")}</Label>
                <Textarea value={customerForm.providerBeliefs} onChange={(e) => setCustomerForm({ ...customerForm, providerBeliefs: e.target.value })} rows={2} className="mt-1.5 rounded-xl glass border-ocean/5 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-ocean/70">{t("editCustomer.strengths")}</Label>
                <Textarea value={customerForm.providerStrengths} onChange={(e) => setCustomerForm({ ...customerForm, providerStrengths: e.target.value })} rows={2} className="mt-1.5 rounded-xl glass border-ocean/5 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-ocean/70">{t("editCustomer.authenticity")}</Label>
                <Textarea value={customerForm.authenticityZone} onChange={(e) => setCustomerForm({ ...customerForm, authenticityZone: e.target.value })} rows={2} className="mt-1.5 rounded-xl glass border-ocean/5 text-sm" />
              </div>
            </div>
            <Button onClick={async () => {
              await savePartial({
                customerProblems: JSON.stringify(customerForm.customerProblems),
                providerRole: customerForm.providerRole,
                providerBeliefs: customerForm.providerBeliefs,
                providerStrengths: customerForm.providerStrengths,
                authenticityZone: customerForm.authenticityZone,
              });
              setCustomerOpen(false);
            }} disabled={saving}
              className="w-full rounded-xl h-11 bg-ocean hover:bg-ocean-light border-0 text-white">
              {saving ? t("info.saving") : t("info.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Brand Message Dialog */}
      <Dialog open={messageOpen} onOpenChange={(v) => { if (!v) setMessageOpen(false); }}>
        <DialogContent className="max-w-2xl glass-strong rounded-2xl border-ocean/5">
          <DialogHeader><DialogTitle>{t("editMessage.title")}</DialogTitle></DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <Label className="text-xs text-ocean/70">{t("editMessage.statement")}</Label>
              <p className="text-[11px] text-ocean/60 mt-0.5 mb-1.5">{t("editMessage.statementHint")}</p>
              <Textarea value={messageForm.brandingStatement} onChange={(e) => setMessageForm({ ...messageForm, brandingStatement: e.target.value })} rows={3} className="mt-1.5 rounded-xl glass border-ocean/5 text-sm" placeholder={t("editMessage.statementPlaceholder")} />
            </div>
            <div>
              <Label className="text-xs text-ocean/70">{t("editMessage.human")}</Label>
              <p className="text-[11px] text-ocean/60 mt-0.5 mb-1.5">{t("editMessage.humanHint")}</p>
              <Textarea value={messageForm.humanDifferentiation} onChange={(e) => setMessageForm({ ...messageForm, humanDifferentiation: e.target.value })} rows={3} className="mt-1.5 rounded-xl glass border-ocean/5 text-sm" />
            </div>
            <Button onClick={async () => { await savePartial(messageForm); setMessageOpen(false); }} disabled={saving}
              className="w-full rounded-xl h-11 bg-ocean hover:bg-ocean-light border-0 text-white">
              {saving ? t("info.saving") : t("info.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
