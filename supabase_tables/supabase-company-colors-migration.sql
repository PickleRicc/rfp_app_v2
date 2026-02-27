-- Add brand color columns to company_profiles
-- Used by DOCX generation to apply company-specific color palette
-- instead of hardcoded blue (#2563eb).

ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS primary_color TEXT,
  ADD COLUMN IF NOT EXISTS secondary_color TEXT;

COMMENT ON COLUMN company_profiles.primary_color IS 'Primary brand color as hex (e.g., 2563eb or #2563eb). Used for headings, borders, table headers in generated proposals.';
COMMENT ON COLUMN company_profiles.secondary_color IS 'Secondary brand color as hex. Reserved for future accent/gradient use.';
