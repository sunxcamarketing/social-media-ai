"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface ProfileCompleteBadgeProps {
  /** Whether the profile is currently 100% complete. */
  complete: boolean;
  /** Client id — used to scope the one-time celebration animation. */
  clientId: string;
  /** Localized title (tooltip). */
  title?: string;
}

const STORAGE_KEY_PREFIX = "profile-celebration-seen:";

/**
 * Small green check rendered next to the client name when the profile is
 * fully filled. Slides in once (synced with the celebration card collapsing),
 * then stays static on subsequent visits.
 */
export function ProfileCompleteBadge({ complete, clientId, title }: ProfileCompleteBadgeProps) {
  const [seenBefore, setSeenBefore] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);

  const storageKey = `${STORAGE_KEY_PREFIX}${clientId}`;

  useEffect(() => {
    try {
      setSeenBefore(localStorage.getItem(storageKey) === "1");
    } catch {
      setSeenBefore(false);
    }
  }, [storageKey]);

  // First-time celebration: wait until the card has finished collapsing
  // (~1.4s in profile-completeness.tsx), then fade the badge in.
  useEffect(() => {
    if (!complete || seenBefore !== false) {
      // already seen — render immediately, no entrance animation
      if (complete && seenBefore === true) setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(true), 1100);
    return () => clearTimeout(t);
  }, [complete, seenBefore]);

  if (!complete || seenBefore === null) return null;

  // Already seen on a previous visit → render static, no animation.
  if (seenBefore) {
    return (
      <span
        title={title}
        className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-50 border border-green-200/60"
        aria-label={title}
      >
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      </span>
    );
  }

  // First time → slide+fade in once.
  return (
    <span
      title={title}
      aria-label={title}
      className={[
        "inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-50 border border-green-200/60",
        "transition-all duration-500 ease-out",
        mounted ? "opacity-100 translate-x-0 scale-100" : "opacity-0 -translate-x-2 scale-75",
      ].join(" ")}
    >
      <CheckCircle2 className="h-4 w-4 text-green-600" />
    </span>
  );
}
