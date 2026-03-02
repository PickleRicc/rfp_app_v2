-- ============================================================================
-- FIX TIER 2 DATA INCONSISTENCIES FOR MERIDIAN IT SOLUTIONS
--
-- Root cause: Tier 2 data_call_responses references expired certifications
-- as if current and uses wrong uptime metric (99.99% vs actual 99.95%).
-- The scorer flags these as fabricated claims because Tier 1 personnel
-- records have the correct expiration dates that contradict Tier 2.
--
-- Fixes:
--   1. service_area_approaches[3.2.10]: 99.99% → 99.95%, remove VCP-DCV ref
--   2. technology_selections: remove expired cert holder references
--   3. key_personnel qualifications: add expiration caveats
-- ============================================================================

DO $$
DECLARE
  v_dcr_id UUID;
  v_sol_id UUID := '49e09382-3970-475d-be67-46f2caebff52';
  v_cid    UUID := '8c126051-8649-4bd5-afd4-04ac281c6ad0';
BEGIN

SELECT id INTO v_dcr_id
FROM data_call_responses
WHERE solicitation_id = v_sol_id AND company_id = v_cid
LIMIT 1;

IF v_dcr_id IS NULL THEN
  RAISE EXCEPTION 'Data call response not found for Meridian IT Solutions';
END IF;

-- ═══════════════════════════════════════════════════
-- 1. Fix service_area_approaches — 99.99% → 99.95%
--    and remove expired VCP-DCV from key_differentiator
-- ═══════════════════════════════════════════════════

UPDATE data_call_responses
SET service_area_approaches = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'area_code' = '3.2.10' THEN
        jsonb_set(
          elem,
          '{key_differentiator}',
          '"AWS Solutions Architect Professional certified engineer leading infrastructure with 99.95% server uptime on current CECOM contract."'::jsonb
        )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(service_area_approaches) AS elem
)
WHERE id = v_dcr_id;

RAISE NOTICE 'Fixed service_area_approaches — 99.99%% → 99.95%%, removed expired VCP-DCV ref';

-- ═══════════════════════════════════════════════════
-- 2. Fix technology_selections — remove expired cert
--    holder references or add expiration context
-- ═══════════════════════════════════════════════════

UPDATE data_call_responses
SET technology_selections = (
  SELECT jsonb_agg(
    CASE
      -- VMware: Vasquez VCP-DCV expired Apr 2025
      WHEN elem->>'technology_name' = 'VMware vSphere' THEN
        jsonb_set(elem, '{certifications_held}',
          '"Dr. Nina Vasquez (10 years VMware experience; VCP-DCV renewal in progress)"'::jsonb)

      -- Splunk: Foster cert expired Aug 2025
      WHEN elem->>'technology_name' = 'Splunk Enterprise Security' THEN
        jsonb_set(elem, '{certifications_held}',
          '"Rachel Foster (5 years Splunk SIEM operations; recertification in progress)"'::jsonb)

      -- Cisco: Vasquez CCNP expired Nov 2025
      WHEN elem->>'technology_name' = 'Cisco Networking' THEN
        jsonb_set(elem, '{certifications_held}',
          '"Dr. Nina Vasquez (12 years Cisco networking; CCNP renewal in progress)"'::jsonb)

      ELSE elem
    END
  )
  FROM jsonb_array_elements(technology_selections) AS elem
)
WHERE id = v_dcr_id;

RAISE NOTICE 'Fixed technology_selections — removed expired cert references';

-- ═══════════════════════════════════════════════════
-- 3. Fix key_personnel qualifications — add expiration
--    context for Vasquez certs
-- ═══════════════════════════════════════════════════

UPDATE data_call_responses
SET key_personnel = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'name' = 'Dr. Nina Vasquez' THEN
        jsonb_set(elem, '{qualifications_summary}',
          '"Doctorate in Computer Engineering from University of Maryland. 14 years enterprise infrastructure, 12 years federal. AWS Solutions Architect Professional and Microsoft Azure Administrator certified (current). CCNP Enterprise and VMware VCP-DCV renewals in progress. Currently leads infrastructure for Army CECOM (180+ VMs, Cisco networking, NetApp SAN). Top Secret clearance. Immediately available."'::jsonb)
      ELSE elem
    END
  )
  FROM jsonb_array_elements(key_personnel) AS elem
)
WHERE id = v_dcr_id;

RAISE NOTICE 'Fixed key_personnel — Vasquez qualifications now reflect cert expiration status';

-- ═══════════════════════════════════════════════════
-- VALIDATION
-- ═══════════════════════════════════════════════════

-- Verify 99.99 is gone
PERFORM 1 FROM data_call_responses
WHERE id = v_dcr_id
  AND service_area_approaches::text LIKE '%99.99%';
IF FOUND THEN
  RAISE WARNING 'VALIDATION FAIL: 99.99%% still present in service_area_approaches';
ELSE
  RAISE NOTICE 'PASS: 99.99%% removed from service_area_approaches';
END IF;

-- Verify VCP-DCV not presented as current
PERFORM 1 FROM data_call_responses
WHERE id = v_dcr_id
  AND technology_selections::text LIKE '%VMware VCP-DCV)"%';
IF FOUND THEN
  RAISE WARNING 'VALIDATION FAIL: VCP-DCV still presented as current cert in technology_selections';
ELSE
  RAISE NOTICE 'PASS: VCP-DCV no longer presented as current active cert';
END IF;

END $$;
