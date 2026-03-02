# Content Generation — How RFP Responses Are Built

## Overview

Content generation is the final stage of the pipeline. It takes three data sources — company knowledge (Tier 1), opportunity-specific data (Tier 2), and AI-extracted RFP structure (Phase 7 compliance extractions) — and produces complete, multi-volume DOCX proposal responses using Claude Sonnet 4.6. An optional Touchup phase (Phase 10) scores the first draft against compliance requirements and rewrites it to fill gaps.

---

## The AI Model

**Model:** `claude-sonnet-4-6`
**Client:** Anthropic TypeScript SDK
**File:** `lib/anthropic/client.ts`

```typescript
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
export const MODEL = 'claude-sonnet-4-6';
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

**Accepts:**
- `graphicsProfile` in request body: `'minimal'` (default, text only) or `'standard'` (embeds org charts, timelines, process flows)

**Creates:**
- `proposal_drafts` record (status = `pending`)
- `draft_volumes` rows (one per volume, status = `pending`)
- Fires Inngest event: `proposal.draft.generate` with `graphicsProfile`

### The Draft Generator Inngest Function

**File:** `lib/inngest/functions/proposal-draft-generator.ts`

#### Step 1: Fetch All Data

Loads three data sources plus Tier 1 collections from Supabase:

**Tier 1 — Company Profile:**
- `company_name`, `legal_name`, `corporate_overview`, `core_services_summary`
- `enterprise_win_themes[]`, `key_differentiators_summary`
- `standard_management_approach`, `elevator_pitch`
- `logo_url`, `primary_color`, `secondary_color`, `proposal_poc`, `authorized_signer`

**Tier 1 — Collections (piped directly into prompts):**
- `personnel[]` — full records with education, work history, clearances, certifications
- `past_performances[]` — contract history with CPARS ratings, achievements, task areas
- `certifications[]` — certification type, agency, expiration
- `contract_vehicles[]` — vehicle name, type, contract number, ceiling value, labor categories
- `naics_codes[]` — NAICS code, title, is_primary

**Tier 2 — Data Call Response:**
- `opportunity_details` — contract_type, set_aside, prime_or_sub, teaming_partners[]
- `past_performance[]` — project_name, client_agency, contract_number, contract_value, period, relevance_summary, POC
- `key_personnel[]` — role, name, qualifications_summary
- `technical_approach` — approach_summary, tools_and_platforms, staffing_model, assumptions, risks

**Phase 7 — Compliance Extractions:**
- All 9 categories grouped by category name
- Key fields: `section_l.volume_structure`, `section_m.evaluation_factors`, `sow_pws.task_areas`, `admin_data.clin_structure`, `past_performance.references_required`, `key_personnel.positions`

**Color Palette:**
- Built once from `company_profiles.primary_color` / `secondary_color` via `buildColorPalette()`
- Derives: `primary`, `primaryDark`, `primaryLight`, `primaryNodeFill`, `tableHeaderBg`, `tableHeaderText`
- Falls back to default blue (`#2563eb`) when no colors are set

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

5. **Diagram embedding (if `graphicsProfile === 'standard'`):**
   - Management volumes: org chart + transition timeline (generated in parallel)
   - Technical volumes: quality control process flow
   - Diagrams rendered as PNG via Mermaid, embedded as `ImageRun` in DOCX
   - Inserted into matching content sections by keyword (e.g., "organizational" → org chart)

6. **Generate DOCX:** `generateProposalVolume()` → `saveDocxToBuffer()` with company color palette

7. **Upload:** Supabase Storage at `drafts/{companyId}/{solicitationId}/{order}_{name}.docx`

8. **Update DB:** `draft_volumes` with status, word_count, page_estimate, page_limit_status, content_markdown

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
6. NEVER exceed page limits — government evaluators strictly enforce page limits
```

### Volume-Specific User Prompts

#### Technical Volume (`buildTechnicalPrompt`)

**Data injected:**
- Company `core_services_summary`
- Data call `technical_approach` (approach_summary, tools_and_platforms, staffing_model, assumptions, risks)
- SOW/PWS task areas from `sow_pws` extraction
- Section M technical evaluation factors
- Page limit and target word count
- **Tier 1 enrichment:** Company certifications (type, agency, expiration), contract vehicles (name, type, contract #, ceiling), key personnel qualifications (education, certs, clearance, experience years)

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
- **Tier 1 enrichment:** Cross-references Tier 2 key_personnel with Tier 1 personnel records by name match. For each match appends: education (degree, field, institution), certifications, clearance level + status, total/federal experience years, recent work history (top 2 entries)
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
- **Tier 1 enrichment:** Cross-references Tier 2 refs with Tier 1 past_performances by contract number or project name. For each match appends: CPARS ratings (overall, quality, schedule), description of effort (truncated 500 chars), task areas, tools used, top 3 achievements with metrics, team size, role (Prime/Sub)
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
- **Tier 1 enrichment:** Active contract vehicles (name, type, ceiling, labor categories), relevant certifications

**Instructions include:**
- Write Price Narrative and Basis of Estimate (BOE) ONLY
- ALL dollar amounts must use `[PLACEHOLDER: $X]`
- ALL labor hours must use `[PLACEHOLDER: X hours]`
- Do NOT fabricate any pricing data
- Structure: Price Narrative → BOE → Labor Category Descriptions → Other Direct Costs

#### Default/Fallback Volume (`buildDefaultPrompt`)

Used for any unrecognized volume name. Injects all available company and bid context. Treats the volume name as the subject matter.
- **Tier 1 enrichment:** NAICS codes list, capability summary (counts of certs, vehicles, personnel, past perf)

### Page Limit Enforcement

`buildPageLimitInstruction(targetWordCount, pageLimit, spacing)` generates enforcement text:

**When page limit exists (hard enforcement):**
```
HARD PAGE LIMIT: This volume has a STRICT X-page limit. Government page limits are absolute —
proposals exceeding the limit may be rejected without evaluation.
- MAXIMUM: Y words (X pages)
- TARGET: Z words (87.5% utilization)
- Do NOT exceed Y words. Prioritize highest-weighted evaluation factors if space is tight.
```

**When no page limit:** Softer "Approximately X words" text.

**Formula:** `targetWordCount = pageLimit × 250 × 0.875` (250 words/page single-spaced, 87.5% utilization for headings/whitespace)

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

All DOCX output uses the `docx` npm library with a comprehensive professional style set. Styles are generated via `buildProposalStyles(palette)` which accepts a `ProposalColorPalette` — all color references are parameterized, not hardcoded.

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

### Color Palette System

**File:** `lib/generation/docx/colors.ts`

Colors are derived from the company's `primary_color` and `secondary_color` fields (set via color pickers in the Company Profile → Corporate Identity tab).

| Palette Field | Derivation | Default |
|---|---|---|
| `primary` | Company primary color | `#2563eb` |
| `primaryDark` | 20% darker | `#1e40af` |
| `primaryLight` | 90% toward white | `#F0F9FF` |
| `primaryNodeFill` | 80% toward white | `#dbeafe` |
| `tableHeaderBg` | Same as primary | `#2563eb` |
| `tableHeaderText` | Always white | `#FFFFFF` |

When no company colors are set, falls back to the default blue palette. The palette is threaded through `buildProposalStyles()`, `parseMarkdownToDocx()`, `generateProposalVolume()`, and the cover page generator.

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

### Graphics Profile

Selected by the user on the Strategy Confirmation screen before generation:
- **Minimal** (default) — text only, no embedded diagrams
- **Standard** — generates and embeds diagrams into DOCX content sections

### Diagram Embedder (`lib/generation/docx/diagram-embedder.ts`)

When `graphicsProfile === 'standard'`, generates volume-appropriate diagrams:

| Volume Type | Diagrams Generated |
|---|---|
| Management | Org chart (from Tier 1 personnel) + Transition timeline |
| Technical | Quality control process flow |
| Other | None |

Each diagram is rendered to PNG, read into an `ImageRun`, wrapped in a centered `Paragraph` with italic caption, and inserted into the matching content section by keyword (e.g., "organizational" → org chart, "transition" → timeline, "quality" → process flow).

### Org Charts (`org-chart.ts`)
- Generated as PNG images from Tier 1 `personnel` records (filtered to `is_key_personnel`)
- Uses Mermaid syntax for org chart definitions
- Company name as root node

### Process Diagrams (`process-diagram.ts`)
- Generated as PNG images
- Mermaid flowchart syntax
- Standard processes defined (quality control, etc.)

### Timelines (`timeline.ts`)
- Gantt chart generation
- Shows transition timeline, PoP milestones

### Branding (`branding.ts`)
- Logo integration into exhibits
- Uses `CompanyProfile` type from `company-types.ts`

### Rendering (`render.ts`)
- Mermaid CLI rendering to PNG image buffers
- Puppeteer config for headless rendering (`puppeteer.config.json`)

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

### Volume Downloads

**Route:** `GET /api/solicitations/[id]/draft/volumes/[volumeId]`
- Downloads DOCX from Supabase Storage via signed URL
- Individual volume download from the Draft tab UI

---

## Summary: What Goes Into a Generated Response

```
                    ┌─────────────────────────────┐
                    │     SYSTEM PROMPT            │
                    │  Expert proposal writer      │
                    │  SHIPLEY methodology         │
                    │  Compliance-first language    │
                    │  Hard page limit enforcement  │
                    │  Placeholder convention       │
                    └──────────────┬──────────────┘
                                   │
    ┌──────────────────────────────┼──────────────────────────────┐
    │                              │                              │
┌───┴──────┐   ┌──────────┐  ┌────┴─────┐           ┌───────────┴──┐
│  TIER 1  │   │ TIER 1   │  │  TIER 2  │           │   PHASE 7    │
│ Profile  │   │ Collctns │  │ Data Call│           │  Extractions │
├──────────┤   ├──────────┤  ├──────────┤           ├──────────────┤
│ Name     │   │Personnel │  │ PP refs  │           │ Section L    │
│ Overview │   │Past Perf │  │ Key pers │           │ Section M    │
│ Services │   │Certs     │  │ Tech app │           │ SOW/PWS      │
│ Win thms │   │Vehicles  │  │ Oppty dtl│           │ Admin data   │
│ Mgmt apch│   │NAICS     │  │ Complnce │           │ Cost/price   │
│ Colors   │   │          │  │          │           │ PP criteria  │
└───┬──────┘   └────┬─────┘  └────┬─────┘           └──────┬──────┘
    └───────────────┼─────────────┼────────────────────────┘
                    │    CROSS-REFERENCE            │
                    │  Tier 2 refs ↔ Tier 1 records │
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │     VOLUME-SPECIFIC PROMPT   │
                    │  + Hard page limit ceiling    │
                    │  + Evaluation factors          │
                    │  + Win theme instructions      │
                    │  + Sparse data handling        │
                    └──────────────┬──────────────┘
                                   │
                           Claude Sonnet 4.6
                        (temp=0.3, 8192 tokens)
                                   │
                    ┌──────────────┴──────────────┐
                    │     MARKDOWN RESPONSE        │
                    │  Parsed into sections        │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │     DOCX GENERATION          │
                    │  Company color palette        │
                    │  Cover page + TOC             │
                    │  Headers/footers              │
                    │  Numbered headings            │
                    │  Requirement boxes             │
                    │  Win theme callouts            │
                    │  Tables + exhibits             │
                    │  Embedded diagrams (standard)  │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │     SUPABASE STORAGE         │
                    │  .docx file + markdown        │
                    │  preview in DB                │
                    └─────────────────────────────┘
```

---

## Touchup Pipeline (Phase 10) — Per-Volume Interactive

### Overview

The Touchup feature is an optional post-generation layer that sits downstream of the Phase 9 draft pipeline. It does NOT modify the first draft — it produces a separate second draft. The system uses a **per-volume interactive workflow** with a dedicated Touchup tab, giving users full control over which volumes to score and rewrite.

**Two-step user flow:**
1. **Score** — Select volumes and run AI scoring. Review the gap analysis for each volume.
2. **Rewrite** — Explicitly trigger a rewrite for specific volumes after reviewing scores.

### Architecture

```
User selects volumes → Click "Score Selected"
   ↓
Inngest: proposal.touchup.score (one per volume)
   ↓
User reviews gap analysis per volume
   ↓
User clicks "Rewrite This Volume"
   ↓
Inngest: proposal.touchup.rewrite (one per volume)
   ↓ Rewrite + Regression Guard + DOCX
User reviews result, downloads DOCX
   ↓
Optional: Generate Compliance Matrix (synchronous)
```

### Inngest Functions

#### Touchup Scorer (`lib/inngest/functions/touchup-scorer.ts`)

**Event:** `proposal.touchup.score`
**Payload:** `{ solicitationId, companyId, draftId, touchupId, touchupVolumeId }`

Scores a single volume. Steps:
1. `fetch-data` — Load company profile, compliance extractions, data call, single draft volume content
2. `score-volume` — Call Claude Sonnet 4.6 via `messages.stream().finalMessage()` (`max_tokens: 32768`, `temperature: 0.1`), parse gap analysis JSON, set volume status to `'scored'`

**Prompt file:** `lib/generation/touchup/scoring-prompt.ts`

The AI outputs structured JSON:
- `compliance_score`: 0-100
- `requirements_coverage[]`: per-requirement status (covered/partial/missing)
- `data_verification[]`: claims cross-checked against source data
- `missing_content[]`: topics with available data not used
- `placeholder_items[]`: each [PLACEHOLDER] with resolution if data exists
- `compliance_language_issues[]`: tone/phrasing problems
- Fabrication flags: claims not backed by any source

#### Touchup Rewriter (`lib/inngest/functions/touchup-rewriter.ts`)

**Event:** `proposal.touchup.rewrite`
**Payload:** `{ solicitationId, companyId, draftId, touchupId, touchupVolumeId }`

Rewrites a single volume and runs regression guard. Steps:
1. `fetch-data` — Load all source data + draft volume + gap analysis from scoring
2. `rewrite-volume` — Call Claude Sonnet 4.6 via `messages.stream().finalMessage()` (`max_tokens: 32768`, `temperature: 0.3`)
3. `regression-guard` — Section-by-section comparison via Claude (`max_tokens: 8192`, `temperature: 0.1`), deterministic decision rule, DOCX generation, upload to storage. Sets volume status to `'completed'`.

**Prompt files:**
- `lib/generation/touchup/rewrite-prompt.ts`
- `lib/generation/touchup/regression-guard-prompt.ts`

**Regression Guard Decision Rule** (deterministic code, not AI): if touchup_total >= draft1_total, keep touchup; otherwise revert to draft 1. Assembles final volume from best sections; logs reversions in `regression_reversions` JSONB.

**Streaming Transport:** Both functions use `anthropic.messages.stream().finalMessage()` to satisfy the Anthropic SDK's requirement for streaming when `max_tokens >= 32768`. Returns the same `Message` shape. Individual calls take 3-5 minutes, within Inngest step limits.

### Database Tables

**Schema:** `supabase_tables/supabase-touchup-draft-migration.sql` + `supabase-touchup-v2-migration.sql`

- `touchup_analyses` — Lightweight session container. `status` is `'active'` or `'completed'`. Aggregate stats (overall score, total gaps) are computed on-the-fly by the GET endpoint, not stored by Inngest.
- `touchup_volumes` — Per-volume data. Status flow: `pending → scoring → scored → rewriting → completed`. Stores `gap_analysis` (JSONB), `content_markdown`, `regression_reversions`, scores.

**Types:** `lib/supabase/touchup-types.ts`

### API Routes

**File:** `app/api/solicitations/[id]/touchup/route.ts`

- `GET` — Returns: `draftReady` flag, `draftVolumes` (for selector), `touchup` analysis record, `volumes` with statuses and scores, `aggregates` (computed on-the-fly). Auto-cleans stale sessions if user regenerated their draft.
- `POST (action: "score")` — Accepts `{ action: "score", volumeIds: string[] }`. Creates/upserts `touchup_analyses` and `touchup_volumes`, sends one `proposal.touchup.score` Inngest event per volume. Duplicate guard: skips volumes already in `'scoring'` status.
- `POST (action: "rewrite")` — Accepts `{ action: "rewrite", touchupVolumeId: string }`. Validates volume is `'scored'`. Sends one `proposal.touchup.rewrite` Inngest event.
- `POST (action: "generate-matrix")` — Synchronous. Builds a markdown compliance matrix from existing `touchup_volumes` gap analysis data. No AI call needed.

**Download:** `GET /api/solicitations/[id]/touchup/volumes/[volumeId]` — Downloads touchup DOCX

### Safeguards

- **Stale session cleanup** — GET endpoint detects orphaned `touchup_analyses` (zero volumes after draft regeneration cascade-delete) and auto-deletes them.
- **Computed aggregates** — `overall_compliance_score`, `total_gaps`, etc. calculated at read time from current `touchup_volumes` data. Always accurate.
- **Duplicate scoring guard** — API checks volume status before accepting; Inngest checks at execution start.
- **Rewrite prerequisite** — Volume must be `'scored'` before rewrite is accepted.
- **Draft completion check** — GET returns `draftReady: false` if no completed draft exists.
- **Re-scoring** — Resets all scoring/rewriting fields when user re-scores a previously scored volume.

### UI Integration

The Touchup feature has its own dedicated tab in the solicitation page, separate from the Draft tab.

**Tab added to:** `app/solicitations/[id]/page.tsx` — "Touchup" tab with Sparkles icon, between Draft and Logs.

**Component:** `app/components/touchup/TouchupTab.tsx`

- **Draft prerequisite check** — Shows "complete your draft first" if no completed draft
- **Volume selector** — Multi-select checkboxes of completed draft volumes with status badges
- **Score button** — "Score Selected Volumes" triggers per-volume scoring
- **Volume cards** — One per touchup volume, showing:
  - `scoring`: spinner with progress message
  - `scored`: compliance score, requirements coverage summary, fabrication flags, expandable gap analysis, "Rewrite This Volume" button
  - `rewriting`: spinner with progress message
  - `completed`: before/after scores, word count, page estimate, regression reversions, DOCX download, markdown preview
  - `failed`: error message
- **Aggregates banner** — Average compliance score, total gaps, scored/rewritten counts
- **Generate Compliance Matrix** button — Visible when at least one volume is scored/completed
- **3-second polling** — Active when any volume is in `'scoring'` or `'rewriting'` status
