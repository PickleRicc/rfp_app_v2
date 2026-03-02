-- UPDATE script for existing TechVision Federal Solutions company
-- Fixes: narrative values, Patel Azure claim, expired certs, FCL upgrade, corporate overview
-- Adds: 4 new personnel records for ARL IT operations scope
--
-- IMPORTANT: This uses UPDATE on the existing company UUID.
-- It does NOT re-create the company. All relationships are preserved.

DO $$
DECLARE
  v_company_id UUID := '82545dfa-9a53-45da-8da9-134b2ea2ec37';
BEGIN

-- ============================================================================
-- FIX 1: Correct full_description narrative (wrong contract values)
-- ============================================================================

UPDATE company_profiles SET
  full_description = 'Founded in 2015, TechVision Federal Solutions has grown from a 5-person startup to a 145-employee leader in federal IT services. We specialize in agile transformation, cloud migration, DevSecOps, and digital modernization for mission-critical systems. Our team has supported 15+ federal agencies including DHS, VA, HHS, and DOD. Notable contracts include a $12.5M DHS cybersecurity operations program, an $8.75M VA agile transformation initiative, a $15M HHS cloud migration, a $6.5M EPA ServiceNow implementation, and a $4.2M GSA digital services project. We hold an active GSA MAS contract, CIO-SP3 GWAC spot, and maintain CMMI Level 3 certification. Our client retention rate exceeds 95%, and we have consistently achieved CPARS ratings of "Exceptional" or "Very Good." We pride ourselves on our veteran leadership (60% veteran workforce), strong cybersecurity credentials, and proven ability to deliver complex programs on time and under budget.'
WHERE id = v_company_id;

RAISE NOTICE 'Fixed full_description narrative contract values';

-- ============================================================================
-- FIX 2: Patel Azure claim — remove unsubstantiated Azure references
-- ============================================================================

UPDATE personnel SET
  work_history = jsonb_set(
    work_history,
    '{0,description}',
    '"Lead architect for federal cloud migrations and enterprise modernization. Designed cloud solutions for 50+ applications. Expert in AWS and hybrid cloud architectures."'::jsonb
  ),
  proposed_roles = jsonb_set(
    proposed_roles,
    '{0,summary_for_role}',
    '"19 years of enterprise architecture experience with deep expertise in cloud technologies. AWS certified. Led 30+ successful cloud migrations for federal agencies."'::jsonb
  )
WHERE company_id = v_company_id AND full_name = 'Dr. Priya Patel';

RAISE NOTICE 'Fixed Patel Azure references in work_history and proposed_roles';

-- ============================================================================
-- FIX 3: Expired certifications — extend to future dates
-- ============================================================================

-- Anderson SPC cert (was 2025-03-20)
UPDATE certifications SET expiration_date = '2027-03-20'
WHERE company_id = v_company_id
  AND certification_type = 'SAFe Program Consultant (SPC)'
  AND expiration_date = '2025-03-20';

-- Patel AWS SAP cert (was 2025-08-10)
UPDATE certifications SET expiration_date = '2027-08-10'
WHERE company_id = v_company_id
  AND certification_type = 'AWS Certified Solutions Architect - Professional'
  AND expiration_date = '2025-08-10';

RAISE NOTICE 'Fixed expired certification dates for Anderson (SPC) and Patel (AWS SAP)';

-- ============================================================================
-- FIX 4: Upgrade Facility Clearance from Secret to Top Secret
-- ============================================================================

UPDATE facility_clearances SET
  clearance_level = 'Top Secret',
  sponsoring_agency = 'US Army',
  safeguarding_capability = 'Top Secret'
WHERE company_id = v_company_id;

RAISE NOTICE 'Upgraded facility clearance to Top Secret (US Army sponsor)';

-- ============================================================================
-- FIX 5: Add corporate_overview and core_services_summary (currently null)
-- ============================================================================

UPDATE company_profiles SET
  corporate_overview = 'TechVision Federal Solutions is a 145-employee SDVOSB specializing in IT operations, cybersecurity, cloud migration, and enterprise service management for federal agencies. We hold an active Top Secret Facility Clearance (CAGE 8A9B7), GSA MAS contract (GS-35F-0123R), and CIO-SP3 GWAC position. Our CMMI Level 3 processes, 60% veteran workforce, and consistent CPARS ratings of Exceptional/Very Good demonstrate our commitment to mission-critical federal IT support. Revenue: $28.5M (FY2025).',
  core_services_summary = 'IT Service Management (ServiceNow ITSM/ITOM/ITAM); Enterprise Cybersecurity Operations (SOC, vulnerability management, NIST/FedRAMP compliance); Cloud Migration & Management (AWS GovCloud, hybrid architectures); Agile Transformation & Program Management (SAFe, Scrum); Network Engineering & Infrastructure Management; End-User Device Support & Service Desk Operations; Digital Modernization & DevSecOps'
WHERE id = v_company_id;

RAISE NOTICE 'Added corporate_overview and core_services_summary';

-- ============================================================================
-- FIX 6: Add 4 new personnel records for ARL IT operations scope
-- ============================================================================

-- Person 4: Service Desk Manager
INSERT INTO personnel (
  company_id, status, full_name, email, phone, employment_type,
  availability, geographic_location, relocation_willing, remote_capable,
  clearance_level, clearance_status,
  education, certifications,
  total_experience_years, federal_experience_years, relevant_experience_years,
  work_history, proposed_roles
) VALUES
(v_company_id, 'Active', 'Karen Mitchell', 'karen.mitchell@techvisionfed.com', '(703) 555-1004', 'W2 Employee',
'Immediately Available', 'Aberdeen, MD', false, false,
'Secret', 'Active',
'[{"degree_level": "Bachelor", "field_of_study": "Information Technology", "institution": "University of Maryland", "graduation_year": 2012}]'::jsonb,
'[{"name": "ITIL v4 Foundation", "issuing_body": "Axelos", "date_obtained": "2020-04-15", "expiration_date": "", "certification_number": "ITIL4-F-456789"},
{"name": "CompTIA A+", "issuing_body": "CompTIA", "date_obtained": "2013-09-10", "expiration_date": "2027-09-10", "certification_number": "COMP-A-112233"},
{"name": "HDI Customer Service Representative", "issuing_body": "HDI", "date_obtained": "2018-06-20", "expiration_date": "", "certification_number": "HDI-CSR-334455"}]'::jsonb,
12, 8, 10,
'[{"job_title": "Service Desk Manager", "employer": "TechVision Federal Solutions", "start_date": "06/2020", "end_date": "Present", "description": "Managing 40-person service desk supporting 4,000+ users across DoD facilities. Oversee Tier 1-3 support operations, SLA compliance, and ServiceNow incident management workflows.", "client_agency": "DoD, Army", "contract_reference": "", "relevant_skills": ["Service Desk Management", "ServiceNow", "ITIL", "SLA Management"]}]'::jsonb,
'[{"role_title": "Service Desk Manager", "is_key_personnel": false, "labor_category": "IT Service Manager III", "bill_rate": 125.00, "cost_rate": 85.00, "summary_for_role": "12 years IT service management experience. ITIL v4 certified. Currently managing 40-person service desk for DoD with 98.5% SLA compliance."}]'::jsonb
),

-- Person 5: Network Engineer
(v_company_id, 'Active', 'David Thompson', 'david.thompson@techvisionfed.com', '(703) 555-1005', 'W2 Employee',
'Immediately Available', 'Aberdeen, MD', false, true,
'Secret', 'Active',
'[{"degree_level": "Bachelor", "field_of_study": "Network Engineering", "institution": "George Mason University", "graduation_year": 2010}]'::jsonb,
'[{"name": "Cisco CCNP Enterprise", "issuing_body": "Cisco", "date_obtained": "2017-11-15", "expiration_date": "2027-11-15", "certification_number": "CCNP-ENT-778899"},
{"name": "CompTIA Network+", "issuing_body": "CompTIA", "date_obtained": "2011-03-20", "expiration_date": "2027-03-20", "certification_number": "COMP-NET-223344"},
{"name": "Cisco ISE Administrator", "issuing_body": "Cisco", "date_obtained": "2021-08-10", "expiration_date": "2027-08-10", "certification_number": "CISCO-ISE-556677"}]'::jsonb,
15, 10, 14,
'[{"job_title": "Senior Network Engineer", "employer": "TechVision Federal Solutions", "start_date": "01/2019", "end_date": "Present", "description": "Lead network engineer for DoD enterprise networks. Manages Cisco ISE, firewall configurations, VPN infrastructure, and Zero Trust implementation across classified and unclassified environments.", "client_agency": "DoD, Army, DHS", "contract_reference": "", "relevant_skills": ["Cisco ISE", "Zero Trust", "Network Security", "CCNP"]}]'::jsonb,
'[{"role_title": "Network Engineer", "is_key_personnel": false, "labor_category": "Network Engineer III", "bill_rate": 145.00, "cost_rate": 100.00, "summary_for_role": "15 years network engineering. CCNP Enterprise and Cisco ISE certified. Experienced with DoD Zero Trust and Comply-to-Connect implementations."}]'::jsonb
),

-- Person 6: Systems Administrator
(v_company_id, 'Active', 'Lisa Park', 'lisa.park@techvisionfed.com', '(703) 555-1006', 'W2 Employee',
'Immediately Available', 'Adelphi, MD', false, true,
'Secret', 'Active',
'[{"degree_level": "Bachelor", "field_of_study": "Computer Science", "institution": "Towson University", "graduation_year": 2011}]'::jsonb,
'[{"name": "Red Hat Certified System Administrator (RHCSA)", "issuing_body": "Red Hat", "date_obtained": "2016-05-20", "expiration_date": "2027-05-20", "certification_number": "RHCSA-889900"},
{"name": "Microsoft Certified Solutions Expert (MCSE)", "issuing_body": "Microsoft", "date_obtained": "2018-02-15", "expiration_date": "", "certification_number": "MCSE-112244"},
{"name": "Nutanix Certified Professional (NCP)", "issuing_body": "Nutanix", "date_obtained": "2022-09-10", "expiration_date": "2027-09-10", "certification_number": "NCP-556688"}]'::jsonb,
14, 9, 12,
'[{"job_title": "Senior Systems Administrator", "employer": "TechVision Federal Solutions", "start_date": "03/2018", "end_date": "Present", "description": "Manages Windows Server, Red Hat Linux, and Nutanix HCI environments for DoD research labs. Handles server provisioning, patching, backup/restore, and STIG compliance across 200+ servers.", "client_agency": "DoD, Army Research Lab", "contract_reference": "", "relevant_skills": ["RHEL", "Windows Server", "Nutanix HCI", "STIG Compliance"]}]'::jsonb,
'[{"role_title": "Systems Administrator", "is_key_personnel": false, "labor_category": "Systems Administrator III", "bill_rate": 135.00, "cost_rate": 92.00, "summary_for_role": "14 years systems administration. RHCSA, MCSE, and Nutanix NCP certified. Manages 200+ server environment for DoD research labs with 99.9% uptime."}]'::jsonb
),

-- Person 7: ServiceNow Developer
(v_company_id, 'Active', 'Robert Kim', 'robert.kim@techvisionfed.com', '(703) 555-1007', 'W2 Employee',
'Immediately Available', 'Arlington, VA', true, true,
'Secret', 'Active',
'[{"degree_level": "Bachelor", "field_of_study": "Software Engineering", "institution": "Virginia Tech", "graduation_year": 2014}]'::jsonb,
'[{"name": "ServiceNow Certified System Administrator (CSA)", "issuing_body": "ServiceNow", "date_obtained": "2019-06-15", "expiration_date": "", "certification_number": "SN-CSA-334455"},
{"name": "ServiceNow Certified Application Developer (CAD)", "issuing_body": "ServiceNow", "date_obtained": "2020-11-20", "expiration_date": "", "certification_number": "SN-CAD-667788"},
{"name": "ITIL v4 Foundation", "issuing_body": "Axelos", "date_obtained": "2019-01-10", "expiration_date": "", "certification_number": "ITIL4-F-998877"}]'::jsonb,
11, 7, 9,
'[{"job_title": "ServiceNow Platform Developer", "employer": "TechVision Federal Solutions", "start_date": "09/2019", "end_date": "Present", "description": "Lead ServiceNow developer for federal ITSM implementations. Manages platform upgrades, CMDB governance, CSM/ITSM/HAM/SAM module configuration, and custom application development. Completed 3 federal ServiceNow deployments serving 30,000+ users.", "client_agency": "EPA, DoD, VA", "contract_reference": "", "relevant_skills": ["ServiceNow CSA", "ServiceNow CAD", "ITSM", "CMDB", "Platform Administration"]}]'::jsonb,
'[{"role_title": "ServiceNow Developer", "is_key_personnel": false, "labor_category": "Application Developer III", "bill_rate": 140.00, "cost_rate": 95.00, "summary_for_role": "11 years software development, 7 years federal. ServiceNow CSA and CAD certified. Led 3 federal ServiceNow deployments serving 30,000+ combined users."}]'::jsonb
);

RAISE NOTICE 'Added 4 new personnel records (Mitchell, Thompson, Park, Kim)';

-- ============================================================================
-- SUMMARY
-- ============================================================================

RAISE NOTICE '=== All fixes applied to company % ===', v_company_id;

END $$;
