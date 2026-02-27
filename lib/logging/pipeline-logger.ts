/**
 * Centralized Pipeline Logger
 * Phase 5: Pipeline Logging & Observability
 *
 * Replaces the per-file `logProcessingEvent()` functions with a centralized,
 * enhanced logging utility scoped to solicitations.
 *
 * Key enhancements:
 * - solicitation_id as primary scope (not document_id)
 * - Automatic duration tracking: 'completed' events auto-calculate duration from matching 'started'
 * - Standardized metadata keys: input_summary, output_summary, prompt_snapshot, ai_response_summary
 * - Non-blocking: logging failures never block pipeline progress
 */

import { getServerClient } from '@/lib/supabase/client';

/**
 * Log a pipeline event to the pipeline_logs table.
 *
 * When status='completed', auto-calculates duration_ms by looking up the matching
 * 'started' entry for the same solicitation_id + stage.
 *
 * Silently swallows all errors — logging should never block pipeline progress.
 *
 * @param solicitationId - The solicitation this event belongs to
 * @param stage          - Pipeline stage identifier (e.g., 'extract-sow-pws-overview')
 * @param status         - Event status: 'started', 'completed', 'failed', 'warning'
 * @param metadata       - Structured metadata (input/output summaries, counts, etc.)
 * @param documentId     - Optional document ID for document-specific steps
 */
export async function logPipelineEvent(
  solicitationId: string,
  stage: string,
  status: 'started' | 'completed' | 'failed' | 'warning',
  metadata: Record<string, unknown>,
  documentId?: string | null
): Promise<void> {
  try {
    const supabase = getServerClient();

    let durationMs: number | null = null;

    // Auto-calculate duration for 'completed' events
    if (status === 'completed') {
      const { data: startedEntry } = await supabase
        .from('pipeline_logs')
        .select('created_at')
        .eq('solicitation_id', solicitationId)
        .eq('stage', stage)
        .eq('status', 'started')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (startedEntry?.created_at) {
        const startTime = new Date(startedEntry.created_at).getTime();
        durationMs = Date.now() - startTime;
      }
    }

    // Extract error message from metadata if status is 'failed'
    const errorMessage = status === 'failed'
      ? (metadata.error as string) || (metadata.error_message as string) || null
      : null;

    await supabase.from('pipeline_logs').insert({
      solicitation_id: solicitationId,
      document_id: documentId ?? null,
      stage,
      status,
      duration_ms: durationMs,
      metadata,
      error: errorMessage,
    });
  } catch {
    // Non-blocking — logging failures don't affect pipeline
  }
}
