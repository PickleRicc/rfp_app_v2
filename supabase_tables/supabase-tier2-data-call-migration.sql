-- Tier 2 Data Call Migration
-- Phase 8: Tier 2 Dynamic Data Call
-- ADDITIVE migration — creates tables for storing per-solicitation data call responses
-- and uploaded supporting files (resumes, certifications, LOCs, attachments).
-- DO NOT drop or modify existing tables.
-- Run this after supabase-compliance-extraction-migration.sql.
-- Safe to re-run — uses IF NOT EXISTS throughout.

-----------------------------------------------------------
-- TABLE: data_call_responses
-- Stores one row per solicitation + company data call state.
-- The form_schema column caches the generated schema for fast reload.
-- Each section (opportunity_details, past_performance, etc.) stores
-- structured JSONB matching the TypeScript interfaces in tier2-types.ts.
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS data_call_responses (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent solicitation
  solicitation_id         UUID        NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,

  -- Company filling out the data call (one response per solicitation per company)
  company_id              UUID        NOT NULL,

  -- Completion state
  status                  TEXT        NOT NULL DEFAULT 'in_progress'
                          CHECK (status IN ('in_progress', 'completed')),

  -- Section 1: Opportunity Details
  -- { prime_or_sub, teaming_partners, contract_type, naics_code, size_standard, set_aside }
  opportunity_details     JSONB       DEFAULT '{}',

  -- Section 2: Past Performance
  -- Array of reference objects: [{ project_name, client_agency, contract_number, ... }]
  past_performance        JSONB       DEFAULT '[]',

  -- Section 3: Key Personnel
  -- Array of personnel objects: [{ role, name, qualifications_summary, resume_file_id, ... }]
  key_personnel           JSONB       DEFAULT '[]',

  -- Section 4: Technical Approach
  -- { approach_summary, tools_and_platforms, staffing_model, assumptions, risks }
  technical_approach      JSONB       DEFAULT '{}',

  -- Section 5: Compliance Verification
  -- { org_certifications, individual_certifications, facility_clearance_confirmed, nist_800_171_score, required_attachments }
  compliance_verification JSONB       DEFAULT '{}',

  -- Cached generated form schema — avoids regenerating on every page load
  -- Set when the data call is first loaded and refreshed when extractions change
  form_schema             JSONB,

  -- Completion tracking
  completed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One data call response per solicitation per company
  UNIQUE(solicitation_id, company_id)
);

COMMENT ON TABLE data_call_responses IS
  'Per-solicitation data call intake responses for proposal preparation. '
  'Each row stores one company''s responses for a specific solicitation, organized '
  'by section (opportunity details, past performance, key personnel, technical approach, '
  'compliance verification). Drives the Tier 2 intake form in Phase 8.';

COMMENT ON COLUMN data_call_responses.form_schema IS
  'Cached form schema generated from compliance_extractions. Cached here for fast reload '
  'so the UI does not need to regenerate the schema on every page visit.';

-----------------------------------------------------------
-- TABLE: data_call_files
-- Stores uploaded files associated with specific data call response fields.
-- Each file is linked to a specific section + field_key within a data call response.
-- Storage path: {company_id}/{solicitation_id}/{section}/{field_key}/{filename}
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS data_call_files (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent data call response
  data_call_response_id   UUID        NOT NULL REFERENCES data_call_responses(id) ON DELETE CASCADE,

  -- Which section this file belongs to
  section                 TEXT        NOT NULL
                          CHECK (section IN ('past_performance', 'key_personnel', 'compliance_verification')),

  -- Which specific field within the section this file is attached to
  -- e.g., 'personnel_0_resume', 'personnel_1_loc', 'org_cert_iso', 'attachment_sf330'
  field_key               TEXT        NOT NULL,

  -- File metadata
  filename                TEXT        NOT NULL,
  file_path               TEXT        NOT NULL,  -- Supabase storage path
  file_size               INTEGER,               -- bytes
  mime_type               TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE data_call_files IS
  'Files uploaded as part of a Tier 2 data call response. '
  'Each file is linked to a specific section (past_performance, key_personnel, compliance_verification) '
  'and field_key within that section. Files are stored in Supabase storage bucket ''data-call-files''.';

COMMENT ON COLUMN data_call_files.field_key IS
  'Identifies which specific field this file belongs to. '
  'Convention: {entity}_{index}_{type}, e.g., ''personnel_0_resume'', ''personnel_1_loc'', '
  '''org_cert_iso'', ''attachment_sf330''.';

-----------------------------------------------------------
-- INDEXES
-----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_data_call_responses_company
  ON data_call_responses(company_id, solicitation_id);

CREATE INDEX IF NOT EXISTS idx_data_call_responses_solicitation
  ON data_call_responses(solicitation_id);

CREATE INDEX IF NOT EXISTS idx_data_call_files_response
  ON data_call_files(data_call_response_id, section);

CREATE INDEX IF NOT EXISTS idx_data_call_files_response_id
  ON data_call_files(data_call_response_id);

-----------------------------------------------------------
-- ROW LEVEL SECURITY
-----------------------------------------------------------

ALTER TABLE data_call_responses ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read and write their own company's data call responses
-- (access control enforced at the API layer via solicitation company_id check)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'data_call_responses_authenticated_policy'
      AND tablename = 'data_call_responses'
  ) THEN
    CREATE POLICY data_call_responses_authenticated_policy
      ON data_call_responses
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE data_call_files ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read and write their own company's uploaded files
-- (access control enforced at the API layer via data_call_response company_id check)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'data_call_files_authenticated_policy'
      AND tablename = 'data_call_files'
  ) THEN
    CREATE POLICY data_call_files_authenticated_policy
      ON data_call_files
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
