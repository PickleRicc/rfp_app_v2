/**
 * Solicitation Compliance Extractor — Inngest Function
 * Phase 7: Compliance Extraction
 *
 * Triggered after reconciliation completes (solicitation.reconciliation.complete).
 * Runs nine extraction passes (Section L, Section M, Admin Data, Rating Scales,
 * SOW/PWS, Cost/Price, Past Performance, Key Personnel, Security Requirements)
 * using Claude, stores results in compliance_extractions table.
 *
 * Steps:
 * 1.  fetch-documents           — Load solicitation + documents, build document text corpus
 * 2.  extract-section-l         — AI extraction of volume structure, page limits, formatting rules
 * 3.  extract-section-m         — AI extraction of evaluation factors, methodology, thresholds
 * 4.  extract-admin-data        — AI extraction of NAICS, set-aside, contract type, PoP, CLINs
 * 5.  extract-rating-scales     — AI extraction of rating scale definitions and factor weightings
 * 6.  extract-sow-pws           — AI extraction of SOW/PWS/SOO, task areas, deliverables
 * 7.  extract-cost-price        — AI extraction of cost/price instructions, templates, breakouts
 * 8.  extract-past-performance  — AI extraction of past performance refs, recency, relevance
 * 9.  extract-key-personnel     — AI extraction of key positions, qualifications, clearance
 * 10. extract-security-reqs     — AI extraction of DD254, clearance, CMMC/NIST, CUI
 * 11. finalize                  — Count results, log summary
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
  extractSowPwsOverview,
  extractServiceAreaDetails,
  extractCostPrice,
  extractPastPerformance,
  extractKeyPersonnel,
  extractSecurityRequirements,
  extractOperationalContext,
  extractTechnologyRequirements,
  type ExtractionResult,
} from '@/lib/ingestion/compliance-extractor';
import type { ExtractionCategory } from '@/lib/supabase/compliance-types';
import type { SolicitationDocumentType } from '@/lib/supabase/solicitation-types';
import { logPipelineEvent } from '@/lib/logging/pipeline-logger';

// ===== HELPERS =====

/**
 * Document routing configuration: which document types each extraction category needs.
 * `primary` — the main sources for this category
 * `always`  — always appended (amendments/Q&A can modify anything)
 * `fallback` — used only if primary yields zero texts
 */
const EXTRACTION_ROUTING: Record<ExtractionCategory, {
  primary:  SolicitationDocumentType[];
  always:   SolicitationDocumentType[];
  fallback: SolicitationDocumentType[];
}> = {
  // NOTE: In task-order (IDIQ/SeaPort) and GSA schedule competitions, the main
  // solicitation document may be classified as soo_sow_pws instead of base_rfp
  // (e.g. a TOR or RFQ). Fallbacks include soo_sow_pws for base_rfp-dependent
  // categories, and vice versa, to handle this cross-classification.
  //
  // Amendments modify the BASE SOLICITATION (instructions, eval criteria, deadlines).
  // They do NOT modify standalone attachments (SOW/PWS, DD254, pricing templates).
  // If those attachments change, revised versions are uploaded as new documents.
  // Only categories sourced from the base solicitation include amendments in `always`.
  section_l:        { primary: ['base_rfp'],                          always: ['amendment', 'qa_response'], fallback: ['soo_sow_pws'] },
  section_m:        { primary: ['base_rfp'],                          always: ['amendment', 'qa_response'], fallback: ['soo_sow_pws'] },
  admin_data:       { primary: ['base_rfp', 'clauses'],               always: ['amendment'],                fallback: ['soo_sow_pws', 'provisions'] },
  rating_scales:    { primary: ['base_rfp'],                          always: ['amendment'],                fallback: ['soo_sow_pws'] },
  sow_pws:          { primary: ['soo_sow_pws', 'base_rfp'],          always: [],                           fallback: [] },
  cost_price:       { primary: ['base_rfp', 'pricing_template'],      always: ['amendment'],                fallback: ['soo_sow_pws'] },
  past_performance: { primary: ['base_rfp'],                          always: ['amendment'],                fallback: ['soo_sow_pws'] },
  key_personnel:    { primary: ['base_rfp', 'soo_sow_pws'],          always: ['amendment'],                fallback: [] },
  security_reqs:        { primary: ['dd254', 'base_rfp', 'clauses'],     always: [],                           fallback: ['soo_sow_pws', 'provisions'] },
  operational_context:  { primary: ['base_rfp', 'soo_sow_pws'],          always: ['amendment'],                fallback: [] },
  technology_reqs:      { primary: ['soo_sow_pws', 'base_rfp'],          always: ['amendment'],                fallback: [] },
};

/**
 * Select the right document texts for a given extraction category.
 * 1. Collect texts from `primary` doc types
 * 2. If primary yields nothing, try `fallback` types
 * 3. Always append `always` types (amendments can modify anything)
 */
function getDocumentsForCategory(
  category: ExtractionCategory,
  documentsByType: Record<string, string[]>
): string[] {
  const routing = EXTRACTION_ROUTING[category];
  if (!routing) {
    // Unknown category — return all documents as safe fallback
    return Object.values(documentsByType).flat();
  }

  // 1. Collect primary texts
  let texts: string[] = [];
  let source: 'primary' | 'fallback' | 'all-docs' = 'primary';
  const primaryCounts: Record<string, number> = {};
  for (const docType of routing.primary) {
    const docs = documentsByType[docType] || [];
    primaryCounts[docType] = docs.length;
    texts.push(...docs);
  }

  // 2. If primary is empty, try fallback
  const fallbackCounts: Record<string, number> = {};
  if (texts.length === 0 && routing.fallback.length > 0) {
    source = 'fallback';
    for (const docType of routing.fallback) {
      const docs = documentsByType[docType] || [];
      fallbackCounts[docType] = docs.length;
      texts.push(...docs);
    }
  }

  // 3. Always append "always" types (deduplicating if already present)
  const alwaysCounts: Record<string, number> = {};
  for (const docType of routing.always) {
    const docs = documentsByType[docType] || [];
    alwaysCounts[docType] = docs.length;
    for (const t of docs) {
      if (!texts.includes(t)) {
        texts.push(t);
      }
    }
  }

  // 4. Universal fallback: if still empty, use ALL available documents
  //    Handles cases where expected doc types (e.g. base_rfp) don't exist
  if (texts.length === 0) {
    source = 'all-docs';
    texts = Object.values(documentsByType).flat();
  }

  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  console.log(
    `[doc-routing] ${category}: ${texts.length} docs (${Math.round(totalChars / 1000)}K chars) via ${source} | ` +
    `primary=${JSON.stringify(primaryCounts)} ` +
    (Object.keys(fallbackCounts).length > 0 ? `fallback=${JSON.stringify(fallbackCounts)} ` : '') +
    `always=${JSON.stringify(alwaysCounts)}`
  );

  return texts;
}

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
    const { solicitationId, category: targetCategory } = event.data as {
      solicitationId: string;
      category?: ExtractionCategory; // When set, only re-extract this category
    };

    // Helper: should we run this extraction step?
    const shouldExtract = (cat: ExtractionCategory) => !targetCategory || targetCategory === cat;

    // ─── Step 1: Fetch documents and build text corpus ───────────────────────
    const { documentsByType, primaryDocumentId, availableTypes } = await step.run('fetch-documents', async () => {
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

      // Diagnostic: log every document's type, status, and text availability
      console.log(`[doc-routing] fetch-documents: ${allDocs.length} total docs for solicitation ${solicitationId}`);
      for (const doc of allDocs) {
        console.log(
          `[doc-routing]   doc=${doc.id} type=${doc.document_type} ` +
          `superseded=${doc.is_superseded} has_text=${!!doc.extracted_text} ` +
          `text_len=${doc.extracted_text?.length || 0}`
        );
      }

      // Build document texts grouped by type for targeted routing
      // Skip superseded documents — their content has been replaced
      const documentsByType: Record<string, string[]> = {};
      let primaryDocumentId: string | null = null;

      for (const doc of allDocs) {
        if (!doc.extracted_text) continue;
        if (doc.is_superseded) continue;

        const docType = doc.document_type || 'other_unclassified';
        if (!documentsByType[docType]) {
          documentsByType[docType] = [];
        }
        documentsByType[docType].push(doc.extracted_text);

        if ((docType === 'base_rfp' || docType === 'soo_sow_pws') && !primaryDocumentId) {
          primaryDocumentId = doc.id;
        }
      }

      const availableTypes = Object.keys(documentsByType);
      const totalTexts = Object.values(documentsByType).reduce((sum, arr) => sum + arr.length, 0);

      await logProcessingEvent(null, 'solicitation-compliance-extractor', 'started', {
        step:             'fetch-documents',
        solicitation_id:  solicitationId,
        document_count:   allDocs.length,
        text_sources:     totalTexts,
        available_types:  availableTypes,
        docs_per_type:    Object.fromEntries(availableTypes.map(t => [t, documentsByType[t].length])),
      });

      return { documentsByType, primaryDocumentId, availableTypes };
    });

    // ─── Step 2: Extract Section L ───────────────────────────────────────────
    const sectionLStats = await step.run('extract-section-l', async () => {
      if (!shouldExtract('section_l')) return { fields: 0, upserted: 0, failed: false, skipped: true };
      const supabase = getServerClient();

      // Mark section_l fields as 'extracting'
      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'section_l')
        .eq('extraction_status', 'pending');

      try {
        const targetDocs = getDocumentsForCategory('section_l', documentsByType);
        const results = await extractSectionL(targetDocs);
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
      if (!shouldExtract('section_m')) return { fields: 0, upserted: 0, failed: false, skipped: true };
      const supabase = getServerClient();

      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'section_m')
        .eq('extraction_status', 'pending');

      try {
        const targetDocs = getDocumentsForCategory('section_m', documentsByType);
        const results = await extractSectionM(targetDocs);
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
      if (!shouldExtract('admin_data')) return { fields: 0, upserted: 0, failed: false, skipped: true };
      const supabase = getServerClient();

      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'admin_data')
        .eq('extraction_status', 'pending');

      try {
        const targetDocs = getDocumentsForCategory('admin_data', documentsByType);
        const results = await extractAdminData(targetDocs);
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
      if (!shouldExtract('rating_scales')) return { fields: 0, upserted: 0, failed: false, skipped: true };
      const supabase = getServerClient();

      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'rating_scales')
        .eq('extraction_status', 'pending');

      try {
        const targetDocs = getDocumentsForCategory('rating_scales', documentsByType);
        const results = await extractRatingScales(targetDocs);
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

    // ─── Step 6a: Extract SOW / PWS / SOO Overview (Pass 1) ──────────────────
    const sowPwsOverviewStats = await step.run('extract-sow-pws-overview', async () => {
      if (!shouldExtract('sow_pws')) return { fields: 0, upserted: 0, failed: false, skipped: true, serviceAreaCount: 0 };
      const supabase = getServerClient();

      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'sow_pws')
        .eq('extraction_status', 'pending');

      try {
        const targetDocs = getDocumentsForCategory('sow_pws', documentsByType);
        const results = await extractSowPwsOverview(targetDocs);
        const upsertedCount = await upsertExtractions(
          solicitationId,
          'sow_pws',
          results,
          primaryDocumentId
        );

        // Count service areas for Pass 2
        const serviceAreaIndex = results.find(r => r.field_name === 'service_area_index');
        const serviceAreaCount = Array.isArray(serviceAreaIndex?.field_value)
          ? (serviceAreaIndex.field_value as Array<{ code: string; name: string }>).length
          : 0;

        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'completed', {
          step:              'extract-sow-pws-overview',
          fields_extracted:  results.length,
          fields_upserted:   upsertedCount,
          service_areas_found: serviceAreaCount,
        });

        return { fields: results.length, upserted: upsertedCount, failed: false, serviceAreaCount };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('SOW/PWS overview extraction failed:', errMsg);
        await markCategoryFailed(solicitationId, 'sow_pws', errMsg);
        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'failed', {
          step:  'extract-sow-pws-overview',
          error: errMsg,
        });
        return { fields: 0, upserted: 0, failed: true, error: errMsg, serviceAreaCount: 0 };
      }
    });

    // ─── Step 6b: Extract SOW/PWS Service Area Details (Pass 2) ────────────
    const sowPwsDetailStats = await step.run('extract-sow-pws-details', async () => {
      if (!shouldExtract('sow_pws')) return { fields: 0, upserted: 0, failed: false, skipped: true };
      if (sowPwsOverviewStats.failed || sowPwsOverviewStats.serviceAreaCount === 0) {
        return { fields: 0, upserted: 0, failed: false, skipped: true, reason: 'no service areas from overview' };
      }

      const supabase = getServerClient();

      // Read the service_area_index from the DB (written by Pass 1)
      const { data: indexRow } = await supabase
        .from('compliance_extractions')
        .select('field_value')
        .eq('solicitation_id', solicitationId)
        .eq('field_name', 'service_area_index')
        .maybeSingle();

      const serviceAreas = (indexRow?.field_value as Array<{ code: string; name: string; summary: string }>) || [];

      if (serviceAreas.length === 0) {
        return { fields: 0, upserted: 0, failed: false, skipped: true, reason: 'empty service_area_index' };
      }

      const targetDocs = getDocumentsForCategory('sow_pws', documentsByType);
      let totalFields = 0;
      let totalUpserted = 0;
      const areaResults: Array<{ code: string; name: string; success: boolean }> = [];

      for (const area of serviceAreas) {
        try {
          const results = await extractServiceAreaDetails(targetDocs, area.code, area.name);
          const upsertedCount = await upsertExtractions(
            solicitationId,
            'sow_pws',
            results,
            primaryDocumentId
          );
          totalFields += results.length;
          totalUpserted += upsertedCount;
          areaResults.push({ code: area.code, name: area.name, success: true });
        } catch (err) {
          console.error(`Service area ${area.code} extraction failed:`, err instanceof Error ? err.message : String(err));
          areaResults.push({ code: area.code, name: area.name, success: false });
        }
      }

      await logProcessingEvent(null, 'solicitation-compliance-extractor', 'completed', {
        step:             'extract-sow-pws-details',
        total_areas:      serviceAreas.length,
        areas_succeeded:  areaResults.filter(a => a.success).length,
        areas_failed:     areaResults.filter(a => !a.success).length,
        fields_extracted: totalFields,
        fields_upserted:  totalUpserted,
      });

      return { fields: totalFields, upserted: totalUpserted, failed: false, areaResults };
    });

    // Combine overview + detail stats for finalize
    const sowPwsStats = {
      fields: (sowPwsOverviewStats.fields || 0) + (sowPwsDetailStats.fields || 0),
      upserted: (sowPwsOverviewStats.upserted || 0) + (sowPwsDetailStats.upserted || 0),
      failed: sowPwsOverviewStats.failed,
    };

    // ─── Step 7: Extract Cost / Price ─────────────────────────────────────────
    const costPriceStats = await step.run('extract-cost-price', async () => {
      if (!shouldExtract('cost_price')) return { fields: 0, upserted: 0, failed: false, skipped: true };
      const supabase = getServerClient();

      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'cost_price')
        .eq('extraction_status', 'pending');

      try {
        const targetDocs = getDocumentsForCategory('cost_price', documentsByType);
        const results = await extractCostPrice(targetDocs);
        const upsertedCount = await upsertExtractions(
          solicitationId,
          'cost_price',
          results,
          primaryDocumentId
        );

        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'completed', {
          step:             'extract-cost-price',
          fields_extracted: results.length,
          fields_upserted:  upsertedCount,
        });

        return { fields: results.length, upserted: upsertedCount, failed: false };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('Cost/Price extraction failed:', errMsg);
        await markCategoryFailed(solicitationId, 'cost_price', errMsg);
        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'failed', {
          step:  'extract-cost-price',
          error: errMsg,
        });
        return { fields: 0, upserted: 0, failed: true, error: errMsg };
      }
    });

    // ─── Step 8: Extract Past Performance ─────────────────────────────────────
    const pastPerformanceStats = await step.run('extract-past-performance', async () => {
      if (!shouldExtract('past_performance')) return { fields: 0, upserted: 0, failed: false, skipped: true };
      const supabase = getServerClient();

      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'past_performance')
        .eq('extraction_status', 'pending');

      try {
        const targetDocs = getDocumentsForCategory('past_performance', documentsByType);
        const results = await extractPastPerformance(targetDocs);
        const upsertedCount = await upsertExtractions(
          solicitationId,
          'past_performance',
          results,
          primaryDocumentId
        );

        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'completed', {
          step:             'extract-past-performance',
          fields_extracted: results.length,
          fields_upserted:  upsertedCount,
        });

        return { fields: results.length, upserted: upsertedCount, failed: false };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('Past Performance extraction failed:', errMsg);
        await markCategoryFailed(solicitationId, 'past_performance', errMsg);
        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'failed', {
          step:  'extract-past-performance',
          error: errMsg,
        });
        return { fields: 0, upserted: 0, failed: true, error: errMsg };
      }
    });

    // ─── Step 9: Extract Key Personnel ────────────────────────────────────────
    const keyPersonnelStats = await step.run('extract-key-personnel', async () => {
      if (!shouldExtract('key_personnel')) return { fields: 0, upserted: 0, failed: false, skipped: true };
      const supabase = getServerClient();

      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'key_personnel')
        .eq('extraction_status', 'pending');

      try {
        const targetDocs = getDocumentsForCategory('key_personnel', documentsByType);
        const results = await extractKeyPersonnel(targetDocs);
        const upsertedCount = await upsertExtractions(
          solicitationId,
          'key_personnel',
          results,
          primaryDocumentId
        );

        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'completed', {
          step:             'extract-key-personnel',
          fields_extracted: results.length,
          fields_upserted:  upsertedCount,
        });

        return { fields: results.length, upserted: upsertedCount, failed: false };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('Key Personnel extraction failed:', errMsg);
        await markCategoryFailed(solicitationId, 'key_personnel', errMsg);
        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'failed', {
          step:  'extract-key-personnel',
          error: errMsg,
        });
        return { fields: 0, upserted: 0, failed: true, error: errMsg };
      }
    });

    // ─── Step 10: Extract Security Requirements ───────────────────────────────
    const securityReqsStats = await step.run('extract-security-reqs', async () => {
      if (!shouldExtract('security_reqs')) return { fields: 0, upserted: 0, failed: false, skipped: true };
      const supabase = getServerClient();

      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'security_reqs')
        .eq('extraction_status', 'pending');

      try {
        const targetDocs = getDocumentsForCategory('security_reqs', documentsByType);
        const results = await extractSecurityRequirements(targetDocs);
        const upsertedCount = await upsertExtractions(
          solicitationId,
          'security_reqs',
          results,
          primaryDocumentId
        );

        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'completed', {
          step:             'extract-security-reqs',
          fields_extracted: results.length,
          fields_upserted:  upsertedCount,
        });

        return { fields: results.length, upserted: upsertedCount, failed: false };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('Security Requirements extraction failed:', errMsg);
        await markCategoryFailed(solicitationId, 'security_reqs', errMsg);
        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'failed', {
          step:  'extract-security-reqs',
          error: errMsg,
        });
        return { fields: 0, upserted: 0, failed: true, error: errMsg };
      }
    });

    // ─── Step 11: Extract Operational Context ─────────────────────────────────
    const operationalContextStats = await step.run('extract-operational-context', async () => {
      if (!shouldExtract('operational_context')) return { fields: 0, upserted: 0, failed: false, skipped: true };
      const supabase = getServerClient();

      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'operational_context')
        .eq('extraction_status', 'pending');

      try {
        const targetDocs = getDocumentsForCategory('operational_context', documentsByType);
        const results = await extractOperationalContext(targetDocs);
        const upsertedCount = await upsertExtractions(
          solicitationId,
          'operational_context',
          results,
          primaryDocumentId
        );

        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'completed', {
          step:             'extract-operational-context',
          fields_extracted: results.length,
          fields_upserted:  upsertedCount,
        });

        return { fields: results.length, upserted: upsertedCount, failed: false };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('Operational Context extraction failed:', errMsg);
        await markCategoryFailed(solicitationId, 'operational_context', errMsg);
        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'failed', {
          step:  'extract-operational-context',
          error: errMsg,
        });
        return { fields: 0, upserted: 0, failed: true, error: errMsg };
      }
    });

    // ─── Step 12: Extract Technology Requirements ───────────────────────────
    const technologyReqsStats = await step.run('extract-technology-reqs', async () => {
      if (!shouldExtract('technology_reqs')) return { fields: 0, upserted: 0, failed: false, skipped: true };
      const supabase = getServerClient();

      await supabase
        .from('compliance_extractions')
        .update({ extraction_status: 'extracting', updated_at: new Date().toISOString() })
        .eq('solicitation_id', solicitationId)
        .eq('category', 'technology_reqs')
        .eq('extraction_status', 'pending');

      try {
        const targetDocs = getDocumentsForCategory('technology_reqs', documentsByType);
        const results = await extractTechnologyRequirements(targetDocs);
        const upsertedCount = await upsertExtractions(
          solicitationId,
          'technology_reqs',
          results,
          primaryDocumentId
        );

        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'completed', {
          step:             'extract-technology-reqs',
          fields_extracted: results.length,
          fields_upserted:  upsertedCount,
        });

        return { fields: results.length, upserted: upsertedCount, failed: false };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('Technology Requirements extraction failed:', errMsg);
        await markCategoryFailed(solicitationId, 'technology_reqs', errMsg);
        await logProcessingEvent(null, 'solicitation-compliance-extractor', 'failed', {
          step:  'extract-technology-reqs',
          error: errMsg,
        });
        return { fields: 0, upserted: 0, failed: true, error: errMsg };
      }
    });

    // ─── Step 13: Finalize ────────────────────────────────────────────────────
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

      const finalizeMeta = {
        step:                    'finalize',
        solicitation_id:         solicitationId,
        total_completed:         completedCount,
        total_failed:            failedCount,
        available_types:         availableTypes,
        docs_per_type:           Object.fromEntries(
          Object.entries(documentsByType).map(([t, arr]) => [t, arr.length])
        ),
        section_l_fields:           sectionLStats.upserted,
        section_m_fields:           sectionMStats.upserted,
        admin_data_fields:          adminDataStats.upserted,
        rating_scales_fields:       ratingScalesStats.upserted,
        sow_pws_fields:             sowPwsStats.upserted,
        cost_price_fields:          costPriceStats.upserted,
        past_performance_fields:    pastPerformanceStats.upserted,
        key_personnel_fields:       keyPersonnelStats.upserted,
        security_reqs_fields:       securityReqsStats.upserted,
        operational_context_fields: operationalContextStats.upserted,
        technology_reqs_fields:     technologyReqsStats.upserted,
      };

      await logProcessingEvent(null, 'solicitation-compliance-extractor', 'completed', finalizeMeta);

      // Centralized pipeline logging — solicitation-scoped
      await logPipelineEvent(solicitationId, 'finalize', 'completed', {
        output_summary: finalizeMeta,
      });

      return {
        completed: completedCount,
        failed:    failedCount,
        sections: {
          section_l:           sectionLStats,
          section_m:           sectionMStats,
          admin_data:          adminDataStats,
          rating_scales:       ratingScalesStats,
          sow_pws:             sowPwsStats,
          cost_price:          costPriceStats,
          past_performance:    pastPerformanceStats,
          key_personnel:       keyPersonnelStats,
          security_reqs:       securityReqsStats,
          operational_context: operationalContextStats,
          technology_reqs:     technologyReqsStats,
        },
      };
    });

    return {
      solicitationId,
      summary,
    };
  }
);
