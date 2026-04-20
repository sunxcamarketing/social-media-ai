-- Add inspiration fields captured during onboarding.
-- Both stored as newline-separated text (one URL/handle per line) for simplicity.

ALTER TABLE configs ADD COLUMN IF NOT EXISTS "inspirationReels"    TEXT DEFAULT '';
ALTER TABLE configs ADD COLUMN IF NOT EXISTS "inspirationProfiles" TEXT DEFAULT '';
