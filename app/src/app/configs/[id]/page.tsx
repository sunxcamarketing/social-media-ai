"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Globe,
  Instagram,
  Linkedin,
  Youtube,
  Twitter,
  MapPin,
  Briefcase,
  User,
  Sparkles,
} from "lucide-react";
import type { Config } from "@/lib/types";

function SocialLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  if (!href) return null;
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-white/[0.08] text-sm text-muted-foreground hover:text-foreground hover:border-white/[0.15] transition-all"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </a>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.2 8.2 0 0 0 4.79 1.52V6.75a4.85 4.85 0 0 1-1.02-.06z" />
    </svg>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm leading-relaxed">{value}</p>
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Config | null>(null);

  useEffect(() => {
    fetch(`/api/configs/${id}`)
      .then((r) => r.json())
      .then(setClient);
  }, [id]);

  if (!client) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const hasSocials = client.instagram || client.tiktok || client.youtube || client.linkedin || client.twitter || client.website;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/configs")}
          className="h-9 gap-1.5 rounded-xl text-muted-foreground hover:text-foreground px-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Clients
        </Button>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/20">
          <User className="h-6 w-6 text-purple-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{client.name || client.configName}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {client.role && <span className="text-sm text-muted-foreground">{client.role}</span>}
            {client.role && client.company && <span className="text-muted-foreground/40">·</span>}
            {client.company && <span className="text-sm text-muted-foreground">{client.company}</span>}
            {client.location && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {client.location}
                </span>
              </>
            )}
          </div>
          <div className="mt-2">
            <Badge variant="secondary" className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.06]">
              {client.creatorsCategory}
            </Badge>
          </div>
        </div>
      </div>

      {/* Social Links */}
      {hasSocials && (
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Links</h2>
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

      {/* Basic Info Card */}
      {(client.company || client.role || client.location || client.businessContext || client.professionalBackground || client.keyAchievements) && (
        <div className="glass rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-purple-400" />
            Basic Information
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <InfoRow label="Name" value={client.name} />
            <InfoRow label="Company" value={client.company} />
            <InfoRow label="Role" value={client.role} />
            <InfoRow label="Location" value={client.location} />
          </div>
          {(client.businessContext || client.professionalBackground || client.keyAchievements) && (
            <div className="border-t border-white/[0.06] pt-5 space-y-5">
              <InfoRow label="Business Context" value={client.businessContext} />
              <InfoRow label="Professional Background" value={client.professionalBackground} />
              <InfoRow label="Key Achievements" value={client.keyAchievements} />
            </div>
          )}
        </div>
      )}

      {/* AI Prompt Variables */}
      {(client.clientDescription || client.contentNiche || client.targetAudience || client.toneNotes) && (
        <div className="glass rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            Concept Generation
          </h2>
          <div className="space-y-4">
            <InfoRow label="Who is the client?" value={client.clientDescription} />
            <div className="grid gap-4 md:grid-cols-3">
              <InfoRow label="Content niche" value={client.contentNiche} />
              <InfoRow label="Target audience" value={client.targetAudience} />
              <InfoRow label="Tone & style" value={client.toneNotes} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
