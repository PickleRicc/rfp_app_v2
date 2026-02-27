# RFP Extraction Flow — Under the Hood

## Overview: Two Parallel Pipelines

The codebase contains two distinct extraction pipelines:

| Pipeline | Status | Tables | Trigger Pattern |
|---|---|---|---|
| **Legacy (v1)** | Functional but superseded | `documents`, `section_results`, `rfp_responses` | `document.uploaded` → `document.classified` → `response.generate` |
| **Modern (v2)** | Production path | `solicitations`, `solicitation_documents`, `compliance_extractions`, `data_call_responses`, `proposal_drafts` | `solicitation.document.uploaded` → `classification.complete` → `reconciliation.complete` → `proposal.draft.generate` |

This document covers the **modern v2 pipeline** in full depth, with a summary of v1 at the end.

---

## Step 1: Document Upload and Text Extraction

**Entry Point:** `POST /api/solicitations/[id]/upload`
**File:** `app/api/solicitations/[id]/upload/route.ts`

### What Happens

1. **Auth gate:** `requireStaffOrResponse()` validates the Supabase session
2. **Company gate:** Reads `X-Company-Id` header, checks `tier1_complete = true` on `company_profiles`
3. **File validation:** Accepts `.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, `.txt` (both by MIME type and extension)
4. **Text extraction (synchronous in the API handler):**

   **For PDFs:**
   - Calls the Python FastAPI microservice at `PDF_SERVICE_URL/extract-text` (default `http://localhost:8000`)
   - The microservice uses `pypdf` (`PdfReader`) to iterate all pages
   - Returns `{ text, pages, metadata, character_count, word_count }`
   - Each page is delimited with `--- Page N ---` markers
   - **No OCR** — text-layer PDFs only

   **For DOCX/XLSX/TXT:**
   - Calls `file.text()` directly (yields raw XML for Office formats, plain text for .txt)

5. **Database insert:** Creates row in `solicitation_documents` with:
   - `processing_status = 'extracting'`
   - `extracted_text = <full text>`
   - The text is stored directly in the database column, not in file storage

6. **Fires Inngest event:** `solicitation.document.uploaded` with `{ solicitationId, documentId, extractedText }`
7. **Updates solicitation status** to `classifying`

### The Python PDF Microservice

**Location:** `pdf-service/main.py`
**Framework:** FastAPI
**Library:** `pypdf`
**Port:** 8000

```python
POST /extract-text
  - Accepts: multipart file upload
  - Uses PdfReader to iterate all pages
  - Calls page.extract_text() per page
  - Prepends "--- Page N ---" markers
  - Returns: { text, pages, metadata: {title, author, ...}, character_count, word_count }
```

Containerized via Dockerfile. Has start scripts for Windows (`start.bat`) and Unix (`start.sh`).

---

## Step 2: Document Classification

**Inngest Function:** `solicitationDocumentClassifier`
**File:** `lib/inngest/functions/solicitation-classifier.ts`
**Trigger:** `solicitation.document.uploaded`

### What Happens

1. Reads the first **15,000 characters** of `extracted_text` from the database
2. Sends a single Claude call with a detailed classification prompt
3. Claude classifies the document into one of **11 types:**

| Type | Description |
|---|---|
| `base_rfp` | Master solicitation (contains instructions + evaluation criteria) |
| `soo_sow_pws` | Standalone Statement of Work / Performance Work Statement |
| `amendment` | Must explicitly say "Amendment No." or reference SF30 |
| `qa_response` | Government answers to industry questions |
| `pricing_template` | Fillable pricing/cost worksheets |
| `dd254` | DD Form 254 (security classification) |
| `clauses` | FAR/DFARS clause compilations |
| `cdrls` | Contract Data Requirements List |
| `wage_determination` | Dept of Labor wage rate schedules |
| `provisions` | Solicitation provisions |
| `other_unclassified` | Anything else |

4. Claude also extracts: `amendment_number`, `effective_date`, `solicitation_number_detected`
5. Updates `solicitation_documents` with: `document_type`, `document_type_label`, `classification_confidence` (high/medium/low), `classification_reasoning`, `processing_status = 'classified'`

### The Classification Prompt

The prompt is highly specific about distinguishing document types. For example:
- A document is only `base_rfp` if it contains submission instructions AND evaluation criteria
- A document is only `amendment` if it explicitly references "Amendment No." or SF30
- `soo_sow_pws` is only for standalone task/scope attachments, not the main RFP body

### Trigger Chain

After each document classifies, the function checks if **all** documents for the solicitation are classified. If yes:
- Fires `solicitation.classification.complete`
- Updates solicitation status to `reconciling`

---

## Step 3: Reconciliation

**Inngest Function:** `solicitationReconciler`
**File:** `lib/inngest/functions/solicitation-reconciler.ts`
**Trigger:** `solicitation.classification.complete`

### What Happens (4 Sub-Steps)

#### Step 3a: Fetch and Categorize Documents
Loads all classified documents and separates them into:
- `baseDocuments` — `base_rfp` + `soo_sow_pws`
- `amendments` — sorted chronologically by amendment_number
- `qaDocuments` — Q&A response documents
- `templateCandidates` — `pricing_template`, `cdrls`, `dd254`, `provisions`, `other_unclassified`

#### Step 3b: Reconcile Amendments
**Engine:** `lib/ingestion/reconciliation-engine.ts` → `reconcileAmendments()`

For each amendment document:
1. Sends base RFP text (first **20,000 chars**) + amendment text (first **15,000 chars**) to Claude
2. Prompt asks Claude to find ALL sections where the amendment changes, supersedes, or modifies the base document
3. Claude returns JSON array of changes:

```typescript
{
  section_reference: string,    // e.g., "Section L.5.2"
  original_text: string,        // what the base RFP said
  replacement_text: string,     // what the amendment says instead
  change_type: 'supersedes_section' | 'adds_requirement' |
               'removes_requirement' | 'general_modification'
}
```

4. Results stored in `document_reconciliations` table
5. Earlier documents marked as `is_superseded = true`, `superseded_by = <later_amendment_id>`

#### Step 3c: Parse Q&A Modifications
**Engine:** `reconciliation-engine.ts` → `parseQAModifications()`

For each Q&A document:
1. Compares Q&A text (first **15,000 chars**) vs base RFP text (first **15,000 chars**)
2. Finds answers that **substantively modify** scope, page limits, evaluation criteria, submission instructions, or add new requirements
3. Change types: `modifies_scope`, `modifies_page_limit`, `modifies_eval_criteria`, `modifies_submission_instructions`, `adds_requirement`
4. Tagged with `source_type: 'qa_response'` for provenance
5. Stored in `document_reconciliations`

#### Step 3d: Detect Template Fields
**Engine:** `lib/ingestion/template-detector.ts` → `detectTemplateFields()`

Runs on documents classified as `pricing_template`, `cdrls`, `other_unclassified`, `dd254`, `provisions`, or any filename containing "template" or "form":

1. Sends first **15,000 chars** to Claude
2. Prompt asks: "Is this a fillable template? If yes, extract each field"
3. Claude returns each field with:
   - `field_name`, `field_type`, `is_required`, `section_reference`
   - `auto_fill_source` — dot-notation path to company data (e.g., `company_profiles.cage_code`)
   - `tag` — `action_required` or `reference_only`

4. A pre-built **`AUTO_FILL_REFERENCE`** map teaches Claude how to map form fields to company data columns:
   - "Legal Entity Name" → `company_profiles.legal_name`
   - "CAGE Code" → `company_profiles.cage_code`
   - "UEI" → `company_profiles.uei_number`
   - etc.

5. Results stored in `template_field_mappings`
6. `resolveAutoFillValue()` immediately pre-fills known values from the company profile

### Finalize
Updates solicitation status to `ready` (or `failed` if all docs failed), then fires `solicitation.reconciliation.complete`.

---

## Step 4: Compliance Extraction (9 Passes)

**Inngest Function:** `solicitationComplianceExtractor`
**File:** `lib/inngest/functions/solicitation-compliance-extractor.ts`
**Core Library:** `lib/ingestion/compliance-extractor.ts`
**Trigger:** `solicitation.reconciliation.complete`

### Document Routing

A `EXTRACTION_ROUTING` map defines which document types each extraction category reads from:

| Category | Primary Sources | Always Include | Fallback |
|---|---|---|---|
| `section_l` | base_rfp | amendment, qa_response | soo_sow_pws |
| `section_m` | base_rfp | amendment, qa_response | soo_sow_pws |
| `admin_data` | base_rfp | amendment, qa_response | clauses, provisions |
| `rating_scales` | base_rfp | amendment, qa_response | — |
| `sow_pws` | soo_sow_pws, base_rfp | amendment, qa_response | — |
| `cost_price` | pricing_template, base_rfp | amendment, qa_response | — |
| `past_performance` | base_rfp | amendment, qa_response | soo_sow_pws |
| `key_personnel` | base_rfp | amendment, qa_response | soo_sow_pws |
| `security_reqs` | dd254, base_rfp, clauses | — | soo_sow_pws, provisions |

**Logic:**
- Superseded documents are always skipped (`is_superseded = true`)
- If primary sources yield no text, fallback types are tried
- If still empty, ALL available documents are concatenated
- `truncateTexts()` caps input at **100,000 characters** (~30-40 pages)

### The 9 Extraction Passes

Each is a separate Inngest step with its own Claude call. All use `temperature: 0`, `max_tokens: 4096`.

#### 1. Section L — Submission Instructions (`extractSectionL`)
**Searches for:** Volume structure, page limits, required attachments, required forms, formatting rules
**Signal keywords:** "proposal instructions", "submission requirements", "volume", "page limit", "font size", "margins"

**Output fields:**
- `volume_structure` — array of `{ name, page_limit }` defining required volumes
- `required_attachments` — list of required attachment documents
- `required_forms` — list of required government forms
- `formatting_rules` — font, margins, spacing, page size requirements

#### 2. Section M — Evaluation Criteria (`extractSectionM`)
**Searches for:** Evaluation factors with subfactors, methodology, experience thresholds, key personnel evaluation
**Signal keywords:** "evaluation factors", "best value", "tradeoff", "LPTA", "adjectival rating"

**Output fields:**
- `evaluation_factors` — array of `{ factor, subfactors[], weight }` (the scoring rubric)
- `evaluation_methodology` — LPTA / best_value / tradeoff
- `experience_thresholds` — minimum years/contracts requirements
- `key_personnel_requirements` — if personnel are evaluated

#### 3. Admin Data (`extractAdminData`)
**Searches for:** NAICS code, size standard, set-aside, contract type, period of performance, CLIN structure
**Signal keywords:** "NAICS", "set-aside", "small business", "IDIQ", "firm-fixed-price", "CLIN"

**Output fields:**
- `naics_code`, `size_standard`, `set_aside_designation`
- `contract_type` (FFP, T&M, cost-plus, etc.)
- `period_of_performance`
- `clin_structure` — array of CLIN descriptions

#### 4. Rating Scales (`extractRatingScales`)
**Searches for:** Rating definitions (Outstanding/Good/Acceptable/Unacceptable), factor weightings
**Signal keywords:** "rating", "outstanding", "acceptable", "marginally acceptable", "color rating"

**Output fields:**
- `rating_scales` — per-factor rating scale definitions
- `factor_weightings` — relative importance of factors

#### 5. SOW/PWS — Statement of Work (`extractSowPws`)
**Searches for:** Task areas, deliverables, performance standards, place of performance
**Signal keywords:** "task area", "deliverable", "CDRL", "performance standard", "PWS", "SOW"

**Output fields:**
- `document_type` — SOW / PWS / SOO
- `task_areas` — array of task descriptions
- `deliverables` — list of required deliverables
- `period_of_performance`, `place_of_performance`

#### 6. Cost/Price (`extractCostPrice`)
**Searches for:** Pricing template requirements, cost breakout categories, realism/reasonableness evaluation
**Signal keywords:** "price proposal", "cost volume", "labor rates", "cost realism", "BOE"

**Output fields:**
- `contract_type`, `pricing_template`
- `cost_breakout_categories` — what cost elements are required
- `cost_realism_or_reasonableness` — which analysis the government will perform
- `travel_instructions`, `clin_pricing`

#### 7. Past Performance (`extractPastPerformance`)
**Searches for:** Number of references, recency, relevance criteria, PPQ forms
**Signal keywords:** "past performance", "references", "recent", "relevant", "CPARS", "PPQ"

**Output fields:**
- `references_required` — how many references the RFP asks for
- `recency_requirement` — how recent contracts must be (e.g., "within 5 years")
- `relevance_criteria` — what makes a reference "relevant"
- `subcontractor_pp_evaluated` — whether sub past performance counts
- `ppq_form`, `page_limit`

#### 8. Key Personnel (`extractKeyPersonnel`)
**Searches for:** Required positions, qualifications, clearance requirements, resume format
**Signal keywords:** "key personnel", "program manager", "resume", "letter of commitment", "qualifications"

**Output fields:**
- `positions` — array of `{ title, qualifications, clearance, education_requirement, experience_years }`
- `resume_format` — page limits, required sections for resumes
- `loc_requirements` — Letter of Commitment requirements
- `counts_against_page_limit` — whether resumes count toward volume page limits

#### 9. Security Requirements (`extractSecurityRequirements`)
**Searches for:** DD254, clearance levels, CMMC, NIST 800-171, CUI handling
**Signal keywords:** "DD254", "facility clearance", "CMMC", "NIST 800-171", "CUI", "classified"

**Output fields:**
- `dd254_required`, `clearance_levels`
- `cmmc_level`, `nist_800_171_required`
- `cui_requirements`, `ssp_required`, `sprs_score`

### The Shared Prompt Pattern

Every extraction function uses this structure:

```
SYSTEM: "You are an expert government proposal compliance analyst with 15+ years
         of experience reading federal solicitations across ALL procurement vehicles
         (UCF/FAR 15, SeaPort NxG, GSA Schedule/FAR 8.4, FAR Part 12 commercial,
         FAR Part 13 simplified). You extract [category] by FUNCTION, not by label."

USER:   "IMPORTANT: Do NOT look for 'Section L' by name. Find content by FUNCTION.
         Identify by SIGNAL KEYWORDS: [list of keywords].

         Extract the following fields from the solicitation text:
         [JSON schema with { field: { found: true|false, confidence, value } }]

         RULES:
         - found=true ONLY if explicitly stated in the text
         - Do NOT infer or fabricate values
         - confidence=high only if exact wording found
         - Return valid JSON only"
```

### Error Isolation

Each of the 9 steps independently catches errors. A failed Section L extraction does **not** block Section M. Failed steps return `{ failed: true }` rather than throwing.

### User Override Preservation

Before writing each extraction result, the function checks `is_user_override` on the existing row. If `true`, the AI result is silently dropped — the user's manual edit is never overwritten.

### Storage

Results are upserted to `compliance_extractions` matching on `(solicitation_id, field_name)`. The `original_ai_value` column stores the pre-override value so users can revert.

---

## Step 5: Data Call Form Generation

**File:** `lib/ingestion/data-call-generator.ts`
**Function:** `generateDataCallSchema()`
**Triggered:** On first `GET /api/solicitations/[id]/data-call`

### How It Works

Reads all completed `compliance_extractions` and generates a **dynamic 5-section form**:

#### Section 1: Opportunity Details
- Pre-fills NAICS code, set-aside, contract type from `admin_data` extraction
- Static fields: prime/sub, teaming partners, contract type

#### Section 2: Past Performance References
- `dynamic_count` driven by `past_performance.references_required` extraction (default: 3)
- Each reference card: project name, client agency, contract number, contract value, period, relevance summary, POC info
- `rfp_citation`: "Per Past Performance References Required: {value}"

#### Section 3: Key Personnel
- One card per position from `key_personnel.positions` extraction
- Role pre-filled from extraction
- File upload slots: resume (always), certifications (if relevant), LOC (if `loc_requirements` was extracted)

#### Section 4: Technical Approach
- Static narrative fields: approach summary, tools & platforms, staffing model, assumptions, risks
- Description enhanced with extracted SOW task area names

#### Section 5: Compliance Verification
- Boolean toggles and file slots driven by `security_reqs` and `section_l` extractions
- CMMC level, facility clearance, NIST 800-171 score
- All required attachments from `section_l.required_attachments`

Every field has an `rfp_citation` string sourced from the extraction's `field_label`, so users see exactly which RFP section requires each input.

### How This Flows Into Content Generation

The form schema is cached in `data_call_responses.form_schema`. When the user fills out the form and saves (status becomes `completed`), the `data_call_responses` row contains all the Tier 2 data needed for generation:

```
data_call_responses.opportunity_details  → injected into all volume prompts
data_call_responses.past_performance     → injected into Past Performance volume prompt
data_call_responses.key_personnel        → injected into Management volume prompt
data_call_responses.technical_approach   → injected into Technical volume prompt
data_call_responses.compliance_verification → used for compliance matrix
```

---

## Step 6: How Extraction Feeds Into Content Generation

When the user triggers draft generation (`POST /api/solicitations/[id]/draft`), the `proposalDraftGenerator` Inngest function assembles prompts from **three data sources:**

### Source 1: Tier 1 — Company Profile
From `company_profiles` and related tables. Static company knowledge.

### Source 2: Tier 2 — Data Call Response
From `data_call_responses`. Opportunity-specific data filled by the user. **The form fields were shaped by extraction results.**

### Source 3: Phase 7 — Compliance Extractions
From `compliance_extractions`. The raw AI-extracted RFP structure. Used to:
- Determine volume structure and page limits (`section_l.volume_structure`)
- Inject evaluation criteria language into prompts (`section_m.evaluation_factors`)
- Provide SOW task areas for technical volume (`sow_pws.task_areas`)
- Set page targeting per volume (`page_limit * 250 * 0.875` words)
- Build compliance matrix mapping factors to volumes

### The Prompt Assembly

`lib/generation/draft/prompt-assembler.ts` → `assembleVolumePrompt()`:

```
For each volume:
  1. detectVolumeType(volumeName) → 'technical' | 'management' | 'past_performance' | 'cost_price' | 'default'
  2. Build SYSTEM prompt (shared): expert proposal writer persona, compliance rules, placeholder rules
  3. Build USER prompt (volume-specific):
     - Inject relevant Tier 1 fields
     - Inject relevant Tier 2 fields
     - Inject relevant compliance extractions
     - Set target word count from page limit
     - Add sparse data instructions if any data is missing
  4. Claude call: model=claude-sonnet-4-5-20250929, max_tokens=8192, temperature=0.3
  5. Response → markdown → parse into sections → generate DOCX
```

---

## Legacy Pipeline (v1) Summary

### Stage 0 — Document Classifier
**File:** `lib/inngest/functions/stage0-classifier.ts`
**Trigger:** `document.uploaded`

Classifies single uploaded document into `rfp`, `proposal`, `contract`, or `other` using Claude + keyword checks. If RFP-like, fires `document.classified`.

### Stage 1 — RFP Intelligence Analyzer
**File:** `lib/inngest/functions/stage1-rfp-intelligence.ts`
**Trigger:** `document.classified`

Runs **10 AI calls** per document:
1. Eight section analyses (Executive Summary, Project Scope, Technical Requirements, Timeline, Budget/Pricing, Evaluation Criteria, Submission Requirements, Key Stakeholders) → stored in `section_results`
2. Requirements extraction — finds all "shall/must/should" statements, deliverables, PWS task areas → stored in `rfp_requirements`. Includes JSON repair strategy for truncated output. Targets 30+ requirements numbered as `REQ 001`, `REQ 002`, etc.
3. Volume structure detection → stored in `documents.metadata`
4. Solicitation number extraction → stored in `documents.solicitation_number`

### Stage 2 — Response Generator
**File:** `lib/inngest/functions/stage2-response-generator.ts`
**Trigger:** `response.generate` (manual)

Fetches requirements + all company data, generates 4 volumes (Technical, Management, Past Performance, Price), produces DOCX + Excel compliance matrix.

---

## Key Architectural Decisions

1. **Function-based, not label-based extraction:** The AI searches for content by purpose and signal keywords, never by fixed headers like "Section L". This handles FAR 15, SeaPort NxG, GSA Schedule, FAR 12/13, Army TORs, and every other federal procurement format.

2. **Error isolation at every level:** Each Inngest step catches its own errors. A failed Section L does not block Section M. A failed volume does not kill other volumes.

3. **User override preservation:** Re-running extraction never overwrites manual edits. `is_user_override = true` rows are always skipped.

4. **Document routing:** Each extraction category has its own priority list of source document types. Superseded documents are always excluded. Amendments and Q&A responses are always appended.

5. **Text truncation:** Extraction inputs are capped at 100,000 characters. Classification uses 15,000. Reconciliation uses 20,000 (base) + 15,000 (amendment).

6. **Synchronous text extraction, asynchronous AI processing:** Text is pulled from PDFs/DOCX during the upload API call. All AI work runs as background Inngest jobs.
