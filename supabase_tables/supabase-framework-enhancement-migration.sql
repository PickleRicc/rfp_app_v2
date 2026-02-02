-- Proposal Response Generation Framework - Database Enhancement
-- Run this after supabase-company-intake-migration.sql
-- Adds support for requirements tracking, multi-volume proposals, exhibits, and compliance matrices

-----------------------------------------------------------
-- PART 1: REQUIREMENTS EXTRACTION
-----------------------------------------------------------

-- Store individual requirements extracted from RFPs
CREATE TABLE IF NOT EXISTS rfp_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  -- Requirement content
  requirement_text TEXT NOT NULL,
  requirement_number TEXT NOT NULL, -- "REQ 3.1.2" or "L.4.2"
  source_section TEXT, -- "PWS Section 3.1" or "Section L.4.2"
  
  -- Categorization
  category TEXT CHECK (category IN ('technical', 'management', 'past_performance', 'price', 'submission')),
  priority TEXT CHECK (priority IN ('mandatory', 'highly_desired', 'optional')),
  
  -- Reference info
  page_number INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-----------------------------------------------------------
-- PART 2: MULTI-VOLUME PROPOSALS
-----------------------------------------------------------

-- Store separate volumes (Technical, Management, Past Performance, Price)
CREATE TABLE IF NOT EXISTS proposal_volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES rfp_responses(id) ON DELETE CASCADE,
  
  -- Volume identification
  volume_type TEXT NOT NULL CHECK (volume_type IN ('technical', 'management', 'past_performance', 'price')),
  volume_number INTEGER NOT NULL,
  
  -- Content structure (hierarchical sections)
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Generated document
  docx_url TEXT, -- path to .docx file
  page_count INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(response_id, volume_type)
);

-----------------------------------------------------------
-- PART 3: EXHIBITS & GRAPHICS
-----------------------------------------------------------

-- Unified exhibit tracking (tables, charts, diagrams)
CREATE TABLE IF NOT EXISTS exhibits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES rfp_responses(id) ON DELETE CASCADE,
  
  -- Exhibit identification
  exhibit_number INTEGER NOT NULL,
  exhibit_type TEXT CHECK (exhibit_type IN ('org_chart', 'timeline', 'process_diagram', 'table', 'graphic')),
  title TEXT NOT NULL,
  
  -- Generated asset
  image_url TEXT, -- path to generated image/diagram
  
  -- Cross-references
  referenced_in_sections TEXT[], -- which sections reference this exhibit
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(response_id, exhibit_number)
);

-----------------------------------------------------------
-- PART 4: ENHANCEMENTS TO EXISTING TABLES
-----------------------------------------------------------

-- Add compliance tracking to rfp_responses
ALTER TABLE rfp_responses 
  ADD COLUMN IF NOT EXISTS compliance_matrix_url TEXT,
  ADD COLUMN IF NOT EXISTS requirements_coverage_percent INTEGER DEFAULT 0 CHECK (requirements_coverage_percent BETWEEN 0 AND 100);

-- Add metadata column to documents for volume structure
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-----------------------------------------------------------
-- INDEXES FOR PERFORMANCE
-----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_rfp_requirements_document ON rfp_requirements(document_id);
CREATE INDEX IF NOT EXISTS idx_rfp_requirements_category ON rfp_requirements(category);
CREATE INDEX IF NOT EXISTS idx_rfp_requirements_priority ON rfp_requirements(priority);

CREATE INDEX IF NOT EXISTS idx_proposal_volumes_response ON proposal_volumes(response_id);
CREATE INDEX IF NOT EXISTS idx_proposal_volumes_type ON proposal_volumes(volume_type);

CREATE INDEX IF NOT EXISTS idx_exhibits_response ON exhibits(response_id);
CREATE INDEX IF NOT EXISTS idx_exhibits_number ON exhibits(exhibit_number);

-----------------------------------------------------------
-- ROW LEVEL SECURITY
-----------------------------------------------------------

ALTER TABLE rfp_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_volumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exhibits ENABLE ROW LEVEL SECURITY;

-----------------------------------------------------------
-- POLICIES
-----------------------------------------------------------

CREATE POLICY "Enable all access for authenticated users" ON rfp_requirements
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON proposal_volumes
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON exhibits
  FOR ALL USING (auth.role() = 'authenticated');

-----------------------------------------------------------
-- HELPER VIEWS
-----------------------------------------------------------

-- View for requirements with document info
CREATE OR REPLACE VIEW requirements_with_documents AS
SELECT 
  r.*,
  d.filename,
  d.document_type,
  d.company_id
FROM rfp_requirements r
JOIN documents d ON r.document_id = d.id;

-- View for volumes with response info
CREATE OR REPLACE VIEW volumes_with_responses AS
SELECT 
  v.*,
  resp.document_id,
  d.filename,
  d.company_id
FROM proposal_volumes v
JOIN rfp_responses resp ON v.response_id = resp.id
JOIN documents d ON resp.document_id = d.id;

-- Grant access to views
GRANT SELECT ON requirements_with_documents TO authenticated;
GRANT SELECT ON volumes_with_responses TO authenticated;
