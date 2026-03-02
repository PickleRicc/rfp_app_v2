-- Round 4: Fix user count inconsistency (4,500 → 3,500 per SOO)
-- The SOO states approximately 3,500 researchers and support staff.
-- Our seed data incorrectly used 4,500 in technical_approach fields.

DO $$
DECLARE
  v_dcr_id UUID := '368fe62d-36fb-463d-a2ec-9a1287c578f2';
BEGIN

-- Fix approach_summary
UPDATE data_call_responses
SET technical_approach = jsonb_set(
  technical_approach,
  '{approach_summary}',
  to_jsonb(REPLACE(
    technical_approach->>'approach_summary',
    'approximately 4,500 users',
    'approximately 3,500 researchers and support staff'
  ))
)
WHERE id = v_dcr_id;

-- Fix staffing_model
UPDATE data_call_responses
SET technical_approach = jsonb_set(
  technical_approach,
  '{staffing_model}',
  to_jsonb(REPLACE(
    technical_approach->>'staffing_model',
    '75:1 user-to-technician for 4,500 users',
    'approximately 58:1 user-to-technician for 3,500 users'
  ))
)
WHERE id = v_dcr_id;

-- Fix assumptions
UPDATE data_call_responses
SET technical_approach = jsonb_set(
  technical_approach,
  '{assumptions}',
  to_jsonb(REPLACE(
    technical_approach->>'assumptions',
    '4,500 total user population',
    '3,500 total user population (approximately 3,500 researchers and support staff per SOO)'
  ))
)
WHERE id = v_dcr_id;

RAISE NOTICE 'Fixed user count from 4,500 to 3,500 in technical_approach fields';

END $$;
