-- Migration: Add client_status to documents for staff-driven portal display
-- Staff set this manually; clients only see this status (not real-time pipeline state).

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS client_status TEXT;

COMMENT ON COLUMN documents.client_status IS 'Staff-set status shown to the client in the portal (e.g. Submitted, Under review, Complete). Not the internal pipeline status.';
