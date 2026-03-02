// Capture Module Types — Opportunity Confirmation
// Two modes: "raw" (upload everything) and "database" (use stored company data)

export type AnalysisMode = 'raw' | 'database';

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
  strong_fit: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  moderate_fit: 'bg-blue-100 text-blue-800 border-blue-200',
  weak_fit: 'bg-amber-100 text-amber-800 border-amber-200',
  not_recommended: 'bg-red-100 text-red-800 border-red-200',
};

export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  draft: 'Draft',
  uploading: 'Uploading',
  ready: 'Ready to Analyze',
  analyzing: 'Analyzing...',
  complete: 'Complete',
  failed: 'Failed',
};
