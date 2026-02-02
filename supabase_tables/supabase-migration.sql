-- RFP Analyzer Database Schema
-- Run this in your Supabase SQL Editor

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  document_type TEXT CHECK (document_type IN ('rfp', 'proposal', 'contract', 'other', 'unknown')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Section results table
CREATE TABLE IF NOT EXISTS section_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  section_name TEXT NOT NULL,
  section_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processing logs table
CREATE TABLE IF NOT EXISTS processing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RFP Responses table (Stage 2)
CREATE TABLE IF NOT EXISTS rfp_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed', 'draft', 'final')),

  -- Structured content (JSON) - AI-generated sections
  content JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- HTML template and rendered output
  html_template TEXT,
  rendered_html TEXT,

  -- Metadata
  version INTEGER NOT NULL DEFAULT 1,
  is_latest BOOLEAN DEFAULT true,

  -- Customization settings
  branding JSONB DEFAULT '{}'::jsonb, -- company logo, colors, fonts
  template_options JSONB DEFAULT '{}'::jsonb, -- layout preferences

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_section_results_document ON section_results(document_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_document ON processing_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_rfp_responses_document ON rfp_responses(document_id);
CREATE INDEX IF NOT EXISTS idx_rfp_responses_status ON rfp_responses(status);
CREATE INDEX IF NOT EXISTS idx_rfp_responses_latest ON rfp_responses(is_latest) WHERE is_latest = true;

-- Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_responses ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth requirements)
CREATE POLICY "Enable all access for authenticated users" ON documents
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON section_results
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON processing_logs
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON rfp_responses
  FOR ALL USING (auth.role() = 'authenticated');
