-- Add language column to configs table.
-- Drives pipeline language selection: content-generation, chat, voice all
-- read this field to decide whether to output German or English.
-- Existing rows default to 'de' so nothing changes for current clients.

ALTER TABLE configs ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'de';
