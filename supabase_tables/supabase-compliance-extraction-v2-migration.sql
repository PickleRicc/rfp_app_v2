-- Compliance Extraction v2 — Add Operational Context and Technology Requirements categories
-- Phase 7 expansion: two new extraction categories for enterprise-grade RFP analysis.
-- Safe to re-run — drops and recreates the CHECK constraint idempotently.

-- Drop the existing category CHECK constraint and recreate with all 11 values
ALTER TABLE compliance_extractions
  DROP CONSTRAINT IF EXISTS compliance_extractions_category_check;

ALTER TABLE compliance_extractions
  ADD CONSTRAINT compliance_extractions_category_check
  CHECK (category IN (
    'section_l', 'section_m', 'admin_data', 'rating_scales',
    'sow_pws', 'cost_price', 'past_performance', 'key_personnel',
    'security_reqs', 'operational_context', 'technology_reqs'
  ));
