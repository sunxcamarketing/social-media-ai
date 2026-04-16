"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
} from "lucide-react";
import { invalidateClientsCache } from "@/hooks/use-clients-cache";

// ── Step definitions ──────────────────────────────────────────────────────

interface Step {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  fields: FieldDef[];
}

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "url";
  placeholder: string;
  required?: boolean;
  half?: boolean;
}

const STEPS: Step[] = [
  {
    id: "basics",
    category: "Grundlagen",
    title: "Wer ist dein Client?",
    subtitle: "Name und Basics — das Fundament für alles weitere.",
    fields: [
      { key: "configName", label: "Name / Markenname", type: "text", placeholder: "z.B. Elliott Mohammadi", required: true },
      { key: "company", label: "Unternehmen", type: "text", placeholder: "z.B. Elliott Fitness GmbH", half: true },
      { key: "role", label: "Rolle / Titel", type: "text", placeholder: "z.B. Fitness Coach & Mindset Trainer", half: true },
      { key: "location", label: "Standort", type: "text", placeholder: "z.B. Dubai / München", half: true },
      { key: "creatorsCategory", label: "Nische / Kategorie", type: "text", placeholder: "z.B. Fitness & Mindset", half: true },
    ],
  },
  {
    id: "social",
    category: "Social Media",
    title: "Wo ist dein Client aktiv?",
    subtitle: "Social-Media-Profile und Website. Mindestens Instagram.",
    fields: [
      { key: "instagram", label: "Instagram", type: "text", placeholder: "@username", required: true },
      { key: "tiktok", label: "TikTok", type: "text", placeholder: "@username", half: true },
      { key: "youtube", label: "YouTube", type: "text", placeholder: "@channel", half: true },
      { key: "linkedin", label: "LinkedIn", type: "url", placeholder: "linkedin.com/in/...", half: true },
      { key: "twitter", label: "X / Twitter", type: "text", placeholder: "@handle", half: true },
      { key: "website", label: "Website", type: "url", placeholder: "www.example.com" },
    ],
  },
  {
    id: "business",
    category: "Business",
    title: "Was macht dein Client?",
    subtitle: "Kontext, Hintergrund und Erfolge.",
    fields: [
      { key: "businessContext", label: "Business-Kontext", type: "textarea", placeholder: "Was macht der Client? Welche Dienstleistungen/Produkte? Wer sind typische Kunden?" },
      { key: "professionalBackground", label: "Professioneller Hintergrund", type: "textarea", placeholder: "Werdegang, Expertise, jahrelange Erfahrung in..." },
      { key: "keyAchievements", label: "Wichtigste Erfolge", type: "textarea", placeholder: "z.B. 500+ Kunden betreut, 10M+ Views auf Instagram, Buch veröffentlicht..." },
    ],
  },
  {
    id: "brand",
    category: "Marke",
    title: "Wie soll die Marke wirken?",
    subtitle: "Das Gefühl, das Problem und die Positionierung.",
    fields: [
      { key: "brandFeeling", label: "Markengefühl", type: "textarea", placeholder: "Welches Gefühl soll jemand haben wenn er den Content sieht? z.B. 'Ich kann das auch schaffen'" },
      { key: "brandProblem", label: "Kernproblem der Zielgruppe", type: "textarea", placeholder: "Welches Problem löst der Client für seine Kunden? So konkret wie möglich." },
      { key: "brandingStatement", label: "Positionierung in einem Satz", type: "text", placeholder: "z.B. 'Der ehrlichste Fitness-Coach Deutschlands'" },
      { key: "humanDifferentiation", label: "Was macht den Client einzigartig?", type: "textarea", placeholder: "Was unterscheidet ihn/sie von allen anderen in der Nische? Der persönliche Faktor." },
    ],
  },
  {
    id: "audience",
    category: "Zielgruppe",
    title: "Wen erreichen wir?",
    subtitle: "Traumkunde und dessen Probleme.",
    fields: [
      { key: "dreamCustomer", label: "Traumkunde", type: "textarea", placeholder: "Wer ist der ideale Kunde? Alter, Situation, Schmerzpunkt, Wünsche..." },
      { key: "customerProblems", label: "Top-Probleme der Zielgruppe", type: "textarea", placeholder: "Die 3-5 größten Probleme die der Traumkunde hat (eins pro Zeile)" },
    ],
  },
  {
    id: "voice",
    category: "Stimme",
    title: "Wie spricht dein Client?",
    subtitle: "Tonalität, Überzeugungen und Stärken — für authentischen Content.",
    fields: [
      { key: "providerRole", label: "Rolle gegenüber der Zielgruppe", type: "text", placeholder: "z.B. Mentor, großer Bruder, strenger Coach, beste Freundin..." },
      { key: "providerBeliefs", label: "Kernüberzeugungen", type: "textarea", placeholder: "Was glaubt der Client zutiefst? z.B. 'Jeder kann sich verändern, aber nicht jeder will es genug'" },
      { key: "providerStrengths", label: "Kommunikationsstärken", type: "textarea", placeholder: "z.B. direkt, emotional, humorvoll, provokant, empathisch..." },
      { key: "authenticityZone", label: "Authentizitätszone", type: "textarea", placeholder: "Worüber spricht der Client am liebsten frei und ungeschliffen? Wo ist die Leidenschaft am größten?" },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────

export default function NewClientOnboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  const canProceed = step.fields
    .filter((f) => f.required)
    .every((f) => (answers[f.key] || "").trim().length > 0);

  const setAnswer = useCallback((key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const goNext = () => {
    if (!canProceed) return;
    setDirection(1);
    if (isLast) {
      handleSubmit();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (isFirst) {
      router.push("/admin");
      return;
    }
    setDirection(-1);
    setCurrentStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Fehler beim Speichern");
      }
      const created = await res.json();
      invalidateClientsCache();
      router.push(`/clients/${created.id}/dashboard`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      setSaving(false);
    }
  };

  const goToStep = (idx: number) => {
    if (idx > currentStep) return;
    setDirection(idx > currentStep ? 1 : -1);
    setCurrentStep(idx);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && canProceed) {
      e.preventDefault();
      goNext();
    }
  };

  return (
    <div className="-mx-8 -mt-8 -mb-8 min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-6 py-12">
      {/* Progress bar */}
      <div className="w-full max-w-2xl mb-10">
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goToStep(i)}
              title={s.category}
              disabled={i > currentStep}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i < currentStep
                  ? "bg-ocean cursor-pointer hover:bg-ocean-light"
                  : i === currentStep
                  ? "bg-ocean"
                  : "bg-ocean/15"
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-ocean/40 uppercase tracking-wider">{step.category}</span>
          <span className="text-[10px] text-ocean/40">{currentStep + 1} / {STEPS.length}</span>
        </div>
      </div>

      {/* Step content */}
      <div className="w-full max-w-2xl" onKeyDown={handleKeyDown}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -60 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="mb-8">
              <h1 className="text-2xl font-light text-ocean">{step.title}</h1>
              {step.subtitle && (
                <p className="text-sm text-ocean/50 mt-1.5">{step.subtitle}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              {step.fields.map((field, i) => (
                <motion.div
                  key={field.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={field.half ? "w-[calc(50%-0.5rem)]" : "w-full"}
                >
                  <label className="block text-xs font-medium text-ocean/60 mb-1.5">
                    {field.label}
                    {field.required && <span className="text-blush-dark ml-0.5">*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      value={answers[field.key] || ""}
                      onChange={(e) => setAnswer(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full rounded-xl bg-white border border-ocean/[0.08] px-4 py-3 text-sm text-ocean placeholder:text-ocean/30 focus:outline-none focus:border-blush/60 focus:shadow-[0_0_0_3px_rgba(242,200,210,0.15)] transition-all resize-none leading-relaxed"
                    />
                  ) : (
                    <input
                      type={field.type === "url" ? "url" : "text"}
                      value={answers[field.key] || ""}
                      onChange={(e) => setAnswer(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full h-11 rounded-xl bg-white border border-ocean/[0.08] px-4 text-sm text-ocean placeholder:text-ocean/30 focus:outline-none focus:border-blush/60 focus:shadow-[0_0_0_3px_rgba(242,200,210,0.15)] transition-all"
                    />
                  )}
                </motion.div>
              ))}
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2">{error}</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="w-full max-w-2xl flex items-center justify-between mt-10">
        <button
          onClick={goBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-ocean/[0.08] text-sm text-ocean/60 hover:text-ocean hover:border-ocean/[0.15] transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          {isFirst ? "Abbrechen" : "Zurück"}
        </button>

        <button
          onClick={goNext}
          disabled={!canProceed || saving}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all shadow-lg ${
            canProceed && !saving
              ? "bg-ocean text-white hover:bg-ocean-light hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              : "bg-ocean/30 text-white/60 cursor-not-allowed shadow-none"
          }`}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Wird gespeichert...
            </>
          ) : isLast ? (
            <>
              <Check className="h-4 w-4" />
              Client anlegen
            </>
          ) : (
            <>
              Weiter
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
