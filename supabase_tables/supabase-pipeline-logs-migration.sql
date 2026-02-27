-- Pipeline Logs — Solicitation-scoped pipeline event logging
-- Phase 5: Pipeline Logging & Observability
-- Stores structured events for every pipeline step (classification, extraction, generation).
-- Safe to re-run — uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS pipeline_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id UUID NOT NULL REFERENCES solicitations(id) ON DELETE CASCADE,
  document_id UUID REFERENCES solicitation_documents(id) ON DELETE SET NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'warning')),
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Primary query pattern: all logs for a solicitation, newest first
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_solicitation
  ON pipeline_logs(solicitation_id, created_at DESC);

-- Filter by stage within a solicitation
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_stage
  ON pipeline_logs(solicitation_id, stage);
