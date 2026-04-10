-- SME Contributions — New table for subject matter expert narrative inputs per solicitation
-- Each row is a free-form content block authored by an SME, linked to a specific proposal volume.
-- Proposal Managers approve entries before they are injected into draft generation.
-- Safe to re-run — uses IF NOT EXISTS / DO $$ blocks.

CREATE TABLE IF NOT EXISTS sme_contributions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id          UUID NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,
  company_id               UUID NOT NULL,
  volume_name              TEXT NOT NULL,         -- e.g. 'Technical Approach', 'Management'
  topic                    TEXT NOT NULL,         -- e.g. 'Zero Trust Architecture'
  content                  TEXT NOT NULL,         -- SME free-form narrative
  contributor_name         TEXT NOT NULL,
  contributor_title        TEXT,
  approved                 BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by              TEXT,                  -- name/email of PM who approved
  approved_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the primary query pattern: fetch all contributions for a solicitation + company
CREATE INDEX IF NOT EXISTS idx_sme_contributions_solicitation
  ON sme_contributions(solicitation_id, company_id);

-- Index for fetching only approved contributions (used by draft generator)
CREATE INDEX IF NOT EXISTS idx_sme_contributions_approved
  ON sme_contributions(solicitation_id, company_id, approved)
  WHERE approved = TRUE;

-- RLS: tenant isolation — company can only see their own contributions
ALTER TABLE sme_contributions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sme_contributions' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON sme_contributions
      USING (company_id = (current_setting('app.company_id', TRUE))::UUID);
  END IF;
END $$;

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_sme_contributions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sme_contributions_updated_at ON sme_contributions;
CREATE TRIGGER sme_contributions_updated_at
  BEFORE UPDATE ON sme_contributions
  FOR EACH ROW EXECUTE FUNCTION update_sme_contributions_updated_at();
