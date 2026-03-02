-- Touchup Volume Versions Migration
-- Adds version history tracking for touchup scoring and rewriting iterations.
-- Each re-score or rewrite snapshots the previous state before overwriting.
-- Run after supabase-touchup-v2-migration.sql.
-- Safe to re-run.

-----------------------------------------------------------
-- TABLE: touchup_volume_versions
-- Immutable snapshots of previous scoring/rewriting states.
-- Created by snapshotVersion() before any overwrite.
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS touchup_volume_versions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  touchup_volume_id     UUID        NOT NULL REFERENCES touchup_volumes(id) ON DELETE CASCADE,
  version_number        INT         NOT NULL,

  action                TEXT        NOT NULL CHECK (action IN ('scored', 'rewritten')),
  score_version         TEXT        CHECK (score_version IN ('draft', 'touchup')),

  -- Scoring snapshot
  compliance_score      INT,
  gap_analysis          JSONB,
  fabrication_flags     JSONB,
  placeholder_count     INT,

  -- Rewrite snapshot
  content_markdown      TEXT,
  file_path             TEXT,
  word_count            INT,
  page_estimate         NUMERIC(5,1),
  page_limit_status     TEXT        CHECK (page_limit_status IN ('under', 'warning', 'over')),
  human_input_count     INT,
  regression_reversions JSONB,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-----------------------------------------------------------
-- Add version_number to touchup_volumes
-----------------------------------------------------------

ALTER TABLE touchup_volumes
  ADD COLUMN IF NOT EXISTS version_number INT NOT NULL DEFAULT 1;

-----------------------------------------------------------
-- INDEXES
-----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_touchup_vol_versions_volume
  ON touchup_volume_versions(touchup_volume_id, version_number DESC);

-----------------------------------------------------------
-- ROW LEVEL SECURITY
-----------------------------------------------------------

ALTER TABLE touchup_volume_versions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'touchup_volume_versions_authenticated_policy'
      AND tablename = 'touchup_volume_versions'
  ) THEN
    CREATE POLICY touchup_volume_versions_authenticated_policy
      ON touchup_volume_versions
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
