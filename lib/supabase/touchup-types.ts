// Touchup Draft Types — V2 (Per-Volume Interactive)
// Types mirror supabase-touchup-v2-migration.sql.
// Used by the touchup Inngest functions (scorer + rewriter), API routes, and UI.

// ===== ENUMERATIONS =====

/**
 * The lifecycle state of a touchup analysis session.
 * 'active'    = session in progress, volumes may be in various states
 * 'completed' = user has finished all touchup work for this draft
 */
export type TouchupStatus = 'active' | 'completed';

/**
 * Per-volume touchup state. Drives the two-step user flow:
 * pending -> scoring -> scored -> (user reviews) -> rewriting -> completed
 */
export type TouchupVolumeStatus = 'pending' | 'scoring' | 'scored' | 'rewriting' | 'completed' | 'failed';

/**
 * Page limit compliance status (reused from draft-types pattern).
 */
export type TouchupPageLimitStatus = 'under' | 'warning' | 'over';

// ===== DISPLAY CONSTANTS =====

export const TOUCHUP_STATUS_LABELS: Record<TouchupStatus, string> = {
  active:    'Active',
  completed: 'Complete',
};

export const TOUCHUP_STATUS_COLORS: Record<TouchupStatus, string> = {
  active:    'text-blue-600 bg-blue-50 border-blue-200',
  completed: 'text-green-600 bg-green-50 border-green-200',
};

export const TOUCHUP_VOLUME_STATUS_LABELS: Record<TouchupVolumeStatus, string> = {
  pending:    'Pending',
  scoring:    'Scoring',
  scored:     'Scored',
  rewriting:  'Rewriting',
  completed:  'Complete',
  failed:     'Failed',
};

export const TOUCHUP_VOLUME_STATUS_COLORS: Record<TouchupVolumeStatus, string> = {
  pending:    'text-gray-500 bg-gray-50 border-gray-200',
  scoring:    'text-purple-600 bg-purple-50 border-purple-200',
  scored:     'text-indigo-600 bg-indigo-50 border-indigo-200',
  rewriting:  'text-blue-600 bg-blue-50 border-blue-200',
  completed:  'text-green-600 bg-green-50 border-green-200',
  failed:     'text-red-600 bg-red-50 border-red-200',
};

export const COMPLIANCE_SCORE_COLORS = {
  high:   'text-green-700 bg-green-50 border-green-200',   // >= 85
  medium: 'text-amber-700 bg-amber-50 border-amber-200',   // 70-84
  low:    'text-red-700 bg-red-50 border-red-200',          // < 70
} as const;

export function getScoreColorClass(score: number): string {
  if (score >= 85) return COMPLIANCE_SCORE_COLORS.high;
  if (score >= 70) return COMPLIANCE_SCORE_COLORS.medium;
  return COMPLIANCE_SCORE_COLORS.low;
}

// ===== SEVERITY & CLASSIFICATION ENUMS =====

export type ComplianceTier = 'fatal' | 'deficiency' | 'weakness' | 'enhancement';

export type FabricationType = 'incorrect' | 'incomplete' | 'hallucinated';

export type PlaceholderType = 'auto_fillable' | 'legitimate';

export const COMPLIANCE_TIER_LABELS: Record<ComplianceTier, string> = {
  fatal: 'Fatal',
  deficiency: 'Deficiency',
  weakness: 'Weakness',
  enhancement: 'Enhancement',
};

export const COMPLIANCE_TIER_COLORS: Record<ComplianceTier, string> = {
  fatal: 'text-red-700 bg-red-50 border-red-300',
  deficiency: 'text-orange-700 bg-orange-50 border-orange-300',
  weakness: 'text-yellow-700 bg-yellow-50 border-yellow-300',
  enhancement: 'text-gray-600 bg-gray-50 border-gray-300',
};

export const FABRICATION_TYPE_LABELS: Record<FabricationType, string> = {
  incorrect: 'Incorrect',
  incomplete: 'Incomplete',
  hallucinated: 'Hallucinated',
};

export const PLACEHOLDER_TYPE_LABELS: Record<PlaceholderType, string> = {
  auto_fillable: 'Auto-Fillable',
  legitimate: 'Legitimate',
};

// ===== GAP ANALYSIS STRUCTURES =====

export interface RequirementCoverage {
  requirement_id: string;
  requirement_text: string;
  status: 'covered' | 'partial' | 'missing';
  evidence_location?: string;
  gap_description?: string;
  severity_tier?: ComplianceTier;
}

export interface DataVerification {
  claim: string;
  source: 'tier1' | 'tier2' | 'extraction' | 'fabricated' | 'unverifiable';
  verified: boolean;
  correction?: string;
  fabrication_type?: FabricationType;
  severity_tier?: ComplianceTier;
  root_cause_id?: string;
}

export interface MissingContent {
  topic: string;
  source_data_available: boolean;
  recommended_action: string;
}

export interface PlaceholderItem {
  placeholder_text: string;
  data_available: boolean;
  suggested_fill?: string;
  placeholder_type?: PlaceholderType;
  effort_hours?: number;
}

export interface ComplianceLanguageIssue {
  location: string;
  issue: string;
  suggestion: string;
}

// ===== HUMAN EFFORT ESTIMATION =====

export interface HumanEffortEstimate {
  total_hours: number;
  by_category: { category: string; hours: number; count: number }[];
  pass_fail: 'pass' | 'fail_volume' | 'fail_package';
  fail_reason?: string;
}

// ===== CROSS-VOLUME CONSISTENCY =====

export interface PackageConsistencyCheck {
  check_type: 'personnel_names' | 'user_count' | 'fte_count' | 'labor_categories'
    | 'sprs_score' | 'cdrl_mappings' | 'site_names';
  status: 'consistent' | 'inconsistent';
  details: string;
  volumes_affected: string[];
  severity_tier: ComplianceTier;
}

export interface PackageConsistencyResult {
  overall_consistent: boolean;
  checks: PackageConsistencyCheck[];
  cross_volume_score: number;
}

export interface GapAnalysis {
  requirements_coverage: RequirementCoverage[];
  data_verification: DataVerification[];
  missing_content: MissingContent[];
  placeholder_items: PlaceholderItem[];
  compliance_language_issues: ComplianceLanguageIssue[];
  human_effort_estimate?: HumanEffortEstimate;
}

// ===== REGRESSION GUARD STRUCTURES =====

export interface SectionScore {
  section_title: string;
  compliance_coverage: number;
  data_accuracy: number;
  detail_specificity: number;
  compliance_language: number;
  total: number;
}

export interface RegressionReversion {
  section_title: string;
  draft1_score: SectionScore;
  touchup_score: SectionScore;
  reason: string;
}

// ===== DATABASE TABLE INTERFACES =====

export interface TouchupAnalysis {
  id: string;
  draft_id: string;
  solicitation_id: string;
  company_id: string;

  status: TouchupStatus;

  overall_compliance_score: number | null;
  total_gaps: number | null;
  total_gaps_resolved: number | null;
  human_inputs_required: number | null;

  package_consistency: PackageConsistencyResult | null;
  package_score: number | null;
  human_effort_estimate: HumanEffortEstimate | null;

  scoring_started_at: string | null;
  scoring_completed_at: string | null;
  rewriting_started_at: string | null;
  rewriting_completed_at: string | null;

  error_message: string | null;

  created_at: string;
  updated_at: string;
}

export interface TouchupVolume {
  id: string;
  touchup_id: string;
  original_volume_id: string;

  volume_name: string;
  volume_order: number;
  version_number: number;

  status: TouchupVolumeStatus;

  compliance_score: number | null;
  touchup_score: number | null;
  gap_analysis: GapAnalysis | null;
  fabrication_flags: DataVerification[] | null;
  placeholder_count: number | null;
  human_input_count: number | null;

  content_markdown: string | null;
  file_path: string | null;
  word_count: number | null;
  page_estimate: number | null;
  page_limit: number | null;
  page_limit_status: TouchupPageLimitStatus | null;

  regression_reversions: RegressionReversion[] | null;

  error_message: string | null;

  scoring_started_at: string | null;
  scoring_completed_at: string | null;
  rewriting_started_at: string | null;
  rewriting_completed_at: string | null;

  created_at: string;
  updated_at: string;

  versions?: TouchupVolumeVersion[];
}

// ===== VERSION HISTORY =====

export type TouchupVersionAction = 'scored' | 'rewritten';

export interface TouchupVolumeVersion {
  id: string;
  touchup_volume_id: string;
  version_number: number;
  action: TouchupVersionAction;
  score_version: 'draft' | 'touchup' | null;

  compliance_score: number | null;
  gap_analysis: GapAnalysis | null;
  fabrication_flags: DataVerification[] | null;
  placeholder_count: number | null;

  content_markdown: string | null;
  file_path: string | null;
  word_count: number | null;
  page_estimate: number | null;
  page_limit_status: TouchupPageLimitStatus | null;
  human_input_count: number | null;
  regression_reversions: RegressionReversion[] | null;

  created_at: string;
}

// ===== API RESPONSE TYPES =====

export interface DraftVolumeForTouchup {
  id: string;
  volume_name: string;
  volume_order: number;
  page_limit: number | null;
  status: string;
}

export interface ComputedAggregates {
  overall_compliance_score: number | null;
  total_gaps: number;
  total_gaps_resolved: number;
  human_inputs_required: number;
  scored_count: number;
  rewritten_count: number;
  total_count: number;
}

export interface TouchupGetResponse {
  draftReady: boolean;
  touchup: TouchupAnalysis | null;
  volumes: TouchupVolume[];
  draftVolumes: DraftVolumeForTouchup[];
  aggregates: ComputedAggregates | null;
}
