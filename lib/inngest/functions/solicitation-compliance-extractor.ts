/**
 * Solicitation Compliance Extractor — Inngest Function
 * Phase 7: Compliance Extraction
 *
 * Triggered after reconciliation completes (solicitation.reconciliation.complete).
 * Runs four parallel extraction passes (Section L, Section M, Admin Data, Rating Scales)
 * using Claude, stores results in compliance_extractions table.
 *
 * Steps:
 * 1. fetch-documents       — Load solicitation + documents, build document text corpus
 * 2. extract-section-l     — AI extraction of volume structure, page limits, formatting rules
 * 3. extract-section-m     — AI extraction of evaluation factors, methodology, thresholds
 * 4. extract-admin-data    — AI extraction of NAICS, set-aside, contract type, PoP, CLINs
 * 5. extract-rating-scales — AI extraction of rating scale definitions and factor weightings
 * 6. finalize              — Count results, log summary
 *
 * Error isolation: Each extraction step catches its own errors and continues.
 * A failure in Section L does not prevent Section M extraction.
 *
 * Per user decision: "Each section updates independently as extraction completes"
 *
 * Event trigger: 'solicitation.reconciliation.complete'
 * Event payload: { solicitationId: string }
 */

import { inngest } from '../client';
import { getServerClient } from '@/lib/supabase/client';
import {
  extractSectionL,
  extractSectionM,
  extractAdminData,
  extractRatingScales,
  type ExtractionResult,
} from '@/lib/ingestion/compliance-extractor';
import type { ExtractionCategory } from '@/lib/supabase/compliance-types';

// ===== HELPERS =====

/**
 * Log a processing event to the processing_logs table.
 * Silently swallows errors — logging should never block pipeline progress.
 */
async function logProcessingEvent(
  documentId: string | null,
  stage: string,
  status: 'started' | 'completed' | 'failed',
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getServerClient();
    await supabase.from('processing_logs').insert({
      document_id: documentId,
      stage,
      status,
      metadata,
    });
  } catch {
    // Non-blocking — logging failures don't affect pipeline
  }
}

/**
 * Upsert extraction results to the compliance_extractions table.
 * Matches on (solicitation_id, field_name) to handle re-extraction.
 * Preserves user overrides: if is_user_override=true, skip update for that row.
 *
 * @returns Count of rows successfully upserted
 */
async function upsertExtractions(
  solicitationId: string,
  category: ExtractionCategory,
  results: ExtractionResult[],
  sourceDocumentId: string | null
): Promise<number> {
  if (results.length === 0) return 0;

  const supabase = getServerClient();
  let upsertedCount = 0;

  for (const result of results) {
    // Check if a user override exists for this field — skip update if so
    const { data: existing } = await supabase
      .from('compliance_extractions')
      .select('id, is_user_override')
      .eq('solicitation_id', solicitationId)
      .eq('field_name', result.field_name)
      .maybeSingle();

    if (existing?.is_user_override) {
      // Preserve user override — do not overwrite with AI re-extraction
      continue;
    }

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('compliance_extractions')
        .update({
          field_value:       result.field_value,
          confidence:        result.confidence,
          extraction_status: 'completed',
          error_message:     null,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (!error) upsertedCount++;
      else console.error(`Failed to update extraction ${existing.id}:`, error);
    } else {
      // Insert new record
      const { error } = await supabase.from('compliance_extractions').insert({
        solicitation_id:   solicitationId,
        source_document_id: sourceDocumentId,
        category,
        field_name:        result.field_name,
        field_label:       result.field_label,
        field_value:       result.field_value,
        confidence:        result.confidence,
        extraction_status: 'completed',
        is_user_override:  false,
      });

      if (!error) upsertedCount++;
      else console.error(`Failed to insert extraction for field ${result.field_name}:`, error);
    }
  }

  return upsertedCount;
}

/**
 * Mark all extractions for a category as failed with an error message.
 * Called when the extraction function itself throws an unrecoverable error.
 */
async function markCategoryFailed(
  solicitationId: string,
  category: ExtractionCategory,
  errorMessage: string
): Promise<void> {
  const supabase = getServerClient();
  await supabase
    .from('compliance_extractions')
    .update({
      extraction_status: 'failed',
      error_message:     errorMessage,
      updated_at:        new Date().toISOString(),
    })
    .eq('solicitation_id', solicitationId)
    .eq('category', category)
    .eq('extraction_status', 'extracting');
}

// ===== INNGEST FUNCTION =====

export const solicitationComplianceExtractor = inngest.createFunction(
  { id: 'solicitation-compliance-extractor' },
  { event: 'solicitation.reconciliation.complete' },
  async ({ event, step }) => {
    const { solicitationId } = event.data as { solicitationId: string };

    // ─── Step 1: Fetch documents and build text corpus ───────────────────────
    const { documentTexts, primaryDocumentId } = await step.run('fetch-documents', async () => {
      const supabase = getServerClient();

      // Verify solicitation exists
      const { data: sol, error: solError } = await supabase
        .from('solicitations')
        .select('id, status')
        .eq('id', solicitationId)
        .single();

      if (solError || !sol) {
        throw new Error(`Solicitation ${solicitationId} not found`);
      }

      // Fetch reconciled documents with extracted text
      // Priority: base_rfp and soo_sow_pws contain Section L/M/admin data
      const { data: documents, error: docsError } = await supabase
        .from('solicitation_documents')
        .select('id, document_type, extracted_text, is_superseded')
        .eq('solicitation_id', solicitationId)
        .in('processing_status', ['reconciled', 'classified'])
        .order('sort_order', { ascending: true });

      if (docsError) {
        throw new Error(`Failed to fetch documents: ${docsError.message}`);
      }

      const allDocs = documents || [];

      // Build ordered text corpus: base docs first, then amendments, then others
      // Skip superseded documents — their content has been replaced
      const baseTexts: string[] = [];
      const amendmentTexts: string[] = [];
      const otherTexts: string[] = [];
      let primaryDocumentId: string | null = null;

      for (const doc of allDocs) {
        if (!doc.extracted_text) continue;
        if (doc.is_superseded) continue; // Skip superseded documents

        if (doc.document_type === 'base_rfp' || doc.document_type === 'soo_sow_pws') {
          baseTexts.push(doc.extracted_text);
          if (!primaryDocumentId) primaryDocumentId = doc.id;
        } else if (doc.document_type === 'amendment' || doc.document_type === 'qa_response') {
          amendmentTexts.push(doc.extracted_text);
        } else {
          otherTexts.push(doc.extracted_text);
        }
      }

      // Combine: base first (most important), then amendments (may contain Section L/M changes)
      const documentTexts = [...baseTexts, ...amendmentTexts, ...otherTexts];

      await logProcessingEvent(null, 'solicitation-compliance-extractor', 'started', {
        step:             'fetch-documents',
        solicitation_id:  solicitationId,
        document_count:   allDocs.length,
        text_sources:     documentTexts.length,
      });

      return { documentTexts, primaryDocumentId };
    });

    // ─── Step 2: Extract Section L ───────────────────────────────────────────
    const sectionLStats = await step.run('extract-section-l', async () => {
      const supabase = getServerClient();

      // Mark section_l fields as 'extracting'
      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'section_l')
        .eq('extraction_status', 'pending');

      try {
        const results = await extractSectionL(documentTexts);
        const upsertedCount = await upsertExtractions(
          solicitationId,
          'section_l',
          results,
          primaryDocumentId
        );

        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'completed', {
          step:              'extract-section-l',
          fields_extracted:  results.length,
          fields_upserted:   upsertedCount,
        });

        return { fields: results.length, upserted: upsertedCount, failed: false };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('Section L extraction failed:', errMsg);
        await markCategoryFailed(solicitationId, 'section_l', errMsg);
        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'failed', {
          step:  'extract-section-l',
          error: errMsg,
        });
        // Return instead of throw — error isolation: continue to next step
        return { fields: 0, upserted: 0, failed: true, error: errMsg };
      }
    });

    // ─── Step 3: Extract Section M ───────────────────────────────────────────
    const sectionMStats = await step.run('extract-section-m', async () => {
      const supabase = getServerClient();

      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'section_m')
        .eq('extraction_status', 'pending');

      try {
        const results = await extractSectionM(documentTexts);
        const upsertedCount = await upsertExtractions(
          solicitationId,
          'section_m',
          results,
          primaryDocumentId
        );

        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'completed', {
          step:             'extract-section-m',
          fields_extracted: results.length,
          fields_upserted:  upsertedCount,
        });

        return { fields: results.length, upserted: upsertedCount, failed: false };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('Section M extraction failed:', errMsg);
        await markCategoryFailed(solicitationId, 'section_m', errMsg);
        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'failed', {
          step:  'extract-section-m',
          error: errMsg,
        });
        return { fields: 0, upserted: 0, failed: true, error: errMsg };
      }
    });

    // ─── Step 4: Extract Admin Data ──────────────────────────────────────────
    const adminDataStats = await step.run('extract-admin-data', async () => {
      const supabase = getServerClient();

      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'admin_data')
        .eq('extraction_status', 'pending');

      try {
        const results = await extractAdminData(documentTexts);
        const upsertedCount = await upsertExtractions(
          solicitationId,
          'admin_data',
          results,
          primaryDocumentId
        );

        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'completed', {
          step:             'extract-admin-data',
          fields_extracted: results.length,
          fields_upserted:  upsertedCount,
        });

        return { fields: results.length, upserted: upsertedCount, failed: false };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('Admin data extraction failed:', errMsg);
        await markCategoryFailed(solicitationId, 'admin_data', errMsg);
        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'failed', {
          step:  'extract-admin-data',
          error: errMsg,
        });
        return { fields: 0, upserted: 0, failed: true, error: errMsg };
      }
    });

    // ─── Step 5: Extract Rating Scales ───────────────────────────────────────
    const ratingScalesStats = await step.run('extract-rating-scales', async () => {
      const supabase = getServerClient();

      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'rating_scales')
        .eq('extraction_status', 'pending');

      try {
        const results = await extractRatingScales(documentTexts);
        const upsertedCount = await upsertExtractions(
          solicitationId,
          'rating_scales',
          results,
          primaryDocumentId
        );

        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'completed', {
          step:             'extract-rating-scales',
          fields_extracted: results.length,
          fields_upserted:  upsertedCount,
        });

        return { fields: results.length, upserted: upsertedCount, failed: false };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('Rating scales extraction failed:', errMsg);
        await markCategoryFailed(solicitationId, 'rating_scales', errMsg);
        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'failed', {
          step:  'extract-rating-scales',
          error: errMsg,
        });
        return { fields: 0, upserted: 0, failed: true, error: errMsg };
      }
    });

    // ─── Step 6: Finalize ─────────────────────────────────────────────────────
    const summary = await step.run('finalize', async () => {
      const supabase = getServerClient();

      // Count completed vs failed extractions across all categories
      const { data: completedRows } = await supabase
        .from('compliance_extractions')
        .select('id')
        .eq('solicitation_id', solicitationId)
        .eq('extraction_status', 'completed');

      const { data: failedRows } = await supabase
        .from('compliance_extractions')
        .select('id')
        .eq('solicitation_id', solicitationId)
        .eq('extraction_status', 'failed');

      const completedCount = completedRows?.length || 0;
      const failedCount = failedRows?.length || 0;

      await logProcessingEvent(null, 'solicitation-compliance-extractor', 'completed', {
        step:              'finalize',
        solicitation_id:   solicitationId,
        total_completed:   completedCount,
        total_failed:      failedCount,
        section_l_fields:  sectionLStats.upserted,
        section_m_fields:  sectionMStats.upserted,
        admin_data_fields: adminDataStats.upserted,
        rating_scales_fields: ratingScalesStats.upserted,
      });

      return {
        completed: completedCount,
        failed:    failedCount,
        sections: {
          section_l:     sectionLStats,
          section_m:     sectionMStats,
          admin_data:    adminDataStats,
          rating_scales: ratingScalesStats,
        },
      };
    });

    return {
      solicitationId,
      summary,
    };
  }
);
