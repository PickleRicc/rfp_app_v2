-- Phase 4: Pipeline & Output - Database Migration
-- Run this in your Supabase SQL Editor
-- Adds support for page tracking, PDF generation, and proposal status

-----------------------------------------------------------
-- PART 1: UPDATE DOCUMENTS STATUS CONSTRAINT
-----------------------------------------------------------

-- Drop existing constraint and add new one with additional statuses
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'generating_proposal', 'proposal_ready'));

-----------------------------------------------------------
-- PART 2: ADD PAGE TRACKING TO RFP_RESPONSES
-----------------------------------------------------------

-- Add page allocation tracking (stores per-volume page counts and status)
ALTER TABLE rfp_responses
  ADD COLUMN IF NOT EXISTS page_allocation JSONB DEFAULT NULL;

-- Add outline data for structure review
ALTER TABLE rfp_responses
  ADD COLUMN IF NOT EXISTS outline JSONB DEFAULT NULL;

-----------------------------------------------------------
-- PART 3: ADD PDF SUPPORT TO PROPOSAL_VOLUMES
-----------------------------------------------------------

-- Add PDF URL column for pre-generated PDFs
ALTER TABLE proposal_volumes
  ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Add PDF error tracking (when conversion fails)
ALTER TABLE proposal_volumes
  ADD COLUMN IF NOT EXISTS pdf_error TEXT;

-----------------------------------------------------------
-- PART 4: PROCESSING_LOGS STATUS UPDATE
-----------------------------------------------------------

-- Add 'warning' status for validation issues
ALTER TABLE processing_logs DROP CONSTRAINT IF EXISTS processing_logs_status_check;
ALTER TABLE processing_logs ADD CONSTRAINT processing_logs_status_check
  CHECK (status IN ('started', 'completed', 'failed', 'warning'));

-----------------------------------------------------------
-- VERIFICATION QUERIES (optional - run to confirm)
-----------------------------------------------------------

-- Check documents status constraint:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'documents_status_check';

-- Check rfp_responses columns:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'rfp_responses' AND column_name IN ('page_allocation', 'outline');

-- Check proposal_volumes columns:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'proposal_volumes' AND column_name IN ('pdf_url', 'pdf_error');
