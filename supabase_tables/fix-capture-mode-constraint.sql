-- Fix: Add 'finder' mode to opportunity_analyses constraint
-- This script updates the mode check constraint to allow 'raw', 'database', and 'finder'

ALTER TABLE opportunity_analyses DROP CONSTRAINT opportunity_analyses_mode_check;
ALTER TABLE opportunity_analyses ADD CONSTRAINT opportunity_analyses_mode_check CHECK (mode IN ('raw', 'database', 'finder'));
