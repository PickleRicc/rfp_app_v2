// Compliance Extraction Types
// Phase 7: Compliance Extraction
// Types mirror supabase-compliance-extraction-migration.sql exactly.
// Used by the extraction engine (lib/ingestion/compliance-extractor.ts),
// the Inngest pipeline (lib/inngest/functions/solicitation-compliance-extractor.ts),
// and the compliance API (app/api/solicitations/[id]/compliance/route.ts).

// ===== ENUMERATIONS =====

/**
 * The four extraction categories for government solicitation compliance analysis.
 * Each category corresponds to a distinct section of the solicitation package.
 */
export type ExtractionCategory =
  | 'section_l'    // Instructions to Offerors — volumes, page limits, formatting
  | 'section_m'    // Evaluation Criteria — factors, subfactors, methodology
  | 'admin_data'   // Administrative — NAICS, size standard, set-aside, PoP, CLINs
  | 'rating_scales'; // Rating scales and factor weightings

/**
 * AI confidence level for an extracted value.
 * 'high' = Claude explicitly found the data; 'medium' = inferred; 'low' = uncertain or partial.
 */
export type ExtractionConfidence = 'high' | 'medium' | 'low';

/**
 * Processing pipeline state for a single compliance extraction field.
 * Matches the extraction_status CHECK constraint in compliance_extractions table.
 */
export type ExtractionStatus = 'pending' | 'extracting' | 'completed' | 'failed';

// ===== DISPLAY CONSTANTS =====

/**
 * Human-readable section labels for each extraction category.
 * Used in the compliance review UI to label grouped results.
 */
export const EXTRACTION_CATEGORY_LABELS: Record<ExtractionCategory, string> = {
  section_l:     'Section L — Instructions to Offerors',
  section_m:     'Section M — Evaluation Criteria',
  admin_data:    'Administrative Data',
  rating_scales: 'Rating Scales & Weightings',
};

/**
 * Lucide icon names for each extraction category (for UI reference).
 * These strings map to Lucide React component names used in the compliance dashboard.
 */
export const EXTRACTION_CATEGORY_ICONS: Record<ExtractionCategory, string> = {
  section_l:     'ClipboardList',
  section_m:     'Scale',
  admin_data:    'Building2',
  rating_scales: 'BarChart3',
};

/**
 * Tailwind CSS border/background classes for each confidence level.
 * Matches the classification confidence color pattern from Phase 6.
 */
export const CONFIDENCE_COLORS: Record<ExtractionConfidence, string> = {
  high:   'border-green-200 bg-green-50',
  medium: 'border-amber-200 bg-amber-50',
  low:    'border-red-200 bg-red-50',
};

// ===== CORE INTERFACE =====

/**
 * A single extracted compliance data point.
 * Maps to the compliance_extractions table.
 *
 * Each row is one field (e.g., "volume_structure") extracted from a solicitation,
 * with its JSON value, confidence score, and optional user override tracking.
 */
export interface ComplianceExtraction {
  id: string;
  solicitation_id: string;

  /** The document this extraction came from (null if synthesized across multiple docs) */
  source_document_id?: string | null;

  /** Which of the 4 extraction categories this field belongs to */
  category: ExtractionCategory;

  /** Machine-readable field identifier (e.g., "volume_structure", "naics_code") */
  field_name: string;

  /** Human-readable field label (e.g., "Volume Structure", "NAICS Code") */
  field_label: string;

  /** The extracted value — can be string, number, array, or nested object */
  field_value?: unknown;

  /** AI confidence in the extracted value */
  confidence: ExtractionConfidence;

  /** True if the user has manually overridden the AI-extracted value */
  is_user_override: boolean;

  /** Original AI-extracted value before user override (for revert functionality) */
  original_ai_value?: unknown;

  /** ID of the amendment document that changed this extraction (if applicable) */
  amendment_source_id?: string | null;

  /** Note explaining why this extraction was updated (e.g., "Updated from Amendment 0003") */
  amendment_note?: string | null;

  /** Current pipeline state for this extraction field */
  extraction_status: ExtractionStatus;

  /** Error details if extraction_status is 'failed' */
  error_message?: string | null;

  created_at: string;
  updated_at: string;
}

/**
 * Compliance extractions grouped by category — the shape returned by the GET API.
 * Each key maps to the list of extracted fields for that category.
 */
export type ComplianceExtractionsByCategory = Record<ExtractionCategory, ComplianceExtraction[]>;

// ===== TYPED FIELD VALUE STRUCTURES =====
// These interfaces describe the shape of field_value JSONB for each extraction category.
// Used by the extraction engine to type-check response parsing.

/**
 * Typed structure for Section L extraction field values.
 * Section L defines how offerors must structure and format their proposals.
 */
export interface SectionLFields {
  /** Proposal volume structure extracted from Section L */
  volume_structure?: {
    volumes: Array<{
      name: string;
      page_limit?: number | null;
      format_rules?: string | null;
    }>;
  };

  /** Required attachments that must be included with the proposal */
  required_attachments?: string[];

  /** Required forms and certifications to be submitted */
  required_forms?: string[];

  /** Document formatting requirements (font, size, margins, spacing) */
  formatting_rules?: {
    font?: string | null;
    font_size?: string | null;
    margins?: string | null;
    spacing?: string | null;
    other_rules?: string[] | null;
  };
}

/**
 * Typed structure for Section M extraction field values.
 * Section M defines how proposals will be evaluated by the government.
 */
export interface SectionMFields {
  /** Evaluation factors and subfactors with weight descriptions */
  evaluation_factors?: Array<{
    name: string;
    weight_description?: string | null;
    subfactors?: Array<{
      name: string;
      description?: string | null;
    }>;
  }>;

  /** Evaluation methodology used by the government */
  evaluation_methodology?: 'LPTA' | 'best_value' | 'tradeoff' | 'other';

  /** Experience thresholds required for proposal qualification */
  experience_thresholds?: string[];

  /** Key personnel requirements from Section L/M */
  key_personnel_requirements?: Array<{
    role: string;
    qualifications?: string | null;
  }>;
}

/**
 * Typed structure for administrative data extraction field values.
 * Covers solicitation administrative and contract-type metadata.
 */
export interface AdminDataFields {
  /** NAICS code for the procurement */
  naics_code?: string;

  /** Size standard threshold (e.g., "$47M", "500 employees") */
  size_standard?: string;

  /** Set-aside designation (e.g., "SDVOSB", "8(a)", "Full & Open") */
  set_aside_designation?: string;

  /** Contract type (e.g., "FFP", "CPFF", "CPIF", "T&M") */
  contract_type?: string;

  /** Period of performance description */
  period_of_performance?: string;

  /** CLIN (Contract Line Item Number) structure */
  clin_structure?: Array<{
    clin_number: string;
    description: string;
    type?: string | null;
  }>;
}

/**
 * Typed structure for rating scales and factor weightings extraction.
 * Captures how the government will score proposals against each factor.
 */
export interface RatingScaleFields {
  /** Rating scale definitions per evaluation factor */
  rating_scales?: Array<{
    factor_name: string;
    scale: Array<{
      rating: string;
      description: string;
    }>;
  }>;

  /** Relative importance and weighting descriptions per factor */
  factor_weightings?: Array<{
    factor_name: string;
    weight_description?: string | null;
    relative_importance?: string | null;
  }>;
}
