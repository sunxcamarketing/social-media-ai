"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import type { Config } from "@/lib/types";
import { safeJsonParse } from "@/lib/safe-json";

type DialogTarget = "basic" | "brand" | "customer" | "message";

interface FieldDef {
  key: keyof Config;
  de: string;
  en: string;
  target: DialogTarget;
  /** Custom completion check. Defaults to "non-empty trimmed string". */
  isComplete?: (client: Config) => boolean;
}

// The fields we care about for content generation. Order = display order.
// Anything not on this list (Instagram URL, color palette, fonts, …) is
// considered nice-to-have and doesn't move the completeness needle.
const FIELDS: FieldDef[] = [
  // Basic info
  { key: "businessContext", de: "Business-Kontext", en: "Business context", target: "basic" },
  { key: "professionalBackground", de: "Beruflicher Hintergrund", en: "Professional background", target: "basic" },
  { key: "keyAchievements", de: "Erfolge & Meilensteine", en: "Achievements & milestones", target: "basic" },
  { key: "coreOffer", de: "Core Offer", en: "Core offer", target: "basic" },
  { key: "mainGoal", de: "Konkretes Ziel", en: "Concrete goal", target: "basic" },

  // Brand identity
  { key: "brandFeeling", de: "Markengefühl", en: "Brand feeling", target: "brand" },
  { key: "brandProblem", de: "Kernproblem der Zielgruppe", en: "Core problem of the audience", target: "brand" },
  {
    key: "dreamCustomer",
    de: "Traumkunde",
    en: "Dream customer",
    target: "brand",
    // dreamCustomer is JSON; complete if any sub-field has content.
    isComplete: (c) => {
      const dc = safeJsonParse<Record<string, string>>(c.dreamCustomer || "", {});
      return Object.values(dc).some((v) => typeof v === "string" && v.trim() !== "");
    },
  },

  // Customer / voice
  {
    key: "customerProblems",
    de: "Top-Probleme der Zielgruppe",
    en: "Top problems of the audience",
    target: "customer",
    isComplete: (c) => {
      const cp = safeJsonParse<Record<string, string>>(c.customerProblems || "", {});
      return Object.values(cp).some((v) => typeof v === "string" && v.trim() !== "");
    },
  },
  { key: "providerRole", de: "Rolle gegenüber der Zielgruppe", en: "Role toward audience", target: "customer" },
  { key: "providerBeliefs", de: "Kernüberzeugungen", en: "Core beliefs", target: "customer" },
  { key: "providerStrengths", de: "Kommunikationsstärken", en: "Communication strengths", target: "customer" },
  { key: "authenticityZone", de: "Authentizitätszone", en: "Authenticity zone", target: "customer" },

  // Brand message
  { key: "brandingStatement", de: "Positionierungssatz", en: "Positioning statement", target: "message" },
  { key: "humanDifferentiation", de: "Was macht dich einzigartig", en: "What makes you unique", target: "message" },
];

function isFieldComplete(field: FieldDef, client: Config): boolean {
  if (field.isComplete) return field.isComplete(client);
  const v = client[field.key];
  return typeof v === "string" && v.trim() !== "";
}

export interface ProfileCompletenessProps {
  client: Config;
  lang: "de" | "en";
  onOpen: Record<DialogTarget, () => void>;
}

export function ProfileCompleteness({ client, lang, onOpen }: ProfileCompletenessProps) {
  const total = FIELDS.length;
  const completed = FIELDS.filter((f) => isFieldComplete(f, client));
  const missing = FIELDS.filter((f) => !isFieldComplete(f, client));
  const percent = Math.round((completed.length / total) * 100);

  const allDone = missing.length === 0;
  const isHealthy = percent >= 80;
  const barColor = allDone
    ? "bg-green-500"
    : isHealthy
    ? "bg-ocean"
    : "bg-amber-500";

  const t = (de: string, en: string) => (lang === "en" ? en : de);

  return (
    <div className="rounded-2xl border border-ocean/[0.06] bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${allDone ? "bg-green-50" : "bg-blush-light/50"}`}>
            {allDone ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-blush-dark" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-ocean">
              {t("Profil-Status", "Profile status")}
            </h3>
            <p className="text-[11px] text-ocean/55">
              {allDone
                ? t("Alle wichtigen Felder ausgefüllt.", "All key fields filled.")
                : t(
                    `${completed.length} von ${total} Feldern · ${missing.length} offen`,
                    `${completed.length} of ${total} fields · ${missing.length} open`,
                  )}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums text-ocean">{percent}%</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-ocean/[0.06] overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Missing fields list */}
      {!allDone && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] uppercase tracking-wider text-ocean/45 font-medium">
            {t("Noch offen", "Still open")}
          </p>
          <ul className="space-y-1">
            {missing.map((f) => (
              <li
                key={f.key as string}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-ocean/[0.02] transition-colors"
              >
                <span className="text-sm text-ocean/75 truncate">{lang === "en" ? f.en : f.de}</span>
                <button
                  onClick={() => onOpen[f.target]()}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-ocean/[0.08] px-3 py-1 text-xs font-medium text-ocean/70 hover:text-ocean hover:bg-ocean/[0.03] hover:border-ocean/[0.16] transition-all"
                >
                  {t("Ergänzen", "Add")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
