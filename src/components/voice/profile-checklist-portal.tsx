"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Config } from "@/lib/types";

// Fields the client can fill themselves from the portal voice page. Mirrors
// the server-side allowlist in /api/configs PUT — anything outside this
// list is admin-only (strategy, voice blobs, billing). Order = display
// order, so questions flow naturally from "who you are" → "what you sell".
interface QuestionDef {
  field: keyof Config;
  de: { label: string; question: string };
  en: { label: string; question: string };
  /** Custom completion check — defaults to "non-empty trimmed string". */
  isComplete?: (c: Config) => boolean;
}

const QUESTIONS: QuestionDef[] = [
  {
    field: "businessContext",
    de: { label: "Business-Kontext", question: "Was machst du genau, und wem hilfst du damit?" },
    en: { label: "Business context", question: "What exactly do you do, and who do you help?" },
  },
  {
    field: "professionalBackground",
    de: { label: "Beruflicher Hintergrund", question: "Was ist dein beruflicher Hintergrund und deine Expertise?" },
    en: { label: "Professional background", question: "What's your professional background and expertise?" },
  },
  {
    field: "keyAchievements",
    de: { label: "Erfolge & Meilensteine", question: "Was sind deine größten Erfolge, Zahlen oder Auszeichnungen?" },
    en: { label: "Achievements & milestones", question: "What are your biggest achievements, numbers, or awards?" },
  },
  {
    field: "coreOffer",
    de: { label: "Core Offer", question: "Was verkaufst du? (Produkt, Preis, Dauer, Outcome)" },
    en: { label: "Core offer", question: "What do you sell? (product, price, duration, outcome)" },
  },
  {
    field: "mainGoal",
    de: { label: "Konkretes Ziel", question: "Was ist dein konkretes Ziel mit Social Media? (z.B. 5 Sales Calls/Woche)" },
    en: { label: "Concrete goal", question: "What's your concrete social-media goal? (e.g. 5 sales calls/week)" },
  },
  {
    field: "brandFeeling",
    de: { label: "Markengefühl", question: "Welches Gefühl willst du bei Followern auslösen?" },
    en: { label: "Brand feeling", question: "What feeling do you want to evoke in your followers?" },
  },
  {
    field: "brandProblem",
    de: { label: "Kernproblem", question: "Was ist das eine Problem, das du für deine Kunden löst?" },
    en: { label: "Core problem", question: "What's the one problem you solve for your customers?" },
  },
  {
    field: "providerRole",
    de: { label: "Deine Rolle", question: "Wie würdest du deine Rolle beschreiben? (Mentor, Coach, Stratege, …)" },
    en: { label: "Your role", question: "How would you describe your role? (Mentor, coach, strategist, …)" },
  },
  {
    field: "providerBeliefs",
    de: { label: "Kernüberzeugungen", question: "Was glaubst du wird in deiner Branche falsch gemacht?" },
    en: { label: "Core beliefs", question: "What do you think is being done wrong in your industry?" },
  },
  {
    field: "providerStrengths",
    de: { label: "Kommunikationsstärken", question: "Was schätzen deine Kunden an dir am meisten?" },
    en: { label: "Communication strengths", question: "What do your customers appreciate most about you?" },
  },
  {
    field: "authenticityZone",
    de: { label: "Authentizitätszone", question: "Worüber sprichst du authentisch und mit Leichtigkeit?" },
    en: { label: "Authenticity zone", question: "What do you speak about authentically and with ease?" },
  },
  {
    field: "brandingStatement",
    de: { label: "Positionierungssatz", question: "Ich helfe [Zielgruppe], von [Ausgangspunkt], damit [Ergebnis]." },
    en: { label: "Positioning statement", question: "I help [audience], from [starting point], so that [result]." },
  },
  {
    field: "humanDifferentiation",
    de: { label: "Was macht dich einzigartig", question: "Was macht dich als Mensch einzigartig — dein AND-Faktor?" },
    en: { label: "What makes you unique", question: "What makes you unique as a person — your AND factor?" },
  },
];

function isComplete(q: QuestionDef, client: Config): boolean {
  if (q.isComplete) return q.isComplete(client);
  // dreamCustomer + customerProblems would be JSON; we don't include those
  // in the portal checklist because they need structured input.
  const v = client[q.field];
  if (typeof v === "string") return v.trim() !== "";
  return false;
}

export interface ProfileChecklistPortalProps {
  client: Config;
  lang: "de" | "en";
  onSaved: () => void;
}

export function ProfileChecklistPortal({ client, lang, onSaved }: ProfileChecklistPortalProps) {
  const [activeQuestion, setActiveQuestion] = useState<QuestionDef | null>(null);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  const total = QUESTIONS.length;
  const missing = QUESTIONS.filter((q) => !isComplete(q, client));
  const completedCount = total - missing.length;
  const percent = Math.round((completedCount / total) * 100);

  // Caller decides whether to render this card by checking missing.length;
  // we still render an internal guard for the all-done branch in case the
  // caller wants a celebratory state later.
  if (missing.length === 0) return null;

  const t = (de: string, en: string) => (lang === "en" ? en : de);

  const openQuestion = (q: QuestionDef) => {
    setActiveQuestion(q);
    setAnswer((client[q.field] as string) || "");
  };

  const closeDialog = () => {
    if (saving) return;
    setActiveQuestion(null);
    setAnswer("");
  };

  const handleSave = async () => {
    if (!activeQuestion) return;
    setSaving(true);
    try {
      const res = await fetch("/api/configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: client.id, [activeQuestion.field]: answer.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || (lang === "en" ? "Save failed" : "Speichern fehlgeschlagen"));
        return;
      }
      setActiveQuestion(null);
      setAnswer("");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/40 to-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-ocean">
                {t("Profil-Status", "Profile status")}
              </h3>
              <p className="text-[11px] text-ocean/55">
                {t(
                  `${completedCount} von ${total} Feldern · ${missing.length} offen`,
                  `${completedCount} of ${total} fields · ${missing.length} open`,
                )}
              </p>
            </div>
          </div>
          <div className="text-2xl font-semibold tabular-nums text-ocean">{percent}%</div>
        </div>

        <div className="h-1.5 rounded-full bg-ocean/[0.06] overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        <p className="text-xs text-ocean/60 leading-relaxed">
          {t(
            "Wir brauchen ein paar Infos zu dir damit der Voice-Agent dich besser versteht und Skripte präziser werden.",
            "We need a bit more info about you so the voice agent understands you better and scripts get sharper.",
          )}
        </p>

        <ul className="space-y-1">
          {missing.map((q) => (
            <li
              key={q.field}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-ocean/[0.02] transition-colors"
            >
              <span className="text-sm text-ocean/80 truncate">
                {q[lang].label}
              </span>
              <Button
                onClick={() => openQuestion(q)}
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
              >
                {t("Beantworten", "Answer")}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {/* Single-question answer dialog */}
      <Dialog open={!!activeQuestion} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-xl">
          {activeQuestion && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-medium">
                  {activeQuestion[lang].label}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-ocean/70 leading-relaxed">
                  {activeQuestion[lang].question}
                </p>
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={5}
                  className="rounded-xl"
                  placeholder={t("Deine Antwort…", "Your answer…")}
                  autoFocus
                  disabled={saving}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button onClick={closeDialog} variant="ghost" disabled={saving}>
                  {t("Abbrechen", "Cancel")}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !answer.trim()}
                  className="bg-ocean text-white hover:bg-ocean-light"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {t("Speichern", "Save")}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Helper used by the portal page to decide whether to render the
 *  checklist at all. Same logic as the component's internal guard. */
export function hasMissingProfileFields(client: Config): boolean {
  return QUESTIONS.some((q) => !isComplete(q, client));
}
