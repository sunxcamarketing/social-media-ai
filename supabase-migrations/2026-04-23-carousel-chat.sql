-- Carousel chat refinement: after the one-shot generation, users can iterate
-- via chat. Claude can ask follow-up questions OR return a new TSX code.
-- Messages persist per-carousel so tab-switches don't lose state.

ALTER TABLE carousels
  ADD COLUMN IF NOT EXISTS chat_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS chat_status TEXT NOT NULL DEFAULT 'idle';
-- chat_status values: 'idle' | 'generating' | 'error'
-- No CHECK constraint so we can add new states later without migration pain.
