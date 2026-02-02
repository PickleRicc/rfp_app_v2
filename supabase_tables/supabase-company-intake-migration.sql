-- Company Intake & Data Management System
-- Based on Company_Intake_Framework.md
-- Run this after the main migration

-----------------------------------------------------------
-- PART 1: COMPANY PROFILE
-----------------------------------------------------------

-- Core company information
CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  company_name TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  dba_names TEXT[], -- array of doing business as names

  -- Registration
  cage_code TEXT NOT NULL CHECK (LENGTH(cage_code) = 5),
  uei_number TEXT NOT NULL CHECK (LENGTH(uei_number) = 12),
  sam_status TEXT CHECK (sam_status IN ('Active', 'Pending', 'Expired', 'Not Registered')),
  sam_expiration DATE,

  -- Company details
  year_founded INTEGER,
  headquarters_address JSONB NOT NULL, -- {street, suite, city, state, zip, country}
  additional_offices JSONB DEFAULT '[]'::jsonb, -- array of address objects
  website TEXT,
  employee_count INTEGER,
  annual_revenue DECIMAL(15,2),
  fiscal_year_end TEXT,

  -- Primary contacts
  proposal_poc JSONB NOT NULL, -- {name, title, email, phone}
  contracts_poc JSONB,
  authorized_signer JSONB NOT NULL, -- {name, title, email}

  -- Descriptions
  elevator_pitch TEXT NOT NULL CHECK (LENGTH(elevator_pitch) <= 500),
  full_description TEXT CHECK (LENGTH(full_description) <= 2000),
  mission_statement TEXT CHECK (LENGTH(mission_statement) <= 300),
  vision_statement TEXT CHECK (LENGTH(vision_statement) <= 300),
  core_values TEXT[],

  -- Metadata
  completeness_score INTEGER DEFAULT 0 CHECK (completeness_score BETWEEN 0 AND 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-----------------------------------------------------------
-- PART 2: CERTIFICATIONS & REGISTRATIONS
-----------------------------------------------------------

-- Small business certifications
CREATE TABLE IF NOT EXISTS certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  certification_type TEXT NOT NULL,
  certifying_agency TEXT,
  certification_number TEXT,
  effective_date DATE,
  expiration_date DATE,
  documentation_url TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NAICS codes
CREATE TABLE IF NOT EXISTS naics_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  code TEXT NOT NULL CHECK (LENGTH(code) = 6),
  title TEXT NOT NULL,
  size_standard TEXT,
  is_primary BOOLEAN DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contract vehicles
CREATE TABLE IF NOT EXISTS contract_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  vehicle_name TEXT NOT NULL,
  contract_number TEXT,
  vehicle_type TEXT CHECK (vehicle_type IN ('GWAC', 'BPA', 'IDIQ', 'GSA Schedule', 'State/Local Vehicle')),
  ordering_period_end DATE,
  ceiling_value DECIMAL(15,2),
  remaining_ceiling DECIMAL(15,2),
  labor_categories TEXT[],
  approved_rates_url TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Facility clearance
CREATE TABLE IF NOT EXISTS facility_clearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  has_facility_clearance BOOLEAN DEFAULT false,
  clearance_level TEXT CHECK (clearance_level IN ('None', 'Confidential', 'Secret', 'Top Secret', 'TS/SCI')),
  sponsoring_agency TEXT,
  cage_code_cleared TEXT,
  cleared_facility_address JSONB,
  safeguarding_capability TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-----------------------------------------------------------
-- PART 3: CAPABILITIES
-----------------------------------------------------------

-- Service areas
CREATE TABLE IF NOT EXISTS service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  service_name TEXT NOT NULL,
  description TEXT CHECK (LENGTH(description) <= 500),
  experience_years INTEGER,
  key_clients TEXT[],
  relevant_naics TEXT[],

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tools & technologies
CREATE TABLE IF NOT EXISTS tools_technologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  category TEXT,
  proficiency TEXT CHECK (proficiency IN ('Basic', 'Proficient', 'Expert', 'Certified Partner')),
  years_experience INTEGER,
  certified_practitioners INTEGER,
  description TEXT CHECK (LENGTH(description) <= 200),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Methodologies & frameworks
CREATE TABLE IF NOT EXISTS methodologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  category TEXT,
  implementation_experience TEXT CHECK (LENGTH(implementation_experience) <= 300),
  certified_practitioners INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-----------------------------------------------------------
-- PART 4: PAST PERFORMANCE
-----------------------------------------------------------

-- Past performance contracts
CREATE TABLE IF NOT EXISTS past_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  -- Identification
  contract_nickname TEXT NOT NULL,

  -- Contract details
  contract_name TEXT NOT NULL,
  contract_number TEXT NOT NULL,
  task_order_number TEXT,
  client_agency TEXT NOT NULL,
  client_office TEXT,

  -- Financials & period
  contract_type TEXT CHECK (contract_type IN ('FFP', 'T&M', 'Cost-Plus', 'Labor Hour', 'Hybrid')),
  contract_value DECIMAL(15,2) NOT NULL,
  annual_value DECIMAL(15,2),
  start_date DATE NOT NULL,
  end_date TEXT NOT NULL, -- can be date or "Ongoing"
  base_period TEXT,
  option_periods INTEGER,

  -- Role & scope
  role TEXT CHECK (role IN ('Prime', 'Subcontractor', 'Joint Venture', 'Teaming Partner')),
  percentage_of_work INTEGER,
  prime_contractor TEXT,
  team_size INTEGER NOT NULL,
  place_of_performance TEXT NOT NULL,

  -- Point of contact
  client_poc JSONB NOT NULL, -- {name, title, phone, email, note, last_verified}
  alternate_poc JSONB,

  -- Performance ratings
  cpars_rating JSONB, -- {overall, quality, schedule, cost_control, management, regulatory_compliance, date_of_rating}
  customer_feedback TEXT,

  -- Narrative
  overview TEXT NOT NULL CHECK (LENGTH(overview) <= 500),
  description_of_effort TEXT NOT NULL CHECK (LENGTH(description_of_effort) <= 2000),
  task_areas TEXT[] NOT NULL,
  tools_used TEXT[],

  -- Achievements (array of objects)
  achievements JSONB NOT NULL, -- [{statement, metric_value, metric_type}]

  -- Relevance
  relevance_tags TEXT[] NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-----------------------------------------------------------
-- PART 5: PERSONNEL
-----------------------------------------------------------

-- Personnel records
CREATE TABLE IF NOT EXISTS personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  -- Identification
  status TEXT CHECK (status IN ('Active', 'Available', 'Committed', 'Former', 'Pending')),

  -- Basic information
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  employment_type TEXT CHECK (employment_type IN ('W2 Employee', '1099 Contractor', 'Subcontractor', 'Teaming Partner Staff', 'To Be Hired')),
  employer_company TEXT,

  -- Availability
  availability TEXT NOT NULL,
  current_assignment TEXT,
  geographic_location TEXT NOT NULL,
  relocation_willing BOOLEAN,
  remote_capable BOOLEAN NOT NULL,

  -- Clearance
  clearance_level TEXT,
  clearance_status TEXT,
  investigation_date DATE,
  sponsoring_agency TEXT,

  -- Education (array of objects)
  education JSONB NOT NULL, -- [{degree_level, field_of_study, institution, graduation_year}]

  -- Certifications (array of objects)
  certifications JSONB, -- [{name, issuing_body, date_obtained, expiration_date, certification_number}]

  -- Experience
  total_experience_years INTEGER NOT NULL,
  federal_experience_years INTEGER,
  relevant_experience_years INTEGER,

  -- Work history (array of objects)
  work_history JSONB NOT NULL, -- [{job_title, employer, start_date, end_date, description, client_agency, contract_reference, relevant_skills}]

  -- Proposed roles (array of objects)
  proposed_roles JSONB, -- [{role_title, is_key_personnel, labor_category, bill_rate, cost_rate, summary_for_role}]

  -- Resume
  resume_url TEXT,
  resume_last_updated DATE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-----------------------------------------------------------
-- PART 6: DIFFERENTIATORS & WIN THEMES
-----------------------------------------------------------

-- Value propositions
CREATE TABLE IF NOT EXISTS value_propositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  theme TEXT NOT NULL,
  statement TEXT NOT NULL CHECK (LENGTH(statement) <= 200),
  proof_points TEXT[] NOT NULL,
  applicable_to TEXT[],

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Innovations
CREATE TABLE IF NOT EXISTS innovations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT CHECK (LENGTH(description) <= 500),
  evidence TEXT CHECK (LENGTH(evidence) <= 300),
  proprietary BOOLEAN DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitive advantages
CREATE TABLE IF NOT EXISTS competitive_advantages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  area TEXT NOT NULL,
  our_strength TEXT CHECK (LENGTH(our_strength) <= 200),
  competitor_weakness TEXT CHECK (LENGTH(competitor_weakness) <= 200),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-----------------------------------------------------------
-- PART 7: TEMPLATES & BOILERPLATE
-----------------------------------------------------------

-- Boilerplate library
CREATE TABLE IF NOT EXISTS boilerplate_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  type TEXT NOT NULL, -- 'company_intro', 'quality_approach', 'risk_management', etc.
  variant TEXT, -- 'short', 'medium', 'long'
  content TEXT NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document assets
CREATE TABLE IF NOT EXISTS document_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,

  asset_type TEXT NOT NULL, -- 'logo', 'org_chart', 'process_diagram', 'resume_template'
  variant TEXT, -- 'full_color', 'black_white', 'icon_only'
  file_url TEXT NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-----------------------------------------------------------
-- INDEXES
-----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_certifications_company ON certifications(company_id);
CREATE INDEX IF NOT EXISTS idx_naics_codes_company ON naics_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_contract_vehicles_company ON contract_vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_service_areas_company ON service_areas(company_id);
CREATE INDEX IF NOT EXISTS idx_tools_technologies_company ON tools_technologies(company_id);
CREATE INDEX IF NOT EXISTS idx_methodologies_company ON methodologies(company_id);
CREATE INDEX IF NOT EXISTS idx_past_performance_company ON past_performance(company_id);
CREATE INDEX IF NOT EXISTS idx_personnel_company ON personnel(company_id);
CREATE INDEX IF NOT EXISTS idx_personnel_status ON personnel(status);
CREATE INDEX IF NOT EXISTS idx_value_propositions_company ON value_propositions(company_id);
CREATE INDEX IF NOT EXISTS idx_innovations_company ON innovations(company_id);
CREATE INDEX IF NOT EXISTS idx_boilerplate_library_company ON boilerplate_library(company_id);
CREATE INDEX IF NOT EXISTS idx_document_assets_company ON document_assets(company_id);

-----------------------------------------------------------
-- ROW LEVEL SECURITY
-----------------------------------------------------------

ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE naics_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_clearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_technologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE methodologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE past_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_propositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE innovations ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitive_advantages ENABLE ROW LEVEL SECURITY;
ALTER TABLE boilerplate_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_assets ENABLE ROW LEVEL SECURITY;

-----------------------------------------------------------
-- POLICIES
-----------------------------------------------------------

CREATE POLICY "Enable all access for authenticated users" ON company_profiles
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON certifications
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON naics_codes
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON contract_vehicles
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON facility_clearances
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON service_areas
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON tools_technologies
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON methodologies
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON past_performance
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON personnel
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON value_propositions
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON innovations
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON competitive_advantages
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON boilerplate_library
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON document_assets
  FOR ALL USING (auth.role() = 'authenticated');
