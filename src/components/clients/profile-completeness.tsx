"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { Config } from "@/lib/types";
import { safeJsonParse } from "@/lib/safe-json";

type DialogTarget = "basic" | "brand" | "customer" | "message" | "billing";

interface FieldDef {
  key: keyof Config;
  de: string;
  en: string;
  target: DialogTarget;
  /** DOM id of the field inside the dialog — used to scroll/focus on open. */
  fieldId: string;
  /** Custom completion check. Defaults to "non-empty trimmed string". */
  isComplete?: (client: Config) => boolean;
}

// The fields we care about for content generation. Order = display order.
// Anything not on this list (Instagram URL, color palette, fonts, …) is
// considered nice-to-have and doesn't move the completeness needle.
const FIELDS: FieldDef[] = [
  // Basic info
  { key: "businessContext", de: "Business-Kontext", en: "Business context", target: "basic", fieldId: "field-businessContext" },
  { key: "professionalBackground", de: "Beruflicher Hintergrund", en: "Professional background", target: "basic", fieldId: "field-professionalBackground" },
  { key: "keyAchievements", de: "Erfolge & Meilensteine", en: "Achievements & milestones", target: "basic", fieldId: "field-keyAchievements" },
  { key: "coreOffer", de: "Core Offer", en: "Core offer", target: "basic", fieldId: "field-coreOffer" },
  { key: "mainGoal", de: "Konkretes Ziel", en: "Concrete goal", target: "basic", fieldId: "field-mainGoal" },

  // Brand identity
  { key: "brandFeeling", de: "Markengefühl", en: "Brand feeling", target: "brand", fieldId: "field-brandFeeling" },
  { key: "brandProblem", de: "Kernproblem der Zielgruppe", en: "Core problem of the audience", target: "brand", fieldId: "field-brandProblem" },
  {
    key: "dreamCustomer",
    de: "Traumkunde",
    en: "Dream customer",
    target: "brand",
    fieldId: "field-dreamCustomer",
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
    fieldId: "field-customerProblems",
    isComplete: (c) => {
      const cp = safeJsonParse<Record<string, string>>(c.customerProblems || "", {});
      return Object.values(cp).some((v) => typeof v === "string" && v.trim() !== "");
    },
  },
  { key: "providerRole", de: "Rolle gegenüber der Zielgruppe", en: "Role toward audience", target: "customer", fieldId: "field-providerRole" },
  { key: "providerBeliefs", de: "Kernüberzeugungen", en: "Core beliefs", target: "customer", fieldId: "field-providerBeliefs" },
  { key: "providerStrengths", de: "Kommunikationsstärken", en: "Communication strengths", target: "customer", fieldId: "field-providerStrengths" },
  { key: "authenticityZone", de: "Authentizitätszone", en: "Authenticity zone", target: "customer", fieldId: "field-authenticityZone" },

  // Brand message
  { key: "brandingStatement", de: "Positionierungssatz", en: "Positioning statement", target: "message", fieldId: "field-brandingStatement" },
  { key: "humanDifferentiation", de: "Was macht dich einzigartig", en: "What makes you unique", target: "message", fieldId: "field-humanDifferentiation" },

  // Billing — needed for invoicing. We treat the address block as one unit:
  // complete if the must-have fields (recipient, street, zip, city, country)
  // are all filled. VAT-ID + billing email stay optional, so they don't gate
  // the bar. This matches admin reality: an invoice without one of those five
  // fields is invalid; one without a VAT-ID is just non-reverse-charge.
  {
    key: "billingStreet",
    de: "Rechnungsadresse",
    en: "Billing address",
    target: "billing",
    fieldId: "field-billingName",
    isComplete: (c) => {
      const required = [c.billingName, c.billingStreet, c.billingZip, c.billingCity, c.billingCountry];
      return required.every((v) => typeof v === "string" && v.trim() !== "");
    },
  },
];

function isFieldComplete(field: FieldDef, client: Config): boolean {
  if (field.isComplete) return field.isComplete(client);
  const v = client[field.key];
  return typeof v === "string" && v.trim() !== "";
}

export interface CompletenessState {
  total: number;
  completed: number;
  missing: FieldDef[];
  percent: number;
  allDone: boolean;
}

/** Single source of truth — page header + card both call this. */
export function computeCompleteness(client: Config): CompletenessState {
  const fields = FIELDS.filter((f) => !(client.isOwner && f.target === "billing"));
  const total = fields.length;
  const completedList = fields.filter((f) => isFieldComplete(f, client));
  const missing = fields.filter((f) => !isFieldComplete(f, client));
  const percent = total === 0 ? 100 : Math.round((completedList.length / total) * 100);
  return {
    total,
    completed: completedList.length,
    missing,
    percent,
    allDone: missing.length === 0,
  };
}

const STORAGE_KEY_PREFIX = "profile-celebration-seen:";

export interface ProfileCompletenessProps {
  client: Config;
  lang: "de" | "en";
  onOpen: Record<DialogTarget, (fieldId?: string) => void>;
}

export function ProfileCompleteness({ client, lang, onOpen }: ProfileCompletenessProps) {
  const { total, completed, missing, percent, allDone } = computeCompleteness(client);

  // Track whether the user has already seen the celebration for this client.
  // Once seen, the card never reappears (even if fields stay at 100%).
  // null = still loading from localStorage (avoid SSR/CSR flash).
  const [celebrationSeen, setCelebrationSeen] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<"idle" | "celebrating" | "collapsing">("idle");

  const storageKey = `${STORAGE_KEY_PREFIX}${client.id}`;

  useEffect(() => {
    try {
      setCelebrationSeen(localStorage.getItem(storageKey) === "1");
    } catch {
      setCelebrationSeen(false);
    }
  }, [storageKey]);

  // When 100% is first reached and the user hasn't seen it yet: celebrate, then collapse.
  useEffect(() => {
    if (celebrationSeen !== false) return;
    if (!allDone) return;
    setPhase("celebrating");
    const t1 = setTimeout(() => setPhase("collapsing"), 900);
    const t2 = setTimeout(() => {
      try { localStorage.setItem(storageKey, "1"); } catch {}
      setCelebrationSeen(true);
    }, 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [allDone, celebrationSeen, storageKey]);

  // Don't render anything until we know the seen-state (prevents flash) or
  // once the user has already seen the celebration on this client.
  if (celebrationSeen === null) return null;
  if (celebrationSeen) return null;

  const isHealthy = percent >= 80;
  const barColor = allDone ? "bg-green-500" : isHealthy ? "bg-ocean" : "bg-amber-500";

  const t = (de: string, en: string) => (lang === "en" ? en : de);

  const collapsing = phase === "collapsing";
  const celebrating = phase === "celebrating";

  return (
    <div
      className={[
        "rounded-2xl border bg-white p-5 space-y-4 overflow-hidden",
        "transition-all duration-500 ease-out",
        celebrating ? "border-green-400/60 shadow-[0_0_0_4px_rgba(34,197,94,0.12)]" : "border-ocean/[0.06]",
        collapsing ? "opacity-0 scale-[0.98] max-h-0 !p-0 !my-0 !border-0 !space-y-0" : "max-h-[1000px]",
      ].join(" ")}
      style={{ transitionProperty: "max-height, opacity, transform, padding, margin, border-color, box-shadow" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={[
              "h-10 w-10 rounded-xl flex items-center justify-center transition-colors duration-300",
              allDone ? "bg-green-50" : "bg-blush-light/50",
            ].join(" ")}
          >
            {allDone ? (
              <CheckCircle2
                className={[
                  "h-5 w-5 text-green-600 transition-transform duration-500 ease-out",
                  celebrating ? "scale-125" : "scale-100",
                ].join(" ")}
              />
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
                    `${completed} von ${total} Feldern · ${missing.length} offen`,
                    `${completed} of ${total} fields · ${missing.length} open`,
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
                  onClick={() => onOpen[f.target](f.fieldId)}
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
