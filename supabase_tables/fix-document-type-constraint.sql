-- Fix: Add 'company_data' document type to opportunity_documents constraint
-- This script updates the document_type check constraint to allow company data uploads

ALTER TABLE opportunity_documents DROP CONSTRAINT opportunity_documents_document_type_check;
ALTER TABLE opportunity_documents ADD CONSTRAINT opportunity_documents_document_type_check CHECK (document_type IN ('rfp', 'rfi', 'ssl', 'sow_pws', 'amendment', 'past_performance', 'company_data', 'other'));
