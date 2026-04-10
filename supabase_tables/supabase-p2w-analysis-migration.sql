-- Price-to-Win Analyses — competitive rate benchmarking and cost modeling
-- One row per solicitation + company. Requires completed BOE assessment.
-- Safe to re-run — uses IF NOT EXISTS / DO $$ blocks.

CREATE TABLE IF NOT EXISTS p2w_analyses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id       UUID NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL,
  boe_assessment_id     UUID REFERENCES boe_assessments(id) ON DELETE SET NULL,

  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'generating', 'completed', 'failed')),

  -- Rate benchmark table
  rate_table            JSONB,              -- P2wRateBenchmarkRow[]

  -- Total cost range
  total_cost_low        NUMERIC(14,2),
  total_cost_target     NUMERIC(14,2),
  total_cost_high       NUMERIC(14,2),

  -- IGCE comparison
  igce_value            NUMERIC(14,2),
  igce_comparison_note  TEXT,

  -- Narrative
  narrative_markdown    TEXT,

  -- Source metadata
  bls_data_vintage      TEXT,
  gsa_data_vintage      TEXT,
  geographic_region     TEXT,
  naics_code            TEXT,

  error_message         TEXT,
  generated_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(solicitation_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_p2w_analyses_lookup
  ON p2w_analyses(solicitation_id, company_id);

CREATE INDEX IF NOT EXISTS idx_p2w_analyses_boe
  ON p2w_analyses(boe_assessment_id);

ALTER TABLE p2w_analyses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'p2w_analyses' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON p2w_analyses
      USING (company_id = (current_setting('app.company_id', TRUE))::UUID);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_p2w_analyses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS p2w_analyses_updated_at ON p2w_analyses;
CREATE TRIGGER p2w_analyses_updated_at
  BEFORE UPDATE ON p2w_analyses
  FOR EACH ROW EXECUTE FUNCTION update_p2w_analyses_updated_at();
