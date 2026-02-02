-- Migration to fix achievements data structure
-- Converts string arrays to proper object arrays with statement, metric_value, and metric_type

-- Backup the current achievements data first (optional but recommended)
-- CREATE TABLE past_performance_backup AS SELECT * FROM past_performance;

-- Update function to parse achievements and convert to proper structure
DO $$
DECLARE
  rec RECORD;
  achievement_text TEXT;
  new_achievements JSONB;
  achievement_obj JSONB;
  metric_type TEXT;
BEGIN
  -- Loop through all past performance records
  FOR rec IN SELECT id, achievements FROM past_performance
  LOOP
    new_achievements := '[]'::jsonb;
    
    -- Check if achievements is already an object array (has 'statement' key)
    IF jsonb_typeof(rec.achievements) = 'array' AND 
       jsonb_array_length(rec.achievements) > 0 THEN
      
      -- Check if first element is an object with 'statement' field
      IF jsonb_typeof(rec.achievements->0) = 'object' AND 
         rec.achievements->0 ? 'statement' THEN
        -- Already in correct format, skip
        CONTINUE;
      END IF;
      
      -- Convert string array to object array
      FOR i IN 0..jsonb_array_length(rec.achievements)-1
      LOOP
        achievement_text := rec.achievements->>i;
        
        -- Determine metric type based on keywords in the text
        metric_type := CASE
          WHEN achievement_text ILIKE '%cost%' OR achievement_text ILIKE '%sav%$%' OR achievement_text ILIKE '%$%' THEN 'Cost Savings'
          WHEN achievement_text ILIKE '%time%' OR achievement_text ILIKE '%faster%' OR achievement_text ILIKE '%reduced%lead%' THEN 'Time Savings'
          WHEN achievement_text ILIKE '%quality%' OR achievement_text ILIKE '%defect%' OR achievement_text ILIKE '%uptime%' THEN 'Quality Improvement'
          WHEN achievement_text ILIKE '%efficiency%' OR achievement_text ILIKE '%automat%' OR achievement_text ILIKE '%improve%' THEN 'Efficiency Gain'
          WHEN achievement_text ILIKE '%satisfaction%' OR achievement_text ILIKE '%rating%' OR achievement_text ILIKE '%exceptional%' THEN 'Customer Satisfaction'
          WHEN achievement_text ILIKE '%compliance%' OR achievement_text ILIKE '%ato%' OR achievement_text ILIKE '%fedramp%' THEN 'Compliance'
          ELSE 'Other'
        END;
        
        -- Extract metric value (look for percentages, numbers, or specific achievements)
        -- This is a simplified extraction - you may want to refine this
        achievement_obj := jsonb_build_object(
          'statement', achievement_text,
          'metric_value', CASE
            WHEN achievement_text ~ '\d+%' THEN substring(achievement_text from '\d+%')
            WHEN achievement_text ~ '\$[\d,]+\.?\d*[MK]?' THEN substring(achievement_text from '\$[\d,]+\.?\d*[MK]?')
            WHEN achievement_text ~ '\d+\+' THEN substring(achievement_text from '\d+\+')
            WHEN achievement_text ~ '\d+x' THEN substring(achievement_text from '\d+x')
            ELSE 'Significant'
          END,
          'metric_type', metric_type
        );
        
        new_achievements := new_achievements || jsonb_build_array(achievement_obj);
      END LOOP;
      
      -- Update the record with new structure
      UPDATE past_performance 
      SET achievements = new_achievements,
          updated_at = NOW()
      WHERE id = rec.id;
      
      RAISE NOTICE 'Updated achievements for record ID: %', rec.id;
    END IF;
  END LOOP;
END $$;

-- Verify the migration
SELECT 
  id,
  contract_nickname,
  jsonb_pretty(achievements) as achievements
FROM past_performance
LIMIT 3;

COMMENT ON COLUMN past_performance.achievements IS 'Array of achievement objects: [{statement: string, metric_value: string, metric_type: string}]';
