"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ProfileData } from "@/components/audit-report";

interface AuditRun {
  /** Which client or handle this audit is for (clientId or "global") */
  key: string;
  phase: string;
  profile: ProfileData | null;
  report: string;
  error: string;
  running: boolean;
}

interface AuditContextValue {
  /** All current audit runs */
  audits: Record<string, AuditRun>;
  /** Get the current audit run for a key, or null */
  getAudit: (key: string) => AuditRun | null;
  /** Start an audit. Returns immediately — runs in background via SSE. */
  startAudit: (params: {
    key: string;
    handle: string;
    lang: "de" | "en";
  }) => void;
  /** Clear a finished audit from state */
  clearAudit: (key: string) => void;
}

const AuditContext = createContext<AuditContextValue | null>(null);

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const [audits, setAudits] = useState<Record<string, AuditRun>>({});
  const abortRefs = useRef<Record<string, AbortController>>({});

  const getAudit = useCallback(
    (key: string) => audits[key] ?? null,
    [audits],
  );

  const update = useCallback((key: string, patch: Partial<AuditRun>) => {
    setAudits((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch } as AuditRun,
    }));
  }, []);

  const startAudit = useCallback(
    ({ key, handle, lang }: { key: string; handle: string; lang: "de" | "en" }) => {
      // Abort any previous run for this key
      abortRefs.current[key]?.abort();
      const ctrl = new AbortController();
      abortRefs.current[key] = ctrl;

      // Set initial state
      setAudits((prev) => ({
        ...prev,
        [key]: {
          key,
          phase: "scraping",
          profile: null,
          report: "",
          error: "",
          running: true,
        },
      }));

      // Run SSE in background
      (async () => {
        try {
          const res = await fetch("/api/analyse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instagramHandle: handle, lang }),
            signal: ctrl.signal,
          });

          const reader = res.body?.getReader();
          if (!reader) throw new Error("No response body");

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = JSON.parse(line.slice(6));

              if (data.phase === "profile_loaded") {
                update(key, { profile: data.profile, phase: "reels" });
              } else if (data.phase === "reels_loaded") {
                update(key, { phase: "analyzing" });
              } else if (data.phase === "done") {
                update(key, {
                  report: data.report,
                  profile: data.profile,
                  phase: "done",
                  running: false,
                });
              } else if (data.phase === "error") {
                update(key, {
                  error: data.message,
                  phase: "error",
                  running: false,
                });
              } else if (data.phase) {
                update(key, { phase: data.phase });
              }
            }
          }

          // Stream ended — make sure we mark as not running
          setAudits((prev) => {
            const current = prev[key];
            if (current?.running) {
              return { ...prev, [key]: { ...current, running: false } };
            }
            return prev;
          });
        } catch (err) {
          if ((err as Error).name !== "AbortError") {
            update(key, {
              error: (err as Error).message || "Unknown error",
              phase: "error",
              running: false,
            });
          }
        }
      })();
    },
    [update],
  );

  const clearAudit = useCallback((key: string) => {
    abortRefs.current[key]?.abort();
    setAudits((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  return (
    <AuditContext.Provider value={{ audits, getAudit, startAudit, clearAudit }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit(key: string) {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error("useAudit must be used within AuditProvider");
  return {
    audit: ctx.getAudit(key),
    startAudit: (handle: string, lang: "de" | "en") =>
      ctx.startAudit({ key, handle, lang }),
    clearAudit: () => ctx.clearAudit(key),
  };
}

/** Returns { running, done } for a given audit key — used by sidebar indicators */
export function useAuditStatus(key: string) {
  const ctx = useContext(AuditContext);
  if (!ctx) return { running: false, done: false };
  const audit = ctx.audits[key];
  return {
    running: audit?.running ?? false,
    done: !!(audit && !audit.running && audit.report),
  };
}
