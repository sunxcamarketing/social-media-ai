-- Client-facing feedback on generated scripts.
-- Status: approved = thumbs up, rejected = thumbs down, revision_requested = change request.
-- Text captures the reason for rejected/revision_requested.

ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS client_feedback_status TEXT
    CHECK (client_feedback_status IN ('approved', 'rejected', 'revision_requested')),
  ADD COLUMN IF NOT EXISTS client_feedback_text TEXT,
  ADD COLUMN IF NOT EXISTS client_feedback_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scripts_feedback_status
  ON scripts (client_id, client_feedback_status);
