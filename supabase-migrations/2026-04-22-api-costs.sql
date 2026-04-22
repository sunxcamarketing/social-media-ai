-- API cost tracking: one row per LLM/API call with computed USD cost.
-- Admin-only view; rows separate admin-initiated from client-initiated usage.

CREATE TABLE IF NOT EXISTS api_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  model TEXT,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  cache_read_tokens INT DEFAULT 0,
  cache_write_tokens INT DEFAULT 0,
  cost_usd NUMERIC(12, 6) NOT NULL,
  initiator TEXT NOT NULL CHECK (initiator IN ('admin', 'client')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_costs_created          ON api_costs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_costs_client_created   ON api_costs (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_costs_initiator        ON api_costs (initiator, created_at DESC);

ALTER TABLE api_costs ENABLE ROW LEVEL SECURITY;
