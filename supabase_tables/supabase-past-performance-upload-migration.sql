-- Past Performance File Upload Support
-- Tracks uploaded source documents (PDFs, DOCX) for AI extraction into past_performance records.
-- Run this after supabase-company-intake-migration.sql

CREATE TABLE IF NOT EXISTS past_performance_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  extracted_text TEXT,
  extraction_status TEXT DEFAULT 'pending'
    CHECK (extraction_status IN ('pending', 'extracting', 'extracted', 'failed')),
  ai_extraction_status TEXT DEFAULT 'pending'
    CHECK (ai_extraction_status IN ('pending', 'processing', 'complete', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pp_files_company ON past_performance_files(company_id);

ALTER TABLE past_performance_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON past_performance_files
  FOR ALL USING (auth.role() = 'authenticated');

-- Also allow service_role (used by intake token APIs) full access
CREATE POLICY "Enable service role access" ON past_performance_files
  FOR ALL USING (auth.role() = 'service_role');

-----------------------------------------------------------
-- STORAGE BUCKET (create manually in Supabase dashboard)
-----------------------------------------------------------
-- Bucket name: past-performance-files
-- Public: false
-- File size limit: 10MB
-- Allowed MIME types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/msword
