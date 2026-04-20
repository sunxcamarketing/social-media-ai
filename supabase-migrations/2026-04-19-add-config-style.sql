-- Add visual style fields to configs table.
-- Captured during client onboarding: brand vibe, color palette, fonts.
-- Used downstream for carousel/thumbnail generation and brand consistency.

ALTER TABLE configs ADD COLUMN IF NOT EXISTS "styleVibe" TEXT DEFAULT '';
ALTER TABLE configs ADD COLUMN IF NOT EXISTS "colorPalette" TEXT DEFAULT '';
ALTER TABLE configs ADD COLUMN IF NOT EXISTS "fontStyle" TEXT DEFAULT '';
ALTER TABLE configs ADD COLUMN IF NOT EXISTS "customFonts" TEXT DEFAULT '';
