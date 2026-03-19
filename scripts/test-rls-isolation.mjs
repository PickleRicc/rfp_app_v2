#!/usr/bin/env node
/**
 * RLS Isolation Test
 *
 * Proves whether Row Level Security actually prevents cross-tenant data access.
 *
 * Test plan:
 *   1. Use service-role client to find two companies with data
 *   2. Create two temporary auth users, link each to a different company
 *   3. Authenticate as User A (Company A) using the anon-key client
 *   4. Query company_profiles, solicitations, certifications — verify ONLY Company A rows returned
 *   5. Authenticate as User B (Company B) — verify ONLY Company B rows returned
 *   6. Clean up test users
 *
 * Usage: node scripts/test-rls-isolation.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomBytes } from 'crypto';

config(); // Load .env

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('Missing environment variables. Ensure .env is configured.');
  process.exit(1);
}

// Admin client (bypasses RLS)
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Two separate anon clients for each test user
function makeAnonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const results = [];
let testUserA = null;
let testUserB = null;

function log(label, pass, detail) {
  const icon = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${icon}  ${label}`);
  if (detail) console.log(`         ${detail}`);
  results.push({ label, pass, detail });
}

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  RLS CROSS-TENANT ISOLATION TEST');
  console.log('══════════════════════════════════════════════════\n');

  // ── Step 1: Find two companies with data ──────────────────────
  console.log('Step 1: Discovering companies...\n');

  const { data: companies, error: compErr } = await admin
    .from('company_profiles')
    .select('id, company_name')
    .order('created_at', { ascending: true })
    .limit(10);

  if (compErr || !companies?.length) {
    console.error('Cannot find companies:', compErr?.message || 'no rows');
    process.exit(1);
  }

  console.log(`  Found ${companies.length} companies:`);
  companies.forEach((c) => console.log(`    • ${c.company_name} (${c.id})`));

  if (companies.length < 2) {
    console.error('\n  Need at least 2 companies to test isolation. Creating a second test company...');
    const { data: newCo, error: newErr } = await admin
      .from('company_profiles')
      .insert({ company_name: `__RLS_TEST_CO_${Date.now()}` })
      .select()
      .single();
    if (newErr) {
      console.error('Failed to create test company:', newErr.message);
      process.exit(1);
    }
    companies.push(newCo);
  }

  const companyA = companies[0];
  const companyB = companies[1];
  console.log(`\n  Company A: ${companyA.company_name} (${companyA.id})`);
  console.log(`  Company B: ${companyB.company_name} (${companyB.id})\n`);

  // ── Step 2: Create temporary test auth users ──────────────────
  console.log('Step 2: Creating temporary test auth users...\n');

  const passwordA = randomBytes(16).toString('hex');
  const passwordB = randomBytes(16).toString('hex');
  const emailA = `rls-test-a-${Date.now()}@test.local`;
  const emailB = `rls-test-b-${Date.now()}@test.local`;

  const { data: userAData, error: userAErr } = await admin.auth.admin.createUser({
    email: emailA,
    password: passwordA,
    email_confirm: true,
  });
  if (userAErr) {
    console.error('Failed to create test user A:', userAErr.message);
    process.exit(1);
  }
  testUserA = userAData.user;
  console.log(`  Created User A: ${emailA} (${testUserA.id})`);

  const { data: userBData, error: userBErr } = await admin.auth.admin.createUser({
    email: emailB,
    password: passwordB,
    email_confirm: true,
  });
  if (userBErr) {
    console.error('Failed to create test user B:', userBErr.message);
    await cleanup();
    process.exit(1);
  }
  testUserB = userBData.user;
  console.log(`  Created User B: ${emailB} (${testUserB.id})`);

  // Link users to companies via client_user_id
  await admin
    .from('company_profiles')
    .update({ client_user_id: testUserA.id })
    .eq('id', companyA.id);
  await admin
    .from('company_profiles')
    .update({ client_user_id: testUserB.id })
    .eq('id', companyB.id);
  console.log('  Linked User A → Company A, User B → Company B\n');

  // ── Step 3: Sign in as each user with anon-key clients ────────
  console.log('Step 3: Authenticating as each user...\n');

  const clientA = makeAnonClient();
  const clientB = makeAnonClient();

  const { error: signInErrA } = await clientA.auth.signInWithPassword({
    email: emailA,
    password: passwordA,
  });
  if (signInErrA) {
    console.error('Sign-in failed for User A:', signInErrA.message);
    await cleanup();
    process.exit(1);
  }
  console.log('  Signed in as User A (Company A)');

  const { error: signInErrB } = await clientB.auth.signInWithPassword({
    email: emailB,
    password: passwordB,
  });
  if (signInErrB) {
    console.error('Sign-in failed for User B:', signInErrB.message);
    await cleanup();
    process.exit(1);
  }
  console.log('  Signed in as User B (Company B)\n');

  // ── Step 4: Run cross-tenant queries ──────────────────────────
  console.log('Step 4: Testing cross-tenant data access...\n');
  console.log('─── company_profiles ───');

  // User A queries company_profiles
  const { data: aProfiles } = await clientA.from('company_profiles').select('id, company_name');
  const aSeesOnlyOwn = aProfiles?.length === 1 && aProfiles[0].id === companyA.id;
  const aSeesB = aProfiles?.some((p) => p.id === companyB.id);
  log(
    'User A sees ONLY Company A profile',
    aSeesOnlyOwn,
    `Got ${aProfiles?.length} rows. ${aSeesB ? '⚠️  CAN see Company B!' : ''}`
  );

  // User B queries company_profiles
  const { data: bProfiles } = await clientB.from('company_profiles').select('id, company_name');
  const bSeesOnlyOwn = bProfiles?.length === 1 && bProfiles[0].id === companyB.id;
  const bSeesA = bProfiles?.some((p) => p.id === companyA.id);
  log(
    'User B sees ONLY Company B profile',
    bSeesOnlyOwn,
    `Got ${bProfiles?.length} rows. ${bSeesA ? '⚠️  CAN see Company A!' : ''}`
  );

  // ── solicitations ───
  console.log('\n─── solicitations ───');

  const { data: aSolicitations } = await clientA.from('solicitations').select('id, company_id, title');
  const aSolOnlyOwn = aSolicitations?.every((s) => s.company_id === companyA.id);
  const aSolLeaks = aSolicitations?.filter((s) => s.company_id === companyB.id);
  log(
    'User A sees ONLY Company A solicitations',
    aSolOnlyOwn && (aSolLeaks?.length === 0),
    `Got ${aSolicitations?.length} rows. ${aSolLeaks?.length ? `⚠️  ${aSolLeaks.length} Company B rows leaked!` : 'No leaks.'}`
  );

  const { data: bSolicitations } = await clientB.from('solicitations').select('id, company_id, title');
  const bSolOnlyOwn = bSolicitations?.every((s) => s.company_id === companyB.id);
  const bSolLeaks = bSolicitations?.filter((s) => s.company_id === companyA.id);
  log(
    'User B sees ONLY Company B solicitations',
    bSolOnlyOwn && (bSolLeaks?.length === 0),
    `Got ${bSolicitations?.length} rows. ${bSolLeaks?.length ? `⚠️  ${bSolLeaks.length} Company A rows leaked!` : 'No leaks.'}`
  );

  // ── certifications ───
  console.log('\n─── certifications ───');

  const { data: aCerts, error: aCertsErr } = await clientA.from('certifications').select('id, company_id, certification_type');
  const aCertsArr = aCerts ?? [];
  const aCertsOnlyOwn = aCertsArr.every((c) => c.company_id === companyA.id);
  const aCertLeaks = aCertsArr.filter((c) => c.company_id === companyB.id);
  log(
    'User A sees ONLY Company A certifications',
    !aCertsErr && aCertsOnlyOwn && aCertLeaks.length === 0,
    aCertsErr
      ? `⚠️  Query error: ${aCertsErr.message}`
      : `Got ${aCertsArr.length} rows. ${aCertLeaks.length ? `⚠️  ${aCertLeaks.length} Company B rows leaked!` : 'No leaks.'}`
  );

  // ── data_call_responses ───
  console.log('\n─── data_call_responses ───');

  const { data: aDataCalls } = await clientA.from('data_call_responses').select('id, company_id');
  const aDataOnlyOwn = aDataCalls?.every((d) => d.company_id === companyA.id);
  const aDataLeaks = aDataCalls?.filter((d) => d.company_id === companyB.id);
  log(
    'User A sees ONLY Company A data call responses',
    aDataOnlyOwn && (aDataLeaks?.length === 0),
    `Got ${aDataCalls?.length} rows. ${aDataLeaks?.length ? `⚠️  ${aDataLeaks.length} Company B rows leaked!` : 'No leaks.'}`
  );

  // ── Cross-company direct ID lookup ───
  console.log('\n─── Direct ID lookup (User A fetching Company B by ID) ───');

  const { data: crossLookup, error: crossErr } = await clientA
    .from('company_profiles')
    .select('id, company_name')
    .eq('id', companyB.id)
    .maybeSingle();
  log(
    'User A CANNOT fetch Company B by direct ID',
    !crossLookup,
    crossLookup
      ? `⚠️  GOT Company B data: "${crossLookup.company_name}"`
      : 'Correctly returned null.'
  );

  // ── Step 5: Summary ───────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log('  RESULTS SUMMARY');
  console.log('══════════════════════════════════════════════════\n');

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`  ${passed} passed, ${failed} failed out of ${results.length} tests\n`);

  if (failed > 0) {
    console.log('  ⚠️  CRITICAL: RLS does NOT enforce tenant isolation!');
    console.log('  Authenticated users can read ALL companies\' data.');
    console.log('  The current policies (USING (true) / auth.role() = \'authenticated\')');
    console.log('  are effectively no-ops for multi-tenant isolation.\n');
    console.log('  DATA IS ONLY PROTECTED BY APPLICATION-LAYER FILTERING.');
    console.log('  If any API route misses a company_id filter, data leaks.\n');
  } else {
    console.log('  ✅ RLS properly enforces tenant isolation at the database level.\n');
  }

  // Cleanup
  await cleanup();
}

async function cleanup() {
  console.log('Cleaning up test users...');

  // Unlink users from companies before deleting
  if (testUserA) {
    await admin
      .from('company_profiles')
      .update({ client_user_id: null })
      .eq('client_user_id', testUserA.id);
    await admin.auth.admin.deleteUser(testUserA.id);
    console.log(`  Deleted User A: ${testUserA.id}`);
  }
  if (testUserB) {
    await admin
      .from('company_profiles')
      .update({ client_user_id: null })
      .eq('client_user_id', testUserB.id);
    await admin.auth.admin.deleteUser(testUserB.id);
    console.log(`  Deleted User B: ${testUserB.id}`);
  }

  // Remove test companies if we created them
  await admin
    .from('company_profiles')
    .delete()
    .like('company_name', '__RLS_TEST_CO_%');

  console.log('  Cleanup complete.\n');
}

main().catch(async (err) => {
  console.error('Unhandled error:', err);
  await cleanup();
  process.exit(1);
});
