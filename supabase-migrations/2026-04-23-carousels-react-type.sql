-- Extend `carousels` to support two carousel flavors:
--   * type = 'html'  — classic pipeline (Claude-HTML + Puppeteer + Nano Banana)
--   * type = 'react' — interactive React component rendered in a sandboxed iframe
--
-- For 'react' rows: tsx_code holds the generated component source, and the
-- classic style_id / handle / slide_count fields are either derived or zero.

ALTER TABLE carousels
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'html';

ALTER TABLE carousels
  ADD COLUMN IF NOT EXISTS tsx_code TEXT;

-- Speeds up the list view filter when the UI segments by type.
CREATE INDEX IF NOT EXISTS idx_carousels_client_type_created
  ON carousels (client_id, type, created_at DESC);
