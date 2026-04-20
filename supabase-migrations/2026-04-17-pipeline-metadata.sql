-- ═══════════════════════════════════════════════════════════════════════
--  2026-04-17 — Weekly pipeline metadata + semantic embeddings
--
--  Adds the five new pipeline fields to the scripts table (pattern_type,
--  post_type, anchor_ref, cta_type, funnel_stage) and sets up pgvector
--  with a script_embeddings table so the semantic duplicate check in
--  weekly-steps can move from in-memory to persisted lookups.
--
--  Run this in Supabase → SQL Editor. It is idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. New columns on scripts (nullable, backwards-compatible) ────────────
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS pattern_type TEXT DEFAULT '';
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS post_type    TEXT DEFAULT '';
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS anchor_ref   TEXT DEFAULT '';
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS cta_type     TEXT DEFAULT '';
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS funnel_stage TEXT DEFAULT '';

COMMENT ON COLUMN scripts.pattern_type IS 'Story pattern: STORY | HOW_TO | MISTAKES | PROOF | HOT_TAKE';
COMMENT ON COLUMN scripts.post_type    IS '70/20/10 bucket: core | variant | test';
COMMENT ON COLUMN scripts.anchor_ref   IS 'Winner video/learning title this post is anchored to (core/variant only)';
COMMENT ON COLUMN scripts.cta_type     IS 'CTA funnel role: soft | lead | authority | none';
COMMENT ON COLUMN scripts.funnel_stage IS 'Funnel stage: TOF | MOF | BOF';

-- ── 2. pgvector extension for semantic similarity on titles ───────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 3. script_embeddings — one 768-dim vector per script title ────────────
-- Gemini text-embedding-004 outputs 768 dimensions.
CREATE TABLE IF NOT EXISTS script_embeddings (
  script_id TEXT PRIMARY KEY REFERENCES scripts(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  title     TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_script_embeddings_client
  ON script_embeddings (client_id);

-- IVFFlat index for cosine distance — fast ANN search once table has rows.
-- If list count is too low it falls back to sequential scan (still correct).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_script_embeddings_cosine'
  ) THEN
    EXECUTE 'CREATE INDEX idx_script_embeddings_cosine
             ON script_embeddings
             USING ivfflat (embedding vector_cosine_ops)
             WITH (lists = 50)';
  END IF;
END $$;

-- ── 4. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE script_embeddings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'script_embeddings'
      AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access"
      ON script_embeddings FOR ALL USING (true);
  END IF;
END $$;

-- ── 5. Cosine-similarity helper function ──────────────────────────────────
-- Returns nearest N scripts (by cosine distance) for a given client.
CREATE OR REPLACE FUNCTION match_script_titles(
  query_embedding vector(768),
  match_client_id TEXT,
  match_threshold FLOAT DEFAULT 0.85,
  match_count     INT   DEFAULT 10
)
RETURNS TABLE (
  script_id  TEXT,
  title      TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    se.script_id,
    se.title,
    1 - (se.embedding <=> query_embedding) AS similarity
  FROM script_embeddings se
  WHERE se.client_id = match_client_id
    AND 1 - (se.embedding <=> query_embedding) >= match_threshold
  ORDER BY se.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;
