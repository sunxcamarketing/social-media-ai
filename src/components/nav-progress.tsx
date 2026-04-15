"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin top-of-page progress bar that shows during client-side navigation.
 * Appears on <a>-click to an internal route, disappears when the new route
 * has mounted (pathname change).
 */
export function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide bar once the new route has mounted.
  useEffect(() => {
    setActive(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [pathname]);

  // Show bar when user clicks an internal link.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const anchor = (e.target as HTMLElement)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (!href || target === "_blank") return;
      if (!href.startsWith("/") || href.startsWith("//")) return;
      if (href === pathname) return;

      setActive(true);
      // Safety: hide after 15s even if the route never changes.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setActive(false), 15000);
    };

    document.addEventListener("click", handler, { capture: true });
    return () => document.removeEventListener("click", handler, { capture: true });
  }, [pathname]);

  return (
    <div
      className={`fixed top-0 left-0 right-0 h-[3px] z-[9999] pointer-events-none overflow-hidden transition-opacity duration-150 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`h-full bg-gradient-to-r from-blush-light via-blush-dark to-ocean ${
          active ? "nav-progress-animate" : "w-0"
        }`}
      />
      <style jsx>{`
        .nav-progress-animate {
          animation: nav-progress 10s cubic-bezier(0.1, 0.5, 0.2, 1) forwards;
        }
        @keyframes nav-progress {
          0%   { width: 0%; }
          40%  { width: 60%; }
          70%  { width: 80%; }
          100% { width: 92%; }
        }
      `}</style>
    </div>
  );
}
