-- Mock Company Data Seed Script
-- This creates "TechVision Federal Solutions" - a realistic gov contracting company
-- Run this directly in Supabase SQL Editor - no UI setup needed!

DO $$
DECLARE
    v_company_id UUID;
BEGIN

-- ============================================================================
-- PART 1: COMPANY PROFILE
-- ============================================================================

-- Create the company profile first and capture the generated ID
INSERT INTO company_profiles (
    company_name,
    legal_name,
    dba_names,
    cage_code,
    uei_number,
    sam_status,
    sam_expiration,
    year_founded,
    headquarters_address,
    additional_offices,
    website,
    employee_count,
    annual_revenue,
    fiscal_year_end,
    proposal_poc,
    contracts_poc,
    authorized_signer,
    elevator_pitch,
    full_description,
    mission_statement,
    vision_statement,
    core_values
) VALUES (
    'TechVision Federal Solutions',
    'TechVision Federal Solutions, LLC',
    ARRAY['TechVision', 'TVFS'],
    '8A9B7',
    'ZXCV123456UV',
    'Active',
    '2027-03-15',
    2015,
    '{"street": "1776 Innovation Way", "suite": "Suite 500", "city": "Arlington", "state": "VA", "zip": "22201", "country": "USA"}'::jsonb,
    '[{"street": "100 M Street SE", "suite": "Suite 200", "city": "Washington", "state": "DC", "zip": "20003", "country": "USA"}]'::jsonb,
    'https://www.techvisionfed.com',
    145,
    28500000.00,
    'December 31',
    '{"name": "Sarah Mitchell", "title": "VP of Business Development", "email": "sarah.mitchell@techvisionfed.com", "phone": "(703) 555-0123"}'::jsonb,
    '{"name": "David Chen", "title": "Contracts Manager", "email": "david.chen@techvisionfed.com", "phone": "(703) 555-0124"}'::jsonb,
    '{"name": "Jennifer Reynolds", "title": "President & CEO", "email": "jennifer.reynolds@techvisionfed.com"}'::jsonb,
    'TechVision Federal Solutions is a Service-Disabled Veteran-Owned Small Business (SDVOSB) delivering innovative IT modernization, cybersecurity, and enterprise program management services to federal civilian agencies. With over 50 successful federal contracts, we combine technical excellence with mission understanding.',
    'Founded in 2015, TechVision Federal Solutions has grown from a 5-person startup to a 145-employee leader in federal IT services. We specialize in agile transformation, cloud migration, DevSecOps, and digital modernization for mission-critical systems. Our team has supported 15+ federal agencies including DHS, VA, HHS, and DOD. We hold an active GSA MAS contract, CIO-SP3 GWAC spot, and maintain CMMI Level 3 certification. Our client retention rate exceeds 95%, and we have consistently achieved CPARS ratings of "Exceptional" or "Very Good." We pride ourselves on our veteran leadership (60% veteran workforce), strong cybersecurity credentials, and proven ability to deliver complex programs on time and under budget.',
    'To empower federal agencies with innovative technology solutions that enhance mission effectiveness and improve citizen services.',
    'To be the trusted partner of choice for federal agencies seeking to modernize their technology infrastructure and transform their operations.',
    ARRAY['Integrity First', 'Mission Focus', 'Innovation', 'Excellence', 'Collaboration', 'Veteran Values']
)
RETURNING id INTO v_company_id;

RAISE NOTICE 'Created company profile with ID: %', v_company_id;

-- ============================================================================
-- PART 2: CERTIFICATIONS
-- ============================================================================

INSERT INTO certifications (company_id, certification_type, certifying_agency, certification_number, effective_date, expiration_date) VALUES
(v_company_id, 'Service-Disabled Veteran-Owned Small Business (SDVOSB)', 'VA CVE', 'SDVOSB-2023-1234', '2023-01-15', '2026-01-15'),
(v_company_id, 'Small Disadvantaged Business (SDB)', 'SBA', 'SDB-2022-5678', '2022-06-01', NULL),
(v_company_id, '8(a) Business Development Program', 'SBA', '8A-2021-9012', '2021-03-01', '2030-03-01');

-- ============================================================================
-- PART 3: NAICS CODES
-- ============================================================================

INSERT INTO naics_codes (company_id, code, title, size_standard, is_primary) VALUES
(v_company_id, '541512', 'Computer Systems Design Services', '$30M', true),
(v_company_id, '541519', 'Other Computer Related Services', '$30M', false),
(v_company_id, '541690', 'Other Scientific and Technical Consulting Services', '$18.5M', false),
(v_company_id, '541611', 'Administrative Management and General Management Consulting Services', '$25.5M', false),
(v_company_id, '541330', 'Engineering Services', '$25.5M', false);

-- ============================================================================
-- PART 4: CONTRACT VEHICLES
-- ============================================================================

INSERT INTO contract_vehicles (company_id, vehicle_name, contract_number, vehicle_type, ordering_period_end, ceiling_value, remaining_ceiling, labor_categories) VALUES
(v_company_id, 'GSA MAS (Multiple Award Schedule)', 'GS-35F-0123R', 'GSA Schedule', '2028-06-30', 100000000.00, 85000000.00, ARRAY['Program Manager', 'Senior Systems Engineer', 'Cybersecurity Analyst', 'Software Developer', 'Business Analyst']),
(v_company_id, 'CIO-SP3', '47QTCK19D0001', 'GWAC', '2027-12-31', 20000000000.00, 18500000000.00, ARRAY['Project Manager', 'Cloud Architect', 'DevOps Engineer', 'Data Scientist']),
(v_company_id, 'DHS EAGLE II', 'HSHQDC-15-D-0001', 'IDIQ', '2026-09-30', 22000000000.00, 19000000000.00, ARRAY['Program Manager', 'Security Engineer', 'Systems Administrator']);

-- ============================================================================
-- PART 5: FACILITY CLEARANCE
-- ============================================================================

INSERT INTO facility_clearances (company_id, has_facility_clearance, clearance_level, sponsoring_agency, cage_code_cleared, safeguarding_capability) VALUES
(v_company_id, true, 'Secret', 'Department of Homeland Security', '8A9B7', 'Secret');

-- ============================================================================
-- PART 6: SERVICE AREAS (CAPABILITIES)
-- ============================================================================

INSERT INTO service_areas (company_id, service_name, description, experience_years, key_clients, relevant_naics) VALUES
(v_company_id, 'Enterprise IT Modernization', 'Full-stack application modernization including legacy system migration, cloud adoption, and microservices architecture implementation.', 8, ARRAY['DHS', 'VA', 'HHS', 'GSA'], ARRAY['541512', '541519']),
(v_company_id, 'Cybersecurity & Risk Management', 'Comprehensive security services including vulnerability assessments, penetration testing, security operations center (SOC) support, and compliance management (FedRAMP, FISMA, NIST).', 8, ARRAY['DHS', 'DOD', 'DOJ'], ARRAY['541512', '541690']),
(v_company_id, 'Agile Program Management', 'End-to-end program management using SAFe, Scrum, and hybrid methodologies for complex federal IT initiatives.', 8, ARRAY['VA', 'EPA', 'HHS'], ARRAY['541611', '541690']),
(v_company_id, 'DevSecOps & CI/CD', 'Secure software development pipelines, automated testing, continuous integration/deployment, and infrastructure as code.', 6, ARRAY['DHS', 'USDA', 'DOT'], ARRAY['541512', '541519']),
(v_company_id, 'Cloud Services & Migration', 'AWS, Azure, and hybrid cloud architecture, migration planning and execution, and cloud-native application development.', 7, ARRAY['GSA', 'VA', 'DOC'], ARRAY['541512', '541519']);

-- ============================================================================
-- PART 7: TOOLS & TECHNOLOGIES
-- ============================================================================

INSERT INTO tools_technologies (company_id, name, category, proficiency, years_experience, certified_practitioners, description) VALUES
(v_company_id, 'ServiceNow', 'IT Service Management', 'Expert', 7, 12, 'ITSM implementation and administration for federal agencies'),
(v_company_id, 'AWS (Amazon Web Services)', 'Cloud Platform', 'Certified Partner', 8, 25, '15 AWS Certified Solutions Architects on staff'),
(v_company_id, 'Microsoft Azure', 'Cloud Platform', 'Expert', 6, 18, 'Azure migration and management'),
(v_company_id, 'Jira & Confluence', 'Project Management', 'Expert', 8, 35, 'Agile project management and documentation'),
(v_company_id, 'GitLab', 'DevOps/CI-CD', 'Expert', 5, 20, 'CI/CD pipeline implementation'),
(v_company_id, 'Kubernetes', 'DevOps/CI-CD', 'Proficient', 4, 15, 'Container orchestration'),
(v_company_id, 'Splunk', 'Security', 'Proficient', 6, 8, 'Security information and event management'),
(v_company_id, 'Tableau', 'Analytics/BI', 'Proficient', 5, 10, 'Data visualization and business intelligence'),
(v_company_id, 'Python', 'Development', 'Expert', 8, 30, 'Backend development and automation'),
(v_company_id, 'React', 'Development', 'Expert', 6, 22, 'Modern frontend development');

-- ============================================================================
-- PART 8: METHODOLOGIES
-- ============================================================================

INSERT INTO methodologies (company_id, name, category, implementation_experience, certified_practitioners) VALUES
(v_company_id, 'SAFe (Scaled Agile Framework)', 'Agile', 'Implemented SAFe across 8 federal programs with teams ranging from 30-150 people. Achieved 40% faster delivery times and 25% reduction in defects.', 15),
(v_company_id, 'Scrum', 'Agile', 'Core methodology for all development teams. Over 200 successful sprints delivered across 20+ projects.', 35),
(v_company_id, 'ITIL v4', 'IT Service Management', 'Implemented ITIL processes for 5 federal agencies, improving incident response times by 60%.', 20),
(v_company_id, 'CMMI Level 3', 'Quality', 'Organizational CMMI Level 3 certification. Embedded process improvement across all projects.', 45),
(v_company_id, 'NIST Cybersecurity Framework', 'Security', 'Applied NIST CSF to assess and improve security posture for 10+ agency systems.', 18),
(v_company_id, 'TOGAF', 'Architecture', 'Enterprise architecture planning and implementation using TOGAF 9.2 framework.', 8);

-- ============================================================================
-- PART 9: PAST PERFORMANCE
-- ============================================================================

INSERT INTO past_performance (
    company_id,
    contract_nickname,
    contract_name,
    contract_number,
    task_order_number,
    client_agency,
    client_office,
    contract_type,
    contract_value,
    annual_value,
    start_date,
    end_date,
    base_period,
    option_periods,
    role,
    percentage_of_work,
    prime_contractor,
    team_size,
    place_of_performance,
    client_poc,
    overview,
    description_of_effort,
    task_areas,
    tools_used,
    achievements,
    relevance_tags
) VALUES
-- Contract 1: DHS Cybersecurity
(v_company_id, 'DHS Cyber Shield', 'Enterprise Cybersecurity Operations and Risk Management', '70RSAT20D00000001', 'TO-001', 'Department of Homeland Security', 'Office of the Chief Information Security Officer', 'T&M', 12500000.00, 2500000.00, '2020-01-15', '2025-01-14', '1 year', 4, 'Prime', 100, NULL, 18, 'Washington, DC (Remote/Hybrid)', 
'{"name": "Michael Thompson", "title": "CISO", "phone": "(202) 555-0100", "email": "michael.thompson@hq.dhs.gov", "note": "Excellent working relationship"}'::jsonb,
'TechVision serves as Prime contractor providing comprehensive cybersecurity operations, risk assessments, and compliance management for DHS enterprise systems protecting critical infrastructure.',
'Comprehensive cybersecurity program supporting 50+ DHS systems and 10,000+ users. Responsibilities include: 24/7 Security Operations Center (SOC) monitoring and incident response, quarterly vulnerability assessments and penetration testing, continuous compliance monitoring (FedRAMP, FISMA, NIST 800-53), security tool implementation and management (Splunk, CrowdStrike, Tenable), security awareness training for 2,000+ personnel, and technical support for Authority to Operate (ATO) packages. Implemented zero-trust architecture principles and automated 70% of security monitoring processes.',
ARRAY['Security Operations Center (SOC)', 'Vulnerability Management', 'Penetration Testing', 'Compliance Management (FedRAMP, FISMA)', 'Incident Response', 'Security Tool Implementation', 'Zero Trust Architecture'],
ARRAY['Splunk', 'CrowdStrike', 'Tenable Nessus', 'AWS Security Hub', 'ServiceNow Security Operations'],
'[
  {"statement": "Achieved 99.8% uptime for SOC operations over 4 years", "metric_value": "99.8%", "metric_type": "Quality Improvement"},
  {"statement": "Reduced mean time to detect (MTTD) security incidents from 48 hours to 2 hours", "metric_value": "96% reduction", "metric_type": "Time Savings"},
  {"statement": "Successfully completed 20+ ATO packages with zero findings", "metric_value": "20+ ATOs", "metric_type": "Compliance"},
  {"statement": "Received CPARS rating of Exceptional for 3 consecutive years", "metric_value": "3 years", "metric_type": "Customer Satisfaction"},
  {"statement": "Identified and remediated 500+ critical vulnerabilities before exploitation", "metric_value": "500+", "metric_type": "Quality Improvement"},
  {"statement": "Saved DHS $2M annually through security automation", "metric_value": "$2M/year", "metric_type": "Cost Savings"}
]'::jsonb,
ARRAY['Cybersecurity', 'Federal Civilian', 'SOC', 'FedRAMP', 'Zero Trust', 'Incident Response']
),

-- Contract 2: VA Agile Transformation
(v_company_id, 'VA Agile Transform', 'Veterans Affairs Digital Modernization Program', 'VA-255-19-C-0001', NULL, 'Department of Veterans Affairs', 'Office of Information Technology', 'FFP', 8750000.00, 1750000.00, '2019-06-01', '2024-05-31', '1 year', 4, 'Prime', 100, NULL, 25, 'Washington, DC', 
'{"name": "Dr. Linda Rodriguez", "title": "Deputy CTO", "phone": "(202) 555-0200", "email": "linda.rodriguez@va.gov", "note": "Very satisfied with agile coaching"}'::jsonb,
'Prime contractor leading agile transformation for VA''s flagship healthcare portal serving 9 million veterans. Modernized development practices, implemented SAFe framework, and accelerated delivery by 50%.',
'Led comprehensive agile transformation for VA''s Veterans Health Information System (VistA) modernization. Established 8 agile release trains (ARTs) with 120 team members across development, testing, and operations. Implemented SAFe 5.0 framework with quarterly Program Increment (PI) planning sessions. Provided agile coaching for 15 Scrum teams and trained 200+ VA staff in agile practices. Migrated legacy waterfall development to 2-week sprints, improving delivery velocity from 2 releases/year to bi-weekly releases. Stood up DevSecOps pipeline with automated testing achieving 85% code coverage. Integrated with VA''s enterprise cloud platform on AWS.',
ARRAY['Agile Transformation', 'SAFe Implementation', 'Agile Coaching & Training', 'Scrum Team Facilitation', 'DevSecOps Pipeline', 'Cloud Migration (AWS)', 'Legacy Modernization'],
ARRAY['Jira', 'Confluence', 'GitLab', 'Jenkins', 'AWS', 'Kubernetes', 'Selenium'],
'[
  {"statement": "Increased deployment frequency from 2/year to 26/year", "metric_value": "1,200%", "metric_type": "Efficiency Gain"},
  {"statement": "Reduced lead time for changes from 6 months to 2 weeks", "metric_value": "93% reduction", "metric_type": "Time Savings"},
  {"statement": "Trained 200+ VA staff in agile methodologies", "metric_value": "200+", "metric_type": "Other"},
  {"statement": "Achieved 95% on-time delivery rate for sprints", "metric_value": "95%", "metric_type": "Quality Improvement"},
  {"statement": "Reduced production defects by 40% through automated testing", "metric_value": "40%", "metric_type": "Quality Improvement"},
  {"statement": "Received Outstanding CPARS rating for all performance periods", "metric_value": "Outstanding", "metric_type": "Customer Satisfaction"}
]'::jsonb,
ARRAY['Agile', 'SAFe', 'Federal Civilian', 'Healthcare', 'DevSecOps', 'Cloud', 'Training']
),

-- Contract 3: HHS Cloud Migration
(v_company_id, 'HHS Cloud Leap', 'Enterprise Cloud Migration and Modernization Services', 'HHSP233201800001A', '75P00122F37001', 'Department of Health and Human Services', 'Office of the Chief Technology Officer', 'Cost-Plus', 15000000.00, 5000000.00, '2021-09-01', '2024-08-31', '1 year', 2, 'Prime', 100, NULL, 32, 'Rockville, MD (Remote)', 
'{"name": "Karen Williams", "title": "Chief Technology Officer", "phone": "(301) 555-0300", "email": "karen.williams@hhs.gov", "note": "Exceeded expectations"}'::jsonb,
'Prime contractor for HHS enterprise cloud migration initiative, successfully migrating 85+ applications and 500TB of data to AWS GovCloud while achieving FedRAMP authorization.',
'Led large-scale cloud migration for HHS, moving 85 applications from on-premise data centers to AWS GovCloud. Conducted comprehensive application portfolio analysis and developed cloud migration roadmap. Established cloud center of excellence (CCoE) with governance framework and best practices. Migrated diverse workloads including .NET, Java, and legacy mainframe applications using 6R strategy (rehost, replatform, refactor, repurchase, retire, retain). Implemented infrastructure as code using Terraform and CloudFormation. Established landing zone with multi-account structure, identity management (AWS SSO), and network connectivity (Transit Gateway). Achieved FedRAMP Moderate authorization for cloud environment. Provided cloud operations support and cost optimization, reducing compute costs by 35%.',
ARRAY['Cloud Migration', 'AWS Architecture', 'FedRAMP Authorization', 'Infrastructure as Code', 'Cloud Center of Excellence', 'Application Modernization', 'Cost Optimization'],
ARRAY['AWS', 'Terraform', 'CloudFormation', 'Docker', 'Kubernetes', 'CloudWatch', 'AWS Config'],
'[
  {"statement": "Migrated 85 applications with 99.5% success rate and zero data loss", "metric_value": "99.5%", "metric_type": "Quality Improvement"},
  {"statement": "Achieved FedRAMP Moderate ATO in 8 months (vs. 12-18 month average)", "metric_value": "33% faster", "metric_type": "Time Savings"},
  {"statement": "Reduced infrastructure costs by $1.8M annually", "metric_value": "$1.8M/year", "metric_type": "Cost Savings"},
  {"statement": "Improved application performance by 60% average", "metric_value": "60%", "metric_type": "Quality Improvement"},
  {"statement": "Completed migration 2 months ahead of schedule", "metric_value": "2 months", "metric_type": "Time Savings"},
  {"statement": "Zero security incidents during migration", "metric_value": "0 incidents", "metric_type": "Quality Improvement"},
  {"statement": "Received CPARS rating of Exceptional", "metric_value": "Exceptional", "metric_type": "Customer Satisfaction"}
]'::jsonb,
ARRAY['Cloud Migration', 'AWS', 'FedRAMP', 'Federal Civilian', 'Healthcare', 'Infrastructure as Code']
),

-- Contract 4: EPA IT Service Management
(v_company_id, 'EPA ITSM Pro', 'ServiceNow Implementation and ITSM Support', '68HE0220D0009', 'TO-002', 'Environmental Protection Agency', 'Office of Environmental Information', 'T&M', 6500000.00, 1300000.00, '2022-03-01', '2027-02-28', '1 year', 4, 'Prime', 100, NULL, 15, 'Research Triangle Park, NC (Hybrid)', 
'{"name": "Robert Johnson", "title": "IT Operations Director", "phone": "(919) 555-0400", "email": "robert.johnson@epa.gov", "note": "Strong technical expertise"}'::jsonb,
'Prime contractor implementing ServiceNow ITSM platform for EPA, improving IT service delivery for 15,000+ users across 10 regions and 50+ facilities.',
'Full lifecycle ServiceNow implementation serving 15,000 EPA employees. Implemented IT Service Management (ITSM), IT Operations Management (ITOM), and IT Asset Management (ITAM) modules. Configured incident, problem, change, and knowledge management workflows aligned with ITIL best practices. Integrated ServiceNow with 25+ enterprise systems including Active Directory, Salesforce, and AWS. Built custom applications for EPA-specific processes. Provide Tier 3 technical support, platform administration, and continuous enhancement. Reduced average incident resolution time by 55% through automation and improved workflows.',
ARRAY['ServiceNow Implementation', 'ITIL Process Design', 'IT Service Management', 'Workflow Automation', 'System Integration', 'Platform Administration', 'User Training'],
ARRAY['ServiceNow', 'JavaScript', 'REST APIs', 'LDAP', 'Active Directory', 'Jira'],
'[
  {"statement": "Reduced average incident resolution time from 72 hours to 32 hours", "metric_value": "55%", "metric_type": "Time Savings"},
  {"statement": "Automated 40% of routine service requests", "metric_value": "40%", "metric_type": "Efficiency Gain"},
  {"statement": "Improved user satisfaction score from 72% to 91%", "metric_value": "19 points", "metric_type": "Customer Satisfaction"},
  {"statement": "Successfully onboarded 15,000 users with 98% adoption rate", "metric_value": "98%", "metric_type": "Quality Improvement"},
  {"statement": "Created 500+ knowledge base articles reducing support tickets by 25%", "metric_value": "25%", "metric_type": "Efficiency Gain"},
  {"statement": "Received CPARS rating of Very Good", "metric_value": "Very Good", "metric_type": "Customer Satisfaction"}
]'::jsonb,
ARRAY['ServiceNow', 'ITIL', 'Federal Civilian', 'ITSM', 'Workflow Automation']
),

-- Contract 5: GSA Digital Services
(v_company_id, 'GSA Digital Hub', 'Agile Software Development for GSA Digital Services', 'GS00Q17GWD2097', '47QRAD20F0001', 'General Services Administration', 'Technology Transformation Services', 'FFP', 4200000.00, 2100000.00, '2023-01-10', '2025-01-09', '1 year', 1, 'Prime', 100, NULL, 12, 'Washington, DC (Fully Remote)', 
'{"name": "Alex Martinez", "title": "Product Owner", "phone": "(202) 555-0500", "email": "alex.martinez@gsa.gov", "note": "Excellent agile partnership"}'::jsonb,
'Prime contractor providing agile software development for GSA''s citizen-facing digital services platform, delivering modern web applications serving 500,000+ users monthly.',
'Agile software development for GSA''s public-facing digital services. Built and enhanced 5 React-based web applications with Node.js backends. Implemented user-centered design with continuous user research and usability testing. Maintained 2-week sprint cadence with continuous deployment. Achieved 508 compliance and WCAG 2.1 AA accessibility standards. Implemented comprehensive testing strategy with 90% code coverage. Provided DevOps support with automated CI/CD pipelines on cloud.gov. Collaborative team structure embedded with GSA product owners and designers.',
ARRAY['Agile Software Development', 'Full-Stack Development', 'User-Centered Design', 'Accessibility (508 Compliance)', 'DevOps', 'Continuous Deployment', 'User Research'],
ARRAY['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'cloud.gov', 'CircleCI', 'GitHub'],
'[
  {"statement": "Delivered 120+ features across 5 applications over 2 years", "metric_value": "120+", "metric_type": "Other"},
  {"statement": "Maintained 99.9% application uptime", "metric_value": "99.9%", "metric_type": "Quality Improvement"},
  {"statement": "Achieved 100% 508 compliance for all deliverables", "metric_value": "100%", "metric_type": "Compliance"},
  {"statement": "Completed 50+ user research sessions influencing product direction", "metric_value": "50+", "metric_type": "Other"},
  {"statement": "Reduced page load times by 70% through performance optimization", "metric_value": "70%", "metric_type": "Efficiency Gain"},
  {"statement": "Received CPARS rating of Exceptional for Year 1", "metric_value": "Exceptional", "metric_type": "Customer Satisfaction"}
]'::jsonb,
ARRAY['Agile Development', 'Federal Civilian', 'Full-Stack', 'User-Centered Design', '508 Compliance', 'DevOps']
);

-- ============================================================================
-- PART 10: PERSONNEL (Sample Key Personnel)
-- ============================================================================

INSERT INTO personnel (
    company_id, status, full_name, email, phone, employment_type,
    availability, geographic_location, relocation_willing, remote_capable,
    clearance_level, clearance_status,
    education, certifications,
    total_experience_years, federal_experience_years, relevant_experience_years,
    work_history, proposed_roles
) VALUES
-- Person 1: Program Manager
(v_company_id, 'Active', 'Michael Anderson', 'michael.anderson@techvisionfed.com', '(703) 555-1001', 'W2 Employee',
'Immediately Available', 'Washington, DC Metro', false, true,
'Secret', 'Active',
'[{"degree_level": "Master", "field_of_study": "Information Technology Management", "institution": "Johns Hopkins University", "graduation_year": 2008},
{"degree_level": "Bachelor", "field_of_study": "Computer Science", "institution": "Virginia Tech", "graduation_year": 2002}]'::jsonb,
'[{"name": "PMP (Project Management Professional)", "issuing_body": "PMI", "date_obtained": "2009-06-15", "expiration_date": "2027-06-15", "certification_number": "PMP-123456"},
{"name": "SAFe Program Consultant (SPC)", "issuing_body": "Scaled Agile", "date_obtained": "2018-03-20", "expiration_date": "2025-03-20", "certification_number": "SPC-789012"}]'::jsonb,
22, 15, 20,
'[{"job_title": "Senior Program Manager", "employer": "TechVision Federal Solutions", "start_date": "01/2018", "end_date": "Present", "description": "Leading multiple federal programs with budgets up to $15M annually. Manage cross-functional teams of 30-50 people. Oversee program planning, execution, and delivery using SAFe methodology.", "client_agency": "DHS, VA, HHS", "contract_reference": "", "relevant_skills": ["SAFe", "Agile", "Budget Management"]},
{"job_title": "IT Project Manager", "employer": "Federal Solutions Inc", "start_date": "06/2012", "end_date": "12/2017", "description": "Managed IT modernization projects for DOD and DHS. Led teams of 15-25 people. Delivered projects on time and within budget.", "client_agency": "DOD, DHS", "contract_reference": "", "relevant_skills": ["Project Management", "Agile", "Waterfall"]}]'::jsonb,
'[{"role_title": "Program Manager", "is_key_personnel": true, "labor_category": "Program Manager IV", "bill_rate": 185.00, "cost_rate": 125.00, "summary_for_role": "22 years of IT program management experience with 15 years supporting federal agencies. Expert in SAFe, PMP certified, proven track record managing $50M+ in federal contracts."}]'::jsonb
),

-- Person 2: Solutions Architect
(v_company_id, 'Available', 'Dr. Priya Patel', 'priya.patel@techvisionfed.com', '(703) 555-1002', 'W2 Employee',
'2 Weeks Notice', 'Arlington, VA', true, true,
'Top Secret', 'Active',
'[{"degree_level": "Doctorate", "field_of_study": "Computer Engineering", "institution": "MIT", "graduation_year": 2010},
{"degree_level": "Master", "field_of_study": "Computer Science", "institution": "Stanford University", "graduation_year": 2005}]'::jsonb,
'[{"name": "AWS Certified Solutions Architect - Professional", "issuing_body": "Amazon Web Services", "date_obtained": "2019-08-10", "expiration_date": "2025-08-10", "certification_number": "AWS-SAP-123"},
{"name": "TOGAF 9 Certified", "issuing_body": "The Open Group", "date_obtained": "2017-05-15", "expiration_date": "", "certification_number": "TOGAF9-456"}]'::jsonb,
19, 12, 18,
'[{"job_title": "Chief Solutions Architect", "employer": "TechVision Federal Solutions", "start_date": "03/2016", "end_date": "Present", "description": "Lead architect for federal cloud migrations and enterprise modernization. Designed cloud solutions for 50+ applications. Expert in AWS, Azure, and hybrid architectures.", "client_agency": "HHS, GSA, VA", "contract_reference": "", "relevant_skills": ["AWS", "Azure", "Enterprise Architecture"]}]'::jsonb,
'[{"role_title": "Solutions Architect", "is_key_personnel": true, "labor_category": "Solutions Architect IV", "bill_rate": 195.00, "cost_rate": 135.00, "summary_for_role": "19 years of enterprise architecture experience with deep expertise in cloud technologies. AWS and Azure certified. Led 30+ successful cloud migrations for federal agencies."}]'::jsonb
),

-- Person 3: Cybersecurity Lead
(v_company_id, 'Active', 'James Rodriguez', 'james.rodriguez@techvisionfed.com', '(703) 555-1003', 'W2 Employee',
'Immediately Available', 'Remote (MD)', false, true,
'TS/SCI', 'Active',
'[{"degree_level": "Master", "field_of_study": "Cybersecurity", "institution": "SANS Technology Institute", "graduation_year": 2012},
{"degree_level": "Bachelor", "field_of_study": "Information Systems", "institution": "University of Maryland", "graduation_year": 2006}]'::jsonb,
'[{"name": "CISSP (Certified Information Systems Security Professional)", "issuing_body": "ISC2", "date_obtained": "2010-09-20", "expiration_date": "2026-09-20", "certification_number": "CISSP-789"},
{"name": "CEH (Certified Ethical Hacker)", "issuing_body": "EC-Council", "date_obtained": "2014-03-15", "expiration_date": "", "certification_number": "CEH-012"}]'::jsonb,
18, 14, 16,
'[{"job_title": "Cybersecurity Director", "employer": "TechVision Federal Solutions", "start_date": "01/2015", "end_date": "Present", "description": "Lead cybersecurity operations for federal contracts. Manage SOC operations, vulnerability management, and compliance programs. Expert in FedRAMP, FISMA, and NIST frameworks.", "client_agency": "DHS, DOJ, DOD", "contract_reference": "", "relevant_skills": ["Cybersecurity", "FedRAMP", "SOC Operations"]}]'::jsonb,
'[{"role_title": "Cybersecurity Lead", "is_key_personnel": true, "labor_category": "Cybersecurity Engineer IV", "bill_rate": 175.00, "cost_rate": 120.00, "summary_for_role": "18 years of cybersecurity experience with 14 years in federal space. CISSP certified. Extensive FedRAMP and NIST 800-53 experience across 20+ ATOs."}]'::jsonb
);

-- ============================================================================
-- PART 11: VALUE PROPOSITIONS (DIFFERENTIATORS)
-- ============================================================================

INSERT INTO value_propositions (company_id, theme, statement, proof_points, applicable_to) VALUES
(v_company_id, 'Proven Federal IT Excellence', 
'TechVision delivers consistently exceptional results on complex federal IT programs, with 95%+ client retention and top CPARS ratings.',
ARRAY['50+ successful federal contracts with zero terminations', 'Average CPARS rating of 4.8/5.0 (Exceptional/Very Good)', '95% client retention rate over 9 years', 'Zero security incidents across all contracts', 'On-time delivery rate of 98%'],
ARRAY['All Federal Civilian', 'IT Modernization', 'Program Management']),

(v_company_id, 'Veteran-Led Mission Focus',
'As a Service-Disabled Veteran-Owned company with 60% veteran workforce, we bring military discipline, integrity, and mission commitment to every engagement.',
ARRAY['SDVOSB certified with 60% veteran employees', 'Veteran leadership team with 100+ combined years of federal service', 'Deep understanding of federal mission requirements', 'Proven ability to work in high-security environments', 'Strong relationships across DOD and federal agencies'],
ARRAY['All Federal', 'DOD', 'DHS', 'VA']),

(v_company_id, 'Rapid Agile Transformation Expertise',
'TechVision accelerates agile adoption and modernization, typically achieving 50%+ faster delivery within 6 months.',
ARRAY['SAFe-certified coaches with 15+ SPCs on staff', 'Transformed 10+ federal programs to agile methodologies', 'Average 50% improvement in delivery velocity', 'Trained 500+ federal employees in agile practices', '15 certified Scrum Masters and 20 Product Owners'],
ARRAY['Agile Transformation', 'Digital Modernization', 'Federal Civilian']),

(v_company_id, 'Cloud Migration Speed & Security',
'We migrate federal systems to secure cloud environments 30% faster than industry average while maintaining 100% FedRAMP compliance.',
ARRAY['85+ applications migrated to secure cloud', 'FedRAMP authorizations achieved in 8 months vs 12-18 month average', 'Zero data loss or security incidents during migrations', '25 AWS-certified architects', 'Average 35% cost reduction post-migration'],
ARRAY['Cloud Migration', 'FedRAMP', 'AWS', 'Azure']),

(v_company_id, 'Small Business Agility, Enterprise Capability',
'As a small business, we provide partner-level attention and rapid decision-making, backed by enterprise-scale technical capabilities.',
ARRAY['145 employees including 60+ senior technical staff', 'C-suite directly involved in all major programs', 'Decision-making in hours, not weeks', 'Flexible and responsive to changing requirements', 'Lower overhead than large contractors (15-20% vs 30-40%)'],
ARRAY['Small Business Set-Asides', 'SDVOSB', '8(a)']);

-- ============================================================================
-- PART 12: INNOVATIONS
-- ============================================================================

INSERT INTO innovations (company_id, name, description, evidence, proprietary) VALUES
(v_company_id, 'FedMigrate Automation Platform',
'Proprietary cloud migration automation platform that reduces migration time by 40% and eliminates manual errors. Automates discovery, dependency mapping, migration planning, and cutover orchestration.',
'Successfully used on 85+ federal application migrations. Reduced average migration time from 10 weeks to 6 weeks per application. Eliminated 95% of manual migration tasks.',
true),

(v_company_id, 'SecureOps AI Assistant',
'AI-powered security operations assistant that analyzes security logs, identifies threats, and recommends remediation actions. Reduces MTTD by 70%.',
'Deployed in DHS SOC, processing 10M+ security events daily. Reduced mean time to detect from 48 hours to 2 hours. Identified 30+ zero-day threats before exploitation.',
true),

(v_company_id, 'Agile Maturity Accelerator',
'Structured 90-day agile transformation program combining training, coaching, and hands-on implementation support that achieves measurable results.',
'Applied to 10 federal programs. Average velocity improvement of 50% within 90 days. 95% of teams achieve "Performing" stage by day 90.',
false);

-- ============================================================================
-- PART 13: COMPETITIVE ADVANTAGES
-- ============================================================================

INSERT INTO competitive_advantages (company_id, area, our_strength, competitor_weakness) VALUES
(v_company_id, 'Transition Speed',
'Average 15-day transition period vs industry standard 45 days. Proven 30-day maximum across 20+ federal transitions.',
'Most large contractors require 60-90 day transitions with significant ramp-up costs. Smaller firms often lack transition methodology.'),

(v_company_id, 'Technical Depth & Certifications',
'60+ certified professionals (AWS, Azure, PMP, SAFe, CISSP). 25 AWS-certified architects, 15 SAFe-certified coaches.',
'Many competitors rely on 1-2 key technical staff or lack current certifications. Large firms often staff junior resources.'),

(v_company_id, 'Federal Security Expertise',
'Completed 25+ FedRAMP ATOs in average 8 months. Zero security incidents across all contracts. Facility Secret clearance.',
'Industry average FedRAMP ATO timeline is 12-18 months. Many contractors lack facility clearance requiring individual sponsorship.'),

(v_company_id, 'Veteran Workforce & Mission Understanding',
'60% veteran workforce including senior leaders with federal service backgrounds. Deep understanding of federal operations.',
'Large commercial contractors often lack federal mission understanding. Many small businesses lack experienced federal workforce.'),

(v_company_id, 'Agile Coaching Capability',
'15 SAFe-certified coaches (SPCs) providing embedded coaching. Not just consultants - we build capability.',
'Most competitors provide training-only or rely on external consultants. Large firms often use junior coaches.');

-- ============================================================================
-- PART 14: COMPETITIVE ADVANTAGES (for Ghosting)
-- ============================================================================

INSERT INTO competitive_advantages (company_id, area, our_strength, competitor_weakness, ghosting_phrase) VALUES
(v_company_id, 
'Incumbent Experience', 
'Current contractor on similar contracts with deep institutional knowledge', 
'New contractors face steep learning curve and transition risks',
'Our existing presence and proven track record eliminate transition risks and ensure day-one productivity without the learning curve that new contractors typically face.'),

(v_company_id,
'Facility Clearances',
'Already hold facility Secret clearance with cleared personnel',
'Contractors without facility clearance require 6-12 months for individual sponsorships',
'Unlike contractors requiring new clearances, our team is already cleared and badged, avoiding the 6-12 month delays that often impact project timelines.'),

(v_company_id,
'Local Presence',
'Office within 10 miles of client sites with local workforce',
'Remote-only contractors or distant firms lack face-to-face availability',
'Our local presence enables rapid on-site response and face-to-face collaboration without the travel delays and coordination challenges that remote-only contractors encounter.'),

(v_company_id,
'SDVOSB Status',
'Service-Disabled Veteran-Owned Small Business with veteran leadership',
'Large commercial firms lack small business status and federal mission understanding',
'As a certified SDVOSB with 60% veteran workforce, we bring mission understanding and responsiveness that larger commercial firms often lack, while maintaining enterprise-grade capabilities.'),

(v_company_id,
'Agile Maturity',
'15 SAFe Program Consultants on staff with embedded coaching model',
'Many competitors provide training-only or rely on external consultants',
'Unlike training-only approaches, our embedded agile coaches work alongside your teams daily, building lasting capability rather than creating consulting dependencies.'),

(v_company_id,
'FedRAMP Expertise',
'Completed 25+ FedRAMP ATOs averaging 8 months',
'Industry average ATO timeline is 12-18 months with frequent delays',
'Our streamlined FedRAMP approach achieves authorization in 8 months on average, avoiding the delays and cost overruns that many contractors experience with their first FedRAMP engagement.');

-- ============================================================================
-- PART 15: BOILERPLATE LIBRARY
-- ============================================================================

INSERT INTO boilerplate_library (company_id, type, variant, content) VALUES
(v_company_id, 'company_intro', 'short',
'TechVision Federal Solutions is a Service-Disabled Veteran-Owned Small Business (SDVOSB) delivering innovative IT modernization, cybersecurity, and agile transformation services to federal civilian agencies. Since 2015, we have successfully supported 50+ federal contracts across 15 agencies with a 95% client retention rate and consistent "Exceptional" CPARS ratings.'),

(v_company_id, 'company_intro', 'medium',
'TechVision Federal Solutions is a Service-Disabled Veteran-Owned Small Business (SDVOSB) specializing in IT modernization, cybersecurity, cloud services, and agile program management for federal civilian agencies. Founded in 2015, we have grown to 145 employees including 60+ senior technical professionals. Our team includes 25 AWS-certified architects, 15 SAFe-certified coaches, and 20 CISSP-certified cybersecurity professionals.

We maintain an active GSA MAS contract, CIO-SP3 GWAC position, and facility Secret clearance. Our 60% veteran workforce brings mission understanding and proven discipline to every engagement. With 50+ successful federal contracts, 95% client retention, and average CPARS ratings of "Exceptional" or "Very Good," TechVision consistently delivers measurable results for federal missions.'),

(v_company_id, 'small_business_statement', NULL,
'TechVision Federal Solutions is a Service-Disabled Veteran-Owned Small Business (SDVOSB) certified by the VA Center for Veterans Enterprise. We are also SBA-certified as a Small Disadvantaged Business (SDB) and participate in the SBA 8(a) Business Development Program. Our CAGE code is 8A9B7 and UEI is ZXCV123456UV. We maintain active SAM registration with expiration date of March 15, 2027. As a small business, we provide responsive, partner-level service with C-suite engagement on all major programs, while maintaining the technical capabilities and past performance of much larger firms.'),

(v_company_id, 'quality_approach', NULL,
'TechVision''s quality management system is CMMI Level 3 certified and integrates quality throughout the project lifecycle. We employ a "shift-left" approach, incorporating quality checks at every phase from requirements through deployment. Our quality practices include: peer code reviews with 100% coverage; automated testing achieving 85%+ code coverage; continuous integration with quality gates; regular customer feedback loops and sprint reviews; defect tracking and root cause analysis; and compliance with federal standards (508, FedRAMP, NIST). Our quality metrics are transparent and reported weekly, with trend analysis to drive continuous improvement. This disciplined approach has resulted in 40% fewer production defects and 98% on-time delivery across our federal portfolio.'),

(v_company_id, 'risk_management_approach', NULL,
'TechVision employs a proactive, data-driven risk management approach aligned with PMI and SAFe frameworks. We maintain an active risk register reviewed weekly by the Program Manager and monthly with stakeholders. Risks are identified through multiple channels: sprint retrospectives, technical reviews, stakeholder feedback, and automated monitoring. Each risk is assessed for probability, impact, and velocity, with clear ownership and mitigation plans. High-priority risks escalate to senior leadership within 24 hours. We emphasize early risk identification and continuous mitigation rather than reactive crisis management. Our risk approach has prevented major issues on 95% of our federal contracts, with average risk velocity trending downward over project lifecycles.'),

(v_company_id, 'transition_approach', NULL,
'TechVision''s proven transition methodology achieves operational readiness in 15-30 days, significantly faster than the industry standard. Our approach includes: pre-transition knowledge transfer sessions with incumbent; detailed transition plan with daily milestones; phased approach minimizing operational disruption; shadowing period for all critical functions; comprehensive documentation review and validation; and parallel operations during cutover period. We assign a dedicated Transition Manager and maintain 24/7 coverage during transition. Our last 20 federal transitions averaged 18 days to full operational capability with zero service interruptions. We build transition costs into our pricing and do not charge separately for transition activities.');

END $$;
