"use client";

import { useEffect, useState } from "react";
import { BookOpen, Users, UserCheck, Film, Building2, MapPin, Briefcase, Target, Heart, Lightbulb, Globe, Instagram, Linkedin, Youtube, Music2 } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { PortalShell } from "@/components/portal-shell";
import { safeJsonParse } from "@/lib/safe-json";
import { fmt } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Config } from "@/lib/types";

interface DreamCustomer {
  tonality?: string; age?: string; gender?: string; income?: string;
  country?: string; profession?: string; values?: string; description?: string;
}

export default function PortalProfil() {
  const { t } = useI18n();
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [client, setClient] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveClientId) return;
    fetch(`/api/configs/${effectiveClientId}`)
      .then(r => r.json())
      .then(setClient)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [effectiveClientId]);

  const dreamCustomer = safeJsonParse<DreamCustomer>(client?.dreamCustomer, {});
  const customerProblems = safeJsonParse<string[]>(client?.customerProblems, []);
  const displayName = client?.name || client?.configName || "";
  const profileComplete = Boolean(
    client && (client.businessContext || client.brandingStatement || client.coreOffer),
  );

  return (
    <PortalShell
      icon={BookOpen}
      title={t("portal.dash.profile") || "Profil"}
      loading={authLoading || loading}
      isEmpty={!profileComplete}
      emptyMessage="Dein Profil wurde noch nicht vollständig angelegt."
    >
      {client && (
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-2xl bg-gradient-to-br from-ocean via-ocean to-ocean-light p-6 text-white relative overflow-hidden">
            <div className="relative flex items-start gap-4">
              {client.igProfilePicUrl && (
                <img src={client.igProfilePicUrl} alt="" className="h-16 w-16 rounded-full border-2 border-white/20 object-cover shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xl font-semibold break-words">{displayName}</p>
                {client.role && <p className="text-sm text-white/70 mt-0.5 break-words">{client.role}</p>}
                <div className="flex items-center gap-3 mt-3 text-xs text-white/60 flex-wrap">
                  {client.company && (
                    <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {client.company}</span>
                  )}
                  {client.location && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {client.location}</span>
                  )}
                </div>
              </div>
            </div>

            {/* IG stats */}
            {(client.igFollowers || client.igFollowing || client.igPostsCount) && (
              <div className="grid grid-cols-3 gap-3 mt-5">
                <Stat icon={UserCheck} label={t("info.follower")} value={fmt(parseInt(client.igFollowers || "0"))} />
                <Stat icon={Users} label={t("info.following")} value={fmt(parseInt(client.igFollowing || "0"))} />
                <Stat icon={Film} label={t("info.posts")} value={client.igPostsCount || "0"} />
              </div>
            )}
          </div>

          {/* Offer + Goal */}
          {(client.coreOffer || client.mainGoal) && (
            <Card>
              <SectionTitle icon={Target}>Angebot & Ziel</SectionTitle>
              {client.coreOffer && <Field label="Core Offer" value={client.coreOffer} />}
              {client.mainGoal && <Field label="Konkretes Ziel" value={client.mainGoal} />}
            </Card>
          )}

          {/* Business Context */}
          {(client.businessContext || client.professionalBackground || client.keyAchievements) && (
            <Card>
              <SectionTitle icon={Briefcase}>Business & Background</SectionTitle>
              {client.businessContext && <Field label="Business Context" value={client.businessContext} />}
              {client.professionalBackground && <Field label="Professional Background" value={client.professionalBackground} />}
              {client.keyAchievements && <Field label="Key Achievements" value={client.keyAchievements} />}
            </Card>
          )}

          {/* Brand Identity */}
          {(client.brandFeeling || client.brandProblem || client.brandingStatement || client.humanDifferentiation) && (
            <Card>
              <SectionTitle icon={Heart}>Markenidentität</SectionTitle>
              {client.brandFeeling && <Field label="Markengefühl" value={client.brandFeeling} />}
              {client.brandProblem && <Field label="Kernproblem" value={client.brandProblem} />}
              {client.brandingStatement && <Field label="Branding Statement" value={client.brandingStatement} />}
              {client.humanDifferentiation && <Field label="Human Differentiation" value={client.humanDifferentiation} />}
            </Card>
          )}

          {/* Dream Customer */}
          {dreamCustomer.description && (
            <Card>
              <SectionTitle icon={Users}>Wunschkunde</SectionTitle>
              <Field label="Beschreibung" value={dreamCustomer.description} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {dreamCustomer.age && <MetaField label="Alter" value={dreamCustomer.age} />}
                {dreamCustomer.gender && <MetaField label="Geschlecht" value={dreamCustomer.gender} />}
                {dreamCustomer.profession && <MetaField label="Beruf" value={dreamCustomer.profession} />}
                {dreamCustomer.income && <MetaField label="Einkommen" value={dreamCustomer.income} />}
                {dreamCustomer.country && <MetaField label="Land" value={dreamCustomer.country} />}
                {dreamCustomer.values && <MetaField label="Werte" value={dreamCustomer.values} />}
              </div>
            </Card>
          )}

          {/* Customer Problems */}
          {customerProblems.length > 0 && (
            <Card>
              <SectionTitle icon={Lightbulb}>Kundenprobleme</SectionTitle>
              <ul className="space-y-2 mt-2">
                {customerProblems.map((p, i) => (
                  <li key={i} className="text-sm text-ocean/80 leading-relaxed flex gap-2">
                    <span className="text-blush-dark shrink-0">·</span>
                    <span className="break-words">{p}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Provider / Authenticity */}
          {(client.providerRole || client.providerBeliefs || client.providerStrengths || client.authenticityZone) && (
            <Card>
              <SectionTitle icon={Target}>Deine Rolle & Authentizität</SectionTitle>
              {client.providerRole && <Field label="Deine Rolle" value={client.providerRole} />}
              {client.providerBeliefs && <Field label="Überzeugungen" value={client.providerBeliefs} />}
              {client.providerStrengths && <Field label="Stärken" value={client.providerStrengths} />}
              {client.authenticityZone && <Field label="Authentizitäts-Zone" value={client.authenticityZone} />}
            </Card>
          )}

          {/* Links */}
          {(client.website || client.instagram || client.tiktok || client.youtube || client.linkedin) && (
            <Card>
              <SectionTitle icon={Globe}>Links</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {client.website && <LinkRow icon={Globe} label="Website" href={client.website} />}
                {client.instagram && <LinkRow icon={Instagram} label="Instagram" href={client.instagram} />}
                {client.tiktok && <LinkRow icon={Music2} label="TikTok" href={client.tiktok} />}
                {client.youtube && <LinkRow icon={Youtube} label="YouTube" href={client.youtube} />}
                {client.linkedin && <LinkRow icon={Linkedin} label="LinkedIn" href={client.linkedin} />}
              </div>
            </Card>
          )}
        </div>
      )}
    </PortalShell>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="glass rounded-2xl p-4 sm:p-6 space-y-2">{children}</div>;
}

function SectionTitle({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-ocean flex items-center gap-2">
      <Icon className="h-4 w-4 text-blush-dark" /> {children}
    </h2>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <p className="text-[10px] uppercase tracking-wider text-ocean/45 mb-1 font-medium">{label}</p>
      <p className="text-sm text-ocean/80 leading-relaxed whitespace-pre-wrap break-words">{value}</p>
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ocean/45 mb-0.5 font-medium">{label}</p>
      <p className="text-sm text-ocean/80 break-words">{value}</p>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/[0.08] backdrop-blur-sm border border-white/[0.08] px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="h-3 w-3 text-white/50" />
        <span className="text-[9px] text-white/50 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function LinkRow({ icon: Icon, label, href }: { icon: React.ComponentType<{ className?: string }>; label: string; href: string }) {
  const fullHref = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a
      href={fullHref}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-xl border border-ocean/[0.06] bg-white/50 hover:bg-white hover:border-ocean/[0.15] px-3 py-2 text-sm text-ocean/80 hover:text-ocean transition-all"
    >
      <Icon className="h-3.5 w-3.5 text-ocean/50 shrink-0" />
      <span className="font-medium shrink-0">{label}</span>
      <span className="text-xs text-ocean/45 truncate flex-1 text-right">{href.replace(/^https?:\/\//, "")}</span>
    </a>
  );
}
