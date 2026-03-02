-- ============================================================================
-- UNIFIED MOCK DATA SEED SCRIPT
-- Supersedes: seed-mock-company.sql, seed-mock-datacall-arl.sql,
--   update-mock-company-fixes.sql, fix-scorer-findings*.sql,
--   fix-key-personnel-match.sql
--
-- Wipes ALL existing mock data and rebuilds from scratch with:
--   - Consistent personnel names across all tables
--   - DoD IT operations-relevant past performance
--   - Correct user counts (3,500 per SOO)
--   - Complete CPARS (all 5 dimensions)
--   - Valid cert expirations (2027+)
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_sol_id UUID := '1ba2f94d-7b58-4bbc-8b78-296f3e4c1fa6';
  v_dcr_id UUID;
BEGIN

-- Look up existing IDs
SELECT id INTO v_company_id FROM company_profiles WHERE company_name = 'TechVision Federal Solutions' LIMIT 1;
IF v_company_id IS NULL THEN RAISE EXCEPTION 'Company "TechVision Federal Solutions" not found — run the original seed first'; END IF;

SELECT id INTO v_dcr_id FROM data_call_responses WHERE solicitation_id = v_sol_id AND company_id = v_company_id LIMIT 1;
IF v_dcr_id IS NULL THEN RAISE EXCEPTION 'Data call response not found for solicitation %', v_sol_id; END IF;

RAISE NOTICE 'Company ID: %, DCR ID: %', v_company_id, v_dcr_id;

-- ============================================================================
-- STEP 0: WIPE ALL CHILD DATA (preserve company_profiles row and data_call_files)
-- ============================================================================

DELETE FROM touchup_analyses WHERE solicitation_id = v_sol_id;
DELETE FROM proposal_drafts WHERE solicitation_id = v_sol_id;
DELETE FROM competitive_advantages WHERE company_id = v_company_id;
DELETE FROM boilerplate_library WHERE company_id = v_company_id;
DELETE FROM innovations WHERE company_id = v_company_id;
DELETE FROM value_propositions WHERE company_id = v_company_id;
DELETE FROM personnel WHERE company_id = v_company_id;
DELETE FROM past_performance WHERE company_id = v_company_id;
DELETE FROM certifications WHERE company_id = v_company_id;
DELETE FROM contract_vehicles WHERE company_id = v_company_id;
DELETE FROM naics_codes WHERE company_id = v_company_id;
DELETE FROM facility_clearances WHERE company_id = v_company_id;
DELETE FROM service_areas WHERE company_id = v_company_id;
DELETE FROM tools_technologies WHERE company_id = v_company_id;
DELETE FROM methodologies WHERE company_id = v_company_id;

RAISE NOTICE 'Wiped all child data for company %', v_company_id;

-- ============================================================================
-- STEP 1: UPDATE COMPANY PROFILE
-- ============================================================================

UPDATE company_profiles SET
  legal_name = 'TechVision Federal Solutions, LLC',
  dba_names = ARRAY['TechVision', 'TVFS'],
  cage_code = '7X2K9',
  uei_number = 'JM4KDLR8YNHX',
  sam_status = 'Active',
  sam_expiration = '2027-03-15',
  year_founded = 2015,
  headquarters_address = '{"street": "1776 Innovation Way", "suite": "Suite 500", "city": "Arlington", "state": "VA", "zip": "22201"}'::jsonb,
  additional_offices = '[{"street": "100 M Street SE", "suite": "Suite 200", "city": "Washington", "state": "DC", "zip": "20003"}]'::jsonb,
  website = 'https://www.techvisionfed.com',
  employee_count = 145,
  annual_revenue = 28500000.00,
  fiscal_year_end = 'December 31',
  proposal_poc = '{"name": "Sarah Mitchell", "title": "VP of Business Development", "email": "sarah.mitchell@techvisionfed.com", "phone": "(703) 555-0123"}'::jsonb,
  contracts_poc = '{"name": "David Chen", "title": "Contracts Manager", "email": "david.chen@techvisionfed.com", "phone": "(703) 555-0124"}'::jsonb,
  authorized_signer = '{"name": "Jennifer Reynolds", "title": "President & CEO", "email": "jennifer.reynolds@techvisionfed.com"}'::jsonb,
  elevator_pitch = 'TechVision Federal Solutions is a Service-Disabled Veteran-Owned Small Business delivering IT operations, cybersecurity, and enterprise infrastructure management services to DoD and federal civilian agencies.',
  full_description = 'Founded in 2015, TechVision Federal Solutions has grown to 145 employees specializing in enterprise IT service desk operations, infrastructure management, cybersecurity, and ITSM platform administration for DoD and federal civilian agencies. We hold an active GSA MAS contract, CIO-SP3 GWAC position, and maintain Top Secret facility clearance. Our 60% veteran workforce brings mission discipline and federal operations expertise. With Exceptional CPARS ratings across our DoD contracts, we consistently deliver measurable results for complex multi-site IT environments.',
  mission_statement = 'To empower federal agencies with reliable, secure IT operations that enhance mission effectiveness.',
  vision_statement = 'To be the trusted partner of choice for DoD and federal agencies seeking operational IT excellence.',
  core_values = ARRAY['Mission First', 'Integrity', 'Technical Excellence', 'Collaboration', 'Veteran Values'],
  corporate_overview = 'TechVision Federal Solutions is an SDVOSB providing full-spectrum IT operations, cybersecurity, and infrastructure management to the Department of Defense and federal civilian agencies. Our 145-person team includes TS/SCI-cleared cybersecurity professionals, Nutanix/VMware certified systems engineers, CCNP/CCIE network architects, and ServiceNow platform specialists. We operate across classified and unclassified environments with Exceptional CPARS ratings on our DoD IT operations contracts.',
  core_services_summary = 'Enterprise IT service desk operations, infrastructure monitoring and management, cybersecurity and NIST 800-171 compliance, ServiceNow ITSM platform administration, network engineering and Zero Trust architecture, multi-site IT operations for DoD research laboratories.',
  key_differentiators_summary = 'Exceptional CPARS on DoD IT operations contracts; Top Secret facility clearance with TS/SCI-cleared personnel; Nutanix HCI, Cisco ISE, and ServiceNow platform expertise; 60% veteran workforce with DoD mission understanding; proven multi-site management across classified environments.',
  enterprise_win_themes = ARRAY[
    'Proven DoD IT Operations Excellence — Exceptional CPARS across Army and DHS contracts',
    'Cleared Workforce Ready Day One — 45+ Secret/TS-cleared personnel in the pipeline',
    'Multi-Site Management Expertise — Simultaneous operations across 6+ federal sites',
    'SDVOSB with Enterprise Capability — Small business agility backed by 145 technical professionals'
  ],
  standard_management_approach = 'TechVision employs an ITIL v4-aligned management framework with ServiceNow-driven workflows, tiered escalation paths, and per-site operations leads reporting to the Program Manager. We use monthly program management reviews, weekly status meetings with government leadership, and daily stand-ups at each site. Quality is measured through ServiceNow dashboards tracking SLA adherence, first-call resolution, customer satisfaction, and ARCYBER patch compliance.',
  primary_color = '1e3a5f',
  secondary_color = 'c8102e'
WHERE id = v_company_id;

RAISE NOTICE 'Updated company profile';

-- ============================================================================
-- STEP 2: CERTIFICATIONS
-- ============================================================================

INSERT INTO certifications (company_id, certification_type, certifying_agency, certification_number, effective_date, expiration_date) VALUES
(v_company_id, 'Service-Disabled Veteran-Owned Small Business (SDVOSB)', 'VA CVE', 'SDVOSB-2023-1234', '2023-01-15', '2027-01-15'),
(v_company_id, 'Small Disadvantaged Business (SDB)', 'SBA', 'SDB-2022-5678', '2022-06-01', NULL),
(v_company_id, '8(a) Business Development Program', 'SBA', '8A-2021-9012', '2021-03-01', '2030-03-01');

-- ============================================================================
-- STEP 3: NAICS CODES
-- ============================================================================

INSERT INTO naics_codes (company_id, code, title, size_standard, is_primary) VALUES
(v_company_id, '541512', 'Computer Systems Design Services', '$34M', true),
(v_company_id, '541519', 'Other Computer Related Services', '$34M', false),
(v_company_id, '541690', 'Other Scientific and Technical Consulting Services', '$19.5M', false),
(v_company_id, '541611', 'Administrative and General Management Consulting', '$25.5M', false),
(v_company_id, '541330', 'Engineering Services', '$25.5M', false);

-- ============================================================================
-- STEP 4: CONTRACT VEHICLES
-- ============================================================================

INSERT INTO contract_vehicles (company_id, vehicle_name, contract_number, vehicle_type, ordering_period_end, ceiling_value, remaining_ceiling, labor_categories) VALUES
(v_company_id, 'GSA MAS (Multiple Award Schedule)', 'GS-35F-0123R', 'GSA Schedule', '2028-06-30', 100000000, 85000000, ARRAY['Program Manager', 'Senior Systems Engineer', 'Cybersecurity Analyst', 'Network Engineer', 'Service Desk Manager']),
(v_company_id, 'CIO-SP3', '47QTCK19D0001', 'GWAC', '2027-12-31', 20000000000, 18500000000, ARRAY['Program Manager', 'Systems Engineer', 'Cybersecurity Engineer', 'Network Engineer']),
(v_company_id, 'ITES-3S', 'W52P1J-20-D-0001', 'IDIQ', '2029-09-30', 12600000000, 11000000000, ARRAY['Program Manager', 'Systems Administrator', 'Network Engineer', 'Service Desk Specialist']);

-- ============================================================================
-- STEP 5: FACILITY CLEARANCE
-- ============================================================================

INSERT INTO facility_clearances (company_id, has_facility_clearance, clearance_level, sponsoring_agency, cage_code_cleared, safeguarding_capability) VALUES
(v_company_id, true, 'Top Secret', 'Department of the Army', '7X2K9', 'Top Secret');

-- ============================================================================
-- STEP 6: SERVICE AREAS
-- ============================================================================

INSERT INTO service_areas (company_id, service_name, description, experience_years, key_clients, relevant_naics) VALUES
(v_company_id, 'Enterprise IT Service Desk Operations', 'ITIL v4-aligned tiered service desk operations supporting 1,000-10,000+ users across classified and unclassified environments.', 8, ARRAY['US Army', 'DHS', 'DISA'], ARRAY['541512', '541519']),
(v_company_id, 'Infrastructure Management', 'Server, storage, network, and endpoint management including Nutanix HCI, Windows/Linux, and multi-site monitoring.', 8, ARRAY['US Army', 'ARL', 'DHS'], ARRAY['541512', '541519']),
(v_company_id, 'Cybersecurity & NIST Compliance', 'HBSS/ESS deployment, STIG enforcement, ARCYBER patch management, RMF artifact delivery, NIST SP 800-171 compliance.', 8, ARRAY['DHS', 'DOD', 'US Army'], ARRAY['541512', '541690']),
(v_company_id, 'ServiceNow ITSM Platform', 'Full lifecycle ServiceNow implementation, administration, and custom development including ITSM, ITOM, ITAM, CSM, HAM, SAM.', 7, ARRAY['EPA', 'US Army', 'VA'], ARRAY['541512', '541519']),
(v_company_id, 'Network Engineering & Zero Trust', 'Cisco ISE, SolarWinds, Comply-to-Connect, VoIP, and full-spectrum network management for DoD environments.', 6, ARRAY['DISA', 'US Army', 'DHS'], ARRAY['541512', '541519']);

-- ============================================================================
-- STEP 7: TOOLS & TECHNOLOGIES
-- ============================================================================

INSERT INTO tools_technologies (company_id, name, category, proficiency, years_experience, certified_practitioners, description) VALUES
(v_company_id, 'ServiceNow', 'IT Service Management', 'Expert', 7, 6, 'ITSM, ITOM, ITAM, CSM, HAM, SAM platform administration'),
(v_company_id, 'Nutanix HCI', 'Infrastructure', 'Expert', 5, 3, 'Hyperconverged infrastructure for DoD server environments'),
(v_company_id, 'Cisco ISE', 'Network Security', 'Expert', 4, 4, 'Zero Trust network access control and Comply-to-Connect'),
(v_company_id, 'SolarWinds NPM/SAM', 'Monitoring', 'Expert', 6, 4, 'Network and application performance monitoring'),
(v_company_id, 'Nagios', 'Monitoring', 'Proficient', 5, 3, 'Infrastructure availability monitoring'),
(v_company_id, 'HBSS/ESS', 'Endpoint Security', 'Expert', 8, 5, 'DoD Host-Based Security System management'),
(v_company_id, 'Microsoft SCCM', 'Endpoint Management', 'Expert', 8, 6, 'Windows endpoint imaging, patching, software distribution'),
(v_company_id, 'Splunk', 'Security/SIEM', 'Proficient', 6, 3, 'Security log aggregation and incident detection'),
(v_company_id, 'Microsoft Intune', 'MDM', 'Proficient', 4, 3, 'Mobile device management per DISA policy'),
(v_company_id, 'JAMF', 'Endpoint Management', 'Proficient', 3, 2, 'macOS endpoint management for DoD');

-- ============================================================================
-- STEP 8: METHODOLOGIES
-- ============================================================================

INSERT INTO methodologies (company_id, name, category, implementation_experience, certified_practitioners) VALUES
(v_company_id, 'ITIL v4', 'IT Service Management', 'Core framework for all IT service delivery contracts. Implemented ITIL processes for 5+ federal agencies.', 25),
(v_company_id, 'NIST Cybersecurity Framework', 'Security', 'Applied NIST CSF and 800-171 for DoD and federal civilian RMF assessments.', 10),
(v_company_id, 'CMMI Level 3', 'Quality', 'Organizational CMMI Level 3 certification. Embedded process improvement across all programs.', 45),
(v_company_id, 'SAFe (Scaled Agile Framework)', 'Agile', 'Applied to program management and IT operations improvement initiatives.', 8),
(v_company_id, 'TOGAF', 'Architecture', 'Enterprise architecture planning for infrastructure modernization.', 4);

-- ============================================================================
-- STEP 9: PAST PERFORMANCE (4 DoD IT Ops-relevant contracts)
-- ============================================================================

INSERT INTO past_performance (
  company_id, contract_nickname, contract_name, contract_number, task_order_number,
  client_agency, client_office,
  contract_type, contract_value, annual_value, start_date, end_date, base_period, option_periods,
  role, percentage_of_work, prime_contractor, team_size, place_of_performance,
  client_poc, cpars_rating,
  overview, description_of_effort,
  task_areas, tools_used, achievements, relevance_tags
) VALUES

-- PP-1: Army IT Ops Fort Belvoir
(v_company_id, 'Army IT Ops Fort Belvoir',
 'Enterprise IT Service Desk and Infrastructure Management',
 'W91QUZ-19-D-0045', 'TO-001',
 'Department of the Army', 'NETCOM / Fort Belvoir Garrison',
 'Cost-Plus', 11200000, 2240000, '2019-10-01', '2024-09-30', '1 year', 4,
 'Prime', 100, NULL, 42, 'Fort Belvoir, VA',
 '{"name": "COL David Richards", "title": "COR, NETCOM IT Operations", "phone": "(703) 806-4000", "email": "david.richards.civ@army.mil"}'::jsonb,
 '{"overall": "Exceptional", "quality": "Exceptional", "schedule": "Exceptional", "management": "Exceptional", "cost_control": "Very Good"}'::jsonb,
 'Prime contractor for full-spectrum IT service desk and infrastructure management supporting 4,200 Army users across classified (SIPR) and unclassified (NIPR) networks at Fort Belvoir.',
 'Delivered ITIL v4-aligned tiered service desk (Tier 0-3) with ServiceNow ITSM platform, achieving 83% first-call resolution. Managed Nutanix HCI server infrastructure, Cisco ISE Zero Trust network access, HBSS/ESS endpoint security, and SolarWinds/Nagios monitoring across 6 buildings. Administered 4,200 user accounts in Active Directory with STIG-compliant endpoints. Provided 24/7 classified environment support for SIPR and JWICS. Maintained 100% ARCYBER patch compliance. Executed 3 site-level technology refresh projects on schedule and under budget.',
 ARRAY['Service Desk Operations', 'Infrastructure Management', 'Cybersecurity', 'Network Engineering', 'ServiceNow ITSM', 'Endpoint Management', 'Classified Support'],
 ARRAY['ServiceNow', 'Nutanix', 'Cisco ISE', 'HBSS/ESS', 'SolarWinds', 'Nagios', 'SCCM', 'Active Directory', 'Splunk'],
 '[
   {"statement": "Achieved 83% first-call resolution rate exceeding 80% SLA target", "metric_value": "83% FCR", "metric_type": "Quality Improvement"},
   {"statement": "Maintained 99.95% server uptime across Nutanix HCI clusters", "metric_value": "99.95%", "metric_type": "Quality Improvement"},
   {"statement": "100% ARCYBER patch compliance for 48 consecutive months", "metric_value": "100%", "metric_type": "Compliance"},
   {"statement": "Reduced average incident resolution time from 8 hours to 3.2 hours", "metric_value": "60% reduction", "metric_type": "Time Savings"},
   {"statement": "Zero classified spillage incidents across 5-year performance period", "metric_value": "0 spillages", "metric_type": "Quality Improvement"},
   {"statement": "Transitioned from incumbent in 22 days vs 30-day requirement", "metric_value": "22 days", "metric_type": "Time Savings"}
 ]'::jsonb,
 ARRAY['DoD', 'Army', 'IT Operations', 'Service Desk', 'Infrastructure', 'Classified', 'Multi-Site']
),

-- PP-2: ARL APG IT Infrastructure
(v_company_id, 'ARL APG IT Infrastructure',
 'IT Infrastructure Management and User Support Services',
 'W56KGZ-21-D-0012', 'TO-003',
 'Army Research Laboratory', 'ARL Aberdeen Proving Ground',
 'Cost-Plus', 8500000, 1700000, '2021-04-01', '2026-03-31', '1 year', 4,
 'Prime', 100, NULL, 28, 'Aberdeen Proving Ground, MD',
 '{"name": "Dr. Susan Park", "title": "ARL IT Director", "phone": "(410) 306-0500", "email": "susan.park.civ@arl.army.mil"}'::jsonb,
 '{"overall": "Exceptional", "quality": "Exceptional", "schedule": "Very Good", "management": "Exceptional", "cost_control": "Exceptional"}'::jsonb,
 'Prime contractor providing IT infrastructure management and user support for 2,800 ARL researchers and staff at Aberdeen Proving Ground across classified and unclassified environments.',
 'Managed enterprise IT infrastructure for ARL APG including Nutanix HCI clusters, Windows/Linux server administration, Cisco network equipment (ISE, switches, routers), and SolarWinds monitoring. Operated tiered service desk with ServiceNow ITSM, supporting 2,800 researchers across 5 buildings. Administered HBSS/ESS endpoint security and maintained STIG compliance on all systems. Supported SIPR, NIPR, and DREN network segments. Provided AV/VTC support for research collaboration facilities. Managed IT asset lifecycle per AR 735-5.',
 ARRAY['Infrastructure Management', 'Service Desk', 'Network Engineering', 'Cybersecurity', 'Asset Management', 'AV/VTC Support', 'Classified Support'],
 ARRAY['Nutanix', 'ServiceNow', 'Cisco ISE', 'SolarWinds', 'HBSS/ESS', 'SCCM', 'ACAS', 'Splunk', 'Active Directory'],
 '[
   {"statement": "Maintained 99.9% infrastructure availability across all Nutanix clusters", "metric_value": "99.9%", "metric_type": "Quality Improvement"},
   {"statement": "Reduced service desk ticket backlog by 45% within first 6 months", "metric_value": "45% reduction", "metric_type": "Efficiency Gain"},
   {"statement": "Achieved 100% STIG compliance across 2,800 managed endpoints", "metric_value": "100% STIG", "metric_type": "Compliance"},
   {"statement": "Completed $2.3M technology refresh project 3 weeks ahead of schedule", "metric_value": "3 weeks early", "metric_type": "Time Savings"},
   {"statement": "User satisfaction score of 4.6/5.0 across all ARL sites", "metric_value": "4.6/5.0", "metric_type": "Customer Satisfaction"}
 ]'::jsonb,
 ARRAY['DoD', 'Army', 'ARL', 'IT Infrastructure', 'Service Desk', 'Aberdeen', 'Research Lab', 'Classified']
),

-- PP-3: DHS Cybersecurity Operations
(v_company_id, 'DHS Cybersecurity Ops',
 'Enterprise Cybersecurity Operations and Compliance Management',
 '70RSAT20D00000001', 'TO-001',
 'Department of Homeland Security', 'Office of the CISO',
 'T&M', 12500000, 2500000, '2020-01-15', '2025-01-14', '1 year', 4,
 'Prime', 100, NULL, 18, 'Washington, DC (Hybrid)',
 '{"name": "Michael Thompson", "title": "CISO", "phone": "(202) 555-0100", "email": "michael.thompson@hq.dhs.gov"}'::jsonb,
 '{"overall": "Exceptional", "quality": "Exceptional", "schedule": "Exceptional", "management": "Very Good", "cost_control": "Very Good"}'::jsonb,
 'Prime contractor for DHS enterprise cybersecurity operations including SOC management, vulnerability assessments, NIST compliance, and incident response for 50+ systems and 10,000+ users.',
 'Provided 24/7 Security Operations Center monitoring and incident response, quarterly vulnerability assessments and penetration testing, FISMA and NIST 800-53 compliance management, HBSS/ESS endpoint security, Splunk SIEM operations, and ATO package support. Managed cybersecurity for classified and unclassified DHS environments. Implemented zero-trust architecture principles. Automated 70% of security monitoring processes.',
 ARRAY['SOC Operations', 'Vulnerability Management', 'Penetration Testing', 'FISMA/NIST Compliance', 'Incident Response', 'HBSS/ESS', 'Splunk SIEM', 'Zero Trust'],
 ARRAY['Splunk', 'HBSS/ESS', 'ACAS', 'Tenable Nessus', 'CrowdStrike', 'ServiceNow SecOps'],
 '[
   {"statement": "Achieved 99.8% SOC uptime over 5-year performance period", "metric_value": "99.8%", "metric_type": "Quality Improvement"},
   {"statement": "Reduced mean time to detect from 48 hours to 2 hours", "metric_value": "96% reduction", "metric_type": "Time Savings"},
   {"statement": "Completed 20+ ATO packages with zero critical findings", "metric_value": "20+ ATOs", "metric_type": "Compliance"},
   {"statement": "Identified and remediated 500+ critical vulnerabilities before exploitation", "metric_value": "500+ vulns", "metric_type": "Quality Improvement"},
   {"statement": "Saved $2M annually through security monitoring automation", "metric_value": "$2M/year", "metric_type": "Cost Savings"}
 ]'::jsonb,
 ARRAY['Cybersecurity', 'DHS', 'SOC', 'NIST', 'Incident Response', 'Zero Trust', 'Classified']
),

-- PP-4: Acme DoD NetOps (subcontractor reference)
(v_company_id, 'Acme DoD NetOps',
 'DoD Enterprise Network Operations and Monitoring',
 'W15P7T-20-D-0082', NULL,
 'Department of Defense / DISA', 'Defense Information Systems Agency — Field Operations',
 'Cost-Plus', 14800000, 2960000, '2020-01-15', '2025-01-14', '1 year', 4,
 'Subcontractor', 20, 'Acme Federal Solutions', 55, 'Fort Meade, MD; Pentagon; Various DoD installations',
 '{"name": "LTC Sarah Mitchell", "title": "COR, DISA Network Operations Division", "phone": "(301) 225-4800", "email": "sarah.mitchell.civ@disa.mil"}'::jsonb,
 '{"overall": "Exceptional", "quality": "Very Good", "schedule": "Exceptional", "management": "Exceptional", "cost_control": "Very Good"}'::jsonb,
 'Acme Federal Solutions (proposed 20% workshare subcontractor) served as prime on this DISA enterprise network operations contract. TechVision provided SIEM integration and incident response support.',
 'Full-spectrum NOC management including 24/7 monitoring of DoD enterprise networks using SolarWinds NPM, Cisco DNA Center, and SNMP-based monitoring. Managed Cisco ISE for Comply-to-Connect enforcement across classified and unclassified segments. Incident response team achieved <15 minute MTTD for critical events. Supported SIPR, NIPR, and JWICS. TS/SCI-cleared personnel.',
 ARRAY['Network Operations', 'NOC Management', 'Incident Response', 'Cisco ISE', 'Comply-to-Connect', 'Classified Network Support', 'SIEM'],
 ARRAY['SolarWinds NPM', 'Cisco DNA Center', 'Cisco ISE', 'Splunk', 'HBSS/ESS', 'Wireshark', 'ServiceNow'],
 '[
   {"statement": "Achieved 99.97% network uptime across all monitored installations", "metric_value": "99.97%", "metric_type": "Quality Improvement"},
   {"statement": "Reduced MTTD from 45 minutes to under 15 minutes for critical events", "metric_value": "MTTD <15 min", "metric_type": "Time Savings"},
   {"statement": "Implemented Cisco ISE Comply-to-Connect across 12 installations with zero mission impact", "metric_value": "12 installations", "metric_type": "Quality Improvement"},
   {"statement": "Managed 50,000+ endpoint devices across classified and unclassified segments", "metric_value": "50,000+ endpoints", "metric_type": "Other"}
 ]'::jsonb,
 ARRAY['DoD', 'DISA', 'Network Operations', 'NOC', 'Cisco ISE', 'Classified', 'Multi-Site']
);

RAISE NOTICE 'Inserted 4 past performance records';

-- ============================================================================
-- STEP 10: PERSONNEL (7 people — 3 key personnel, 4 support)
-- ============================================================================

INSERT INTO personnel (
  company_id, status, full_name, email, phone, employment_type,
  availability, geographic_location, relocation_willing, remote_capable,
  clearance_level, clearance_status,
  education, certifications,
  total_experience_years, federal_experience_years, relevant_experience_years,
  work_history, proposed_roles
) VALUES

-- KP-1: Michael Anderson — Program Manager
(v_company_id, 'Active', 'Michael Anderson', 'michael.anderson@techvisionfed.com', '(703) 555-1001', 'W2 Employee',
 'Immediately Available', 'Washington, DC Metro', false, true,
 'Secret', 'Active',
 '[{"degree_level": "Master", "field_of_study": "Information Technology Management", "institution": "Johns Hopkins University", "graduation_year": 2008},
   {"degree_level": "Bachelor", "field_of_study": "Computer Science", "institution": "Virginia Tech", "graduation_year": 2002}]'::jsonb,
 '[{"name": "PMP (Project Management Professional)", "issuing_body": "PMI", "date_obtained": "2009-06-15", "expiration_date": "2027-06-15", "certification_number": "PMP-123456"},
   {"name": "ITIL v4 Foundation", "issuing_body": "Axelos", "date_obtained": "2020-01-10", "expiration_date": null, "certification_number": "ITIL4-789"},
   {"name": "SAFe Program Consultant (SPC)", "issuing_body": "Scaled Agile", "date_obtained": "2021-03-20", "expiration_date": "2027-03-20", "certification_number": "SPC-789012"}]'::jsonb,
 22, 15, 20,
 '[{"job_title": "Senior Program Manager", "employer": "TechVision Federal Solutions", "start_date": "01/2018", "end_date": "Present", "description": "Program Manager for Army IT operations contracts including Fort Belvoir (42 FTEs, $11.2M) and ARL APG (28 FTEs, $8.5M). Manages cross-functional teams across classified environments.", "client_agency": "US Army, DHS", "relevant_skills": ["ITIL", "ServiceNow", "DoD IT Operations"]},
   {"job_title": "IT Project Manager", "employer": "Federal Solutions Inc", "start_date": "06/2012", "end_date": "12/2017", "description": "Managed DoD IT modernization projects for NETCOM and DISA.", "client_agency": "DOD, DISA", "relevant_skills": ["Project Management", "ITIL", "DoD"]}]'::jsonb,
 '[{"role_title": "Program Manager", "is_key_personnel": true, "labor_category": "Program Manager IV", "bill_rate": 185.00, "cost_rate": 125.00, "summary_for_role": "22 years IT program management, 15 years federal. PMP and ITIL v4 certified. Managed $20M+ DoD IT operations programs with Exceptional CPARS. Expert in multi-site service desk and infrastructure management."}]'::jsonb
),

-- KP-2: Dr. Priya Patel — Lead Systems Engineer
(v_company_id, 'Active', 'Dr. Priya Patel', 'priya.patel@techvisionfed.com', '(703) 555-1002', 'W2 Employee',
 'Immediately Available', 'Arlington, VA', true, true,
 'Secret', 'Active',
 '[{"degree_level": "Doctorate", "field_of_study": "Computer Engineering", "institution": "MIT", "graduation_year": 2010},
   {"degree_level": "Master", "field_of_study": "Computer Science", "institution": "Stanford University", "graduation_year": 2005}]'::jsonb,
 '[{"name": "AWS Certified Solutions Architect - Professional", "issuing_body": "Amazon Web Services", "date_obtained": "2022-08-10", "expiration_date": "2027-08-10", "certification_number": "AWS-SAP-123"},
   {"name": "Microsoft Certified: Azure Solutions Architect Expert", "issuing_body": "Microsoft", "date_obtained": "2021-04-15", "expiration_date": "2027-04-15", "certification_number": "MCSE-456"},
   {"name": "VMware Certified Professional (VCP)", "issuing_body": "VMware", "date_obtained": "2020-09-01", "expiration_date": "2027-09-01", "certification_number": "VCP-789"},
   {"name": "Nutanix Certified Professional (NCP)", "issuing_body": "Nutanix", "date_obtained": "2022-01-15", "expiration_date": "2027-01-15", "certification_number": "NCP-012"}]'::jsonb,
 19, 12, 18,
 '[{"job_title": "Lead Systems Engineer", "employer": "TechVision Federal Solutions", "start_date": "03/2016", "end_date": "Present", "description": "Lead infrastructure architect for DoD IT operations. Designed and managed Nutanix HCI environments, Windows/Linux servers, and VMware virtualization for Army contracts. Led $2.3M technology refresh at ARL APG.", "client_agency": "US Army, ARL, DHS", "relevant_skills": ["Nutanix", "VMware", "STIG Compliance", "Infrastructure Architecture"]}]'::jsonb,
 '[{"role_title": "Lead Systems Engineer", "is_key_personnel": true, "labor_category": "Systems Engineer IV", "bill_rate": 195.00, "cost_rate": 135.00, "summary_for_role": "19 years enterprise infrastructure, 12 years federal. Nutanix NCP, AWS SAP, VCP certified. Led infrastructure management for 2,800-user ARL environment with 99.9% uptime."}]'::jsonb
),

-- KP-3: James Rodriguez — Cybersecurity Lead
(v_company_id, 'Active', 'James Rodriguez', 'james.rodriguez@techvisionfed.com', '(703) 555-1003', 'W2 Employee',
 '2 Weeks Notice', 'Remote (MD)', false, true,
 'TS/SCI', 'Active',
 '[{"degree_level": "Master", "field_of_study": "Cybersecurity", "institution": "SANS Technology Institute", "graduation_year": 2012},
   {"degree_level": "Bachelor", "field_of_study": "Information Systems", "institution": "University of Maryland", "graduation_year": 2008}]'::jsonb,
 '[{"name": "CISSP", "issuing_body": "ISC2", "date_obtained": "2012-09-20", "expiration_date": "2027-09-20", "certification_number": "CISSP-789"},
   {"name": "CEH (Certified Ethical Hacker)", "issuing_body": "EC-Council", "date_obtained": "2014-03-15", "expiration_date": "2027-03-15", "certification_number": "CEH-012"},
   {"name": "HBSS Administrator", "issuing_body": "McAfee/Trellix", "date_obtained": "2019-06-01", "expiration_date": "2027-06-01", "certification_number": "HBSS-345"}]'::jsonb,
 16, 14, 16,
 '[{"job_title": "Cybersecurity Director", "employer": "TechVision Federal Solutions", "start_date": "01/2017", "end_date": "Present", "description": "Leads cybersecurity operations for DoD and DHS contracts. Manages HBSS/ESS deployment, ARCYBER patch compliance, STIG enforcement, and classified spillage response. Led DHS SOC achieving 99.8% uptime.", "client_agency": "DHS, US Army, DOD", "relevant_skills": ["HBSS/ESS", "NIST 800-171", "Splunk", "Incident Response", "RMF"]}]'::jsonb,
 '[{"role_title": "Cybersecurity Lead", "is_key_personnel": true, "labor_category": "Cybersecurity Engineer IV", "bill_rate": 175.00, "cost_rate": 120.00, "summary_for_role": "16 years cybersecurity, 14 years federal. CISSP, CEH, HBSS Admin certified. TS/SCI cleared. Led DHS SOC operations and DoD ARCYBER compliance programs with zero critical findings."}]'::jsonb
),

-- SP-1: Karen Mitchell — Service Desk Manager
(v_company_id, 'Active', 'Karen Mitchell', 'karen.mitchell@techvisionfed.com', '(703) 555-1004', 'W2 Employee',
 'Immediately Available', 'Aberdeen, MD', false, false,
 'Secret', 'Active',
 '[{"degree_level": "Bachelor", "field_of_study": "Information Technology", "institution": "Towson University", "graduation_year": 2012}]'::jsonb,
 '[{"name": "HDI Support Center Analyst (HDI-SCA)", "issuing_body": "HDI", "date_obtained": "2018-05-01", "expiration_date": "2027-05-01", "certification_number": "HDI-SCA-100"},
   {"name": "ITIL v4 Foundation", "issuing_body": "Axelos", "date_obtained": "2020-02-15", "expiration_date": null, "certification_number": "ITIL4-200"}]'::jsonb,
 12, 8, 10,
 '[{"job_title": "Service Desk Manager", "employer": "TechVision Federal Solutions", "start_date": "04/2019", "end_date": "Present", "description": "Manages 15-person service desk team at Fort Belvoir. Achieved 83% first-call resolution. ServiceNow queue management and SLA reporting.", "client_agency": "US Army", "relevant_skills": ["ServiceNow", "ITIL", "Service Desk Management"]}]'::jsonb,
 '[{"role_title": "Service Desk Manager", "is_key_personnel": false, "labor_category": "Service Desk Manager III", "bill_rate": 125.00, "cost_rate": 85.00}]'::jsonb
),

-- SP-2: David Thompson — Network Engineer
(v_company_id, 'Active', 'David Thompson', 'david.thompson@techvisionfed.com', '(703) 555-1005', 'W2 Employee',
 'Immediately Available', 'Aberdeen, MD', false, false,
 'Secret', 'Active',
 '[{"degree_level": "Bachelor", "field_of_study": "Network Engineering", "institution": "George Mason University", "graduation_year": 2013}]'::jsonb,
 '[{"name": "CCNP Enterprise", "issuing_body": "Cisco", "date_obtained": "2019-11-01", "expiration_date": "2027-11-01", "certification_number": "CCNP-300"},
   {"name": "Cisco ISE Administrator", "issuing_body": "Cisco", "date_obtained": "2021-03-01", "expiration_date": "2027-03-01", "certification_number": "ISE-400"}]'::jsonb,
 11, 7, 9,
 '[{"job_title": "Senior Network Engineer", "employer": "TechVision Federal Solutions", "start_date": "06/2019", "end_date": "Present", "description": "Cisco ISE administration, Zero Trust implementation, Comply-to-Connect enforcement at Fort Belvoir and ARL APG. SolarWinds monitoring.", "client_agency": "US Army, ARL", "relevant_skills": ["Cisco ISE", "SolarWinds", "Zero Trust", "Comply-to-Connect"]}]'::jsonb,
 '[{"role_title": "Network Engineer", "is_key_personnel": false, "labor_category": "Network Engineer III", "bill_rate": 145.00, "cost_rate": 95.00}]'::jsonb
),

-- SP-3: Lisa Park — Systems Administrator
(v_company_id, 'Active', 'Lisa Park', 'lisa.park@techvisionfed.com', '(703) 555-1006', 'W2 Employee',
 'Immediately Available', 'Adelphi, MD', false, false,
 'Secret', 'Active',
 '[{"degree_level": "Bachelor", "field_of_study": "Computer Science", "institution": "University of Maryland", "graduation_year": 2015}]'::jsonb,
 '[{"name": "MCSE (Microsoft Certified Solutions Expert)", "issuing_body": "Microsoft", "date_obtained": "2019-08-01", "expiration_date": "2027-08-01", "certification_number": "MCSE-500"},
   {"name": "Nutanix Certified Professional (NCP)", "issuing_body": "Nutanix", "date_obtained": "2022-06-01", "expiration_date": "2027-06-01", "certification_number": "NCP-600"}]'::jsonb,
 9, 6, 8,
 '[{"job_title": "Senior Systems Administrator", "employer": "TechVision Federal Solutions", "start_date": "01/2020", "end_date": "Present", "description": "Nutanix HCI cluster management, Windows/Linux server administration, STIG compliance enforcement at ARL APG.", "client_agency": "US Army, ARL", "relevant_skills": ["Nutanix", "Windows Server", "Linux", "STIG Compliance"]}]'::jsonb,
 '[{"role_title": "Systems Administrator", "is_key_personnel": false, "labor_category": "Systems Administrator III", "bill_rate": 130.00, "cost_rate": 88.00}]'::jsonb
),

-- SP-4: Robert Kim — ServiceNow Developer
(v_company_id, 'Active', 'Robert Kim', 'robert.kim@techvisionfed.com', '(703) 555-1007', 'W2 Employee',
 'Immediately Available', 'Arlington, VA', false, true,
 'Secret', 'Active',
 '[{"degree_level": "Bachelor", "field_of_study": "Software Engineering", "institution": "Virginia Tech", "graduation_year": 2016}]'::jsonb,
 '[{"name": "ServiceNow Certified System Administrator (CSA)", "issuing_body": "ServiceNow", "date_obtained": "2020-04-01", "expiration_date": null, "certification_number": "CSA-700"},
   {"name": "ServiceNow Certified Application Developer (CAD)", "issuing_body": "ServiceNow", "date_obtained": "2021-09-01", "expiration_date": null, "certification_number": "CAD-800"}]'::jsonb,
 8, 5, 7,
 '[{"job_title": "ServiceNow Developer", "employer": "TechVision Federal Solutions", "start_date": "08/2020", "end_date": "Present", "description": "ServiceNow platform administration and custom development for EPA ITSM and Army IT operations. CMDB governance, workflow automation, module configuration.", "client_agency": "EPA, US Army", "relevant_skills": ["ServiceNow", "JavaScript", "ITSM", "ITOM"]}]'::jsonb,
 '[{"role_title": "ServiceNow Developer", "is_key_personnel": false, "labor_category": "Application Developer III", "bill_rate": 140.00, "cost_rate": 92.00}]'::jsonb
);

RAISE NOTICE 'Inserted 7 personnel records';

-- ============================================================================
-- STEP 11: VALUE PROPOSITIONS
-- ============================================================================

INSERT INTO value_propositions (company_id, theme, statement, proof_points, applicable_to) VALUES
(v_company_id, 'Proven DoD IT Operations Excellence',
 'TechVision delivers Exceptional CPARS-rated IT operations for DoD research and garrison environments with multi-site management expertise.',
 ARRAY['Exceptional CPARS on Army Fort Belvoir ($11.2M) and ARL APG ($8.5M) IT operations', '83% first-call resolution exceeding 80% SLA target', '99.95% server uptime across Nutanix HCI clusters', '100% ARCYBER patch compliance for 48 consecutive months'],
 ARRAY['DoD IT Operations', 'Army', 'ARL', 'Service Desk']),
(v_company_id, 'Cleared Workforce Ready Day One',
 'With 45+ Secret/TS-cleared personnel in our pipeline and Top Secret facility clearance, TechVision eliminates clearance-related transition delays.',
 ARRAY['Top Secret facility clearance (CAGE 7X2K9)', 'TS/SCI-cleared Cybersecurity Lead', '45+ pre-cleared personnel available for rapid staffing', '22-day transition at Fort Belvoir vs 30-day requirement'],
 ARRAY['DoD', 'Classified', 'Transition']),
(v_company_id, 'Multi-Site Management Expertise',
 'TechVision manages simultaneous IT operations across 6+ DoD sites with centralized NOC oversight and per-site operations leads.',
 ARRAY['Concurrent operations at Fort Belvoir (42 FTEs) and ARL APG (28 FTEs)', 'SolarWinds/Nagios centralized monitoring with per-site dashboards', 'ServiceNow-driven workflow standardization across all sites'],
 ARRAY['Multi-Site', 'DoD', 'IT Operations']),
(v_company_id, 'SDVOSB with Enterprise Capability',
 'Small business agility backed by 145 technical professionals and Exceptional CPARS on DoD contracts exceeding $10M.',
 ARRAY['145 employees, 60% veteran workforce', 'SDVOSB, SDB, 8(a) certified', 'GSA MAS, CIO-SP3, ITES-3S contract vehicles', 'C-suite directly engaged on all programs'],
 ARRAY['SDVOSB', 'Small Business', 'Set-Aside']);

-- ============================================================================
-- STEP 12: COMPETITIVE ADVANTAGES
-- ============================================================================

INSERT INTO competitive_advantages (company_id, area, our_strength, competitor_weakness, ghosting_phrase) VALUES
(v_company_id, 'Same-Site Experience',
 'Currently performing IT infrastructure management at ARL APG — same customer, same site, same systems',
 'New contractors face steep learning curve for ARL-specific networks, classified environments, and research workflows',
 'Our existing presence at ARL APG eliminates transition risk and ensures continuity of service — no learning curve, no knowledge gaps, no disruption to research operations.'),
(v_company_id, 'Top Secret Facility Clearance',
 'Top Secret FCL with TS/SCI-cleared cybersecurity personnel already supporting classified environments',
 'Contractors without TS FCL require 6-12 month clearance processing that delays classified support',
 'Unlike contractors requiring new clearances, our team is already TS/SCI-cleared and badged for classified operations, avoiding delays that impact mission-critical support.'),
(v_company_id, 'DoD IT Operations Track Record',
 'Exceptional CPARS on two concurrent Army IT operations contracts ($19.7M combined)',
 'Many competitors cite federal civilian contracts but lack DoD IT operations experience with ARCYBER compliance and classified environments',
 'Our Army-specific IT operations experience — including ARCYBER patch compliance, STIG enforcement, and classified spillage response — provides capabilities that general federal IT contractors typically lack.'),
(v_company_id, 'SDVOSB Status',
 'Service-Disabled Veteran-Owned Small Business with 60% veteran workforce and DoD mission understanding',
 'Large commercial firms lack small business status and may not understand DoD operational tempo',
 'As a certified SDVOSB with veteran leadership and proven DoD performance, we combine mission understanding with responsive, partner-level engagement.'),
(v_company_id, 'Technology Platform Depth',
 'Nutanix NCP, Cisco ISE, ServiceNow CSA/CAD, HBSS Admin — certified staff for every required platform',
 'Competitors often lack certifications for the specific technology stack required by this contract',
 'Our team holds active certifications for every platform specified in the SOO — Nutanix, Cisco ISE, ServiceNow, HBSS — ensuring qualified operators from Day One.');

-- ============================================================================
-- STEP 13: BOILERPLATE LIBRARY
-- ============================================================================

INSERT INTO boilerplate_library (company_id, type, variant, content) VALUES
(v_company_id, 'company_intro', 'short',
 'TechVision Federal Solutions is a Service-Disabled Veteran-Owned Small Business (SDVOSB) delivering enterprise IT operations, cybersecurity, and infrastructure management services to DoD and federal civilian agencies. With Exceptional CPARS on Army IT operations contracts and Top Secret facility clearance, we provide cleared, certified teams ready for Day One operations.'),
(v_company_id, 'company_intro', 'medium',
 'TechVision Federal Solutions is an SDVOSB specializing in IT service desk operations, infrastructure management, cybersecurity, and ServiceNow ITSM administration for DoD and federal agencies. Our 145-person team includes TS/SCI-cleared cybersecurity professionals, Nutanix/VMware certified engineers, CCNP/Cisco ISE network architects, and ServiceNow CSA/CAD developers. We hold Top Secret facility clearance, GSA MAS, CIO-SP3, and ITES-3S contract vehicles. Our DoD contracts have earned Exceptional CPARS ratings with 99.95% infrastructure uptime, 83% first-call resolution, and 100% ARCYBER patch compliance.'),
(v_company_id, 'transition_approach', NULL,
 'TechVision achieves operational readiness in 15-30 days through phased knowledge transfer, parallel operations with the incumbent, and pre-cleared personnel deployment. Our last 5 DoD transitions averaged 22 days to full operational capability with zero service interruptions. We assign a dedicated Transition Manager and maintain 24/7 coverage during cutover.'),
(v_company_id, 'quality_approach', NULL,
 'TechVision''s quality management system is CMMI Level 3 certified and integrates ITIL v4 practices throughout service delivery. We measure quality through ServiceNow dashboards tracking SLA adherence, first-call resolution, customer satisfaction, and ARCYBER patch compliance. Monthly quality reviews with trend analysis drive continuous improvement.'),
(v_company_id, 'risk_management_approach', NULL,
 'TechVision maintains an active risk register reviewed weekly by the Program Manager and monthly with government stakeholders. Each risk is assessed for probability, impact, and velocity with clear ownership and mitigation plans. We emphasize early identification and proactive mitigation — our risk approach has prevented major issues on 95% of our DoD contracts.'),
(v_company_id, 'small_business_statement', NULL,
 'TechVision Federal Solutions is a Service-Disabled Veteran-Owned Small Business (SDVOSB) certified by the VA CVE. We are SBA-certified as a Small Disadvantaged Business (SDB) and participate in the SBA 8(a) Business Development Program. CAGE code 7X2K9, UEI JM4KDLR8YNHX. Active SAM registration expiring March 15, 2027.');

-- ============================================================================
-- STEP 14: INNOVATIONS
-- ============================================================================

INSERT INTO innovations (company_id, name, description, evidence, proprietary) VALUES
(v_company_id, 'Proactive Monitoring Dashboard',
 'Custom SolarWinds/Nagios integration dashboard providing single-pane visibility across all site infrastructure with automated escalation workflows.',
 'Deployed at Fort Belvoir and ARL APG. Identifies 85% of issues before user impact. Reduced alert noise by 70% through event correlation.',
 false),
(v_company_id, 'Automated STIG Compliance Engine',
 'Automated STIG checking and remediation pipeline using SCAP, ACAS, and SCCM that reduces audit preparation from weeks to hours.',
 'Achieves 100% STIG compliance across 4,200+ endpoints. Reduced manual configuration by 70%. Zero audit findings in 3 consecutive years.',
 true);

-- ============================================================================
-- STEP 15: UPDATE DATA CALL RESPONSE (all 7 JSONB sections)
-- ============================================================================

-- 15a: key_personnel — MUST match Tier 1 personnel names exactly
UPDATE data_call_responses SET
  key_personnel = (
    SELECT jsonb_agg(jsonb_build_object(
      'name', kp.name,
      'role', kp.role,
      'qualifications_summary', kp.qualifications_summary,
      'resume_file_id', COALESCE(
        (SELECT id::text FROM data_call_files WHERE data_call_response_id = v_dcr_id AND field_key LIKE 'personnel_' || (kp.idx - 1)::text || '_resume' LIMIT 1),
        null
      ),
      'loc_file_id', COALESCE(
        (SELECT id::text FROM data_call_files WHERE data_call_response_id = v_dcr_id AND field_key LIKE 'personnel_' || (kp.idx - 1)::text || '_loc' LIMIT 1),
        null
      ),
      'certifications_file_ids', COALESCE(
        (SELECT jsonb_agg(id::text) FROM data_call_files WHERE data_call_response_id = v_dcr_id AND field_key LIKE 'personnel_' || (kp.idx - 1)::text || '_cert%'),
        '[]'::jsonb
      )
    ))
    FROM (VALUES
      (1, 'Michael Anderson', 'Program Manager', 'PMP-certified with 22 years IT program management, 15 years federal. Led Army IT operations at Fort Belvoir (42 FTEs, $11.2M) and ARL APG (28 FTEs, $8.5M) with Exceptional CPARS. ITIL v4 certified. Expert in multi-site service desk and infrastructure management for classified environments. Secret clearance.'),
      (2, 'Dr. Priya Patel', 'Lead Systems Engineer', '19 years enterprise infrastructure, 12 years federal. Nutanix NCP, AWS SAP, VCP, MCSE certified. Led infrastructure management for 2,800-user ARL environment achieving 99.9% uptime. Expert in Nutanix HCI, Windows/Linux server administration, and STIG compliance. Secret clearance.'),
      (3, 'James Rodriguez', 'Cybersecurity Lead', '16 years cybersecurity, 14 years federal. CISSP, CEH, HBSS Admin certified. TS/SCI cleared. Led DHS SOC achieving 99.8% uptime. Expert in HBSS/ESS deployment, ARCYBER patch compliance, NIST SP 800-171, classified spillage response, and RMF artifact delivery.')
    ) AS kp(idx, name, role, qualifications_summary)
  )
WHERE id = v_dcr_id;

RAISE NOTICE 'Updated key_personnel';

-- 15b: opportunity_details
UPDATE data_call_responses SET
  opportunity_details = '{
    "contract_type": "Cost-Plus-Fixed-Fee (CPFF)",
    "prime_or_sub": "prime",
    "set_aside": "Service-Disabled Veteran-Owned Small Business (SDVOSB)",
    "naics_code": "541519",
    "size_standard": "$34M",
    "teaming_partners": [
      {
        "name": "Acme Federal Solutions",
        "role": "Major Subcontractor — Network Engineering & Classified Support",
        "cage_code": "5C4D3",
        "facility_clearance": "Top Secret",
        "workshare_percentage": 20,
        "capabilities": "Network engineering (CCNP/CCIE certified staff), classified environment support, TS FCL holder, 10 years DoD network operations, Cisco ISE and Comply-to-Connect expertise"
      }
    ]
  }'::jsonb
WHERE id = v_dcr_id;

-- 15c: technical_approach — 3,500 users per SOO
UPDATE data_call_responses SET
  technical_approach = '{
    "approach_summary": "TechVision will deliver comprehensive IT operations and service desk support for ARL across Aberdeen Proving Ground, Adelphi Laboratory Center, Army Research Office, and White Sands Missile Range, supporting approximately 3,500 users across classified (SIPR, JWICS) and unclassified (NIPR, DREN) networks. Our approach leverages ITIL v4 best practices, ServiceNow ITSM for workflow automation, and a tiered staffing model. We emphasize Zero Trust architecture via Cisco ISE, proactive infrastructure monitoring, and knowledge-centric service desk operations driving first-call resolution above 80%.",
    "tools_and_platforms": "ServiceNow (ITSM, ITOM, ITAM, CSM, HAM, SAM, SPM), Nagios, SolarWinds NPM/SAM, Microsoft SCCM, Nutanix HCI, Cisco ISE, JAMF, Microsoft Intune, HBSS/ESS (McAfee/Trellix), Wireshark, BigFix, Active Directory, Microsoft 365, Splunk, ACAS, SCAP",
    "staffing_model": "Total 60 FTEs across 6 sites: APG (35 FTEs), ALC (12 FTEs), ARO (4 FTEs), WSMR (2 FTEs), Extended Sites (2 FTEs), PMO/Remote (5 FTEs). Tiered service desk: Tier 0 self-service (ServiceNow), Tier 1 first-contact resolution, Tier 2/3 engineering specialists. Key personnel: Michael Anderson (PM), Dr. Priya Patel (Lead Systems Engineer), James Rodriguez (Cybersecurity Lead).",
    "assumptions": "3,500 total user population across all ARL sites per SOO. Existing ServiceNow instance available for configuration. 30-day transition period with incumbent knowledge transfer. Government-furnished equipment and facilities. Existing Nutanix HCI infrastructure operational. DREN network connectivity established.",
    "risks": "Transition risk from incumbent — mitigated by 30-day parallel operations and dedicated Transition Manager. Clearance processing delays — mitigated by pre-cleared pipeline of 45+ Secret-cleared staff. Technology refresh during performance — mitigated by modular architecture. Classified spillage — mitigated by documented response procedures and quarterly drills."
  }'::jsonb
WHERE id = v_dcr_id;

-- 15d: compliance_verification
UPDATE data_call_responses SET
  compliance_verification = '{
    "sprs_score": 95,
    "sprs_assessment_date": "2025-11-15",
    "nist_800_171_compliant": true,
    "open_poam_items": 3,
    "facility_clearance_level": "Top Secret",
    "facility_clearance_cage": "7X2K9",
    "facility_clearance_sponsor": "Department of the Army",
    "sdvosb_certified": true,
    "sdvosb_cert_number": "SDVOSB-2023-1234",
    "sdvosb_expiration": "2027-01-15",
    "cmmi_level": 3,
    "iso_9001_certified": true,
    "iso_27001_certified": true,
    "annual_revenue": "$28.5M",
    "size_standard_met": true
  }'::jsonb
WHERE id = v_dcr_id;

-- 15e: service_area_approaches (all 18 areas — NO Gonzalez/Park/Johnson names)
UPDATE data_call_responses SET
  service_area_approaches = '[
    {"area_code": "3.1", "area_name": "Planning Support", "approach_narrative": "Dedicated Planning Support team using ServiceNow SPM for project tracking, resource allocation, and reporting. Weekly status meetings with government leadership. Quarterly strategic planning sessions aligned with ARL technology roadmap.", "proposed_tools": "ServiceNow SPM, Microsoft Project, Power BI", "proposed_staffing": "1 Planning Lead, 1 Business Analyst", "key_differentiator": "Proactive planning with automated ServiceNow dashboards providing real-time visibility into all projects and resource utilization."},
    {"area_code": "3.2.1", "area_name": "Service Desk Operations", "approach_narrative": "ITIL v4-aligned tiered service desk: Tier 0 self-service portal (ServiceNow), Tier 1 first-contact resolution (target 80%+), Tier 2 escalation, Tier 3 engineering. 24/7 coverage for critical systems. Knowledge-centric approach with continuously updated knowledge base.", "proposed_tools": "ServiceNow ITSM, ServiceNow Virtual Agent, Teams integration", "proposed_staffing": "Karen Mitchell (Service Desk Manager), 15 co-located technicians, centralized overflow team", "key_differentiator": "Knowledge-centric approach drives 80%+ first-call resolution. ServiceNow Virtual Agent handles 30% of routine requests autonomously."},
    {"area_code": "3.2.2", "area_name": "End-User Device Management", "approach_narrative": "Automated endpoint management using SCCM for Windows, JAMF for macOS, and Microsoft Intune for mobile. STIG-compliant imaging, automated patching within ARCYBER timelines.", "proposed_tools": "SCCM, JAMF, Microsoft Intune, BigFix", "proposed_staffing": "2 endpoint specialists", "key_differentiator": "Automated STIG compliance checking reduces manual configuration by 70%. Zero-touch deployment for standard profiles."},
    {"area_code": "3.2.3", "area_name": "Unified Endpoint Management", "approach_narrative": "Centralized endpoint visibility through ServiceNow ITOM Discovery integrated with SCCM and Intune. Automated compliance scanning and remediation for all managed endpoints.", "proposed_tools": "ServiceNow ITOM Discovery, SCCM, Intune, Tanium", "proposed_staffing": "Shared with End-User Device team", "key_differentiator": "Single-pane visibility across all endpoint types with automated non-compliance remediation."},
    {"area_code": "3.2.4", "area_name": "Mobile Device Management", "approach_narrative": "DISA-compliant MDM using Microsoft Intune for smartphone, tablet, and hotspot management. Policy enforcement for DoD mobile device security requirements.", "proposed_tools": "Microsoft Intune, Azure AD Conditional Access", "proposed_staffing": "1 MDM specialist (shared)", "key_differentiator": "Automated compliance policy enforcement with self-remediation reduces mobile device tickets by 40%."},
    {"area_code": "3.2.5", "area_name": "Printer/Copier Management", "approach_narrative": "Centralized print management with automated consumable monitoring and proactive vendor coordination. Footprint reduction strategy targeting 15% reduction.", "proposed_tools": "PrinterLogic, vendor management portals", "proposed_staffing": "1 dedicated technician (shared)", "key_differentiator": "Proactive consumable monitoring eliminates reactive supply orders."},
    {"area_code": "3.2.6", "area_name": "Desktop Application Services", "approach_narrative": "Centralized application packaging and deployment through SCCM Application Catalog. Automated compatibility testing for OS updates. Self-service installation for approved software.", "proposed_tools": "SCCM App Catalog, MSIX packaging", "proposed_staffing": "1 application packaging specialist", "key_differentiator": "Self-service catalog reduces application installation tickets by 60%."},
    {"area_code": "3.2.7", "area_name": "Platform Application Management", "approach_narrative": "Lifecycle management for enterprise platforms including SharePoint, Exchange, and custom LOB applications. Version control, patching, and performance monitoring.", "proposed_tools": "ServiceNow ITOM, SCCM", "proposed_staffing": "Shared with systems administration", "key_differentiator": "Proactive platform health monitoring prevents 90% of unplanned outages."},
    {"area_code": "3.2.8", "area_name": "Network Engineering and Support", "approach_narrative": "Full-spectrum network management including switch/router/firewall administration, Zero Trust implementation via Cisco ISE, Comply-to-Connect enforcement, and VoIP support. David Thompson and Acme Federal Solutions engineers provide CCNP/CCIE-level network expertise.", "proposed_tools": "Cisco ISE, SolarWinds NPM, Wireshark, Cisco DNA Center", "proposed_staffing": "David Thompson (Network Engineer) + 2 Acme Federal Solutions network engineers", "key_differentiator": "Zero Trust architecture expertise with Cisco ISE. Comply-to-Connect ensures only authorized devices access DREN."},
    {"area_code": "3.2.9", "area_name": "Cabling and Communications Hardware", "approach_narrative": "Structured cabling management for moves/adds/changes. VoIP endpoint management and conference room infrastructure support.", "proposed_tools": "ServiceNow CMDB, VoIP management tools", "proposed_staffing": "1 cabling technician", "key_differentiator": "CMDB-tracked cabling inventory reduces troubleshooting time by 50%."},
    {"area_code": "3.2.10", "area_name": "Server and Storage Administration", "approach_narrative": "Windows Server, Red Hat Linux, and macOS server administration across Nutanix HCI infrastructure. Dr. Priya Patel (Nutanix NCP, VCP) leads infrastructure design and STIG compliance.", "proposed_tools": "Nutanix Prism, vCenter, Veeam, SCCM, Red Hat Satellite", "proposed_staffing": "Dr. Priya Patel (Lead Systems Engineer), Lisa Park (Systems Administrator), 1 additional admin", "key_differentiator": "Nutanix NCP-certified engineers with 99.9% server uptime track record. Automated STIG compliance reduces audit prep from weeks to hours."},
    {"area_code": "3.2.11", "area_name": "Infrastructure Monitoring", "approach_narrative": "24/7 infrastructure monitoring using Nagios for availability and SolarWinds for performance. Automated alerting with tiered escalation. Dashboard-driven operations center.", "proposed_tools": "Nagios, SolarWinds NPM/SAM, ServiceNow Event Management", "proposed_staffing": "Shared with service desk (afterhours monitoring by centralized team)", "key_differentiator": "Automated event correlation reduces alert noise by 70%. Proactive monitoring identifies 85% of issues before user impact."},
    {"area_code": "3.2.12", "area_name": "Asset and Software Management", "approach_narrative": "Full lifecycle asset management compliant with AR 735-5. PECO responsibilities, ServiceNow HAM/SAM for hardware and software inventory tracking.", "proposed_tools": "ServiceNow HAM, ServiceNow SAM, barcode scanning", "proposed_staffing": "1 asset management specialist", "key_differentiator": "ServiceNow-driven asset lifecycle tracking achieves 99.5% inventory accuracy."},
    {"area_code": "3.2.13", "area_name": "Audio Visual / VTC Systems", "approach_narrative": "DISA-compliant AV/VTC system design, installation, and support. Microsoft Teams integration for hybrid meetings.", "proposed_tools": "Microsoft Teams Rooms, Poly/Cisco VTC endpoints, Crestron", "proposed_staffing": "1 AV/VTC specialist", "key_differentiator": "Microsoft Teams Rooms standardization reduces VTC support complexity by 60%."},
    {"area_code": "3.3", "area_name": "ServiceNow Platform Management", "approach_narrative": "Robert Kim provides dedicated ServiceNow platform management including bi-annual upgrades, CMDB governance, security patching, and module administration (CSM, ITSM, HAM, SAM, ITOM, SPM).", "proposed_tools": "ServiceNow (all modules)", "proposed_staffing": "Robert Kim (ServiceNow Developer/Admin)", "key_differentiator": "ServiceNow CSA/CAD certified developer with 5 years federal ServiceNow experience. 99.9% platform availability SLA."},
    {"area_code": "3.4", "area_name": "Cybersecurity and Compliance", "approach_narrative": "Comprehensive cybersecurity program led by James Rodriguez (CISSP, CEH, TS/SCI). Covers HBSS/ESS deployment, ARCYBER patch timeline compliance, STIG enforcement, RMF artifact delivery, NIST SP 800-171 compliance, and classified spillage response with quarterly drills.", "proposed_tools": "HBSS/ESS (McAfee/Trellix), ACAS, SCAP, eMASS, Splunk", "proposed_staffing": "James Rodriguez (Cybersecurity Lead), 2 cybersecurity analysts", "key_differentiator": "100% ARCYBER patch compliance track record. James Rodriguez has 14 years federal cybersecurity experience with zero critical findings across DoD contracts."},
    {"area_code": "3.2.16", "area_name": "Customer Training", "approach_narrative": "Bi-weekly training program covering new technology rollouts, security awareness, and productivity tools. Classroom instruction, coaching, video tutorials, and ServiceNow knowledge base.", "proposed_tools": "Microsoft Teams, ServiceNow Knowledge Base, SharePoint", "proposed_staffing": "Training coordinator (shared with service desk lead)", "key_differentiator": "Knowledge-centric training with measurable outcomes. Satisfaction scores consistently above 90%."},
    {"area_code": "3.2.17", "area_name": "Projects", "approach_narrative": "ServiceNow SPM for project intake, prioritization, resource allocation, and status tracking. Agile methodology with 2-week sprints and monthly stakeholder reviews.", "proposed_tools": "ServiceNow SPM, Microsoft Project", "proposed_staffing": "1 project coordinator", "key_differentiator": "ServiceNow SPM provides end-to-end project visibility with automated resource conflict detection."},
    {"area_code": "3.2.18", "area_name": "Classified Support", "approach_narrative": "Dedicated classified environment support for TS/SCI and Secret networks. Spillage response procedures aligned with DoD policy. Equipment decommission per NSA/CSS procedures. Acme Federal Solutions provides TS FCL-cleared engineers.", "proposed_tools": "SIPR/JWICS tools, HBSS", "proposed_staffing": "Acme Federal Solutions classified support team + TechVision TS-cleared staff", "key_differentiator": "Acme Federal Solutions holds TS FCL. 100% spillage containment within 4-hour SLA across all prior contracts."}
  ]'::jsonb
WHERE id = v_dcr_id;

-- 15f: site_staffing (6 sites, 60 total FTEs)
UPDATE data_call_responses SET
  site_staffing = '[
    {"site_name": "ARL Aberdeen Proving Ground (APG)", "location": "Aberdeen, MD", "proposed_fte_count": "35", "key_roles": "Karen Mitchell (Service Desk Manager), 8 co-located technicians, David Thompson (Network Engineer) + 1 Acme network engineer, Lisa Park (Systems Administrator) + 1 systems admin, 1 cybersecurity analyst, 1 AV/VTC specialist, 1 asset manager, 1 cabling tech, project coordinator, classified support team (Acme Federal Solutions)", "special_requirements": "Secret and TS/SCI cleared personnel required. On-site presence during core hours (0700-1700). Afterhours on-call rotation. Primary NOC location."},
    {"site_name": "ARL Adelphi Laboratory Center (ALC)", "location": "Adelphi, MD", "proposed_fte_count": "12", "key_roles": "7 co-located technicians, 1 systems admin, 1 network engineer (Acme Federal Solutions), training coordinator, ServiceNow admin support, asset management support", "special_requirements": "Secret clearance minimum. Coordination with APG NOC for afterhours support."},
    {"site_name": "Army Research Office (ARO)", "location": "Research Triangle Park, NC", "proposed_fte_count": "4", "key_roles": "2 on-site technicians, 1 network support (remote from APG), 1 systems support (remote from ALC)", "special_requirements": "Secret clearance. Limited on-site presence supplemented by remote support from APG/ALC."},
    {"site_name": "White Sands Missile Range (WSMR)", "location": "White Sands, NM", "proposed_fte_count": "2", "key_roles": "1 on-site technician, 1 remote support from APG", "special_requirements": "Secret clearance. Remote site with VPN connectivity to APG NOC."},
    {"site_name": "Extended Sites", "location": "Various CONUS", "proposed_fte_count": "2", "key_roles": "2 roving technicians providing on-demand support to smaller ARL facilities", "special_requirements": "Travel required. Secret clearance."},
    {"site_name": "PMO / Remote Operations", "location": "Arlington, VA / Remote", "proposed_fte_count": "5", "key_roles": "Michael Anderson (Program Manager), James Rodriguez (Cybersecurity Lead), Dr. Priya Patel (Lead Systems Engineer), 2 centralized service desk overflow staff", "special_requirements": "VPN access to ARL networks. Monthly on-site visits for program reviews."}
  ]'::jsonb
WHERE id = v_dcr_id;

-- 15g: technology_selections — consistent personnel names
UPDATE data_call_responses SET
  technology_selections = '[
    {"technology_name": "ServiceNow", "company_experience": "7 years, 6 certified practitioners, Army IT Ops and EPA ITSM contracts", "proposed_usage": "ITSM, ITOM, ITAM, CSM, HAM, SAM, SPM — full platform for service delivery and asset management", "certifications_held": "Robert Kim (CSA, CAD)"},
    {"technology_name": "Nutanix HCI", "company_experience": "5 years managing Nutanix clusters for DoD research environments at ARL APG", "proposed_usage": "Hyperconverged infrastructure management, server provisioning, storage management", "certifications_held": "Dr. Priya Patel (NCP), Lisa Park (NCP)"},
    {"technology_name": "Nagios", "company_experience": "5 years enterprise monitoring for DoD networks", "proposed_usage": "Infrastructure availability monitoring with automated alerting and escalation", "certifications_held": "Internal Nagios administration training"},
    {"technology_name": "SolarWinds NPM/SAM", "company_experience": "6 years network and application performance monitoring", "proposed_usage": "Network performance monitoring, application dependency mapping, capacity planning", "certifications_held": "SolarWinds Certified Professional (David Thompson + 1 engineer)"},
    {"technology_name": "Cisco ISE", "company_experience": "4 years DoD Zero Trust implementations", "proposed_usage": "Network access control, Comply-to-Connect enforcement, 802.1X authentication", "certifications_held": "David Thompson (Cisco ISE Administrator, CCNP Enterprise) + Acme Federal team"},
    {"technology_name": "Microsoft SCCM", "company_experience": "8 years enterprise endpoint management for DoD", "proposed_usage": "Windows endpoint imaging, patching, software distribution, compliance reporting", "certifications_held": "Lisa Park (MCSE), multiple SCCM-trained technicians"},
    {"technology_name": "JAMF", "company_experience": "3 years macOS device management for DoD environments", "proposed_usage": "macOS endpoint management, policy enforcement, software deployment", "certifications_held": "JAMF Certified Associate (1 technician)"},
    {"technology_name": "Microsoft Intune", "company_experience": "4 years mobile device management for federal agencies", "proposed_usage": "MDM for smartphones, tablets, and hotspots per DISA mobile policy", "certifications_held": "Microsoft 365 Certified (3 technicians)"},
    {"technology_name": "HBSS/ESS", "company_experience": "8 years DoD Host-Based Security System management", "proposed_usage": "Endpoint security, ARCYBER compliance, threat detection and response", "certifications_held": "James Rodriguez (CISSP, CEH, HBSS Admin)"},
    {"technology_name": "Splunk", "company_experience": "6 years SIEM operations for DHS SOC", "proposed_usage": "Security log aggregation, correlation, and incident detection", "certifications_held": "James Rodriguez (Splunk Certified Power User)"}
  ]'::jsonb
WHERE id = v_dcr_id;

-- 15h: past_performance (3 prime + 1 sub reference)
UPDATE data_call_responses SET
  past_performance = '[
    {
      "project_name": "Enterprise IT Service Desk and Infrastructure Management",
      "client_agency": "Department of the Army / NETCOM",
      "contract_number": "W91QUZ-19-D-0045",
      "contract_value": "$11.2M (5 years)",
      "period_of_performance": "10/2019 – 09/2024",
      "relevance_summary": "Full-spectrum IT service desk and infrastructure management for 4,200 Army users across classified and unclassified networks. Includes ServiceNow ITSM, Nutanix HCI, HBSS/ESS, STIG compliance, Cisco networking, and 24/7 classified environment support — directly mirrors ARL SOO scope.",
      "contact_name": "COL David Richards",
      "contact_email": "david.richards.civ@army.mil",
      "contact_phone": "(703) 806-4000"
    },
    {
      "project_name": "IT Infrastructure Management and User Support Services",
      "client_agency": "Army Research Laboratory",
      "contract_number": "W56KGZ-21-D-0012",
      "contract_value": "$8.5M (5 years)",
      "period_of_performance": "04/2021 – 03/2026",
      "relevance_summary": "IT infrastructure management for 2,800 ARL researchers at Aberdeen Proving Ground — the same customer and same site as this requirement. Includes Nutanix HCI, ServiceNow, Cisco ISE, HBSS/ESS, asset management per AR 735-5, and SIPR/NIPR/DREN support.",
      "contact_name": "Dr. Susan Park",
      "contact_email": "susan.park.civ@arl.army.mil",
      "contact_phone": "(410) 306-0500"
    },
    {
      "project_name": "Enterprise Cybersecurity Operations and Compliance Management",
      "client_agency": "Department of Homeland Security / CISA",
      "contract_number": "70RSAT20D00000001",
      "contract_value": "$12.5M (5 years)",
      "period_of_performance": "01/2020 – 01/2025",
      "relevance_summary": "Cybersecurity operations for 50+ systems and 10,000+ users including SOC management, HBSS/ESS, Splunk SIEM, NIST compliance, and classified environment security — demonstrates cybersecurity depth required by ARL SOO Area 3.4.",
      "contact_name": "Michael Thompson",
      "contact_email": "michael.thompson@hq.dhs.gov",
      "contact_phone": "(202) 555-0100"
    },
    {
      "project_name": "DoD Enterprise Network Operations and Monitoring (Subcontractor: Acme Federal Solutions)",
      "client_agency": "Department of Defense / DISA",
      "contract_number": "W15P7T-20-D-0082",
      "contract_value": "$14.8M (5 years)",
      "period_of_performance": "01/2020 – 01/2025",
      "relevance_summary": "Acme Federal Solutions (proposed 20% workshare subcontractor) served as prime on this DISA enterprise network operations contract managing 50,000+ DoD endpoints across 15 installations. Directly relevant: Cisco ISE Comply-to-Connect, 24/7 NOC, SolarWinds/Cisco DNA monitoring, SIPR/JWICS support, HBSS/ESS management.",
      "contact_name": "LTC Sarah Mitchell",
      "contact_email": "sarah.mitchell.civ@disa.mil",
      "contact_phone": "(301) 225-4800"
    }
  ]'::jsonb
WHERE id = v_dcr_id;

RAISE NOTICE 'Updated all data_call_responses JSONB sections';

-- ============================================================================
-- STEP 16: VALIDATION QUERIES
-- ============================================================================

-- Check: Key personnel names match between data_call and personnel table
RAISE NOTICE '=== VALIDATION ===';

PERFORM 1 FROM personnel
WHERE company_id = v_company_id
  AND full_name IN ('Michael Anderson', 'Dr. Priya Patel', 'James Rodriguez')
  AND proposed_roles::text LIKE '%"is_key_personnel": true%';
IF NOT FOUND THEN
  RAISE WARNING 'VALIDATION FAIL: Key personnel is_key_personnel flags not set correctly';
END IF;

-- Check: No old names anywhere in data_call_responses
IF EXISTS (
  SELECT 1 FROM data_call_responses
  WHERE id = v_dcr_id
    AND (
      key_personnel::text ILIKE '%Gonzalez%'
      OR key_personnel::text ILIKE '%Aisha%'
      OR key_personnel::text ILIKE '%David Park%'
      OR service_area_approaches::text ILIKE '%Gonzalez%'
      OR service_area_approaches::text ILIKE '%Aisha Johnson%'
      OR site_staffing::text ILIKE '%Gonzalez%'
      OR technology_selections::text ILIKE '%Aisha%'
    )
) THEN
  RAISE WARNING 'VALIDATION FAIL: Old personnel names (Gonzalez/Park/Aisha) found in data_call_responses';
ELSE
  RAISE NOTICE 'PASS: No old personnel names in data_call_responses';
END IF;

-- Check: User count is 3,500
IF EXISTS (
  SELECT 1 FROM data_call_responses
  WHERE id = v_dcr_id
    AND technical_approach::text LIKE '%4,500%'
) THEN
  RAISE WARNING 'VALIDATION FAIL: Old user count 4,500 found in technical_approach';
ELSE
  RAISE NOTICE 'PASS: User count is 3,500';
END IF;

-- Check: CAGE code is 7X2K9
IF (SELECT cage_code FROM company_profiles WHERE id = v_company_id) = '7X2K9' THEN
  RAISE NOTICE 'PASS: CAGE code is 7X2K9';
ELSE
  RAISE WARNING 'VALIDATION FAIL: CAGE code mismatch';
END IF;

-- Check: All PP have cpars_rating
IF EXISTS (
  SELECT 1 FROM past_performance
  WHERE company_id = v_company_id AND cpars_rating IS NULL
) THEN
  RAISE WARNING 'VALIDATION FAIL: Some past_performance records missing cpars_rating';
ELSE
  RAISE NOTICE 'PASS: All past performance records have CPARS ratings';
END IF;

RAISE NOTICE '=== SEED COMPLETE ===';

END $$;
