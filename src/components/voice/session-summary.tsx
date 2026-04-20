"use client";

import { motion } from "motion/react";
import { Check, Lightbulb } from "lucide-react";

export interface IdeaResult {
  title: string;
  description: string;
  contentType: string;
}

export interface FieldSuggestion {
  field: string;
  value: string;
  sourceQuote: string;
}

export interface SessionSummaryData {
  ideas?: IdeaResult[];
  doneCount?: number;
  total?: number;
  synthesisGenerated?: boolean;
  fieldSuggestions?: FieldSuggestion[];
  durationSeconds: number;
  transcriptLength: number;
}

export interface TranscriptEntry {
  role: "user" | "model";
  text: string;
}

export interface SessionSummaryViewProps {
  mode: "onboarding" | "content-ideas";
  summary: SessionSummaryData;
  transcript: TranscriptEntry[];
  selectedSuggestions: Set<string>;
  applying: boolean;
  applyResult: "idle" | "done" | "error";
  onToggleSuggestion: (field: string) => void;
  onToggleAll: () => void;
  onApplySelected: () => void;
  onReset: () => void;
  t: (key: string, subs?: Record<string, string | number>) => string;
}

export function SessionSummaryView({
  mode,
  summary,
  transcript,
  selectedSuggestions,
  applying,
  applyResult,
  onToggleSuggestion,
  onToggleAll,
  onApplySelected,
  onReset,
  t,
}: SessionSummaryViewProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-green-500/10 flex items-center justify-center mb-3 mx-auto">
            <Check className="h-6 w-6 text-green-500" />
          </div>
          <p className="text-lg font-medium text-ocean mb-1">
            {mode === "onboarding" && summary.doneCount === summary.total
              ? t("voice.onboardingComplete")
              : t("voice.sessionComplete")}
          </p>
          <p className="text-sm text-ocean/45">
            {t("voice.duration", { minutes: Math.floor(summary.durationSeconds / 60) })}
            {mode === "onboarding" && typeof summary.doneCount === "number" && typeof summary.total === "number" && (
              ` · ${t("voice.onboardingPartial", { done: summary.doneCount, total: summary.total })}`
            )}
            {mode !== "onboarding" && summary.ideas && summary.ideas.length > 0 && ` · ${t("voice.ideasSaved", { count: summary.ideas.length })}`}
          </p>
        </div>

        {mode !== "onboarding" && summary.ideas && summary.ideas.length > 0 && (
          <div className="space-y-3 mb-8">
            <p className="text-xs font-medium text-ocean/50 uppercase tracking-wider">
              {t("voice.savedIdeas")}
            </p>
            {summary.ideas.map((idea, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl border border-ocean/[0.06] p-4 shadow-[0_1px_8px_rgba(32,35,69,0.04)]"
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-xl bg-blush-light/50 flex items-center justify-center shrink-0 mt-0.5">
                    <Lightbulb className="h-4 w-4 text-blush-dark" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ocean mb-0.5">{idea.title}</p>
                    <p className="text-xs text-ocean/50 leading-relaxed">{idea.description}</p>
                    {idea.contentType && (
                      <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-ocean/[0.04] text-ocean/40">
                        {idea.contentType}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {mode === "onboarding" && summary.fieldSuggestions && summary.fieldSuggestions.length > 0 && (
          <div className="space-y-3 mb-8">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ocean/50 uppercase tracking-wider">
                {t("voice.fieldSuggestionsTitle")}
              </p>
              <button
                onClick={onToggleAll}
                className="text-[10px] text-ocean/50 hover:text-ocean uppercase tracking-wider transition-colors"
              >
                {selectedSuggestions.size === summary.fieldSuggestions.length
                  ? t("voice.deselectAll")
                  : t("voice.selectAll")}
              </button>
            </div>
            <p className="text-xs text-ocean/55 leading-relaxed">
              {t("voice.fieldSuggestionsHint")}
            </p>
            {summary.fieldSuggestions.map((s, i) => {
              const checked = selectedSuggestions.has(s.field);
              return (
                <motion.label
                  key={s.field}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-start gap-3 bg-white rounded-2xl border p-4 cursor-pointer transition-all ${
                    checked ? "border-ocean/30 shadow-[0_2px_10px_rgba(32,35,69,0.06)]" : "border-ocean/[0.06] hover:border-ocean/15"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleSuggestion(s.field)}
                    className="mt-1 h-4 w-4 rounded border-ocean/20 text-ocean focus:ring-ocean/30"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-ocean/45 mb-1">{s.field}</p>
                    <p className="text-sm text-ocean leading-snug mb-1.5">{s.value}</p>
                    <p className="text-[11px] text-ocean/45 italic leading-relaxed">&ldquo;{s.sourceQuote}&rdquo;</p>
                  </div>
                </motion.label>
              );
            })}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={onApplySelected}
                disabled={selectedSuggestions.size === 0 || applying || applyResult === "done"}
                className="px-5 py-2.5 rounded-full bg-ocean text-white text-sm font-medium hover:shadow-lg hover:scale-[1.02] transition-all duration-200 btn-press disabled:opacity-40 disabled:hover:scale-100"
              >
                {applying
                  ? t("voice.applying")
                  : applyResult === "done"
                  ? t("voice.applied")
                  : t("voice.applySelected", { count: selectedSuggestions.size })}
              </button>
              {applyResult === "error" && (
                <span className="text-xs text-red-500">{t("voice.applyError")}</span>
              )}
            </div>
          </div>
        )}

        {transcript.length > 0 && (
          <details className="mb-6">
            <summary className="text-xs text-ocean/40 cursor-pointer hover:text-ocean/60 transition-colors">
              {t("voice.showTranscript", { count: transcript.length })}
            </summary>
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
              {transcript.map((entry, i) => (
                <div key={i} className="text-xs text-ocean/50">
                  <span className="font-medium">{entry.role === "user" ? t("voice.you") : "Agent"}:</span>{" "}
                  {entry.text}
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="text-center">
          <button
            onClick={onReset}
            className="px-6 py-2.5 rounded-full bg-ocean text-white text-sm font-medium hover:shadow-lg hover:scale-[1.02] transition-all duration-200 btn-press"
          >
            {t("voice.restartButton")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
