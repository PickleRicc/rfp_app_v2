-- Round 2 data fixes from touchup scorer findings
-- Addresses: email domain in extracted text, CPARS ratings, achievement text,
--            corporate overview claims, and personnel experience conflation.

DO $$
DECLARE
  v_company_id UUID := '82545dfa-9a53-45da-8da9-134b2ea2ec37';
  v_dcr_id UUID := '368fe62d-36fb-463d-a2ec-9a1287c578f2';
  v_updated INT;
BEGIN

-- ============================================================================
-- FIX 1: Replace @apexfederal.com email domain in extracted PDF text
-- LOCs and resumes still have @apexfederal.com after v1 company name fix
-- ============================================================================

UPDATE data_call_files
SET extracted_text = REPLACE(extracted_text, '@apexfederal.com', '@techvisionfed.com')
WHERE data_call_response_id = v_dcr_id
  AND extracted_text LIKE '%@apexfederal.com%';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 1: Replaced @apexfederal.com in % file(s)', v_updated;

-- Also catch any remaining "Apex Federal" variants
UPDATE data_call_files
SET extracted_text = REPLACE(extracted_text, 'Apex Federal', 'TechVision Federal Solutions')
WHERE data_call_response_id = v_dcr_id
  AND extracted_text LIKE '%Apex Federal%';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 1b: Replaced remaining "Apex Federal" in % file(s)', v_updated;

-- ============================================================================
-- FIX 2: Populate cpars_rating for DHS Cyber Shield contract
-- Achievement text says "Exceptional for 3 consecutive years" but field is null
-- ============================================================================

UPDATE past_performance
SET cpars_rating = '{
  "overall": "Exceptional",
  "quality": "Exceptional",
  "schedule": "Exceptional",
  "cost_control": "Exceptional",
  "management": "Exceptional"
}'::jsonb
WHERE company_id = v_company_id
  AND contract_number = '70RSAT20D00000001';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 2: Populated cpars_rating for % DHS contract(s)', v_updated;

-- ============================================================================
-- FIX 3: Populate cpars_rating for VA Digital Modernization contract
-- Achievement says "Outstanding CPARS" but field is null
-- ============================================================================

UPDATE past_performance
SET cpars_rating = '{
  "overall": "Outstanding",
  "quality": "Outstanding",
  "schedule": "Outstanding",
  "cost_control": "Very Good",
  "management": "Outstanding"
}'::jsonb
WHERE company_id = v_company_id
  AND contract_number = 'VA-255-19-C-0001';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 3: Populated cpars_rating for % VA contract(s)', v_updated;

-- ============================================================================
-- FIX 4: Populate cpars_rating for EPA ITSM Pro contract
-- Achievement says "Very Good" but field is null
-- ============================================================================

UPDATE past_performance
SET cpars_rating = '{
  "overall": "Very Good",
  "quality": "Very Good",
  "schedule": "Very Good",
  "cost_control": "Very Good",
  "management": "Very Good"
}'::jsonb
WHERE company_id = v_company_id
  AND contract_number = '68HE0220D0009';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 4: Populated cpars_rating for % EPA contract(s)', v_updated;

-- ============================================================================
-- FIX 5: Fix DHS achievement "4 years" → "5 years"
-- Contract period is 2020-01-15 to 2025-01-14 = 5 years
-- achievements is a JSONB array; update the metric text
-- ============================================================================

UPDATE past_performance
SET achievements = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'metric_value' LIKE '%4 years%'
      THEN jsonb_set(elem, '{metric_value}', to_jsonb(REPLACE(elem->>'metric_value', '4 years', '5 years')))
      WHEN elem->>'statement' LIKE '%4 years%'
      THEN jsonb_set(elem, '{statement}', to_jsonb(REPLACE(elem->>'statement', '4 years', '5 years')))
      ELSE elem
    END
  )
  FROM jsonb_array_elements(achievements) AS elem
)
WHERE company_id = v_company_id
  AND contract_number = '70RSAT20D00000001'
  AND achievements::text LIKE '%4 years%';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 5: Fixed "4 years" → "5 years" in % DHS achievement(s)', v_updated;

-- ============================================================================
-- FIX 6: Remove unverifiable "15 SAFe Program Consultants" from full_description
-- Cannot be verified from personnel records provided
-- ============================================================================

UPDATE company_profiles
SET full_description = REPLACE(
  full_description,
  '15 SAFe Program Consultants',
  'SAFe-certified practitioners'
)
WHERE id = v_company_id
  AND full_description LIKE '%15 SAFe Program Consultants%';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 6: Fixed SAFe claim in % row(s) (may be 0 if text not present)', v_updated;

-- ============================================================================
-- FIX 7: Fix James Rodriguez proposed_roles "18 years cybersecurity"
-- total_experience_years=18, relevant_experience_years=16
-- Should say "16 years of cybersecurity experience"
-- ============================================================================

UPDATE personnel
SET proposed_roles = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'summary_for_role' LIKE '%18 years of cybersecurity%'
      THEN jsonb_set(elem, '{summary_for_role}', to_jsonb(REPLACE(elem->>'summary_for_role', '18 years of cybersecurity', '16 years of cybersecurity')))
      ELSE elem
    END
  )
  FROM jsonb_array_elements(proposed_roles) AS elem
)
WHERE company_id = v_company_id
  AND full_name = 'James Rodriguez'
  AND proposed_roles::text LIKE '%18 years of cybersecurity%';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 7: Fixed Rodriguez experience in % row(s)', v_updated;

-- ============================================================================
RAISE NOTICE '=== All v2 scorer-finding data fixes applied ===';

END $$;
