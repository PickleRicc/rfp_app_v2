/**
 * Backfill script: Extract text from existing PDF data_call_files
 *
 * Usage:
 *   1. Start the Python PDF service: cd pdf-service && python main.py
 *   2. Run: npx tsx scripts/backfill-datacall-file-text.ts
 *
 * Prerequisites:
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - Python PDF service running on PDF_SERVICE_URL (default: http://localhost:8000)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'http://localhost:8000';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function backfill() {
  console.log('Fetching data_call_files with no extracted_text...');

  const { data: files, error } = await supabase
    .from('data_call_files')
    .select('id, file_path, filename, mime_type')
    .is('extracted_text', null)
    .eq('mime_type', 'application/pdf');

  if (error) {
    console.error('Failed to fetch files:', error.message);
    process.exit(1);
  }

  if (!files || files.length === 0) {
    console.log('No files need backfill.');
    return;
  }

  console.log(`Found ${files.length} PDFs to process.\n`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    process.stdout.write(`[${success + failed + 1}/${files.length}] ${file.filename}... `);

    try {
      const { data: blob, error: dlError } = await supabase.storage
        .from('data-call-files')
        .download(file.file_path);

      if (dlError || !blob) {
        console.log(`SKIP (download failed: ${dlError?.message})`);
        failed++;
        continue;
      }

      const formData = new FormData();
      formData.append('file', blob, file.filename);

      const response = await fetch(`${PDF_SERVICE_URL}/extract-text`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.log(`SKIP (PDF service returned ${response.status})`);
        failed++;
        continue;
      }

      const result = await response.json() as { text?: string };
      const text = result.text || null;

      if (!text) {
        console.log('SKIP (no text extracted)');
        failed++;
        continue;
      }

      const { error: updateError } = await supabase
        .from('data_call_files')
        .update({ extracted_text: text })
        .eq('id', file.id);

      if (updateError) {
        console.log(`FAIL (update: ${updateError.message})`);
        failed++;
      } else {
        console.log(`OK (${text.length} chars)`);
        success++;
      }
    } catch (err) {
      console.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}, Total: ${files.length}`);
}

backfill().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
