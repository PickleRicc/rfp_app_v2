-- Tier 1 Enterprise Intake Migration
-- Phase 5: Tier 1 Enterprise Intake
-- ADDITIVE migration only — adds new columns to company_profiles.
-- DO NOT drop or recreate the table. Existing data is preserved.
-- Run this after supabase-company-intake-migration.sql

-----------------------------------------------------------
-- ADD TIER 1 COLUMNS TO company_profiles
-----------------------------------------------------------

-- Business size standard (SAM.gov classification)
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS business_size TEXT
    CHECK (business_size IN ('Small', 'Other Than Small', 'Large'));

-- Socioeconomic certifications array.
-- Using TEXT[] (not a join table) because these are standardized enumerated values
-- from SAM.gov and are always queried together with the company profile for proposal generation.
-- Common values: '8(a)', 'HUBZone', 'SDVOSB', 'WOSB', 'EDWOSB', 'SDB'
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS socioeconomic_certs TEXT[] DEFAULT '{}';

-- Longer-form corporate overview for proposals.
-- Distinct from elevator_pitch (short summary, max 500 chars) — this is the full narrative.
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS corporate_overview TEXT
    CHECK (corporate_overview IS NULL OR LENGTH(corporate_overview) <= 3000);

-- Narrative summary of core service areas
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS core_services_summary TEXT
    CHECK (core_services_summary IS NULL OR LENGTH(core_services_summary) <= 2000);

-- Reusable enterprise-level win theme statements (array of freeform strings)
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS enterprise_win_themes TEXT[] DEFAULT '{}';

-- Narrative summary of key differentiators
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS key_differentiators_summary TEXT
    CHECK (key_differentiators_summary IS NULL OR LENGTH(key_differentiators_summary) <= 2000);

-- Standard management approach text
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS standard_management_approach TEXT
    CHECK (standard_management_approach IS NULL OR LENGTH(standard_management_approach) <= 3000);

-- ISO/CMMI quality/process certifications status.
-- JSON object: {iso_9001: boolean, iso_27001: boolean, iso_20000: boolean,
--               cmmi_dev_level: number|null, cmmi_svc_level: number|null, itil_certified: boolean}
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS iso_cmmi_status JSONB DEFAULT '{}';

-- DCAA-approved accounting and business systems status.
-- JSON object: {accounting: boolean, estimating: boolean, purchasing: boolean,
--               timekeeping: boolean, compensation: boolean, billing: boolean}
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS dcaa_approved_systems JSONB DEFAULT '{}';

-- Flag indicating Tier 1 onboarding is complete for this company.
-- Must be true before user can start an RFP (enforced in Plan 03 gate logic).
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS tier1_complete BOOLEAN DEFAULT false;

-----------------------------------------------------------
-- INDEXES FOR NEW COLUMNS
-----------------------------------------------------------

-- Index on tier1_complete for efficient gate enforcement queries
CREATE INDEX IF NOT EXISTS idx_company_profiles_tier1_complete
  ON company_profiles(tier1_complete);

-- Index on business_size for reporting and filtering
CREATE INDEX IF NOT EXISTS idx_company_profiles_business_size
  ON company_profiles(business_size);
