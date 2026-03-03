// Tier 2 Data Call Types
// Phase 8: Tier 2 Dynamic Data Call
// Types mirror supabase-tier2-data-call-migration.sql exactly.
// Used by the data call generator (lib/ingestion/data-call-generator.ts),
// the data call API (app/api/solicitations/[id]/data-call/route.ts),
// and the data call UI components (Plans 02 and 03).

// ===== ENUMERATIONS =====

/**
 * The completion state of a Tier 2 data call response.
 * 'in_progress' allows partial saves without validation.
 * 'completed' marks the response ready for proposal generation.
 */
export type DataCallStatus = 'in_progress' | 'completed';

/**
 * The three sections that support file uploads in the data call form.
 * Matches the section CHECK constraint in data_call_files table.
 */
export type DataCallFileSection =
  | 'past_performance'
  | 'key_personnel'
  | 'compliance_verification';

// ===== DISPLAY CONSTANTS =====

/**
 * Human-readable labels for each data call section.
 * Used in the accordion UI to label collapsible panels.
 */
export const DATA_CALL_SECTION_LABELS: Record<string, string> = {
  opportunity_details:      'Opportunity Details',
  past_performance:         'Past Performance',
  key_personnel:            'Key Personnel',
  technical_approach:       'Technical Approach',
  compliance_verification:  'Compliance Verification',
  service_area_approaches:  'Service Area Approaches',
  site_staffing:            'Site Staffing Plan',
  technology_selections:    'Technology Selections',
};

/**
 * Lucide icon names for each data call section (for UI reference).
 * These strings map to Lucide React component names used in the data call dashboard.
 */
export const DATA_CALL_SECTION_ICONS: Record<string, string> = {
  opportunity_details:      'Briefcase',
  past_performance:         'Trophy',
  key_personnel:            'Users',
  technical_approach:       'Lightbulb',
  compliance_verification:  'ShieldCheck',
  service_area_approaches:  'Layers',
  site_staffing:            'MapPin',
  technology_selections:    'Cpu',
};

// ===== SECTION DATA INTERFACES =====

/**
 * Opportunity details for the data call response.
 * Captures the competitive context: who is bidding, as what role, under what set-aside.
 * Stored in data_call_responses.opportunity_details JSONB.
 */
export interface OpportunityDetails {
  /** Whether the company is bidding as prime, sub, or in a teaming arrangement */
  prime_or_sub: 'prime' | 'sub' | 'teaming' | null;

  /** Names of teaming partners (empty array when not teaming) */
  teaming_partners: string[];

  /** Contract type (e.g., "FFP", "CPFF", "T&M") — pre-filled from admin_data extraction */
  contract_type: string | null;

  /** NAICS code for the procurement — pre-filled from admin_data extraction */
  naics_code: string | null;

  /** Size standard threshold (e.g., "$47M") — pre-filled from admin_data extraction */
  size_standard: string | null;

  /** Set-aside designation (e.g., "SDVOSB", "8(a)") — pre-filled from admin_data extraction */
  set_aside: string | null;
}

/**
 * A single past performance reference entry.
 * Each entry documents one prior contract relevant to the RFP.
 * Stored as items in data_call_responses.past_performance JSONB array.
 */
export interface PastPerformanceRef {
  /** Name of the project or program */
  project_name: string;

  /** Government or commercial agency that awarded the contract */
  client_agency: string;

  /** Official contract number (e.g., "W911NF-21-C-0001") */
  contract_number: string;

  /** Total contract value (e.g., "$2.4M") */
  contract_value: string;

  /** Period of performance (e.g., "Jan 2021 — Dec 2023") */
  period_of_performance: string;

  /** Brief summary of how this reference is relevant to the current RFP */
  relevance_summary: string;

  /** Name of the government Contracting Officer Representative or point of contact */
  contact_name: string;

  /** Email address for the reference contact */
  contact_email: string;

  /** Phone number for the reference contact */
  contact_phone: string;
}

/**
 * A single key personnel entry.
 * Each entry captures one named individual required by the RFP.
 * file_id references point to data_call_files.id records.
 * Stored as items in data_call_responses.key_personnel JSONB array.
 */
export interface KeyPersonnelEntry {
  /** Required role/position (e.g., "Program Manager", "Senior Software Engineer") */
  role: string;

  /** Full name of the proposed individual */
  name: string;

  /** Summary of qualifications, education, and relevant experience */
  qualifications_summary: string;

  /** data_call_files.id for the uploaded resume (null if not yet uploaded) */
  resume_file_id: string | null;

  /** data_call_files.id values for any uploaded certification documents */
  certifications_file_ids: string[];

  /** data_call_files.id for the Letter of Commitment (null if not required or not yet uploaded) */
  loc_file_id: string | null;
}

/**
 * Technical approach narrative for the proposal.
 * Captures the offeror's strategy for executing the statement of work.
 * Stored in data_call_responses.technical_approach JSONB.
 */
export interface TechnicalApproach {
  /** High-level narrative describing how the company will perform the work */
  approach_summary: string;

  /** Tools, platforms, frameworks, and methodologies to be used */
  tools_and_platforms: string;

  /** Staffing model: team structure, labor mix, subcontractors */
  staffing_model: string;

  /** Key assumptions underlying the technical approach */
  assumptions: string;

  /** Identified risks and proposed mitigations */
  risks: string;
}

/**
 * Compliance verification data for the proposal package.
 * Captures certifications, clearances, and required attachments.
 * Stored in data_call_responses.compliance_verification JSONB.
 */
export interface ComplianceVerification {
  /**
   * Organizational certifications as boolean toggles.
   * Keys are certification names (e.g., "ISO 9001", "CMMI Level 3").
   * Values indicate whether the company holds the certification.
   */
  org_certifications: Record<string, boolean>;

  /** Individual certifications held by proposed personnel */
  individual_certifications: string[];

  /** Whether facility clearance has been confirmed (null = N/A for this RFP) */
  facility_clearance_confirmed: boolean | null;

  /** NIST SP 800-171 SPRS score (e.g., "82/110") */
  nist_800_171_score: string;

  /**
   * Required attachments from Section L.
   * Keys are attachment names (e.g., "SF330", "DD2345").
   * Values are data_call_files.id references (null = not yet uploaded).
   */
  required_attachments: Record<string, string | null>;
}

// ===== NEW TIER 2 SECTION INTERFACES (v2) =====

/**
 * Per-service-area approach entry for IT operations / multi-service-area contracts.
 * Dynamically generated from SOW/PWS extraction service_area_index.
 * Stored as items in data_call_responses.service_area_approaches JSONB array.
 */
export interface ServiceAreaApproach {
  /** Section code from the SOW/PWS (e.g., "3.2.1") */
  area_code: string;

  /** Service area name (e.g., "Service Desk") */
  area_name: string;

  /** How the company will deliver this service area */
  approach_narrative: string;

  /** Tools and platforms the company will use for this area */
  proposed_tools: string;

  /** FTEs, roles, and staffing model for this area */
  proposed_staffing: string;

  /** What makes the company's approach better for this area */
  key_differentiator: string;
}

/**
 * Per-site staffing plan for multi-site contracts.
 * Dynamically generated from operational_context extraction sites.
 * Stored as items in data_call_responses.site_staffing JSONB array.
 */
export interface SiteStaffingPlan {
  /** Site name (e.g., "Adelphi Lab Center (ALC)") */
  site_name: string;

  /** Site location (e.g., "Adelphi, Maryland") */
  location: string;

  /** Proposed FTE count for this site (e.g., "25 FTEs") */
  proposed_fte_count: string;

  /** Key roles assigned to this site */
  key_roles: string;

  /** Special requirements for this site (clearance, on-site days, etc.) */
  special_requirements: string;
}

/**
 * Per-technology selection for contracts requiring specific platforms.
 * Dynamically generated from technology_reqs extraction.
 * Stored as items in data_call_responses.technology_selections JSONB array.
 */
export interface TechnologySelection {
  /** Technology name (e.g., "ServiceNow") */
  technology_name: string;

  /** Company's experience with this technology */
  company_experience: string;

  /** How the company will use this technology on the contract */
  proposed_usage: string;

  /** Relevant certifications held by company personnel */
  certifications_held: string;
}

// ===== FORM SCHEMA INTERFACES =====

/**
 * Validation rules attached to a DataCallFormField.
 * Applied during data call completion validation and the pre-draft gate.
 * Enables structured enforcement of numeric thresholds, date ranges,
 * pattern matching, and cross-field comparisons.
 */
export interface DataCallFieldValidation {
  /** Minimum numeric value (inclusive). For type: 'number' fields. */
  min?: number;

  /** Maximum numeric value (inclusive). For type: 'number' fields. */
  max?: number;

  /**
   * List of acceptable values for select-type fields.
   * When set, the submitted value must be one of these options.
   * Used to enforce clearance level meets RFP requirement.
   */
  allowed_values?: string[];

  /** Regex pattern the value must match (e.g., "^\\d+(/\\d+)?$" for SPRS score format) */
  pattern?: string;

  /** Human-readable description of what the validation expects (shown in error messages) */
  validation_hint?: string;

  /**
   * ISO date string — the field value (a date) must be on or after this date.
   * Used for past performance recency validation: end_date must be >= cutoff.
   */
  recency_cutoff_date?: string;

  /**
   * Human-readable description of the recency requirement.
   * e.g., "Within 3 years of solicitation date"
   */
  recency_description?: string;
}

/**
 * A single field definition within a data call form section.
 * Drives rendering logic in the accordion form UI.
 * Each field has an RFP source citation so users understand why it exists.
 */
export interface DataCallFormField {
  /** Machine-readable unique key for the field (e.g., 'prime_or_sub', 'project_name_0') */
  key: string;

  /** Human-readable field label displayed in the form */
  label: string;

  /** Input type determining which UI control to render */
  type: 'text' | 'textarea' | 'select' | 'number' | 'boolean' | 'file';

  /** Whether the user must provide a value before marking the section complete */
  required: boolean;

  /**
   * When true, this field is a compliance-critical blocking input.
   * The data call cannot be completed and drafts cannot be generated
   * until all blocking fields have confirmed, validated values.
   *
   * Blocking fields are visually distinguished in the UI with a red
   * compliance badge and are listed in the pre-draft compliance summary.
   *
   * Examples: facility clearance level, SPRS score, DoD 8570 certs,
   * past performance recency dates, backup personnel names.
   */
  blocking?: boolean;

  /**
   * Structured validation rules for the field value.
   * Applied during "Complete Data Call" and the pre-draft compliance gate.
   * When validation fails, the field shows a specific error message
   * derived from validation_hint or computed from the rule.
   */
  validation?: DataCallFieldValidation;

  /**
   * RFP source citation explaining why this field exists.
   * Short reference string like "Per Section L.4.2" or "Per Section M.3".
   * null when no specific citation is available from extraction.
   */
  rfp_citation: string | null;

  /** Options array for 'select' type fields */
  options?: string[];

  /** Default value to pre-fill the field (from extraction results) */
  default_value?: unknown;

  /** Placeholder text shown when field is empty */
  placeholder?: string;
}

/**
 * A collapsible section within the data call form.
 * Corresponds to one of the five Tier 2 intake categories.
 * Sections with dynamic content (past performance, key personnel) include
 * a count and source reference so users understand the RFP-driven cardinality.
 */
export interface DataCallSection {
  /** Machine-readable section identifier (e.g., 'opportunity_details', 'past_performance') */
  id: string;

  /** Human-readable section title displayed in the accordion header */
  title: string;

  /** Section description shown below the header — includes RFP context and requirements summary */
  description: string;

  /** Fields within this section */
  fields: DataCallFormField[];

  /**
   * For dynamic sections: the number of repeating entries required.
   * - past_performance: number of reference cards to show
   * - key_personnel: number of personnel cards to show
   * - undefined for static sections (opportunity_details, technical_approach, compliance_verification)
   */
  dynamic_count?: number;

  /**
   * Human-readable source explaining where dynamic_count came from.
   * e.g., "Per Section L.4.3: 3 past performance references required"
   */
  dynamic_count_source?: string;
}

/**
 * The full generated form schema for a solicitation's data call.
 * Generated from compliance_extractions by data-call-generator.ts.
 * Cached in data_call_responses.form_schema for fast reload.
 */
export interface DataCallFormSchema {
  /** The solicitation this schema was generated for */
  solicitation_id: string;

  /** ISO timestamp of when the schema was generated */
  generated_at: string;

  /** The five data call sections in display order */
  sections: DataCallSection[];
}

// ===== DATABASE TABLE INTERFACES =====

/**
 * A Tier 2 data call response record.
 * One row per solicitation + company combination.
 * Maps to the data_call_responses table.
 *
 * Each section column stores structured JSONB matching the
 * OpportunityDetails, PastPerformanceRef[], KeyPersonnelEntry[],
 * TechnicalApproach, and ComplianceVerification interfaces.
 */
export interface DataCallResponse {
  id: string;
  solicitation_id: string;
  company_id: string;

  /** Current completion state */
  status: DataCallStatus;

  /** Opportunity details section data */
  opportunity_details: OpportunityDetails;

  /** Array of past performance reference entries */
  past_performance: PastPerformanceRef[];

  /** Array of key personnel entries */
  key_personnel: KeyPersonnelEntry[];

  /** Technical approach section data */
  technical_approach: TechnicalApproach;

  /** Compliance verification section data */
  compliance_verification: ComplianceVerification;

  /** Per-service-area approach entries (v2) */
  service_area_approaches: ServiceAreaApproach[];

  /** Per-site staffing plan entries (v2) */
  site_staffing: SiteStaffingPlan[];

  /** Per-technology selection entries (v2) */
  technology_selections: TechnologySelection[];

  /**
   * Cached form schema — generated from compliance_extractions.
   * null until the data call has been loaded at least once.
   */
  form_schema: DataCallFormSchema | null;

  /** Set when status transitions to 'completed' */
  completed_at: string | null;

  created_at: string;
  updated_at: string;
}

/**
 * An uploaded file associated with a specific data call response field.
 * One row per uploaded file.
 * Maps to the data_call_files table.
 */
export interface DataCallFile {
  id: string;

  /** The data call response this file belongs to */
  data_call_response_id: string;

  /** Which data call section this file is attached to */
  section: DataCallFileSection;

  /**
   * Which specific field within the section this file belongs to.
   * Convention: {entity}_{index}_{type}
   * Examples: 'personnel_0_resume', 'personnel_1_loc', 'org_cert_iso', 'attachment_sf330'
   */
  field_key: string;

  /** Original filename as uploaded by the user */
  filename: string;

  /** Supabase storage path: {company_id}/{solicitation_id}/{section}/{field_key}/{filename} */
  file_path: string;

  /** File size in bytes */
  file_size: number | null;

  /** MIME type (e.g., 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') */
  mime_type: string | null;

  /** Text content extracted from uploaded PDFs via the Python PDF extraction service */
  extracted_text: string | null;

  created_at: string;
}

// ===== CONVENIENCE TYPES =====

/**
 * The full response shape returned by GET /api/solicitations/[id]/data-call.
 * Bundles schema, saved response data, and uploaded files in a single fetch.
 */
export interface DataCallGetResponse {
  /** RFP-specific form schema derived from compliance extractions */
  schema: DataCallFormSchema;

  /** Existing saved data call response (null if no save has occurred yet) */
  response: DataCallResponse | null;

  /** Files uploaded for this data call response */
  files: DataCallFile[];
}

/**
 * Request body for PUT /api/solicitations/[id]/data-call.
 * All fields are optional — supports partial saves per phase decision.
 */
export interface DataCallSaveRequest {
  opportunity_details?: Partial<OpportunityDetails>;
  past_performance?: PastPerformanceRef[];
  key_personnel?: KeyPersonnelEntry[];
  technical_approach?: Partial<TechnicalApproach>;
  compliance_verification?: Partial<ComplianceVerification>;
  service_area_approaches?: ServiceAreaApproach[];
  site_staffing?: SiteStaffingPlan[];
  technology_selections?: TechnologySelection[];
  status?: DataCallStatus;
}

/**
 * Request body for POST /api/solicitations/[id]/data-call/upload.
 * Sent as multipart/form-data with the file plus section and field_key metadata.
 */
export interface DataCallUploadRequest {
  /** The uploaded file (PDF, DOCX, DOC, PNG, JPG, JPEG) */
  file: File;

  /** Which section the file belongs to */
  section: DataCallFileSection;

  /**
   * Which specific field within the section this file is for.
   * e.g., 'personnel_0_resume', 'org_cert_iso'
   */
  field_key: string;
}
