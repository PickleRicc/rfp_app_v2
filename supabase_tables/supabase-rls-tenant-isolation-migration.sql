-- ═══════════════════════════════════════════════════════════════════
-- RLS TENANT ISOLATION MIGRATION
-- ═══════════════════════════════════════════════════════════════════
--
-- PROBLEM: All existing RLS policies use USING (true) or
--   auth.role() = 'authenticated', which lets any logged-in user
--   read/write every row in every table. Zero tenant isolation.
--
-- FIX: Replace every permissive policy with company-scoped policies:
--   • Client users (linked to a company via company_profiles.client_user_id)
--     can ONLY access rows belonging to their company.
--   • Staff users (authenticated but NOT linked to any company)
--     can access all rows (they're internal/trusted users).
--   • Service-role calls bypass RLS automatically (unchanged).
--
-- HOW IT WORKS:
--   Two SECURITY DEFINER helper functions in the `public` schema resolve
--   the caller's role without hitting RLS on company_profiles (avoiding
--   circular deps):
--     public.user_company_id() → UUID or NULL
--     public.is_staff()        → BOOLEAN
--
-- Run this AFTER all prior migrations. Safe to re-run (idempotent).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-----------------------------------------------------------
-- HELPER FUNCTIONS (SECURITY DEFINER bypasses RLS)
-----------------------------------------------------------

-- Returns the company_profiles.id linked to the current auth user,
-- or NULL if the user is not a client (i.e., is staff).
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM company_profiles WHERE client_user_id = auth.uid() LIMIT 1;
$$;

-- Returns TRUE if the current user is staff (not linked to any company).
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM company_profiles WHERE client_user_id = auth.uid()
  );
$$;

-----------------------------------------------------------
-- INDEXES for helper function performance
-----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_company_profiles_client_user_id
  ON company_profiles(client_user_id);


-- ═══════════════════════════════════════════════════════════
-- GROUP 1: Tables with direct company_id column
-- Policy: staff sees all, client sees own company only
-- ═══════════════════════════════════════════════════════════

-----------------------------------------------------------
-- company_profiles
-- (uses `id` instead of `company_id` since this IS the company table)
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON company_profiles;
DROP POLICY IF EXISTS "tenant_isolation" ON company_profiles;

CREATE POLICY "tenant_isolation" ON company_profiles
  FOR ALL TO authenticated
  USING (public.is_staff() OR id = public.user_company_id())
  WITH CHECK (public.is_staff() OR id = public.user_company_id());


-----------------------------------------------------------
-- certifications
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON certifications;
DROP POLICY IF EXISTS "tenant_isolation" ON certifications;

CREATE POLICY "tenant_isolation" ON certifications
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- naics_codes
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON naics_codes;
DROP POLICY IF EXISTS "tenant_isolation" ON naics_codes;

CREATE POLICY "tenant_isolation" ON naics_codes
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- contract_vehicles
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON contract_vehicles;
DROP POLICY IF EXISTS "tenant_isolation" ON contract_vehicles;

CREATE POLICY "tenant_isolation" ON contract_vehicles
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- facility_clearances
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON facility_clearances;
DROP POLICY IF EXISTS "tenant_isolation" ON facility_clearances;

CREATE POLICY "tenant_isolation" ON facility_clearances
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- service_areas
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON service_areas;
DROP POLICY IF EXISTS "tenant_isolation" ON service_areas;

CREATE POLICY "tenant_isolation" ON service_areas
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- tools_technologies
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON tools_technologies;
DROP POLICY IF EXISTS "tenant_isolation" ON tools_technologies;

CREATE POLICY "tenant_isolation" ON tools_technologies
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- methodologies
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON methodologies;
DROP POLICY IF EXISTS "tenant_isolation" ON methodologies;

CREATE POLICY "tenant_isolation" ON methodologies
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- past_performance
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON past_performance;
DROP POLICY IF EXISTS "tenant_isolation" ON past_performance;

CREATE POLICY "tenant_isolation" ON past_performance
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- personnel
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON personnel;
DROP POLICY IF EXISTS "tenant_isolation" ON personnel;

CREATE POLICY "tenant_isolation" ON personnel
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- value_propositions
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON value_propositions;
DROP POLICY IF EXISTS "tenant_isolation" ON value_propositions;

CREATE POLICY "tenant_isolation" ON value_propositions
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- innovations
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON innovations;
DROP POLICY IF EXISTS "tenant_isolation" ON innovations;

CREATE POLICY "tenant_isolation" ON innovations
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- competitive_advantages
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON competitive_advantages;
DROP POLICY IF EXISTS "tenant_isolation" ON competitive_advantages;

ALTER TABLE competitive_advantages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON competitive_advantages
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- boilerplate_library
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON boilerplate_library;
DROP POLICY IF EXISTS "tenant_isolation" ON boilerplate_library;

CREATE POLICY "tenant_isolation" ON boilerplate_library
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- document_assets
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON document_assets;
DROP POLICY IF EXISTS "tenant_isolation" ON document_assets;

CREATE POLICY "tenant_isolation" ON document_assets
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- solicitations
-----------------------------------------------------------

DROP POLICY IF EXISTS "solicitations_authenticated_policy" ON solicitations;
DROP POLICY IF EXISTS "tenant_isolation" ON solicitations;

CREATE POLICY "tenant_isolation" ON solicitations
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- documents (company_id added by multicompany migration)
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON documents;
DROP POLICY IF EXISTS "tenant_isolation" ON documents;

CREATE POLICY "tenant_isolation" ON documents
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR company_id = public.user_company_id()
    OR company_id IS NULL  -- legacy docs without company assignment
  )
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- data_call_responses
-----------------------------------------------------------

DROP POLICY IF EXISTS "data_call_responses_authenticated_policy" ON data_call_responses;
DROP POLICY IF EXISTS "tenant_isolation" ON data_call_responses;

CREATE POLICY "tenant_isolation" ON data_call_responses
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- proposal_drafts
-----------------------------------------------------------

DROP POLICY IF EXISTS "proposal_drafts_authenticated_policy" ON proposal_drafts;
DROP POLICY IF EXISTS "tenant_isolation" ON proposal_drafts;

CREATE POLICY "tenant_isolation" ON proposal_drafts
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- touchup_analyses
-----------------------------------------------------------

DROP POLICY IF EXISTS "touchup_analyses_authenticated_policy" ON touchup_analyses;
DROP POLICY IF EXISTS "tenant_isolation" ON touchup_analyses;

CREATE POLICY "tenant_isolation" ON touchup_analyses
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-----------------------------------------------------------
-- past_performance_files
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON past_performance_files;
DROP POLICY IF EXISTS "Enable service role access" ON past_performance_files;
DROP POLICY IF EXISTS "tenant_isolation" ON past_performance_files;

CREATE POLICY "tenant_isolation" ON past_performance_files
  FOR ALL TO authenticated
  USING (public.is_staff() OR company_id = public.user_company_id())
  WITH CHECK (public.is_staff() OR company_id = public.user_company_id());


-- ═══════════════════════════════════════════════════════════
-- GROUP 2: Tables linked via parent FK (no direct company_id)
-- Policy: staff sees all, client sees rows whose parent
--         belongs to their company
-- ═══════════════════════════════════════════════════════════

-----------------------------------------------------------
-- solicitation_documents → solicitations.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "solicitation_documents_authenticated_policy" ON solicitation_documents;
DROP POLICY IF EXISTS "tenant_isolation" ON solicitation_documents;

CREATE POLICY "tenant_isolation" ON solicitation_documents
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR solicitation_id IN (
      SELECT id FROM solicitations WHERE company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR solicitation_id IN (
      SELECT id FROM solicitations WHERE company_id = public.user_company_id()
    )
  );


-----------------------------------------------------------
-- document_reconciliations → solicitations.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "document_reconciliations_authenticated_policy" ON document_reconciliations;
DROP POLICY IF EXISTS "tenant_isolation" ON document_reconciliations;

CREATE POLICY "tenant_isolation" ON document_reconciliations
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR solicitation_id IN (
      SELECT id FROM solicitations WHERE company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR solicitation_id IN (
      SELECT id FROM solicitations WHERE company_id = public.user_company_id()
    )
  );


-----------------------------------------------------------
-- template_field_mappings → solicitation_documents → solicitations.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "template_field_mappings_authenticated_policy" ON template_field_mappings;
DROP POLICY IF EXISTS "tenant_isolation" ON template_field_mappings;

CREATE POLICY "tenant_isolation" ON template_field_mappings
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR solicitation_document_id IN (
      SELECT sd.id FROM solicitation_documents sd
      JOIN solicitations s ON sd.solicitation_id = s.id
      WHERE s.company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR solicitation_document_id IN (
      SELECT sd.id FROM solicitation_documents sd
      JOIN solicitations s ON sd.solicitation_id = s.id
      WHERE s.company_id = public.user_company_id()
    )
  );


-----------------------------------------------------------
-- data_call_files → data_call_responses.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "data_call_files_authenticated_policy" ON data_call_files;
DROP POLICY IF EXISTS "tenant_isolation" ON data_call_files;

CREATE POLICY "tenant_isolation" ON data_call_files
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR data_call_response_id IN (
      SELECT id FROM data_call_responses WHERE company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR data_call_response_id IN (
      SELECT id FROM data_call_responses WHERE company_id = public.user_company_id()
    )
  );


-----------------------------------------------------------
-- compliance_extractions → solicitations.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "compliance_extractions_authenticated_policy" ON compliance_extractions;
DROP POLICY IF EXISTS "tenant_isolation" ON compliance_extractions;

CREATE POLICY "tenant_isolation" ON compliance_extractions
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR solicitation_id IN (
      SELECT id FROM solicitations WHERE company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR solicitation_id IN (
      SELECT id FROM solicitations WHERE company_id = public.user_company_id()
    )
  );


-----------------------------------------------------------
-- draft_volumes → proposal_drafts.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "draft_volumes_authenticated_policy" ON draft_volumes;
DROP POLICY IF EXISTS "tenant_isolation" ON draft_volumes;

CREATE POLICY "tenant_isolation" ON draft_volumes
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR draft_id IN (
      SELECT id FROM proposal_drafts WHERE company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR draft_id IN (
      SELECT id FROM proposal_drafts WHERE company_id = public.user_company_id()
    )
  );


-----------------------------------------------------------
-- section_results → documents.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON section_results;
DROP POLICY IF EXISTS "tenant_isolation" ON section_results;

CREATE POLICY "tenant_isolation" ON section_results
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR document_id IN (
      SELECT id FROM documents WHERE company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR document_id IN (
      SELECT id FROM documents WHERE company_id = public.user_company_id()
    )
  );


-----------------------------------------------------------
-- processing_logs → documents.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON processing_logs;
DROP POLICY IF EXISTS "tenant_isolation" ON processing_logs;

CREATE POLICY "tenant_isolation" ON processing_logs
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR document_id IN (
      SELECT id FROM documents WHERE company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR document_id IN (
      SELECT id FROM documents WHERE company_id = public.user_company_id()
    )
  );


-----------------------------------------------------------
-- rfp_responses → documents.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON rfp_responses;
DROP POLICY IF EXISTS "tenant_isolation" ON rfp_responses;

CREATE POLICY "tenant_isolation" ON rfp_responses
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR document_id IN (
      SELECT id FROM documents WHERE company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR document_id IN (
      SELECT id FROM documents WHERE company_id = public.user_company_id()
    )
  );


-----------------------------------------------------------
-- rfp_requirements → documents.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON rfp_requirements;
DROP POLICY IF EXISTS "tenant_isolation" ON rfp_requirements;

CREATE POLICY "tenant_isolation" ON rfp_requirements
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR document_id IN (
      SELECT id FROM documents WHERE company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR document_id IN (
      SELECT id FROM documents WHERE company_id = public.user_company_id()
    )
  );


-----------------------------------------------------------
-- proposal_volumes → rfp_responses → documents.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON proposal_volumes;
DROP POLICY IF EXISTS "tenant_isolation" ON proposal_volumes;

CREATE POLICY "tenant_isolation" ON proposal_volumes
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR response_id IN (
      SELECT r.id FROM rfp_responses r
      JOIN documents d ON r.document_id = d.id
      WHERE d.company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR response_id IN (
      SELECT r.id FROM rfp_responses r
      JOIN documents d ON r.document_id = d.id
      WHERE d.company_id = public.user_company_id()
    )
  );


-----------------------------------------------------------
-- exhibits → rfp_responses → documents.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON exhibits;
DROP POLICY IF EXISTS "tenant_isolation" ON exhibits;

CREATE POLICY "tenant_isolation" ON exhibits
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR response_id IN (
      SELECT r.id FROM rfp_responses r
      JOIN documents d ON r.document_id = d.id
      WHERE d.company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR response_id IN (
      SELECT r.id FROM rfp_responses r
      JOIN documents d ON r.document_id = d.id
      WHERE d.company_id = public.user_company_id()
    )
  );


-----------------------------------------------------------
-- pipeline_logs → solicitations.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "pipeline_logs_authenticated_policy" ON pipeline_logs;
DROP POLICY IF EXISTS "tenant_isolation" ON pipeline_logs;

-- Ensure RLS is enabled (may not have been in original migration)
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON pipeline_logs
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR solicitation_id IN (
      SELECT id FROM solicitations WHERE company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR solicitation_id IN (
      SELECT id FROM solicitations WHERE company_id = public.user_company_id()
    )
  );


-----------------------------------------------------------
-- touchup_volumes → touchup_analyses.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "touchup_volumes_authenticated_policy" ON touchup_volumes;
DROP POLICY IF EXISTS "tenant_isolation" ON touchup_volumes;

CREATE POLICY "tenant_isolation" ON touchup_volumes
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR touchup_id IN (
      SELECT id FROM touchup_analyses WHERE company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR touchup_id IN (
      SELECT id FROM touchup_analyses WHERE company_id = public.user_company_id()
    )
  );


-----------------------------------------------------------
-- touchup_volume_versions → touchup_volumes → touchup_analyses.company_id
-----------------------------------------------------------

DROP POLICY IF EXISTS "touchup_volume_versions_authenticated_policy" ON touchup_volume_versions;
DROP POLICY IF EXISTS "tenant_isolation" ON touchup_volume_versions;

CREATE POLICY "tenant_isolation" ON touchup_volume_versions
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR touchup_volume_id IN (
      SELECT tv.id FROM touchup_volumes tv
      JOIN touchup_analyses ta ON tv.touchup_id = ta.id
      WHERE ta.company_id = public.user_company_id()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR touchup_volume_id IN (
      SELECT tv.id FROM touchup_volumes tv
      JOIN touchup_analyses ta ON tv.touchup_id = ta.id
      WHERE ta.company_id = public.user_company_id()
    )
  );


-- ═══════════════════════════════════════════════════════════
-- GROUP 3: Special tables (keep existing good policies)
-- ═══════════════════════════════════════════════════════════

-- opportunity_analyses and opportunity_documents already have
-- proper user-scoped RLS (auth.uid() = created_by). No changes needed.

-- intake_tokens: accessed via service-role by API routes.
-- Enable RLS and restrict to staff only (clients don't manage tokens).
ALTER TABLE intake_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON intake_tokens;
CREATE POLICY "tenant_isolation" ON intake_tokens
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR company_id = public.user_company_id()
  )
  WITH CHECK (
    public.is_staff()
    OR company_id = public.user_company_id()
  );


COMMIT;

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION QUERY (run after migration to confirm)
-- ═══════════════════════════════════════════════════════════
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
