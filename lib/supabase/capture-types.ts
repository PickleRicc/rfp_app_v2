// Capture Module Types — Opportunity Confirmation
// Two modes: "raw" (upload everything) and "database" (use stored company data)

export type AnalysisMode = 'raw' | 'database' | 'finder';

export type AnalysisStatus =
  | 'draft'
  | 'uploading'
  | 'ready'
  | 'analyzing'
  | 'complete'
  | 'failed';

export type OpportunityDocumentType =
  | 'rfp'
  | 'rfi'
  | 'ssl'
  | 'sow_pws'
  | 'amendment'
  | 'past_performance'
  | 'company_data'
  | 'other';

export type FitRating =
  | 'strong_fit'
  | 'moderate_fit'
  | 'weak_fit'
  | 'not_recommended';

export interface OpportunityAnalysis {
  id: string;
  company_id: string | null;
  mode: AnalysisMode;
  title: string;
  agency?: string;
  solicitation_number?: string;
  status: AnalysisStatus;
  created_by: string;

  overall_fit_rating?: FitRating;
  overall_score?: number;
  summary?: string;
  report?: OpportunityReport;
  finder_report?: OpportunityFinderReport;

  created_at: string;
  updated_at: string;
}

export interface OpportunityDocument {
  id: string;
  analysis_id: string;
  filename: string;
  file_path: string;
  file_size: number;
  document_type: OpportunityDocumentType;
  extracted_text?: string;
  processing_status: 'pending' | 'extracting' | 'ready' | 'failed';
  created_at: string;
}

export interface OpportunityReport {
  fit_rating: FitRating;
  score: number;
  executive_summary: string;

  strengths: ReportFinding[];
  weaknesses: ReportFinding[];
  risks: ReportFinding[];
  recommendations: string[];

  past_performance_alignment: PastPerformanceAlignment[];
  requirement_coverage: RequirementCoverage[];

  go_no_go_factors: GoNoGoFactor[];
  competitive_positioning: string;
  estimated_win_probability: string;
}

export interface ReportFinding {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface PastPerformanceAlignment {
  past_performance_title: string;
  rfp_requirement: string;
  alignment_score: number;
  reasoning: string;
}

export interface RequirementCoverage {
  requirement: string;
  source_section?: string;
  coverage_status: 'fully_covered' | 'partially_covered' | 'not_covered';
  supporting_evidence: string;
}

export interface GoNoGoFactor {
  factor: string;
  assessment: 'go' | 'caution' | 'no_go';
  rationale: string;
}

export const FIT_RATING_LABELS: Record<FitRating, string> = {
  strong_fit: 'Strong Fit',
  moderate_fit: 'Moderate Fit',
  weak_fit: 'Weak Fit',
  not_recommended: 'Not Recommended',
};

export const FIT_RATING_COLORS: Record<FitRating, string> = {
  strong_fit:      'bg-success/15 text-success border-success/30',
  moderate_fit:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  weak_fit:        'bg-warning/15 text-warning border-warning/30',
  not_recommended: 'bg-destructive/15 text-destructive border-destructive/30',
};

export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  draft: 'Draft',
  uploading: 'Uploading',
  ready: 'Ready to Analyze',
  analyzing: 'Analyzing...',
  complete: 'Complete',
  failed: 'Failed',
};

// ===== OPPORTUNITY FINDER TYPES =====

/** AI-extracted company profile from uploaded documents */
export interface ParsedCompanyProfile {
  company_name: string;
  naics_codes: string[];
  set_aside_codes: string[];
  keywords: string[];
  capabilities_summary: string;
  agency_experience: string[];
  contract_vehicles: string[];
  clearance_level?: string;
  business_size?: string;
  location?: { state?: string; zip?: string };
}

/** A single opportunity returned from SAM.gov */
export interface SamOpportunity {
  notice_id: string;
  title: string;
  solicitation_number?: string;
  department: string;
  sub_tier?: string;
  office?: string;
  posted_date: string;
  response_deadline?: string;
  type: string;
  base_type?: string;
  naics_code?: string;
  classification_code?: string;
  set_aside?: string;
  set_aside_description?: string;
  active: boolean;
  description?: string;
  resource_links?: string[];
  point_of_contact?: SamContact[];
  place_of_performance?: { state?: string; zip?: string; city?: string };
  award?: {
    date?: string;
    number?: string;
    amount?: number;
    awardee_name?: string;
  };
}

export interface SamContact {
  type?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  title?: string;
}

/** AI-scored opportunity match */
export interface ScoredOpportunity {
  opportunity: SamOpportunity;
  relevance_score: number;
  match_reasons: string[];
  naics_match: boolean;
  set_aside_match: boolean;
  capability_alignment: string;
  risk_factors: string[];
  recommended_action: 'pursue' | 'evaluate' | 'monitor' | 'skip';
  pursuit_priority: 'high' | 'medium' | 'low';
}

/** Full finder report stored in the analysis */
export interface OpportunityFinderReport {
  parsed_profile: ParsedCompanyProfile;
  total_opportunities_searched: number;
  total_matches: number;
  scored_opportunities: ScoredOpportunity[];
  search_summary: string;
  search_parameters: {
    naics_codes: string[];
    set_aside_codes: string[];
    keywords_used: string[];
    date_range: { from: string; to: string };
  };
}
