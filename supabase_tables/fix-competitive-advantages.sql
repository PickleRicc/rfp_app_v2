-- Step 1: Drop the table if it exists with wrong schema
DROP TABLE IF EXISTS competitive_advantages CASCADE;

-- Step 2: Create the table with correct schema
CREATE TABLE competitive_advantages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  
  -- Advantage details
  area TEXT NOT NULL,
  our_strength TEXT NOT NULL,
  competitor_weakness TEXT,
  ghosting_phrase TEXT NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_competitive_advantages_company 
  ON competitive_advantages(company_id);

-- Add comments
COMMENT ON TABLE competitive_advantages IS 'Stores competitive advantages for ghosting techniques';
COMMENT ON COLUMN competitive_advantages.ghosting_phrase IS 'Subtle differentiation language';
COMMENT ON COLUMN competitive_advantages.competitor_weakness IS 'Internal only - not displayed in proposals';

-- Step 3: Add the data
DO $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Get TechVision company ID
    SELECT id INTO v_company_id
    FROM company_profiles
    WHERE company_name = 'TechVision Federal Solutions'
    LIMIT 1;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Company not found. Check company_name in company_profiles.';
    END IF;

    -- Insert competitive advantages
    INSERT INTO competitive_advantages (company_id, area, our_strength, competitor_weakness, ghosting_phrase) VALUES
    (v_company_id, 
    'Incumbent Experience', 
    'Current contractor on similar contracts with deep institutional knowledge', 
    'New contractors face steep learning curve and transition risks',
    'Our existing presence and proven track record eliminate transition risks and ensure day-one productivity without the learning curve that new contractors typically face.'),

    (v_company_id,
    'Facility Clearances',
    'Already hold facility Secret clearance with cleared personnel',
    'Contractors without facility clearance require 6-12 months for individual sponsorships',
    'Unlike contractors requiring new clearances, our team is already cleared and badged, avoiding the 6-12 month delays that often impact project timelines.'),

    (v_company_id,
    'Local Presence',
    'Office within 10 miles of client sites with local workforce',
    'Remote-only contractors or distant firms lack face-to-face availability',
    'Our local presence enables rapid on-site response and face-to-face collaboration without the travel delays and coordination challenges that remote-only contractors encounter.'),

    (v_company_id,
    'SDVOSB Status',
    'Service-Disabled Veteran-Owned Small Business with veteran leadership',
    'Large commercial firms lack small business status and federal mission understanding',
    'As a certified SDVOSB with 60% veteran workforce, we bring mission understanding and responsiveness that larger commercial firms often lack, while maintaining enterprise-grade capabilities.'),

    (v_company_id,
    'Agile Maturity',
    '15 SAFe Program Consultants on staff with embedded coaching model',
    'Many competitors provide training-only or rely on external consultants',
    'Unlike training-only approaches, our embedded agile coaches work alongside your teams daily, building lasting capability rather than creating consulting dependencies.'),

    (v_company_id,
    'FedRAMP Expertise',
    'Completed 25+ FedRAMP ATOs averaging 8 months',
    'Industry average ATO timeline is 12-18 months with frequent delays',
    'Our streamlined FedRAMP approach achieves authorization in 8 months on average, avoiding the delays and cost overruns that many contractors experience with their first FedRAMP engagement.');

    RAISE NOTICE 'Successfully added 6 competitive advantages to company %', v_company_id;
END $$;

-- Step 4: Verify
SELECT 
    ca.area,
    ca.ghosting_phrase,
    cp.company_name
FROM competitive_advantages ca
JOIN company_profiles cp ON ca.company_id = cp.id
ORDER BY ca.created_at;
