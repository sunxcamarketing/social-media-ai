-- Client photos: per-client image library. Initially populated by chat
-- uploads in the carousel refine flow. Designed so a future gallery UI
-- can reuse everything without schema changes.
--
-- NOTE: You also need to create a Supabase Storage bucket manually:
--   Dashboard → Storage → New bucket → name: "client-photos" → Public: true
--   Policy: service role full access (default)
-- The bucket is public so iframe <img src="..."> loads work without signed URLs.

CREATE TABLE IF NOT EXISTS client_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   TEXT NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  filename    TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_photos_client_uploaded
  ON client_photos (client_id, uploaded_at DESC);

ALTER TABLE client_photos ENABLE ROW LEVEL SECURITY;
