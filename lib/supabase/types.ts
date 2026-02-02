// Database schema types for simplified RFP analyzer

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type DocumentType = 'rfp' | 'proposal' | 'contract' | 'other' | 'unknown';

export interface Document {
  id: string;
  filename: string;
  file_path: string;
  document_type: DocumentType | null;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
}

export interface SectionResult {
  id: string;
  document_id: string;
  section_name: string;
  section_number: number;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ProcessingLog {
  id: string;
  document_id: string;
  stage: string;
  status: 'started' | 'completed' | 'failed';
  metadata: Record<string, any>;
  error?: string;
  created_at: string;
}

// Stage 2: RFP Response types
export type ResponseStatus = 'generating' | 'completed' | 'failed' | 'draft' | 'final';

export interface ResponseContent {
  executive_summary?: string;
  company_overview?: string;
  technical_approach?: string;
  project_scope_response?: string;
  timeline_response?: string;
  budget_response?: string;
  team_qualifications?: string;
  evaluation_criteria_response?: string;
  [key: string]: any; // Allow flexible sections
}

export interface BrandingOptions {
  company_name?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
}

export interface TemplateOptions {
  include_cover_page?: boolean;
  include_table_of_contents?: boolean;
  page_size?: 'A4' | 'Letter';
  margins?: string;
  header_footer?: boolean;
}

export interface RfpResponse {
  id: string;
  document_id: string;
  status: ResponseStatus;
  content: ResponseContent;
  html_template: string | null;
  rendered_html: string | null;
  version: number;
  is_latest: boolean;
  branding: BrandingOptions;
  template_options: TemplateOptions;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
