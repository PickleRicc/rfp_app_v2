-- ============================================================================
-- SCRIPT 2: TIER 2 DATA CALL — Army ARL RFP for Meridian IT Solutions
--
-- PREREQUISITE: 
--   1. Run new-company-seed.sql first (creates Meridian IT Solutions)
--   2. Create a new solicitation in the app for Meridian IT Solutions
--   3. Upload the Army ARL RFP documents (same PDFs as before)
--   4. Wait for classification + reconciliation + compliance extraction to finish
--   5. Open the Data Call tab once (this creates the data_call_responses row)
--   6. Then run THIS script to populate all Tier 2 fields
--
-- IMPORTANT: After running this script, you still need to upload resume/LOC
-- PDFs through the UI for the 3 key personnel. The filenames MUST be:
--   - Brennan_Resume.pdf, Brennan_LOC.pdf
--   - Vasquez_Resume.pdf, Vasquez_LOC.pdf  
--   - Williams_Resume.pdf, Williams_LOC.pdf
--
-- Every value in this script traces directly to the Tier 1 data in
-- new-company-seed.sql. No fabricated data. No contradictions.
-- ============================================================================

-- You MUST replace this with the actual solicitation ID from your new solicitation.
-- Find it: SELECT id, solicitation_number FROM solicitations WHERE company_id = (SELECT id FROM company_profiles WHERE company_name = 'Meridian IT Solutions');
-- Then replace the UUID below.

DO $$
DECLARE
  v_cid UUID := '8c126051-8649-4bd5-afd4-04ac281c6ad0';
  v_sol_id UUID := '49e09382-3970-475d-be67-46f2caebff52';
  v_dcr_id UUID;
BEGIN

RAISE NOTICE 'Company ID: %, Solicitation ID: %', v_cid, v_sol_id;

-- Ensure data_call_responses record exists (upsert)
INSERT INTO data_call_responses (solicitation_id, company_id, status)
VALUES (v_sol_id, v_cid, 'in_progress')
ON CONFLICT (solicitation_id, company_id) DO NOTHING;

SELECT id INTO v_dcr_id FROM data_call_responses WHERE solicitation_id = v_sol_id AND company_id = v_cid LIMIT 1;
IF v_dcr_id IS NULL THEN RAISE EXCEPTION 'Could not create/find data_call_responses record'; END IF;

RAISE NOTICE 'Data Call Response ID: %', v_dcr_id;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 1: KEY PERSONNEL
-- Names MUST exactly match personnel table from new-company-seed.sql:
--   Thomas Brennan (PM), Dr. Nina Vasquez (LSE), Marcus Williams (Cyber)
-- ═══════════════════════════════════════════════════════════════════
UPDATE data_call_responses SET
  key_personnel = '[
    {
      "name": "Thomas Brennan",
      "role": "Program Manager",
      "qualifications_summary": "PMP-certified with 20 years IT program management, 16 years federal. Currently manages $38M DISA IT operations contract (52 FTEs, 3,800 users, 7 sites) with Exceptional CPARS. ITIL v4 certified. Expert in multi-site DoD IT service delivery. Top Secret clearance. Immediately available."
    },
    {
      "name": "Dr. Nina Vasquez",
      "role": "Lead Systems Engineer",
      "qualifications_summary": "Doctorate in Computer Engineering from University of Maryland. 14 years enterprise infrastructure, 12 years federal. AWS SA Pro, CCNP Enterprise, VCP-DCV, Azure Administrator certified. Currently leads infrastructure for Army CECOM (180+ VMs, Cisco networking, NetApp SAN). Top Secret clearance. Immediately available."
    },
    {
      "name": "Marcus Williams",
      "role": "Cybersecurity Lead",
      "qualifications_summary": "15 years cybersecurity, 13 years federal. CISSP, CEH, CISM certified. Currently leads SOC for Defense Health Agency protecting 4,200 users. SPRS score 104. Expert in RMF, Splunk SIEM, DFARS 252.204-7012 compliance. Top Secret clearance. Available with 2 weeks notice."
    }
  ]'::jsonb
WHERE id = v_dcr_id;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 2: OPPORTUNITY DETAILS
-- ═══════════════════════════════════════════════════════════════════
UPDATE data_call_responses SET
  opportunity_details = '{
    "contract_type": "Cost-Plus-Fixed-Fee (CPFF)",
    "prime_or_sub": "prime",
    "set_aside": "Service-Disabled Veteran-Owned Small Business (SDVOSB)",
    "naics_code": "541512",
    "size_standard": "$34M",
    "teaming_partners": []
  }'::jsonb
WHERE id = v_dcr_id;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 3: TECHNICAL APPROACH
-- User count: uses whatever the RFP says (approx 3,500 per the SOO)
-- Tools: ONLY tools from Tier 1 tools_technologies table
-- Personnel names: ONLY from Tier 1 personnel table
-- ═══════════════════════════════════════════════════════════════════
UPDATE data_call_responses SET
  technical_approach = '{
    "approach_summary": "Meridian IT Solutions will deliver comprehensive IT operations and service desk support for ARL across all performance sites. Our approach leverages ITIL v4 best practices, ServiceNow ITSM for workflow automation, and a tiered staffing model with 100% current Meridian employees. We emphasize proactive infrastructure monitoring via SolarWinds and Splunk, cybersecurity operations aligned with NIST 800-171 and DFARS 252.204-7012, and knowledge-centric service desk operations driving first-call resolution above 82%.",
    "tools_and_platforms": "ServiceNow (ITSM, ITOM, ITAM), Splunk Enterprise Security, SolarWinds Orion NPM/SAM, VMware vSphere, Microsoft SCCM, Microsoft Intune, Cisco Networking, Tanium, Nessus/Tenable.sc, ACAS, eMASS, Active Directory/Azure AD",
    "staffing_model": "Key personnel: Thomas Brennan (Program Manager), Dr. Nina Vasquez (Lead Systems Engineer), Marcus Williams (Cybersecurity Lead). Support staff includes Amy Nguyen (Service Desk Lead), Kevin Torres (Network Engineer), Rachel Foster (Cybersecurity Analyst), Brian Pham (Systems Administrator). All are current W2 employees of Meridian IT Solutions.",
    "assumptions": "User population and site count per the SOO. Existing ServiceNow instance available for configuration. 30-day transition period with incumbent knowledge transfer. Government-furnished equipment and facilities.",
    "risks": "Transition risk from incumbent — mitigated by 30-day phased approach with parallel operations. Staffing continuity — mitigated by 92% employee retention rate and bench of 25+ cleared professionals. Technology refresh during performance — mitigated by modular architecture and vendor-agnostic approach."
  }'::jsonb
WHERE id = v_dcr_id;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 4: COMPLIANCE VERIFICATION
-- Values directly from Tier 1: CAGE M3R7K, UEI JM4KDLR8YNHX,
-- CMMI-SVC Level 3, ISO 27001, DCAA approved, Secret FCL
-- ═══════════════════════════════════════════════════════════════════
UPDATE data_call_responses SET
  compliance_verification = '{
    "sprs_score": 104,
    "sprs_assessment_date": "2025-09-15",
    "nist_800_171_compliant": true,
    "open_poam_items": 2,
    "facility_clearance_level": "Secret",
    "facility_clearance_cage": "M3R7K",
    "facility_clearance_sponsor": "Defense Counterintelligence and Security Agency (DCSA)",
    "sdvosb_certified": true,
    "sdvosb_cert_number": "CVE-2024-5678",
    "sdvosb_expiration": "2027-04-01",
    "cmmi_level": 3,
    "iso_9001_certified": false,
    "iso_27001_certified": true,
    "annual_revenue": "$42M",
    "size_standard_met": true
  }'::jsonb
WHERE id = v_dcr_id;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 5: SERVICE AREA APPROACHES
-- Tools referenced here ONLY come from Tier 1 tools_technologies.
-- Personnel names ONLY from Tier 1 personnel table.
-- ═══════════════════════════════════════════════════════════════════
UPDATE data_call_responses SET
  service_area_approaches = '[
    {"area_code": "3.1", "area_name": "Planning Support", "approach_narrative": "ServiceNow-driven project tracking and resource management. Weekly status meetings with government leadership.", "proposed_tools": "ServiceNow", "proposed_staffing": "Thomas Brennan (PM oversight)", "key_differentiator": "Proactive planning with automated ServiceNow dashboards."},
    {"area_code": "3.2.1", "area_name": "Service Desk Operations", "approach_narrative": "ITIL v4-aligned tiered service desk with ServiceNow ITSM. Tier 0 self-service, Tier 1 first-contact resolution (target 82%+), Tier 2/3 engineering escalation.", "proposed_tools": "ServiceNow ITSM, Active Directory", "proposed_staffing": "Amy Nguyen (Service Desk Lead), co-located technicians", "key_differentiator": "Knowledge-centric approach drives 82%+ first-call resolution based on current DISA contract performance."},
    {"area_code": "3.2.2", "area_name": "End-User Device Management", "approach_narrative": "Automated endpoint management using SCCM for Windows and Microsoft Intune for mobile devices.", "proposed_tools": "SCCM, Microsoft Intune", "proposed_staffing": "Brian Pham (Systems Administrator), endpoint technicians", "key_differentiator": "Automated patching and imaging reduces deployment time."},
    {"area_code": "3.2.4", "area_name": "Mobile Device Management", "approach_narrative": "Microsoft Intune for MDM with Azure AD Conditional Access policy enforcement.", "proposed_tools": "Microsoft Intune, Active Directory/Azure AD", "proposed_staffing": "Shared with endpoint team", "key_differentiator": "Automated compliance enforcement."},
    {"area_code": "3.2.5", "area_name": "Printer/Copier Management", "approach_narrative": "Centralized print management with proactive consumable monitoring.", "proposed_tools": "ServiceNow ITSM", "proposed_staffing": "Dedicated technician", "key_differentiator": "Proactive monitoring eliminates reactive supply orders."},
    {"area_code": "3.2.8", "area_name": "Network Engineering and Support", "approach_narrative": "Full-spectrum network management including Cisco switching, routing, and firewall administration. SolarWinds for monitoring and alerting.", "proposed_tools": "Cisco Networking, SolarWinds Orion", "proposed_staffing": "Kevin Torres (Network Engineer)", "key_differentiator": "99.97% network uptime on current DISA contract."},
    {"area_code": "3.2.10", "area_name": "Server and Storage Administration", "approach_narrative": "VMware vSphere server administration. Dr. Nina Vasquez leads infrastructure design.", "proposed_tools": "VMware vSphere, Active Directory", "proposed_staffing": "Dr. Nina Vasquez (Lead Systems Engineer), Brian Pham (Systems Administrator)", "key_differentiator": "AWS SA Pro, VCP-DCV certified engineer leading infrastructure with 99.99% uptime record."},
    {"area_code": "3.2.11", "area_name": "Infrastructure Monitoring", "approach_narrative": "24/7 infrastructure monitoring using SolarWinds for performance and Splunk for security event correlation.", "proposed_tools": "SolarWinds Orion, Splunk Enterprise Security", "proposed_staffing": "Shared with NOC operations", "key_differentiator": "Proactive monitoring identifies 85% of issues before user impact on current contracts."},
    {"area_code": "3.2.12", "area_name": "Asset and Software Management", "approach_narrative": "ServiceNow-driven full lifecycle asset management.", "proposed_tools": "ServiceNow ITSM", "proposed_staffing": "Asset management specialist", "key_differentiator": "99.5% inventory accuracy on current contracts."},
    {"area_code": "3.2.13", "area_name": "Audio Visual / VTC Systems", "approach_narrative": "VTC system support and conference room infrastructure management.", "proposed_tools": "ServiceNow ITSM", "proposed_staffing": "AV/VTC specialist", "key_differentiator": "Standardized approach reduces VTC support complexity."},
    {"area_code": "3.3", "area_name": "ServiceNow Platform Management", "approach_narrative": "Dedicated ServiceNow platform administration including upgrades, CMDB governance, and security patching.", "proposed_tools": "ServiceNow", "proposed_staffing": "Dedicated ServiceNow administrator", "key_differentiator": "8 years ServiceNow experience across 14 federal contracts."},
    {"area_code": "3.4", "area_name": "Cybersecurity and Compliance", "approach_narrative": "Comprehensive cybersecurity program led by Marcus Williams (CISSP, CEH, CISM). SOC operations with Splunk SIEM, vulnerability management with Nessus/Tenable.sc, RMF lifecycle support with eMASS, NIST SP 800-171 compliance.", "proposed_tools": "Splunk Enterprise Security, Nessus/Tenable.sc, Tanium, ACAS, eMASS", "proposed_staffing": "Marcus Williams (Cybersecurity Lead), Rachel Foster (Cybersecurity Analyst)", "key_differentiator": "SPRS score of 104. Zero breaches across all current contracts. 13 years federal cybersecurity experience."},
    {"area_code": "3.2.16", "area_name": "Customer Training", "approach_narrative": "Training program covering technology rollouts, security awareness, and productivity tools. Delivery methods include classroom instruction, over-the-shoulder coaching, just-in-time training, virtual sessions, and self-paced ServiceNow knowledge base materials.", "proposed_tools": "ServiceNow, Microsoft Teams", "proposed_staffing": "Training coordinator (shared with service desk)", "key_differentiator": "Multi-modal training with measurable outcomes."},
    {"area_code": "3.2.18", "area_name": "Classified Support", "approach_narrative": "Classified environment support for Secret and TS/SCI networks. Personnel hold active clearances.", "proposed_tools": "Splunk, Tanium", "proposed_staffing": "Cleared staff from Meridian team", "key_differentiator": "All proposed key personnel hold active Top Secret clearances."}
  ]'::jsonb
WHERE id = v_dcr_id;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 6: SITE STAFFING
-- FTE counts and roles consistent with personnel table
-- ═══════════════════════════════════════════════════════════════════
UPDATE data_call_responses SET
  site_staffing = '[
    {"site_name": "ARL Aberdeen Proving Ground (APG)", "location": "Aberdeen, MD", "proposed_fte_count": "30", "key_roles": "Amy Nguyen (Service Desk Lead), co-located technicians, Kevin Torres (Network Engineer), Brian Pham (Systems Administrator), Rachel Foster (Cybersecurity Analyst), AV/VTC specialist, asset manager", "special_requirements": "Secret clearance minimum. On-site presence during core hours."},
    {"site_name": "ARL Adelphi Laboratory Center (ALC)", "location": "Adelphi, MD", "proposed_fte_count": "10", "key_roles": "Co-located technicians, systems support, network support", "special_requirements": "Secret clearance. Coordinated with APG for afterhours support."},
    {"site_name": "Army Research Office (ARO)", "location": "Research Triangle Park, NC", "proposed_fte_count": "4", "key_roles": "On-site technicians with remote support from APG/ALC", "special_requirements": "Secret clearance."},
    {"site_name": "White Sands Missile Range (WSMR)", "location": "White Sands, NM", "proposed_fte_count": "2", "key_roles": "On-site technician with remote support from APG", "special_requirements": "Secret clearance."},
    {"site_name": "Extended Sites", "location": "Various CONUS", "proposed_fte_count": "2", "key_roles": "Roving technicians for smaller ARL facilities", "special_requirements": "Travel required. Secret clearance."},
    {"site_name": "PMO / Remote Operations", "location": "Tysons, VA / Remote", "proposed_fte_count": "5", "key_roles": "Thomas Brennan (Program Manager), Dr. Nina Vasquez (Lead Systems Engineer), Marcus Williams (Cybersecurity Lead), centralized support staff", "special_requirements": "VPN access. Monthly on-site visits."}
  ]'::jsonb
WHERE id = v_dcr_id;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 7: TECHNOLOGY SELECTIONS
-- ONLY tools from Tier 1 tools_technologies table
-- ═══════════════════════════════════════════════════════════════════
UPDATE data_call_responses SET
  technology_selections = '[
    {"technology_name": "ServiceNow", "company_experience": "8 years across 14 federal contracts", "proposed_usage": "ITSM, ITOM, ITAM — full platform for service delivery and asset management", "certifications_held": "Dedicated ServiceNow administrator"},
    {"technology_name": "VMware vSphere", "company_experience": "10 years enterprise virtualization for DoD", "proposed_usage": "Server virtualization, VM lifecycle management", "certifications_held": "Dr. Nina Vasquez (VMware VCP-DCV)"},
    {"technology_name": "Splunk Enterprise Security", "company_experience": "7 years SIEM operations for DoD/DHA", "proposed_usage": "Security log aggregation, correlation, incident detection, SOC monitoring", "certifications_held": "Rachel Foster (Splunk Certified Power User)"},
    {"technology_name": "SolarWinds Orion", "company_experience": "9 years network and infrastructure monitoring", "proposed_usage": "Network performance monitoring, alerting, capacity planning", "certifications_held": "Kevin Torres (SolarWinds trained)"},
    {"technology_name": "Cisco Networking", "company_experience": "12 years DoD network management", "proposed_usage": "Switch, router, and firewall administration", "certifications_held": "Dr. Nina Vasquez (CCNP Enterprise)"},
    {"technology_name": "Microsoft SCCM", "company_experience": "10 years endpoint management for DoD", "proposed_usage": "Windows endpoint imaging, patching, software distribution", "certifications_held": "Brian Pham, multiple technicians"},
    {"technology_name": "Microsoft Intune", "company_experience": "3 years mobile device management", "proposed_usage": "MDM for smartphones, tablets per DISA policy", "certifications_held": "Brian Pham (Microsoft Azure Administrator)"},
    {"technology_name": "Tanium", "company_experience": "5 years endpoint security for DoD", "proposed_usage": "Endpoint security and compliance monitoring", "certifications_held": "Marcus Williams, Rachel Foster"},
    {"technology_name": "Nessus / Tenable.sc", "company_experience": "6 years vulnerability management", "proposed_usage": "Vulnerability scanning and compliance reporting", "certifications_held": "Marcus Williams (CISSP), Rachel Foster"},
    {"technology_name": "ACAS", "company_experience": "5 years DoD compliance scanning", "proposed_usage": "DoD compliance scanning and reporting", "certifications_held": "Marcus Williams"},
    {"technology_name": "eMASS", "company_experience": "4 years RMF lifecycle management", "proposed_usage": "RMF artifact management and ATO tracking", "certifications_held": "Marcus Williams"},
    {"technology_name": "Active Directory / Azure AD", "company_experience": "12 years identity management", "proposed_usage": "User/group management, authentication, access control", "certifications_held": "Dr. Nina Vasquez (Microsoft Azure Administrator), Brian Pham"}
  ]'::jsonb
WHERE id = v_dcr_id;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 8: PAST PERFORMANCE REFERENCES
-- Map directly to Tier 1 past_performance table records
-- ═══════════════════════════════════════════════════════════════════
UPDATE data_call_responses SET
  past_performance = '[
    {
      "project_name": "DISA Enterprise IT Operations and Sustainment",
      "client_agency": "Defense Information Systems Agency",
      "contract_number": "HC1028-20-D-0034-TO-0018",
      "contract_value": "$38M (5 years)",
      "period_of_performance": "04/2020 – 09/2025",
      "relevance_summary": "Full-spectrum IT operations for 3,800 users across 7 sites including service desk (84% FCR), infrastructure management (99.97% uptime), cybersecurity, and cloud migration. Directly mirrors ARL SOO scope in service desk, infrastructure, and multi-site operations.",
      "contact_name": "Col. Patricia Hayes",
      "contact_email": "patricia.hayes@disa.mil",
      "contact_phone": "(301) 555-0301"
    },
    {
      "project_name": "Army CECOM Communications-Electronics IT Support",
      "client_agency": "U.S. Army / CECOM",
      "contract_number": "W15P7T-18-D-0055-TO-0003",
      "contract_value": "$22M (5 years)",
      "period_of_performance": "10/2018 – 03/2024",
      "relevance_summary": "IT modernization and sustainment for Army CECOM at Aberdeen Proving Ground — same agency type and similar infrastructure. Included Windows migration across 2,500 endpoints, server administration, help desk, and infrastructure monitoring. Demonstrates Army-specific IT operations experience.",
      "contact_name": "James Morton",
      "contact_email": "james.morton@army.mil",
      "contact_phone": "(410) 555-0402"
    },
    {
      "project_name": "Defense Health Agency Cybersecurity Operations Support",
      "client_agency": "Defense Health Agency",
      "contract_number": "HT0011-21-C-0089",
      "contract_value": "$18M (5 years)",
      "period_of_performance": "06/2021 – 05/2026",
      "relevance_summary": "Cybersecurity operations for 4,200 users and 12 information systems including SOC, RMF, vulnerability management, and DFARS compliance. SPRS score 104. Demonstrates deep cybersecurity depth matching ARL SOO Area 3.4 requirements.",
      "contact_name": "Dr. William Park",
      "contact_email": "william.park@health.mil",
      "contact_phone": "(703) 555-0503"
    },
    {
      "project_name": "Army NETCOM End-User Computing and Service Desk Support (Subcontractor)",
      "client_agency": "U.S. Army / NETCOM",
      "contract_number": "W52P1J-19-D-0028-TO-0006",
      "contract_value": "$8.5M (5 years, Meridian 20% workshare)",
      "period_of_performance": "09/2019 – 08/2024",
      "relevance_summary": "As subcontractor, provided Tier 1-2 help desk for 2,200 Army users at 2 installations. 87% FCR rate. Demonstrates multi-site Army service desk experience even in a subcontractor role.",
      "contact_name": "Lisa Trujillo",
      "contact_email": "lisa.trujillo@army.mil",
      "contact_phone": "(520) 555-0604"
    }
  ]'::jsonb
WHERE id = v_dcr_id;

-- Mark as completed
UPDATE data_call_responses SET status = 'completed', completed_at = NOW() WHERE id = v_dcr_id;

RAISE NOTICE 'Tier 2 data call populated for Meridian IT Solutions. DCR ID: %', v_dcr_id;

END $$;
