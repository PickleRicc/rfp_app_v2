---
phase: 08-tier2-dynamic-data-call
verified: 2026-02-26T00:00:00Z
status: human_needed
score: 14/14 must-haves verified
human_verification:
  - test: "Navigate to a solicitation with completed compliance extraction. Click the 'Data Call' tab. Verify accordion loads with 5 sections, each independently expandable."
    expected: "Tab appears. Accordion renders 5 sections (Opportunity Details, Past Performance, Key Personnel, Technical Approach, Compliance Verification). Multiple sections can be open simultaneously."
    why_human: "Requires a live Supabase environment with real extraction data to confirm the API round-trip and accordion rendering."
  - test: "Expand Opportunity Details. Verify fields show values pre-filled from admin_data extraction (NAICS, contract type, size standard, set-aside) and each field shows an inline RFP citation."
    expected: "Fields pre-populated from extraction. Citations like 'Per Section L.4.2' appear beneath field labels in muted italic."
    why_human: "Pre-fill from extraction depends on runtime data in compliance_extractions table — not verifiable statically."
  - test: "Expand Past Performance. Verify the correct number of pre-numbered cards appears (matching the RFP-extracted references_required, or 3 by default). Add one card, remove one."
    expected: "Card count matches extraction or shows 3. 'Add Reference' button appends a blank card. Remove button on each card deletes it (disabled when only 1 remains)."
    why_human: "Dynamic count is runtime data from extraction. Add/remove behavior requires live interaction."
  - test: "Expand Key Personnel. Upload a small PDF as a resume for one personnel card. Verify filename appears with a Remove button. Remove the file."
    expected: "Browse button opens file picker. After selection, filename appears inline. Remove button deletes file. No thumbnail shown."
    why_human: "File upload calls Supabase storage — requires live environment and the 'data-call-files' storage bucket to exist."
  - test: "Click 'Save Progress' with partial data filled. Reload the page. Verify saved data persists."
    expected: "PUT API persists data. On reload, GET API restores saved state. Dirty detection (beforeunload) fires when navigating away with unsaved changes."
    why_human: "Requires live Supabase upsert and session state — not verifiable statically."
  - test: "Click 'Complete Data Call' with required fields missing. Verify validation errors appear and affected sections auto-expand."
    expected: "Error summary banner shows count. Sections with errors auto-expand. Section headers show red warning icon. Save Progress is not blocked."
    why_human: "Validation gate behavior requires live form interaction."
  - test: "Fill all required fields and click 'Complete Data Call'. Verify success confirmation and status change."
    expected: "Green banner 'Data Call Complete — Ready for Draft Generation' appears. Status badge changes to 'Completed'. 'Reopen Data Call' button appears."
    why_human: "Requires end-to-end flow through all 5 sections with real data."
---

# Phase 8: Tier 2 Dynamic Data Call — Verification Report

**Phase Goal:** User is presented with an RFP-specific intake form — driven by what that particular RFP requires — and can complete it before draft generation begins
**Verified:** 2026-02-26T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | After extraction completes, the system can generate a data call form schema whose fields reflect what the specific RFP requires | VERIFIED | `generateDataCallSchema()` in `data-call-generator.ts` (682 lines) queries `compliance_extractions` by `solicitation_id` (line 654, 658) and builds 5 `DataCallSection` objects with `dynamic_count` and `rfp_citation` per field |
| 2  | Dynamic field counts are derived from extraction results, with sensible defaults when extraction lacks specifics | VERIFIED | `past_performance` section reads `references_required` (line 177), defaults to 3 (line 289). `key_personnel` reads `positions` array length, defaults to 0 (line 401) |
| 3  | Each generated field includes its RFP source citation when available | VERIFIED | `buildCitation()` helper populates `rfp_citation` on each field; all section components render `<Citation text={field.rfp_citation} />` when non-null |
| 4  | Data call responses can be saved (partial or complete) and retrieved | VERIFIED | GET returns `{ schema, response, files }` (route line 117-119). PUT upserts via `ON CONFLICT (solicitation_id, company_id)` (route lines 182-207). `DataCallView` PUT on save (line 574-586) and GET on mount (lines 504-520) |
| 5  | Files can be uploaded per-field and associated with a specific data call response field | VERIFIED | Upload route POST (upload/route.ts line 63+) stores to `data-call-files` bucket at path `{company_id}/{solicitation_id}/{section}/{field_key}/{filename}` and creates `data_call_files` DB record |
| 6  | User can see a 'Data Call' tab on the solicitation detail page | VERIFIED | `page.tsx` line 88: `{ id: "data-call", label: "Data Call", icon: <ClipboardCheck /> }` added to TABS array; line 458-460 renders `<DataCallView>` when `activeTab === "data-call"` |
| 7  | User can open/close accordion sections independently; multiple can be open simultaneously | VERIFIED | `openSections: Set<string>` state in `DataCallView`; toggle adds/removes from Set (not a single-active pattern); line 824: `openSections.has(section.id)` per section |
| 8  | User can confirm opportunity-level details: prime/sub role, teaming partners, contract type, NAICS size standard | VERIFIED | `OpportunityDetailsSection.tsx` (191 lines) renders all 6 fields: `prime_or_sub`, `teaming_partners`, `contract_type`, `naics_code`, `size_standard`, `set_aside` |
| 9  | User can provide past performance references with pre-numbered cards matching RFP-extracted count; add/remove supported | VERIFIED | `PastPerformanceSection.tsx` (351 lines): initializes from `section.dynamic_count ?? 3` (line 292), "Add Reference" button (line 340-347), "Remove" button per card (line 94-102), hidden when count is 1 |
| 10 | User can enter technical approach inputs: summary, tools/platforms, staffing model, assumptions, risks | VERIFIED | `TechnicalApproachSection.tsx` (175 lines) renders all 5 fields: `approach_summary`, `tools_and_platforms`, `staffing_model`, `assumptions`, `risks` — each with `rfp_citation` and `required` marks |
| 11 | User can upload key personnel resumes, certifications, and Letters of Commitment as per-field file uploads | VERIFIED | `KeyPersonnelSection.tsx` (683 lines) uses hidden input `ref.click()` pattern; POSTs to `/api/solicitations/{id}/data-call/upload` (line 374); field_keys: `personnel_{index}_resume`, `personnel_{index}_cert_{n}`, `personnel_{index}_loc` |
| 12 | User can provide compliance verification data: org certs, individual certs, facility clearance, NIST score, required attachments | VERIFIED | `ComplianceVerificationSection.tsx` (525 lines): `ToggleSwitch` (button[role=switch]) for org certs (line 385), facility clearance (line 459); NIST score text input (line 474+); attachment file uploads POST to upload endpoint (line 250) |
| 13 | Clicking 'Complete Data Call' validates all required fields across all sections; errors identify sections | VERIFIED | `validateDataCall()` in `DataCallView` (line 260-356); sections with errors auto-expand (line 612-613); error summary banner renders (line 771+); `status: "completed"` sent in PUT body (line 632) |
| 14 | Completed data call sets status to 'completed' and shows confirmation; Reopen available | VERIFIED | PUT route sets `completed_at` (route line 207); `DataCallView` shows green banner on completion (line 748+); `handleReopen()` sends `status: "in_progress"` (line 657-668) |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Plan | Lines | Status | Notes |
|----------|------|-------|--------|-------|
| `supabase_tables/supabase-tier2-data-call-migration.sql` | 01 | 169 | VERIFIED | `CREATE TABLE IF NOT EXISTS data_call_responses` and `data_call_files`, both with RLS and indexes, `UNIQUE(solicitation_id, company_id)` constraint |
| `lib/supabase/tier2-types.ts` | 01 | 407 | VERIFIED | Exports all required interfaces: `DataCallStatus`, `DataCallFileSection`, `OpportunityDetails`, `PastPerformanceRef`, `KeyPersonnelEntry`, `TechnicalApproach`, `ComplianceVerification`, `DataCallFormField`, `DataCallSection`, `DataCallFormSchema`, `DataCallResponse`, `DataCallFile` |
| `lib/ingestion/data-call-generator.ts` | 01 | 682 | VERIFIED | Exports `generateDataCallSchema()`, builds 5 sections from `compliance_extractions`, helpers: `getExtractionValue`, `makeCitation`, `buildCitation` |
| `app/api/solicitations/[id]/data-call/route.ts` | 01 | 244 | VERIFIED | Exports `GET` (schema + response + files) and `PUT` (upsert with `completed_at` on status=completed) |
| `app/api/solicitations/[id]/data-call/upload/route.ts` | 01 | 365 | VERIFIED | Exports `POST` (multipart upload, 10MB limit, storage + DB record) and `DELETE` (storage remove + DB delete) |
| `app/components/datacall/DataCallView.tsx` | 02/03 | 943 | VERIFIED | Accordion container, fetch/save/dirty-detection, beforeunload guard, `validateDataCall`, `isSectionComplete`, `Complete Data Call` button, summary panel, Reopen, full section routing (no placeholders) |
| `app/components/datacall/OpportunityDetailsSection.tsx` | 02 | 191 | VERIFIED | 6-field form (prime_or_sub select, teaming_partners textarea, contract_type/naics_code/size_standard/set_aside text inputs) with RFP citations and required marks |
| `app/components/datacall/PastPerformanceSection.tsx` | 02 | 351 | VERIFIED | Dynamic card count from `section.dynamic_count`, 9 fields per card, Add/Remove controls, info banner, dynamic_count_source citation |
| `app/components/datacall/TechnicalApproachSection.tsx` | 02 | 175 | VERIFIED | 5 textarea fields with RFP citations, info banner for SOW task areas |
| `app/components/datacall/KeyPersonnelSection.tsx` | 03 | 683 | VERIFIED | Per-card file uploads (resume, certs multi, LOC conditional), click-to-browse hidden input, spinner per field_key, filename display + Remove button |
| `app/components/datacall/ComplianceVerificationSection.tsx` | 03 | 525 | VERIFIED | `button[role=switch]` toggle pattern, NIST score text input, facility clearance toggle, required attachment uploads, all driven by schema fields |
| `app/solicitations/[id]/page.tsx` | 02 | — | VERIFIED | `data-call` tab added to TABS array, `DataCallView` imported and rendered conditionally with `solicitationId` and `companyId` props |

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `data-call-generator.ts` | `compliance_extractions` table | Supabase `.from('compliance_extractions').eq('solicitation_id', solicitationId)` | WIRED | Lines 654, 658 in generator |
| `data-call/route.ts` (GET) | `data-call-generator.ts` | `import { generateDataCallSchema }` | WIRED | Line 25, called at line 80 |
| `data-call/route.ts` (GET/PUT) | `data_call_responses` table | Supabase `.from('data_call_responses')` select + upsert | WIRED | Lines 83-84 (GET), 184+ (PUT) |
| `DataCallView.tsx` | `/api/solicitations/[id]/data-call` | `fetch(...)` GET on mount, PUT on save/complete | WIRED | Lines 504, 574, 626 |
| `page.tsx` | `DataCallView.tsx` | Import + render in `activeTab === "data-call"` block | WIRED | Lines 24, 458-460 |
| `PastPerformanceSection.tsx` | `DataCallFormSchema` | Reads `section.dynamic_count` | WIRED | Line 292 |
| `KeyPersonnelSection.tsx` | `/api/solicitations/[id]/data-call/upload` | `fetch(POST)` on file select | WIRED | Lines 374-376 |
| `ComplianceVerificationSection.tsx` | `/api/solicitations/[id]/data-call/upload` | `fetch(POST)` for attachment uploads | WIRED | Lines 244, 250 |
| `DataCallView.tsx` | `/api/solicitations/[id]/data-call` | `fetch(PUT)` with `status: "completed"` | WIRED | Line 632 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| TIER2-01 | 08-01-PLAN.md | System auto-generates RFP-specific data call form based on extraction results | SATISFIED | `generateDataCallSchema()` queries `compliance_extractions`, produces 5-section schema with dynamic counts and RFP citations |
| TIER2-02 | 08-02-PLAN.md | User can confirm opportunity details (prime/sub, teaming, contract type, NAICS size) | SATISFIED | `OpportunityDetailsSection` renders all 6 opportunity-level fields |
| TIER2-03 | 08-02-PLAN.md | User can provide past performance references (count driven by RFP-extracted requirements) | SATISFIED | `PastPerformanceSection` initializes from `section.dynamic_count`, supports add/remove |
| TIER2-04 | 08-03-PLAN.md | User can upload key personnel resumes, certifications, and Letters of Commitment | SATISFIED | `KeyPersonnelSection` implements click-to-browse uploads for resume (required), certs (multi, optional), LOC (conditional) |
| TIER2-05 | 08-02-PLAN.md | User can provide technical approach inputs (summary, tools, staffing, assumptions, risks) | SATISFIED | `TechnicalApproachSection` renders all 5 textarea fields |
| TIER2-06 | 08-03-PLAN.md | System collects compliance verification data (org certs, clearance, NIST, required attachments) | SATISFIED | `ComplianceVerificationSection` renders toggle switches, clearance, NIST score, file uploads — all driven by schema |

All 6 TIER2 requirements covered. No orphaned requirements found.

### Anti-Patterns Found

No blockers or warnings found:

- Zero `TODO`, `FIXME`, `PLACEHOLDER`, `XXX`, or `HACK` comments across all 11 Phase 8 files
- No placeholder divs (`Section coming in next plan...`) remain in `DataCallView.tsx` — both `key_personnel` and `compliance_verification` route to real components
- No stubs: all API handlers return real data (not static `{}` or `[]`)
- No console.log-only implementations

### Human Verification Required

All automated checks pass. The following require human testing in a live environment with real extraction data:

#### 1. Accordion Load and Extraction-Driven Content

**Test:** Navigate to a solicitation with completed compliance extraction. Click the "Data Call" tab.
**Expected:** Accordion loads with 5 sections. Each section can be expanded/collapsed independently. Multiple sections open simultaneously is supported.
**Why human:** Requires live Supabase environment and a solicitation that has completed Phase 7 extraction.

#### 2. Opportunity Details Pre-Fill from Extraction

**Test:** Expand Opportunity Details. Observe field values and citations.
**Expected:** Contract type, NAICS code, size standard, set-aside are pre-filled from `admin_data` extraction. Each field shows an inline RFP citation (e.g., "Per Section L.4.2") in muted italic below the label.
**Why human:** Pre-fill values come from runtime compliance_extractions data — cannot verify statically.

#### 3. Past Performance Dynamic Count

**Test:** Expand Past Performance. Count the pre-numbered reference cards. Add one card, remove one.
**Expected:** Card count matches `references_required` from extraction (or 3 if not extracted). Add Reference appends a blank card. Remove button deletes it (disabled when only 1 card).
**Why human:** Requires live extraction data to confirm count matching. Add/remove requires browser interaction.

#### 4. Key Personnel File Upload Flow

**Test:** Expand Key Personnel. Verify cards match extracted positions. Click Browse next to "Resume" on any card. Select a PDF under 10MB. Verify filename appears with Remove button. Remove the file.
**Expected:** Click-to-browse opens file picker (no drag-drop). After upload, only filename + Remove button shown (no thumbnail). Remove triggers DELETE to upload endpoint.
**Why human:** File upload requires a live Supabase storage bucket (`data-call-files`) to be provisioned.

#### 5. Save Progress and State Persistence

**Test:** Fill some fields. Click "Save Progress". Reload the page. Navigate away with unsaved changes (edit a field after save, then try to close tab).
**Expected:** Data persists after reload. "Saving..." state visible during PUT. beforeunload dialog fires when navigating away with unsaved changes.
**Why human:** Requires browser session and database write — cannot verify statically.

#### 6. Complete Data Call Validation Gate

**Test:** Click "Complete Data Call" with required fields missing.
**Expected:** Error summary banner appears ("N fields in Y sections need attention"). Sections with errors auto-expand. Section headers show red warning icon instead of green checkmark. Save Progress remains available.
**Why human:** Validation display and accordion behavior require live form interaction.

#### 7. Completion and Reopen

**Test:** Fill all required fields across all 5 sections. Click "Complete Data Call".
**Expected:** Green success banner appears. Status badge changes to "Completed". All form fields become read-only. "Reopen Data Call" button appears. Clicking Reopen returns to editable state.
**Why human:** Requires full end-to-end flow through all 5 sections in a live environment.

### Gaps Summary

No gaps found. All 14 observable truths verified against actual codebase code (not SUMMARY claims). All 11 artifact files exist with substantive line counts and correct content. All 9 key links are wired. All 6 TIER2 requirements are satisfied. Zero anti-patterns detected. Six items require human verification in a live environment with Supabase and real extraction data.

---

_Verified: 2026-02-26T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
