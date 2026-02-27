# Data Calls, Storage, and Data Flow

## Database: Supabase (PostgreSQL)

All structured data lives in a Supabase PostgreSQL database. File storage (DOCX outputs, uploaded resumes/certs) uses Supabase Storage buckets. There is no secondary database, no Redis cache, no external data warehouse.

### Three Supabase Client Variants

| Client | File | Used Where | Auth Level |
|---|---|---|---|
| **Service Role Client** | `lib/supabase/client.ts` | All API routes, all Inngest functions | Bypasses RLS entirely — full database access |
| **Server SSR Client** | `lib/supabase/server.ts` | Auth checks, middleware | Cookie-aware, uses anon key, respects RLS |
| **Browser Client** | `lib/supabase/browser.ts` | Client-side auth UI only | Anon key, browser-safe |

The service role client (`getServerClient()`) is what 99% of the application uses for data operations. RLS policies on all tables are permissive (`FOR ALL TO authenticated USING (true)`) — actual access control is enforced at the API layer by checking the `X-Company-Id` header or deriving company from the user's session.

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL        — Supabase project URL (public)
NEXT_PUBLIC_SUPABASE_ANON_KEY   — Supabase anon/public key (public)
SUPABASE_SERVICE_ROLE_KEY       — Supabase service role key (server-only, secret)
```

---

## Complete Database Schema

All migration SQL files live in `/supabase_tables/` and must be run in order.

### Core Document Tables (v1 Legacy)

**`documents`** — Uploaded RFP files
```
id (UUID PK), company_id (FK), filename, file_path, file_size,
document_type (rfp/proposal/contract/other), status (pending→processing→completed→failed),
solicitation_number, metadata (JSONB), created_at, updated_at
```

**`section_results`** — Parsed RFP sections from Stage 1 analysis
```
id, document_id (FK), section_name (executive_summary/project_scope/technical_requirements/...),
content (TEXT), metadata (JSONB), created_at
```

**`processing_logs`** — Pipeline audit trail
```
id, document_id (FK), stage (upload/classification/section_analysis/...),
status (started/completed/failed), message, metadata (JSONB), error, created_at
```

**`rfp_responses`** — Generated responses (v1 legacy)
```
id, document_id (FK), content (JSONB), html_template, rendered_html,
branding (JSONB), template_options (JSONB), page_allocation (JSONB),
outline (JSONB), status, created_at, updated_at
```

### Tier 1 — Company Knowledge Base Tables

**`company_profiles`** — Master company record (~40+ fields)
```
id (UUID PK), user_id (FK auth.users), client_user_id (FK auth.users, nullable),
company_name, legal_name, dba_name, cage_code, uei_number, sam_status,
ein, duns_number, headquarters_address (JSONB Address),
proposal_poc (JSONB ContactPerson), authorized_signer (JSONB ContactPerson),
contracts_poc (JSONB ContactPerson), website, phone, founded_year,
employee_count, annual_revenue,

-- Tier 1 Enterprise Fields
business_size (small/large/other), socioeconomic_certs (TEXT[]),
corporate_overview (TEXT), mission_statement (TEXT),
core_services_summary (TEXT), elevator_pitch (TEXT),
enterprise_win_themes (TEXT[]), key_differentiators_summary (TEXT),
standard_management_approach (TEXT),
iso_cmmi_status (JSONB), dcaa_approved_systems (JSONB),
primary_naics, has_facility_clearance (BOOL), clearance_level,
logo_url, tier1_complete (BOOL), completeness_score (INT),
created_at, updated_at
```

**`certifications`** — Small business certifications
```
id, company_id (FK), certification_type, certifying_agency,
certification_number, issue_date, expiration_date, status, created_at
```

**`naics_codes`** — NAICS registrations
```
id, company_id (FK), code, title, is_primary (BOOL), created_at
```

**`contract_vehicles`** — GWAC/IDIQ/GSA vehicles
```
id, company_id (FK), vehicle_name, vehicle_type, contract_number,
ordering_period_end, labor_categories (TEXT[]), ceiling_value, created_at
```

**`facility_clearances`** — Facility clearance metadata
```
id, company_id (FK), clearance_level, sponsoring_agency,
cage_code, expiration_date, created_at
```

**`service_areas`** — Capability areas
```
id, company_id (FK), service_name, description,
key_clients (TEXT[]), years_experience, created_at
```

**`tools_technologies`** — Tech stack
```
id, company_id (FK), name, category, description,
proficiency (expert/advanced/intermediate/beginner), years_experience, created_at
```

**`methodologies`** — Process frameworks
```
id, company_id (FK), name, category, description, created_at
```

**`past_performances`** — Contract history
```
id, company_id (FK), contract_nickname, client_agency, contract_number,
contract_type, contract_value, start_date, end_date, role,
team_size, overview, description_of_effort, task_areas (TEXT[]),
naics_code, set_aside, location, clearance_required,
achievements (JSONB Achievement[]), cpars_rating (JSONB CparsRating),
client_poc (JSONB ContactPerson), created_at, updated_at
```

**`personnel`** — Staff records
```
id, company_id (FK), full_name, title, email, phone,
total_experience_years, federal_experience_years,
clearance_level, clearance_status, clearance_expiration,
pmp_certified (BOOL), itil_certified (BOOL), other_certifications (TEXT[]),
education (JSONB Degree[]), work_history (JSONB WorkPosition[]),
proposed_roles (JSONB ProposedRole[]), bio, created_at, updated_at
```

**`value_propositions`** — Win themes
```
id, company_id (FK), theme, statement, proof_points (TEXT[]),
applicable_to (TEXT[]), created_at
```

**`innovations`** — Proprietary capabilities
```
id, company_id (FK), name, description, evidence, created_at
```

**`competitive_advantages`** — Ghosting phrases
```
id, company_id (FK), area, advantage, ghosting_phrase, created_at
```

**`boilerplate_library`** — Reusable text blocks
```
id, company_id (FK), name, type (company_intro/quality_approach/risk_management/...),
variant (brief/standard/detailed), content, tags (TEXT[]), created_at, updated_at
```

**`document_assets`** — Logos and org charts
```
id, company_id (FK), asset_type, file_url, description, created_at
```

### Solicitation Pipeline Tables (v2)

**`solicitations`** — Solicitation package grouping
```
id (UUID PK), company_id (FK), solicitation_number (UNIQUE per company),
title, agency, status (uploading/classifying/reconciling/ready/failed),
document_count, created_at, updated_at
```

**`solicitation_documents`** — Individual files in a solicitation
```
id (UUID PK), solicitation_id (FK), filename, file_path, file_size,
document_type (11 types: base_rfp/soo_sow_pws/amendment/qa_response/
  pricing_template/dd254/clauses/cdrls/wage_determination/provisions/other_unclassified),
document_type_label, classification_confidence (high/medium/low),
classification_reasoning, amendment_number, effective_date,
is_superseded (BOOL), superseded_by (self-ref FK),
extracted_text (TEXT), processing_status (uploading/extracting/classified/reconciled/failed),
sort_order, created_at, updated_at
```

**`document_reconciliations`** — Amendment/Q&A change tracking
```
id, source_document_id (FK), target_document_id (FK),
change_type (supersedes_section/adds_requirement/removes_requirement/
  general_modification/modifies_scope/modifies_page_limit/
  modifies_eval_criteria/modifies_submission_instructions),
section_reference, original_text, replacement_text,
is_active (BOOL), source_type, created_at
```

**`template_field_mappings`** — Fillable template fields
```
id, solicitation_document_id (FK), field_name, field_type,
field_label, section_reference, is_required (BOOL),
auto_fill_source (dot-notation path like 'company_profiles.cage_code'),
auto_fill_value, tag (action_required/reference_only), created_at
```

### Compliance Extraction Tables (Phase 7)

**`compliance_extractions`** — One row per extracted field per solicitation
```
id, solicitation_id (FK), source_document_id (FK),
category (9 values: section_l/section_m/admin_data/rating_scales/
  sow_pws/cost_price/past_performance/key_personnel/security_reqs),
field_name (machine key), field_label (human label),
field_value (JSONB — string/number/array/nested object),
confidence (high/medium/low),
is_user_override (BOOL), original_ai_value (JSONB — for revert),
extraction_status (pending/extracting/completed/failed),
error_message, created_at, updated_at
```

### Tier 2 Data Call Tables (Phase 8)

**`data_call_responses`** — Per-solicitation intake form
```
id, solicitation_id (FK), company_id (FK),
UNIQUE(solicitation_id, company_id),
status (draft/in_progress/completed),
opportunity_details (JSONB OpportunityDetails),
past_performance (JSONB PastPerformanceRef[]),
key_personnel (JSONB KeyPersonnelEntry[]),
technical_approach (JSONB TechnicalApproach),
compliance_verification (JSONB ComplianceVerification),
form_schema (JSONB DataCallFormSchema — cached dynamic form),
created_at, updated_at
```

**`data_call_files`** — Uploaded files for data call (resumes, certs, LOCs)
```
id, data_call_response_id (FK), section, field_key,
filename, file_path, mime_type, file_size, created_at
```

### Draft Generation Tables (Phase 9)

**`proposal_drafts`** — Generation run tracker
```
id, solicitation_id (FK), company_id (FK),
UNIQUE(solicitation_id, company_id),
status (pending/generating/completed/failed),
strategy_confirmed_at, generation_started_at, generation_completed_at,
error_message, created_at, updated_at
```

**`draft_volumes`** — Per-volume output
```
id, draft_id (FK), volume_name, volume_order,
status (pending/generating/completed/failed),
word_count, page_estimate, page_limit,
page_limit_status (under/warning/over),
file_path (Supabase Storage path),
content_markdown (TEXT — for in-app preview),
error_message, created_at, updated_at
```

### Supabase Storage Buckets

| Bucket | Contents | Path Pattern |
|---|---|---|
| `proposal-drafts` | Generated DOCX files | `drafts/{companyId}/{solicitationId}/{order}_{name}.docx` |
| `data-call-files` | Uploaded resumes, certs, LOCs | `{companyId}/{solicitationId}/{section}/{fieldKey}/{filename}` |

---

## How Data Flows Through the Application

### The Request Lifecycle (Staff App)

```
Browser Component
  │
  ├─ useCompany() → reads selectedCompanyId from CompanyContext
  │                  (persisted in localStorage as 'rfp_app_selected_company_id')
  │
  ├─ useFetchWithCompany(url, options)
  │   → wraps fetch() with header: X-Company-Id: {selectedCompanyId}
  │
  └─ HTTP Request → Next.js API Route
                     │
                     ├─ requireStaffOrResponse() → validates Supabase session
                     ├─ getCompanyIdOrResponse() → reads X-Company-Id header
                     ├─ getServerClient() → service role Supabase client
                     ├─ supabase.from(table).select().eq('company_id', companyId)
                     └─ Returns JSON response
```

### The Request Lifecycle (Portal / Client)

```
Portal Component
  │
  ├─ fetchWithPortal(url, options)
  │   → wraps fetch() with header: X-Portal: true
  │
  └─ HTTP Request → Next.js API Route
                     │
                     ├─ requireClientOrResponse() → validates Supabase session
                     ├─ getCompanyIdOrResponse() → queries company_profiles
                     │   WHERE client_user_id = authenticated user ID
                     ├─ getServerClient() → service role Supabase client
                     └─ Same Supabase queries, same data, scoped to client's company
```

### The Background Pipeline (Inngest Events)

```
API Route                           Inngest Function
  │                                   │
  ├─ inngest.send({                   ├─ Receives event
  │    name: 'event.name',            ├─ getServerClient() → service role client
  │    data: { ids... }               ├─ Reads from Supabase (documents, profiles, extractions)
  │  })                               ├─ Calls Anthropic Claude API
  │                                   ├─ Writes results to Supabase
  └─ Returns 200 to user             └─ Sends follow-up event (chains pipeline steps)
```

### Event Chain (Full Solicitation Pipeline)

```
POST /api/solicitations/[id]/upload
  → Inngest: 'solicitation.document.uploaded' (per file)
    → solicitationDocumentClassifier
      → Check: all docs done? → 'solicitation.classification.complete'
        → solicitationReconciler
          → 'solicitation.reconciliation.complete'
            → solicitationComplianceExtractor
              → All 9 passes complete → solicitation status = 'ready'

POST /api/solicitations/[id]/draft
  → Inngest: 'proposal.draft.generate'
    → proposalDraftGenerator
      → Per-volume DOCX generation + upload to Storage
      → proposal_drafts status = 'completed'
```

---

## State Management

### No Global State Library
There is no Redux, Zustand, Jotai, or similar. The app uses:

1. **React Context** — `CompanyContext` for the selected company
2. **Component-level `useState`/`useEffect`** — each page fetches its own data on mount
3. **No client-side cache** — no SWR, React Query, or TanStack Query. Every component makes fresh `fetch()` calls.

### CompanyContext (`lib/context/CompanyContext.tsx`)

The only shared state in the app:

```
Provides:
  - selectedCompanyId: string | null
  - selectedCompany: { id, company_name, cage_code, uei_number, completeness_score } | null
  - companies: Company[]
  - loading: boolean
  - selectCompany(id): void
  - refreshCompanies(): void

Persistence:
  - localStorage key: 'rfp_app_selected_company_id'
  - On mount: loads companies via GET /api/companies, restores selection from localStorage
  - Auto-selects first company if saved selection no longer exists
```

### Data Fetching Hooks

**`useFetchWithCompany`** (`lib/hooks/useFetchWithCompany.ts`):
- Returns `fetchWithCompany(url, options)` function
- Reads `selectedCompanyId` from `useCompany()` context
- Injects `X-Company-Id: {id}` header into every request
- Used by all staff-side components

**`fetchWithPortal`** (`lib/hooks/useFetchWithPortal.ts`):
- Standalone function (not a hook)
- Injects `X-Portal: true` header
- Used by portal pages — company is derived server-side from the session

---

## How Each Data Type Is Created and Used

### Company Profile Data (Tier 1)

**Created:** Via staff UI (`/company/profile`) or client portal (`/portal/onboarding/profile`)
**Stored:** `company_profiles` table + related tables (certifications, personnel, etc.)
**Used in generation:** Loaded by `proposalDraftGenerator` as Tier 1 data. Fields like `corporate_overview`, `core_services_summary`, `enterprise_win_themes`, and `standard_management_approach` are injected directly into Claude prompts.

### Solicitation Documents

**Created:** Staff uploads files via `POST /api/solicitations/[id]/upload`
**Text extracted:** PDFs go through Python microservice (pypdf); DOCX/TXT use `file.text()`
**Stored:** `solicitation_documents.extracted_text` (full text in DB column)
**Used:** Fed into classification, reconciliation, and compliance extraction AI calls

### Compliance Extractions

**Created:** By `solicitationComplianceExtractor` Inngest function (9 Claude passes)
**Stored:** `compliance_extractions` table — one row per extracted field
**Used in two ways:**
  1. `data-call-generator.ts` reads extractions to build the dynamic Tier 2 form schema
  2. `prompt-assembler.ts` reads extractions to build volume-specific Claude prompts for generation

### Data Call Responses (Tier 2)

**Created:** User fills the dynamic form in the Data Call tab of the solicitation view
**Stored:** `data_call_responses` table — 5 JSONB columns for the 5 form sections
**Used:** Loaded by `proposalDraftGenerator` and injected into Claude prompts alongside Tier 1 data

### Draft Volumes

**Created:** By `proposalDraftGenerator` Inngest function (one step per volume)
**Stored:** Two places:
  - `draft_volumes.content_markdown` — markdown text for in-app preview
  - Supabase Storage `proposal-drafts` bucket — DOCX file
**Used:** Downloaded by user via the Draft tab UI

### Template Field Mappings

**Created:** By `solicitationReconciler` during the template detection step
**Stored:** `template_field_mappings` table
**Auto-filled:** `resolveAutoFillValue()` immediately fills known values from `company_profiles` using dot-notation paths (e.g., `company_profiles.cage_code` → actual CAGE code value)

---

## Database-Level Caching

The only cached computation in the database:

**`data_call_responses.form_schema`** — The dynamically-generated data call form schema (computed from `compliance_extractions`) is stored in this JSONB column. It's regenerated on first GET request and written back to avoid recomputation on every page load.

---

## Type Definitions

All TypeScript interfaces live in `lib/supabase/`:

| File | Types Defined |
|---|---|
| `types.ts` | Document, SectionResult, RfpResponse |
| `company-types.ts` | CompanyProfile, PastPerformance, Personnel, Certification, ContractVehicle, ServiceArea, ValueProposition, Innovation, CompetitiveAdvantage, BoilerplateEntry, Address, ContactPerson, Degree, WorkPosition, ProposedRole, Achievement, CparsRating, ISOCMMIStatus, DCAAApprovedSystems |
| `compliance-types.ts` | ComplianceExtraction, ExtractionCategory (9 values), typed field structures per category |
| `solicitation-types.ts` | Solicitation, SolicitationDocument, DocumentReconciliation, TemplateFieldMapping, 11 document type constants |
| `tier2-types.ts` | DataCallResponse, DataCallFile, OpportunityDetails, PastPerformanceRef, KeyPersonnelEntry, TechnicalApproach, ComplianceVerification, DataCallFormSchema |
| `draft-types.ts` | ProposalDraft, DraftVolume, StrategyConfirmation, DraftGetResponse |
