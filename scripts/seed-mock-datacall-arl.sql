-- UPDATE script for existing ARL IT Operations data call response
-- Links file IDs to key_personnel, fills all JSONB data call fields
--
-- IMPORTANT: This UPDATEs the existing row. Does NOT delete/recreate.
-- Data call response: 368fe62d-36fb-463d-a2ec-9a1287c578f2
-- Solicitation: 1ba2f94d-7b58-4bbc-8b78-296f3e4c1fa6
-- Company: 82545dfa-9a53-45da-8da9-134b2ea2ec37

DO $$
DECLARE
  v_dcr_id UUID := '368fe62d-36fb-463d-a2ec-9a1287c578f2';
BEGIN

-- ============================================================================
-- 1. Link file IDs to key_personnel entries
-- ============================================================================

UPDATE data_call_responses SET
  key_personnel = '[
    {
      "name": "Maria Gonzalez",
      "role": "Program Manager",
      "resume_file_id": "baa8ef22-df6d-41ef-9ac8-128f439aac46",
      "loc_file_id": "a3389d9f-dd28-42c2-8f11-8f9ec3ad95c3",
      "qualifications_summary": "PMP-certified with 15 years managing federal IT programs including IT service desk operations, infrastructure management, and enterprise ITSM. Former DOD program lead at Aberdeen Proving Ground managing 50+ FTE teams. Active TS/SCI clearance. Led 5 programs exceeding $10M each with 100% CPARS ratings of Exceptional. Experienced with ServiceNow, ITIL, and DoD IT operations.",
      "certifications_file_ids": ["aa82f66d-3c15-432d-8786-61c3b5ba7d7d"]
    },
    {
      "name": "David Park",
      "role": "Lead Systems Engineer",
      "resume_file_id": "2f8f7e4a-ecf5-441e-9d4f-efd5696f1386",
      "loc_file_id": "532ac258-d38e-4d53-adf7-5c3b277e2270",
      "qualifications_summary": "AWS Solutions Architect Professional, CISSP. 12 years designing enterprise IT infrastructure for federal agencies. Expert in Nutanix HCI, Windows/Linux server administration, and STIG compliance. FedRAMP assessment experience. Active Secret clearance. Managed infrastructure supporting 5,000+ users across DoD environments.",
      "certifications_file_ids": ["62271ee7-df5b-45a7-bb3c-f138812e204e"]
    },
    {
      "name": "Aisha Johnson",
      "role": "Cybersecurity Lead",
      "resume_file_id": "4cab28ee-ce58-4443-8490-d17d5466472d",
      "loc_file_id": "aba0753f-678a-4be7-9cc0-2a4b9eab15de",
      "qualifications_summary": "CISSP, CEH, CISM certified. 10 years in federal cybersecurity. NIST RMF assessor and NIST SP 800-171 specialist. Led ATO processes for 8 federal systems. Active TS clearance. Expert in HBSS deployment, STIG compliance, ARCYBER patch management, and classified spillage response procedures for DoD environments.",
      "certifications_file_ids": ["dc273885-69b7-44ca-a617-f5c9daf4e717"]
    }
  ]'::jsonb
WHERE id = v_dcr_id;

RAISE NOTICE 'Linked file IDs to key_personnel entries';

-- ============================================================================
-- 2. Fill technical_approach with complete staffing model and tools
-- ============================================================================

UPDATE data_call_responses SET
  technical_approach = '{
    "approach_summary": "TechVision will deliver comprehensive IT operations and service desk support for ARL across Aberdeen and Adelphi locations, supporting approximately 4,500 users across classified and unclassified networks. Our approach leverages ITIL v4 best practices, ServiceNow ITSM for workflow automation, and a tiered staffing model optimized for the 75:1 user-to-technician ratio. We emphasize Zero Trust architecture implementation, proactive infrastructure monitoring via Nagios and SolarWinds, and a knowledge-centric service desk driving first-call resolution above 80%.",
    "tools_and_platforms": "ServiceNow (ITSM, ITOM, ITAM, CSM, HAM, SAM, SPM), Nagios, SolarWinds, Microsoft SCCM, Nutanix HCI, Cisco ISE, JAMF, Microsoft Intune, HBSS/ESS (McAfee/Trellix), Wireshark, SolarWinds Network Performance Monitor, BigFix, Remedy (legacy transition), Active Directory, Microsoft 365, Microsoft Teams",
    "staffing_model": "Total 60 FTEs: 15 co-located Service Desk technicians at ARL sites (8 Aberdeen, 7 Adelphi), 35 centralized Service Desk/Tier 1 technicians, 10 Tier 2/3 specialists (3 network engineers, 2 systems administrators, 2 cybersecurity analysts, 1 ServiceNow developer, 1 AV/VTC specialist, 1 asset manager). Ratio: 75:1 user-to-technician for 4,500 users.",
    "assumptions": "4,500 total user population across Aberdeen and Adelphi sites. Existing ServiceNow instance available for configuration. 30-day transition period with incumbent knowledge transfer. Government-furnished equipment and facilities at both sites. Existing Nutanix HCI infrastructure operational. DREN network connectivity established.",
    "risks": "Transition risk from incumbent — mitigated by 30-day parallel operations and dedicated Transition Manager. Clearance processing delays for new hires — mitigated by pre-cleared pipeline of 45+ Secret-cleared staff. Technology refresh during performance period — mitigated by modular architecture and vendor-agnostic approach. Classified spillage incident surge — mitigated by documented response procedures and quarterly drills."
  }'::jsonb
WHERE id = v_dcr_id;

RAISE NOTICE 'Updated technical_approach';

-- ============================================================================
-- 3. Fill opportunity_details with teaming, set-aside, compliance data
-- ============================================================================

UPDATE data_call_responses SET
  opportunity_details = '{
    "contract_type": "Cost-Plus-Fixed-Fee (CPFF)",
    "prime_or_sub": "Prime",
    "set_aside": "Service-Disabled Veteran-Owned Small Business (SDVOSB)",
    "naics_code": "541519",
    "naics_size_standard": "$34M",
    "period_of_performance": "1 base year + 4 option years",
    "estimated_value": "$45M over 5 years",
    "cage_code": "8A9B7",
    "sprs_score": 95,
    "sprs_assessment_date": "2025-11-15",
    "facility_clearance": "Top Secret",
    "facility_clearance_sponsor": "US Army",
    "sdvosb_certified": true,
    "sdvosb_cert_number": "SDVOSB-2023-1234",
    "cio_sp3_holder": true,
    "teaming_partners": [
      {
        "name": "Acme Federal Solutions",
        "role": "Major Subcontractor — Network Engineering & Classified Support",
        "cage_code": "5C4D3",
        "facility_clearance": "Top Secret",
        "workshare_percentage": 20,
        "capabilities": "Network engineering (CCNP/CCIE certified staff), classified environment support, TS FCL holder, 10 years DoD network operations, Cisco ISE and Comply-to-Connect expertise",
        "prior_relationship": "Teaming partner on DHS Cyber Shield program since 2021. Joint team delivered 99.8% SOC uptime."
      },
      {
        "name": "Nova Tech Partners",
        "role": "Major Subcontractor — ServiceNow Platform Management",
        "cage_code": "7E8F9",
        "facility_clearance": "Secret",
        "workshare_percentage": 10,
        "capabilities": "ServiceNow Elite Partner with 50+ CSA/CAD certified developers. Platform upgrades, CMDB governance, custom application development, ServiceNow Security Operations module",
        "prior_relationship": "Subcontractor on EPA ITSM Pro since 2022. Joint team achieved 98% user adoption rate."
      }
    ]
  }'::jsonb
WHERE id = v_dcr_id;

RAISE NOTICE 'Updated opportunity_details with teaming partners';

-- ============================================================================
-- 4. Fill compliance_verification
-- ============================================================================

UPDATE data_call_responses SET
  compliance_verification = '{
    "sprs_score": 95,
    "sprs_assessment_date": "2025-11-15",
    "nist_800_171_compliant": true,
    "open_poam_items": 3,
    "facility_clearance_level": "Top Secret",
    "facility_clearance_cage": "8A9B7",
    "facility_clearance_sponsor": "US Army",
    "sdvosb_certified": true,
    "sdvosb_cert_number": "SDVOSB-2023-1234",
    "sdvosb_expiration": "2027-01-15",
    "cio_sp3_holder": true,
    "cio_sp3_contract": "47QTCK19D0001",
    "naics_541519_qualified": true,
    "annual_revenue": "$28.5M",
    "size_standard_met": true,
    "iso_9001_certified": true,
    "iso_27001_certified": true,
    "cmmi_level": 3
  }'::jsonb
WHERE id = v_dcr_id;

RAISE NOTICE 'Updated compliance_verification';

-- ============================================================================
-- 5. Fill service_area_approaches (all 18 PWS task areas)
-- ============================================================================

UPDATE data_call_responses SET
  service_area_approaches = '[
    {"area_code": "3.1", "area_name": "Planning Support", "approach_narrative": "Dedicated Planning Support team using ServiceNow SPM for project tracking, resource allocation, and reporting. Weekly status meetings with government leadership. Quarterly strategic planning sessions aligned with ARL technology roadmap.", "proposed_tools": "ServiceNow SPM, Microsoft Project, Power BI dashboards", "proposed_staffing": "1 Planning Lead, 1 Business Analyst", "key_differentiator": "Proactive planning approach with automated ServiceNow dashboards providing real-time visibility into all active projects and resource utilization."},
    {"area_code": "3.2.1", "area_name": "Service Desk Operations", "approach_narrative": "ITIL v4-aligned tiered service desk: Tier 0 self-service portal (ServiceNow), Tier 1 first-contact resolution (target 80%+), Tier 2 escalation specialists, Tier 3 engineering. 24/7 coverage for critical systems. Knowledge-centric service approach with continuously updated knowledge base.", "proposed_tools": "ServiceNow ITSM, ServiceNow Virtual Agent, Teams integration", "proposed_staffing": "15 co-located technicians, 35 centralized technicians, 10 Tier 2/3 specialists", "key_differentiator": "Knowledge-centric approach drives 80%+ first-call resolution. ServiceNow Virtual Agent handles 30% of routine requests autonomously."},
    {"area_code": "3.2.2", "area_name": "End-User Device Management", "approach_narrative": "Automated endpoint management using SCCM for Windows, JAMF for macOS, and Microsoft Intune for mobile. STIG-compliant imaging, automated patching within ARCYBER timelines, and AGM-based deployment workflows for new devices.", "proposed_tools": "SCCM, JAMF, Microsoft Intune, BigFix", "proposed_staffing": "2 endpoint specialists (from Tier 2/3 pool)", "key_differentiator": "Automated STIG compliance checking reduces manual configuration by 70%. Zero-touch deployment for standard device profiles."},
    {"area_code": "3.2.3", "area_name": "Unified Endpoint Management", "approach_narrative": "Centralized endpoint visibility through ServiceNow ITOM Discovery integrated with SCCM and Intune. Automated compliance scanning and remediation for all managed endpoints across Aberdeen and Adelphi.", "proposed_tools": "ServiceNow ITOM Discovery, SCCM, Intune, Tanium", "proposed_staffing": "Shared with End-User Device team", "key_differentiator": "Single-pane visibility across all endpoint types with automated non-compliance remediation."},
    {"area_code": "3.2.4", "area_name": "Mobile Device Management", "approach_narrative": "DISA-compliant MDM using Microsoft Intune for smartphone, tablet, and hotspot management. Policy enforcement for DoD mobile device security requirements. Integration with Active Directory for identity-based access control.", "proposed_tools": "Microsoft Intune, Azure AD Conditional Access", "proposed_staffing": "1 MDM specialist (shared with endpoint team)", "key_differentiator": "Automated compliance policy enforcement with self-remediation reduces help desk tickets for mobile devices by 40%."},
    {"area_code": "3.2.5", "area_name": "Printer/Copier Management", "approach_narrative": "Centralized print management with automated consumable monitoring and proactive vendor coordination. Footprint reduction strategy targeting 15% reduction in print devices through consolidated multifunction units.", "proposed_tools": "PrinterLogic, vendor management portals", "proposed_staffing": "1 dedicated technician (shared with end-user device)", "key_differentiator": "Proactive consumable monitoring eliminates reactive supply orders. Footprint reduction saves $50K+ annually in lease costs."},
    {"area_code": "3.2.6", "area_name": "Desktop Application Services", "approach_narrative": "Centralized application packaging and deployment through SCCM Application Catalog. Automated compatibility testing for OS updates. Self-service application installation for approved software.", "proposed_tools": "SCCM App Catalog, MSIX packaging, App-V", "proposed_staffing": "1 application packaging specialist", "key_differentiator": "Self-service catalog reduces application installation tickets by 60%. Automated compatibility testing prevents deployment failures."},
    {"area_code": "3.2.7", "area_name": "Platform Application Management", "approach_narrative": "Lifecycle management for enterprise platforms including SharePoint, Exchange, and custom LOB applications. Version control, patching, and performance monitoring.", "proposed_tools": "ServiceNow ITOM, SCCM, application monitoring tools", "proposed_staffing": "Shared with systems administration team", "key_differentiator": "Proactive platform health monitoring prevents 90% of unplanned outages through early warning detection."},
    {"area_code": "3.2.8", "area_name": "Network Engineering and Support", "approach_narrative": "Full-spectrum network management including switch/router/firewall administration, Zero Trust implementation via Cisco ISE, Comply-to-Connect enforcement, and VoIP support. Acme Federal Solutions provides CCNP/CCIE-certified engineers for complex network operations.", "proposed_tools": "Cisco ISE, SolarWinds NPM, Wireshark, Cisco DNA Center", "proposed_staffing": "3 network engineers (1 TechVision + 2 from Acme Federal Solutions)", "key_differentiator": "Zero Trust architecture expertise with Cisco ISE reduces network attack surface by 80%. Comply-to-Connect ensures only authorized devices access DREN."},
    {"area_code": "3.2.9", "area_name": "Cabling and Communications Hardware", "approach_narrative": "Structured cabling management for moves/adds/changes. VoIP endpoint management and conference room infrastructure support. Coordination with facility management for infrastructure projects.", "proposed_tools": "Cable management tracking (ServiceNow CMDB), VoIP management tools", "proposed_staffing": "1 cabling technician (from co-located pool)", "key_differentiator": "CMDB-tracked cabling inventory eliminates undocumented changes and reduces troubleshooting time by 50%."},
    {"area_code": "3.2.10", "area_name": "Server and Storage Administration", "approach_narrative": "Windows Server, Red Hat Linux, and macOS server administration across Nutanix HCI infrastructure. Backup/restore operations, SDDC management, and capacity planning. STIG compliance for all server configurations.", "proposed_tools": "Nutanix Prism, vCenter, Veeam, SCCM, Red Hat Satellite", "proposed_staffing": "2 systems administrators", "key_differentiator": "Nutanix NCP-certified engineers with 99.9% server uptime track record. Automated STIG compliance checking reduces audit preparation from weeks to hours."},
    {"area_code": "3.2.11", "area_name": "Infrastructure Monitoring", "approach_narrative": "24/7 infrastructure monitoring using Nagios for availability and SolarWinds for performance. Automated alerting with tiered escalation. Dashboard-driven operations center with real-time visibility into all critical systems.", "proposed_tools": "Nagios, SolarWinds NPM/SAM, ServiceNow Event Management", "proposed_staffing": "Shared with service desk (afterhours monitoring by centralized team)", "key_differentiator": "Automated event correlation reduces alert noise by 70%. Proactive monitoring identifies 85% of issues before user impact."},
    {"area_code": "3.2.12", "area_name": "Asset and Software Management", "approach_narrative": "Full lifecycle asset management compliant with AR 735-5. Primary Equipment Control Officer (PECO) responsibilities, ServiceNow HAM/SAM for hardware and software inventory tracking, and annual asset reconciliation.", "proposed_tools": "ServiceNow HAM, ServiceNow SAM, barcode scanning", "proposed_staffing": "1 asset management specialist", "key_differentiator": "ServiceNow-driven asset lifecycle tracking achieves 99.5% inventory accuracy. Automated software license compliance prevents audit findings."},
    {"area_code": "3.2.13", "area_name": "Audio Visual / VTC Systems", "approach_narrative": "DISA-compliant AV/VTC system design, installation, and support. Microsoft Teams integration for hybrid meetings. VTC session coordination and scheduling support.", "proposed_tools": "Microsoft Teams Rooms, Poly/Cisco VTC endpoints, Crestron", "proposed_staffing": "1 AV/VTC specialist", "key_differentiator": "Microsoft Teams Rooms standardization reduces VTC support complexity by 60%. Proactive monitoring prevents 95% of meeting disruptions."},
    {"area_code": "3.3", "area_name": "ServiceNow Platform Management", "approach_narrative": "Nova Tech Partners provides dedicated ServiceNow platform management including bi-annual upgrades, CMDB governance, security patching, and module administration (CSM, ITSM, HAM, SAM, ITOM, SPM). Custom application development for ARL-specific workflows.", "proposed_tools": "ServiceNow (all modules), ServiceNow Developer Instance", "proposed_staffing": "1 TechVision ServiceNow developer + Nova Tech Partners support team", "key_differentiator": "Nova Tech Partners is a ServiceNow Elite Partner with 50+ CSA/CAD-certified developers. Guaranteed 99.9% platform availability SLA."},
    {"area_code": "3.4", "area_name": "Cybersecurity and Compliance", "approach_narrative": "Comprehensive cybersecurity program covering HBSS/ESS deployment, ARCYBER patch timeline compliance, STIG enforcement, RMF artifact delivery, and NIST SP 800-171 compliance. Classified spillage response procedures with quarterly drills.", "proposed_tools": "HBSS/ESS (McAfee/Trellix), ACAS, SCAP, eMASS, Splunk", "proposed_staffing": "2 cybersecurity analysts + Aisha Johnson as Cybersecurity Lead", "key_differentiator": "100% ARCYBER patch compliance track record. James Rodriguez (CISSP, TS/SCI) leads cybersecurity operations with 18 years federal experience."},
    {"area_code": "3.2.16", "area_name": "Customer Training", "approach_narrative": "Bi-weekly training program covering new technology rollouts, security awareness, and productivity tools. Delivery methods include classroom instruction, over-the-shoulder coaching, just-in-time video tutorials, and ServiceNow knowledge base articles.", "proposed_tools": "Microsoft Teams (virtual training), ServiceNow Knowledge Base, SharePoint", "proposed_staffing": "Training coordinator (shared role with service desk lead)", "key_differentiator": "Knowledge-centric training approach with measurable outcomes. Training satisfaction scores consistently above 90%."},
    {"area_code": "3.2.17", "area_name": "Projects", "approach_narrative": "ServiceNow SPM for project intake, prioritization, resource allocation, and status tracking. Agile methodology for IT projects with 2-week sprints and monthly stakeholder reviews.", "proposed_tools": "ServiceNow SPM, Microsoft Project", "proposed_staffing": "1 project coordinator", "key_differentiator": "ServiceNow SPM provides end-to-end project visibility from intake to closure with automated resource conflict detection."},
    {"area_code": "3.2.18", "area_name": "Classified Support", "approach_narrative": "Dedicated classified environment support for TS/SCI and Secret networks. Spillage response procedures aligned with DoD policy with maximum 4-hour containment SLA. Equipment decommission following NSA/CSS procedures. Personnel clearance management and access control.", "proposed_tools": "Classified environment tools (SIPR, JWICS access), HBSS", "proposed_staffing": "Classified support from Acme Federal Solutions (TS FCL holder) + TechVision TS-cleared staff", "key_differentiator": "Acme Federal Solutions holds TS FCL and provides dedicated classified environment engineers. 100% spillage containment within 4-hour SLA across all prior contracts."}
  ]'::jsonb
WHERE id = v_dcr_id;

RAISE NOTICE 'Updated service_area_approaches (18 areas)';

-- ============================================================================
-- 6. Fill site_staffing
-- ============================================================================

UPDATE data_call_responses SET
  site_staffing = '[
    {
      "site_name": "ARL Aberdeen Proving Ground",
      "location": "Aberdeen, MD",
      "proposed_fte_count": 40,
      "key_roles": "Service Desk Manager, 8 co-located technicians, 2 network engineers, 2 systems admins, 1 cybersecurity analyst, 1 AV/VTC specialist, 1 asset manager, 1 cabling tech, project coordinator, classified support team",
      "special_requirements": "Secret and TS/SCI cleared personnel required. On-site presence during core hours (0700-1700). Afterhours on-call rotation for critical systems."
    },
    {
      "site_name": "ARL Adelphi Laboratory Center",
      "location": "Adelphi, MD",
      "proposed_fte_count": 15,
      "key_roles": "7 co-located technicians, 1 systems admin, 1 network engineer, training coordinator, ServiceNow developer, asset management support",
      "special_requirements": "Secret clearance minimum. Coordination with Aberdeen NOC for afterhours support."
    },
    {
      "site_name": "Remote/Centralized Operations",
      "location": "Arlington, VA (TechVision HQ) / Remote",
      "proposed_fte_count": 5,
      "key_roles": "Program Manager (Gonzalez), Cybersecurity Lead (Johnson), 3 centralized service desk overflow staff",
      "special_requirements": "VPN access to ARL networks. Periodic on-site visits for program reviews."
    }
  ]'::jsonb
WHERE id = v_dcr_id;

RAISE NOTICE 'Updated site_staffing';

-- ============================================================================
-- 7. Fill technology_selections
-- ============================================================================

UPDATE data_call_responses SET
  technology_selections = '[
    {"technology_name": "ServiceNow", "company_experience": "7 years, 12 certified practitioners, EPA ITSM Pro contract (15,000 users)", "proposed_usage": "ITSM, ITOM, ITAM, CSM, HAM, SAM, SPM — full platform for service delivery and asset management", "certifications_held": "4 CSA, 2 CAD certified (Robert Kim + Nova Tech Partners team)"},
    {"technology_name": "Nutanix HCI", "company_experience": "3 years managing Nutanix clusters for DoD research environments", "proposed_usage": "Hyperconverged infrastructure management, server provisioning, storage management", "certifications_held": "1 Nutanix NCP (Lisa Park)"},
    {"technology_name": "Nagios", "company_experience": "5 years enterprise monitoring for federal networks", "proposed_usage": "Infrastructure availability monitoring with automated alerting and escalation", "certifications_held": "Internal Nagios administration training completed"},
    {"technology_name": "SolarWinds NPM/SAM", "company_experience": "6 years network and application performance monitoring", "proposed_usage": "Network performance monitoring, application dependency mapping, capacity planning", "certifications_held": "SolarWinds Certified Professional (2 engineers)"},
    {"technology_name": "Cisco ISE", "company_experience": "4 years DoD Zero Trust implementations", "proposed_usage": "Network access control, Comply-to-Connect enforcement, 802.1X authentication", "certifications_held": "Cisco ISE Administrator (David Thompson), CCNP Enterprise (David Thompson + Acme Federal team)"},
    {"technology_name": "Microsoft SCCM", "company_experience": "8 years enterprise endpoint management for federal agencies", "proposed_usage": "Windows endpoint imaging, patching, software distribution, compliance reporting", "certifications_held": "MCSE (Lisa Park), multiple SCCM-trained technicians"},
    {"technology_name": "JAMF", "company_experience": "3 years macOS device management for mixed DoD environments", "proposed_usage": "macOS endpoint management, policy enforcement, software deployment", "certifications_held": "JAMF Certified Associate (1 technician)"},
    {"technology_name": "Microsoft Intune", "company_experience": "4 years mobile device management for federal agencies", "proposed_usage": "MDM for smartphones, tablets, and hotspots per DISA mobile policy", "certifications_held": "Microsoft 365 Certified (3 technicians)"},
    {"technology_name": "HBSS/ESS", "company_experience": "8 years DoD Host-Based Security System management", "proposed_usage": "Endpoint security, ARCYBER compliance, threat detection and response", "certifications_held": "CISSP (James Rodriguez, Aisha Johnson), CEH (Aisha Johnson)"},
    {"technology_name": "Splunk", "company_experience": "6 years SIEM operations for DHS SOC", "proposed_usage": "Security log aggregation, correlation, and incident detection", "certifications_held": "Splunk Certified Power User (James Rodriguez)"}
  ]'::jsonb
WHERE id = v_dcr_id;

RAISE NOTICE 'Updated technology_selections';

-- ============================================================================
-- SUMMARY
-- ============================================================================

RAISE NOTICE '=== All data call fields updated for % ===', v_dcr_id;

END $$;
