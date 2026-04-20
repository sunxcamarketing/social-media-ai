// Per-client pipeline locks — DB-backed so they survive across serverless
// invocations. Locks auto-expire so a crashed run never blocks a retry.
//
// Migration: supabase-migrations/2026-04-17-pipeline-locks.sql

import { v4 as uuid } from "uuid";
import { supabase } from "@/lib/supabase";

export type PipelineKind = "weekly-scripts" | "video-analysis" | "strategy" | "voice-profile" | "performance";

export interface LockHandle {
  clientId: string;
  kind: PipelineKind;
  runId: string;
  acquired: boolean;
  holderRunId?: string;
}

/**
 * Try to acquire an exclusive lock for (clientId, kind).
 * Returns `{ acquired: true, runId }` on success, or `{ acquired: false, holderRunId }`
 * when another run already holds the lock.
 *
 * Locks auto-expire after `ttlMinutes` so a stuck run never blocks forever.
 */
export async function acquirePipelineLock(
  clientId: string,
  kind: PipelineKind,
  ttlMinutes = 10,
): Promise<LockHandle> {
  const runId = uuid();
  const { data, error } = await supabase.rpc("acquire_pipeline_lock", {
    p_client_id: clientId,
    p_kind: kind,
    p_run_id: runId,
    p_ttl_minutes: ttlMinutes,
  });

  if (error) {
    // If the RPC doesn't exist yet (migration not run), fail open so the
    // pipeline still works — we just lose the lock semantics.
    console.error("acquire_pipeline_lock RPC failed:", error.message);
    return { clientId, kind, runId, acquired: true };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const acquired = !!row?.acquired;
  return {
    clientId,
    kind,
    runId,
    acquired,
    holderRunId: acquired ? undefined : row?.holder_run_id,
  };
}

/**
 * Release a lock. Only the owner (matching runId) can release.
 * Idempotent — safe to call in a `finally` block even if acquisition failed.
 */
export async function releasePipelineLock(handle: LockHandle): Promise<void> {
  if (!handle.acquired) return;
  const { error } = await supabase.rpc("release_pipeline_lock", {
    p_client_id: handle.clientId,
    p_kind: handle.kind,
    p_run_id: handle.runId,
  });
  if (error) {
    console.error("release_pipeline_lock RPC failed:", error.message);
  }
}

/**
 * Wrapper: run `fn` with a lock held. Automatically releases on success or error.
 * Throws `PipelineLockedError` if the lock is held by another run.
 */
export class PipelineLockedError extends Error {
  constructor(public clientId: string, public kind: string, public holderRunId?: string) {
    super(`Pipeline ${kind} already running for client ${clientId}`);
  }
}

export async function withPipelineLock<T>(
  clientId: string,
  kind: PipelineKind,
  fn: () => Promise<T>,
  ttlMinutes = 10,
): Promise<T> {
  const handle = await acquirePipelineLock(clientId, kind, ttlMinutes);
  if (!handle.acquired) {
    throw new PipelineLockedError(clientId, kind, handle.holderRunId);
  }
  try {
    return await fn();
  } finally {
    await releasePipelineLock(handle);
  }
}
