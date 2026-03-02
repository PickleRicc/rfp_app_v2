-- Round 3 data fixes: personnel inline cert dates + service area approach text
-- The certifications TABLE was fixed previously, but personnel records have their
-- own embedded certifications JSONB that still carries stale dates.

DO $$
DECLARE
  v_company_id UUID := '82545dfa-9a53-45da-8da9-134b2ea2ec37';
  v_dcr_id UUID := '368fe62d-36fb-463d-a2ec-9a1287c578f2';
  v_updated INT;
BEGIN

-- ============================================================================
-- FIX 1: Anderson SPC cert in personnel.certifications JSONB
-- The certifications TABLE was updated to 2027-03-20 but the
-- personnel record's inline certifications array still says 2025-03-20
-- ============================================================================

UPDATE personnel
SET certifications = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'name' = 'SAFe Program Consultant (SPC)'
           AND elem->>'expiration_date' = '2025-03-20'
      THEN jsonb_set(elem, '{expiration_date}', '"2027-03-20"'::jsonb)
      ELSE elem
    END
  )
  FROM jsonb_array_elements(certifications) AS elem
)
WHERE company_id = v_company_id
  AND full_name = 'Michael Anderson';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 1: Updated Anderson SPC in % personnel row(s)', v_updated;

-- ============================================================================
-- FIX 2: Patel AWS SAP cert in personnel.certifications JSONB
-- Same issue: certifications TABLE fixed but inline JSONB is stale
-- ============================================================================

UPDATE personnel
SET certifications = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'name' = 'AWS Certified Solutions Architect - Professional'
           AND elem->>'expiration_date' = '2025-08-10'
      THEN jsonb_set(elem, '{expiration_date}', '"2027-08-10"'::jsonb)
      ELSE elem
    END
  )
  FROM jsonb_array_elements(certifications) AS elem
)
WHERE company_id = v_company_id
  AND full_name = 'Dr. Priya Patel';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 2: Updated Patel AWS SAP in % personnel row(s)', v_updated;

-- ============================================================================
-- FIX 3: Rodriguez "18 years federal" in service_area_approaches
-- seed-mock-datacall-arl.sql has "18 years federal experience" in the
-- cybersecurity service area approach text. Actual federal_experience_years=14.
-- ============================================================================

UPDATE data_call_responses
SET service_area_approaches = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'approach_narrative' LIKE '%18 years federal experience%'
      THEN jsonb_set(
        elem,
        '{approach_narrative}',
        to_jsonb(REPLACE(elem->>'approach_narrative', '18 years federal experience', '14 years federal cybersecurity experience'))
      )
      WHEN elem->>'key_differentiator' LIKE '%18 years federal experience%'
      THEN jsonb_set(
        elem,
        '{key_differentiator}',
        to_jsonb(REPLACE(elem->>'key_differentiator', '18 years federal experience', '14 years federal cybersecurity experience'))
      )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(service_area_approaches) AS elem
)
WHERE id = v_dcr_id
  AND service_area_approaches::text LIKE '%18 years federal experience%';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 3: Fixed Rodriguez federal experience in % service_area_approaches row(s)', v_updated;

-- Also fix in the proposed_roles if the text says "18 years federal"
UPDATE personnel
SET proposed_roles = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'summary_for_role' LIKE '%18 years%federal%'
      THEN jsonb_set(
        elem,
        '{summary_for_role}',
        to_jsonb(
          REPLACE(
            REPLACE(elem->>'summary_for_role', '18 years of federal', '14 years of federal'),
            '18 years federal', '14 years federal'
          )
        )
      )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(proposed_roles) AS elem
)
WHERE company_id = v_company_id
  AND full_name = 'James Rodriguez'
  AND proposed_roles::text LIKE '%18 years%federal%';

GET DIAGNOSTICS v_updated = ROW_COUNT;
RAISE NOTICE 'FIX 3b: Fixed Rodriguez federal experience in % proposed_roles row(s)', v_updated;

-- ============================================================================
RAISE NOTICE '=== All v3 scorer-finding fixes applied ===';

END $$;
