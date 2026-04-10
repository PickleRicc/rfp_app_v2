-- Diagram Specs Migration
-- Adds diagram_specs JSONB column to draft_volumes.
-- Required for the AI SVG diagram system (Phase 9 diagram pipeline).
--
-- diagram_specs stores the DiagramSpec[] array generated during draft generation.
-- Used by the Draft tab to preview diagrams without re-generating,
-- and as an audit trail for which diagrams were embedded in the DOCX.
--
-- Safe to re-run — uses IF NOT EXISTS check via DO block.
-- Run after supabase-draft-generation-migration.sql.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'draft_volumes'
      AND column_name = 'diagram_specs'
  ) THEN
    ALTER TABLE draft_volumes
      ADD COLUMN diagram_specs JSONB;

    COMMENT ON COLUMN draft_volumes.diagram_specs IS
      'Array of DiagramSpec objects generated during draft generation. '
      'Null if graphics_profile = minimal, generation failed, or no diagrams were produced. '
      'Used by the Draft tab DiagramPreview component for in-browser SVG rendering.';
  END IF;
END $$;
