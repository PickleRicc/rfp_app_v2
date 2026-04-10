import type { BoeStatus } from '@/lib/supabase/boe-types';

export type P2wStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface P2wRateBenchmarkRow {
  labor_category: string;
  boe_fte: number;
  boe_annual_hours: number;
  // Rate inputs
  proposed_hourly_rate: number | null;    // company's current rate if known
  bls_median_hourly: number | null;
  bls_75th_percentile: number | null;
  gsa_benchmark_low: number | null;
  gsa_benchmark_high: number | null;
  gov_estimate_rate: number | null;       // from IGCE extraction
  // Recommendations
  recommended_low: number;
  recommended_target: number;
  recommended_high: number;
  // Total cost (rate × hours × FTE × periods)
  total_cost_low: number;
  total_cost_target: number;
  total_cost_high: number;
  // Metadata
  data_sources_used: string[];
  rate_confidence: 'high' | 'medium' | 'low';
  bls_soc_code?: string;
  geographic_adjustment_applied: boolean;
}

export interface P2wAnalysis {
  id: string;
  solicitation_id: string;
  company_id: string;
  boe_assessment_id: string | null;
  status: P2wStatus;
  rate_table: P2wRateBenchmarkRow[] | null;
  total_cost_low: number | null;
  total_cost_target: number | null;
  total_cost_high: number | null;
  igce_value: number | null;
  igce_comparison_note: string | null;
  narrative_markdown: string | null;
  bls_data_vintage: string | null;
  gsa_data_vintage: string | null;
  geographic_region: string | null;
  naics_code: string | null;
  error_message: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface P2wGetResponse {
  analysis: P2wAnalysis | null;
  boe_status: BoeStatus | 'not_started';
  status: P2wStatus | 'not_started';
}

export interface P2wTriggerResponse {
  analysis: P2wAnalysis;
  message: string;
}
