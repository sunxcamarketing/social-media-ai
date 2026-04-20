-- Voice onboarding: per-block interview progress + synthesized analysis
-- Storage format: JSON-encoded string (matches voiceProfile / strategyPillars pattern)
-- Shape: { blocks: [{ id, status, summary, quotes[] }], currentBlockId, synthesis, updatedAt }

ALTER TABLE configs ADD COLUMN IF NOT EXISTS "voiceOnboarding" TEXT DEFAULT '';
