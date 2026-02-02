-- Migration: Add Competitive Advantages for Ghosting (Framework Part 6.3)
-- Run this to enable ghosting techniques in proposals

CREATE TABLE IF NOT EXISTS competitive_advantages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  
  -- Advantage details
  area TEXT NOT NULL, -- e.g., "Incumbent Experience", "Local Presence", "Clearances"
  our_strength TEXT NOT NULL, -- What we have that's advantageous
  competitor_weakness TEXT, -- What others typically lack (internal only, not displayed)
  ghosting_phrase TEXT NOT NULL, -- Pre-written language for subtle differentiation
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_competitive_advantages_company 
  ON competitive_advantages(company_id);

-- Sample data for TechVision Corp (replace with actual company_id after insertion)
-- This shows examples of ghosting phrases that differentiate without naming competitors

COMMENT ON TABLE competitive_advantages IS 'Stores competitive advantages for ghosting techniques - highlighting strengths that are competitor weaknesses without naming competitors';
COMMENT ON COLUMN competitive_advantages.ghosting_phrase IS 'Subtle differentiation language that highlights our strength without naming competitors';
COMMENT ON COLUMN competitive_advantages.competitor_weakness IS 'Internal only - what others lack (not displayed in proposals)';
