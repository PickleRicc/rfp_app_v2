// Company Research / Intel Types
// Free-form pre-sales research tool for ANY company (not limited to our platform).
// Used to aggregate USASpending.gov, Perplexity, and SAM.gov data into
// actionable briefings before sales calls.

export type ResearchStatus = 'pending' | 'researching' | 'complete' | 'failed';

export interface CompanyResearch {
  id: string;
  search_company_name: string;
  search_cage_code: string | null;
  search_uei: string | null;
  company_id: string | null; // optional link to existing company profile
  status: ResearchStatus;
  triggered_by: string;

  // Perplexity AI research
  perplexity_report: PerplexityReport | null;

  // USASpending.gov data
  spending_report: SpendingReport | null;

  // Matched SAM.gov opportunities (from existing Tango integration)
  matched_opportunities: MatchedOpportunitySummary[] | null;

  // AI-synthesized executive briefing
  executive_briefing: string | null;
  key_talking_points: string[] | null;
  recommended_services: string[] | null;

  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerplexityReport {
  company_overview: string;
  leadership: string;
  recent_contracts_and_wins: string;
  partnerships_and_teaming: string;
  competitive_landscape: string;
  news_and_developments: string;
  technology_and_capabilities: string;
  financial_health: string;
  recommendations_for_engagement: string;
  sources: string[];
}

export interface SpendingReport {
  total_awards: number;
  total_obligation: number;
  agency_breakdown: { agency_name: string; total_obligation: number; award_count: number }[];
  naics_breakdown: { code: string; description: string; amount: number; count: number }[];
  recent_awards: SpendingAwardSummary[];
  largest_awards: SpendingAwardSummary[];
}

export interface SpendingAwardSummary {
  award_id: string;
  description: string | null;
  total_obligation: number;
  awarding_agency_name: string | null;
  naics_code: string | null;
  naics_description: string | null;
  date_signed: string | null;
  period_of_performance_current_end_date: string | null;
}

export interface MatchedOpportunitySummary {
  notice_id: string;
  title: string;
  solicitation_number: string | null;
  department: string;
  response_deadline: string | null;
  naics_code: string | null;
  set_aside: string | null;
  relevance_score: number;
  recommended_action: 'pursue' | 'evaluate' | 'monitor' | 'skip';
}

export const RESEARCH_STATUS_LABELS: Record<ResearchStatus, string> = {
  pending: 'Pending',
  researching: 'Researching...',
  complete: 'Complete',
  failed: 'Failed',
};

export const RESEARCH_STATUS_COLORS: Record<ResearchStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  researching: 'bg-purple-100 text-purple-700',
  complete: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};
