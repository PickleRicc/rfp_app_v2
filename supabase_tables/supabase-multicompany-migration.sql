-- Multi-Company Architecture Migration
-- Run this AFTER supabase-migration.sql and supabase-company-intake-migration.sql
-- This adds company context to the RFP processing workflow

-----------------------------------------------------------
-- ADD COMPANY CONTEXT TO DOCUMENTS
-----------------------------------------------------------

-- Add company_id to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id);

-----------------------------------------------------------
-- UPDATE POLICIES (Optional - for future auth expansion)
-----------------------------------------------------------

-- Drop existing policy
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON documents;

-- Recreate policy (still allows all access since you're the only user)
-- In the future, you could add company-specific filtering here
CREATE POLICY "Enable all access for authenticated users" ON documents
  FOR ALL USING (auth.role() = 'authenticated');

-----------------------------------------------------------
-- HELPER VIEWS (Optional but useful)
-----------------------------------------------------------

-- View to see documents with company info
CREATE OR REPLACE VIEW documents_with_company AS
SELECT 
  d.*,
  cp.company_name,
  cp.cage_code,
  cp.legal_name
FROM documents d
LEFT JOIN company_profiles cp ON d.company_id = cp.id;

-- View to see RFP responses with company info
CREATE OR REPLACE VIEW rfp_responses_with_company AS
SELECT 
  r.*,
  d.filename,
  d.document_type,
  d.company_id,
  cp.company_name,
  cp.cage_code
FROM rfp_responses r
JOIN documents d ON r.document_id = d.id
LEFT JOIN company_profiles cp ON d.company_id = cp.id;

-----------------------------------------------------------
-- DATA MIGRATION NOTES
-----------------------------------------------------------

-- If you have existing documents without company_id, you'll need to:
-- 1. Create a default/first company if none exists
-- 2. Update existing documents to reference that company
-- 
-- Example (run manually if needed):
-- UPDATE documents SET company_id = (SELECT id FROM company_profiles LIMIT 1) WHERE company_id IS NULL;
