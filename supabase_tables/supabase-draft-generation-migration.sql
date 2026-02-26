-- Draft Generation Migration
-- Phase 9: Draft Generation
-- ADDITIVE migration — creates tables for tracking proposal draft generation runs
-- and per-volume outputs (DOCX files, content, page limit status).
-- DO NOT drop or modify existing tables.
-- Run this after supabase-tier2-data-call-migration.sql.
-- Safe to re-run — uses IF NOT EXISTS throughout.

-----------------------------------------------------------
-- TABLE: proposal_drafts
-- One row per solicitation + company draft generation run.
-- Regeneration overwrites the existing row (UNIQUE constraint enforced).
-- Status tracks the overall generation pipeline state.
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS proposal_drafts (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent solicitation
  solicitation_id           UUID        NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,

  -- Company generating the draft (one active draft per solicitation per company)
  company_id                UUID        NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  -- Overall generation state
  status                    TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'generating', 'completed', 'failed')),

  -- Lifecycle timestamps
  strategy_confirmed_at     TIMESTAMPTZ,          -- when user clicked Confirm & Generate
  generation_started_at     TIMESTAMPTZ,          -- when Inngest pipeline began
  generation_completed_at   TIMESTAMPTZ,          -- when all volumes completed

  -- Error details (null unless status = 'failed')
  error_message             TEXT,

  -- Standard timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active draft per solicitation per company — regeneration overwrites
  UNIQUE(solicitation_id, company_id)
);

COMMENT ON TABLE proposal_drafts IS
  'Tracks proposal draft generation runs per solicitation + company. '
  'One row per company per solicitation — regeneration updates the existing row '
  '(strategy_confirmed_at, status, and linked draft_volumes are reset). '
  'Drives the Draft tab UI in Phase 9.';

COMMENT ON COLUMN proposal_drafts.strategy_confirmed_at IS
  'Set when the user clicks Confirm & Generate on the Strategy Confirmation screen. '
  'Marks the moment the user approved the assembled strategy summary and initiated generation.';

COMMENT ON COLUMN proposal_drafts.error_message IS
  'Populated only when status = failed. Contains the first error that caused generation to fail. '
  'Individual volume errors are stored in draft_volumes.error_message.';

-----------------------------------------------------------
-- TABLE: draft_volumes
-- One row per generated volume within a proposal draft.
-- Volume structure is driven by Section L extraction (volume_structure field).
-- Stores generated content as markdown (for in-app preview) and DOCX (for download).
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS draft_volumes (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent draft
  draft_id                  UUID        NOT NULL REFERENCES proposal_drafts(id) ON DELETE CASCADE,

  -- Volume identity — matches Section L volume name
  volume_name               TEXT        NOT NULL,  -- e.g., "Technical Approach", "Management"
  volume_order              INT         NOT NULL,  -- display order from Section L

  -- Generation state
  status                    TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'generating', 'completed', 'failed')),

  -- Content metrics
  word_count                INT,                   -- actual word count of generated content
  page_estimate             NUMERIC(5,1),          -- estimated pages (word_count / 250 heuristic)

  -- Page limit tracking (sourced from Section L extraction)
  page_limit                INT,                   -- RFP page limit for this volume (null if none specified)
  page_limit_status         TEXT                   -- color-coded compliance status
                            CHECK (page_limit_status IN ('under', 'warning', 'over')),

  -- Storage
  file_path                 TEXT,                  -- Supabase storage path to generated DOCX
  content_markdown          TEXT,                  -- raw markdown for in-app preview

  -- Error tracking (null unless status = 'failed')
  error_message             TEXT,

  -- Lifecycle timestamps
  generation_started_at     TIMESTAMPTZ,
  generation_completed_at   TIMESTAMPTZ,

  -- Standard timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE draft_volumes IS
  'Per-volume outputs for a proposal draft generation run. '
  'One row per volume (Technical Approach, Management, Past Performance, Cost/Price) '
  'within a proposal_drafts record. Volume structure is driven by Section L extraction. '
  'Stores generated DOCX path in Supabase storage and markdown for in-app preview.';

COMMENT ON COLUMN draft_volumes.volume_name IS
  'Matches the volume name from Section L extraction volume_structure field. '
  'Examples: "Technical Approach", "Management", "Past Performance", "Cost/Price".';

COMMENT ON COLUMN draft_volumes.page_limit_status IS
  'Color-coded page compliance status computed at generation time. '
  'under = below 85% of limit (green), warning = 85-100% (yellow), over = exceeded (red). '
  'Null when page_limit is not specified for this volume.';

COMMENT ON COLUMN draft_volumes.content_markdown IS
  'Raw markdown content of the generated volume — used for in-app preview rendering. '
  'The DOCX file at file_path is the canonical submission artifact.';

-----------------------------------------------------------
-- INDEXES
-----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_proposal_drafts_solicitation_company
  ON proposal_drafts(solicitation_id, company_id);

CREATE INDEX IF NOT EXISTS idx_proposal_drafts_solicitation
  ON proposal_drafts(solicitation_id);

CREATE INDEX IF NOT EXISTS idx_draft_volumes_draft_order
  ON draft_volumes(draft_id, volume_order);

CREATE INDEX IF NOT EXISTS idx_draft_volumes_draft_id
  ON draft_volumes(draft_id);

-----------------------------------------------------------
-- ROW LEVEL SECURITY
-----------------------------------------------------------

ALTER TABLE proposal_drafts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read and write draft records
-- (access control enforced at the API layer via solicitation company_id check)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'proposal_drafts_authenticated_policy'
      AND tablename = 'proposal_drafts'
  ) THEN
    CREATE POLICY proposal_drafts_authenticated_policy
      ON proposal_drafts
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE draft_volumes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read and write draft volume records
-- (access control enforced at the API layer via draft -> proposal_drafts company_id check)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'draft_volumes_authenticated_policy'
      AND tablename = 'draft_volumes'
  ) THEN
    CREATE POLICY draft_volumes_authenticated_policy
      ON draft_volumes
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
