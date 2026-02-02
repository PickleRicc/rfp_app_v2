// Company Intake System Types
// Based on Company_Intake_Framework.md

// ===== CORE INFORMATION =====

export interface Address {
  street: string;
  suite?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface ContactPerson {
  name: string;
  title: string;
  email: string;
  phone?: string;
  note?: string;
  last_verified?: string;
}

export interface CompanyProfile {
  id: string;

  // Identity
  company_name: string;
  legal_name: string;
  dba_names: string[];

  // Registration
  cage_code: string;
  uei_number: string;
  sam_status: 'Active' | 'Pending' | 'Expired' | 'Not Registered';
  sam_expiration: string;

  // Company details
  year_founded: number;
  headquarters_address: Address;
  additional_offices: Address[];
  website: string;
  employee_count: number;
  annual_revenue: number;
  fiscal_year_end: string;

  // Primary contacts
  proposal_poc: ContactPerson;
  contracts_poc?: ContactPerson;
  authorized_signer: ContactPerson;

  // Descriptions
  elevator_pitch: string;
  full_description?: string;
  mission_statement?: string;
  vision_statement?: string;
  core_values: string[];

  // Metadata
  completeness_score: number;
  created_at: string;
  updated_at: string;
}

// ===== CERTIFICATIONS & REGISTRATIONS =====

export interface Certification {
  id: string;
  company_id: string;
  certification_type: string;
  certifying_agency?: string;
  certification_number?: string;
  effective_date?: string;
  expiration_date?: string;
  documentation_url?: string;
  created_at: string;
  updated_at: string;
}

export interface NaicsCode {
  id: string;
  company_id: string;
  code: string;
  title: string;
  size_standard?: string;
  is_primary: boolean;
  created_at: string;
}

export interface ContractVehicle {
  id: string;
  company_id: string;
  vehicle_name: string;
  contract_number?: string;
  vehicle_type: 'GWAC' | 'BPA' | 'IDIQ' | 'GSA Schedule' | 'State/Local Vehicle';
  ordering_period_end?: string;
  ceiling_value?: number;
  remaining_ceiling?: number;
  labor_categories: string[];
  approved_rates_url?: string;
  created_at: string;
  updated_at: string;
}

export interface FacilityClearance {
  id: string;
  company_id: string;
  has_facility_clearance: boolean;
  clearance_level?: 'None' | 'Confidential' | 'Secret' | 'Top Secret' | 'TS/SCI';
  sponsoring_agency?: string;
  cage_code_cleared?: string;
  cleared_facility_address?: Address;
  safeguarding_capability?: string;
  created_at: string;
  updated_at: string;
}

// ===== CAPABILITIES =====

export interface ServiceArea {
  id: string;
  company_id: string;
  service_name: string;
  description: string;
  experience_years?: number;
  key_clients: string[];
  relevant_naics: string[];
  created_at: string;
  updated_at: string;
}

export interface ToolTechnology {
  id: string;
  company_id: string;
  name: string;
  category?: string;
  proficiency: 'Basic' | 'Proficient' | 'Expert' | 'Certified Partner';
  years_experience?: number;
  certified_practitioners?: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Methodology {
  id: string;
  company_id: string;
  name: string;
  category?: string;
  implementation_experience?: string;
  certified_practitioners?: number;
  created_at: string;
  updated_at: string;
}

// ===== PAST PERFORMANCE =====

export interface CparsRating {
  overall: 'Exceptional' | 'Very Good' | 'Satisfactory' | 'Marginal' | 'Unsatisfactory' | 'N/A';
  quality?: string;
  schedule?: string;
  cost_control?: string;
  management?: string;
  regulatory_compliance?: string;
  date_of_rating?: string;
}

export interface Achievement {
  statement: string;
  metric_value: string;
  metric_type: 'Cost Savings' | 'Time Savings' | 'Quality Improvement' | 'Efficiency Gain' | 'Customer Satisfaction' | 'Compliance' | 'Other';
}

export interface PastPerformance {
  id: string;
  company_id: string;

  // Identification
  contract_nickname: string;

  // Contract details
  contract_name: string;
  contract_number: string;
  task_order_number?: string;
  client_agency: string;
  client_office?: string;

  // Financials & period
  contract_type: 'FFP' | 'T&M' | 'Cost-Plus' | 'Labor Hour' | 'Hybrid';
  contract_value: number;
  annual_value?: number;
  start_date: string;
  end_date: string; // can be "Ongoing"
  base_period?: string;
  option_periods?: number;

  // Role & scope
  role: 'Prime' | 'Subcontractor' | 'Joint Venture' | 'Teaming Partner';
  percentage_of_work?: number;
  prime_contractor?: string;
  team_size: number;
  place_of_performance: string;

  // Point of contact
  client_poc: ContactPerson;
  alternate_poc?: ContactPerson;

  // Performance ratings
  cpars_rating?: CparsRating;
  customer_feedback?: string;

  // Narrative
  overview: string;
  description_of_effort: string;
  task_areas: string[];
  tools_used: string[];

  // Achievements
  achievements: Achievement[];

  // Relevance
  relevance_tags: string[];

  created_at: string;
  updated_at: string;
}

// ===== PERSONNEL =====

export interface Degree {
  degree_level: 'High School' | 'Associate' | 'Bachelor' | 'Master' | 'Doctorate' | 'Professional (JD, MD)';
  field_of_study: string;
  institution: string;
  graduation_year: number;
}

export interface PersonCertification {
  name: string;
  issuing_body: string;
  date_obtained: string;
  expiration_date?: string;
  certification_number?: string;
}

export interface WorkPosition {
  job_title: string;
  employer: string;
  start_date: string;
  end_date: string; // or "Present"
  description: string;
  client_agency?: string;
  contract_reference?: string;
  relevant_skills: string[];
}

export interface ProposedRole {
  role_title: string;
  is_key_personnel: boolean;
  labor_category: string;
  bill_rate?: number;
  cost_rate?: number;
  summary_for_role?: string;
}

export interface Personnel {
  id: string;
  company_id: string;

  // Identification
  status: 'Active' | 'Available' | 'Committed' | 'Former' | 'Pending';

  // Basic information
  full_name: string;
  email: string;
  phone?: string;
  employment_type: 'W2 Employee' | '1099 Contractor' | 'Subcontractor' | 'Teaming Partner Staff' | 'To Be Hired';
  employer_company?: string;

  // Availability
  availability: string;
  current_assignment?: string;
  geographic_location: string;
  relocation_willing?: boolean;
  remote_capable: boolean;

  // Clearance
  clearance_level?: 'None' | 'Public Trust' | 'Secret' | 'Top Secret' | 'TS/SCI';
  clearance_status?: 'Active' | 'Current' | 'Inactive (within 2 years)' | 'Expired' | 'In Process';
  investigation_date?: string;
  sponsoring_agency?: string;

  // Education
  education: Degree[];

  // Certifications
  certifications?: PersonCertification[];

  // Experience
  total_experience_years: number;
  federal_experience_years?: number;
  relevant_experience_years?: number;

  // Work history
  work_history: WorkPosition[];

  // Proposed roles
  proposed_roles?: ProposedRole[];

  // Resume
  resume_url?: string;
  resume_last_updated?: string;

  created_at: string;
  updated_at: string;
}

// ===== DIFFERENTIATORS & WIN THEMES =====

export interface ValueProposition {
  id: string;
  company_id: string;
  theme: string;
  statement: string;
  proof_points: string[];
  applicable_to: string[];
  created_at: string;
  updated_at: string;
}

export interface Innovation {
  id: string;
  company_id: string;
  name: string;
  description: string;
  evidence: string;
  proprietary: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompetitiveAdvantage {
  id: string;
  company_id: string;
  area: string;
  our_strength: string;
  competitor_weakness?: string; // Optional, internal use only
  ghosting_phrase: string; // Pre-written subtle differentiation language
  created_at: string;
  updated_at: string;
}

// ===== TEMPLATES & BOILERPLATE =====

export interface BoilerplateLibrary {
  id: string;
  company_id: string;
  type: string; // 'company_intro', 'quality_approach', etc.
  variant?: string; // 'short', 'medium', 'long'
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentAsset {
  id: string;
  company_id: string;
  asset_type: string; // 'logo', 'org_chart', etc.
  variant?: string; // 'full_color', 'black_white', etc.
  file_url: string;
  created_at: string;
}

// ===== COMPLETENESS TRACKING =====

export interface CompletenessBreakdown {
  core_information: number; // out of 25
  certifications: number; // out of 10
  capabilities: number; // out of 15
  past_performance: number; // out of 20
  personnel: number; // out of 20
  differentiators: number; // out of 10
  total: number; // out of 100
}

export function calculateCompleteness(
  profile: CompanyProfile,
  certifications: Certification[],
  serviceAreas: ServiceArea[],
  pastPerformance: PastPerformance[],
  personnel: Personnel[],
  valuePropositions: ValueProposition[]
): CompletenessBreakdown {
  let score = {
    core_information: 0,
    certifications: 0,
    capabilities: 0,
    past_performance: 0,
    personnel: 0,
    differentiators: 0,
    total: 0,
  };

  // Core Information (25 points)
  if (profile.company_name) score.core_information += 5;
  if (profile.cage_code && profile.uei_number) score.core_information += 5;
  if (profile.sam_status === 'Active') score.core_information += 5;
  if (profile.elevator_pitch) score.core_information += 5;
  if (profile.proposal_poc && profile.authorized_signer) score.core_information += 5;

  // Certifications (10 points)
  if (certifications.length > 0) score.certifications = 10;

  // Capabilities (15 points)
  if (serviceAreas.length >= 1) score.capabilities += 5;
  if (serviceAreas.length >= 3) score.capabilities += 5;
  if (serviceAreas.length >= 5) score.capabilities += 5;

  // Past Performance (20 points)
  if (pastPerformance.length >= 1) score.past_performance += 5;
  if (pastPerformance.length >= 3) score.past_performance += 10;
  if (pastPerformance.length >= 5) score.past_performance += 5;

  // Personnel (20 points)
  const keyPersonnel = personnel.filter(p =>
    p.proposed_roles?.some(r => r.is_key_personnel)
  );
  if (personnel.length >= 1) score.personnel += 5;
  if (personnel.length >= 5) score.personnel += 5;
  if (keyPersonnel.length >= 3) score.personnel += 10;

  // Differentiators (10 points)
  if (valuePropositions.length >= 3) score.differentiators = 10;

  score.total = Object.values(score).reduce((sum, val) => sum + val, 0) - score.total;

  return score;
}
