"use client";

import { VOICE_BLOCK_ORDER, type VoiceBlockId } from "@/lib/types";

export interface OnboardingProgressProps {
  completed: Set<VoiceBlockId>;
  t: (key: string, subs?: Record<string, string | number>) => string;
}

export function OnboardingProgress({ completed, t }: OnboardingProgressProps) {
  const total = VOICE_BLOCK_ORDER.length;
  const doneCount = completed.size;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-ocean/45">
        <span>{t("voice.progressLabel", { done: doneCount, total })}</span>
      </div>
      <div className="flex gap-1.5">
        {VOICE_BLOCK_ORDER.map((blockId) => {
          const done = completed.has(blockId);
          return (
            <div
              key={blockId}
              title={t(`voice.block.${blockId}`)}
              className={`group relative flex-1 h-1.5 rounded-full transition-all duration-300 ${
                done ? "bg-ocean" : "bg-ocean/15"
              }`}
            >
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-ocean/35 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {t(`voice.block.${blockId}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
