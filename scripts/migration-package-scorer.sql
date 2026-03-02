-- Migration: Add package consistency columns to touchup_analyses
-- and excel_file_path column to draft_volumes
-- Run in Supabase SQL Editor

ALTER TABLE touchup_analyses
  ADD COLUMN IF NOT EXISTS package_consistency JSONB,
  ADD COLUMN IF NOT EXISTS package_score INTEGER,
  ADD COLUMN IF NOT EXISTS human_effort_estimate JSONB;

ALTER TABLE draft_volumes
  ADD COLUMN IF NOT EXISTS excel_file_path TEXT;
