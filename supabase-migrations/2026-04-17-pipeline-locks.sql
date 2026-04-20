-- ═══════════════════════════════════════════════════════════════════════
--  2026-04-17 — Per-client pipeline locks
--
--  Prevents the same client from running the same pipeline twice in
--  parallel (tab spam, webhook double-firing, user impatient-retry).
--  Locks auto-expire after a TTL so a crashed run never blocks forever.
--
--  Run this in Supabase → SQL Editor. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pipeline_locks (
  client_id   TEXT NOT NULL,
  kind        TEXT NOT NULL,          -- e.g. 'weekly-scripts', 'video-analysis', 'strategy'
  run_id      TEXT NOT NULL,          -- UUID of the run that owns the lock
  acquired_at TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,   -- acquired_at + ttl
  PRIMARY KEY (client_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_locks_expires ON pipeline_locks (expires_at);

ALTER TABLE pipeline_locks ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pipeline_locks'
      AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON pipeline_locks FOR ALL USING (true);
  END IF;
END $$;

-- Atomic lock acquisition:
--   1. Delete expired locks for (client_id, kind)
--   2. INSERT new lock — fails on unique_violation if an active lock exists
--   3. Return { acquired: true } on success, { acquired: false, holder_run_id } otherwise.
CREATE OR REPLACE FUNCTION acquire_pipeline_lock(
  p_client_id   TEXT,
  p_kind        TEXT,
  p_run_id      TEXT,
  p_ttl_minutes INT DEFAULT 10
)
RETURNS TABLE (acquired BOOLEAN, holder_run_id TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM pipeline_locks
  WHERE client_id = p_client_id AND kind = p_kind AND expires_at < now();

  BEGIN
    INSERT INTO pipeline_locks (client_id, kind, run_id, expires_at)
    VALUES (
      p_client_id, p_kind, p_run_id,
      now() + (p_ttl_minutes::TEXT || ' minutes')::INTERVAL
    );
    RETURN QUERY SELECT TRUE, p_run_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY
      SELECT FALSE, pl.run_id
      FROM pipeline_locks pl
      WHERE pl.client_id = p_client_id AND pl.kind = p_kind;
  END;
END;
$$;

-- Release lock — only the owner (matching run_id) can release.
CREATE OR REPLACE FUNCTION release_pipeline_lock(
  p_client_id TEXT,
  p_kind      TEXT,
  p_run_id    TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM pipeline_locks
  WHERE client_id = p_client_id AND kind = p_kind AND run_id = p_run_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;
