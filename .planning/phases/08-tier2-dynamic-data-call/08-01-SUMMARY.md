---
phase: 08-tier2-dynamic-data-call
plan: "01"
subsystem: data-layer
tags: [database, typescript, api, form-schema, file-upload, compliance-integration]
dependency_graph:
  requires: [07-01, 07-02]
  provides: [08-02, 08-03]
  affects: [proposal-generation]
tech_stack:
  added: []
  patterns: [supabase-upsert-on-conflict, multipart-formdata-upload, dynamic-schema-generation]
key_files:
  created:
    - supabase_tables/supabase-tier2-data-call-migration.sql
    - lib/supabase/tier2-types.ts
    - lib/ingestion/data-call-generator.ts
    - app/api/solicitations/[id]/data-call/route.ts
    - app/api/solicitations/[id]/data-call/upload/route.ts
  modified: []
decisions:
  - "generateDataCallSchema() fetches only completed extractions — pending/failed rows do not pollute the schema"
  - "POST upload auto-creates data_call_response row if absent — file uploads work before first form save"
  - "DELETE uses inner join on data_call_responses to verify ownership before removing storage object"
  - "Past performance default count is 3 when extraction lacks references_required — matches industry norm"
  - "Key personnel dynamic_count defaults to 0 (not a fixed number) — accurate when RFP specifies no named positions"
  - "File upload uses upsert:true in storage — clean re-upload semantics without stale-path errors"
  - "form_schema column in DB reserved for cache but is generated fresh on every GET — avoids stale schema issues"
metrics:
  duration_minutes: 6
  completed: 2026-02-25
  tasks_completed: 2
  files_created: 5
  files_modified: 0
---

# Phase 8 Plan 01: Tier 2 Data Call — Data Layer Summary

**One-liner:** Dynamic form schema generator reading Phase 7 compliance extractions to produce 5-section RFP-specific data call, backed by SQL migration, TypeScript types, and GET/PUT/POST/DELETE API endpoints.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Database schema and TypeScript types | eb11fcc | supabase-tier2-data-call-migration.sql, tier2-types.ts |
| 2 | Form schema generator and API endpoints | c484ee8 | data-call-generator.ts, data-call/route.ts, data-call/upload/route.ts |

## What Was Built

### Task 1: Database Schema and TypeScript Types

**`supabase-tier2-data-call-migration.sql`** creates two tables:

- **`data_call_responses`** — one row per solicitation + company, with JSONB columns for each of the 5 intake sections (opportunity_details, past_performance, key_personnel, technical_approach, compliance_verification), a cached form_schema, status check constraint (`in_progress` | `completed`), UNIQUE constraint on (solicitation_id, company_id), RLS enabled with authenticated policy, two indexes.

- **`data_call_files`** — one row per uploaded file, linked to a response row via FK, with section CHECK constraint (`past_performance` | `key_personnel` | `compliance_verification`), field_key for per-field association, Supabase storage path, RLS enabled with authenticated policy, two indexes.

**`lib/supabase/tier2-types.ts`** exports 17 TypeScript types/interfaces following the compliance-types.ts pattern:
- Enums: `DataCallStatus`, `DataCallFileSection`
- Display constants: `DATA_CALL_SECTION_LABELS`, `DATA_CALL_SECTION_ICONS`
- Section data interfaces: `OpportunityDetails`, `PastPerformanceRef`, `KeyPersonnelEntry`, `TechnicalApproach`, `ComplianceVerification`
- Form schema interfaces: `DataCallFormField`, `DataCallSection`, `DataCallFormSchema`
- DB table interfaces: `DataCallResponse`, `DataCallFile`
- Convenience types: `DataCallGetResponse`, `DataCallSaveRequest`, `DataCallUploadRequest`

### Task 2: Form Schema Generator and API Endpoints

**`lib/ingestion/data-call-generator.ts`** — core schema generator:

- `generateDataCallSchema(solicitationId)` queries `compliance_extractions` (status=completed only) and builds 5 `DataCallSection` objects
- Helper functions: `getExtractionValue<T>()`, `getExtractionLabel()`, `makeCitation()`, `buildCitation()`
- Section 1 (Opportunity Details): 6 static fields, pre-filled from admin_data extraction (NAICS, size standard, set-aside, contract type)
- Section 2 (Past Performance): dynamic count from `references_required` extraction (default: 3), 9 template fields per reference card, recency/relevance woven into description
- Section 3 (Key Personnel): dynamic count from `positions` array length (default: 0), one card per RFP-specified position with role pre-filled, LOC field required when `loc_requirements` found
- Section 4 (Technical Approach): 5 static narrative fields, rfp_citation from SOW task_areas extraction, task area names injected into description
- Section 5 (Compliance Verification): boolean org cert toggles (CMMC-driven), individual certs textarea, facility clearance boolean (required when DD254 required), NIST score field (required when nist_800_171_required), file upload slots for each required_attachment/required_forms from section_l extraction

**`app/api/solicitations/[id]/data-call/route.ts`**:
- GET: auth + company ownership check → generateDataCallSchema() + data_call_responses select + data_call_files select → `{ schema, response, files }`
- PUT: auth + ownership check → partial body upsert on conflict (solicitation_id, company_id) → sets completed_at when status=completed → `{ response, message }`

**`app/api/solicitations/[id]/data-call/upload/route.ts`**:
- POST: auth + ownership → multipart parse → validates section, file size (10MB max), MIME type (PDF/DOCX/DOC/PNG/JPG/JPEG) → auto-creates response row if absent → Supabase storage upload at `{company_id}/{solicitation_id}/{section}/{field_key}/{filename}` → inserts data_call_files record → `{ file }` 201
- DELETE: auth + ownership → inner join verify → storage remove + DB delete → `{ success: true }`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Exist
- supabase_tables/supabase-tier2-data-call-migration.sql: FOUND
- lib/supabase/tier2-types.ts: FOUND
- lib/ingestion/data-call-generator.ts: FOUND
- app/api/solicitations/[id]/data-call/route.ts: FOUND
- app/api/solicitations/[id]/data-call/upload/route.ts: FOUND

### Commits Exist
- eb11fcc: FOUND (Task 1 — DB schema + TypeScript types)
- c484ee8: FOUND (Task 2 — generator + API routes)

### TypeScript
- Zero new errors introduced in modified files (verified with tsc --noEmit --skipLibCheck)
- Pre-existing errors in other files are unchanged

## Self-Check: PASSED
