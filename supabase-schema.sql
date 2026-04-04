-- Configs (clients) — camelCase columns to match TypeScript interface
CREATE TABLE configs (
  id TEXT PRIMARY KEY,
  "configName" TEXT DEFAULT '',
  "creatorsCategory" TEXT DEFAULT '',t
  name TEXT DEFAULT '',
  company TEXT DEFAULT '',
  role TEXT DEFAULT '',
  location TEXT DEFAULT '',
  "businessContext" TEXT DEFAULT '',
  "professionalBackground" TEXT DEFAULT '',
  "keyAchievements" TEXT DEFAULT '',
  website TEXT DEFAULT '',
  instagram TEXT DEFAULT '',
  tiktok TEXT DEFAULT '',
  youtube TEXT DEFAULT '',
  linkedin TEXT DEFAULT '',
  twitter TEXT DEFAULT '',
  "strategyGoal" TEXT DEFAULT '',
  "strategyPillars" TEXT DEFAULT '',
  "strategyWeekly" TEXT DEFAULT '',
  "performanceInsights" TEXT DEFAULT '',
  "postsPerWeek" TEXT DEFAULT '',
  "brandFeeling" TEXT DEFAULT '',
  "brandProblem" TEXT DEFAULT '',
  "brandingStatement" TEXT DEFAULT '',
  "humanDifferentiation" TEXT DEFAULT '',
  "dreamCustomer" TEXT DEFAULT '',
  "customerProblems" TEXT DEFAULT '',
  "providerRole" TEXT DEFAULT '',
  "providerBeliefs" TEXT DEFAULT '',
  "providerStrengths" TEXT DEFAULT '',
  "authenticityZone" TEXT DEFAULT '',
  "igFullName" TEXT DEFAULT '',
  "igBio" TEXT DEFAULT '',
  "igFollowers" TEXT DEFAULT '',
  "igFollowing" TEXT DEFAULT '',
  "igPostsCount" TEXT DEFAULT '',
  "igProfilePicUrl" TEXT DEFAULT '',
  "igCategory" TEXT DEFAULT '',
  "igVerified" TEXT DEFAULT '',
  "igLastUpdated" TEXT DEFAULT '',
  "voiceProfile" TEXT DEFAULT '',
  "scriptStructure" TEXT DEFAULT '',
  "googleDriveFolder" TEXT DEFAULT '',
  "targetPlatforms" TEXT DEFAULT '["instagram"]'
);

-- Creators
CREATE TABLE creators (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  category TEXT DEFAULT '',
  profile_pic_url TEXT DEFAULT '',
  followers INTEGER DEFAULT 0,
  reels_count_30d INTEGER DEFAULT 0,
  avg_views_30d INTEGER DEFAULT 0,
  platform TEXT DEFAULT 'instagram',
  last_scraped_at TEXT
);

-- Videos
CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  link TEXT DEFAULT '',
  thumbnail TEXT DEFAULT '',
  creator TEXT DEFAULT '',
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  analysis TEXT DEFAULT '',
  new_concepts TEXT DEFAULT '',
  date_posted TEXT,
  date_added TEXT,
  config_name TEXT DEFAULT '',
  platform TEXT DEFAULT 'instagram',
  starred BOOLEAN DEFAULT FALSE
);

-- Scripts
CREATE TABLE scripts (
  id TEXT PRIMARY KEY,
  client_id TEXT DEFAULT '',
  title TEXT DEFAULT '',
  pillar TEXT DEFAULT '',
  content_type TEXT DEFAULT '',
  format TEXT DEFAULT '',
  hook TEXT DEFAULT '',
  hook_pattern TEXT DEFAULT '',
  text_hook TEXT DEFAULT '',
  body TEXT DEFAULT '',
  cta TEXT DEFAULT '',
  status TEXT DEFAULT 'entwurf',
  source TEXT DEFAULT '',
  shot_list TEXT DEFAULT '',
  platform TEXT DEFAULT 'instagram',
  created_at TEXT
);

-- Ideas
CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  client_id TEXT DEFAULT '',
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  content_type TEXT DEFAULT '',
  status TEXT DEFAULT '',
  created_at TEXT
);

-- Training Scripts
CREATE TABLE training_scripts (
  id TEXT PRIMARY KEY,
  client_id TEXT DEFAULT '',
  format TEXT DEFAULT '',
  text_hook TEXT DEFAULT '',
  visual_hook TEXT DEFAULT '',
  audio_hook TEXT DEFAULT '',
  script TEXT DEFAULT '',
  cta TEXT DEFAULT '',
  source_id TEXT DEFAULT NULL,
  created_at TEXT
);

-- Analyses
CREATE TABLE analyses (
  id TEXT PRIMARY KEY,
  client_id TEXT DEFAULT '',
  instagram_handle TEXT DEFAULT '',
  lang TEXT DEFAULT '',
  report TEXT DEFAULT '',
  profile_followers INTEGER DEFAULT 0,
  profile_reels_30d INTEGER DEFAULT 0,
  profile_avg_views_30d INTEGER DEFAULT 0,
  profile_pic_url TEXT DEFAULT '',
  created_at TEXT
);

-- Strategy Config (single-row JSON store)
CREATE TABLE strategy_config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  config JSONB DEFAULT '{}'::jsonb
);

-- Client-User Zuordnung & Rollen
-- Admins: client_id ist NULL (haben Zugriff auf alles)
-- Clients: client_id ist gesetzt (haben nur Zugriff auf diesen Client)
CREATE TABLE IF NOT EXISTS client_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES configs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client')) DEFAULT 'client',
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(user_id, client_id)
);

-- Aysun als Admin eintragen (nach dem ersten Login manuell):
-- INSERT INTO client_users (user_id, role, client_id) VALUES ('<aysun-auth-id>', 'admin', NULL);

-- Enable RLS and allow service role full access
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON configs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON creators FOR ALL USING (true);
CREATE POLICY "Service role full access" ON videos FOR ALL USING (true);
CREATE POLICY "Service role full access" ON scripts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON ideas FOR ALL USING (true);
CREATE POLICY "Service role full access" ON training_scripts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON analyses FOR ALL USING (true);
CREATE POLICY "Service role full access" ON strategy_config FOR ALL USING (true);

ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON client_users FOR ALL USING (true);

-- Intelligence Snapshots (background research results)
CREATE TABLE intelligence_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('competitor_refresh', 'web_trends', 'performance_feedback')),
  platform TEXT DEFAULT 'instagram',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_snapshots_lookup
  ON intelligence_snapshots(client_id, type, platform, created_at DESC);

ALTER TABLE intelligence_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON intelligence_snapshots FOR ALL USING (true);

-- Client Learnings (confidence-scored insights from performance data)
CREATE TABLE client_learnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'hook_pattern', 'content_type', 'format', 'pillar', 'duration', 'topic_angle'
  )),
  value TEXT NOT NULL,
  insight TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('positive', 'negative')),
  data_points INTEGER NOT NULL DEFAULT 0,
  supporting_points INTEGER NOT NULL DEFAULT 0,
  metric_name TEXT NOT NULL DEFAULT 'views',
  metric_avg NUMERIC,
  metric_baseline NUMERIC,
  confidence NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_data_at TIMESTAMPTZ,
  UNIQUE(client_id, category, value, metric_name)
);

CREATE INDEX idx_learnings_client ON client_learnings(client_id, confidence DESC);

ALTER TABLE client_learnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON client_learnings FOR ALL USING (true);
