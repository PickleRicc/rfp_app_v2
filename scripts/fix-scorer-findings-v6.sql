-- fix-scorer-findings-v6.sql
-- Adds subcontractor (Acme Federal Solutions) past performance data
-- to the Tier 1 database and updates data_call_responses.past_performance
-- to include a subcontractor reference.
-- Also populates company_profiles fields needed by Cost/Price prompt.

DO $$
DECLARE
  v_company_id UUID;
  v_dcr_id UUID;
  v_solicitation_id UUID := '1ba2f94d-7b58-4bbc-8b78-296f3e4c1fa6';
BEGIN

  SELECT id INTO v_company_id FROM company_profiles WHERE company_name = 'TechVision Federal Solutions' LIMIT 1;
  SELECT id INTO v_dcr_id FROM data_call_responses WHERE solicitation_id = v_solicitation_id LIMIT 1;

  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Company not found'; END IF;
  IF v_dcr_id IS NULL THEN RAISE EXCEPTION 'Data call response not found'; END IF;

  -- =========================================================
  -- 1. Insert Acme Federal Solutions past performance into Tier 1
  --    (as a subcontractor reference under TechVision's company_id,
  --     since past performance records belong to the prime's profile)
  -- =========================================================

  -- Check if Acme PP already exists
  IF NOT EXISTS (
    SELECT 1 FROM past_performance
    WHERE company_id = v_company_id AND contract_nickname = 'Acme DoD NetOps'
  ) THEN
    INSERT INTO past_performance (
      company_id, contract_nickname, contract_name, contract_number,
      client_agency, client_office,
      contract_type, contract_value, start_date, end_date,
      role, prime_contractor, percentage_of_work, team_size, place_of_performance,
      client_poc, cpars_rating,
      overview, description_of_effort,
      task_areas, tools_used,
      achievements, relevance_tags
    ) VALUES (
      v_company_id,
      'Acme DoD NetOps',
      'DoD Enterprise Network Operations and Monitoring',
      'W15P7T-20-D-0082',
      'Department of Defense / DISA',
      'Defense Information Systems Agency — Field Operations',
      'Cost-Plus',
      14800000,
      '2020-01-15',
      '2025-01-14',
      'Subcontractor',
      'Acme Federal Solutions',
      20,
      55,
      'Fort Meade, MD; Pentagon; Various DoD installations',
      '{
        "name": "LTC Sarah Mitchell",
        "title": "COR, DISA Network Operations Division",
        "phone": "(301) 225-4800",
        "email": "sarah.mitchell.civ@disa.mil"
      }'::jsonb,
      '{
        "overall": "Exceptional",
        "quality": "Very Good",
        "schedule": "Exceptional",
        "management": "Exceptional",
        "cost_control": "Very Good"
      }'::jsonb,
      'Acme Federal Solutions served as prime contractor for enterprise network monitoring and operations across 15+ DoD installations. TechVision provided specialized SIEM integration and incident response support as a subcontractor.',
      'Full-spectrum network operations center (NOC) management including 24/7 monitoring of DoD enterprise networks using SolarWinds NPM, Cisco DNA Center, and custom SNMP-based monitoring. Managed Cisco ISE for Comply-to-Connect enforcement across classified and unclassified segments. Incident response team achieved <15 minute mean time to detect for critical events. Supported SIPR, NIPR, and JWICS network segments with TS/SCI-cleared personnel.',
      ARRAY['Network Operations', 'NOC Management', 'Incident Response', 'Cisco ISE Administration', 'Comply-to-Connect', 'Classified Network Support', 'SIEM Integration'],
      ARRAY['SolarWinds NPM', 'Cisco DNA Center', 'Cisco ISE', 'Splunk', 'HBSS/ESS', 'Wireshark', 'ServiceNow ITSM'],
      '[
        {"statement": "Achieved 99.97% network uptime across all monitored installations", "metric_value": "99.97% uptime"},
        {"statement": "Reduced mean time to detect critical network events from 45 minutes to under 15 minutes", "metric_value": "MTTD: <15 min"},
        {"statement": "Successfully implemented Cisco ISE Comply-to-Connect across 12 installations with zero mission impact", "metric_value": "12 installations, zero downtime"},
        {"statement": "Managed 50,000+ endpoint devices across classified and unclassified network segments", "metric_value": "50,000+ endpoints"}
      ]'::jsonb,
      ARRAY['network_operations', 'dod', 'classified', 'cisco_ise', 'noc', 'siem', 'multi_site']
    );
    RAISE NOTICE 'Inserted Acme Federal Solutions past performance record';
  ELSE
    RAISE NOTICE 'Acme DoD NetOps PP already exists — skipping insert';
  END IF;

  -- =========================================================
  -- 2. Update data_call_responses.past_performance to include
  --    Acme Federal Solutions as a subcontractor reference
  -- =========================================================

  UPDATE data_call_responses SET
    past_performance = past_performance || '[
      {
        "project_name": "DoD Enterprise Network Operations and Monitoring (Subcontractor: Acme Federal Solutions)",
        "client_agency": "Department of Defense / DISA",
        "contract_number": "W15P7T-20-D-0082",
        "contract_value": "$14.8M (5 years)",
        "period_of_performance": "01/2020 – 01/2025",
        "relevance_summary": "Acme Federal Solutions (proposed 20% workshare subcontractor) served as prime on this DISA enterprise network operations contract managing 50,000+ DoD endpoints across 15 installations. Directly relevant capabilities: Cisco ISE Comply-to-Connect enforcement, 24/7 NOC operations, SolarWinds/Cisco DNA Center monitoring, SIPR/JWICS classified network support, and HBSS/ESS management — all core requirements in the ARL SOO.",
        "contact_name": "LTC Sarah Mitchell",
        "contact_email": "sarah.mitchell.civ@disa.mil",
        "contact_phone": "(301) 225-4800"
      }
    ]'::jsonb
  WHERE id = v_dcr_id;

  RAISE NOTICE 'Added Acme Federal Solutions subcontractor reference to data call past_performance';

  -- =========================================================
  -- 3. Populate CAGE code and UEI in company_profiles
  --    (needed for Past Performance TOR format fields)
  -- =========================================================

  UPDATE company_profiles SET
    cage_code = COALESCE(cage_code, '7X2K9'),
    uei_number = COALESCE(uei_number, 'JM4KDLR8YNHX')
  WHERE id = v_company_id;

  RAISE NOTICE 'Ensured CAGE code and UEI are populated in company_profiles';

END $$;
