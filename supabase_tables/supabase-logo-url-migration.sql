-- Migration: Add logo_url to company_profiles
-- Purpose: Allow companies to specify a logo URL for proposal branding
-- Date: 2026-02-02

-- Add logo_url column to company_profiles table
ALTER TABLE company_profiles
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN company_profiles.logo_url IS 'URL to company logo image for use in proposal cover pages and headers';
