-- Tier 2 Data Call v2 — Add service area approaches, site staffing, and technology selections
-- Three new JSONB columns for enriched per-bid data collection.
-- Safe to re-run — uses IF NOT EXISTS.

ALTER TABLE data_call_responses
  ADD COLUMN IF NOT EXISTS service_area_approaches JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS site_staffing JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS technology_selections JSONB DEFAULT '[]';
