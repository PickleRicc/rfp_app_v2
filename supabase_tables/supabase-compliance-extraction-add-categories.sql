-- Compliance Extraction — Add 5 New Categories
-- Phase 7 expansion: SOW/PWS, Cost/Price, Past Performance, Key Personnel, Security Requirements
-- Run this if you already applied supabase-compliance-extraction-migration.sql with the original 4 categories.
-- Safe to re-run — drops and recreates the CHECK constraint idempotently.

-- Drop the existing category CHECK constraint and recreate with all 9 values
ALTER TABLE compliance_extractions
  DROP CONSTRAINT IF EXISTS compliance_extractions_category_check;

ALTER TABLE compliance_extractions
  ADD CONSTRAINT compliance_extractions_category_check
  CHECK (category IN (
    'section_l', 'section_m', 'admin_data', 'rating_scales',
    'sow_pws', 'cost_price', 'past_performance', 'key_personnel', 'security_reqs'
  ));
