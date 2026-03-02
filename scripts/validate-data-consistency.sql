-- ============================================================================
-- SCRIPT 3: CROSS-TIER DATA CONSISTENCY VALIDATION
-- Run after: new-company-seed.sql + new-company-tier2-datacall.sql + file uploads
--
-- Checks that Tier 1 (company DB) and Tier 2 (data call) are in sync,
-- and that uploaded files match the authoritative personnel names.
-- Every CHECK should return PASS. Any FAIL means the scorer WILL flag it.
-- ============================================================================

DO $$
DECLARE
  v_cid UUID;
  v_dcr_id UUID;
  v_sol_id UUID;
  v_fail_count INT := 0;
  v_kp_names TEXT[];
  v_tier2_names TEXT[];
  v_file_text TEXT;
  v_rec RECORD;
BEGIN

SELECT id INTO v_cid FROM company_profiles WHERE company_name = 'Meridian IT Solutions' LIMIT 1;
IF v_cid IS NULL THEN RAISE EXCEPTION 'Company "Meridian IT Solutions" not found'; END IF;

SELECT id INTO v_sol_id FROM solicitations WHERE company_id = v_cid ORDER BY created_at DESC LIMIT 1;
IF v_sol_id IS NULL THEN RAISE EXCEPTION 'No solicitation found'; END IF;

SELECT id INTO v_dcr_id FROM data_call_responses WHERE solicitation_id = v_sol_id AND company_id = v_cid LIMIT 1;
IF v_dcr_id IS NULL THEN RAISE EXCEPTION 'No data call response found — run tier2 script first'; END IF;

RAISE NOTICE '══════════════════════════════════════════════════════';
RAISE NOTICE 'DATA CONSISTENCY VALIDATION';
RAISE NOTICE 'Company: Meridian IT Solutions (%)' , v_cid;
RAISE NOTICE 'Solicitation: %', v_sol_id;
RAISE NOTICE 'Data Call Response: %', v_dcr_id;
RAISE NOTICE '══════════════════════════════════════════════════════';

-- ═══════════════════════════════════════════════════
-- CHECK 1: Key personnel names match between Tier 1 and Tier 2
-- ═══════════════════════════════════════════════════
SELECT ARRAY_AGG(full_name ORDER BY full_name) INTO v_kp_names
FROM personnel
WHERE company_id = v_cid
  AND (proposed_roles->0->>'is_key_personnel')::boolean = true;

SELECT ARRAY_AGG(elem->>'name' ORDER BY elem->>'name') INTO v_tier2_names
FROM data_call_responses, jsonb_array_elements(key_personnel) AS elem
WHERE id = v_dcr_id;

IF v_kp_names = v_tier2_names THEN
  RAISE NOTICE 'CHECK 1 PASS: Key personnel names match between Tier 1 and Tier 2';
ELSE
  RAISE WARNING 'CHECK 1 FAIL: Key personnel name mismatch!';
  RAISE WARNING '  Tier 1 (personnel table): %', v_kp_names;
  RAISE WARNING '  Tier 2 (data call key_personnel): %', v_tier2_names;
  v_fail_count := v_fail_count + 1;
END IF;

-- ═══════════════════════════════════════════════════
-- CHECK 2: Key personnel roles match between Tier 1 and Tier 2
-- ═══════════════════════════════════════════════════
FOR v_rec IN
  SELECT 
    p.full_name,
    p.proposed_roles->0->>'role_title' AS tier1_role,
    kp.elem->>'role' AS tier2_role
  FROM personnel p
  CROSS JOIN LATERAL (
    SELECT elem FROM data_call_responses dcr, jsonb_array_elements(dcr.key_personnel) AS elem
    WHERE dcr.id = v_dcr_id AND elem->>'name' = p.full_name
  ) kp
  WHERE p.company_id = v_cid
    AND (p.proposed_roles->0->>'is_key_personnel')::boolean = true
LOOP
  IF v_rec.tier1_role = v_rec.tier2_role THEN
    RAISE NOTICE 'CHECK 2 PASS: % role matches (% = %)', v_rec.full_name, v_rec.tier1_role, v_rec.tier2_role;
  ELSE
    RAISE WARNING 'CHECK 2 FAIL: % role mismatch — Tier 1: %, Tier 2: %', v_rec.full_name, v_rec.tier1_role, v_rec.tier2_role;
    v_fail_count := v_fail_count + 1;
  END IF;
END LOOP;

-- ═══════════════════════════════════════════════════
-- CHECK 3: CAGE code matches between company_profiles and compliance_verification
-- ═══════════════════════════════════════════════════
IF (SELECT cage_code FROM company_profiles WHERE id = v_cid) =
   (SELECT compliance_verification->>'facility_clearance_cage' FROM data_call_responses WHERE id = v_dcr_id)
THEN
  RAISE NOTICE 'CHECK 3 PASS: CAGE code matches between Tier 1 and Tier 2';
ELSE
  RAISE WARNING 'CHECK 3 FAIL: CAGE code mismatch — Tier 1: %, Tier 2: %',
    (SELECT cage_code FROM company_profiles WHERE id = v_cid),
    (SELECT compliance_verification->>'facility_clearance_cage' FROM data_call_responses WHERE id = v_dcr_id);
  v_fail_count := v_fail_count + 1;
END IF;

-- ═══════════════════════════════════════════════════
-- CHECK 4: Clearance level matches
-- ═══════════════════════════════════════════════════
IF (SELECT clearance_level FROM company_profiles WHERE id = v_cid) =
   (SELECT compliance_verification->>'facility_clearance_level' FROM data_call_responses WHERE id = v_dcr_id)
THEN
  RAISE NOTICE 'CHECK 4 PASS: Facility clearance level matches between Tier 1 and Tier 2';
ELSE
  RAISE WARNING 'CHECK 4 FAIL: Clearance level mismatch — Tier 1: %, Tier 2: %',
    (SELECT clearance_level FROM company_profiles WHERE id = v_cid),
    (SELECT compliance_verification->>'facility_clearance_level' FROM data_call_responses WHERE id = v_dcr_id);
  v_fail_count := v_fail_count + 1;
END IF;

-- ═══════════════════════════════════════════════════
-- CHECK 5: CMMI level matches
-- ═══════════════════════════════════════════════════
IF (SELECT (iso_cmmi_status->>'cmmi_svc_level')::int FROM company_profiles WHERE id = v_cid) =
   (SELECT (compliance_verification->>'cmmi_level')::int FROM data_call_responses WHERE id = v_dcr_id)
THEN
  RAISE NOTICE 'CHECK 5 PASS: CMMI level matches between Tier 1 and Tier 2';
ELSE
  RAISE WARNING 'CHECK 5 FAIL: CMMI level mismatch';
  v_fail_count := v_fail_count + 1;
END IF;

-- ═══════════════════════════════════════════════════
-- CHECK 6: ISO 27001 status matches
-- ═══════════════════════════════════════════════════
IF (SELECT (iso_cmmi_status->>'iso_27001')::boolean FROM company_profiles WHERE id = v_cid) =
   (SELECT (compliance_verification->>'iso_27001_certified')::boolean FROM data_call_responses WHERE id = v_dcr_id)
THEN
  RAISE NOTICE 'CHECK 6 PASS: ISO 27001 status matches between Tier 1 and Tier 2';
ELSE
  RAISE WARNING 'CHECK 6 FAIL: ISO 27001 mismatch';
  v_fail_count := v_fail_count + 1;
END IF;

-- ═══════════════════════════════════════════════════
-- CHECK 7: SDVOSB certification consistent
-- ═══════════════════════════════════════════════════
IF EXISTS (
  SELECT 1 FROM certifications WHERE company_id = v_cid AND certification_type ILIKE '%SDVOSB%'
) AND (SELECT (compliance_verification->>'sdvosb_certified')::boolean FROM data_call_responses WHERE id = v_dcr_id) = true
THEN
  RAISE NOTICE 'CHECK 7 PASS: SDVOSB certification consistent between Tier 1 and Tier 2';
ELSE
  RAISE WARNING 'CHECK 7 FAIL: SDVOSB certification inconsistency';
  v_fail_count := v_fail_count + 1;
END IF;

-- ═══════════════════════════════════════════════════
-- CHECK 8: Past performance records exist in Tier 1 for each Tier 2 reference
-- ═══════════════════════════════════════════════════
FOR v_rec IN
  SELECT elem->>'contract_number' AS t2_contract, elem->>'project_name' AS t2_name
  FROM data_call_responses, jsonb_array_elements(past_performance) AS elem
  WHERE id = v_dcr_id
LOOP
  IF EXISTS (
    SELECT 1 FROM past_performance WHERE company_id = v_cid AND contract_number = v_rec.t2_contract
  ) THEN
    RAISE NOTICE 'CHECK 8 PASS: PP reference % found in Tier 1', v_rec.t2_contract;
  ELSE
    RAISE WARNING 'CHECK 8 FAIL: PP reference % NOT in Tier 1 past_performance table', v_rec.t2_contract;
    v_fail_count := v_fail_count + 1;
  END IF;
END LOOP;

-- ═══════════════════════════════════════════════════
-- CHECK 9: Tools in Tier 2 technology_selections exist in Tier 1 tools_technologies
-- ═══════════════════════════════════════════════════
FOR v_rec IN
  SELECT elem->>'technology_name' AS tech_name
  FROM data_call_responses, jsonb_array_elements(technology_selections) AS elem
  WHERE id = v_dcr_id
LOOP
  IF EXISTS (
    SELECT 1 FROM tools_technologies WHERE company_id = v_cid AND name ILIKE '%' || SPLIT_PART(v_rec.tech_name, ' ', 1) || '%'
  ) THEN
    RAISE NOTICE 'CHECK 9 PASS: Technology "%" found in Tier 1', v_rec.tech_name;
  ELSE
    RAISE WARNING 'CHECK 9 WARN: Technology "%" not found in Tier 1 tools_technologies — scorer may flag', v_rec.tech_name;
  END IF;
END LOOP;

-- ═══════════════════════════════════════════════════
-- CHECK 10: Personnel names NOT in Tier 2 service_area_approaches or site_staffing
-- (checks for name leaks from old data)
-- ═══════════════════════════════════════════════════
IF EXISTS (
  SELECT 1 FROM data_call_responses WHERE id = v_dcr_id AND (
    service_area_approaches::text ILIKE '%Gonzalez%' OR
    service_area_approaches::text ILIKE '%Aisha Johnson%' OR
    service_area_approaches::text ILIKE '%David Park%' OR
    site_staffing::text ILIKE '%Gonzalez%' OR
    site_staffing::text ILIKE '%Aisha Johnson%' OR
    technology_selections::text ILIKE '%Anderson%' OR
    technology_selections::text ILIKE '%Priya Patel%' OR
    technology_selections::text ILIKE '%James Rodriguez%'
  )
) THEN
  RAISE WARNING 'CHECK 10 FAIL: Old company personnel names found in Tier 2 data!';
  v_fail_count := v_fail_count + 1;
ELSE
  RAISE NOTICE 'CHECK 10 PASS: No old company name leaks in Tier 2 data';
END IF;

-- ═══════════════════════════════════════════════════
-- CHECK 11: Uploaded files (resumes/LOCs) match key personnel names
-- ═══════════════════════════════════════════════════
IF EXISTS (SELECT 1 FROM data_call_files WHERE data_call_response_id = v_dcr_id AND extracted_text IS NOT NULL) THEN
  FOR v_rec IN
    SELECT id, filename, field_key, 
      CASE 
        WHEN extracted_text ILIKE '%Thomas Brennan%' THEN 'Brennan'
        WHEN extracted_text ILIKE '%Nina Vasquez%' THEN 'Vasquez'
        WHEN extracted_text ILIKE '%Marcus Williams%' THEN 'Williams'
        ELSE 'UNKNOWN'
      END AS matched_person
    FROM data_call_files
    WHERE data_call_response_id = v_dcr_id AND extracted_text IS NOT NULL
  LOOP
    IF v_rec.matched_person = 'UNKNOWN' THEN
      RAISE WARNING 'CHECK 11 FAIL: File "%" (%) does not contain any key personnel name', v_rec.filename, v_rec.field_key;
      v_fail_count := v_fail_count + 1;
    ELSE
      RAISE NOTICE 'CHECK 11 PASS: File "%" matches %', v_rec.filename, v_rec.matched_person;
    END IF;
  END LOOP;
  
  -- Also check for OLD company names in files
  IF EXISTS (
    SELECT 1 FROM data_call_files WHERE data_call_response_id = v_dcr_id 
      AND extracted_text IS NOT NULL
      AND (extracted_text ILIKE '%Gonzalez%' OR extracted_text ILIKE '%David Park%' OR extracted_text ILIKE '%Aisha Johnson%'
        OR extracted_text ILIKE '%Michael Anderson%' OR extracted_text ILIKE '%Priya Patel%' OR extracted_text ILIKE '%James Rodriguez%')
  ) THEN
    RAISE WARNING 'CHECK 11 FAIL: Old company personnel names found in uploaded files!';
    v_fail_count := v_fail_count + 1;
  END IF;
ELSE
  RAISE WARNING 'CHECK 11 SKIP: No uploaded files with extracted text found — upload resumes and LOCs first';
END IF;

-- ═══════════════════════════════════════════════════
-- CHECK 12: Personnel availability matches between Tier 1 and Tier 2 qualifications
-- ═══════════════════════════════════════════════════
FOR v_rec IN
  SELECT p.full_name, p.availability AS tier1_avail,
    kp.elem->>'qualifications_summary' AS t2_qual
  FROM personnel p
  CROSS JOIN LATERAL (
    SELECT elem FROM data_call_responses dcr, jsonb_array_elements(dcr.key_personnel) AS elem
    WHERE dcr.id = v_dcr_id AND elem->>'name' = p.full_name
  ) kp
  WHERE p.company_id = v_cid
    AND (p.proposed_roles->0->>'is_key_personnel')::boolean = true
LOOP
  IF v_rec.tier1_avail ILIKE '%Immediately%' AND v_rec.t2_qual ILIKE '%Immediately%' THEN
    RAISE NOTICE 'CHECK 12 PASS: % availability consistent (Immediately Available)', v_rec.full_name;
  ELSIF v_rec.tier1_avail ILIKE '%2 weeks%' AND v_rec.t2_qual ILIKE '%2 weeks%' THEN
    RAISE NOTICE 'CHECK 12 PASS: % availability consistent (2 weeks notice)', v_rec.full_name;
  ELSIF v_rec.tier1_avail NOT ILIKE '%Immediately%' AND v_rec.t2_qual NOT ILIKE '%Immediately%' THEN
    RAISE NOTICE 'CHECK 12 PASS: % availability consistent (non-immediate)', v_rec.full_name;
  ELSE
    RAISE WARNING 'CHECK 12 FAIL: % availability mismatch — Tier 1: "%", Tier 2 summary mentions different', v_rec.full_name, v_rec.tier1_avail;
    v_fail_count := v_fail_count + 1;
  END IF;
END LOOP;

-- ═══════════════════════════════════════════════════
-- SUMMARY
-- ═══════════════════════════════════════════════════
RAISE NOTICE '══════════════════════════════════════════════════════';
IF v_fail_count = 0 THEN
  RAISE NOTICE 'ALL CHECKS PASSED — Data is consistent. Ready to generate.';
ELSE
  RAISE WARNING '% CHECK(S) FAILED — Fix inconsistencies before generating.', v_fail_count;
END IF;
RAISE NOTICE '══════════════════════════════════════════════════════';

END $$;
