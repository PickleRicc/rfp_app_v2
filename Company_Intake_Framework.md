# Company Intake & Data Management Framework
## Internal RFP Tool - Client Data System v1.0

---

## PURPOSE

This framework defines the data structure and intake process for collecting all company information needed to generate winning proposal responses. It serves as the single source of truth for each client, enabling rapid proposal generation while maintaining flexibility for updates and edits.

---

## DESIGN PRINCIPLES

```
principles:

  1. COLLECT_ONCE_USE_MANY:
     - Gather comprehensive data upfront
     - Reuse across unlimited proposals
     - Only update when information changes
     
  2. PROGRESSIVE_DISCLOSURE:
     - Start with essentials (can generate basic proposal)
     - Expand with optional fields (improves proposal quality)
     - Never block progress due to missing optional data
     
  3. MODULAR_STRUCTURE:
     - Each section independent
     - Can update one section without affecting others
     - Easy to add new personnel, contracts, capabilities
     
  4. VALIDATION_NOT_RESTRICTION:
     - Guide users to complete data
     - Flag incomplete sections
     - Never prevent saving partial progress
```

---

## PART 1: DATA ARCHITECTURE

### 1.1 Top-Level Structure

```
company_profile:
  ├── core_information          # Basic company details (REQUIRED)
  ├── certifications            # Set-asides, clearances, registrations
  ├── capabilities              # What they do, tools, methods
  ├── past_performance[]        # Contract history (array)
  ├── personnel[]               # People database (array)
  ├── differentiators           # Win themes, unique value
  ├── templates                 # Boilerplate text, standard language
  └── metadata                  # System tracking, last updated
```

### 1.2 Data Completeness Scoring

```
completeness_score:

  CALCULATION:
    - Core Information: 25 points (required)
    - Certifications: 10 points
    - Capabilities: 15 points
    - Past Performance (3+ contracts): 20 points
    - Personnel (key roles filled): 20 points
    - Differentiators: 10 points
    
  THRESHOLDS:
    - 0-40%: "Incomplete - Cannot generate proposals"
    - 41-70%: "Basic - Can generate draft proposals"
    - 71-90%: "Good - Can generate competitive proposals"
    - 91-100%: "Excellent - Fully optimized for generation"
    
  DISPLAY:
    - Show completion percentage per section
    - Highlight missing critical fields
    - Suggest next fields to complete for biggest impact
```

---

## PART 2: CORE INFORMATION

### 2.1 Company Identity

```yaml
core_information:
  
  # REQUIRED FIELDS (cannot generate without these)
  company_name:
    type: string
    required: true
    example: "Acme Federal Solutions, LLC"
    
  legal_name:
    type: string
    required: true
    note: "If different from company name"
    example: "Acme Federal Solutions, Limited Liability Company"
    
  dba_names:
    type: array[string]
    required: false
    note: "Any 'doing business as' names"
    
  cage_code:
    type: string
    required: true
    format: "5 alphanumeric characters"
    example: "1ABC2"
    
  uei_number:
    type: string
    required: true
    format: "12 characters"
    example: "ZXCVBNM12345"
    note: "Replaced DUNS in 2022"
    
  sam_status:
    type: enum
    options: ["Active", "Pending", "Expired", "Not Registered"]
    required: true
    
  sam_expiration:
    type: date
    required: true
    alert: "Notify 60 days before expiration"


  # COMPANY DETAILS
  year_founded:
    type: integer
    required: true
    
  headquarters_address:
    type: object
    required: true
    fields:
      street: string
      suite: string
      city: string
      state: string
      zip: string
      country: string (default: "USA")
      
  additional_offices:
    type: array[address]
    required: false
    
  website:
    type: url
    required: false
    
  employee_count:
    type: integer
    required: true
    note: "Current full-time employees"
    
  annual_revenue:
    type: currency
    required: false
    note: "Most recent fiscal year"
    
  fiscal_year_end:
    type: string
    example: "December 31"


  # PRIMARY CONTACTS
  proposal_poc:
    type: object
    required: true
    fields:
      name: string
      title: string
      email: email
      phone: phone
      
  contracts_poc:
    type: object
    required: false
    fields:
      name: string
      title: string
      email: email
      phone: phone
      
  authorized_signer:
    type: object
    required: true
    fields:
      name: string
      title: string
      email: email
      note: "Person authorized to bind company to contracts"
```

### 2.2 Company Description

```yaml
company_description:

  elevator_pitch:
    type: text
    max_length: 500
    required: true
    prompt: "Describe your company in 2-3 sentences. Who are you and what do you do?"
    example: "Acme Federal Solutions is a veteran-owned IT services firm specializing in enterprise program management and agile transformation for federal agencies. Since 2015, we have supported 12 federal agencies with PMO services, delivering over 200 successful projects."
    usage: "Executive summaries, cover letters, capability statements"
    
  full_description:
    type: text
    max_length: 2000
    required: false
    prompt: "Provide a detailed company overview (1-2 paragraphs)"
    usage: "About Us sections, detailed introductions"
    
  mission_statement:
    type: text
    max_length: 300
    required: false
    
  vision_statement:
    type: text
    max_length: 300
    required: false
    
  core_values:
    type: array[string]
    required: false
    example: ["Integrity", "Excellence", "Innovation", "Customer Focus"]
```

---

## PART 3: CERTIFICATIONS & REGISTRATIONS

### 3.1 Small Business Certifications

```yaml
small_business_certifications:

  business_size:
    type: enum
    options: ["Small Business", "Other Than Small Business"]
    required: true
    
  certifications:
    type: array[certification]
    
    certification_object:
      type: enum
      options:
        - "8(a) Business Development Program"
        - "HUBZone"
        - "Service-Disabled Veteran-Owned Small Business (SDVOSB)"
        - "Veteran-Owned Small Business (VOSB)"
        - "Women-Owned Small Business (WOSB)"
        - "Economically Disadvantaged WOSB (EDWOSB)"
        - "Small Disadvantaged Business (SDB)"
        - "Minority-Owned Business"
        - "LGBT Business Enterprise"
        - "AbilityOne"
        - "None"
        
      certifying_agency:
        type: string
        example: "SBA", "VA CVE", "Self-Certified"
        
      certification_number:
        type: string
        
      effective_date:
        type: date
        
      expiration_date:
        type: date
        alert: "Notify 90 days before expiration"
        
      documentation:
        type: file_upload
        note: "Certificate or proof of certification"
```

### 3.2 NAICS Codes

```yaml
naics_codes:

  primary_naics:
    type: object
    required: true
    fields:
      code: string (6 digits)
      title: string
      size_standard: string
      
  additional_naics:
    type: array[naics]
    required: false
    note: "All NAICS codes company is registered for in SAM"
    
  # Common IT Services NAICS for reference:
  common_examples:
    - code: "541512"
      title: "Computer Systems Design Services"
    - code: "541511"
      title: "Custom Computer Programming Services"
    - code: "541519"
      title: "Other Computer Related Services"
    - code: "541611"
      title: "Administrative Management Consulting"
    - code: "541618"
      title: "Other Management Consulting Services"
    - code: "541690"
      title: "Other Scientific and Technical Consulting"
```

### 3.3 Contract Vehicles

```yaml
contract_vehicles:

  vehicles_held:
    type: array[vehicle]
    
    vehicle_object:
      vehicle_name:
        type: string
        example: "GSA MAS", "CIO-SP3", "Alliant 2", "STARS III"
        
      contract_number:
        type: string
        
      vehicle_type:
        type: enum
        options: ["GWAC", "BPA", "IDIQ", "GSA Schedule", "State/Local Vehicle"]
        
      ordering_period_end:
        type: date
        alert: "Notify when nearing end"
        
      ceiling_value:
        type: currency
        
      remaining_ceiling:
        type: currency
        
      labor_categories:
        type: array[string]
        note: "Approved labor categories under this vehicle"
        
      approved_rates:
        type: file_upload
        note: "Current price list or rate card"
```

### 3.4 Facility Clearance

```yaml
facility_clearance:

  has_facility_clearance:
    type: boolean
    required: true
    
  clearance_level:
    type: enum
    options: ["None", "Confidential", "Secret", "Top Secret", "TS/SCI"]
    conditional: "if has_facility_clearance"
    
  sponsoring_agency:
    type: string
    conditional: "if has_facility_clearance"
    
  cage_code_cleared:
    type: string
    conditional: "if has_facility_clearance"
    note: "May differ from primary CAGE"
    
  cleared_facility_address:
    type: address
    conditional: "if has_facility_clearance"
    
  safeguarding_capability:
    type: enum
    options: ["None", "Confidential", "Secret", "Top Secret"]
    conditional: "if has_facility_clearance"
```

---

## PART 4: CAPABILITIES

### 4.1 Service Areas

```yaml
service_areas:

  primary_services:
    type: array[service]
    required: true
    min_items: 1
    
    service_object:
      service_name:
        type: string
        example: "Enterprise Program Management"
        
      description:
        type: text
        max_length: 500
        prompt: "Describe this service offering in 2-3 sentences"
        
      experience_years:
        type: integer
        prompt: "Years performing this service"
        
      key_clients:
        type: array[string]
        prompt: "Notable clients for this service"
        
      relevant_naics:
        type: array[string]
        note: "Link to NAICS codes"


  # COMMON SERVICE CATEGORIES (for suggestions/tagging)
  service_taxonomy:
    categories:
      - "Program/Project Management"
      - "Agile/DevSecOps"
      - "IT Strategy & Planning"
      - "Enterprise Architecture"
      - "Cloud Services"
      - "Cybersecurity"
      - "Data Analytics"
      - "Application Development"
      - "Systems Integration"
      - "IT Operations & Maintenance"
      - "Help Desk/Service Desk"
      - "Training & Change Management"
      - "Independent Verification & Validation (IV&V)"
      - "Section 508 Compliance"
      - "Acquisition Support"
```

### 4.2 Tools & Technologies

```yaml
tools_technologies:

  tools:
    type: array[tool]
    
    tool_object:
      name:
        type: string
        example: "ServiceNow"
        
      category:
        type: enum
        options:
          - "Project Management"
          - "Agile/Scrum"
          - "DevOps/CI-CD"
          - "Cloud Platform"
          - "Collaboration"
          - "Analytics/BI"
          - "Security"
          - "Development"
          - "Database"
          - "Other"
          
      proficiency:
        type: enum
        options: ["Basic", "Proficient", "Expert", "Certified Partner"]
        
      years_experience:
        type: integer
        
      certified_practitioners:
        type: integer
        note: "Number of staff certified in this tool"
        
      description:
        type: text
        max_length: 200
        prompt: "How do you use this tool for clients?"


  # COMMON TOOLS (for autocomplete/suggestions)
  common_tools:
    project_management: ["Microsoft Project", "Smartsheet", "Monday.com", "Asana", "Wrike"]
    agile: ["Jira", "Azure DevOps", "Rally", "VersionOne", "Trello"]
    collaboration: ["Microsoft Teams", "Slack", "SharePoint", "Confluence"]
    cloud: ["AWS", "Azure", "Google Cloud", "Oracle Cloud"]
    analytics: ["Power BI", "Tableau", "Qlik", "Looker"]
    devops: ["Jenkins", "GitLab", "GitHub Actions", "CircleCI", "Terraform"]
    itsm: ["ServiceNow", "BMC Remedy", "Cherwell", "Freshservice"]
```

### 4.3 Methodologies & Frameworks

```yaml
methodologies:

  frameworks_used:
    type: array[framework]
    
    framework_object:
      name:
        type: string
        example: "SAFe (Scaled Agile Framework)"
        
      category:
        type: enum
        options:
          - "Agile"
          - "Project Management"
          - "IT Service Management"
          - "Security"
          - "Quality"
          - "Architecture"
          - "Other"
          
      implementation_experience:
        type: text
        max_length: 300
        prompt: "Describe your experience implementing this framework"
        
      certified_practitioners:
        type: integer


  # COMMON FRAMEWORKS
  common_frameworks:
    agile: ["SAFe", "Scrum", "Kanban", "Lean", "XP"]
    pm: ["PMBOK", "PRINCE2", "Agile PM"]
    itsm: ["ITIL v4", "COBIT", "ISO 20000"]
    security: ["NIST RMF", "NIST CSF", "FedRAMP", "FISMA"]
    quality: ["CMMI", "ISO 9001", "Six Sigma"]
    architecture: ["TOGAF", "Zachman", "DODAF"]
```

---

## PART 5: PAST PERFORMANCE

### 5.1 Contract Record Structure

```yaml
past_performance_contract:

  # IDENTIFICATION
  contract_id:
    type: auto_generated
    format: "PP-001, PP-002, etc."
    
  contract_nickname:
    type: string
    required: true
    prompt: "Internal reference name"
    example: "FERC ePMO Support"
    
    
  # CONTRACT DETAILS
  contract_name:
    type: string
    required: true
    example: "Enterprise Program Management Support Services"
    
  contract_number:
    type: string
    required: true
    example: "47QFCA22D0001"
    
  task_order_number:
    type: string
    required: false
    note: "If under IDIQ/GWAC/BPA"
    
  client_agency:
    type: string
    required: true
    example: "Federal Energy Regulatory Commission (FERC)"
    
  client_office:
    type: string
    required: false
    example: "Chief Information Officer Organization (CIOO)"
    
    
  # FINANCIALS & PERIOD
  contract_type:
    type: enum
    options: ["FFP", "T&M", "Cost-Plus", "Labor Hour", "Hybrid"]
    required: true
    
  contract_value:
    type: currency
    required: true
    note: "Total contract value (all options)"
    
  annual_value:
    type: currency
    required: false
    note: "Typical annual run rate"
    
  period_of_performance:
    type: object
    required: true
    fields:
      start_date: date
      end_date: date (or "Ongoing")
      base_period: string (e.g., "12 months")
      option_periods: integer
      
      
  # ROLE & SCOPE
  role:
    type: enum
    options: ["Prime", "Subcontractor", "Joint Venture", "Teaming Partner"]
    required: true
    
  percentage_of_work:
    type: integer
    required: false
    note: "If subcontractor, what % of work"
    
  prime_contractor:
    type: string
    conditional: "if role != Prime"
    note: "Name of prime if we were sub"
    
  team_size:
    type: integer
    required: true
    note: "Number of FTEs on this contract"
    
  place_of_performance:
    type: string
    required: true
    example: "Washington, DC (on-site) and Remote"


  # POINT OF CONTACT
  client_poc:
    type: object
    required: true
    note: "For reference checks"
    fields:
      name: string
      title: string
      phone: phone
      email: email
      note: string (e.g., "Best to call, prefers morning")
      last_verified: date
      
  alternate_poc:
    type: object
    required: false
    note: "Backup reference"
    
    
  # PERFORMANCE RATINGS
  cpars_rating:
    type: object
    required: false
    fields:
      overall: enum ["Exceptional", "Very Good", "Satisfactory", "Marginal", "Unsatisfactory", "N/A"]
      quality: enum
      schedule: enum
      cost_control: enum
      management: enum
      regulatory_compliance: enum
      date_of_rating: date
      
  customer_feedback:
    type: text
    required: false
    prompt: "Any notable praise or quotes from customer"
```

### 5.2 Contract Description & Relevance

```yaml
past_performance_narrative:

  # OVERVIEW (2-3 sentences)
  overview:
    type: text
    max_length: 500
    required: true
    prompt: "Brief summary of the contract scope and your role"
    example: "Acme provides enterprise program management support to FERC's Chief Information Officer Organization, including PMO services, Agile coaching, IT strategy development, and Section 508 compliance support for a portfolio of 25+ IT investments."
    
    
  # DETAILED DESCRIPTION (1-2 paragraphs)
  description_of_effort:
    type: text
    max_length: 2000
    required: true
    prompt: "Detailed description of work performed, team composition, and key activities"
    
    
  # TASK AREAS COVERED
  task_areas:
    type: array[string]
    required: true
    prompt: "What types of work did/do you perform?"
    suggestions:
      - "Program/Project Management"
      - "Agile Coaching & Transformation"
      - "IT Strategy & Roadmaps"
      - "Portfolio Management"
      - "Risk Management"
      - "Communications & Outreach"
      - "IV&V"
      - "Section 508 Compliance"
      - "Training Development & Delivery"
      - "Transition Management"
      - "Quality Assurance"
      - "DevSecOps"
      - "Cloud Migration"
      - "Cybersecurity"
      - "Help Desk/User Support"
      - "Application Development"
      - "Data Analytics"
      
      
  # TOOLS USED
  tools_used:
    type: array[string]
    required: false
    prompt: "What tools/technologies did you use on this contract?"
    note: "Link to tools database for autocomplete"
    
    
  # ACHIEVEMENTS & METRICS
  achievements:
    type: array[achievement]
    required: true
    min_items: 2
    prompt: "Quantified accomplishments on this contract"
    
    achievement_object:
      statement:
        type: text
        max_length: 200
        example: "Reduced project delivery time by 30% through Agile transformation"
        
      metric_value:
        type: string
        example: "30%"
        
      metric_type:
        type: enum
        options: ["Cost Savings", "Time Savings", "Quality Improvement", "Efficiency Gain", "Customer Satisfaction", "Compliance", "Other"]
        
        
  # RELEVANCE TAGS (for matching to RFP requirements)
  relevance_tags:
    type: array[string]
    required: true
    prompt: "Keywords that describe this contract's relevance"
    note: "Used for auto-matching to RFP requirements"
    example: ["PMO", "FERC", "federal agency", "IT services", "Agile", "SAFe", "ServiceNow", "Section 508", "CIOO"]
```

### 5.3 Past Performance Quick Entry

```yaml
# SIMPLIFIED ENTRY FOR RAPID DATA COLLECTION
past_performance_quick_entry:

  required_fields:
    - contract_nickname
    - contract_name
    - contract_number
    - client_agency
    - contract_type
    - contract_value
    - period_of_performance.start_date
    - period_of_performance.end_date
    - role
    - team_size
    - client_poc.name
    - client_poc.phone
    - client_poc.email
    - overview
    - task_areas (min 1)
    - achievements (min 1)
    
  optional_expand:
    - "Add detailed description"
    - "Add CPARS ratings"
    - "Add additional achievements"
    - "Add tools used"
    - "Add relevance tags"
```

---

## PART 6: PERSONNEL DATABASE

### 6.1 Person Record Structure

```yaml
personnel_record:

  # IDENTIFICATION
  person_id:
    type: auto_generated
    format: "PER-001, PER-002, etc."
    
  status:
    type: enum
    options: ["Active", "Available", "Committed", "Former", "Pending"]
    required: true
    
    
  # BASIC INFORMATION
  full_name:
    type: string
    required: true
    
  email:
    type: email
    required: true
    
  phone:
    type: phone
    required: false
    
  employment_type:
    type: enum
    options: ["W2 Employee", "1099 Contractor", "Subcontractor", "Teaming Partner Staff", "To Be Hired"]
    required: true
    
  employer_company:
    type: string
    conditional: "if employment_type in [Subcontractor, Teaming Partner Staff]"
    
    
  # AVAILABILITY
  availability:
    type: enum
    options: ["Immediately Available", "2 Weeks Notice", "Available [Date]", "Currently Committed"]
    required: true
    
  current_assignment:
    type: string
    required: false
    note: "If currently on a contract"
    
  geographic_location:
    type: string
    required: true
    example: "Washington, DC Metro Area"
    
  relocation_willing:
    type: boolean
    required: false
    
  remote_capable:
    type: boolean
    required: true
```

### 6.2 Qualifications

```yaml
personnel_qualifications:

  # CLEARANCE
  clearance:
    type: object
    required: true
    fields:
      level:
        type: enum
        options: ["None", "Public Trust", "Secret", "Top Secret", "TS/SCI"]
        
      status:
        type: enum
        options: ["Active", "Current", "Inactive (within 2 years)", "Expired", "In Process"]
        
      investigation_date:
        type: date
        
      sponsoring_agency:
        type: string
        
        
  # EDUCATION
  education:
    type: array[degree]
    required: true
    min_items: 1
    
    degree_object:
      degree_level:
        type: enum
        options: ["High School", "Associate", "Bachelor", "Master", "Doctorate", "Professional (JD, MD)"]
        
      field_of_study:
        type: string
        example: "Computer Science"
        
      institution:
        type: string
        example: "University of Maryland"
        
      graduation_year:
        type: integer
        
        
  # CERTIFICATIONS
  certifications:
    type: array[certification]
    required: false
    
    certification_object:
      name:
        type: string
        example: "Project Management Professional (PMP)"
        
      issuing_body:
        type: string
        example: "Project Management Institute"
        
      date_obtained:
        type: date
        
      expiration_date:
        type: date
        note: "null if no expiration"
        
      certification_number:
        type: string
        required: false


  # COMMON CERTIFICATIONS (for autocomplete)
  common_certifications:
    pm: ["PMP", "CAPM", "PgMP", "PMI-ACP", "PRINCE2"]
    agile: ["CSM", "CSPO", "SAFe Agilist", "SAFe SPC", "SAFe RTE", "PSM", "PSPO"]
    itil: ["ITIL 4 Foundation", "ITIL 4 Managing Professional", "ITIL 4 Strategic Leader"]
    security: ["CISSP", "CISM", "Security+", "CEH", "CISA"]
    cloud: ["AWS Solutions Architect", "AWS Developer", "Azure Administrator", "GCP Professional"]
    other: ["Six Sigma Green Belt", "Six Sigma Black Belt", "TOGAF", "CBAP"]
    
    
  # YEARS OF EXPERIENCE
  total_experience_years:
    type: integer
    required: true
    
  federal_experience_years:
    type: integer
    required: false
    
  relevant_experience_years:
    type: integer
    required: false
    note: "In primary service area"
```

### 6.3 Roles & Labor Categories

```yaml
personnel_roles:

  # PROPOSED ROLES
  proposed_roles:
    type: array[role]
    required: true
    min_items: 1
    
    role_object:
      role_title:
        type: string
        example: "Program Manager"
        
      is_key_personnel:
        type: boolean
        default: false
        
      labor_category:
        type: string
        example: "Program Manager III"
        note: "Standard labor category title"
        
      bill_rate:
        type: currency
        note: "Loaded hourly rate"
        
      cost_rate:
        type: currency
        note: "Internal cost rate"
        
      summary_for_role:
        type: text
        max_length: 500
        prompt: "2-3 sentence summary of qualifications for this specific role"


  # EXPERIENCE HISTORY
  work_history:
    type: array[position]
    required: true
    min_items: 1
    
    position_object:
      job_title:
        type: string
        
      employer:
        type: string
        
      start_date:
        type: date (MM/YYYY)
        
      end_date:
        type: date or "Present"
        
      description:
        type: text
        max_length: 1000
        prompt: "Description of responsibilities and achievements"
        
      client_agency:
        type: string
        required: false
        note: "If federal contract work"
        
      contract_reference:
        type: string
        required: false
        note: "Link to Past Performance record if applicable"
        
      relevant_skills:
        type: array[string]
        prompt: "Key skills demonstrated in this role"
```

### 6.4 Resume Management

```yaml
resume_management:

  resume_file:
    type: file_upload
    formats: [".docx", ".pdf"]
    required: false
    note: "Full resume document"
    
  resume_last_updated:
    type: date
    auto_set: true
    
  resume_needs_update:
    type: boolean
    trigger: "if resume_last_updated > 6 months ago"
    
  # For proposals, resumes are auto-generated from structured data
  # but uploaded resume can serve as reference/backup
```

---

## PART 7: DIFFERENTIATORS & WIN THEMES

### 7.1 Company Differentiators

```yaml
differentiators:

  # UNIQUE VALUE PROPOSITIONS
  value_propositions:
    type: array[proposition]
    required: true
    min_items: 3
    max_items: 7
    
    proposition_object:
      theme:
        type: string
        example: "Proven Federal Experience"
        
      statement:
        type: text
        max_length: 200
        prompt: "One sentence stating this differentiator"
        example: "Acme brings 10+ years of continuous federal IT services experience across 15 agencies."
        
      proof_points:
        type: array[string]
        min_items: 2
        prompt: "Evidence that supports this differentiator"
        example:
          - "8 consecutive option years exercised on DOE contract"
          - "100% CPARS ratings of 'Very Good' or higher"
          - "Zero security incidents across all contracts"
          
      applicable_to:
        type: array[string]
        prompt: "What types of opportunities is this relevant for?"
        example: ["PMO", "IT Services", "Federal Civilian", "Recompete"]


  # INNOVATIONS & UNIQUE CAPABILITIES
  innovations:
    type: array[innovation]
    required: false
    
    innovation_object:
      name:
        type: string
        example: "Agile Maturity Accelerator"
        
      description:
        type: text
        max_length: 500
        prompt: "What is it and how does it benefit clients?"
        
      evidence:
        type: text
        max_length: 300
        prompt: "Results achieved using this innovation"
        
      proprietary:
        type: boolean
        note: "Is this a proprietary tool/method?"


  # COMPETITIVE ADVANTAGES
  competitive_advantages:
    type: array[advantage]
    required: false
    prompt: "What do you do better than competitors?"
    
    advantage_object:
      area:
        type: string
        example: "Transition Speed"
        
      our_strength:
        type: text
        max_length: 200
        example: "Average 15-day transition vs. industry standard 30 days"
        
      competitor_weakness:
        type: text
        max_length: 200
        note: "Never name competitors - describe general market gap"
        example: "Many contractors require extended ramp-up periods"
```

### 7.2 Standard Win Themes Library

```yaml
win_themes_library:

  # PRE-BUILT THEMES (customize for each company)
  theme_templates:
  
    - category: "Experience"
      themes:
        - "Proven [Agency] Experience"
        - "Deep Federal IT Expertise"
        - "Incumbent Advantage"
        - "Continuous Performance Excellence"
        
    - category: "Team"
      themes:
        - "Cleared, Qualified, Ready"
        - "Expert Team, Zero Ramp-Up"
        - "Stable, Committed Workforce"
        
    - category: "Approach"
      themes:
        - "Innovative Solutions"
        - "Proven Methodology"
        - "Risk-Free Transition"
        - "Seamless Integration"
        
    - category: "Value"
      themes:
        - "Best Value Solution"
        - "Cost-Efficient Excellence"
        - "Maximizing ROI"
        
    - category: "Small Business"
      themes:
        - "Small Business Agility"
        - "Direct Access to Leadership"
        - "Certified [8(a)/SDVOSB/etc.] Partner"
```

---

## PART 8: TEMPLATES & BOILERPLATE

### 8.1 Reusable Text Blocks

```yaml
boilerplate_library:

  # COMPANY BOILERPLATE
  company_intro:
    type: text
    versions:
      short: "50 words max"
      medium: "100 words max"
      long: "200 words max"
    prompt: "Standard company introduction paragraph"
    
  small_business_statement:
    type: text
    note: "If applicable - SB status and commitment"
    
  teaming_statement:
    type: text
    note: "Standard language about teaming arrangements"
    
    
  # APPROACH BOILERPLATE
  quality_approach:
    type: text
    prompt: "Standard quality management description"
    
  risk_management_approach:
    type: text
    prompt: "Standard risk management description"
    
  communication_approach:
    type: text
    prompt: "Standard stakeholder communication description"
    
  transition_approach:
    type: text
    prompt: "Standard transition methodology description"
    
  staffing_approach:
    type: text
    prompt: "Standard staffing and retention description"
    
    
  # COMPLIANCE STATEMENTS
  compliance_statements:
    type: array[statement]
    
    statement_object:
      topic:
        type: string
        example: "Section 508 Compliance"
        
      statement:
        type: text
        example: "Acme is committed to ensuring all deliverables meet Section 508 accessibility standards..."
        
        
  # CLOSING STATEMENTS
  proposal_closing:
    type: text
    prompt: "Standard confident closing paragraph"
    
  cover_letter_closing:
    type: text
    prompt: "Standard cover letter closing"
```

### 8.2 Document Assets

```yaml
document_assets:

  # LOGOS
  company_logo:
    type: file_upload
    formats: [".png", ".jpg", ".svg"]
    variants:
      full_color: file
      black_white: file
      icon_only: file
      
  # GRAPHICS
  org_chart_template:
    type: file_upload
    note: "Base org chart for customization"
    
  process_diagrams:
    type: array[file]
    note: "Standard methodology diagrams"
    
  # TEMPLATES  
  resume_template:
    type: file_upload
    format: ".docx"
    
  past_performance_template:
    type: file_upload
    format: ".docx"
```

---

## PART 9: INTAKE WORKFLOW

### 9.1 Progressive Intake Steps

```yaml
intake_workflow:

  STEP_1_ESSENTIALS:
    title: "Company Basics"
    duration: "5-10 minutes"
    fields:
      - company_name
      - cage_code
      - uei_number
      - sam_status
      - headquarters_address
      - employee_count
      - proposal_poc
      - authorized_signer
      - elevator_pitch
    completion_unlocks: "Can create account and view tool"
    
  STEP_2_IDENTITY:
    title: "Certifications & Registrations"
    duration: "5-10 minutes"
    fields:
      - business_size
      - small_business_certifications
      - primary_naics
      - additional_naics
      - facility_clearance
    completion_unlocks: "Can filter relevant opportunities"
    
  STEP_3_CAPABILITIES:
    title: "What You Do"
    duration: "10-15 minutes"
    fields:
      - primary_services
      - tools_technologies
      - methodologies
    completion_unlocks: "Basic capability matching"
    
  STEP_4_PAST_PERFORMANCE:
    title: "Your Track Record"
    duration: "15-30 minutes (per contract)"
    fields:
      - past_performance_contracts (minimum 3)
    completion_unlocks: "Can generate Past Performance volumes"
    
  STEP_5_PERSONNEL:
    title: "Your Team"
    duration: "10-20 minutes (per person)"
    fields:
      - personnel_records (key roles)
    completion_unlocks: "Can generate staffing plans and resumes"
    
  STEP_6_DIFFERENTIATORS:
    title: "Why You Win"
    duration: "15-20 minutes"
    fields:
      - value_propositions
      - innovations
      - boilerplate_library
    completion_unlocks: "Full proposal generation capability"
```

### 9.2 Data Validation Rules

```yaml
validation_rules:

  # FORMAT VALIDATIONS
  cage_code:
    pattern: "^[A-Z0-9]{5}$"
    message: "CAGE code must be exactly 5 alphanumeric characters"
    
  uei_number:
    pattern: "^[A-Z0-9]{12}$"
    message: "UEI must be exactly 12 alphanumeric characters"
    
  email:
    pattern: "standard email regex"
    
  phone:
    pattern: "accepts multiple formats, normalizes to +1XXXXXXXXXX"
    
    
  # BUSINESS VALIDATIONS
  past_performance_poc:
    rule: "POC email domain should not match company domain"
    message: "Reference should be a client contact, not internal"
    severity: "warning"
    
  contract_dates:
    rule: "end_date >= start_date"
    message: "End date must be after start date"
    
  experience_years:
    rule: "total_experience >= federal_experience"
    message: "Federal experience cannot exceed total experience"
    
    
  # COMPLETENESS VALIDATIONS
  minimum_past_performance:
    rule: "past_performance_contracts.length >= 3"
    message: "Most RFPs require 3 past performance references"
    severity: "warning"
    
  key_personnel_coverage:
    rule: "Check common roles are filled: PM, Technical Lead"
    message: "Consider adding key personnel for common roles"
    severity: "suggestion"
```

---

## PART 10: DATA MANAGEMENT

### 10.1 Edit & Update Capabilities

```yaml
edit_capabilities:

  # ALL FIELDS EDITABLE
  edit_policy:
    rule: "Any field can be edited at any time"
    history: "All changes tracked with timestamp and user"
    
  # BULK OPERATIONS
  bulk_updates:
    - "Update all phone numbers for a POC"
    - "Mark personnel as 'Former'"
    - "Archive old past performance"
    - "Clone a past performance record"
    
  # VERSION HISTORY
  version_tracking:
    scope: "Per-record level"
    retention: "Last 10 versions"
    fields_tracked:
      - who_changed
      - when_changed
      - what_changed (diff)
      - why_changed (optional note)
      
  # ROLLBACK
  rollback:
    capability: "Restore any previous version"
    scope: "Individual record only"
```

### 10.2 Data Freshness & Maintenance

```yaml
data_freshness:

  # AUTOMATIC ALERTS
  alerts:
    - trigger: "SAM expiration within 60 days"
      action: "Email notification + dashboard warning"
      
    - trigger: "Certification expiration within 90 days"
      action: "Email notification + dashboard warning"
      
    - trigger: "POC not verified in 12 months"
      action: "Dashboard reminder to verify"
      
    - trigger: "Resume not updated in 6 months"
      action: "Dashboard reminder"
      
    - trigger: "Past performance contract ended > 3 years ago"
      action: "Suggest archiving or noting limited relevance"
      
      
  # PERIODIC REVIEW PROMPTS
  quarterly_review:
    prompt: "Review and confirm company information is current"
    sections:
      - Core Information
      - Certifications
      - Key Personnel availability
      
  annual_review:
    prompt: "Comprehensive data review"
    sections:
      - All sections
      - Archive stale records
      - Update financials
```

### 10.3 Export & Integration

```yaml
export_integration:

  # EXPORT FORMATS
  exports:
    - format: "JSON"
      scope: "Full company profile"
      use: "Backup, migration, API integration"
      
    - format: "Excel"
      scope: "Past Performance summary"
      use: "Client review, manual tracking"
      
    - format: "Word"
      scope: "Capability Statement"
      use: "Marketing, quick reference"
      
    - format: "PDF"
      scope: "Company overview"
      use: "Sharing with partners"
      
      
  # API ACCESS (Future)
  api_endpoints:
    - GET /company/{id}/profile
    - GET /company/{id}/past-performance
    - GET /company/{id}/personnel
    - PUT /company/{id}/personnel/{person_id}
    - POST /company/{id}/past-performance
```

---

## PART 11: UI/UX GUIDELINES

### 11.1 Form Design Principles

```yaml
form_design:

  # PROGRESSIVE DISCLOSURE
  principle_1:
    name: "Show what's needed now"
    implementation:
      - "Start with required fields only"
      - "Expand optional sections on demand"
      - "Use accordions for complex sections"
      
  # SMART DEFAULTS
  principle_2:
    name: "Reduce typing"
    implementation:
      - "Autocomplete for common values"
      - "Copy from previous entries"
      - "Pre-fill from SAM.gov lookup (future)"
      
  # INLINE VALIDATION
  principle_3:
    name: "Immediate feedback"
    implementation:
      - "Validate on blur, not just submit"
      - "Show success checkmarks"
      - "Helpful error messages"
      
  # SAVE CONSTANTLY
  principle_4:
    name: "Never lose work"
    implementation:
      - "Auto-save every 30 seconds"
      - "Save on field blur"
      - "Show save status indicator"
```

### 11.2 Section Navigation

```yaml
navigation:

  # SIDEBAR SECTIONS
  sections:
    - icon: "building"
      label: "Company Info"
      completion_indicator: true
      
    - icon: "certificate"
      label: "Certifications"
      completion_indicator: true
      
    - icon: "tools"
      label: "Capabilities"
      completion_indicator: true
      
    - icon: "history"
      label: "Past Performance"
      count_indicator: true
      
    - icon: "users"
      label: "Personnel"
      count_indicator: true
      
    - icon: "star"
      label: "Differentiators"
      completion_indicator: true
      
    - icon: "file-text"
      label: "Templates"
      completion_indicator: true
      
      
  # COMPLETION DASHBOARD
  dashboard:
    - Overall completion percentage
    - Section-by-section breakdown
    - "Next best action" suggestion
    - Recent activity feed
```

---

## APPENDIX: QUICK REFERENCE

### A.1 Minimum Viable Profile

```yaml
minimum_viable_profile:
  # Absolute minimum to generate a basic proposal draft
  
  required:
    - company_name
    - cage_code
    - uei_number
    - headquarters_address
    - proposal_poc
    - elevator_pitch
    - primary_naics
    - 1 service area
    - 1 past performance contract (overview only)
    - 1 key personnel record
    
  result: "Can generate draft proposal requiring significant manual completion"
```

### A.2 Competition-Ready Profile

```yaml
competition_ready_profile:
  # Recommended for generating competitive proposals
  
  required:
    - All minimum viable fields
    - Full company description
    - All applicable certifications
    - 3+ complete past performance records
    - All key personnel for typical proposal
    - 3+ differentiators with proof points
    - Quality and transition boilerplate
    - Company logo
    
  result: "Can generate near-final proposal requiring only RFP-specific customization"
```

---

*Framework Version: 1.0*
*Last Updated: January 2026*
*For use with ClicklessAI Internal RFP Tool*
