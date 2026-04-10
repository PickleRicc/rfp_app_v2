-- Basis of Estimate Assessments — AI-generated independent staffing analysis
-- One row per solicitation + company.
-- Safe to re-run — uses IF NOT EXISTS / DO $$ blocks.

CREATE TABLE IF NOT EXISTS boe_assessments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id       UUID NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL,

  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'generating', 'completed', 'failed')),

  -- Structured outputs (JSONB)
  boe_table             JSONB,              -- BoeTableRow[]
  narrative_markdown    TEXT,
  government_comparison JSONB,             -- GovStaffingComparison[]
  performance_periods   JSONB,             -- ParsedPerformancePeriod[]
  diagram_specs         JSONB,             -- DiagramSpec[] pre-built for draft generation

  -- Summary metrics
  total_fte_proposed    NUMERIC(6,2),
  total_fte_government  NUMERIC(6,2),
  variance_flag         BOOLEAN DEFAULT false,

  -- Quality indicators
  sow_confidence        TEXT CHECK (sow_confidence IN ('high', 'medium', 'low')),
  extraction_field_count INT,

  error_message         TEXT,
  generated_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(solicitation_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_boe_assessments_lookup
  ON boe_assessments(solicitation_id, company_id);

ALTER TABLE boe_assessments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'boe_assessments' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON boe_assessments
      USING (company_id = (current_setting('app.company_id', TRUE))::UUID);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_boe_assessments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS boe_assessments_updated_at ON boe_assessments;
CREATE TRIGGER boe_assessments_updated_at
  BEFORE UPDATE ON boe_assessments
  FOR EACH ROW EXECUTE FUNCTION update_boe_assessments_updated_at();
