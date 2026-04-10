// Solicitation Strategy Types
// Phase 8.5: Strategy Builder
import type { DiagramType } from '@/lib/generation/exhibits/diagram-types';
//
// A SolicitationStrategy is created/edited by the Proposal Manager before draft generation.
// It captures win theme priorities, volume-level approach notes, agency intel, and
// competitive positioning. The draft generator reads this row and injects a strategy
// brief as the first block in every volume's user prompt.
//
// Maps to the solicitation_strategies table (supabase-strategy-migration.sql).

// ===== ENUMERATIONS =====

/**
 * How assertively the proposal should position the company.
 * Affects tone, claim strength, and competitive framing in generated content.
 */
export type RiskPosture = 'aggressive' | 'balanced' | 'conservative';

// ===== VOLUME STRATEGY =====

/**
 * Proposal Manager instructions scoped to a single proposal volume.
 * Stored as items in solicitation_strategies.volume_strategies JSONB array.
 */
export interface VolumeStrategy {
  /** The volume this strategy applies to — matches Section L volume_structure name */
  volume_name: string;

  /**
   * PM's direct written instructions to the proposal writer for this volume.
   * e.g. "Lead with JWCC contract vehicle. Emphasize FedRAMP High authorization."
   * Injected verbatim into the generation prompt under "VOLUME APPROACH".
   */
  approach_notes: string;

  /**
   * Topics or differentiators to emphasize at the top of this volume.
   * e.g. ["Zero Trust", "Cloud Migration", "DISA past performance"]
   * Injected as a bulleted "EMPHASIS AREAS" block in the prompt.
   */
  emphasis_areas: string[];

  /**
   * Name of the SME assigned to own this volume's content.
   * Used to route SME contribution review and to label ownership in the UI.
   * Optional — not all volumes require a dedicated SME owner.
   */
  sme_owner?: string;

  /**
   * PM-specified diagrams to include in this volume.
   * These are REQUIRED — Claude will always generate them regardless of content analysis.
   * AI may add additional diagrams on top of these up to the maxDiagrams limit.
   *
   * Example: [{ type: 'raci-matrix', title: 'Roles & Responsibilities', notes: 'Include PM, TL, QA, CO' }]
   */
  diagram_requests?: VolumeDiagramRequest[];
}

/**
 * A PM-specified diagram request for a proposal volume.
 * Stored within VolumeStrategy.diagram_requests[].
 */
export interface VolumeDiagramRequest {
  /** Diagram type to generate */
  type: DiagramType;
  /** Caption text shown below the diagram */
  title: string;
  /** Keywords identifying which section to place this diagram after */
  placement_section: string;
  /**
   * Optional data hints for the spec generator.
   * e.g. "Include roles: PM, Technical Lead, QA Manager, COTR"
   * or "Use 4 phases: Planning, Transition, Operations, Closeout"
   */
  notes?: string;
}

// ===== SOLICITATION STRATEGY =====

/**
 * The full Proposal Manager strategy for a single solicitation.
 * One row per solicitation + company in the solicitation_strategies table.
 *
 * Created automatically (with defaults from Tier 1 win themes) when the PM
 * first opens the Strategy Builder. Saved on every edit. Confirmed when the
 * PM clicks "Confirm Strategy & Generate", which sets confirmed_at and
 * triggers the Inngest draft generation event.
 */
export interface SolicitationStrategy {
  id: string;
  solicitation_id: string;
  company_id: string;

  /**
   * Ordered list of win theme statements — index 0 is the highest priority theme.
   * Pre-populated from company_profiles.enterprise_win_themes.
   * PM reorders and edits these in the Strategy Builder drag-and-drop list.
   * Injected into every volume prompt as a numbered priority list.
   */
  win_theme_priorities: string[];

  /**
   * Free-form agency intelligence text.
   * e.g. "This is GSA's 4th attempt at this procurement — prior protests were on price.
   * Incumbent is Booz Allen, known for weak transition plans."
   * Injected into volume prompts under "AGENCY INTELLIGENCE".
   */
  agency_intel: string | null;

  /**
   * Competitive positioning notes.
   * e.g. "Primary competitor is Leidos — differentiate on our cleared workforce depth."
   * Injected into volume prompts under "COMPETITIVE CONTEXT".
   */
  competitive_notes: string | null;

  /**
   * How assertively to position the proposal.
   * - aggressive: bold claims, push win themes hard, lead with metrics
   * - balanced: factual and professional (default)
   * - conservative: compliance-first, let facts speak, minimal claims
   */
  risk_posture: RiskPosture;

  /**
   * Per-volume approach instructions from the PM.
   * One entry per volume in the Section L volume_structure.
   * Auto-populated with empty entries for each volume when the strategy is first created.
   */
  volume_strategies: VolumeStrategy[];

  /**
   * Set when the PM clicks "Confirm Strategy & Generate".
   * null while the strategy is still being drafted.
   */
  confirmed_at: string | null;

  /** Staff user who created or last edited the strategy */
  created_by: string | null;

  created_at: string;
  updated_at: string;
}

// ===== API SHAPES =====

/**
 * Response from GET /api/solicitations/[id]/strategy.
 * Returns the existing strategy or null if not yet created.
 * Also includes the volume list from Section L so the UI can pre-populate
 * VolumeStrategy cards without a separate fetch.
 */
export interface StrategyGetResponse {
  strategy: SolicitationStrategy | null;
  /** Volume names from Section L extraction — used to scaffold VolumeStrategy cards */
  volumes: Array<{ name: string; page_limit: number | null }>;
  /** Company win themes from Tier 1 — used as default win_theme_priorities */
  default_win_themes: string[];
}

/**
 * Request body for PUT /api/solicitations/[id]/strategy.
 * Full upsert — replaces the entire strategy row.
 */
export interface StrategyUpsertRequest {
  win_theme_priorities: string[];
  agency_intel?: string;
  competitive_notes?: string;
  risk_posture: RiskPosture;
  volume_strategies: VolumeStrategy[];
}

/**
 * Request body for POST /api/solicitations/[id]/strategy/confirm.
 * Confirms the strategy, sets confirmed_at, and triggers draft generation.
 */
export interface StrategyConfirmRequest {
  graphics_profile?: 'minimal' | 'standard';
}
