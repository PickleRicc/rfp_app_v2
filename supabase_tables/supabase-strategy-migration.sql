-- Solicitation Strategies — Proposal Manager strategy layer (Phase 8.5)
-- One row per solicitation + company. Stores win theme priorities, volume-level
-- approach notes, agency intel, and competitive positioning.
-- Draft generation reads this row to inject a strategy brief into every volume prompt.
-- Safe to re-run — uses IF NOT EXISTS / DO $$ blocks.

CREATE TABLE IF NOT EXISTS solicitation_strategies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id       UUID NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL,

  -- Ordered list of win themes — index 0 is highest priority
  -- Pre-populated from company_profiles.enterprise_win_themes, reordered/edited by PM
  win_theme_priorities  TEXT[] NOT NULL DEFAULT '{}',

  -- Free-form agency intelligence: incumbent info, prior protest history, buyer tendencies
  agency_intel          TEXT,

  -- Competitive positioning notes: known competitors, differentiators to stress
  competitive_notes     TEXT,

  -- How aggressively to position: affects tone and claim strength in prompts
  risk_posture          TEXT NOT NULL DEFAULT 'balanced'
                        CHECK (risk_posture IN ('aggressive', 'balanced', 'conservative')),

  -- Array of per-volume strategy objects: VolumeStrategy[]
  -- Each: { volume_name, approach_notes, emphasis_areas[], sme_owner? }
  volume_strategies     JSONB NOT NULL DEFAULT '[]',

  -- Set when PM clicks "Confirm Strategy & Generate"
  confirmed_at          TIMESTAMPTZ,

  -- Staff user who created/last edited the strategy
  created_by            TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(solicitation_id, company_id)
);

-- Index for the primary lookup: fetch strategy for a specific solicitation + company
CREATE INDEX IF NOT EXISTS idx_solicitation_strategies_lookup
  ON solicitation_strategies(solicitation_id, company_id);

-- RLS: tenant isolation
ALTER TABLE solicitation_strategies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'solicitation_strategies' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON solicitation_strategies
      USING (company_id = (current_setting('app.company_id', TRUE))::UUID);
  END IF;
END $$;

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_solicitation_strategies_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitation_strategies_updated_at ON solicitation_strategies;
CREATE TRIGGER solicitation_strategies_updated_at
  BEFORE UPDATE ON solicitation_strategies
  FOR EACH ROW EXECUTE FUNCTION update_solicitation_strategies_updated_at();
