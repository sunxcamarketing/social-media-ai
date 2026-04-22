-- Add user_id to api_costs so we can split admin costs by which admin user
-- triggered the call. Nullable — background jobs (cron) have no user.

ALTER TABLE api_costs ADD COLUMN IF NOT EXISTS user_id uuid;

-- Index for the per-user aggregation queries on the /costs page.
CREATE INDEX IF NOT EXISTS api_costs_user_id_idx ON api_costs(user_id);
CREATE INDEX IF NOT EXISTS api_costs_user_created_idx ON api_costs(user_id, created_at DESC);
