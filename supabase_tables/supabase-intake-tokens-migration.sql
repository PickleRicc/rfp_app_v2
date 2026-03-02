-- ============================================================
-- Remote Intake Tokens
-- Enables shareable, token-based links for external clients
-- to fill in the Tier 1 Enterprise Profile without needing
-- a Supabase Auth account or portal login.
-- ============================================================

CREATE TABLE IF NOT EXISTS intake_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  label TEXT,
  created_by TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_tokens_token ON intake_tokens(token);
CREATE INDEX IF NOT EXISTS idx_intake_tokens_company ON intake_tokens(company_id);
CREATE INDEX IF NOT EXISTS idx_intake_tokens_active ON intake_tokens(token)
  WHERE is_revoked = FALSE;
