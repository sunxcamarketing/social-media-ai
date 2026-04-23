-- Story strategies: one row per generated Instagram Story strategy.
-- Persists history so admin/client can review past campaigns.

CREATE TABLE IF NOT EXISTS story_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_strategies_client_created
  ON story_strategies (client_id, created_at DESC);

ALTER TABLE story_strategies ENABLE ROW LEVEL SECURITY;
