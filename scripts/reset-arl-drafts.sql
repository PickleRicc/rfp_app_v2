-- Reset script: Clears all generated output for the ARL solicitation
-- Preserves: solicitation, company, data call response, uploaded files
-- Deletes: proposal drafts, draft volumes, touchup analyses, touchup volumes, touchup versions

DO $$
DECLARE
  v_solicitation_id UUID := '1ba2f94d-7b58-4bbc-8b78-296f3e4c1fa6';
  v_draft_count INT;
  v_touchup_count INT;
BEGIN

  -- Count what we're about to delete
  SELECT COUNT(*) INTO v_draft_count
  FROM proposal_drafts WHERE solicitation_id = v_solicitation_id;

  SELECT COUNT(*) INTO v_touchup_count
  FROM touchup_analyses WHERE solicitation_id = v_solicitation_id;

  -- Touchup data (cascade handles versions → volumes)
  DELETE FROM touchup_analyses WHERE solicitation_id = v_solicitation_id;

  -- Draft data (cascade handles draft_volumes)
  DELETE FROM proposal_drafts WHERE solicitation_id = v_solicitation_id;

  RAISE NOTICE 'Reset complete: deleted % proposal_drafts, % touchup_analyses for solicitation %',
    v_draft_count, v_touchup_count, v_solicitation_id;

END $$;
