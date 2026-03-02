-- Migration: Add extracted_text column to data_call_files
-- Stores PDF text content extracted by the Python PDF service
-- Mirrors the pattern used by solicitation_documents.extracted_text

ALTER TABLE data_call_files ADD COLUMN IF NOT EXISTS extracted_text TEXT;

COMMENT ON COLUMN data_call_files.extracted_text IS 'Text content extracted from uploaded PDFs via the Python PDF extraction service. NULL for non-PDF files or files not yet processed.';
