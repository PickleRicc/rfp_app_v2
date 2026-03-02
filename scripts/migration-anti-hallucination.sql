-- ============================================================================
-- MIGRATION: Anti-Hallucination Guardrail Columns
--
-- Adds two columns to support the hard anti-hallucination validation layers:
--
--   1. draft_volumes.validation_warnings (JSONB)
--      Stores warnings from the post-generation content validator (Layer 1).
--      Includes personnel name mismatches, expired cert mentions, metrics
--      not found in source data, and SPRS inconsistencies.
--
--   2. touchup_volumes.scorer_validation (JSONB)
--      Stores metadata about scorer findings that were dropped by the
--      scorer output validator (Layer 2) because they were hallucinated.
--      Includes count and reasons for each dropped finding.
-- ============================================================================

ALTER TABLE draft_volumes
ADD COLUMN IF NOT EXISTS validation_warnings JSONB DEFAULT NULL;

ALTER TABLE touchup_volumes
ADD COLUMN IF NOT EXISTS scorer_validation JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN draft_volumes.validation_warnings IS 'Post-generation content validation warnings (Layer 1 anti-hallucination). Array of {check, severity, message, location} objects.';
COMMENT ON COLUMN touchup_volumes.scorer_validation IS 'Scorer output validation results (Layer 2 anti-hallucination). Contains dropped_count and findings array with reasons for each dropped scorer hallucination.';
