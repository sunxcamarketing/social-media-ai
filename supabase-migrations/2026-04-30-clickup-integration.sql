-- Per-client ClickUp connection: target list where new script cards land.
-- The API token is agency-wide and lives in env (CLICKUP_API_TOKEN), so
-- clients only need a list id.
-- Column name uses camelCase (with quotes) to match existing configs columns.
ALTER TABLE configs ADD COLUMN IF NOT EXISTS "clickupListId" TEXT DEFAULT '';

-- Per-script idempotency anchor: stores the ClickUp task id once a card
-- has been created so we can update instead of duplicating on re-trigger.
-- scripts table uses snake_case so this stays snake_case.
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS clickup_card_id TEXT DEFAULT '';
