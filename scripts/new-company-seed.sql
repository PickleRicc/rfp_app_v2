-- ============================================================================
-- SCRIPT 1: NEW COMPANY — Tier 1 Enterprise Intake Seed
-- Company: Meridian IT Solutions LLC
-- Profile: Small business GovCon IT firm, 180 employees, DoD/civilian IT ops
-- 
-- This script creates a COMPLETE Tier 1 profile that passes isTier1Complete()
-- with a 100/100 completeness score. Every field that the generation and
-- scoring pipelines read is populated. Nothing is fabricated — every value
-- is internally consistent and realistic for a small GovCon IT shop.
--
-- USAGE: Run in Supabase SQL Editor ONCE. Then switch to this company in the app.
-- ============================================================================

-- Step 1: Create the company profile
INSERT INTO company_profiles (
  id,
  company_name,
  legal_name,
  dba_names,
  cage_code,
  uei_number,
  sam_status,
  sam_expiration,
  year_founded,
  employee_count,
  annual_revenue,
  fiscal_year_end,
  website,
  headquarters_address,
  additional_offices,
  proposal_poc,
  contracts_poc,
  authorized_signer,
  elevator_pitch,
  full_description,
  mission_statement,
  core_values,
  logo_url,
  primary_color,
  secondary_color,
  business_size,
  socioeconomic_certs,
  primary_naics,
  primary_naics_title,
  has_facility_clearance,
  clearance_level,
  sponsoring_agency,
  cage_code_cleared,
  corporate_overview,
  core_services_summary,
  enterprise_win_themes,
  key_differentiators_summary,
  standard_management_approach,
  iso_cmmi_status,
  dcaa_approved_systems,
  completeness_score,
  tier1_complete
) VALUES (
  gen_random_uuid(),
  'Meridian IT Solutions',
  'Meridian IT Solutions LLC',
  ARRAY['Meridian ITS'],
  'M3R7K',                          -- 5-char alphanumeric CAGE
  'JM4KDLR8YNHX',                   -- 12-char UEI, starts with letter, no O or I
  'Active',
  '2027-03-15',
  2012,                              -- Founded 2012
  180,
  42000000,                          -- $42M revenue
  'December',
  'https://meridianits.com',
  '{"street": "1750 Tysons Blvd", "suite": "Suite 400", "city": "Tysons", "state": "VA", "zip": "22102", "country": "US"}'::jsonb,
  '[]'::jsonb,
  '{"name": "Sarah Chen", "title": "Director of Business Development", "email": "sarah.chen@meridianits.com", "phone": "703-555-0142"}'::jsonb,
  '{"name": "Robert Kim", "title": "Contracts Manager", "email": "robert.kim@meridianits.com", "phone": "703-555-0198"}'::jsonb,
  '{"name": "David Okafor", "title": "President & CEO", "email": "david.okafor@meridianits.com", "phone": "703-555-0101"}'::jsonb,
  'Meridian IT Solutions delivers reliable, secure IT operations for federal agencies with a 13-year track record of on-time, on-budget performance across DoD and civilian missions.',
  'Meridian IT Solutions LLC is a small business government IT services contractor headquartered in Tysons, Virginia. Founded in 2012, Meridian has grown to 180 employees supporting 14 active federal contracts across the Department of Defense, Department of the Army, and civilian agencies. Meridian specializes in enterprise IT operations, service desk, infrastructure management, cybersecurity operations, and cloud migration services. The company holds a Secret facility clearance, CMMI-SVC Level 3 appraisal, and ISO 27001 certification. Meridian maintains a DCAA-approved accounting system and has been consistently rated Exceptional or Very Good on all CPARS evaluations.',
  'To provide federal agencies with responsive, mission-focused IT services that keep operations running securely, reliably, and efficiently.',
  ARRAY['Mission First', 'Technical Excellence', 'Transparency', 'Continuous Improvement'],
  NULL,
  '#1B4D8C',
  '#E87722',
  'Small',
  ARRAY['SDB', 'SDVOSB'],
  '541512',
  'Computer Systems Design Services',
  true,
  'Secret',
  'Defense Counterintelligence and Security Agency (DCSA)',
  'M3R7K',

  -- corporate_overview (50-500 words) — used in every prompt
  'Meridian IT Solutions LLC is a small disadvantaged business and service-disabled veteran-owned small business (SDVOSB) providing end-to-end IT operations support to federal agencies since 2012. Headquartered in Tysons, Virginia, Meridian employs 180 cleared professionals who currently support 14 active contracts for the Department of Defense, U.S. Army, and civilian agencies. Our core capabilities span enterprise IT service desk operations, infrastructure management and monitoring, cybersecurity operations and compliance, cloud migration and hybrid environment management, and end-user computing support. Meridian has earned a reputation for mission reliability — across our past five CPARS-rated contracts, we have received ratings of Exceptional or Very Good in every evaluation dimension. Our approach combines ITIL-aligned service delivery with proactive monitoring and automation to minimize downtime and maximize user productivity. We bring deep domain expertise in DoD IT environments, including classified network operations (SIPRNet/NIPRNet), RMF compliance, and DISA STIG implementation. As a CMMI-SVC Level 3 appraised organization with ISO 27001 certification, we institutionalize quality and security into every engagement. Our DCAA-approved accounting system ensures transparent, auditable cost management on all contract types. Meridian currently manages IT operations for approximately 12,000 federal users across 30 sites nationwide, delivering first-call resolution rates above 82% and infrastructure availability exceeding 99.95%.',

  -- core_services_summary (30-300 words)
  'Meridian IT Solutions provides six core service areas to federal clients. Enterprise Service Desk: Tiered help desk operations (Tier 0 self-service through Tier 3 escalation) using ServiceNow ITSM, supporting up to 5,000 concurrent users per contract. Infrastructure Management: Server, storage, and network administration across physical, virtual, and hybrid cloud environments using VMware vSphere, Microsoft Azure, and AWS GovCloud. Cybersecurity Operations: Security operations center (SOC) services, vulnerability management, SIEM monitoring with Splunk, incident response, and full RMF lifecycle support for DoD systems. End-User Computing: Desktop, laptop, mobile device, and VDI provisioning, imaging, and lifecycle management using SCCM and Intune. Cloud Services: Cloud migration planning, hybrid architecture design, and ongoing management of Azure and AWS GovCloud workloads. Telecommunications: VoIP, VTC, and unified communications management across multi-site environments.',

  -- enterprise_win_themes (>= 3)
  ARRAY[
    'Proven DoD IT operations performance with 5 consecutive Exceptional/Very Good CPARS across all dimensions',
    'Cleared workforce of 180 professionals with deep bench strength in cybersecurity, infrastructure, and service desk operations',
    'CMMI-SVC Level 3 processes and ISO 27001 certification institutionalize quality and security into every delivery',
    'Small business agility with large business capability — rapid staffing and responsive contract management',
    'Mature DCAA-approved systems and transparent pricing methodology demonstrated across 14 active federal contracts'
  ],

  -- key_differentiators_summary (30-300 words)
  'Meridian differentiates through three pillars. First, our mission reliability record — five consecutive contracts rated Exceptional or Very Good on CPARS with zero performance cure notices in 13 years of operation. Second, our workforce depth — we maintain a bench of 25+ cleared IT professionals ready for rapid deployment, enabling Day 1 staffing on new contracts without lengthy recruiting cycles. Every key personnel candidate we propose is a current Meridian employee, not a contingent hire. Third, our process maturity — our CMMI-SVC Level 3 appraisal, ISO 27001 certification, and DCAA-approved accounting system provide the institutional rigor that reduces risk for the government while our small business structure ensures direct executive involvement on every contract.',

  -- standard_management_approach (50-500 words)
  'Meridian employs an integrated management approach built on four pillars: ITIL-aligned service delivery, proactive quality management, transparent communication, and data-driven continuous improvement. Our Program Manager serves as the single point of accountability for all contract performance, with direct authority over staffing, budgets, and technical decisions. We implement a formal governance structure including weekly status meetings with the Contracting Officer Representative, monthly performance reviews against SLA metrics, and quarterly strategic planning sessions. Our Quality Control Plan follows CMMI-SVC Level 3 practices with defined process areas for service delivery, incident management, problem management, and change management. We conduct internal quality audits monthly and corrective action reviews within 48 hours of any SLA breach. Our staffing approach prioritizes retention through competitive compensation, professional development funding (including certification sponsorship), and career advancement paths. For transition, we follow a proven 30-day phased approach: Phase 1 (Days 1-10) focuses on knowledge transfer and system access, Phase 2 (Days 11-20) focuses on parallel operations with the outgoing contractor, and Phase 3 (Days 21-30) achieves Full Operational Capability with all SLAs active. Risk management is embedded in our weekly rhythm — we maintain a living risk register reviewed at every status meeting, with mitigation plans assigned to named owners and tracked to resolution.',

  -- iso_cmmi_status
  '{"iso_9001": false, "iso_27001": true, "iso_20000": false, "cmmi_dev_level": null, "cmmi_svc_level": 3, "itil_certified": true}'::jsonb,

  -- dcaa_approved_systems
  '{"accounting": true, "estimating": true, "purchasing": true, "timekeeping": true, "compensation": true, "billing": true}'::jsonb,

  100,   -- completeness_score
  true   -- tier1_complete
);

-- Capture the new company ID for child table inserts
DO $$
DECLARE
  v_cid UUID;
BEGIN
  SELECT id INTO v_cid FROM company_profiles WHERE company_name = 'Meridian IT Solutions' LIMIT 1;
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Company not found after insert'; END IF;

  -- ═══════════════════════════════════════════════════
  -- NAICS CODES
  -- ═══════════════════════════════════════════════════
  INSERT INTO naics_codes (company_id, code, title, is_primary) VALUES
    (v_cid, '541512', 'Computer Systems Design Services', true),
    (v_cid, '541513', 'Computer Facilities Management Services', false),
    (v_cid, '541519', 'Other Computer Related Services', false),
    (v_cid, '561210', 'Facilities Support Services', false);

  -- ═══════════════════════════════════════════════════
  -- CERTIFICATIONS
  -- ═══════════════════════════════════════════════════
  INSERT INTO certifications (company_id, certification_type, certifying_agency, certification_number, effective_date, expiration_date) VALUES
    (v_cid, 'ISO 27001:2022', 'BSI Group', 'IS-789456', '2024-06-01', '2027-06-01'),
    (v_cid, 'CMMI-SVC Level 3', 'CMMI Institute', 'CMMI-SVC-2024-4521', '2024-01-15', '2027-01-15'),
    (v_cid, 'ITIL v4 Foundation (Organization)', 'PeopleCert/Axelos', 'ITIL-ORG-3344', '2023-09-01', '2028-09-01'),
    (v_cid, 'Small Disadvantaged Business (SDB)', 'SBA', 'SDB-2024-11234', '2024-03-01', '2027-03-01'),
    (v_cid, 'Service-Disabled Veteran-Owned Small Business (SDVOSB)', 'VA CVE', 'CVE-2024-5678', '2024-04-01', '2027-04-01');

  -- ═══════════════════════════════════════════════════
  -- CONTRACT VEHICLES
  -- ═══════════════════════════════════════════════════
  INSERT INTO contract_vehicles (company_id, vehicle_name, contract_number, vehicle_type, ordering_period_end, ceiling_value, labor_categories) VALUES
    (v_cid, 'GSA IT Schedule 70', 'GS-35F-0442T', 'GSA Schedule', '2029-09-30', 20000000, ARRAY['Program Manager', 'Systems Engineer', 'Network Engineer', 'Cybersecurity Analyst', 'Help Desk Specialist', 'Database Administrator']),
    (v_cid, 'CIO-SP3 Small Business', 'HHSN316201500025W', 'GWAC', '2028-05-31', 50000000000, ARRAY['IT Project Manager', 'Sr. Systems Engineer', 'Cybersecurity Engineer', 'Cloud Architect']),
    (v_cid, 'ITES-3S', 'W52P1J-20-D-0042', 'IDIQ', '2029-03-31', 12000000000, ARRAY['Program Manager', 'Systems Administrator', 'Network Engineer', 'Service Desk Lead']);

  -- ═══════════════════════════════════════════════════
  -- FACILITY CLEARANCES
  -- ═══════════════════════════════════════════════════
  INSERT INTO facility_clearances (company_id, has_facility_clearance, clearance_level, sponsoring_agency, cage_code_cleared, safeguarding_capability) VALUES
    (v_cid, true, 'Secret', 'Defense Counterintelligence and Security Agency (DCSA)', 'M3R7K', 'Safeguarding of classified information up to SECRET level at the Tysons, VA headquarters.');

  -- ═══════════════════════════════════════════════════
  -- PERSONNEL — 3 key personnel + 4 support staff
  -- These names are THE authoritative source. They must match
  -- the Tier 2 key_personnel entries and all uploaded resumes/LOCs.
  -- ═══════════════════════════════════════════════════

  -- KEY PERSONNEL 1: Program Manager
  INSERT INTO personnel (company_id, status, full_name, email, phone, employment_type, availability, current_assignment, geographic_location, relocation_willing, remote_capable, clearance_level, clearance_status, investigation_date, education, certifications, total_experience_years, federal_experience_years, relevant_experience_years, work_history, proposed_roles) VALUES
  (v_cid, 'Active', 'Thomas Brennan', 'thomas.brennan@meridianits.com', '703-555-0201', 'W2 Employee',
   'Immediately Available', 'Meridian IT Solutions — DISA ENCORE III TO', 'Tysons, VA', false, true,
   'Top Secret', 'Active', '2023-08-15',
   '[{"degree_level": "Master", "field_of_study": "Information Systems Management", "institution": "George Washington University", "graduation_year": 2008}, {"degree_level": "Bachelor", "field_of_study": "Computer Science", "institution": "Virginia Tech", "graduation_year": 2003}]'::jsonb,
   '[{"name": "PMP", "issuing_body": "PMI", "date_obtained": "2010-05-01", "expiration_date": "2028-05-01"}, {"name": "ITIL v4 Foundation", "issuing_body": "PeopleCert", "date_obtained": "2022-03-01", "expiration_date": "2028-03-01"}, {"name": "CompTIA Security+ CE", "issuing_body": "CompTIA", "date_obtained": "2023-01-15", "expiration_date": "2026-01-15"}, {"name": "Certified Scrum Master", "issuing_body": "Scrum Alliance", "date_obtained": "2021-06-01", "expiration_date": "2027-06-01"}]'::jsonb,
   20, 16, 16,
   '[{"job_title": "Program Manager", "employer": "Meridian IT Solutions", "start_date": "2018-03-01", "end_date": "Present", "description": "Manages $38M DoD IT operations contract supporting 3,800 users across 7 sites. Leads team of 52 engineers and technicians delivering service desk, infrastructure, and cybersecurity services. Achieved CPARS Exceptional ratings for Quality and Schedule.", "client_agency": "DISA", "relevant_skills": ["Program Management", "ITIL", "DoD IT Operations", "CPARS"]}, {"job_title": "Deputy Program Manager", "employer": "Meridian IT Solutions", "start_date": "2014-06-01", "end_date": "2018-02-28", "description": "Supported $22M Army IT modernization program. Managed cross-functional teams of 35 engineers across 4 installations.", "client_agency": "U.S. Army", "relevant_skills": ["IT Modernization", "Transition Management", "Staffing"]}, {"job_title": "IT Project Manager", "employer": "SAIC", "start_date": "2008-01-01", "end_date": "2014-05-31", "description": "Led IT service delivery projects for DIA and NGA. Managed $15M annual task order for network operations.", "client_agency": "DIA", "relevant_skills": ["Network Operations", "Project Management"]}, {"job_title": "Systems Administrator", "employer": "U.S. Army Signal Corps", "start_date": "2003-06-01", "end_date": "2007-12-31", "description": "Active duty network and systems administration supporting classified environments.", "client_agency": "U.S. Army", "relevant_skills": ["Systems Administration", "Classified Networks"]}]'::jsonb,
   '[{"role_title": "Program Manager", "is_key_personnel": true, "labor_category": "Program Manager", "summary_for_role": "20 years IT experience, 16 years federal. PMP and ITIL certified. Currently managing $38M DISA IT operations contract with Exceptional CPARS."}]'::jsonb
  );

  -- KEY PERSONNEL 2: Lead Systems Engineer
  INSERT INTO personnel (company_id, status, full_name, email, phone, employment_type, availability, current_assignment, geographic_location, relocation_willing, remote_capable, clearance_level, clearance_status, investigation_date, education, certifications, total_experience_years, federal_experience_years, relevant_experience_years, work_history, proposed_roles) VALUES
  (v_cid, 'Active', 'Dr. Nina Vasquez', 'nina.vasquez@meridianits.com', '703-555-0202', 'W2 Employee',
   'Immediately Available', 'Meridian IT Solutions — Army CECOM Support', 'Tysons, VA', false, true,
   'Top Secret', 'Active', '2024-01-10',
   '[{"degree_level": "Doctorate", "field_of_study": "Computer Engineering", "institution": "University of Maryland", "graduation_year": 2011}, {"degree_level": "Master", "field_of_study": "Electrical Engineering", "institution": "Georgia Tech", "graduation_year": 2008}, {"degree_level": "Bachelor", "field_of_study": "Computer Science", "institution": "Penn State", "graduation_year": 2006}]'::jsonb,
   '[{"name": "AWS Solutions Architect Professional", "issuing_body": "Amazon Web Services", "date_obtained": "2023-09-01", "expiration_date": "2026-09-01"}, {"name": "CCNP Enterprise", "issuing_body": "Cisco", "date_obtained": "2022-11-01", "expiration_date": "2025-11-01"}, {"name": "CompTIA Security+ CE", "issuing_body": "CompTIA", "date_obtained": "2024-02-01", "expiration_date": "2027-02-01"}, {"name": "VMware VCP-DCV", "issuing_body": "VMware", "date_obtained": "2023-04-01", "expiration_date": "2025-04-01"}, {"name": "Microsoft Azure Administrator", "issuing_body": "Microsoft", "date_obtained": "2024-06-01", "expiration_date": "2027-06-01"}]'::jsonb,
   14, 12, 12,
   '[{"job_title": "Lead Systems Engineer", "employer": "Meridian IT Solutions", "start_date": "2019-01-01", "end_date": "Present", "description": "Architects and maintains enterprise IT infrastructure supporting 3,800 DoD users. Designed hybrid cloud migration reducing costs by 22%. Manages VMware vSphere cluster with 180+ VMs, NetApp SAN, Cisco networking. Leads team of 10 systems and network engineers.", "client_agency": "U.S. Army CECOM", "relevant_skills": ["Enterprise Architecture", "VMware", "Cisco", "Cloud Migration", "NetApp"]}, {"job_title": "Senior Systems Engineer", "employer": "Leidos", "start_date": "2015-03-01", "end_date": "2018-12-31", "description": "Designed virtualization and server infrastructure for Army Research Laboratory. Led Windows Server 2019 migration across 2,500 endpoints.", "client_agency": "ARL", "relevant_skills": ["Virtualization", "Windows Server", "Migration"]}, {"job_title": "Systems Engineer", "employer": "Booz Allen Hamilton", "start_date": "2011-06-01", "end_date": "2015-02-28", "description": "Supported DISA network modernization. Deployed Cisco ACI fabric for classified enclave.", "client_agency": "DISA", "relevant_skills": ["Cisco ACI", "Network Design", "Classified Networks"]}]'::jsonb,
   '[{"role_title": "Lead Systems Engineer", "is_key_personnel": true, "labor_category": "Senior Systems Engineer", "summary_for_role": "14 years IT experience, 12 years federal. AWS SA Pro, CCNP, VCP-DCV certified. Currently leading infrastructure for Army CECOM with 180+ VM environment."}]'::jsonb
  );

  -- KEY PERSONNEL 3: Cybersecurity Lead
  INSERT INTO personnel (company_id, status, full_name, email, phone, employment_type, availability, current_assignment, geographic_location, relocation_willing, remote_capable, clearance_level, clearance_status, investigation_date, education, certifications, total_experience_years, federal_experience_years, relevant_experience_years, work_history, proposed_roles) VALUES
  (v_cid, 'Active', 'Marcus Williams', 'marcus.williams@meridianits.com', '703-555-0203', 'W2 Employee',
   'Available — 2 weeks notice', 'Meridian IT Solutions — DHA Cybersecurity Ops', 'Tysons, VA', false, true,
   'Top Secret', 'Active', '2023-11-20',
   '[{"degree_level": "Master", "field_of_study": "Cybersecurity", "institution": "Johns Hopkins University", "graduation_year": 2014}, {"degree_level": "Bachelor", "field_of_study": "Information Technology", "institution": "James Madison University", "graduation_year": 2010}]'::jsonb,
   '[{"name": "CISSP", "issuing_body": "(ISC)²", "date_obtained": "2016-08-01", "expiration_date": "2028-08-01"}, {"name": "CEH", "issuing_body": "EC-Council", "date_obtained": "2018-03-01", "expiration_date": "2027-03-01"}, {"name": "CompTIA Security+ CE", "issuing_body": "CompTIA", "date_obtained": "2024-01-01", "expiration_date": "2027-01-01"}, {"name": "CISM", "issuing_body": "ISACA", "date_obtained": "2020-05-01", "expiration_date": "2026-05-01"}]'::jsonb,
   15, 13, 13,
   '[{"job_title": "Cybersecurity Lead", "employer": "Meridian IT Solutions", "start_date": "2020-02-01", "end_date": "Present", "description": "Leads cybersecurity operations protecting 4,200 users across DoD health agency. Manages RMF compliance for 12 information systems. Directs 6-person SOC team operating Splunk SIEM with custom detections. Led DFARS 252.204-7012 compliance implementation. Achieved SPRS score of 104.", "client_agency": "Defense Health Agency", "relevant_skills": ["NIST 800-171", "RMF", "Splunk", "SOC Operations", "DFARS"]}, {"job_title": "Senior Cybersecurity Analyst", "employer": "Meridian IT Solutions", "start_date": "2016-09-01", "end_date": "2020-01-31", "description": "Vulnerability assessment and penetration testing for Army networks. Managed Tanium endpoint security across 4,000 devices.", "client_agency": "U.S. Army", "relevant_skills": ["Vulnerability Assessment", "Tanium", "Penetration Testing"]}, {"job_title": "Cybersecurity Engineer", "employer": "General Dynamics IT", "start_date": "2012-01-01", "end_date": "2016-08-31", "description": "Security operations for DISA. STIG implementation across Windows and Linux. Handled 150+ annual security incidents.", "client_agency": "DISA", "relevant_skills": ["STIG", "Incident Response", "DISA"]}, {"job_title": "Information Assurance Analyst", "employer": "U.S. Army Cyber Command", "start_date": "2010-06-01", "end_date": "2011-12-31", "description": "Network defense operations for Army classified networks.", "client_agency": "ARCYBER", "relevant_skills": ["Network Defense", "IA Compliance"]}]'::jsonb,
   '[{"role_title": "Cybersecurity Lead", "is_key_personnel": true, "labor_category": "Senior Cybersecurity Engineer", "summary_for_role": "15 years IT experience, 13 years federal cybersecurity. CISSP, CEH, CISM certified. Currently leading SOC for DHA with SPRS 104."}]'::jsonb
  );

  -- SUPPORT STAFF (4 additional)
  INSERT INTO personnel (company_id, status, full_name, email, employment_type, availability, geographic_location, remote_capable, clearance_level, clearance_status, education, certifications, total_experience_years, federal_experience_years, work_history, proposed_roles) VALUES
  (v_cid, 'Active', 'Amy Nguyen', 'amy.nguyen@meridianits.com', 'W2 Employee', 'Immediately Available', 'Tysons, VA', true, 'Secret', 'Active',
   '[{"degree_level": "Bachelor", "field_of_study": "Information Technology", "institution": "George Mason University", "graduation_year": 2015}]'::jsonb,
   '[{"name": "CompTIA A+", "issuing_body": "CompTIA", "date_obtained": "2016-01-01", "expiration_date": "2028-01-01"}, {"name": "ITIL v4 Foundation", "issuing_body": "PeopleCert", "date_obtained": "2022-06-01", "expiration_date": "2028-06-01"}, {"name": "HDI Support Center Analyst", "issuing_body": "HDI", "date_obtained": "2019-03-01", "expiration_date": "2028-03-01"}]'::jsonb,
   9, 8,
   '[{"job_title": "Service Desk Lead", "employer": "Meridian IT Solutions", "start_date": "2019-01-01", "end_date": "Present", "description": "Leads 8-person service desk team achieving 84% first-call resolution.", "client_agency": "DISA", "relevant_skills": ["ServiceNow", "ITIL", "Help Desk"]}]'::jsonb,
   '[{"role_title": "Service Desk Lead", "is_key_personnel": false, "labor_category": "Help Desk Lead"}]'::jsonb
  ),
  (v_cid, 'Active', 'Kevin Torres', 'kevin.torres@meridianits.com', 'W2 Employee', 'Immediately Available', 'Tysons, VA', true, 'Secret', 'Active',
   '[{"degree_level": "Bachelor", "field_of_study": "Network Engineering", "institution": "Old Dominion University", "graduation_year": 2013}]'::jsonb,
   '[{"name": "CCNA", "issuing_body": "Cisco", "date_obtained": "2014-06-01", "expiration_date": "2027-06-01"}, {"name": "CompTIA Network+", "issuing_body": "CompTIA", "date_obtained": "2013-09-01", "expiration_date": "2028-09-01"}]'::jsonb,
   11, 9,
   '[{"job_title": "Network Engineer", "employer": "Meridian IT Solutions", "start_date": "2017-04-01", "end_date": "Present", "description": "Manages Cisco switching and routing infrastructure across 7 sites. Maintains 99.97% network uptime.", "client_agency": "U.S. Army", "relevant_skills": ["Cisco", "Network Monitoring", "SolarWinds"]}]'::jsonb,
   '[{"role_title": "Network Engineer", "is_key_personnel": false, "labor_category": "Network Engineer"}]'::jsonb
  ),
  (v_cid, 'Active', 'Rachel Foster', 'rachel.foster@meridianits.com', 'W2 Employee', 'Immediately Available', 'Tysons, VA', true, 'Secret', 'Active',
   '[{"degree_level": "Bachelor", "field_of_study": "Computer Science", "institution": "Virginia Commonwealth University", "graduation_year": 2016}]'::jsonb,
   '[{"name": "CompTIA Security+ CE", "issuing_body": "CompTIA", "date_obtained": "2023-05-01", "expiration_date": "2026-05-01"}, {"name": "Splunk Certified Power User", "issuing_body": "Splunk", "date_obtained": "2022-08-01", "expiration_date": "2025-08-01"}]'::jsonb,
   8, 7,
   '[{"job_title": "Cybersecurity Analyst", "employer": "Meridian IT Solutions", "start_date": "2020-01-01", "end_date": "Present", "description": "SOC analyst monitoring Splunk SIEM. Conducts vulnerability scans and STIG compliance checks.", "client_agency": "DHA", "relevant_skills": ["Splunk", "STIG", "Vulnerability Scanning"]}]'::jsonb,
   '[{"role_title": "Cybersecurity Analyst", "is_key_personnel": false, "labor_category": "Cybersecurity Analyst"}]'::jsonb
  ),
  (v_cid, 'Active', 'Brian Pham', 'brian.pham@meridianits.com', 'W2 Employee', 'Immediately Available', 'Tysons, VA', true, 'Secret', 'Active',
   '[{"degree_level": "Bachelor", "field_of_study": "Information Systems", "institution": "University of Virginia", "graduation_year": 2014}]'::jsonb,
   '[{"name": "Microsoft Azure Administrator", "issuing_body": "Microsoft", "date_obtained": "2023-10-01", "expiration_date": "2026-10-01"}, {"name": "VMware VCP-DCV", "issuing_body": "VMware", "date_obtained": "2021-07-01", "expiration_date": "2024-07-01"}]'::jsonb,
   10, 8,
   '[{"job_title": "Systems Administrator", "employer": "Meridian IT Solutions", "start_date": "2018-06-01", "end_date": "Present", "description": "Manages Windows and Linux server infrastructure. VMware vSphere administration for 150+ VM environment.", "client_agency": "U.S. Army CECOM", "relevant_skills": ["VMware", "Windows Server", "Linux", "Azure"]}]'::jsonb,
   '[{"role_title": "Systems Administrator", "is_key_personnel": false, "labor_category": "Systems Administrator"}]'::jsonb
  );

  -- ═══════════════════════════════════════════════════
  -- PAST PERFORMANCE — 4 contracts (3 prime, 1 sub)
  -- All DoD IT operations relevant. Full CPARS with all 5 dimensions.
  -- ═══════════════════════════════════════════════════

  INSERT INTO past_performance (company_id, contract_nickname, contract_name, contract_number, client_agency, client_office, contract_type, contract_value, annual_value, start_date, end_date, base_period, option_periods, role, team_size, place_of_performance, client_poc, cpars_rating, overview, description_of_effort, task_areas, tools_used, achievements, relevance_tags) VALUES
  -- PP1: DISA IT Ops (prime, current)
  (v_cid, 'DISA ENCORE III IT Operations',
   'DISA Enterprise IT Operations and Sustainment',
   'HC1028-20-D-0034-TO-0018', 'Defense Information Systems Agency', 'DISA J6',
   'T&M', 38000000, 7600000, '2020-04-01', '2025-09-30', '1 year', 4,
   'Prime', 52, 'Fort Meade, MD and 6 remote sites',
   '{"name": "Col. Patricia Hayes", "title": "Contracting Officer", "email": "patricia.hayes@disa.mil", "phone": "301-555-0301"}'::jsonb,
   '{"overall": "Exceptional", "quality": "Exceptional", "schedule": "Exceptional", "cost_control": "Very Good", "management": "Exceptional", "date_of_rating": "2024-09-15"}'::jsonb,
   'Enterprise IT operations and sustainment services for DISA supporting 3,800 users across 7 sites.',
   'Provides full-spectrum IT operations including Tier 1-3 service desk, infrastructure management, cybersecurity operations, network monitoring, end-user computing, and cloud migration support for DISA headquarters and 6 field offices. Manages ServiceNow ITSM platform, VMware virtualized environment with 180+ VMs, Cisco network infrastructure, and Splunk SIEM.',
   ARRAY['Service Desk', 'Infrastructure Management', 'Cybersecurity', 'Network Operations', 'Cloud Migration', 'End-User Computing'],
   ARRAY['ServiceNow', 'VMware vSphere', 'Cisco', 'Splunk', 'SolarWinds', 'Tanium', 'SCCM', 'Microsoft Azure'],
   '[{"statement": "Achieved first-call resolution rate of 84%, exceeding 80% SLA target", "metric_value": "84%", "metric_type": "Quality Improvement"}, {"statement": "Reduced mean time to resolve Tier 2 tickets by 28% through automation", "metric_value": "28%", "metric_type": "Efficiency Gain"}, {"statement": "Maintained 99.97% infrastructure availability across all sites", "metric_value": "99.97%", "metric_type": "Quality Improvement"}, {"statement": "Completed hybrid cloud migration of 40 workloads to Azure GovCloud under budget", "metric_value": "$240K under budget", "metric_type": "Cost Savings"}]'::jsonb,
   ARRAY['DoD', 'IT Operations', 'Service Desk', 'Infrastructure', 'Cybersecurity', 'Multi-Site', 'DISA']
  ),
  -- PP2: Army CECOM (prime)
  (v_cid, 'Army CECOM IT Modernization',
   'Army CECOM Communications-Electronics IT Support',
   'W15P7T-18-D-0055-TO-0003', 'U.S. Army', 'CECOM',
   'FFP', 22000000, 4400000, '2018-10-01', '2024-03-31', '1 year', 4,
   'Prime', 35, 'Aberdeen Proving Ground, MD',
   '{"name": "James Morton", "title": "Contracting Officer Representative", "email": "james.morton@army.mil", "phone": "410-555-0402"}'::jsonb,
   '{"overall": "Very Good", "quality": "Exceptional", "schedule": "Very Good", "cost_control": "Very Good", "management": "Very Good", "date_of_rating": "2023-12-01"}'::jsonb,
   'IT modernization and sustainment support for Army CECOM at Aberdeen Proving Ground.',
   'Provided enterprise IT support including server and workstation lifecycle management, Windows 10/11 migration across 2,500 endpoints, Active Directory administration, infrastructure monitoring, and help desk services for CECOM headquarters campus.',
   ARRAY['Infrastructure Management', 'Desktop Support', 'Help Desk', 'OS Migration', 'Server Administration'],
   ARRAY['SCCM', 'Active Directory', 'VMware', 'SolarWinds', 'ServiceNow'],
   '[{"statement": "Completed Windows 11 migration for 2,500 endpoints 3 weeks ahead of schedule", "metric_value": "3 weeks early", "metric_type": "Time Savings"}, {"statement": "Reduced desktop incident rate by 31% through proactive patching", "metric_value": "31%", "metric_type": "Quality Improvement"}, {"statement": "Achieved 99.95% server uptime across 120 physical and virtual servers", "metric_value": "99.95%", "metric_type": "Quality Improvement"}]'::jsonb,
   ARRAY['DoD', 'Army', 'IT Modernization', 'Desktop Support', 'Infrastructure']
  ),
  -- PP3: DHA Cybersecurity (prime)
  (v_cid, 'DHA Cybersecurity Operations',
   'Defense Health Agency Cybersecurity Operations Support',
   'HT0011-21-C-0089', 'Defense Health Agency', 'DHA J6 Cybersecurity Division',
   'Cost-Plus', 18000000, 3600000, '2021-06-01', '2026-05-31', '1 year', 4,
   'Prime', 28, 'Falls Church, VA and 3 medical centers',
   '{"name": "Dr. William Park", "title": "Contracting Officer", "email": "william.park@health.mil", "phone": "703-555-0503"}'::jsonb,
   '{"overall": "Exceptional", "quality": "Exceptional", "schedule": "Very Good", "cost_control": "Exceptional", "management": "Exceptional", "date_of_rating": "2024-06-30"}'::jsonb,
   'Cybersecurity operations support for the Defense Health Agency protecting 4,200 users and 12 information systems.',
   'Full cybersecurity operations including SOC monitoring (24/7), vulnerability management, RMF lifecycle support for 12 systems, STIG implementation, incident response, security awareness training, and DFARS 252.204-7012 compliance. Manages Splunk SIEM with 500+ custom detection rules and Tanium endpoint security across 4,000 devices.',
   ARRAY['SOC Operations', 'RMF', 'Vulnerability Management', 'Incident Response', 'STIG Compliance', 'Security Training'],
   ARRAY['Splunk', 'Tanium', 'Nessus', 'eMASS', 'ACAS'],
   '[{"statement": "Achieved SPRS score of 104 across all assessed systems", "metric_value": "SPRS 104", "metric_type": "Compliance"}, {"statement": "Reduced mean time to detect security incidents by 42% through custom Splunk detections", "metric_value": "42%", "metric_type": "Efficiency Gain"}, {"statement": "Completed RMF ATO packages for 12 systems with zero findings requiring Plan of Action", "metric_value": "12 ATOs, 0 findings", "metric_type": "Compliance"}, {"statement": "Zero successful breaches during 3-year period of performance", "metric_value": "0 breaches", "metric_type": "Quality Improvement"}]'::jsonb,
   ARRAY['DoD', 'Cybersecurity', 'SOC', 'RMF', 'DFARS', 'Health IT']
  ),
  -- PP4: Subcontractor on Army IT
  (v_cid, 'Army NETCOM EUC Support (Sub to Perspecta)',
   'Army NETCOM End-User Computing and Service Desk Support',
   'W52P1J-19-D-0028-TO-0006', 'U.S. Army', 'NETCOM',
   'T&M', 8500000, 1700000, '2019-09-01', '2024-08-31', '1 year', 4,
   'Subcontractor', 18, 'Fort Huachuca, AZ and Fort Gordon, GA',
   '{"name": "Lisa Trujillo", "title": "COR", "email": "lisa.trujillo@army.mil", "phone": "520-555-0604"}'::jsonb,
   '{"overall": "Very Good", "quality": "Very Good", "schedule": "Very Good", "cost_control": "Very Good", "management": "Exceptional", "date_of_rating": "2024-03-15"}'::jsonb,
   'Subcontractor providing end-user computing and Tier 1-2 service desk support for Army NETCOM.',
   'As subcontractor to Perspecta (20% workshare), provided Tier 1-2 help desk services supporting 2,200 Army users at two installations, desktop imaging and deployment, printer/copier management, and VTC support.',
   ARRAY['Service Desk', 'Desktop Support', 'Printer Management', 'VTC Support'],
   ARRAY['ServiceNow', 'SCCM', 'Cisco WebEx'],
   '[{"statement": "Maintained 87% first-call resolution rate across both sites", "metric_value": "87%", "metric_type": "Quality Improvement"}, {"statement": "Deployed 800 workstations during technology refresh in 45 days", "metric_value": "800 in 45 days", "metric_type": "Efficiency Gain"}]'::jsonb,
   ARRAY['DoD', 'Army', 'Service Desk', 'Desktop Support', 'Multi-Site', 'Subcontractor']
  );

  -- ═══════════════════════════════════════════════════
  -- SERVICE AREAS
  -- ═══════════════════════════════════════════════════
  INSERT INTO service_areas (company_id, service_name, description, experience_years, key_clients, relevant_naics) VALUES
    (v_cid, 'Enterprise IT Service Desk', 'Tiered help desk operations (Tier 0-3) using ITIL processes and ServiceNow ITSM. Supports up to 5,000 concurrent users per contract.', 12, ARRAY['DISA', 'U.S. Army', 'DHA'], ARRAY['541512']),
    (v_cid, 'Infrastructure Management', 'Server, storage, network, and cloud infrastructure management. VMware, Azure, AWS GovCloud, Cisco, NetApp.', 12, ARRAY['DISA', 'CECOM', 'DHA'], ARRAY['541512']),
    (v_cid, 'Cybersecurity Operations', 'SOC operations, RMF, vulnerability management, STIG compliance, incident response, DFARS/NIST 800-171 compliance.', 10, ARRAY['DHA', 'DISA', 'Army'], ARRAY['541512']),
    (v_cid, 'End-User Computing', 'Desktop, laptop, mobile device provisioning, imaging, and lifecycle management using SCCM/Intune.', 12, ARRAY['CECOM', 'NETCOM'], ARRAY['541512']),
    (v_cid, 'Cloud Services', 'Cloud migration, hybrid architecture, and ongoing management of Azure and AWS GovCloud workloads.', 6, ARRAY['DISA'], ARRAY['541512']),
    (v_cid, 'Telecommunications', 'VoIP, VTC, and unified communications management across multi-site environments.', 10, ARRAY['Army', 'DISA'], ARRAY['541512']);

  -- ═══════════════════════════════════════════════════
  -- TOOLS & TECHNOLOGIES
  -- ═══════════════════════════════════════════════════
  INSERT INTO tools_technologies (company_id, name, category, proficiency, years_experience, certified_practitioners) VALUES
    (v_cid, 'ServiceNow', 'ITSM', 'Expert', 8, 12),
    (v_cid, 'VMware vSphere', 'Virtualization', 'Expert', 10, 8),
    (v_cid, 'Microsoft Azure / Azure GovCloud', 'Cloud', 'Proficient', 5, 6),
    (v_cid, 'AWS GovCloud', 'Cloud', 'Proficient', 4, 3),
    (v_cid, 'Splunk Enterprise Security', 'SIEM', 'Expert', 7, 5),
    (v_cid, 'Cisco Networking (Switches/Routers/Firewalls)', 'Network', 'Expert', 12, 10),
    (v_cid, 'SolarWinds Orion', 'Monitoring', 'Expert', 9, 6),
    (v_cid, 'Tanium', 'Endpoint Security', 'Proficient', 5, 4),
    (v_cid, 'SCCM / Microsoft Endpoint Configuration Manager', 'Desktop Management', 'Expert', 10, 8),
    (v_cid, 'Microsoft Intune', 'MDM', 'Proficient', 3, 4),
    (v_cid, 'Nessus / Tenable.sc', 'Vulnerability Management', 'Proficient', 6, 4),
    (v_cid, 'Active Directory / Azure AD', 'Identity', 'Expert', 12, 15),
    (v_cid, 'ACAS', 'Compliance Scanning', 'Proficient', 5, 3),
    (v_cid, 'eMASS', 'RMF', 'Proficient', 4, 2);

  -- ═══════════════════════════════════════════════════
  -- METHODOLOGIES
  -- ═══════════════════════════════════════════════════
  INSERT INTO methodologies (company_id, name, category, implementation_experience, certified_practitioners) VALUES
    (v_cid, 'ITIL v4', 'Service Management', 'Implemented across all IT operations contracts since 2015', 15),
    (v_cid, 'NIST Risk Management Framework (RMF)', 'Security', 'Applied to 20+ information system authorizations', 6),
    (v_cid, 'NIST SP 800-171 / CMMC', 'Compliance', 'Achieved SPRS 104 on most recent assessment', 4),
    (v_cid, 'Agile/Scrum', 'Development', 'Used for internal tool development and CI/CD pipelines', 5),
    (v_cid, 'CMMI-SVC Level 3', 'Process Improvement', 'Appraised 2024; all service delivery process areas', 180);

  -- ═══════════════════════════════════════════════════
  -- VALUE PROPOSITIONS
  -- ═══════════════════════════════════════════════════
  INSERT INTO value_propositions (company_id, theme, statement, proof_points, applicable_to) VALUES
    (v_cid, 'Mission Reliability',
     'Meridian delivers consistent, measurable performance with a track record of Exceptional CPARS ratings.',
     ARRAY['5 consecutive CPARS rated Exceptional or Very Good', '99.97% infrastructure uptime on DISA contract', 'Zero performance cure notices in 13 years'],
     ARRAY['Technical', 'Management', 'Past Performance']),
    (v_cid, 'Cleared Workforce Depth',
     'Meridian maintains a bench of 25+ cleared IT professionals enabling Day 1 staffing without recruiting risk.',
     ARRAY['180 cleared employees across active contracts', '92% employee retention rate over 3 years', 'All proposed key personnel are current W2 employees'],
     ARRAY['Management', 'Technical']),
    (v_cid, 'Process Maturity',
     'CMMI-SVC Level 3 and ISO 27001 provide institutional rigor that reduces delivery risk.',
     ARRAY['CMMI-SVC Level 3 appraised January 2024', 'ISO 27001 certified June 2024', 'DCAA-approved accounting system'],
     ARRAY['Management', 'Cost/Price']);

  -- ═══════════════════════════════════════════════════
  -- COMPETITIVE ADVANTAGES
  -- ═══════════════════════════════════════════════════
  INSERT INTO competitive_advantages (company_id, area, our_strength, competitor_weakness, ghosting_phrase) VALUES
    (v_cid, 'Small Business Agility',
     'As a small business, Meridian provides direct executive involvement on every contract with rapid decision-making and staffing flexibility. CEO and COO participate in monthly contract reviews. Average time to fill a vacant position: 18 days vs industry average of 45 days.',
     'Larger contractors often assign junior PMs with limited authority, leading to slow decision-making and delayed staffing actions.',
     'Our small business structure ensures direct executive engagement on every contract — decisions are made in hours, not weeks, and staffing gaps are filled in 18 days versus industry averages of 45.'),
    (v_cid, 'DoD IT Operations Specialization',
     'Meridian focuses exclusively on DoD and federal IT operations — 100% of revenue comes from government IT services. 14 active federal contracts with all past performance references in DoD IT operations.',
     'Many competitors cite mixed commercial/federal portfolios where federal IT is a secondary business line without dedicated DoD expertise.',
     'Unlike contractors who treat federal IT as one of many business lines, 100% of our revenue and operational focus is dedicated to DoD and federal IT operations.'),
    (v_cid, 'Transition Excellence',
     'Proven 30-day transition methodology with 100% success rate across 8 contract transitions. Most recent DISA transition completed 5 days ahead of schedule with zero service interruptions.',
     'New contractors face steep learning curves and transition delays that risk service disruptions during the critical first 30 days.',
     'Our proven 30-day transition methodology has achieved 100% success across 8 contract transitions with zero service interruptions — most recently completing a DISA transition 5 days ahead of schedule.');

  RAISE NOTICE 'Meridian IT Solutions created with ID: %', v_cid;
  RAISE NOTICE 'Company has: 7 personnel, 4 past performance, 5 certifications, 3 vehicles, 4 NAICS, 6 service areas, 14 tools, 5 methodologies';

END $$;

-- ═══════════════════════════════════════════════════
-- VALIDATION QUERIES
-- ═══════════════════════════════════════════════════

-- Check Tier 1 completeness fields
SELECT company_name, cage_code, uei_number, sam_status, business_size, tier1_complete, completeness_score,
  CASE WHEN LENGTH(corporate_overview) >= 50 THEN 'OK' ELSE 'SHORT' END AS overview_check,
  CASE WHEN LENGTH(core_services_summary) >= 30 THEN 'OK' ELSE 'SHORT' END AS services_check,
  CASE WHEN ARRAY_LENGTH(enterprise_win_themes, 1) >= 3 THEN 'OK' ELSE 'NEED 3+' END AS themes_check,
  CASE WHEN LENGTH(key_differentiators_summary) >= 30 THEN 'OK' ELSE 'SHORT' END AS diff_check,
  CASE WHEN LENGTH(standard_management_approach) >= 50 THEN 'OK' ELSE 'SHORT' END AS mgmt_check
FROM company_profiles WHERE company_name = 'Meridian IT Solutions';

-- Check child table counts
SELECT 'Personnel' AS table_name, COUNT(*) AS row_count FROM personnel WHERE company_id = (SELECT id FROM company_profiles WHERE company_name = 'Meridian IT Solutions')
UNION ALL
SELECT 'Past Performance', COUNT(*) FROM past_performance WHERE company_id = (SELECT id FROM company_profiles WHERE company_name = 'Meridian IT Solutions')
UNION ALL
SELECT 'Certifications', COUNT(*) FROM certifications WHERE company_id = (SELECT id FROM company_profiles WHERE company_name = 'Meridian IT Solutions')
UNION ALL
SELECT 'Contract Vehicles', COUNT(*) FROM contract_vehicles WHERE company_id = (SELECT id FROM company_profiles WHERE company_name = 'Meridian IT Solutions')
UNION ALL
SELECT 'NAICS Codes', COUNT(*) FROM naics_codes WHERE company_id = (SELECT id FROM company_profiles WHERE company_name = 'Meridian IT Solutions')
UNION ALL
SELECT 'Service Areas', COUNT(*) FROM service_areas WHERE company_id = (SELECT id FROM company_profiles WHERE company_name = 'Meridian IT Solutions')
UNION ALL
SELECT 'Tools & Technologies', COUNT(*) FROM tools_technologies WHERE company_id = (SELECT id FROM company_profiles WHERE company_name = 'Meridian IT Solutions');

-- Key personnel names (THESE are the authoritative names for all volumes)
SELECT full_name, 
  (proposed_roles->0->>'role_title') AS role,
  availability,
  clearance_level,
  total_experience_years,
  federal_experience_years
FROM personnel 
WHERE company_id = (SELECT id FROM company_profiles WHERE company_name = 'Meridian IT Solutions')
  AND (proposed_roles->0->>'is_key_personnel')::boolean = true
ORDER BY proposed_roles->0->>'role_title';
