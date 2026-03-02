-- Touchup Reset + V2 Migration
-- Run this ONCE to:
--   1. Delete all old touchup data from the failed batch run
--   2. Apply the V2 schema changes (new status constraints)
-- Safe to re-run.

-----------------------------------------------------------
-- 1. Delete all existing touchup data (clean slate)
-----------------------------------------------------------

DELETE FROM touchup_volumes;
DELETE FROM touchup_analyses;

-----------------------------------------------------------
-- 2. Apply V2 constraint changes
-----------------------------------------------------------

-- touchup_analyses: simplify status to ('active', 'completed')
DO $$ BEGIN
  ALTER TABLE touchup_analyses DROP CONSTRAINT IF EXISTS touchup_analyses_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE touchup_analyses
  ADD CONSTRAINT touchup_analyses_status_check
  CHECK (status IN ('active', 'completed'));

ALTER TABLE touchup_analyses
  ALTER COLUMN status SET DEFAULT 'active';

-- touchup_volumes: add 'scored' between 'scoring' and 'rewriting'
DO $$ BEGIN
  ALTER TABLE touchup_volumes DROP CONSTRAINT IF EXISTS touchup_volumes_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE touchup_volumes
  ADD CONSTRAINT touchup_volumes_status_check
  CHECK (status IN ('pending', 'scoring', 'scored', 'rewriting', 'completed', 'failed'));
