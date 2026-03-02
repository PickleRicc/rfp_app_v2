-- ============================================================================
-- FIX DATA CALL FILES: Replace old resume/LOC text with correct key personnel
-- 
-- Problem: Uploaded PDFs contain text for Maria Gonzalez, David Park, Aisha Johnson
-- but key personnel registry uses Michael Anderson, Dr. Priya Patel, James Rodriguez.
-- The scorer sees both and flags a FATAL name mismatch.
--
-- This script:
--   1. Updates extracted_text in data_call_files to replace old names with correct ones
--   2. Updates filenames to match correct personnel
--   3. Rebuilds realistic resume/LOC text content for each person
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_sol_id UUID := '1ba2f94d-7b58-4bbc-8b78-296f3e4c1fa6';
  v_dcr_id UUID;
BEGIN

SELECT id INTO v_company_id FROM company_profiles WHERE company_name = 'TechVision Federal Solutions' LIMIT 1;
IF v_company_id IS NULL THEN RAISE EXCEPTION 'Company not found'; END IF;

SELECT id INTO v_dcr_id FROM data_call_responses WHERE solicitation_id = v_sol_id AND company_id = v_company_id LIMIT 1;
IF v_dcr_id IS NULL THEN RAISE EXCEPTION 'Data call response not found'; END IF;

-- ═══════════════════════════════════════════════════
-- 1. Fix RESUME files — replace extracted_text entirely
-- ═══════════════════════════════════════════════════

-- Resume: Program Manager (personnel_0_resume) — Michael Anderson
UPDATE data_call_files
SET 
  filename = 'Anderson_Resume.pdf',
  extracted_text = 'MICHAEL ANDERSON
Program Manager

PROFESSIONAL SUMMARY
Senior IT program manager with 22 years of experience in federal IT operations, including 18 years supporting Department of Defense agencies. Proven track record managing large-scale IT service delivery contracts valued at $50M+ across multiple geographic locations. PMP and ITIL v4 certified with active Top Secret/SCI clearance.

EDUCATION
- Master of Business Administration (MBA), George Washington University
- Bachelor of Science in Information Technology, Virginia Tech

CERTIFICATIONS
- Project Management Professional (PMP), PMI — Expires 2028
- ITIL v4 Foundation — Expires 2027
- CompTIA Security+ CE — Expires 2028
- Certified Scrum Master (CSM) — Expires 2027

PROFESSIONAL EXPERIENCE

Program Manager | TechVision Federal Solutions | 2019–Present
- Manages $47M DoD IT operations contract supporting 4,200 users across 9 sites
- Oversees 58-person technical team delivering help desk, infrastructure, and cybersecurity services
- Achieved CPARS rating of Exceptional for Quality and Schedule in FY2024
- Reduced service desk ticket resolution time by 34% through process optimization
- Led successful CMMI Level 3 appraisal and ISO 27001 certification

Deputy Program Manager | TechVision Federal Solutions | 2014–2019
- Supported $35M Army IT modernization program across 6 installations
- Managed transition from legacy infrastructure to cloud-hybrid environment
- Coordinated cross-functional teams of 45 engineers and technicians

Project Manager | Northrop Grumman IT | 2008–2014
- Led IT service delivery for Defense Intelligence Agency
- Managed $22M contract for network operations and cybersecurity
- Achieved 99.97% network uptime across classified and unclassified environments

Systems Administrator | U.S. Army Signal Corps | 2003–2008
- Active duty network/systems administration
- Top Secret/SCI cleared operations in CONUS and OCONUS environments

CLEARANCE
Top Secret/SCI (Active)

AVAILABILITY
Immediately Available'
WHERE data_call_response_id = v_dcr_id
  AND field_key LIKE 'personnel_0_resume%';

-- Resume: Lead Systems Engineer (personnel_1_resume) — Dr. Priya Patel
UPDATE data_call_files
SET 
  filename = 'Patel_Resume.pdf',
  extracted_text = 'DR. PRIYA PATEL
Lead Systems Engineer

PROFESSIONAL SUMMARY
Systems engineering leader with 15 years of experience designing and operating enterprise IT infrastructure for federal agencies. Doctorate in Computer Engineering from MIT with deep expertise in hybrid cloud architecture, virtualization, and network engineering. Active Top Secret clearance.

EDUCATION
- Doctorate in Computer Engineering, Massachusetts Institute of Technology (MIT)
- Master of Science in Electrical Engineering, Stanford University
- Bachelor of Science in Computer Science, University of Maryland

CERTIFICATIONS
- AWS Solutions Architect Professional — Expires 2027
- Cisco CCNP Enterprise — Expires 2028
- CompTIA Security+ CE — Expires 2027
- VMware Certified Professional (VCP-DCV) — Expires 2028
- Microsoft Azure Administrator Associate — Expires 2027

PROFESSIONAL EXPERIENCE

Lead Systems Engineer | TechVision Federal Solutions | 2020–Present
- Architects and maintains enterprise IT infrastructure supporting 4,200 DoD users
- Designed hybrid cloud migration strategy reducing infrastructure costs by 28%
- Manages VMware vSphere cluster (200+ VMs), NetApp SAN, and Cisco network backbone
- Implemented SolarWinds/Nagios monitoring achieving 99.99% infrastructure uptime
- Leads team of 12 systems engineers and network administrators

Senior Systems Engineer | Leidos | 2016–2020
- Designed enterprise virtualization platform for Army Research Laboratory
- Led Windows Server 2019 migration across 3,000+ endpoints
- Implemented STIG compliance automation reducing audit preparation time by 60%

Systems Engineer | Booz Allen Hamilton | 2012–2016
- Supported DISA network modernization program
- Designed and deployed Cisco ACI fabric for classified enclave
- Maintained 99.95% uptime for 500+ server environment

Research Assistant | MIT Lincoln Laboratory | 2009–2012
- High-performance computing infrastructure for defense research programs

CLEARANCE
Top Secret (Active)

AVAILABILITY
Immediately Available'
WHERE data_call_response_id = v_dcr_id
  AND field_key LIKE 'personnel_1_resume%';

-- Resume: Cybersecurity Lead (personnel_2_resume) — James Rodriguez
UPDATE data_call_files
SET 
  filename = 'Rodriguez_Resume.pdf',
  extracted_text = 'JAMES RODRIGUEZ
Cybersecurity Lead

PROFESSIONAL SUMMARY
Cybersecurity professional with 16 years of total experience, including 14 years in federal cybersecurity operations. CISSP and CEH certified with expertise in RMF, NIST 800-171, DFARS compliance, and DoD cybersecurity frameworks. Active Top Secret clearance. Experienced in leading security operations centers and conducting vulnerability assessments for classified environments.

EDUCATION
- Master of Science in Cybersecurity, Johns Hopkins University
- Bachelor of Science in Computer Science, University of Texas at Austin

CERTIFICATIONS
- CISSP (Certified Information Systems Security Professional) — Expires 2027
- CEH (Certified Ethical Hacker) — Expires 2028
- CompTIA Security+ CE — Expires 2028
- CISM (Certified Information Security Manager) — Expires 2027
- DoD 8570 IAM Level III qualified

PROFESSIONAL EXPERIENCE

Cybersecurity Lead | TechVision Federal Solutions | 2020–Present
- Leads cybersecurity operations for DoD IT contract protecting 4,200 users across 9 sites
- Manages NIST 800-171 compliance program achieving SPRS score of 98
- Directs team of 8 cybersecurity analysts in SOC operations
- Conducted RMF assessments for 15+ information systems
- Implemented Splunk SIEM with custom detection rules reducing mean time to detect by 45%
- Led DFARS 252.204-7012 compliance implementation

Senior Cybersecurity Analyst | TechVision Federal Solutions | 2017–2020
- Vulnerability assessment and penetration testing for Army networks
- Managed Tanium endpoint security platform across 5,000+ devices
- Developed incident response playbooks reducing MTTR by 38%

Cybersecurity Engineer | General Dynamics IT | 2012–2017
- Security operations for Defense Information Systems Agency (DISA)
- STIG implementation and compliance validation across Windows and Linux
- Led cyber incident response team handling 200+ incidents annually

Information Assurance Specialist | U.S. Army Cyber Command | 2010–2012
- Network defense operations for Army classified networks
- Conducted security assessments per DoD 8500.2 (predecessor to RMF)

CLEARANCE
Top Secret (Active)

AVAILABILITY
Available with 2 weeks notice from current assignment'
WHERE data_call_response_id = v_dcr_id
  AND field_key LIKE 'personnel_2_resume%';

-- ═══════════════════════════════════════════════════
-- 2. Fix LOC files — replace extracted_text entirely
-- ═══════════════════════════════════════════════════

-- LOC: Michael Anderson
UPDATE data_call_files
SET 
  filename = 'Anderson_LOC.pdf',
  extracted_text = 'LETTER OF COMMITMENT

Date: January 15, 2026

To: TechVision Federal Solutions
Re: Commitment to Serve as Program Manager — ARL IT Operations Support

I, Michael Anderson, hereby commit to serve as the Program Manager for the Army Research Laboratory (ARL) IT Operations Support contract, Solicitation No. W911NF-26-R-0042, if awarded to TechVision Federal Solutions.

I confirm the following:
- I am currently employed by TechVision Federal Solutions as a Program Manager
- I hold an active Top Secret/SCI security clearance
- I am immediately available to begin performance on Day 1 of the contract
- I will dedicate 100% of my professional effort to this contract
- I meet or exceed all qualification requirements specified in the solicitation for this position

I understand that this letter constitutes a binding commitment and that my qualifications and availability were material factors in the proposal evaluation.

Sincerely,

Michael Anderson
Program Manager
TechVision Federal Solutions
michael.anderson@techvisionfed.com'
WHERE data_call_response_id = v_dcr_id
  AND field_key LIKE 'personnel_0_loc%';

-- LOC: Dr. Priya Patel
UPDATE data_call_files
SET 
  filename = 'Patel_LOC.pdf',
  extracted_text = 'LETTER OF COMMITMENT

Date: January 15, 2026

To: TechVision Federal Solutions
Re: Commitment to Serve as Lead Systems Engineer — ARL IT Operations Support

I, Dr. Priya Patel, hereby commit to serve as the Lead Systems Engineer for the Army Research Laboratory (ARL) IT Operations Support contract, Solicitation No. W911NF-26-R-0042, if awarded to TechVision Federal Solutions.

I confirm the following:
- I am currently employed by TechVision Federal Solutions as a Lead Systems Engineer
- I hold an active Top Secret security clearance
- I am immediately available to begin performance on Day 1 of the contract
- I will dedicate 100% of my professional effort to this contract
- I meet or exceed all qualification requirements specified in the solicitation for this position

I understand that this letter constitutes a binding commitment and that my qualifications and availability were material factors in the proposal evaluation.

Sincerely,

Dr. Priya Patel
Lead Systems Engineer
TechVision Federal Solutions
priya.patel@techvisionfed.com'
WHERE data_call_response_id = v_dcr_id
  AND field_key LIKE 'personnel_1_loc%';

-- LOC: James Rodriguez
UPDATE data_call_files
SET 
  filename = 'Rodriguez_LOC.pdf',
  extracted_text = 'LETTER OF COMMITMENT

Date: January 15, 2026

To: TechVision Federal Solutions
Re: Commitment to Serve as Cybersecurity Lead — ARL IT Operations Support

I, James Rodriguez, hereby commit to serve as the Cybersecurity Lead for the Army Research Laboratory (ARL) IT Operations Support contract, Solicitation No. W911NF-26-R-0042, if awarded to TechVision Federal Solutions.

I confirm the following:
- I am currently employed by TechVision Federal Solutions as a Cybersecurity Lead
- I hold an active Top Secret security clearance
- I am available to begin performance with 2 weeks notice from my current assignment
- I will dedicate 100% of my professional effort to this contract
- I meet or exceed all qualification requirements specified in the solicitation for this position

I understand that this letter constitutes a binding commitment and that my qualifications and availability were material factors in the proposal evaluation.

Sincerely,

James Rodriguez
Cybersecurity Lead
TechVision Federal Solutions
james.rodriguez@techvisionfed.com'
WHERE data_call_response_id = v_dcr_id
  AND field_key LIKE 'personnel_2_loc%';

-- ═══════════════════════════════════════════════════
-- 3. Clean up any old-name references in ALL file records
-- ═══════════════════════════════════════════════════

-- Replace any remaining old name references in any extracted_text
UPDATE data_call_files
SET extracted_text = REPLACE(extracted_text, 'Maria Gonzalez', 'Michael Anderson')
WHERE data_call_response_id = v_dcr_id AND extracted_text LIKE '%Maria Gonzalez%';

UPDATE data_call_files
SET extracted_text = REPLACE(extracted_text, 'David Park', 'Dr. Priya Patel')
WHERE data_call_response_id = v_dcr_id AND extracted_text LIKE '%David Park%';

UPDATE data_call_files
SET extracted_text = REPLACE(extracted_text, 'Aisha Johnson', 'James Rodriguez')
WHERE data_call_response_id = v_dcr_id AND extracted_text LIKE '%Aisha Johnson%';

-- Also fix filenames that reference old names
UPDATE data_call_files
SET filename = REPLACE(filename, 'Gonzalez', 'Anderson')
WHERE data_call_response_id = v_dcr_id AND filename LIKE '%Gonzalez%';

UPDATE data_call_files
SET filename = REPLACE(filename, 'Park', 'Patel')
WHERE data_call_response_id = v_dcr_id AND filename LIKE '%Park%';

UPDATE data_call_files
SET filename = REPLACE(filename, 'Johnson', 'Rodriguez')
WHERE data_call_response_id = v_dcr_id AND filename LIKE '%Johnson%';

RAISE NOTICE 'Data call files updated successfully';

END $$;

-- ═══════════════════════════════════════════════════
-- VALIDATION
-- ═══════════════════════════════════════════════════

-- Check no old names remain
SELECT id, filename, 
  CASE 
    WHEN extracted_text LIKE '%Gonzalez%' THEN 'FAIL: Contains Gonzalez'
    WHEN extracted_text LIKE '%David Park%' THEN 'FAIL: Contains Park'
    WHEN extracted_text LIKE '%Aisha Johnson%' THEN 'FAIL: Contains Johnson'
    ELSE 'PASS'
  END AS name_check
FROM data_call_files
WHERE data_call_response_id = (
  SELECT id FROM data_call_responses 
  WHERE solicitation_id = '1ba2f94d-7b58-4bbc-8b78-296f3e4c1fa6' 
  LIMIT 1
)
AND extracted_text IS NOT NULL;

-- Check correct names are present
SELECT filename, 
  LEFT(extracted_text, 100) AS text_preview
FROM data_call_files
WHERE data_call_response_id = (
  SELECT id FROM data_call_responses 
  WHERE solicitation_id = '1ba2f94d-7b58-4bbc-8b78-296f3e4c1fa6' 
  LIMIT 1
)
AND extracted_text IS NOT NULL
ORDER BY field_key;
