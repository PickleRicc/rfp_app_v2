-- Align key_personnel entries with the actual uploaded resumes/LOCs
-- Resumes are for: Anderson (PM), Rodriguez (Cyber Lead), Patel (Solutions Architect)
-- Data call had: Gonzalez (PM), Park (Lead Sys Eng), Johnson (Cyber Lead)
-- File IDs remain the same — just updating names, roles, and qualifications to match.
--
-- Also fixes the service_area_approaches cybersecurity section that referenced
-- "Aisha Johnson" and "James Rodriguez" inconsistently.

DO $$
DECLARE
  v_company_id UUID := '82545dfa-9a53-45da-8da9-134b2ea2ec37';
  v_dcr_id UUID := '368fe62d-36fb-463d-a2ec-9a1287c578f2';
BEGIN

-- ============================================================================
-- 1. Replace key_personnel with names matching uploaded resumes
-- File IDs are preserved (same resume/LOC/cert files)
-- ============================================================================

UPDATE data_call_responses SET
  key_personnel = '[
    {
      "name": "Michael Anderson",
      "role": "Program Manager",
      "resume_file_id": "baa8ef22-df6d-41ef-9ac8-128f439aac46",
      "loc_file_id": "a3389d9f-dd28-42c2-8f11-8f9ec3ad95c3",
      "qualifications_summary": "PMP and SAFe SPC certified with 22 years of IT program management experience, 15 years supporting federal agencies. Master''s in IT Management from Johns Hopkins. Former IT Project Manager at Federal Solutions Inc managing DoD and DHS modernization projects with teams of 15-25 people. Managed $50M+ in federal contracts with proven track record of on-time, on-budget delivery. Active Secret clearance. Experienced with ServiceNow, ITIL, and DoD IT operations.",
      "certifications_file_ids": ["aa82f66d-3c15-432d-8786-61c3b5ba7d7d"]
    },
    {
      "name": "Dr. Priya Patel",
      "role": "Lead Systems Engineer",
      "resume_file_id": "2f8f7e4a-ecf5-441e-9d4f-efd5696f1386",
      "loc_file_id": "532ac258-d38e-4d53-adf7-5c3b277e2270",
      "qualifications_summary": "AWS Solutions Architect Professional certified. PhD in Computer Engineering from MIT. 19 years of enterprise architecture experience with deep expertise in cloud technologies and hybrid infrastructure. Led 30+ successful migrations for federal agencies including HHS, GSA, and VA. Expert in Nutanix HCI, Windows/Linux server administration, and FedRAMP assessment. Active Top Secret clearance.",
      "certifications_file_ids": ["62271ee7-df5b-45a7-bb3c-f138812e204e"]
    },
    {
      "name": "James Rodriguez",
      "role": "Cybersecurity Lead",
      "resume_file_id": "4cab28ee-ce58-4443-8490-d17d5466472d",
      "loc_file_id": "aba0753f-678a-4be7-9cc0-2a4b9eab15de",
      "qualifications_summary": "CISSP, CEH certified. Master''s in Cybersecurity from SANS Technology Institute. 18 years total experience, 14 years federal cybersecurity. Led ATO processes for multiple federal systems. Expert in HBSS/ESS deployment, STIG compliance, ARCYBER patch management, NIST RMF, and NIST SP 800-171. Active TS/SCI clearance. Experienced with Splunk SIEM operations and classified spillage response procedures.",
      "certifications_file_ids": ["dc273885-69b7-44ca-a617-f5c9daf4e717"]
    }
  ]'::jsonb
WHERE id = v_dcr_id;

RAISE NOTICE 'Updated key_personnel to match uploaded resumes (Anderson, Patel, Rodriguez)';

-- ============================================================================
-- 2. Fix service_area_approaches cybersecurity section
-- Was: "Aisha Johnson as Cybersecurity Lead" + "James Rodriguez leads cybersecurity"
-- Now: "James Rodriguez as Cybersecurity Lead" (matches key_personnel)
-- ============================================================================

UPDATE data_call_responses
SET service_area_approaches = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'area_code' = '3.4'
      THEN jsonb_set(
        jsonb_set(
          elem,
          '{proposed_staffing}',
          to_jsonb(REPLACE(
            elem->>'proposed_staffing',
            'Aisha Johnson as Cybersecurity Lead',
            'James Rodriguez as Cybersecurity Lead'
          ))
        ),
        '{key_differentiator}',
        to_jsonb(REPLACE(
          REPLACE(
            elem->>'key_differentiator',
            'James Rodriguez (CISSP, TS/SCI) leads cybersecurity operations with 18 years federal experience',
            'James Rodriguez (CISSP, CEH, TS/SCI) leads cybersecurity operations with 14 years federal cybersecurity experience'
          ),
          '18 years federal experience',
          '14 years federal cybersecurity experience'
        ))
      )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(service_area_approaches) AS elem
)
WHERE id = v_dcr_id;

RAISE NOTICE 'Fixed cybersecurity service area to reference Rodriguez as lead';

-- ============================================================================
-- 3. Fix technology_selections: replace Aisha Johnson with Rodriguez
-- Aisha Johnson doesn't exist as a personnel record — she was a data call
-- placeholder from the old key_personnel list.
-- ============================================================================

UPDATE data_call_responses
SET technology_selections = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'technology_name' = 'HBSS/ESS'
      THEN jsonb_set(
        elem,
        '{certifications_held}',
        '"CISSP (James Rodriguez), CEH (James Rodriguez)"'::jsonb
      )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(technology_selections) AS elem
)
WHERE id = v_dcr_id;

RAISE NOTICE 'Fixed technology_selections: replaced Aisha Johnson with Rodriguez';

-- ============================================================================
-- 4. Update personnel records: mark Anderson, Rodriguez, Patel as key_personnel
-- ============================================================================

UPDATE personnel
SET proposed_roles = jsonb_set(
  proposed_roles,
  '{0,is_key_personnel}',
  'true'::jsonb
)
WHERE company_id = v_company_id
  AND full_name IN ('Michael Anderson', 'James Rodriguez', 'Dr. Priya Patel');

RAISE NOTICE 'Marked Anderson, Rodriguez, Patel as is_key_personnel=true in personnel';

-- ============================================================================
-- 5. Replace irrelevant past performance (VA Agile, HHS Cloud, GSA Digital)
-- with DoD IT operations contracts that match the ARL solicitation scope
-- Keep DHS Cyber Shield and EPA ITSM Pro — those are relevant.
-- ============================================================================

-- Replace VA Agile Transform → Army IT Service Desk Operations
UPDATE past_performance SET
  contract_nickname = 'Army IT Ops Fort Belvoir',
  contract_name = 'Enterprise IT Service Desk and Infrastructure Management',
  contract_number = 'W91QUZ-19-D-0045',
  task_order_number = 'TO-0003',
  client_agency = 'Department of the Army',
  client_office = 'Network Enterprise Technology Command (NETCOM)',
  contract_type = 'FFP',
  contract_value = 11200000.00,
  annual_value = 2240000.00,
  start_date = '2019-10-01',
  end_date = '2024-09-30',
  base_period = '1 year',
  option_periods = 4,
  role = 'Prime',
  percentage_of_work = 100,
  prime_contractor = NULL,
  team_size = 22,
  place_of_performance = 'Fort Belvoir, VA',
  client_poc = '{"name": "COL David Richards", "title": "Director of Information Management", "phone": "(703) 806-4000", "email": "david.richards.civ@army.mil", "note": "Outstanding working relationship"}'::jsonb,
  overview = 'Prime contractor providing full-spectrum IT service desk, infrastructure management, and cybersecurity operations for Army installations supporting 4,200 users across classified and unclassified networks.',
  description_of_effort = 'Provided Tier 1-3 IT service desk operations using ServiceNow ITSM platform for 4,200+ Army personnel. Managed Windows Server and RHEL environments across 180 servers on Nutanix HCI infrastructure. Administered Cisco network infrastructure including LAN/WAN, VPN, and wireless networks. Operated SIPR and JWICS classified environments with dedicated cleared staff. Performed HBSS/ESS deployment, STIG compliance enforcement, and ARCYBER patch management. Maintained 99.5% SLA compliance across all performance metrics. Conducted DISA STIG quarterly audits and RMF artifact delivery for 12 system authorizations.',
  task_areas = ARRAY['IT Service Desk (Tier 1-3)', 'Server and Storage Administration', 'Network Infrastructure Management', 'Cybersecurity and STIG Compliance', 'HBSS/ESS Deployment', 'Classified Network Support (SIPR/JWICS)', 'ServiceNow Platform Administration', 'Asset Management', 'VTC/AV Support', 'Customer Training'],
  tools_used = ARRAY['ServiceNow ITSM', 'Nutanix Prism', 'Cisco ISE', 'HBSS/ESS', 'ACAS', 'SCCM', 'Nagios', 'SolarWinds'],
  achievements = '[
    {"statement": "Maintained 99.5% SLA compliance across all service areas for 5 consecutive years", "metric_value": "99.5%", "metric_type": "Quality Improvement"},
    {"statement": "Achieved 96% first-call resolution rate at Tier 1 service desk", "metric_value": "96%", "metric_type": "Quality Improvement"},
    {"statement": "Completed 100% of ARCYBER patches within required timelines for 20 consecutive quarters", "metric_value": "100%", "metric_type": "Compliance"},
    {"statement": "Reduced average incident resolution time from 48 hours to 18 hours through ServiceNow automation", "metric_value": "62% reduction", "metric_type": "Time Savings"},
    {"statement": "Zero classified spillage incidents over 5-year period", "metric_value": "0 incidents", "metric_type": "Quality Improvement"},
    {"statement": "Received CPARS rating of Exceptional for 4 out of 5 performance periods", "metric_value": "Exceptional", "metric_type": "Customer Satisfaction"}
  ]'::jsonb,
  relevance_tags = ARRAY['IT Service Desk', 'DoD', 'Army', 'Infrastructure Management', 'HBSS', 'Classified Support', 'ServiceNow', 'STIG Compliance'],
  cpars_rating = '{"quality": "Exceptional", "schedule": "Very Good", "management": "Exceptional", "cost_control": "Exceptional", "overall": "Exceptional"}'::jsonb
WHERE company_id = v_company_id AND contract_nickname = 'VA Agile Transform';

RAISE NOTICE 'Replaced VA Agile Transform → Army IT Ops Fort Belvoir';

-- Replace HHS Cloud Leap → DoD Infrastructure Modernization at Aberdeen
UPDATE past_performance SET
  contract_nickname = 'APG IT Infrastructure',
  contract_name = 'IT Infrastructure and End User Support Services',
  contract_number = 'W56KGZ-21-D-0012',
  task_order_number = 'TO-0001',
  client_agency = 'Department of the Army',
  client_office = 'Army Research Laboratory - Aberdeen Proving Ground',
  contract_type = 'T&M',
  contract_value = 8500000.00,
  annual_value = 2833333.00,
  start_date = '2021-04-01',
  end_date = '2024-03-31',
  base_period = '1 year',
  option_periods = 2,
  role = 'Prime',
  percentage_of_work = 85,
  prime_contractor = NULL,
  team_size = 16,
  place_of_performance = 'Aberdeen Proving Ground, MD',
  client_poc = '{"name": "Dr. Susan Park", "title": "Chief Information Officer", "phone": "(410) 278-4000", "email": "susan.park.civ@arl.army.mil", "note": "Highly satisfied with performance"}'::jsonb,
  overview = 'Prime contractor providing IT infrastructure management and end user computing support at Army Research Laboratory (ARL) Aberdeen Proving Ground, supporting 2,800 researchers and staff across high-performance computing and standard enterprise environments.',
  description_of_effort = 'Managed complete IT infrastructure environment at ARL Aberdeen including 250+ Windows and Linux servers, Nutanix HCI clusters, and high-performance computing nodes. Provided Tier 1-3 service desk via ServiceNow supporting 2,800 researchers and administrative staff. Administered Cisco network infrastructure with Comply-to-Connect (C2C) enforcement via Cisco ISE. Supported specialized research computing environments with unique security requirements. Managed AV/VTC systems across 45 conference rooms. Performed full lifecycle asset management under AR 735-5. Maintained DISA STIG compliance across all endpoints and servers. Supported both Secret and TS/SCI classified environments.',
  task_areas = ARRAY['IT Service Desk (Tier 1-3)', 'Server Administration (Windows/Linux)', 'HCI Management (Nutanix)', 'Network Administration', 'Cisco ISE / Comply-to-Connect', 'Endpoint Management (SCCM/JAMF)', 'Asset Management (AR 735-5)', 'AV/VTC Support', 'Classified Environment Support', 'ServiceNow Administration'],
  tools_used = ARRAY['ServiceNow ITSM/ITOM', 'Nutanix Prism', 'Cisco ISE', 'SCCM', 'JAMF', 'SolarWinds', 'Nagios', 'Veeam'],
  achievements = '[
    {"statement": "Maintained 99.7% infrastructure uptime across all server and network systems", "metric_value": "99.7%", "metric_type": "Quality Improvement"},
    {"statement": "Achieved 94% user satisfaction score (up from 78% at contract start)", "metric_value": "16-point increase", "metric_type": "Customer Satisfaction"},
    {"statement": "Reduced server provisioning time from 2 weeks to 2 days through automation", "metric_value": "86% reduction", "metric_type": "Time Savings"},
    {"statement": "100% STIG compliance across 1,200+ endpoints verified by DISA audit", "metric_value": "100%", "metric_type": "Compliance"},
    {"statement": "Completed Nutanix HCI migration of 150 VMs with zero data loss and 4 hours total downtime", "metric_value": "0 data loss", "metric_type": "Quality Improvement"},
    {"statement": "Received CPARS rating of Exceptional for Quality and Management", "metric_value": "Exceptional", "metric_type": "Customer Satisfaction"}
  ]'::jsonb,
  relevance_tags = ARRAY['IT Infrastructure', 'DoD', 'Army', 'ARL', 'Aberdeen', 'Nutanix', 'ServiceNow', 'Classified Support', 'End User Support'],
  cpars_rating = '{"quality": "Exceptional", "schedule": "Exceptional", "management": "Exceptional", "cost_control": "Very Good", "overall": "Exceptional"}'::jsonb
WHERE company_id = v_company_id AND contract_nickname = 'HHS Cloud Leap';

RAISE NOTICE 'Replaced HHS Cloud Leap → APG IT Infrastructure';

-- Replace GSA Digital Hub → DISA Network Operations
UPDATE past_performance SET
  contract_nickname = 'DISA NetOps',
  contract_name = 'Enterprise Network Operations and Monitoring',
  contract_number = 'HC1028-22-D-0033',
  task_order_number = NULL,
  client_agency = 'Defense Information Systems Agency',
  client_office = 'DISA Operations Center',
  contract_type = 'T&M',
  contract_value = 5800000.00,
  annual_value = 1933333.00,
  start_date = '2022-07-01',
  end_date = '2025-06-30',
  base_period = '1 year',
  option_periods = 2,
  role = 'Subcontractor',
  percentage_of_work = 40,
  prime_contractor = 'Acme Federal Solutions',
  team_size = 8,
  place_of_performance = 'Fort Meade, MD',
  client_poc = '{"name": "James Mitchell", "title": "Network Operations Branch Chief", "phone": "(301) 225-0100", "email": "james.mitchell.civ@disa.mil", "note": "Strong technical execution"}'::jsonb,
  overview = 'Subcontractor to Acme Federal Solutions providing network monitoring, incident response, and infrastructure management for DISA enterprise network operations supporting 50,000+ DoD users.',
  description_of_effort = 'Provided 24/7 network operations monitoring and incident response for DISA enterprise networks. Managed SolarWinds NPM/SAM deployment monitoring 5,000+ network devices across DoD. Implemented automated alerting and escalation workflows integrated with ServiceNow. Administered Cisco enterprise network infrastructure including routers, switches, and firewalls. Supported Zero Trust Architecture implementation using Cisco ISE for network access control. Performed monthly network vulnerability scanning using ACAS and remediated findings within DISA timelines. Contributed to DISA STIG development for network devices.',
  task_areas = ARRAY['Network Operations Monitoring (24/7)', 'SolarWinds Administration', 'Cisco Network Administration', 'Incident Response', 'Vulnerability Management (ACAS)', 'Zero Trust / Cisco ISE', 'ServiceNow Integration', 'DISA STIG Compliance'],
  tools_used = ARRAY['SolarWinds NPM/SAM', 'Cisco ISE', 'ServiceNow', 'ACAS', 'Splunk', 'Cisco Catalyst/Nexus'],
  achievements = '[
    {"statement": "Maintained 99.9% network availability across monitored infrastructure", "metric_value": "99.9%", "metric_type": "Quality Improvement"},
    {"statement": "Reduced mean time to restore (MTTR) network incidents from 4 hours to 45 minutes", "metric_value": "81% reduction", "metric_type": "Time Savings"},
    {"statement": "Automated 60% of routine network health checks reducing manual effort by 120 hours/month", "metric_value": "120 hrs/month", "metric_type": "Efficiency Gain"},
    {"statement": "Zero critical network outages attributed to TechVision-managed segments", "metric_value": "0 critical outages", "metric_type": "Quality Improvement"},
    {"statement": "Received prime contractor commendation for exceeding all SLA targets for 3 consecutive years", "metric_value": "3 years", "metric_type": "Customer Satisfaction"}
  ]'::jsonb,
  relevance_tags = ARRAY['Network Operations', 'DoD', 'DISA', 'SolarWinds', 'Cisco ISE', 'Zero Trust', '24/7 Operations', 'ServiceNow'],
  cpars_rating = '{"quality": "Exceptional", "schedule": "Very Good", "management": "Very Good", "cost_control": "Satisfactory", "overall": "Very Good"}'::jsonb
WHERE company_id = v_company_id AND contract_nickname = 'GSA Digital Hub';

RAISE NOTICE 'Replaced GSA Digital Hub → DISA NetOps';

-- ============================================================================
RAISE NOTICE '=== All fixes complete: key personnel + service areas + technology + past performance ===';

END $$;
