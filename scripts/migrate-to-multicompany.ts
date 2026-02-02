/**
 * Multi-Company Migration Script
 * 
 * This script migrates existing single-company data to multi-company architecture
 * 
 * Usage:
 *   npx tsx scripts/migrate-to-multicompany.ts
 * 
 * What it does:
 * 1. Checks if there are any documents without company_id
 * 2. Finds or creates a default company profile
 * 3. Associates orphaned documents with the default company
 * 4. Reports on migration status
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🚀 Starting multi-company migration...\n');

  // Step 1: Check for orphaned documents
  console.log('📋 Step 1: Checking for orphaned documents...');
  const { data: orphanedDocs, error: docsError } = await supabase
    .from('documents')
    .select('id, filename, created_at')
    .is('company_id', null);

  if (docsError) {
    console.error('❌ Error fetching documents:', docsError);
    process.exit(1);
  }

  console.log(`   Found ${orphanedDocs?.length || 0} documents without company_id`);

  if (!orphanedDocs || orphanedDocs.length === 0) {
    console.log('✅ No orphaned documents found. Migration not needed!\n');
    return;
  }

  // Step 2: Find or create default company
  console.log('\n📋 Step 2: Finding or creating default company...');
  const { data: existingCompanies } = await supabase
    .from('company_profiles')
    .select('id, company_name')
    .order('created_at', { ascending: true })
    .limit(1);

  let defaultCompanyId: string;

  if (existingCompanies && existingCompanies.length > 0) {
    defaultCompanyId = existingCompanies[0].id;
    console.log(`   Using existing company: ${existingCompanies[0].company_name} (${defaultCompanyId})`);
  } else {
    console.log('   No existing company found. Creating default company...');
    
    // Create a default company
    const { data: newCompany, error: createError } = await supabase
      .from('company_profiles')
      .insert({
        company_name: 'Default Company',
        legal_name: 'Default Company LLC',
        cage_code: '00000',
        uei_number: '000000000000',
        sam_status: 'Active',
        headquarters_address: {
          street: '123 Main St',
          city: 'City',
          state: 'ST',
          zip: '00000',
          country: 'USA'
        },
        proposal_poc: {
          name: 'John Doe',
          title: 'Proposal Manager',
          email: 'proposals@company.com'
        },
        authorized_signer: {
          name: 'Jane Smith',
          title: 'CEO',
          email: 'ceo@company.com'
        },
        elevator_pitch: 'This is a default company profile created during migration. Please update with real information.',
        completeness_score: 25,
      })
      .select('id')
      .single();

    if (createError || !newCompany) {
      console.error('❌ Error creating default company:', createError);
      process.exit(1);
    }

    defaultCompanyId = newCompany.id;
    console.log(`   ✅ Created default company (${defaultCompanyId})`);
    console.log('   ⚠️  IMPORTANT: Update this company profile with real information!');
  }

  // Step 3: Migrate orphaned documents
  console.log('\n📋 Step 3: Migrating orphaned documents...');
  const { error: updateError } = await supabase
    .from('documents')
    .update({ company_id: defaultCompanyId })
    .is('company_id', null);

  if (updateError) {
    console.error('❌ Error updating documents:', updateError);
    process.exit(1);
  }

  console.log(`   ✅ Migrated ${orphanedDocs.length} documents to company ${defaultCompanyId}`);

  // Step 4: Verification
  console.log('\n📋 Step 4: Verifying migration...');
  const { data: stillOrphaned } = await supabase
    .from('documents')
    .select('id')
    .is('company_id', null);

  if (stillOrphaned && stillOrphaned.length > 0) {
    console.error(`   ⚠️  Warning: ${stillOrphaned.length} documents still without company_id`);
  } else {
    console.log('   ✅ All documents now have company_id');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ MIGRATION COMPLETE!');
  console.log('='.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   - Migrated ${orphanedDocs.length} documents`);
  console.log(`   - Default company ID: ${defaultCompanyId}`);
  console.log(`\n📝 Next Steps:`);
  console.log(`   1. Update the default company profile with real information`);
  console.log(`   2. Create additional company profiles as needed`);
  console.log(`   3. Run the app and test multi-company functionality`);
  console.log('');
}

main().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
