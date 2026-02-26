// Draft Generation Types
// Phase 9: Draft Generation
// Types mirror supabase-draft-generation-migration.sql exactly.
// Used by the draft generation Inngest pipeline (Plan 02),
// the draft API endpoints (app/api/solicitations/[id]/draft/),
// and the Draft tab UI (Plan 03).

// ===== ENUMERATIONS =====

/**
 * The lifecycle state of a proposal draft generation run.
 * 'pending'    = created, waiting for Inngest pipeline to begin
 * 'generating' = Inngest pipeline is actively generating volumes
 * 'completed'  = all volumes generated successfully
 * 'failed'     = one or more volumes failed; error_message populated
 */
export type DraftStatus = 'pending' | 'generating' | 'completed' | 'failed';

/**
 * The generation state of an individual proposal volume.
 * Mirrors DraftStatus — volumes progress independently.
 */
export type VolumeStatus = 'pending' | 'generating' | 'completed' | 'failed';

/**
 * Color-coded page limit compliance status for a generated volume.
 * Computed at generation time based on word count heuristic (~250 words/page).
 * 'under'   = below 85% of page limit (green — good headroom)
 * 'warning' = 85–100% of page limit (yellow — close to limit)
 * 'over'    = exceeds page limit (red — user must edit in Word)
 */
export type PageLimitStatus = 'under' | 'warning' | 'over';

// ===== DISPLAY CONSTANTS =====

/**
 * Human-readable labels for each draft status.
 * Used in the Draft tab progress display and status badges.
 */
export const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = {
  pending:    'Pending',
  generating: 'Generating',
  completed:  'Complete',
  failed:     'Failed',
};

/**
 * Tailwind CSS color classes for each draft/volume status.
 * Matches the pattern used by compliance extraction status indicators.
 */
export const DRAFT_STATUS_COLORS: Record<DraftStatus, string> = {
  pending:    'text-gray-500 bg-gray-50 border-gray-200',
  generating: 'text-blue-600 bg-blue-50 border-blue-200',
  completed:  'text-green-600 bg-green-50 border-green-200',
  failed:     'text-red-600 bg-red-50 border-red-200',
};

/**
 * Tailwind CSS color classes for each page limit compliance status.
 * Used in the volume preview panel and download summary.
 * Matches CONTEXT.md: green (under 85%), yellow (85-100%), red (over limit).
 */
export const PAGE_LIMIT_STATUS_COLORS: Record<PageLimitStatus, string> = {
  under:   'text-green-600 bg-green-50 border-green-200',
  warning: 'text-amber-600 bg-amber-50 border-amber-200',
  over:    'text-red-600 bg-red-50 border-red-200',
};

// ===== DATABASE TABLE INTERFACES =====

/**
 * A proposal draft generation record.
 * One row per solicitation + company draft run.
 * Maps to the proposal_drafts table.
 *
 * Regeneration overwrites the existing row — no versioning.
 * See CONTEXT.md: "Regenerate Draft button replaces the old draft (no versioning)"
 */
export interface ProposalDraft {
  id: string;
  solicitation_id: string;
  company_id: string;

  /** Overall generation pipeline state */
  status: DraftStatus;

  /** When the user clicked Confirm & Generate on the Strategy Confirmation screen */
  strategy_confirmed_at: string | null;

  /** When the Inngest generation pipeline began processing */
  generation_started_at: string | null;

  /** When all volumes completed generation */
  generation_completed_at: string | null;

  /** Error details (null unless status = 'failed') */
  error_message: string | null;

  created_at: string;
  updated_at: string;
}

/**
 * A single generated volume within a proposal draft.
 * One row per volume (e.g., Technical Approach, Management, Past Performance, Cost/Price).
 * Maps to the draft_volumes table.
 *
 * Volume structure is driven by Section L compliance extraction (volume_structure field).
 * Volumes are generated independently by the Inngest pipeline.
 */
export interface DraftVolume {
  id: string;

  /** Parent draft record */
  draft_id: string;

  /** Volume name from Section L extraction (e.g., "Technical Approach", "Management") */
  volume_name: string;

  /** Display order from Section L volume_structure */
  volume_order: number;

  /** This volume's generation state */
  status: VolumeStatus;

  /** Actual word count of generated content (set when completed) */
  word_count: number | null;

  /** Estimated page count via heuristic: word_count / 250 (set when completed) */
  page_estimate: number | null;

  /** RFP page limit for this volume from Section L extraction (null if not specified) */
  page_limit: number | null;

  /**
   * Color-coded page compliance status.
   * Null when page_limit is not specified for this volume.
   */
  page_limit_status: PageLimitStatus | null;

  /** Supabase storage path to the generated DOCX file (set when completed) */
  file_path: string | null;

  /** Raw markdown content for in-app preview rendering (set when completed) */
  content_markdown: string | null;

  /** Error details (null unless status = 'failed') */
  error_message: string | null;

  generation_started_at: string | null;
  generation_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ===== STRATEGY CONFIRMATION INTERFACE =====

/**
 * A single volume entry in the strategy confirmation view.
 * Sourced from Section L compliance extraction (volume_structure field).
 */
export interface StrategyVolume {
  /** Volume name (e.g., "Technical Approach") */
  name: string;
  /** RFP page limit for this volume (null if not specified in Section L) */
  page_limit: number | null;
}

/**
 * A single evaluation factor entry in the strategy confirmation view.
 * Sourced from Section M compliance extraction (evaluation_factors field).
 */
export interface StrategyEvalFactor {
  /** Factor name (e.g., "Technical Approach", "Past Performance") */
  name: string;
  /** Weight description from Section M (e.g., "Most Important", "30%") — null if not specified */
  weight: string | null;
}

/**
 * A single key personnel entry in the strategy confirmation view.
 * Sourced from Tier 2 data call key_personnel section.
 */
export interface StrategyPersonnel {
  /** Required role/position (e.g., "Program Manager") */
  role: string;
  /** Full name of the proposed individual */
  name: string;
}

/**
 * The read-only strategy confirmation summary shown before draft generation.
 * Assembled from three data sources:
 *   - Tier 1: company_profiles (corporate identity, win themes, differentiators)
 *   - Tier 2: data_call_responses (opportunity details, past performance, key personnel)
 *   - Extractions: compliance_extractions (Section L volumes, Section M eval factors)
 *
 * This is the data the user reviews on the Strategy Confirmation screen.
 * See CONTEXT.md: "Read-only data summary screen — user cannot edit on this screen"
 */
export interface StrategyConfirmation {
  // ===== Tier 1: Company Identity (from company_profiles) =====

  /** Company's operating name */
  company_name: string;

  /** Legal entity name (for certification/representations) */
  legal_name: string;

  /** SAM.gov Unique Entity Identifier */
  uei_number: string;

  /** Commercial and Government Entity code */
  cage_code: string;

  // ===== Tier 1: Competitive Positioning (from company_profiles) =====

  /**
   * Enterprise-level win theme statements.
   * These become theme callout boxes at the start of each major section.
   */
  enterprise_win_themes: string[];

  /**
   * Narrative summary of key differentiators.
   * Used to ghost competitors throughout the proposal narrative.
   */
  key_differentiators_summary: string | null;

  // ===== Tier 2: Opportunity Details (from data_call_responses.opportunity_details) =====

  /** Prime, sub, or teaming arrangement for this bid */
  prime_or_sub: 'prime' | 'sub' | 'teaming' | null;

  /** Names of teaming partners (empty array when not teaming) */
  teaming_partners: string[];

  /** Contract type (e.g., "FFP", "CPFF", "T&M") */
  contract_type: string | null;

  /** NAICS code for the procurement */
  naics_code: string | null;

  /** Set-aside designation (e.g., "SDVOSB", "8(a)") */
  set_aside: string | null;

  // ===== Tier 2: Key Personnel (from data_call_responses.key_personnel) =====

  /** Proposed key personnel for this solicitation */
  key_personnel: StrategyPersonnel[];

  // ===== Tier 2: Past Performance (from data_call_responses.past_performance) =====

  /** Count of past performance references entered in the data call */
  past_performance_count: number;

  // ===== Extractions: Section L (from compliance_extractions) =====

  /**
   * Volume structure from Section L.
   * Drives which draft_volumes rows are created and the generation pipeline.
   */
  volume_structure: StrategyVolume[];

  // ===== Extractions: Section M (from compliance_extractions) =====

  /** Evaluation factors from Section M with weight descriptions */
  evaluation_factors: StrategyEvalFactor[];
}

// ===== API RESPONSE TYPES =====

/**
 * The full response shape returned by GET /api/solicitations/[id]/draft.
 * Bundles the assembled strategy, current draft status, and volume states.
 *
 * draft is null when no generation has been triggered yet.
 * volumes is empty when draft is null or pending.
 */
export interface DraftGetResponse {
  /** Assembled strategy confirmation from all three data sources */
  strategy: StrategyConfirmation;

  /** Current draft record (null if no generation has been triggered) */
  draft: ProposalDraft | null;

  /** Per-volume generation states, ordered by volume_order */
  volumes: DraftVolume[];
}
