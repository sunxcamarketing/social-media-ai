-- Admin → client release flow + client edit tracking.
-- released_at = NULL  → script is admin-only (draft, not yet shown in portal)
-- released_at = TIMESTAMPTZ → script is visible to client
-- client_edited_at → set whenever the client edits the script in the portal
--
-- Backfill: existing scripts get released_at = created_at so live clients
-- don't suddenly lose access to their already-shared scripts. The new flow
-- only kicks in for scripts created after this migration.

ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_edited_at TIMESTAMPTZ;

UPDATE scripts
SET released_at = COALESCE(NULLIF(created_at, '')::timestamptz, NOW())
WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_scripts_released
  ON scripts (client_id, released_at);
