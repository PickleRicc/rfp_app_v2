-- Migration: Add solicitation_number to documents table
-- Purpose: Store RFP/solicitation number for use in proposal headers
-- Date: 2026-02-02

-- Add solicitation_number column to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS solicitation_number TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN documents.solicitation_number IS 'Solicitation/RFP number extracted from document, displayed in proposal headers';
