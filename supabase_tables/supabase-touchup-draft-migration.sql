-- Touchup Draft Migration
-- Phase 10: Touchup / Compliance Scoring & Rewrite
-- ADDITIVE migration — creates tables for tracking touchup analysis runs
-- (compliance scoring, gap analysis, rewrite) that sit downstream of Phase 9 draft generation.
-- DO NOT drop or modify existing tables.
-- Run this after supabase-draft-generation-migration.sql.
-- Safe to re-run — uses IF NOT EXISTS throughout.

-----------------------------------------------------------
-- TABLE: touchup_analyses
-- One row per proposal draft touchup run.
-- Links to a completed proposal_drafts record.
-- Tracks three phases: scoring, rewriting, and finalization.
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS touchup_analyses (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent draft (must be completed before touchup can run)
  draft_id                  UUID        NOT NULL REFERENCES proposal_drafts(id) ON DELETE CASCADE,

  -- Denormalized for query convenience
  solicitation_id           UUID        NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,
  company_id                UUID        NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  -- Overall touchup pipeline state
  status                    TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'scoring', 'rewriting', 'completed', 'failed')),

  -- Aggregate compliance metrics (populated after scoring phase)
  overall_compliance_score  INT,                   -- 0-100 weighted average across volumes
  total_gaps                INT,                   -- sum of all gaps across volumes
  total_gaps_resolved       INT,                   -- gaps filled by rewrite
  human_inputs_required     INT,                   -- count of [HUMAN INPUT REQUIRED] markers

  -- Phase lifecycle timestamps
  scoring_started_at        TIMESTAMPTZ,
  scoring_completed_at      TIMESTAMPTZ,
  rewriting_started_at      TIMESTAMPTZ,
  rewriting_completed_at    TIMESTAMPTZ,

  -- Error details (null unless status = 'failed')
  error_message             TEXT,

  -- Standard timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One touchup per draft — re-run overwrites
  UNIQUE(draft_id)
);

COMMENT ON TABLE touchup_analyses IS
  'Tracks touchup analysis runs for a proposal draft. '
  'Phase A scores each volume against compliance requirements and source data. '
  'Phase B rewrites volumes to fill gaps. Phase C regression-guards the output. '
  'One row per draft — re-running touchup overwrites the existing row.';

COMMENT ON COLUMN touchup_analyses.overall_compliance_score IS
  'Weighted average of per-volume compliance scores (0-100). '
  'Computed from touchup_volumes.compliance_score values after scoring phase.';

COMMENT ON COLUMN touchup_analyses.human_inputs_required IS
  'Total count of [HUMAN INPUT REQUIRED] markers across all touchup volumes. '
  'These are items where the AI exhausted all source data and needs human input.';

-----------------------------------------------------------
-- TABLE: touchup_volumes
-- One row per volume in a touchup analysis.
-- Stores Phase A scoring results, Phase B rewritten content,
-- and Phase C regression guard outcomes.
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS touchup_volumes (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent touchup analysis
  touchup_id                UUID        NOT NULL REFERENCES touchup_analyses(id) ON DELETE CASCADE,

  -- Link to the original first-draft volume
  original_volume_id        UUID        NOT NULL REFERENCES draft_volumes(id) ON DELETE CASCADE,

  -- Volume identity (copied from draft_volumes for convenience)
  volume_name               TEXT        NOT NULL,
  volume_order              INT         NOT NULL,

  -- Touchup pipeline state for this volume
  status                    TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'scoring', 'rewriting', 'completed', 'failed')),

  -- Phase A: Compliance scoring results
  compliance_score          INT,                   -- 0-100 score of the FIRST draft
  touchup_score             INT,                   -- 0-100 score after touchup (self-assessed)
  gap_analysis              JSONB,                 -- structured gap report (requirements, data verification, etc.)
  fabrication_flags         JSONB,                 -- claims not backed by any source data
  placeholder_count         INT,                   -- count of [PLACEHOLDER] markers in first draft
  human_input_count         INT,                   -- count of [HUMAN INPUT REQUIRED] in touchup

  -- Phase B + C: Rewritten content (after regression guard assembly)
  content_markdown          TEXT,                  -- final assembled markdown
  file_path                 TEXT,                  -- Supabase storage path to DOCX
  word_count                INT,
  page_estimate             NUMERIC(5,1),
  page_limit                INT,                   -- from first draft volume
  page_limit_status         TEXT
                            CHECK (page_limit_status IN ('under', 'warning', 'over')),

  -- Phase C: Regression guard audit trail
  regression_reversions     JSONB,                 -- sections where Draft 1 was kept over Touchup

  -- Error tracking
  error_message             TEXT,

  -- Phase lifecycle timestamps
  scoring_started_at        TIMESTAMPTZ,
  scoring_completed_at      TIMESTAMPTZ,
  rewriting_started_at      TIMESTAMPTZ,
  rewriting_completed_at    TIMESTAMPTZ,

  -- Standard timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE touchup_volumes IS
  'Per-volume touchup results. Phase A populates compliance_score and gap_analysis. '
  'Phase B rewrites the volume to fill gaps. Phase C regression-guards section by section. '
  'content_markdown contains the final assembled best-of-both-versions output.';

COMMENT ON COLUMN touchup_volumes.compliance_score IS
  'Compliance score (0-100) of the FIRST draft volume, computed by Phase A scoring. '
  'Reflects how well the first draft covers requirements, uses accurate data, and follows compliance language.';

COMMENT ON COLUMN touchup_volumes.touchup_score IS
  'Compliance score (0-100) of the touchup version, self-assessed after rewrite. '
  'Used alongside compliance_score for before/after comparison in the UI.';

COMMENT ON COLUMN touchup_volumes.gap_analysis IS
  'Structured JSON gap report from Phase A scoring. Contains: '
  'requirements_coverage, data_verification, missing_content, placeholder_items, compliance_language_issues.';

COMMENT ON COLUMN touchup_volumes.regression_reversions IS
  'Audit trail from Phase C regression guard. Lists sections where the original Draft 1 '
  'version was kept because it scored higher than the touchup rewrite. '
  'Null when no reversions occurred (touchup was better or equal everywhere).';

-----------------------------------------------------------
-- INDEXES
-----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_touchup_analyses_draft
  ON touchup_analyses(draft_id);

CREATE INDEX IF NOT EXISTS idx_touchup_analyses_solicitation_company
  ON touchup_analyses(solicitation_id, company_id);

CREATE INDEX IF NOT EXISTS idx_touchup_volumes_touchup_order
  ON touchup_volumes(touchup_id, volume_order);

CREATE INDEX IF NOT EXISTS idx_touchup_volumes_touchup_id
  ON touchup_volumes(touchup_id);

-----------------------------------------------------------
-- ROW LEVEL SECURITY
-----------------------------------------------------------

ALTER TABLE touchup_analyses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'touchup_analyses_authenticated_policy'
      AND tablename = 'touchup_analyses'
  ) THEN
    CREATE POLICY touchup_analyses_authenticated_policy
      ON touchup_analyses
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE touchup_volumes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'touchup_volumes_authenticated_policy'
      AND tablename = 'touchup_volumes'
  ) THEN
    CREATE POLICY touchup_volumes_authenticated_policy
      ON touchup_volumes
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
