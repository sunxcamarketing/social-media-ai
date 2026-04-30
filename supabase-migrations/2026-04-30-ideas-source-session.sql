-- Link an idea back to the voice_sessions row it was extracted from.
-- The script-generation pipeline will use this to pull the original
-- transcript and write scripts from the client's actual spoken words
-- instead of the idea's compact description.
--
-- Both ideas.id and voice_sessions.id are TEXT (not UUID) — the FK
-- column type must match.
ALTER TABLE ideas
  ADD COLUMN IF NOT EXISTS source_session_id TEXT REFERENCES voice_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ideas_source_session_id ON ideas(source_session_id);
