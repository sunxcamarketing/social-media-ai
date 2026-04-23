"use client";

import { Sparkles, type LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ComingSoonPanelProps {
  icon: LucideIcon;
  titleKey: string;
  bodyKey: string;
}

export function ComingSoonPanel({ icon: Icon, titleKey, bodyKey }: ComingSoonPanelProps) {
  const { t } = useI18n();
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center rounded-3xl border border-ocean/[0.08] bg-white/70 backdrop-blur-sm p-8 sm:p-10 shadow-[0_4px_24px_rgba(32,35,69,0.04)]">
        <div className="relative inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-blush-light/50 mb-5">
          <Icon className="h-6 w-6 text-blush-dark" />
          <span className="absolute -top-1.5 -right-1.5 text-[9px] uppercase tracking-wider font-medium rounded-full px-1.5 py-0.5 bg-blush-light text-blush-dark border border-blush/20">
            {t("comingSoon.badge")}
          </span>
        </div>
        <h2 className="text-lg sm:text-xl font-light text-ocean mb-2">{t(titleKey)}</h2>
        <p className="text-sm text-ocean/60 leading-relaxed mb-4">{t(bodyKey)}</p>
        <p className="text-[11px] text-ocean/40 inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {t("comingSoon.thanks")}
        </p>
      </div>
    </div>
  );
}
