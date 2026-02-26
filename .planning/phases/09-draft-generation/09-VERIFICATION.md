---
phase: 09-draft-generation
verified: 2026-02-26T12:00:00Z
status: gaps_found
score: 5/6 must-haves verified (truths); 1 blocker anti-pattern; 1 requirement needs human review
re_verification: false
gaps:
  - truth: "Volume download endpoint serves stored DOCX buffer from Supabase storage"
    status: failed
    reason: "Generator uploads to bucket 'proposal-drafts' but download endpoint reads from bucket 'draft-volumes' — a DOCX uploaded to one bucket cannot be downloaded from the other, making all volume downloads return 500 storage errors"
    artifacts:
      - path: "lib/inngest/functions/proposal-draft-generator.ts"
        issue: "Line 441: supabase.storage.from('proposal-drafts').upload(...) — uploads to 'proposal-drafts' bucket"
      - path: "app/api/solicitations/[id]/draft/volumes/[volumeId]/route.ts"
        issue: "Line 119: supabase.storage.from('draft-volumes').download(...) — reads from 'draft-volumes' bucket"
    missing:
      - "One of the two bucket names must be changed to match. Either change the generator to upload to 'draft-volumes', or change the download route to read from 'proposal-drafts'. Both must use the same bucket name."
  - truth: "Required fill-in templates populated with customer data mapped to correct template fields (DRAFT-06)"
    status: partial
    reason: "DRAFT-06 requires that staffing plans, cost summaries, and past performance forms be populated with customer data mapped to correct template fields. The cost/price volume instructs the AI to use [PLACEHOLDER] markers for ALL dollar amounts, rates, and staffing levels — meaning the customer's own cost data from Tier 2 is not mapped. This may be an intentional design decision (per CONTEXT.md: 'Template population approach for fill-in forms' was left to Claude's discretion), but it means the 'populated with customer data' part of DRAFT-06 is not met for pricing templates."
    artifacts:
      - path: "lib/generation/draft/prompt-assembler.ts"
        issue: "buildCostPricePrompt (line 396-436): explicitly instructs AI to use [PLACEHOLDER] for ALL dollar amounts, rates, and hours — customer cost data from Tier 2 is not injected into the template"
    missing:
      - "Clarify whether DRAFT-06's 'populated with customer data' requirement applies to cost templates or only to staffing/past performance forms. Staffing and past performance ARE populated from Tier 2 data call — only cost/price uses pure placeholders."
human_verification:
  - test: "DOCX download end-to-end"
    expected: "Clicking 'Download DOCX' on a completed volume should download a .docx file. Currently blocked by storage bucket mismatch — needs bucket name fix first."
    why_human: "Cannot test file download programmatically; requires running application and verifying browser download"
  - test: "Draft generation flow: strategy gate to completed volumes"
    expected: "Strategy confirmation screen shows prime/sub role, teaming partners, contract type, win themes, volume structure, evaluation factors, and key personnel. Confirm & Generate triggers Inngest pipeline. Volumes appear one by one with progress indicators."
    why_human: "Real-time UI behavior and polling cannot be verified statically"
  - test: "Page limit status bar color coding"
    expected: "Green for under 85%, yellow for 85-100%, red for over limit — with progress bar filling proportionally"
    why_human: "Visual appearance requires browser rendering"
---

# Phase 9: Draft Generation Verification Report

**Phase Goal:** User confirms strategy at a human gate, then receives a compliant first draft that follows the RFP's volume structure, addresses every evaluation factor, and respects all formatting constraints
**Verified:** 2026-02-26
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                                              | Status          | Evidence                                                                                    |
|----|------------------------------------------------------------------------------------------------------------------------------------|-----------------|---------------------------------------------------------------------------------------------|
| 1  | Strategy confirmation GET endpoint returns assembled summary from Tier 1 profile + Tier 2 data call + compliance extractions       | VERIFIED        | `assembleStrategyConfirmation()` in route.ts queries company_profiles, data_call_responses, compliance_extractions and merges into StrategyConfirmation (lines 47-158)                 |
| 2  | Draft generation POST endpoint validates data call is completed, creates proposal_drafts row, and sends Inngest event              | VERIFIED        | POST checks `dataCall.status !== 'completed'` → 400 (line 316); upserts proposal_drafts; sends `proposal.draft.generate` event (line 420)                                             |
| 3  | Volume download endpoint serves stored DOCX buffer from Supabase storage                                                           | FAILED          | Generator uploads to bucket `'proposal-drafts'`; download route reads from bucket `'draft-volumes'` — bucket name mismatch means downloads always fail with storage error              |
| 4  | Draft status polling endpoint returns generation progress per volume                                                                | VERIFIED        | GET endpoint returns `{ strategy, draft, volumes }` — DraftGenerationView.tsx polls every 3 seconds via setInterval using this endpoint (lines 527-553)                               |
| 5  | Inngest function generates one DOCX per volume in the Section L volume structure                                                   | VERIFIED        | `proposalDraftGenerator` loops `draftVolumes` with per-volume `step.run('generate-volume-{order}')`, calls Claude, converts markdown, generates DOCX via `generateProposalVolume()`   |
| 6  | Each generated volume content references Tier 1 + Tier 2 + Section M evaluation factors                                           | VERIFIED        | All 5 volume-type prompt builders inject companyProfile, dataCallResponse, and extractions into prompts. Technical builder includes SOW task areas + Section M factors                 |
| 7  | Word count heuristic targets 85-90% of page limit per volume                                                                       | VERIFIED        | `PAGE_UTILIZATION_TARGET = 0.875` in prompt-assembler.ts; `calculateTargetWordCount()` computes `pageLimit * 250 * 0.875` (lines 139-149)                                             |
| 8  | Compliance matrix maps Section M evaluation factors to generated volume sections                                                   | VERIFIED        | `assembleComplianceMatrixData()` maps each factor to volume by keyword; `generate-compliance-matrix` step stores at volume_order=999 as content_markdown only                         |
| 9  | draft_volumes rows updated with word_count, page_estimate, page_limit_status, file_path, content_markdown as each volume completes | VERIFIED        | Lines 455-468 in proposal-draft-generator.ts update all 5 fields after each volume completes                                                                                          |
| 10 | User sees strategy summary before generation (prime/sub, teaming, contract type, strategy)                                         | VERIFIED        | StrategyConfirmation.tsx (506 lines) renders 6 cards: Opportunity Overview, Win Themes, Volume Structure, Evaluation Factors, Key Personnel, Past Performance count                    |
| 11 | User must explicitly confirm before draft proceeds                                                                                 | VERIFIED        | StrategyConfirmation renders "Confirm & Generate" button that POSTs to trigger generation; no implicit auto-start                                                                       |
| 12 | Volume-by-volume progress checklist updates as each volume completes                                                               | VERIFIED        | GeneratingView renders volume list with VolumeStatusIcon per volume; 3-second polling updates via setVolumes()                                                                          |
| 13 | Draft volume structure matches Section L volume names and order                                                                    | VERIFIED        | POST endpoint reads `volume_structure` from compliance_extractions where category='section_l', field_name='volume_structure'; falls back to 4-volume default if not extracted           |
| 14 | Page limit status bar per volume uses green/yellow/red color coding                                                                | VERIFIED        | PageLimitBar component uses `barColors: { under: 'bg-green-500', warning: 'bg-amber-400', over: 'bg-red-500' }` driven by page_limit_status field                                     |
| 15 | Draft tab appears in solicitation detail page tab bar                                                                              | VERIFIED        | app/solicitations/[id]/page.tsx line 95: `{ id: 'draft', label: 'Draft', icon: <Send> }` in TABS array; DraftGenerationView rendered at line 474                                      |
| 16 | Required fill-in templates populated with customer data (DRAFT-06)                                                                | PARTIAL         | Staffing/personnel and past performance ARE populated from Tier 2 data; cost/price volume uses [PLACEHOLDER] for all dollar amounts by design                                           |

**Score:** 14/16 truths verified (1 failed, 1 partial)

### Required Artifacts

| Artifact                                                                 | Expected                                               | Status     | Details                                                                                            |
|--------------------------------------------------------------------------|--------------------------------------------------------|------------|----------------------------------------------------------------------------------------------------|
| `supabase_tables/supabase-draft-generation-migration.sql`                | proposal_drafts and draft_volumes tables               | VERIFIED   | Both CREATE TABLE statements present with CHECK constraints, FK references, UNIQUE(solicitation_id, company_id), RLS policies, and indexes |
| `lib/supabase/draft-types.ts`                                            | TypeScript types for draft generation                  | VERIFIED   | Exports DraftStatus, VolumeStatus, PageLimitStatus, ProposalDraft, DraftVolume, StrategyConfirmation, DraftGetResponse, display constants  |
| `app/api/solicitations/[id]/draft/route.ts`                              | Strategy confirmation GET and draft generation POST    | VERIFIED   | Exports GET (assembly) and POST (trigger with validation); 441 lines                               |
| `app/api/solicitations/[id]/draft/volumes/[volumeId]/route.ts`           | Volume DOCX download endpoint                          | PARTIAL    | File exists, auth/ownership correct, but reads from wrong storage bucket ('draft-volumes' vs 'proposal-drafts') |
| `lib/generation/draft/prompt-assembler.ts`                               | Prompt assembler with assembleVolumePrompt and assembleComplianceMatrixData | VERIFIED | 631 lines; both functions exported with correct signatures; 5 volume type handlers |
| `lib/inngest/functions/proposal-draft-generator.ts`                      | Inngest function for volume-by-volume draft generation  | VERIFIED   | 663 lines; fetch-all-data, per-volume generation steps, compliance matrix, finalize; error isolation per-volume |
| `app/api/inngest/route.ts`                                               | Updated Inngest route with proposalDraftGenerator registered | VERIFIED | Line 9: import; line 20: registered in serve() functions array                                     |
| `app/components/draft/StrategyConfirmation.tsx`                          | Read-only strategy summary screen with Confirm & Generate | VERIFIED | 506 lines; 6 cards; Confirm & Generate button; Regenerate Draft if existing; Back to Data Call link; Array.isArray guards |
| `app/components/draft/DraftGenerationView.tsx`                           | Draft generation progress, preview, download, compliance matrix | VERIFIED | 657 lines; state machine (strategy/generating/complete); polling via useRef; PageLimitBar; SimpleMarkdown; VolumeCard with download link; ComplianceMatrixSection |
| `app/solicitations/[id]/page.tsx`                                        | Updated solicitation detail page with Draft tab        | VERIFIED   | Line 26: import DraftGenerationView; line 95: Draft tab in TABS array; line 474: DraftGenerationView rendered with onTabChange prop |

### Key Link Verification

| From                                                   | To                                          | Via                                      | Status   | Details                                                                                             |
|--------------------------------------------------------|---------------------------------------------|------------------------------------------|----------|-----------------------------------------------------------------------------------------------------|
| `app/api/solicitations/[id]/draft/route.ts`            | company_profiles + data_call_responses + compliance_extractions | Supabase queries in assembleStrategyConfirmation() | WIRED | Lines 54-84: three separate queries with .from('company_profiles'), .from('data_call_responses'), .from('compliance_extractions') |
| `app/api/solicitations/[id]/draft/route.ts`            | Inngest event `proposal.draft.generate`     | inngest.send (line 420)                  | WIRED    | `inngest.send({ name: 'proposal.draft.generate', data: { solicitationId, companyId, draftId } })`   |
| `lib/inngest/functions/proposal-draft-generator.ts`    | `lib/generation/draft/prompt-assembler.ts`  | import assembleVolumePrompt (line 36)    | WIRED    | Called at line 384 for each volume in the per-volume step                                           |
| `lib/inngest/functions/proposal-draft-generator.ts`    | `lib/generation/docx/generator.ts`          | import generateProposalVolume, saveDocxToBuffer (lines 41-42) | WIRED | Called at lines 422 and 434                                                                 |
| `lib/inngest/functions/proposal-draft-generator.ts`    | proposal_drafts + draft_volumes tables      | Supabase updates                         | WIRED    | Multiple .from('draft_volumes') and .from('proposal_drafts') update calls throughout                |
| `app/api/inngest/route.ts`                             | `lib/inngest/functions/proposal-draft-generator.ts` | function registration (lines 9, 20) | WIRED | Imported and included in serve() functions array                                                    |
| `app/components/draft/StrategyConfirmation.tsx`        | `/api/solicitations/[id]/draft`             | fetch GET on mount; fetch POST on confirm | WIRED  | Lines 125 and 155: fetch() with X-Company-Id header                                                |
| `app/components/draft/DraftGenerationView.tsx`         | `/api/solicitations/[id]/draft`             | GET polling every 3 seconds              | WIRED    | startPolling() uses setInterval fetch at line 529                                                   |
| `app/components/draft/DraftGenerationView.tsx`         | `/api/solicitations/[id]/draft/volumes/`    | DOCX download links                      | PARTIAL  | VolumeCard renders `<a href="/api/solicitations/{id}/draft/volumes/{volume.id}">` — link is correct but download will fail due to storage bucket mismatch |
| `app/solicitations/[id]/page.tsx`                      | `app/components/draft/DraftGenerationView.tsx` | import and render in Draft tab         | WIRED    | Line 26: import; line 474: rendered with solicitationId, companyId, onTabChange props               |

### Requirements Coverage

| Requirement | Source Plans  | Description                                                                              | Status          | Evidence                                                                                           |
|-------------|---------------|------------------------------------------------------------------------------------------|-----------------|---------------------------------------------------------------------------------------------------|
| DRAFT-01    | 09-01, 09-03  | System presents human confirmation gate before draft generation                           | VERIFIED        | StrategyConfirmation.tsx renders read-only summary with explicit Confirm & Generate button before any POST is sent |
| DRAFT-02    | 09-01, 09-02  | System generates compliant draft from combined Tier 1 + Tier 2 + extraction data         | VERIFIED        | All three data sources fetched in fetch-all-data step; assembleVolumePrompt injects all three into prompts |
| DRAFT-03    | 09-02         | Draft follows volume structure specified in Section L of the specific RFP                 | VERIFIED        | POST reads volume_structure from compliance_extractions where category='section_l'; creates draft_volumes rows from this structure with 4-volume fallback |
| DRAFT-04    | 09-02         | Draft addresses every evaluation factor identified in Section M                           | VERIFIED        | Technical prompt builder filters and includes Section M eval factors; assembleComplianceMatrixData maps all Section M factors to volumes; compliance matrix tracks coverage |
| DRAFT-05    | 09-02, 09-03  | Draft respects formatting constraints from RFP (page limits, font sizes, margin requirements) | VERIFIED     | Page limit targeting at 87.5%; page_limit_status computed as under/warning/over; PageLimitBar renders per volume; font/margin handled by existing DOCX generator styles |
| DRAFT-06    | 09-02         | System identifies required fill-in templates and maps customer data to correct fields     | PARTIAL         | Staffing plans and past performance forms ARE populated with Tier 2 key_personnel and past_performance data; cost/price volume uses [PLACEHOLDER] for all financial fields by explicit design decision (per CONTEXT.md). Whether [PLACEHOLDER] markers satisfy "maps customer data to correct template fields" is ambiguous for the cost volume. |

### Anti-Patterns Found

| File                                                                              | Line     | Pattern                                    | Severity  | Impact                                                                                             |
|-----------------------------------------------------------------------------------|----------|--------------------------------------------|-----------|----------------------------------------------------------------------------------------------------|
| `lib/inngest/functions/proposal-draft-generator.ts`                               | 441      | Storage bucket `'proposal-drafts'` for upload | BLOCKER | Generated DOCX files are uploaded to bucket `'proposal-drafts'` but download route reads from `'draft-volumes'` — all DOCX downloads will fail with a Supabase storage error |
| `app/api/solicitations/[id]/draft/volumes/[volumeId]/route.ts`                    | 119      | Storage bucket `'draft-volumes'` for download | BLOCKER | Same bucket mismatch — these two lines must use the same bucket name                              |

### Human Verification Required

#### 1. DOCX Download (blocked until bucket name fixed)

**Test:** After fixing the storage bucket mismatch, navigate to a solicitation with a completed draft, click "Download DOCX" on any volume
**Expected:** Browser downloads a `.docx` file with the volume name
**Why human:** File download behavior requires browser interaction; cannot verify statically

#### 2. Strategy Confirmation Gate — Visual Completeness

**Test:** Navigate to a solicitation's Draft tab with a completed data call. Verify the strategy confirmation screen appears with all 6 cards populated from live data.
**Expected:** Prime/Sub role badge, contract type, NAICS, set-aside, teaming partners, win themes, volume structure table, evaluation factors table, key personnel table, past performance count
**Why human:** Live data rendering and UI appearance cannot be verified statically

#### 3. Draft Generation Progress Polling

**Test:** Click "Confirm & Generate" and watch the volume checklist update in real time
**Expected:** Each volume status icon changes from gray Clock → blue Loader2 → green CheckCircle as Inngest generates it. After all complete, view transitions to complete view automatically.
**Why human:** Real-time polling behavior requires running application

#### 4. Page Limit Status Bar Color Coding

**Test:** In the complete view, verify volume cards show page limit bars in the correct colors
**Expected:** Green for volumes under 85% of limit, yellow for 85-100%, red for over limit
**Why human:** Visual color rendering requires browser

#### 5. DRAFT-06 — Cost Template [PLACEHOLDER] Behavior (Judgment Call)

**Test:** Review the generated Cost/Price volume content
**Expected:** Dollar amounts, rates, and staffing levels appear as `[PLACEHOLDER: $X]` markers for user fill-in in Word. Verify whether this satisfies the intended behavior for DRAFT-06 or whether actual cost data from Tier 2 should appear.
**Why human:** Product judgment required — the CONTEXT.md delegated template population approach to Claude's discretion; the system fills personnel and past performance with real data but uses placeholders for pricing. The requirement says "populated with customer data" — this needs owner review to determine if pricing [PLACEHOLDER] behavior is acceptable.

### Gaps Summary

**1 blocker gap identified — DOCX downloads are broken:**

The generator (`lib/inngest/functions/proposal-draft-generator.ts`) uploads generated DOCX files to the Supabase storage bucket named `'proposal-drafts'`. The download endpoint (`app/api/solicitations/[id]/draft/volumes/[volumeId]/route.ts`) attempts to retrieve files from a bucket named `'draft-volumes'`. These are different bucket names, so the download always fails with a storage error (404 or equivalent from Supabase).

**Fix required:** Change one of the two bucket names to match the other. Recommended: change the download route to use `'proposal-drafts'` (the name used at upload time), or change both to a consistently-named bucket and ensure that bucket exists in the Supabase project.

**1 partial gap (needs owner judgment):**

DRAFT-06 requires "Required fill-in templates populated with customer data mapped to correct template fields." Staffing plans (key_personnel) and past performance forms ARE populated with customer Tier 2 data in the generation prompts. However, cost/price templates intentionally use `[PLACEHOLDER: $X]` for all financial figures — this was designated as "Claude's discretion" in CONTEXT.md. This satisfies the "identifies required fill-in templates" part of the requirement but arguably not the "maps customer data to correct template fields" part for pricing. Owner confirmation is needed on whether this is acceptable.

---

_Verified: 2026-02-26_
_Verifier: Claude (gsd-verifier)_
