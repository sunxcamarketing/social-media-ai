-- Voice session feedback (2026-05-01)
-- Captures a 1-5 rating and an optional free-text comment from the client
-- after sessions longer than 5 minutes. Three columns so we can later split
-- "rating exists" vs "rating + comment" in analytics, and timestamp the
-- submission independently of the session's created_at.

ALTER TABLE voice_sessions
  ADD COLUMN IF NOT EXISTS feedback_rating INTEGER
    CHECK (feedback_rating IS NULL OR (feedback_rating BETWEEN 1 AND 5));

ALTER TABLE voice_sessions
  ADD COLUMN IF NOT EXISTS feedback_comment TEXT;

ALTER TABLE voice_sessions
  ADD COLUMN IF NOT EXISTS feedback_submitted_at TEXT;
