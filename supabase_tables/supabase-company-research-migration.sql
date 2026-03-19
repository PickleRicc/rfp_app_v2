-- Company Research / Intel Migration
-- Phase: Pre-Sales Research Feature
-- ADDITIVE migration — creates a table for storing company intel reports.
-- Safe to re-run — uses IF NOT EXISTS.
--
-- NOTE: This is a free-form research tool for companies we're prospecting.
-- company_id is OPTIONAL — most research will be on companies NOT yet in our system.
-- The search_company_name + optional CAGE/UEI are the primary identifiers.

-----------------------------------------------------------
-- TABLE: company_research
-- Stores pre-sales intelligence reports combining data from
-- USASpending.gov, Perplexity AI, and SAM.gov opportunity matching.
-- One row per research run. company_id is optional (nullable).
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS company_research (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The company being researched (free-form — may not exist in our system)
  search_company_name     TEXT        NOT NULL,
  search_cage_code        TEXT,
  search_uei              TEXT,

  -- Optional link to existing company profile (NULL for external/prospective companies)
  company_id              UUID        REFERENCES company_profiles(id) ON DELETE SET NULL,

  -- Who triggered the research
  triggered_by            UUID        NOT NULL REFERENCES auth.users(id),

  -- Processing state
  status                  TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'researching', 'complete', 'failed')),

  -- Perplexity AI web research results
  perplexity_report       JSONB,

  -- USASpending.gov contract history
  spending_report         JSONB,

  -- SAM.gov opportunity matches
  matched_opportunities   JSONB,

  -- AI-synthesized briefing
  executive_briefing      TEXT,
  key_talking_points      TEXT[],
  recommended_services    TEXT[],

  -- Error tracking
  error_message           TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE company_research IS
  'Pre-sales company intelligence reports for prospecting. Free-form search '
  'on ANY company (not limited to our platform). Combines USASpending contract '
  'history, Perplexity AI web research, and SAM.gov opportunity matching '
  'into actionable briefings for sales calls.';

-----------------------------------------------------------
-- INDEXES
-----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_company_research_name
  ON company_research(search_company_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_company_research_triggered_by
  ON company_research(triggered_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_company_research_status
  ON company_research(status);

-----------------------------------------------------------
-- ROW LEVEL SECURITY
-- Staff-only feature — only authenticated staff can access
-----------------------------------------------------------

ALTER TABLE company_research ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_access" ON company_research;
CREATE POLICY "staff_access" ON company_research
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-----------------------------------------------------------
-- UPDATED_AT TRIGGER
-----------------------------------------------------------

CREATE OR REPLACE FUNCTION update_company_research_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_company_research_updated_at ON company_research;
CREATE TRIGGER trg_company_research_updated_at
  BEFORE UPDATE ON company_research
  FOR EACH ROW
  EXECUTE FUNCTION update_company_research_updated_at();
