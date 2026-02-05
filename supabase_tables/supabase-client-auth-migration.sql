-- Migration: Add client_user_id to company_profiles for client portal auth
-- Links one Supabase Auth user per company (client login).

ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS client_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_company_profiles_client_user_id
  ON company_profiles(client_user_id)
  WHERE client_user_id IS NOT NULL;

COMMENT ON COLUMN company_profiles.client_user_id IS 'Supabase Auth user id for client portal login; one client login per company.';
