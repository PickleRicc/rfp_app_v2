// Solicitation Ingestion Types
// Phase 6: Multi-Document Ingestion
// Types mirror supabase-solicitation-ingestion-migration.sql exactly.
// All downstream plans (06-02 through 06-04) import from this file.

// ===== ENUMERATIONS =====

/** Status of a solicitation package through the ingestion pipeline */
export type SolicitationStatus =
  | 'uploading'
  | 'classifying'
  | 'reconciling'
  | 'ready'
  | 'failed';

/**
 * Government solicitation document type taxonomy.
 * Covers a full solicitation package as issued by federal agencies.
 * See DOCUMENT_TYPE_LABELS for human-readable display strings.
 */
export type SolicitationDocumentType =
  | 'base_rfp'
  | 'soo_sow_pws'
  | 'amendment'
  | 'qa_response'
  | 'pricing_template'
  | 'dd254'
  | 'clauses'
  | 'cdrls'
  | 'wage_determination'
  | 'provisions'
  | 'other_unclassified';

/** Human-readable labels for each document type (used in UI classification table badges) */
export const DOCUMENT_TYPE_LABELS: Record<SolicitationDocumentType, string> = {
  base_rfp: 'Base Solicitation',
  soo_sow_pws: 'SOO/SOW/PWS',
  amendment: 'Amendment',
  qa_response: 'Q&A Response',
  pricing_template: 'Pricing Template',
  dd254: 'DD254',
  clauses: 'Clauses',
  cdrls: 'CDRLs',
  wage_determination: 'Wage Determination',
  provisions: 'Provisions',
  other_unclassified: 'Other/Unclassified',
};

/**
 * Tailwind CSS badge color classes for each document type.
 * Used in the classification table to visually distinguish document types.
 */
export const DOCUMENT_TYPE_COLORS: Record<SolicitationDocumentType, string> = {
  base_rfp: 'bg-blue-100 text-blue-800',
  soo_sow_pws: 'bg-purple-100 text-purple-800',
  amendment: 'bg-amber-100 text-amber-800',
  qa_response: 'bg-green-100 text-green-800',
  pricing_template: 'bg-rose-100 text-rose-800',
  dd254: 'bg-slate-100 text-slate-800',
  clauses: 'bg-gray-100 text-gray-800',
  cdrls: 'bg-indigo-100 text-indigo-800',
  wage_determination: 'bg-orange-100 text-orange-800',
  provisions: 'bg-teal-100 text-teal-800',
  other_unclassified: 'bg-neutral-100 text-neutral-600',
};

/**
 * AI classification confidence level for a document.
 * Only 'low' confidence is flagged to the user per user decision — reduces noise
 * by not surfacing high/medium confidence results as warnings.
 */
export type ClassificationConfidence = 'high' | 'medium' | 'low';

/** Processing pipeline state for a single document */
export type DocumentProcessingStatus =
  | 'pending'
  | 'extracting'
  | 'classified'
  | 'reconciled'
  | 'failed';

/**
 * Type of change recorded in a document reconciliation.
 * Describes what an amendment or Q&A response modified in the solicitation.
 */
export type ReconciliationChangeType =
  | 'supersedes_section'
  | 'modifies_scope'
  | 'modifies_page_limit'
  | 'modifies_eval_criteria'
  | 'modifies_submission_instructions'
  | 'adds_requirement'
  | 'removes_requirement'
  | 'general_modification';

/**
 * Provenance of a document reconciliation.
 * Distinguishes between formal amendments and informal Q&A clarifications.
 */
export type ReconciliationSourceType = 'amendment' | 'qa_response';

/** Field type for fillable template form fields */
export type TemplateFieldType = 'text' | 'number' | 'date' | 'boolean' | 'selection';

/**
 * Action tag for a template field mapping.
 * 'action_required' = user must fill this; 'reference_only' = display/context only.
 * Per user decision: keeps the action list focused on what actually needs doing.
 */
export type TemplateFieldTag = 'action_required' | 'reference_only';

// ===== INTERFACES =====

/**
 * A solicitation package — a grouping of procurement documents
 * identified by solicitation number (e.g., "W911NF-24-R-0001").
 *
 * One solicitation groups all related documents: the base RFP, SOW, amendments,
 * Q&A responses, pricing templates, and supporting attachments.
 *
 * Maps to: solicitations table
 */
export interface Solicitation {
  id: string;
  company_id: string;

  /** Government solicitation identifier (e.g., "W911NF-24-R-0001") */
  solicitation_number: string;

  /** Human-readable title for the procurement */
  title?: string;

  /** Issuing agency name (e.g., "Army Research Laboratory") */
  agency?: string;

  /** Current pipeline status of the solicitation package */
  status: SolicitationStatus;

  /** Number of documents in the package */
  document_count: number;

  created_at: string;
  updated_at: string;
}

/**
 * An individual document within a solicitation package.
 *
 * Tracks file metadata, AI classification results (document_type, confidence),
 * extracted text, amendment lineage (is_superseded, superseded_by),
 * and processing pipeline state.
 *
 * Maps to: solicitation_documents table
 */
export interface SolicitationDocument {
  id: string;
  solicitation_id: string;

  // File metadata
  filename: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;

  // Classification results
  document_type?: SolicitationDocumentType;

  /** Human-readable label for the document type, derived from DOCUMENT_TYPE_LABELS */
  document_type_label?: string;

  /** AI confidence in the document_type assignment */
  classification_confidence?: ClassificationConfidence;

  /** AI reasoning for the classification (for review/audit) */
  classification_reasoning?: string;

  // Amendment-specific fields
  /** Amendment identifier (e.g., "Amendment 0001") — only set for amendment docs */
  amendment_number?: string;

  /** Date the document was officially issued */
  effective_date?: string;

  /** True if a later amendment supersedes this document's content */
  is_superseded: boolean;

  /** ID of the document that superseded this one (self-referencing FK) */
  superseded_by?: string;

  /** Full extracted text from the file */
  extracted_text?: string;

  /** Current processing pipeline state */
  processing_status: DocumentProcessingStatus;

  /** Error details if processing_status is 'failed' */
  error_message?: string;

  /** Display order within the solicitation document list */
  sort_order: number;

  created_at: string;
  updated_at: string;
}

/**
 * A change record tracking what was modified by an amendment or Q&A response.
 *
 * Enables proposal generation to use current/correct requirements rather than
 * base RFP text that has since been superseded. Users can deactivate a
 * reconciliation (is_active = false) to restore original text.
 *
 * Maps to: document_reconciliations table
 */
export interface DocumentReconciliation {
  id: string;
  solicitation_id: string;

  /** The amendment or Q&A document that introduced this change */
  source_document_id: string;

  /** The base document or earlier amendment being modified (null for additive changes) */
  target_document_id?: string;

  /** What category of change was made */
  change_type: ReconciliationChangeType;

  /** Whether the change came from an amendment or a Q&A response */
  source_type: ReconciliationSourceType;

  /** Reference to the specific section being modified (e.g., "Section L.4.2", "Question 15") */
  section_reference?: string;

  /** The original text that was superseded */
  original_text?: string;

  /** The replacement text from the amendment or Q&A */
  replacement_text?: string;

  /**
   * Whether this reconciliation is active.
   * Users can set is_active = false to restore the original text.
   */
  is_active: boolean;

  created_at: string;
}

/**
 * A fillable field detected in a solicitation document (pricing templates, DD254, etc.).
 *
 * Tracks where the field value might come from in the company data model
 * (auto_fill_source) and whether it requires user action or is reference-only.
 *
 * Maps to: template_field_mappings table
 */
export interface TemplateFieldMapping {
  id: string;
  solicitation_document_id: string;

  /** Field label or name as it appears in the document */
  field_name: string;

  /** Data type of the field */
  field_type?: TemplateFieldType;

  /** Whether the field must be completed for proposal submission */
  is_required: boolean;

  /** Section reference in the document (e.g., "Block 9", "Line Item 3") */
  section_reference?: string;

  /**
   * Where to auto-populate this field from in the company data.
   * Dot-notation path, e.g., "company_profiles.legal_name", "company_profiles.cage_code"
   */
  auto_fill_source?: string;

  /** Suggested pre-fill value derived from auto_fill_source */
  auto_fill_value?: string;

  /** Whether this field needs user action or is for reference only */
  tag: TemplateFieldTag;

  created_at: string;
}

// ===== CONVENIENCE TYPES =====

/**
 * Solicitation with its documents joined — returned by GET /api/solicitations/[id]
 */
export interface SolicitationWithDocuments extends Solicitation {
  documents: SolicitationDocument[];
}

/**
 * Request body for creating a new solicitation
 * POST /api/solicitations
 */
export interface CreateSolicitationRequest {
  solicitation_number: string;
  title?: string;
  agency?: string;
}

/**
 * Request body for updating a solicitation
 * PATCH /api/solicitations/[id]
 */
export interface UpdateSolicitationRequest {
  title?: string;
  agency?: string;
  status?: SolicitationStatus;
}
