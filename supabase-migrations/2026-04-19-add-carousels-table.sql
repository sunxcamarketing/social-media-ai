-- Persisted carousel runs — so admins can edit/re-download past carousels.
-- run_id is the filesystem directory under output/carousels/<run_id>/.
-- meta holds denormalized counts + token usage for quick display.

CREATE TABLE IF NOT EXISTS carousels (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
  run_id      TEXT NOT NULL UNIQUE,
  topic       TEXT NOT NULL DEFAULT '',
  style_id    TEXT NOT NULL DEFAULT '',
  handle      TEXT NOT NULL DEFAULT '',
  slide_count INTEGER NOT NULL DEFAULT 0,
  meta        JSONB  NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carousels_client_created
  ON carousels (client_id, created_at DESC);

ALTER TABLE carousels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON carousels FOR ALL USING (true);
