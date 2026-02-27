# Content Generation — How RFP Responses Are Built

## Overview

Content generation is the final stage of the pipeline. It takes three data sources — company knowledge (Tier 1), opportunity-specific data (Tier 2), and AI-extracted RFP structure (Phase 7 compliance extractions) — and produces complete, multi-volume DOCX proposal responses using Claude Sonnet 4.5.

There are two generation pipelines: the **modern draft pipeline** (Phase 9, production path) and the **legacy Stage 2 pipeline** (v1, still functional). This document covers both in detail.

---

## The AI Model

**Model:** `claude-sonnet-4-5-20250929`
**Client:** Anthropic TypeScript SDK
**File:** `lib/anthropic/client.ts`

```typescript
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
export const MODEL = 'claude-sonnet-4-5-20250929';
```

No other AI provider is used. All extraction AND generation runs through Claude.

---

## Modern Draft Pipeline (Phase 9)

### Trigger

`POST /api/solicitations/[id]/draft` (`app/api/solicitations/[id]/draft/route.ts`)

**Pre-conditions:**
- Data call response status must be `completed`
- Reads `compliance_extractions` for `section_l.volume_structure` to determine volumes and page limits
- Falls back to default volumes if Section L had no volume structure: `[Technical Approach, Management, Past Performance, Cost/Price]`

**Creates:**
- `proposal_drafts` record (status = `pending`)
- `draft_volumes` rows (one per volume, status = `pending`)
- Fires Inngest event: `proposal.draft.generate`

### The Draft Generator Inngest Function

**File:** `lib/inngest/functions/proposal-draft-generator.ts`

#### Step 1: Fetch All Data

Loads three data sources from Supabase:

**Tier 1 — Company Profile:**
- `company_name`, `legal_name`, `corporate_overview`, `core_services_summary`
- `enterprise_win_themes[]`, `key_differentiators_summary`
- `standard_management_approach`, `elevator_pitch`
- `logo_url`, `proposal_poc`, `authorized_signer`

**Tier 2 — Data Call Response:**
- `opportunity_details` — contract_type, set_aside, prime_or_sub, teaming_partners[]
- `past_performance[]` — project_name, client_agency, contract_number, contract_value, period, relevance_summary, POC
- `key_personnel[]` — role, name, qualifications_summary
- `technical_approach` — approach_summary, tools_and_platforms, staffing_model, assumptions, risks

**Phase 7 — Compliance Extractions:**
- All 9 categories grouped by category name
- Key fields: `section_l.volume_structure`, `section_m.evaluation_factors`, `sow_pws.task_areas`, `admin_data.clin_structure`, `past_performance.references_required`, `key_personnel.positions`

#### Step 2: Per-Volume Generation

For each volume (one Inngest step each):

1. **`detectVolumeType(volumeName)`** — keyword matching on volume name to determine type:
   - Contains "technical" or "approach" → `technical`
   - Contains "management" or "staffing" or "personnel" → `management`
   - Contains "past performance" or "experience" → `past_performance`
   - Contains "cost" or "price" or "pricing" → `cost_price`
   - Anything else → `default`

2. **`assembleVolumePrompt()`** — builds system + user prompt (see Prompt Assembly below)

3. **Claude API call:** `max_tokens = 8192`, `temperature = 0.3`

4. **Parse response:** `markdownToContentStructure()` splits markdown on H1/H2 headings into `{ sections: [{title, content}] }`

5. **Generate DOCX:** `generateProposalVolume()` → `saveDocxToBuffer()`

6. **Upload:** Supabase Storage at `drafts/{companyId}/{solicitationId}/{order}_{name}.docx`

7. **Update DB:** `draft_volumes` with status, word_count, page_estimate, page_limit_status, content_markdown

#### Step 3: Compliance Matrix

- Reads `section_m.evaluation_factors` from compliance extractions
- Maps each factor to its most relevant generated volume by keyword matching
- Generates a markdown compliance matrix table
- Stored as `draft_volumes` row at `volume_order = 999`

#### Step 4: Finalize

Updates `proposal_drafts.status = 'completed'`, sets `generation_completed_at`.

---

## Prompt Assembly — The Core of Generation

**File:** `lib/generation/draft/prompt-assembler.ts`

### The System Prompt (Shared Across All Volumes)

```
You are an expert government proposal writer with 20+ years of experience
winning federal contracts. You write in a formal, compliance-focused style
using action verbs and "shall/will" phrasing. Every claim is backed by
specific evidence. You mirror the evaluation criteria language from the RFP.
You are writing for {company_name} ({legal_name}).

Your proposals are indistinguishable from those written by top-tier government
proposal shops. You understand the Federal Acquisition Regulation (FAR),
color team reviews, and the SHIPLEY proposal development methodology.
Your writing is persuasive, compliance-focused, and evaluator-friendly —
structured so that a government Source Selection Board can easily score
your proposal against the evaluation criteria.

Key rules:
1. Never fabricate specific facts — use [PLACEHOLDER: description] for missing data
2. Mirror Section M evaluation factor language throughout the volume
3. Use active voice and action verbs at the start of sentences
4. Quantify claims whenever possible (percentages, years, dollar values, counts)
5. Structure content so evaluators can quickly find evidence for each criterion
```

### Volume-Specific User Prompts

#### Technical Volume (`buildTechnicalPrompt`)

**Data injected:**
- Company `core_services_summary`
- Data call `technical_approach` (approach_summary, tools_and_platforms, staffing_model, assumptions, risks)
- SOW/PWS task areas from `sow_pws` extraction
- Section M technical evaluation factors
- Page limit and target word count

**Instructions include:**
- Mirror the exact language from Section M evaluation factors
- Follow structure: Executive Summary → Technical Approach → Staffing Plan → Risk Management → Quality Management
- Include requirements traceability (map each requirement to your approach)
- Cover every SOW task area explicitly
- Insert win theme callout boxes

#### Management Volume (`buildManagementPrompt`)

**Data injected:**
- Company `standard_management_approach`, `corporate_overview`
- Key personnel from data call (role, name, qualifications_summary)
- Teaming arrangements from opportunity details
- Management-related evaluation factors

**Instructions include:**
- Structure: Executive Summary → Organizational Structure → Key Personnel Bios → Staffing Plan → Transition Plan → Quality Control Plan → Risk Management Plan
- Dedicate a subsection to each named key person
- Describe the org structure and reporting chain
- Include transition timeline if contract has a transition period

#### Past Performance Volume (`buildPastPerformancePrompt`)

**Data injected:**
- Past performance references from data call (project_name, client_agency, contract_number, contract_value, period_of_performance, relevance_summary, POC)
- Recency/relevance criteria from `past_performance` extraction
- References required count

**Instructions include:**
- One section per reference
- For each: Contract Overview → Relevance to This Effort → Scope/Magnitude/Complexity Comparison → Outcomes and Achievements → Client Reference
- Explicitly address how each reference meets the recency and relevance criteria

#### Cost/Price Volume (`buildCostPricePrompt`)

**Data injected:**
- CLIN structure from `admin_data` extraction
- Contract type
- Period of performance

**Instructions include:**
- Write Price Narrative and Basis of Estimate (BOE) ONLY
- ALL dollar amounts must use `[PLACEHOLDER: $X]`
- ALL labor hours must use `[PLACEHOLDER: X hours]`
- Do NOT fabricate any pricing data
- Structure: Price Narrative → BOE → Labor Category Descriptions → Other Direct Costs

#### Default/Fallback Volume (`buildDefaultPrompt`)

Used for any unrecognized volume name. Injects all available company and bid context. Treats the volume name as the subject matter.

### Page Targeting

```typescript
targetWordCount = pageLimit × 250 × 0.875
```

- 250 words per page (single-spaced)
- 87.5% utilization (leaves room for headings, white space, exhibits)
- Injected into every prompt as: "TARGET LENGTH: approximately {N} words"

### Sparse Data Handling

`buildSparseDataInstruction()` — if any data section is missing or empty, injects:

```
IMPORTANT: Some data sections are incomplete. For ANY missing information:
- Use [PLACEHOLDER: describe what specific data is needed] format
- Do NOT fabricate, infer, or assume any specific values
- Mark clearly so the proposal team knows what to fill in
```

### Win Theme Instructions

`buildWinThemeInstructions(winThemes)` — if `enterprise_win_themes` array has entries:

```
STRATEGIC WIN THEMES — Weave these themes throughout the volume:
{theme1}
{theme2}
...

Insert 2-3 callout boxes formatted as:
=== WIN THEME: {theme} ===
{1-2 sentences connecting the theme to the current section's content}
=== END WIN THEME ===
```

---

## What Determines Language, Tone, and Style

### 1. The System Prompt Persona
The system prompt establishes:
- **Formal, compliance-focused style**
- **"Shall/will" phrasing** — mirrors government contract language
- **SHIPLEY methodology** — evaluator-friendly structure, color team review format
- **Active voice** with action verbs at sentence starts
- **Quantified claims** — percentages, years, dollar values, counts
- **FAR compliance** awareness

### 2. Compliance Language Patterns (`lib/generation/content/compliance-language.ts`)

`getComplianceInstructions(companyName)` generates a multi-rule instruction block injected into v1 pipeline prompts:

| Requirement Type | Generated Pattern |
|---|---|
| "shall" statements | "{Company} will {verb from requirement}" |
| "must" statements | "{Company} will ensure {requirement}" |
| Explicit compliance | "fully complies with [REQ X] by..." |
| Exceeding requirements | "Beyond the [REQ X] requirement, {Company} additionally provides..." |
| Opening pattern | Restate the requirement first, then describe compliance |

### 3. Evaluation Criteria Mirroring
The prompt explicitly instructs Claude to **mirror the exact language from Section M evaluation factors**. If the RFP says "demonstrates understanding of complex IT modernization," the proposal should use those exact words.

### 4. Ghosting Language (`lib/generation/content/win-themes.ts`)

`getGhostingContext(advantages)` reads from the `competitive_advantages` table and generates differentiator phrases:
- "Unlike typical approaches..."
- "Where contractors often face..."
- "Traditional methods may..."

These are inserted without naming competitors — a standard government proposal strategy.

### 5. Win Theme Callout Boxes
Rotated throughout the volume using the company's `enterprise_win_themes[]` from Tier 1. Format varies by pipeline:
- Draft pipeline: `=== WIN THEME: {theme} ===` markers in markdown
- Legacy pipeline: Styled table-based callout boxes in DOCX (blue border, light blue fill)

### 6. Placeholder Convention
`[PLACEHOLDER: describe what is needed]` used consistently when data is missing. The Cost/Price volume uses this for ALL dollar amounts and labor hours to prevent fabricated pricing.

---

## DOCX Styling and Formatting

### The Styling System

**File:** `lib/generation/docx/styles.ts`

All DOCX output uses the `docx` npm library with a comprehensive professional style set:

#### Headings (Hierarchical, Numbered)
| Style | Font | Size | Color | Spacing |
|---|---|---|---|---|
| Heading 1 | Arial Bold | 16pt | Blue `#2563eb` | 0.33in top / 0.083in bottom |
| Heading 2 | Arial Bold | 14pt | Dark Blue `#1e40af` | — |
| Heading 3 | Arial Bold | 12pt | Dark Gray `#1e293b` | — |
| Heading 4 | Arial Bold | 11pt | Gray `#334155` | — |

#### Body Text
- **Font:** Arial throughout (all text runs)
- **Size:** 10pt, 11pt, or 12pt variants (BodyText10pt, BodyText11pt, BodyText12pt)
- **Alignment:** Justified
- **Line spacing:** Single (line value 276)

#### Requirement Boxes (RFPBox)
- Blue border on all sides (`#2563eb`)
- Light blue shading (`#EFF6FF`)
- 10pt Arial
- Used to quote specific RFP requirements before addressing them

#### Callout Boxes
- Left blue border only (thicker, size 12)
- Light blue shading (`#F0F9FF`)
- 10pt Arial, 0.167in left indent
- Used for key takeaways and highlight text

#### Win Theme Callouts (`lib/generation/content/win-themes.ts`)
- Full-border table
- Blue border (`#2563eb`)
- Light blue fill (`#eff6ff`)
- 0.139in cell margins

#### Bullet Styles
- Three indent levels: Bullet1 (0.25in), Bullet2 (0.5in), Bullet3 (0.75in)

#### Table Styles
- `TableHeading10pt/11pt` — White text on blue (`#2563eb`) background
- `TableText10pt/11pt` — Standard left-aligned

#### Character Styles
- `BoldIntro` — Bold, used for the first sentence of Understanding paragraphs
- `IntenseReference` — Italic, blue (`#2563eb`)
- `ExhibitReference` — Bold italic, blue (`#2563eb`)

### Color Scheme
Primary: `#2563eb` (Tailwind blue-600)
Secondary: `#1e40af` (Tailwind blue-800)
These are used consistently for headings, borders, table headers, and accent elements.

### Page Setup
- **Margins:** 1 inch on all sides
- **Header/footer distance:** 0.5 inches
- **Paper size:** Letter (8.5" × 11")

### Heading Numbering (`lib/generation/docx/numbering.ts`)

Three numbering configurations:
- **`HEADING_NUMBERING`** — Hierarchical outline: `1.` / `1.1.` / `1.1.1.`
  - Applied automatically via `getHeadingNumbering(level)`
  - Certain sections skip numbering: Cover Letter, Appendices, TOC-related
  - Determined by `shouldOmitNumbering()` checking section title

- **`NUMBERED_LIST_NUMBERING`** — Decimal list (1, 2, 3...)
- **`TABLE_BULLET_NUMBERING`** — Bullet list

### Document Structure (Full DOCX)

1. **Cover Page** (no header/footer):
   - Company logo centered
   - "PROPOSAL RESPONSE" in blue 24pt
   - Volume identifier in 18pt
   - Company name in 16pt
   - POC email
   - Date

2. **Cover Letter Page**

3. **Table of Contents** (dynamic Word field codes):
   - 3 heading levels
   - Table of Exhibits

4. **Content Sections** (numbered headings with styled content)

5. **Appendices:**
   - Key Personnel Resumes
   - Certifications
   - Past Performance Detail
   - Compliance Matrix (Word table)

### Headers and Footers (`lib/generation/docx/headers-footers.ts`)

Applied to all pages except the cover:
- **Header:** Company logo (small, left) | Volume title (center) | Solicitation number (right)
- **Footer:** "PROPRIETARY AND CONFIDENTIAL" (left) | Auto page number (right)

---

## Exhibits and Visual Elements

**Directory:** `lib/generation/exhibits/`

### Org Charts (`org-chart.ts`)
- Generated as PNG images
- Uses Mermaid syntax for org chart definitions
- Rendered via Mermaid CLI or canvas fallback
- Shows organizational hierarchy with key personnel in their roles

### Process Diagrams (`process-diagram.ts`)
- Generated as PNG images
- Mermaid flowchart syntax
- Shows workflow/process steps for technical approach

### Timelines (`timeline.ts`)
- Gantt chart generation
- Shows transition timeline, PoP milestones

### Exhibit Manager (`exhibit-manager.ts`)
- Tracks sequential exhibit numbering (Exhibit 1, Exhibit 2, ...)
- Validates cross-references between text and exhibits
- Ensures exhibit references in text point to correct exhibit numbers

### Branding (`branding.ts`)
- Logo integration into exhibits
- Color consistency with company branding

### Rendering (`render.ts`)
- Mermaid CLI rendering to PNG image buffers
- Puppeteer config for headless rendering (`puppeteer.config.json`)

---

## Legacy Pipeline (v1) Generation Details

**File:** `lib/inngest/functions/stage2-response-generator.ts`
**Trigger:** `response.generate`

### Data Loaded
- Document + all `rfp_requirements` from Stage 1
- Company data: past_performances, personnel, value_propositions, service_areas, tools_technologies, innovations, certifications, naics_codes, contract_vehicles, competitive_advantages, boilerplate_library

### Volume Generation

Each volume has a dedicated generator in `lib/generation/volumes/`:

#### Technical Volume (`lib/generation/volumes/technical.ts`)
Calls template functions that each make their own Claude calls:

1. `generateExecutiveSummaryContent()` — Returns JSON: `{opening, understanding, solution, whyUs, discriminators}`
2. Per task area (from requirements):
   - `generateTaskAreaApproach()` — Returns JSON: `{understanding, methodology, benefit}`
   - `generateDeliverablesList()` — Returns JSON array: `[{name, description, format}]`
   - `generateWorkflowSteps()` — Returns JSON array of step strings (for process diagrams)
3. Each task area section includes:
   - Requirement box (quoting the RFP requirement)
   - Understanding paragraph (first sentence bold)
   - Methodology bullets
   - Benefit callout box
   - Exhibit reference (to process diagram)
   - Proof points from value propositions
   - Deliverables subsection

#### Management Volume (`lib/generation/volumes/management.ts`)
1. `generateManagementPhilosophy()` — Plain text paragraphs
2. Org chart exhibit
3. Key personnel table (name, title, years, clearance)
4. `generateStaffingApproach()` — Plain text
5. `generateCommunicationPlan()` — Plain text, weekly/monthly meeting cadence
6. `generateQCApproach()` — Plain text quality control paragraphs

#### Past Performance Volume (`lib/generation/volumes/past-performance.ts`)
For each contract (top 5):
- Contract details table (agency, number, value, period, role, team size)
- Overview paragraph
- Description of effort
- Task areas (bulleted)
- Achievements (bulleted)
- CPARS rating table
- Client POC

#### Price Volume (`lib/generation/volumes/price.ts`)
- Static structure: Price methodology, assumptions, labor categories
- Table with labor categories from contract vehicles
- All pricing uses `[PLACEHOLDER]` — no fabricated numbers

#### Compliance Matrix (`lib/generation/volumes/compliance-matrix.ts`)
- Word table: Requirement Number | Requirement Text | Section Reference | Category | Priority | Volume Section | Page
- Separate Excel file via `lib/generation/compliance/matrix-generator.ts` using ExcelJS

### Post-Processing Pipeline (`lib/generation/pipeline/`)

After all volumes are generated:

1. **`outline-generator.ts`** — Generates hierarchical outline from requirements
2. **`page-tracker.ts`** — Tracks page count per volume against limits
3. **`docx-page-counter.ts`** — Estimates pages from word count (250 words/page)
4. **`content-condenser.ts`** — If a volume exceeds page limits, uses Claude to condense:
   - Standard condense: remove redundant examples, tighten language
   - Aggressive condense: force bullet points, remove all examples, combine sentences
   - **Never removes compliance statements** — those are preserved verbatim
5. **`pdf-converter.ts`** — LibreOffice DOCX→PDF conversion (currently disabled on Windows)
6. **`package-builder.ts`** — ZIP assembly of all volumes + compliance matrix
7. **`checklist-generator.ts`** — Submission checklist generation

### Compliance Language in v1 Prompts

`getComplianceInstructions(companyName)` is prepended to several template prompts (technical approach, management philosophy, staffing, communication plan, QC). It establishes exact verb-echoing requirements for every "shall" and "must" statement.

`getGhostingContext(advantages)` is also prepended, providing competitive advantage phrases to weave into the narrative without naming competitors.

---

## Content Quality and Cross-Referencing

### Heading Enhancer (`lib/generation/content/heading-enhancer.ts`)
Post-processes section headings to append requirement number references:
- "Technical Approach" → "Technical Approach [REQ 001, REQ 002]"
- Based on section mappings from `section-mapper.ts`

### Cross-References (`lib/generation/content/cross-references.ts`)
- `formatRequirementReference()` — extracts RFQ section numbers from requirement data
- Formats as "RFQ L.4.2; PWS REQ 3.1:" prefixes in requirement boxes
- `extractRfqSection()` — parses section numbers from free text

### Boilerplate Integration (`lib/generation/content/boilerplate.ts`)
- Pulls pre-written text blocks from `boilerplate_library` table
- Matched by `type` (company_intro, quality_approach, risk_management, security_procedures, etc.)
- `variant` selects brief/standard/detailed version based on available page space

### Section Mapper (`lib/generation/planning/section-mapper.ts`)
- Maps extracted requirements to volume sections using keyword matching
- Input: requirements array + volume structure
- Output: `SectionMapping[]` used by heading enhancer and compliance matrix

### Validation (`lib/generation/quality/validation.ts`)
- Content quality validation after generation
- Checks for completeness, placeholder density, minimum content thresholds

---

## Export and Download

### Draft Pipeline Downloads

**Route:** `GET /api/solicitations/[id]/draft/volumes/[volumeId]`
- Downloads DOCX from Supabase Storage via signed URL
- Individual volume download

### Legacy Pipeline Downloads

**Route A:** `GET /api/proposals/[id]/download`
- Reads `proposal_volumes` from DB
- Creates ZIP using `archiver` (zlib level 9)
- Contents: `{volume_type}-volume.docx` files + `compliance-matrix.xlsx`
- Returns `application/zip` as `proposal-{documentId}.zip`

**Route B:** `GET /api/download/[proposalId]`
- Structured folder layout: `Proposal_{solicitationNumber}/`
- DOCX at root: `Volume_I_Technical.docx`, `Volume_II_Management.docx`, `Volume_III_PastPerformance.docx`, `Volume_IV_Price.docx`
- PDFs in `Final_Submission/` subfolder (currently empty — PDF conversion disabled)
- `Appendix_B_Compliance_Matrix.xlsx`
- Returns `Proposal_{solicitationNumber}.zip`

### HTML Preview (Legacy)

**File:** `lib/templates/rfp-response-template.ts`
- HTML export with CSS print styles
- Cover page, TOC, section dividers
- Font: Arial, Primary color: `#2563eb`
- Currently deprecated (volumes have no text content for HTML rendering in v2)

---

## Summary: What Goes Into a Generated Response

```
                    ┌─────────────────────────────┐
                    │     SYSTEM PROMPT            │
                    │  Expert proposal writer      │
                    │  SHIPLEY methodology         │
                    │  Compliance-first language    │
                    │  Placeholder convention       │
                    └──────────────┬──────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
    ┌────┴─────┐            ┌──────┴──────┐           ┌──────┴──────┐
    │  TIER 1  │            │   TIER 2    │           │  PHASE 7    │
    │ Company  │            │  Data Call  │           │ Extractions │
    │ Profile  │            │  Response   │           │             │
    ├──────────┤            ├─────────────┤           ├─────────────┤
    │ Name     │            │ PP refs     │           │ Section L   │
    │ Overview │            │ Key persons │           │ Section M   │
    │ Services │            │ Tech appch  │           │ SOW/PWS     │
    │ Win thms │            │ Oppty dtls  │           │ Admin data  │
    │ Mgmt apch│            │ Compliance  │           │ Rating scls │
    │ Elevator │            │ verification│           │ Cost/price  │
    │ Differnt │            │             │           │ PP criteria │
    └────┬─────┘            └──────┬──────┘           │ Key pers    │
         │                         │                  │ Security    │
         │                         │                  └──────┬──────┘
         └─────────────────────────┼─────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │     VOLUME-SPECIFIC PROMPT   │
                    │  + Target word count          │
                    │  + Evaluation factors          │
                    │  + Win theme instructions      │
                    │  + Sparse data handling        │
                    └──────────────┬──────────────┘
                                   │
                           Claude Sonnet 4.5
                        (temp=0.3, 8192 tokens)
                                   │
                    ┌──────────────┴──────────────┐
                    │     MARKDOWN RESPONSE        │
                    │  Parsed into sections        │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │     DOCX GENERATION          │
                    │  Professional styling         │
                    │  Cover page + TOC             │
                    │  Headers/footers              │
                    │  Numbered headings            │
                    │  Requirement boxes             │
                    │  Win theme callouts            │
                    │  Tables + exhibits             │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │     SUPABASE STORAGE         │
                    │  .docx file + markdown        │
                    │  preview in DB                │
                    └─────────────────────────────┘
```
