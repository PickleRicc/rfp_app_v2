-- Run this query to check if you need to run the framework enhancement migration
-- If any of these tables are missing, you need to run: supabase-framework-enhancement-migration.sql

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rfp_requirements') 
    THEN '✅ EXISTS' 
    ELSE '❌ MISSING - MIGRATION REQUIRED' 
  END AS rfp_requirements_status,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proposal_volumes') 
    THEN '✅ EXISTS' 
    ELSE '❌ MISSING - MIGRATION REQUIRED' 
  END AS proposal_volumes_status,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proposal_exhibits') 
    THEN '✅ EXISTS' 
    ELSE '❌ MISSING - MIGRATION REQUIRED' 
  END AS proposal_exhibits_status,
  
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compliance_matrix_items') 
    THEN '✅ EXISTS' 
    ELSE '❌ MISSING - MIGRATION REQUIRED' 
  END AS compliance_matrix_items_status;

-- If all show ✅ EXISTS, you're good to go!
-- If any show ❌ MISSING, run: supabase-framework-enhancement-migration.sql
