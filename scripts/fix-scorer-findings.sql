-- Fix data issues identified by touchup scorer (52/100 findings)
-- Run against Supabase after verifying each section applies to your data.

DO $$
DECLARE
  v_company_id UUID := '82545dfa-9a53-45da-8da9-134b2ea2ec37';
  v_dcr_id UUID := '368fe62d-36fb-463d-a2ec-9a1287c578f2';
  v_updated INT;
BEGIN

-- ============================================================================
-- FIX 1: SDVOSB expiration conflict
-- certifications table has 2026-01-15, compliance_verification has 2027-01-15
-- Align certifications table to 2027-01-15 (matching compliance_verification)
-- ============================================================================

UPDATE certifications SET expiration_date = '2027-01-15'
WHERE company_id = v_company_id
  AND certification_type ILIKE '%SDVOSB%';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 1: Updated % SDVOSB certification row(s) expiration to 2027-01-15', v_updated;

-- ============================================================================
-- FIX 2: NAICS 541519 size standard mismatch ($30M vs $34M)
-- Company record shows $30M but RFP uses $34M threshold.
-- Update to match the current SBA size standard.
-- ============================================================================

UPDATE naics_codes SET size_standard = '$34M'
WHERE company_id = v_company_id
  AND code = '541519';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 2: Updated % NAICS 541519 row(s) size standard to $34M', v_updated;

-- ============================================================================
-- FIX 3: "Apex Federal Solutions" in extracted PDF text
-- Resumes and LOCs reference "Apex Federal Solutions" instead of
-- "TechVision Federal Solutions". Replace in all extracted_text fields.
-- ============================================================================

UPDATE data_call_files
SET extracted_text = REPLACE(extracted_text, 'Apex Federal Solutions', 'TechVision Federal Solutions')
WHERE data_call_response_id = v_dcr_id
  AND extracted_text ILIKE '%Apex Federal Solutions%';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 3: Replaced "Apex Federal Solutions" in % data_call_files row(s)', v_updated;

-- ============================================================================
-- FIX 4: Verify cert expirations were applied (Anderson SPC, Patel AWS)
-- These were set in update-mock-company-fixes.sql.
-- If they're still expired, force-update them.
-- ============================================================================

UPDATE certifications SET expiration_date = '2027-03-20'
WHERE company_id = v_company_id
  AND certification_type = 'SAFe Program Consultant (SPC)'
  AND expiration_date < '2026-06-01';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 4a: Updated % Anderson SPC cert(s) (only if still expired)', v_updated;

UPDATE certifications SET expiration_date = '2027-08-10'
WHERE company_id = v_company_id
  AND certification_type = 'AWS Certified Solutions Architect - Professional'
  AND expiration_date < '2026-06-01';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 4b: Updated % Patel AWS SAP cert(s) (only if still expired)', v_updated;

-- ============================================================================
RAISE NOTICE '=== All scorer-finding data fixes applied ===';

END $$;
