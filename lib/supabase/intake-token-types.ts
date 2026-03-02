export interface IntakeToken {
  id: string;
  company_id: string;
  token: string;
  label: string | null;
  created_by: string | null;
  expires_at: string;
  last_accessed_at: string | null;
  access_count: number;
  is_revoked: boolean;
  created_at: string;
  updated_at: string;
}

export interface IntakeTokenWithCompany extends IntakeToken {
  company_name: string;
}
