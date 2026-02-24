-- Multi-Document Solicitation Ingestion Migration
-- Phase 6: Multi-Document Ingestion
-- ADDITIVE migration — creates new tables for solicitation package ingestion.
-- DO NOT drop or modify existing tables.
-- Run this after all prior migrations.
-- Safe to re-run — uses IF NOT EXISTS throughout.

-----------------------------------------------------------
-- TABLE: solicitations
-- Groups uploaded documents by solicitation number.
-- One row per unique (company_id, solicitation_number) pair.
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS solicitations (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  solicitation_number TEXT          NOT NULL,
  title               TEXT,
  agency              TEXT,
  status              TEXT          NOT NULL DEFAULT 'uploading'
                                    CHECK (status IN ('uploading', 'classifying', 'reconciling', 'ready', 'failed')),
  document_count      INTEGER       DEFAULT 0,
  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW(),

  -- Prevent duplicate solicitation packages for the same company
  CONSTRAINT solicitations_company_solicitation_unique UNIQUE (company_id, solicitation_number)
);

COMMENT ON TABLE solicitations IS
  'Solicitation packages — groups of 10-20+ government procurement documents '
  'identified by solicitation number (e.g., W911NF-24-R-0001).';

-----------------------------------------------------------
-- TABLE: solicitation_documents
-- Individual documents belonging to a solicitation package.
-- Stores file metadata, classification results, and extracted text.
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS solicitation_documents (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id          UUID          NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,
  filename                 TEXT          NOT NULL,
  file_path                TEXT          NOT NULL,
  file_size                BIGINT,
  mime_type                TEXT,

  -- Document classification
  document_type            TEXT
                           CHECK (document_type IN (
                             'base_rfp',
                             'soo_sow_pws',
                             'amendment',
                             'qa_response',
                             'pricing_template',
                             'dd254',
                             'clauses',
                             'cdrls',
                             'wage_determination',
                             'provisions',
                             'other_unclassified'
                           )),
  -- Human-readable label for display in UI (e.g., "Base RFP", "SOO/SOW/PWS")
  document_type_label      TEXT,

  -- Only flag low-confidence classifications per user decision —
  -- reduces noise compared to showing high/medium/low on every doc.
  classification_confidence TEXT
                           CHECK (classification_confidence IN ('high', 'medium', 'low')),
  classification_reasoning TEXT,

  -- Amendment-specific metadata
  amendment_number         TEXT,
  effective_date           DATE,
  is_superseded            BOOLEAN       DEFAULT false,
  -- Self-reference: which later document superseded this one
  superseded_by            UUID          REFERENCES solicitation_documents(id) ON DELETE SET NULL,

  -- Extracted content
  extracted_text           TEXT,

  -- Processing pipeline state
  processing_status        TEXT          NOT NULL DEFAULT 'pending'
                           CHECK (processing_status IN (
                             'pending',
                             'extracting',
                             'classified',
                             'reconciled',
                             'failed'
                           )),
  error_message            TEXT,
  sort_order               INTEGER       DEFAULT 0,

  created_at               TIMESTAMPTZ   DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE solicitation_documents IS
  'Individual documents within a solicitation package. '
  'Stores file metadata, AI classification results, extracted text, and processing state.';

-----------------------------------------------------------
-- TABLE: document_reconciliations
-- Tracks changes introduced by amendments and Q&A responses.
-- Enables proposal generation to use the correct/current text.
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS document_reconciliations (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id     UUID          NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,

  -- The amendment or Q&A document that introduced this change
  source_document_id  UUID          NOT NULL REFERENCES solicitation_documents(id) ON DELETE CASCADE,

  -- The base doc or earlier amendment being modified (nullable — some amendments are additive)
  target_document_id  UUID          REFERENCES solicitation_documents(id) ON DELETE SET NULL,

  change_type         TEXT          NOT NULL
                      CHECK (change_type IN (
                        'supersedes_section',
                        'modifies_scope',
                        'modifies_page_limit',
                        'modifies_eval_criteria',
                        'modifies_submission_instructions',
                        'adds_requirement',
                        'removes_requirement',
                        'general_modification'
                      )),

  -- Provenance: whether this change came from an amendment or Q&A response
  source_type         TEXT          NOT NULL
                      CHECK (source_type IN ('amendment', 'qa_response')),

  section_reference   TEXT,
  original_text       TEXT,
  replacement_text    TEXT,

  -- User can restore/undo a reconciliation per user decision
  is_active           BOOLEAN       DEFAULT true,

  created_at          TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE document_reconciliations IS
  'Tracks what text was changed/superseded by amendments and Q&A responses. '
  'Enables proposal AI to use the most current requirements and evaluation criteria.';

-----------------------------------------------------------
-- TABLE: template_field_mappings
-- Fillable fields detected in pricing templates, DD254, etc.
-- Supports auto-fill from company_profiles data.
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS template_field_mappings (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_document_id UUID          NOT NULL REFERENCES solicitation_documents(id) ON DELETE CASCADE,
  field_name               TEXT          NOT NULL,
  field_type               TEXT
                           CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'selection')),
  is_required              BOOLEAN       DEFAULT true,
  section_reference        TEXT,

  -- Where this field value might come from in the company data model
  -- e.g., "company_profiles.legal_name", "company_profiles.cage_code"
  auto_fill_source         TEXT,
  auto_fill_value          TEXT,

  -- 'action_required' = user must fill this; 'reference_only' = display only
  -- Per user decision: reduces noise by distinguishing critical from informational fields.
  tag                      TEXT          DEFAULT 'action_required'
                           CHECK (tag IN ('action_required', 'reference_only')),

  created_at               TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE template_field_mappings IS
  'Fillable fields detected in solicitation documents (pricing templates, DD254, etc.). '
  'Tracks auto-fill source from company_profiles and action_required vs reference_only tags.';

-----------------------------------------------------------
-- INDEXES
-----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_solicitations_company_id
  ON solicitations(company_id);

CREATE INDEX IF NOT EXISTS idx_solicitations_solicitation_number
  ON solicitations(solicitation_number);

CREATE INDEX IF NOT EXISTS idx_solicitation_documents_solicitation_id
  ON solicitation_documents(solicitation_id);

CREATE INDEX IF NOT EXISTS idx_solicitation_documents_document_type
  ON solicitation_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_solicitation_documents_processing_status
  ON solicitation_documents(processing_status);

CREATE INDEX IF NOT EXISTS idx_document_reconciliations_solicitation_id
  ON document_reconciliations(solicitation_id);

CREATE INDEX IF NOT EXISTS idx_document_reconciliations_source_document_id
  ON document_reconciliations(source_document_id);

CREATE INDEX IF NOT EXISTS idx_template_field_mappings_solicitation_document_id
  ON template_field_mappings(solicitation_document_id);

-----------------------------------------------------------
-- ROW LEVEL SECURITY
-----------------------------------------------------------

-- Enable RLS on all new tables
ALTER TABLE solicitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_field_mappings ENABLE ROW LEVEL SECURITY;

-- solicitations: authenticated users can read/write their own company's data
CREATE POLICY IF NOT EXISTS solicitations_authenticated_policy
  ON solicitations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- solicitation_documents: authenticated users access via parent solicitation
CREATE POLICY IF NOT EXISTS solicitation_documents_authenticated_policy
  ON solicitation_documents
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- document_reconciliations: authenticated users access via parent solicitation
CREATE POLICY IF NOT EXISTS document_reconciliations_authenticated_policy
  ON document_reconciliations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- template_field_mappings: authenticated users access via parent document
CREATE POLICY IF NOT EXISTS template_field_mappings_authenticated_policy
  ON template_field_mappings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
