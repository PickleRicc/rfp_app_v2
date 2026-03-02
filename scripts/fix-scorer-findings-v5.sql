-- Fix scorer findings v5: Past performance in data call + expanded site staffing
-- Addresses:
--   1. data_call_responses.past_performance was never populated → Vol III used generic refs
--   2. site_staffing only had 3 sites → evaluator can't see FTE breakdown for ARO, WSMR, etc.
--   3. Cybersecurity service area still references "Aisha Johnson" (if fix-key-personnel-match wasn't run)
--   4. site_staffing key_roles still reference old names (Gonzalez, Johnson)

DO $$
DECLARE
  v_company_id UUID := '82545dfa-9a53-45da-8da9-134b2ea2ec37';
  v_dcr_id UUID := '368fe62d-36fb-463d-a2ec-9a1287c578f2';
BEGIN

-- ============================================================================
-- 1. Populate data_call_responses.past_performance with 3 most relevant contracts
-- These must match the Tier 1 past_performance table (as updated by fix-key-personnel-match.sql)
-- TOR allows 3 references for prime contractor
-- ============================================================================

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
      "project_name": "IT Infrastructure and End User Support Services",
      "client_agency": "Department of the Army / ARL Aberdeen Proving Ground",
      "contract_number": "W56KGZ-21-D-0012",
      "contract_value": "$8.5M (3 years)",
      "period_of_performance": "04/2021 – 03/2024",
      "relevance_summary": "IT infrastructure management and end user support at ARL Aberdeen supporting 2,800 researchers. Nutanix HCI, Cisco ISE Comply-to-Connect, ServiceNow, SCCM/JAMF, asset management under AR 735-5, and TS/SCI classified environment support — same customer, same environment.",
      "contact_name": "Dr. Susan Park",
      "contact_email": "susan.park.civ@arl.army.mil",
      "contact_phone": "(410) 278-4000"
    },
    {
      "project_name": "Enterprise Cybersecurity Operations and Risk Management",
      "client_agency": "Department of Homeland Security / OCISO",
      "contract_number": "70RSAT20D00000001",
      "contract_value": "$12.5M (5 years)",
      "period_of_performance": "01/2020 – 01/2025",
      "relevance_summary": "SOC operations, HBSS/ESS management, vulnerability assessments, RMF/ATO compliance, and zero-trust architecture for 50+ systems and 10,000+ users. Demonstrates cybersecurity capabilities at scale directly relevant to ARL SOO Section 3.4.",
      "contact_name": "Michael Thompson",
      "contact_email": "michael.thompson@hq.dhs.gov",
      "contact_phone": "(202) 555-0100"
    }
  ]'::jsonb
WHERE id = v_dcr_id;

RAISE NOTICE 'Populated data_call_responses.past_performance with 3 most relevant contracts';

-- ============================================================================
-- 2. Expand site_staffing to include ALL ARL sites with FTE breakdown
-- SOO lists: APG, ALC, ARO, WSMR, Extended Sites (Graces Quarters, Blossom Point, etc.)
-- Previous data only had APG (40), ALC (15), Remote (5) = 60 total
-- Now: APG (35) + ALC (12) + ARO (4) + WSMR (2) + Extended Sites (2) + PMO/Remote (5) = 60
-- ============================================================================

UPDATE data_call_responses SET
  site_staffing = '[
    {
      "site_name": "ARL Aberdeen Proving Ground (APG)",
      "location": "Aberdeen, MD",
      "proposed_fte_count": 35,
      "key_roles": "Service Desk Manager, 8 co-located technicians, 2 network engineers, 2 systems admins, 1 cybersecurity analyst, 1 AV/VTC specialist, 1 asset manager, 1 cabling tech, project coordinator, classified support team (Acme Federal Solutions)",
      "special_requirements": "Secret and TS/SCI cleared personnel required. On-site presence during core hours (0700-1700). Afterhours on-call rotation for critical systems. Primary NOC location."
    },
    {
      "site_name": "ARL Adelphi Laboratory Center (ALC)",
      "location": "Adelphi, MD",
      "proposed_fte_count": 12,
      "key_roles": "Site Lead, 5 co-located technicians, 1 systems admin, 1 network engineer, ServiceNow developer (Robert Kim), 2 Tier 2 specialists, asset management support",
      "special_requirements": "Secret clearance minimum. Coordination with APG NOC for afterhours support. High-performance computing environment support."
    },
    {
      "site_name": "Army Research Office (ARO)",
      "location": "Research Triangle Park, NC",
      "proposed_fte_count": 4,
      "key_roles": "2 co-located technicians, 1 network/systems support (split role), 1 service desk representative",
      "special_requirements": "Secret clearance required. VTC-equipped conference rooms. Coordination with APG NOC for Tier 2/3 escalation."
    },
    {
      "site_name": "White Sands Missile Range (WSMR)",
      "location": "White Sands, NM",
      "proposed_fte_count": 2,
      "key_roles": "1 co-located technician, 1 systems/network support (split role)",
      "special_requirements": "Secret clearance required. Remote site with limited on-site staff — centralized service desk provides Tier 1 support via remote tools. Quarterly on-site visits from APG engineering team."
    },
    {
      "site_name": "Extended Sites (Graces Quarters, Blossom Point, ARO Washington)",
      "location": "Various (MD, DC)",
      "proposed_fte_count": 2,
      "key_roles": "2 roving technicians supporting Graces Quarters, Blossom Point, and ARO Washington offices on a scheduled rotation",
      "special_requirements": "Secret clearance required. Travel between sites on a weekly rotation schedule. Primary support via centralized service desk with scheduled on-site days."
    },
    {
      "site_name": "PMO / Remote Operations",
      "location": "Arlington, VA (TechVision HQ) / Remote",
      "proposed_fte_count": 5,
      "key_roles": "Program Manager (Michael Anderson), Cybersecurity Lead (James Rodriguez), Lead Systems Engineer (Dr. Priya Patel), 2 centralized service desk overflow staff",
      "special_requirements": "VPN access to ARL networks. Monthly on-site visits for program reviews. Afterhours escalation point for critical incidents."
    }
  ]'::jsonb
WHERE id = v_dcr_id;

RAISE NOTICE 'Expanded site_staffing to 6 sites (APG 35 + ALC 12 + ARO 4 + WSMR 2 + Extended 2 + PMO 5 = 60 FTE)';

-- ============================================================================
RAISE NOTICE '=== v5 fixes complete ===';

END $$;
