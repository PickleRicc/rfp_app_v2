#!/usr/bin/env node
/**
 * Applies the RLS tenant isolation migration by executing SQL statements
 * against the Supabase database using the service role key.
 *
 * Strategy: Create a temporary plpgsql function that runs the migration,
 * call it, then drop it.
 */

import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

// Execute raw SQL via Supabase's PostgREST by creating a temporary function
async function execSQL(sql) {
  // Wrap in a function so we can call it via RPC
  const funcName = `_tmp_migration_${Date.now()}`;
  const createFunc = `
    CREATE OR REPLACE FUNCTION ${funcName}()
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, auth
    AS $fn$
    BEGIN
      ${sql}
    END;
    $fn$;
  `;

  // Use the Supabase REST endpoint to create the function
  // The service role key bypasses RLS
  const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  // Step 1: Create the function via a raw SQL call using /rest/v1/rpc
  // We need to use an existing function to bootstrap.
  // Let's use a different approach: POST the SQL directly to Supabase's SQL endpoint

  // Supabase exposes a SQL endpoint at /pg/query for the Management API
  // But we can also use the postgres meta API

  // Alternative: use the /rest/v1/ endpoint with raw SQL function creation
  // Actually, let's try the direct SQL endpoint
  const sqlEndpoint = `${SUPABASE_URL}/rest/v1/rpc/`;

  // First, try to see if we can use the pg_net or any built-in function
  // The cleanest approach is to POST to the Supabase SQL HTTP endpoint
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${funcName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  return resp;
}

// Since we can't execute raw DDL via PostgREST, let's use the
// Supabase Management API endpoint instead
async function applyMigration() {
  const fs = await import('fs');
  const sql = fs.readFileSync(
    new URL('../supabase_tables/supabase-rls-tenant-isolation-migration.sql', import.meta.url),
    'utf8'
  );

  // Extract the project ref from the URL
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

  console.log(`Project ref: ${projectRef}`);
  console.log('Attempting to apply migration...\n');

  // Try the Supabase Management API SQL endpoint
  // This uses the project's service role key for auth
  const resp = await fetch(`${SUPABASE_URL}/sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (resp.ok) {
    console.log('Migration applied successfully via /sql endpoint!');
    return true;
  }

  console.log(`/sql endpoint returned ${resp.status}: ${await resp.text()}`);
  console.log('\nTrying alternative: pg_query endpoint...');

  // Try the pg query endpoint
  const resp2 = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (resp2.ok) {
    console.log('Migration applied successfully via /pg/query endpoint!');
    return true;
  }

  console.log(`/pg/query endpoint returned ${resp2.status}: ${await resp2.text()}`);

  // If both fail, output instructions for manual application
  console.log('\n══════════════════════════════════════════════════');
  console.log('  MANUAL APPLICATION REQUIRED');
  console.log('══════════════════════════════════════════════════');
  console.log('\nThe migration SQL cannot be applied programmatically without');
  console.log('either a database password or Supabase access token.');
  console.log('\nTo apply the migration:');
  console.log('  1. Go to your Supabase Dashboard → SQL Editor');
  console.log(`     ${SUPABASE_URL.replace('.supabase.co', '.supabase.com')}/project/${projectRef}/sql`);
  console.log('  2. Paste the contents of:');
  console.log('     supabase_tables/supabase-rls-tenant-isolation-migration.sql');
  console.log('  3. Click "Run"');
  console.log('\nOR use the CLI:');
  console.log('  npx supabase login');
  console.log(`  npx supabase link --project-ref ${projectRef}`);
  console.log('  npx supabase db query --linked -f supabase_tables/supabase-rls-tenant-isolation-migration.sql');

  return false;
}

applyMigration().catch(console.error);
