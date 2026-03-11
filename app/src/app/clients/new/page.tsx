"use client";

import { useI18n } from "@/lib/i18n";

export default function NewClientPage() {
  const { t } = useI18n();
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-lg font-semibold">{t("newClient.empty")}</p>
        <p className="text-sm text-muted-foreground">
          {t("newClient.emptyHint")}
        </p>
      </div>
    </div>
  );
}
