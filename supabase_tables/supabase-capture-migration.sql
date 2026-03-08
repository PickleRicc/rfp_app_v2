-- Capture Module: Opportunity Confirmation
-- Tables for opportunity analysis feature (raw upload + database mode)

-- Main analysis record
CREATE TABLE IF NOT EXISTS opportunity_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES company_profiles(id) ON DELETE SET NULL,
  mode TEXT NOT NULL CHECK (mode IN ('raw', 'database', 'finder')),
  title TEXT NOT NULL,
  agency TEXT,
  solicitation_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'uploading', 'ready', 'analyzing', 'complete', 'failed')),
  created_by UUID NOT NULL REFERENCES auth.users(id),

  overall_fit_rating TEXT CHECK (overall_fit_rating IN ('strong_fit', 'moderate_fit', 'weak_fit', 'not_recommended')),
  overall_score NUMERIC(5,2),
  summary TEXT,
  report JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uploaded documents for analysis
CREATE TABLE IF NOT EXISTS opportunity_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES opportunity_analyses(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  document_type TEXT NOT NULL CHECK (document_type IN ('rfp', 'rfi', 'ssl', 'sow_pws', 'amendment', 'past_performance', 'other')),
  extracted_text TEXT,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'extracting', 'ready', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opportunity_analyses_company ON opportunity_analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_analyses_created_by ON opportunity_analyses(created_by);
CREATE INDEX IF NOT EXISTS idx_opportunity_analyses_status ON opportunity_analyses(status);
CREATE INDEX IF NOT EXISTS idx_opportunity_documents_analysis ON opportunity_documents(analysis_id);

-- RLS policies
ALTER TABLE opportunity_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own analyses" ON opportunity_analyses;
CREATE POLICY "Users can view own analyses"
  ON opportunity_analyses FOR SELECT
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can insert own analyses" ON opportunity_analyses;
CREATE POLICY "Users can insert own analyses"
  ON opportunity_analyses FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update own analyses" ON opportunity_analyses;
CREATE POLICY "Users can update own analyses"
  ON opportunity_analyses FOR UPDATE
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete own analyses" ON opportunity_analyses;
CREATE POLICY "Users can delete own analyses"
  ON opportunity_analyses FOR DELETE
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can view docs for own analyses" ON opportunity_documents;
CREATE POLICY "Users can view docs for own analyses"
  ON opportunity_documents FOR SELECT
  USING (analysis_id IN (SELECT id FROM opportunity_analyses WHERE created_by = auth.uid()));

DROP POLICY IF EXISTS "Users can insert docs for own analyses" ON opportunity_documents;
CREATE POLICY "Users can insert docs for own analyses"
  ON opportunity_documents FOR INSERT
  WITH CHECK (analysis_id IN (SELECT id FROM opportunity_analyses WHERE created_by = auth.uid()));

DROP POLICY IF EXISTS "Users can delete docs for own analyses" ON opportunity_documents;
CREATE POLICY "Users can delete docs for own analyses"
  ON opportunity_documents FOR DELETE
  USING (analysis_id IN (SELECT id FROM opportunity_analyses WHERE created_by = auth.uid()));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_opportunity_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_opportunity_analyses_updated_at
  BEFORE UPDATE ON opportunity_analyses
  FOR EACH ROW EXECUTE FUNCTION update_opportunity_analyses_updated_at();

-- Storage bucket for capture documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('capture-documents', 'capture-documents', false)
ON CONFLICT (id) DO NOTHING;
