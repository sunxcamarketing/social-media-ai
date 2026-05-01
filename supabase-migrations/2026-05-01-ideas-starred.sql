-- Per-idea favorite flag. Client toggles a star to push an idea to the top
-- of their list. Default false so existing rows stay unstarred.
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT false;
