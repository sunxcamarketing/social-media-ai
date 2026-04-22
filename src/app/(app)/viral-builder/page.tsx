"use client";

import { useState } from "react";
import {
  Search, FileText, Video, Scissors,
  ChevronDown, ChevronRight, CheckCircle2,
  Lightbulb, AlertTriangle, Zap, Eye,
  Clock, Star, Target, Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

// ── Types ───────────────────────────────────────────────────────────────────

type StepId = "research" | "scripting" | "filming" | "editing";

interface Step {
  id: StepId;
  number: number;
  titleKey: string;
  subtitleKey: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}

// ── Step Definitions ────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: "research",
    number: 1,
    titleKey: "vc.step.research",
    subtitleKey: "vc.step.research.sub",
    icon: Search,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  {
    id: "scripting",
    number: 2,
    titleKey: "vc.step.scripting",
    subtitleKey: "vc.step.scripting.sub",
    icon: FileText,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  {
    id: "filming",
    number: 3,
    titleKey: "vc.step.filming",
    subtitleKey: "vc.step.filming.sub",
    icon: Video,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  {
    id: "editing",
    number: 4,
    titleKey: "vc.step.editing",
    subtitleKey: "vc.step.editing.sub",
    icon: Scissors,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
];

// ── Tip icon mappings per step ──────────────────────────────────────────────

const TIP_ICONS: Record<StepId, React.ElementType[]> = {
  research: [Target, Eye, Zap, Lightbulb],
  scripting: [Target, Lightbulb, Star, Zap, AlertTriangle, Eye],
  filming: [Zap, Lightbulb, Star, Target],
  editing: [Scissors, Clock, Eye, Lightbulb, Sparkles, Star, Target, Zap],
};

// ── Translation key maps ────────────────────────────────────────────────────

const TIP_KEYS: Record<StepId, string[]> = {
  research: ["vc.research.tip1", "vc.research.tip2", "vc.research.tip3", "vc.research.tip4"],
  scripting: ["vc.scripting.tip1", "vc.scripting.tip2", "vc.scripting.tip3", "vc.scripting.tip4", "vc.scripting.tip5", "vc.scripting.tip6"],
  filming: ["vc.filming.tip1", "vc.filming.tip2", "vc.filming.tip3", "vc.filming.tip4"],
  editing: ["vc.editing.tip1", "vc.editing.tip2", "vc.editing.tip3", "vc.editing.tip4", "vc.editing.tip5", "vc.editing.tip6", "vc.editing.tip7", "vc.editing.tip8"],
};

const CHECKLIST_KEYS: Record<StepId, string[]> = {
  research: ["vc.research.cl1", "vc.research.cl2", "vc.research.cl3", "vc.research.cl4", "vc.research.cl5"],
  scripting: ["vc.scripting.cl1", "vc.scripting.cl2", "vc.scripting.cl3", "vc.scripting.cl4", "vc.scripting.cl5", "vc.scripting.cl6", "vc.scripting.cl7", "vc.scripting.cl8", "vc.scripting.cl9"],
  filming: ["vc.filming.cl1", "vc.filming.cl2", "vc.filming.cl3", "vc.filming.cl4", "vc.filming.cl5", "vc.filming.cl6"],
  editing: ["vc.editing.cl1", "vc.editing.cl2", "vc.editing.cl3", "vc.editing.cl4", "vc.editing.cl5", "vc.editing.cl6", "vc.editing.cl7", "vc.editing.cl8", "vc.editing.cl9", "vc.editing.cl10"],
};

const PRINCIPLE_KEYS = ["vc.p1", "vc.p2", "vc.p3", "vc.p4", "vc.p5", "vc.p6", "vc.p7", "vc.p8", "vc.p9", "vc.p10"];

// ── Component ───────────────────────────────────────────────────────────────

export default function ViralityChecklistPage() {
  const { t } = useI18n();
  const [activeStep, setActiveStep] = useState<StepId>("research");
  const [expandedTips, setExpandedTips] = useState<Set<string>>(new Set());
  const [checklists, setChecklists] = useState<Record<StepId, boolean[]>>({
    research: new Array(CHECKLIST_KEYS.research.length).fill(false),
    scripting: new Array(CHECKLIST_KEYS.scripting.length).fill(false),
    filming: new Array(CHECKLIST_KEYS.filming.length).fill(false),
    editing: new Array(CHECKLIST_KEYS.editing.length).fill(false),
  });
  const [showPrinciples, setShowPrinciples] = useState(false);

  const toggleCheck = (step: StepId, index: number) => {
    setChecklists((prev) => {
      const next = { ...prev };
      next[step] = [...prev[step]];
      next[step][index] = !next[step][index];
      return next;
    });
  };

  const toggleTip = (key: string) => {
    setExpandedTips((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getProgress = (step: StepId): number => {
    const checks = checklists[step];
    const done = checks.filter(Boolean).length;
    return checks.length > 0 ? Math.round((done / checks.length) * 100) : 0;
  };

  const currentStep = STEPS.find((s) => s.id === activeStep)!;
  const tipKeys = TIP_KEYS[activeStep];
  const tipIcons = TIP_ICONS[activeStep];
  const checklistKeys = CHECKLIST_KEYS[activeStep];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ocean">
            {t("vc.title")}
          </h1>
          <p className="text-[12px] text-ocean/60 mt-0.5">
            {t("vc.subtitle")}
          </p>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STEPS.map((step) => {
          const isActive = step.id === activeStep;
          const progress = getProgress(step.id);
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`relative rounded-xl p-4 text-left transition-all ${
                isActive
                  ? `${step.bgColor} ${step.borderColor} border-2 shadow-sm`
                  : "bg-warm-white border border-ocean/[0.06] hover:border-ocean/10"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${
                  isActive ? `${step.bgColor} ${step.color}` : "bg-ocean/[0.04] text-ocean/50"
                }`}>
                  {step.number}
                </span>
                <Icon className={`h-4 w-4 ${isActive ? step.color : "text-ocean/40"}`} />
              </div>
              <div className={`text-[13px] font-medium ${isActive ? step.color : "text-ocean/70"}`}>
                {t(step.titleKey)}
              </div>
              <div className="text-[11px] text-ocean/50 mt-0.5">{t(step.subtitleKey)}</div>

              {/* Progress bar */}
              <div className="mt-3 h-1 rounded-full bg-ocean/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progress === 100 ? "bg-green-500" : isActive ? "bg-ocean/30" : "bg-ocean/15"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {progress > 0 && (
                <div className="text-[10px] text-ocean/40 mt-1">{progress}%</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">

        {/* Tips — Left Side (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className={`text-sm font-semibold ${currentStep.color} flex items-center gap-2`}>
            <Lightbulb className="h-4 w-4" />
            {t("vc.tipsTitle")} — Step {currentStep.number}: {t(currentStep.titleKey)}
          </h2>

          <div className="space-y-2">
            {tipKeys.map((key, i) => {
              const tipId = `${activeStep}-${i}`;
              const isOpen = expandedTips.has(tipId);
              const TipIcon = tipIcons[i];
              return (
                <button
                  key={tipId}
                  onClick={() => toggleTip(tipId)}
                  className={`w-full text-left rounded-xl border transition-all ${
                    isOpen ? `${currentStep.bgColor} ${currentStep.borderColor}` : "bg-white border-ocean/[0.06] hover:border-ocean/10"
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <TipIcon className={`h-4 w-4 shrink-0 ${isOpen ? currentStep.color : "text-ocean/40"}`} />
                    <span className={`text-[13px] font-medium flex-1 ${isOpen ? "text-ocean" : "text-ocean/80"}`}>
                      {t(`${key}.title`)}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-ocean/40 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-ocean/40 shrink-0" />
                    )}
                  </div>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-0">
                      <p className="text-[12px] text-ocean/70 leading-relaxed pl-7">
                        {t(`${key}.detail`)}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Checklist — Right Side (2 cols) */}
        <div className="col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-ocean flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {t("vc.checklist")}
          </h2>

          <div className="rounded-xl border border-ocean/[0.06] bg-white p-4 space-y-2">
            {checklistKeys.map((key, i) => {
              const checked = checklists[activeStep][i];
              return (
                <label
                  key={i}
                  className="flex items-start gap-3 cursor-pointer group"
                >
                  <div className="pt-0.5">
                    <div
                      className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-all ${
                        checked
                          ? "bg-green-500 border-green-500"
                          : "border-ocean/20 group-hover:border-ocean/40"
                      }`}
                      onClick={() => toggleCheck(activeStep, i)}
                    >
                      {checked && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-[12px] leading-relaxed transition-all ${
                      checked ? "text-ocean/40 line-through" : "text-ocean/80"
                    }`}
                    onClick={() => toggleCheck(activeStep, i)}
                  >
                    {t(key)}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Quick Reminder Box */}
          {activeStep === "scripting" && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-purple-600" />
                <span className="text-[12px] font-semibold text-purple-700">{t("vc.reminder.scripting.title")}</span>
              </div>
              <p className="text-[11px] text-purple-600/80 leading-relaxed">
                {t("vc.reminder.scripting.text")}
              </p>
            </div>
          )}

          {activeStep === "editing" && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-3.5 w-3.5 text-orange-600" />
                <span className="text-[12px] font-semibold text-orange-700">{t("vc.reminder.editing.title")}</span>
              </div>
              <p className="text-[11px] text-orange-600/80 leading-relaxed">
                {t("vc.reminder.editing.text")}
              </p>
            </div>
          )}

          {activeStep === "research" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-[12px] font-semibold text-blue-700">{t("vc.reminder.research.title")}</span>
              </div>
              <p className="text-[11px] text-blue-600/80 leading-relaxed">
                {t("vc.reminder.research.text")}
              </p>
            </div>
          )}

          {activeStep === "filming" && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Video className="h-3.5 w-3.5 text-green-600" />
                <span className="text-[12px] font-semibold text-green-700">{t("vc.reminder.filming.title")}</span>
              </div>
              <p className="text-[11px] text-green-600/80 leading-relaxed">
                {t("vc.reminder.filming.text")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Psychological Principles */}
      <div className="mt-4">
        <button
          onClick={() => setShowPrinciples(!showPrinciples)}
          className="flex items-center gap-2 text-[13px] font-medium text-ocean/70 hover:text-ocean transition-colors"
        >
          {showPrinciples ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Sparkles className="h-3.5 w-3.5" />
          {t("vc.principles")}
        </button>

        {showPrinciples && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {PRINCIPLE_KEYS.map((key, i) => (
              <div
                key={i}
                className="rounded-xl border border-ocean/[0.06] bg-white p-3 flex gap-3"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-ocean/[0.04] text-[11px] font-bold text-ocean/60 shrink-0">
                  {i + 1}
                </span>
                <div>
                  <div className="text-[12px] font-medium text-ocean">{t(`${key}.title`)}</div>
                  <div className="text-[11px] text-ocean/60 mt-0.5">{t(`${key}.desc`)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
