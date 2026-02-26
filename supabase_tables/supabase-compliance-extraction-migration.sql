-- Compliance Extraction Migration
-- Phase 7: Compliance Extraction
-- ADDITIVE migration — creates the compliance_extractions table for storing
-- structured extraction results from solicitation documents.
-- DO NOT drop or modify existing tables.
-- Run this after supabase-solicitation-ingestion-migration.sql.
-- Safe to re-run — uses IF NOT EXISTS throughout.

-----------------------------------------------------------
-- TABLE: compliance_extractions
-- Stores individual extracted data points from solicitation documents.
-- Each row is a single extracted field (e.g., "volume_structure", "naics_code")
-- with its value, confidence score, and source document reference.
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS compliance_extractions (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent solicitation
  solicitation_id     UUID          NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,

  -- The document this extraction came from (nullable — may be synthesized across docs)
  source_document_id  UUID          REFERENCES solicitation_documents(id) ON DELETE SET NULL,

  -- Extraction category
  category            TEXT          NOT NULL
                      CHECK (category IN ('section_l', 'section_m', 'admin_data', 'rating_scales',
                                          'sow_pws', 'cost_price', 'past_performance', 'key_personnel', 'security_reqs')),

  -- Field identifier and display label
  field_name          TEXT          NOT NULL,   -- e.g., "volume_structure", "page_limit_technical", "evaluation_methodology"
  field_label         TEXT          NOT NULL,   -- Human-readable label for display

  -- Flexible value storage (string, number, array, nested object)
  field_value         JSONB,

  -- AI confidence in the extracted value
  confidence          TEXT          NOT NULL DEFAULT 'medium'
                      CHECK (confidence IN ('high', 'medium', 'low')),

  -- User override tracking
  is_user_override    BOOLEAN       DEFAULT false,
  -- Stores the original AI value when the user overrides (for revert)
  original_ai_value   JSONB,

  -- Amendment source tracking (which amendment changed this extraction)
  amendment_source_id UUID          REFERENCES solicitation_documents(id) ON DELETE SET NULL,
  amendment_note      TEXT,         -- e.g., "Updated from Amendment 0003"

  -- Extraction pipeline state for this individual field
  extraction_status   TEXT          NOT NULL DEFAULT 'pending'
                      CHECK (extraction_status IN ('pending', 'extracting', 'completed', 'failed')),
  error_message       TEXT,

  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE compliance_extractions IS
  'Structured compliance data extracted from solicitation documents. '
  'Each row is a single extracted field (Section L, Section M, admin data, rating scales) '
  'with its JSON value, confidence score, and source document reference. '
  'Drives the Tier 2 data call in Phase 8 proposal generation.';

-----------------------------------------------------------
-- INDEXES
-----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_compliance_extractions_solicitation
  ON compliance_extractions(solicitation_id);

CREATE INDEX IF NOT EXISTS idx_compliance_extractions_category
  ON compliance_extractions(solicitation_id, category);

CREATE INDEX IF NOT EXISTS idx_compliance_extractions_source_doc
  ON compliance_extractions(source_document_id);

-----------------------------------------------------------
-- ROW LEVEL SECURITY
-----------------------------------------------------------

ALTER TABLE compliance_extractions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read and write their own company's extraction data
-- (access control enforced at the API layer via solicitation company_id check)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'compliance_extractions_authenticated_policy'
      AND tablename = 'compliance_extractions'
  ) THEN
    CREATE POLICY compliance_extractions_authenticated_policy
      ON compliance_extractions
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
