-- Daily post check: one row per client per day. Admin + client both read+write.
CREATE TABLE IF NOT EXISTS daily_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  posted_reel BOOLEAN NOT NULL DEFAULT false,
  posted_stories BOOLEAN NOT NULL DEFAULT false,
  posted_reel_at TIMESTAMPTZ,
  posted_stories_at TIMESTAMPTZ,
  note TEXT DEFAULT '',
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_posts_client_date
  ON daily_posts (client_id, date DESC);

ALTER TABLE daily_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON daily_posts FOR ALL USING (true);
