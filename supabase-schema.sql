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
  "coreOffer" TEXT DEFAULT '',
  "mainGoal" TEXT DEFAULT '',
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

-- Voice Sessions (Content Interview transcripts + generated ideas)
CREATE TABLE voice_sessions (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES configs(id) ON DELETE CASCADE,
  transcript JSONB DEFAULT '[]'::jsonb,
  ideas_generated INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  created_at TEXT
);

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

ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON voice_sessions FOR ALL USING (true);

ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON client_users FOR ALL USING (true);

-- ── Performance indexes ──────────────────────────────────────────────────────
-- Run these in the Supabase SQL Editor. Massive speed-up once tables grow
-- beyond a few hundred rows.
CREATE INDEX IF NOT EXISTS idx_scripts_client_id       ON scripts        (client_id);
CREATE INDEX IF NOT EXISTS idx_scripts_client_created  ON scripts        (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_client_id         ON ideas          (client_id);
CREATE INDEX IF NOT EXISTS idx_ideas_client_created    ON ideas          (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_config_name      ON videos         (config_name);
CREATE INDEX IF NOT EXISTS idx_videos_config_added     ON videos         (config_name, date_added DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_client_id      ON analyses       (client_id);
CREATE INDEX IF NOT EXISTS idx_training_scripts_client ON training_scripts (client_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_client   ON voice_sessions (client_id);
CREATE INDEX IF NOT EXISTS idx_client_users_user_id    ON client_users   (user_id);
