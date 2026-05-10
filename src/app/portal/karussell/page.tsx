"use client";

import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { CarouselReactMode } from "@/components/carousel-react-mode";

interface QuotaState {
  limit: number;
  used: number;
  remaining: number;
}

export default function PortalCarouselPage() {
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [quota, setQuota] = useState<QuotaState | null>(null);

  useEffect(() => {
    if (!effectiveClientId) return;
    fetch(`/api/carousel/quota?clientId=${effectiveClientId}`)
      .then((r) => r.json())
      .then((d: QuotaState) => setQuota(d))
      .catch(() => {});
  }, [effectiveClientId]);

  if (authLoading || !effectiveClientId) {
    return null;
  }

  const atLimit = quota ? quota.remaining === 0 : false;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Header — title + quota counter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-blush-dark" />
          <h1 className="text-base font-semibold text-ocean">Karussell</h1>
        </div>
        {quota && (
          <div className={`text-xs rounded-full px-3 py-1 border ${
            atLimit
              ? "bg-red-50 border-red-200 text-red-600"
              : quota.remaining <= 2
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-ocean/[0.04] border-ocean/[0.08] text-ocean/65"
          }`}>
            {quota.used} / {quota.limit} diesen Monat
          </div>
        )}
      </div>

      {atLimit && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Du hast dein monatliches Limit erreicht. Schreib deinem Manager wenn du mehr Karussells brauchst.
        </div>
      )}

      <CarouselReactMode clientId={effectiveClientId} />
    </div>
  );
}
