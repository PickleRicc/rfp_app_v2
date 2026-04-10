export type BoeStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface ParsedPerformancePeriod {
  label: string;           // "Base Year", "Option Year 1", etc.
  type: 'base' | 'option';
  duration_months: number;
  annual_hours: number;    // typically 1920 (52 weeks × 40 hrs - holidays)
  start_date?: string;
  end_date?: string;
}

export interface BoeTableRow {
  task_area_code: string;       // e.g., "SA-01", "PWS-3.2"
  task_area_name: string;       // e.g., "Service Desk", "Network Operations"
  labor_category: string;       // e.g., "Senior Systems Engineer"
  fte_count: number;
  annual_hours_per_fte: number; // typically 1920
  total_annual_hours: number;   // fte_count * annual_hours_per_fte
  rationale: string;            // "Per PWS §3.2.1, 24/7 coverage requires..."
  sow_paragraph_refs: string[]; // ["§3.2.1", "§4.1.2"]
  confidence: 'high' | 'medium' | 'low';
}

export interface GovStaffingComparison {
  labor_category: string;
  gov_fte: number | null;
  proposed_fte: number;
  delta: number;           // proposed - gov
  delta_pct: number;       // (delta / gov_fte) * 100, null if gov_fte is null
  flag_reason?: string;    // populated when abs(delta_pct) > 15 or gov_fte is null
  agrees: boolean;         // true when abs(delta_pct) <= 15
}

export interface BoeAssessment {
  id: string;
  solicitation_id: string;
  company_id: string;
  status: BoeStatus;
  boe_table: BoeTableRow[] | null;
  narrative_markdown: string | null;
  government_comparison: GovStaffingComparison[] | null;
  performance_periods: ParsedPerformancePeriod[] | null;
  diagram_specs: unknown[] | null;  // DiagramSpec[] - typed as unknown to avoid circular dep
  total_fte_proposed: number | null;
  total_fte_government: number | null;
  variance_flag: boolean;
  sow_confidence: 'high' | 'medium' | 'low' | null;
  extraction_field_count: number | null;
  error_message: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoeGetResponse {
  assessment: BoeAssessment | null;
  status: BoeStatus | 'not_started';
}

export interface BoeTriggerResponse {
  assessment: BoeAssessment;
  message: string;
}

export interface BoePromptData {
  serviceAreaCode: string;
  serviceAreaName: string;
  description: string;
  subRequirements: Array<{
    id: string;
    description: string;
    deliverables?: string[];
  }>;
  staffingIndicators: Array<{
    indicator: string;
    value: string | number;
    source_paragraph?: string;
  }>;
  availableLaborCategories: string[];
  performancePeriods: ParsedPerformancePeriod[];
  siteCount: number;
  contractType: string | null;
  securityEnvironment: string[];
}
