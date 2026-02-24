/**
 * Solicitation Reconciler — Inngest Function
 * Phase 6: Multi-Document Ingestion
 *
 * Triggered after all documents in a solicitation are classified.
 * Orchestrates the full reconciliation pipeline:
 *   1. fetch-documents     — Load all classified docs, separate by type
 *   2. reconcile-amendments — AI comparison of amendments vs base RFP
 *   3. parse-qa            — AI parsing of Q&A modification answers
 *   4. detect-templates    — AI field detection in pricing templates and forms
 *   5. finalize            — Mark solicitation as ready
 *
 * Error handling: Each step is isolated. A failure in processing one document
 * logs the error and continues processing remaining documents. The solicitation
 * is only marked 'failed' if ALL documents fail.
 *
 * Event trigger: 'solicitation.classification.complete'
 * Event payload: { solicitationId: string }
 */

import { inngest } from '../client';
import { getServerClient } from '@/lib/supabase/client';
import { reconcileAmendments, parseQAModifications } from '@/lib/ingestion/reconciliation-engine';
import { detectTemplateFields } from '@/lib/ingestion/template-detector';
import type { SolicitationDocument } from '@/lib/supabase/solicitation-types';

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
 * Attempt to auto-fill a template field value from company_profiles or solicitation data.
 * Maps dot-notation auto_fill_source paths to actual data values.
 *
 * @returns The resolved value string, or null if cannot auto-fill
 */
function resolveAutoFillValue(
  autoFillSource: string | null,
  companyProfile: Record<string, unknown> | null,
  solicitation: { solicitation_number: string; agency?: string | null }
): string | null {
  if (!autoFillSource) return null;

  const [table, column] = autoFillSource.split('.');

  if (table === 'company_profiles' && companyProfile) {
    const value = companyProfile[column];
    if (value === null || value === undefined) return null;
    // Handle arrays (e.g., naics_codes) — use first element
    if (Array.isArray(value)) {
      return value.length > 0 ? String(value[0]) : null;
    }
    return String(value);
  }

  if (table === 'solicitations') {
    if (column === 'solicitation_number') return solicitation.solicitation_number;
    if (column === 'agency') return solicitation.agency || null;
  }

  return null;
}

// ===== INNGEST FUNCTION =====

export const solicitationReconciler = inngest.createFunction(
  { id: 'solicitation-reconciler' },
  { event: 'solicitation.classification.complete' },
  async ({ event, step }) => {
    const { solicitationId } = event.data as { solicitationId: string };

    // ─── Step 1: Fetch and categorize all documents ──────────────────────────
    const {
      solicitation,
      baseDocuments,
      amendments,
      qaDocuments,
      templateCandidates,
    } = await step.run('fetch-documents', async () => {
      const supabase = getServerClient();

      // Fetch solicitation metadata
      const { data: sol, error: solError } = await supabase
        .from('solicitations')
        .select('id, solicitation_number, agency, company_id, status')
        .eq('id', solicitationId)
        .single();

      if (solError || !sol) {
        throw new Error(`Solicitation ${solicitationId} not found`);
      }

      // Update solicitation status to reconciling
      await supabase
        .from('solicitations')
        .update({ status: 'reconciling', updated_at: new Date().toISOString() })
        .eq('id', solicitationId);

      // Fetch all classified documents with extracted text
      const { data: documents, error: docsError } = await supabase
        .from('solicitation_documents')
        .select('*')
        .eq('solicitation_id', solicitationId)
        .eq('processing_status', 'classified');

      if (docsError) {
        throw new Error(`Failed to fetch documents: ${docsError.message}`);
      }

      const allDocs = (documents || []) as SolicitationDocument[];

      // Categorize documents by type
      const baseDocuments = allDocs.filter((d) =>
        d.document_type === 'base_rfp' || d.document_type === 'soo_sow_pws'
      );

      const amendments = allDocs
        .filter((d) => d.document_type === 'amendment')
        .sort((a, b) =>
          (a.amendment_number || '').localeCompare(b.amendment_number || '', undefined, {
            numeric: true,
          })
        );

      const qaDocuments = allDocs.filter((d) => d.document_type === 'qa_response');

      const templateCandidates = allDocs.filter((d) =>
        ['pricing_template', 'cdrls', 'other_unclassified', 'dd254', 'provisions'].includes(
          d.document_type || ''
        )
      );

      return { solicitation: sol, baseDocuments, amendments, qaDocuments, templateCandidates };
    });

    // Fetch company profile for auto-fill resolution (done outside steps for use across steps)
    let companyProfile: Record<string, unknown> | null = null;
    try {
      const supabase = getServerClient();
      const { data: profile } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('company_id', solicitation.company_id)
        .maybeSingle();
      companyProfile = profile;
    } catch {
      // Non-blocking — auto-fill just won't resolve values
    }

    // ─── Step 2: Reconcile amendments ────────────────────────────────────────
    const amendmentStats = await step.run('reconcile-amendments', async () => {
      if (amendments.length === 0 || baseDocuments.length === 0) {
        return { processed: 0, records: 0, skipped: true };
      }

      const supabase = getServerClient();
      const baseDoc = baseDocuments[0]; // Use the primary base document

      let totalRecords = 0;
      let processedAmendments = 0;

      try {
        const amendmentsForReconcile = amendments
          .filter((a) => a.extracted_text)
          .map((a) => ({
            id: a.id,
            extracted_text: a.extracted_text!,
            amendment_number: a.amendment_number || '0001',
            effective_date: a.effective_date,
          }));

        const results = await reconcileAmendments(
          {
            id: baseDoc.id,
            extracted_text: baseDoc.extracted_text || '',
            document_type: baseDoc.document_type || 'base_rfp',
          },
          amendmentsForReconcile
        );

        if (results.length > 0) {
          // Insert all reconciliation records
          const { error: insertError } = await supabase
            .from('document_reconciliations')
            .insert(
              results.map((r) => ({
                solicitation_id: solicitationId,
                source_document_id: r.source_document_id,
                target_document_id: r.target_document_id,
                change_type: r.change_type,
                source_type: r.source_type,
                section_reference: r.section_reference,
                original_text: r.original_text,
                replacement_text: r.replacement_text,
                is_active: true,
              }))
            );

          if (insertError) {
            console.error('Failed to insert amendment reconciliation records:', insertError);
          } else {
            totalRecords = results.length;

            // Mark base document as superseded if any supersedes_section changes exist
            const hasSupersededSections = results.some(r => r.change_type === 'supersedes_section');
            const latestAmendment = amendments[amendments.length - 1];

            if (hasSupersededSections && latestAmendment) {
              const { error: baseSupersededError } = await supabase
                .from('solicitation_documents')
                .update({
                  is_superseded: true,
                  superseded_by: latestAmendment.id,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', baseDoc.id);

              if (baseSupersededError) {
                console.error('Failed to mark base document as superseded:', baseSupersededError);
              }
            }

            // Mark earlier amendments as superseded by their successor
            if (amendments.length > 1) {
              for (let i = 0; i < amendments.length - 1; i++) {
                const { error: amendSupersededError } = await supabase
                  .from('solicitation_documents')
                  .update({
                    is_superseded: true,
                    superseded_by: amendments[i + 1].id,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', amendments[i].id);

                if (amendSupersededError) {
                  console.error(
                    `Failed to mark amendment ${amendments[i].id} as superseded:`,
                    amendSupersededError
                  );
                }
              }
            }
          }
        }

        // Mark amendment docs as reconciled
        for (const amendment of amendments) {
          await supabase
            .from('solicitation_documents')
            .update({
              processing_status: 'reconciled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', amendment.id);

          processedAmendments++;
        }

        await logProcessingEvent(baseDoc.id, 'solicitation-reconciler', 'completed', {
          step: 'reconcile-amendments',
          amendment_count: amendments.length,
          records_created: totalRecords,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('Amendment reconciliation failed:', errMsg);

        // Mark failed amendments
        for (const amendment of amendments) {
          await supabase
            .from('solicitation_documents')
            .update({
              processing_status: 'failed',
              error_message: `Amendment reconciliation failed: ${errMsg}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', amendment.id);
        }

        await logProcessingEvent(null, 'solicitation-reconciler', 'failed', {
          step: 'reconcile-amendments',
          error: errMsg,
        });
      }

      return { processed: processedAmendments, records: totalRecords, skipped: false };
    });

    // ─── Step 3: Parse Q&A modifications ─────────────────────────────────────
    const qaStats = await step.run('parse-qa-modifications', async () => {
      if (qaDocuments.length === 0 || baseDocuments.length === 0) {
        return { processed: 0, records: 0, skipped: true };
      }

      const supabase = getServerClient();
      const baseDoc = baseDocuments[0];

      let totalRecords = 0;
      let processedQAs = 0;

      for (const qaDoc of qaDocuments) {
        if (!qaDoc.extracted_text) {
          // Skip docs with no extracted text
          await supabase
            .from('solicitation_documents')
            .update({
              processing_status: 'reconciled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', qaDoc.id);
          processedQAs++;
          continue;
        }

        try {
          const results = await parseQAModifications(
            { id: qaDoc.id, extracted_text: qaDoc.extracted_text },
            { id: baseDoc.id, extracted_text: baseDoc.extracted_text || '' }
          );

          if (results.length > 0) {
            const { error: insertError } = await supabase
              .from('document_reconciliations')
              .insert(
                results.map((r) => ({
                  solicitation_id: solicitationId,
                  source_document_id: r.source_document_id,
                  target_document_id: r.target_document_id,
                  change_type: r.change_type,
                  source_type: r.source_type,
                  section_reference: r.section_reference,
                  original_text: r.original_text,
                  replacement_text: r.replacement_text,
                  is_active: true,
                }))
              );

            if (!insertError) {
              totalRecords += results.length;
            } else {
              console.error(`Failed to insert Q&A records for doc ${qaDoc.id}:`, insertError);
            }
          }

          await supabase
            .from('solicitation_documents')
            .update({
              processing_status: 'reconciled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', qaDoc.id);

          processedQAs++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`Q&A parsing failed for doc ${qaDoc.id}:`, errMsg);

          await supabase
            .from('solicitation_documents')
            .update({
              processing_status: 'failed',
              error_message: `Q&A parsing failed: ${errMsg}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', qaDoc.id);
        }
      }

      await logProcessingEvent(null, 'solicitation-reconciler', 'completed', {
        step: 'parse-qa-modifications',
        qa_count: qaDocuments.length,
        records_created: totalRecords,
      });

      return { processed: processedQAs, records: totalRecords, skipped: false };
    });

    // ─── Step 4: Detect template fields ──────────────────────────────────────
    const templateStats = await step.run('detect-templates', async () => {
      if (templateCandidates.length === 0) {
        return { processed: 0, fields: 0, skipped: true };
      }

      const supabase = getServerClient();
      let totalFields = 0;
      let processedTemplates = 0;

      for (const doc of templateCandidates) {
        if (!doc.extracted_text) {
          await supabase
            .from('solicitation_documents')
            .update({
              processing_status: 'reconciled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', doc.id);
          processedTemplates++;
          continue;
        }

        try {
          const fields = await detectTemplateFields({
            id: doc.id,
            extracted_text: doc.extracted_text,
            document_type: doc.document_type || 'other_unclassified',
            filename: doc.filename,
          });

          if (fields !== null && fields.length > 0) {
            // Resolve auto-fill values from company profile data
            const fieldsWithValues = fields.map((field) => ({
              solicitation_document_id: field.solicitation_document_id,
              field_name: field.field_name,
              field_type: field.field_type,
              is_required: field.is_required,
              section_reference: field.section_reference,
              auto_fill_source: field.auto_fill_source,
              auto_fill_value: resolveAutoFillValue(
                field.auto_fill_source,
                companyProfile,
                solicitation
              ),
              tag: field.tag,
            }));

            const { error: insertError } = await supabase
              .from('template_field_mappings')
              .insert(fieldsWithValues);

            if (!insertError) {
              totalFields += fields.length;
            } else {
              console.error(`Failed to insert template fields for doc ${doc.id}:`, insertError);
            }
          }

          await supabase
            .from('solicitation_documents')
            .update({
              processing_status: 'reconciled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', doc.id);

          processedTemplates++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`Template detection failed for doc ${doc.id}:`, errMsg);

          await supabase
            .from('solicitation_documents')
            .update({
              processing_status: 'failed',
              error_message: `Template detection failed: ${errMsg}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', doc.id);
        }
      }

      await logProcessingEvent(null, 'solicitation-reconciler', 'completed', {
        step: 'detect-templates',
        template_count: templateCandidates.length,
        fields_created: totalFields,
      });

      return { processed: processedTemplates, fields: totalFields, skipped: false };
    });

    // ─── Step 5: Finalize ─────────────────────────────────────────────────────
    const finalStatus = await step.run('finalize', async () => {
      const supabase = getServerClient();

      // Update any remaining 'classified' documents to 'reconciled'
      // (e.g., base_rfp, soo_sow_pws that weren't covered in earlier steps)
      await supabase
        .from('solicitation_documents')
        .update({
          processing_status: 'reconciled',
          updated_at: new Date().toISOString(),
        })
        .eq('solicitation_id', solicitationId)
        .eq('processing_status', 'classified');

      // Check if any documents are still in failed state
      const { data: failedDocs } = await supabase
        .from('solicitation_documents')
        .select('id')
        .eq('solicitation_id', solicitationId)
        .eq('processing_status', 'failed');

      const { data: allDocs } = await supabase
        .from('solicitation_documents')
        .select('id')
        .eq('solicitation_id', solicitationId);

      const allFailed =
        failedDocs &&
        allDocs &&
        failedDocs.length === allDocs.length &&
        allDocs.length > 0;

      const finalSolicitationStatus = allFailed ? 'failed' : 'ready';

      // Update solicitation to final status
      await supabase
        .from('solicitations')
        .update({
          status: finalSolicitationStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitationId);

      await logProcessingEvent(null, 'solicitation-reconciler', 'completed', {
        step: 'finalize',
        solicitation_status: finalSolicitationStatus,
        failed_doc_count: failedDocs?.length || 0,
        total_doc_count: allDocs?.length || 0,
      });

      // Trigger compliance extraction pipeline (Phase 7)
      // Only send when status is 'ready' — do not trigger if all documents failed
      if (finalSolicitationStatus === 'ready') {
        await inngest.send({
          name: 'solicitation.reconciliation.complete',
          data: { solicitationId },
        });
      }

      return finalSolicitationStatus;
    });

    return {
      solicitationId,
      status: finalStatus,
      amendments: amendmentStats,
      qa: qaStats,
      templates: templateStats,
    };
  }
);
