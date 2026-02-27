// Pipeline Log Types
// Phase 5: Pipeline Logging & Observability
// Types mirror supabase-pipeline-logs-migration.sql exactly.
// Used by the pipeline logger (lib/logging/pipeline-logger.ts),
// the logs API (app/api/solicitations/[id]/logs/route.ts),
// and the PipelineLogsView component.

// ===== CORE INTERFACE =====

/**
 * A single pipeline event log entry.
 * One row per stage + status combination.
 * Maps to the pipeline_logs table.
 */
export interface PipelineLog {
  id: string;

  /** The solicitation this log belongs to (primary scope) */
  solicitation_id: string;

  /** Optional document associated with this step (null for non-document steps) */
  document_id: string | null;

  /** Pipeline stage identifier (e.g., 'extract-sow-pws-overview', 'generate-volume') */
  stage: string;

  /** Event status */
  status: 'started' | 'completed' | 'failed' | 'warning';

  /** Duration in milliseconds (auto-calculated for 'completed' entries) */
  duration_ms: number | null;

  /** Structured metadata: input/output summaries, prompt snapshots, counts */
  metadata: Record<string, unknown>;

  /** Error message (populated when status = 'failed') */
  error: string | null;

  created_at: string;
}

// ===== SUMMARY INTERFACE =====

/**
 * Aggregated pipeline summary for a solicitation.
 * Computed from pipeline_logs by the logs API.
 */
export interface PipelineSummary {
  /** Total log events for this solicitation */
  total_events: number;

  /** Counts by status */
  by_status: Record<string, number>;

  /** Latest status and duration per stage */
  by_stage: Record<string, { status: string; duration_ms: number | null }>;

  /** Total pipeline duration from first 'started' to last 'completed' */
  pipeline_duration_ms: number | null;

  /** Stages that have completed */
  stages_completed: string[];

  /** Stages that have failed */
  stages_failed: string[];

  /** Stages currently in progress (started but not completed/failed) */
  stages_in_progress: string[];
}

// ===== API RESPONSE =====

/**
 * Response shape for GET /api/solicitations/[id]/logs
 */
export interface PipelineLogsResponse {
  logs: PipelineLog[];
  summary: PipelineSummary;
}

// ===== DISPLAY CONSTANTS =====

/**
 * Human-readable labels for each pipeline stage.
 * Used in the Logs tab UI for display.
 */
export const PIPELINE_STAGE_LABELS: Record<string, string> = {
  'classify-document':          'Document Classification',
  'reconcile-amendments':       'Amendment Reconciliation',
  'detect-templates':           'Template Detection',
  'extract-section-l':          'Section L Extraction',
  'extract-section-m':          'Section M Extraction',
  'extract-admin-data':         'Admin Data Extraction',
  'extract-rating-scales':      'Rating Scales Extraction',
  'extract-sow-pws-overview':   'SOW/PWS Overview Extraction',
  'extract-sow-pws-details':    'SOW/PWS Service Area Details',
  'extract-cost-price':         'Cost/Price Extraction',
  'extract-past-performance':   'Past Performance Extraction',
  'extract-key-personnel':      'Key Personnel Extraction',
  'extract-security-reqs':      'Security Requirements Extraction',
  'extract-operational-context': 'Operational Context Extraction',
  'extract-technology-reqs':    'Technology Requirements Extraction',
  'fetch-all-data':             'Draft Data Assembly',
  'generate-volume':            'Volume Generation',
  'generate-compliance-matrix': 'Compliance Matrix Generation',
  'finalize':                   'Pipeline Finalization',
  'draft-generator':            'Draft Generator',
};
