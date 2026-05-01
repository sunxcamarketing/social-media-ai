-- New script-level fields for richer per-script production data:
-- visual_hook  → what visually happens in the first 3 seconds (scene/cut)
-- b_roll       → list of B-roll shots to film (newline-separated bullets)
-- caption      → Instagram caption / video description with hashtags
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS visual_hook TEXT DEFAULT '';
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS b_roll TEXT DEFAULT '';
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS caption TEXT DEFAULT '';
