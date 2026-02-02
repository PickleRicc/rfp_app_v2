# RFP Proposal Generator

## What This Is

An internal tool for government IT contractors that automates RFP (Request for Proposal) response generation. Users upload RFP documents, the system analyzes requirements using Claude AI, and generates professional proposal volumes (Technical, Management, Past Performance) as polished DOCX files ready for submission.

## Core Value

Generated proposals must be indistinguishable from those written by expert government proposal writers — the kind that win contracts.

## Requirements

### Validated

<!-- Shipped and confirmed working -->

- ✓ Multi-stage document processing pipeline (classifier → analyzer → generator) — existing
- ✓ RFP document upload and text extraction (PDF, DOCX) — existing
- ✓ AI-powered requirement extraction and categorization — existing
- ✓ Multi-company support with company profiles — existing
- ✓ DOCX proposal generation with basic styling — existing
- ✓ Volume structure (Technical, Management, Past Performance, Price) — existing
- ✓ Executive summary generation — existing
- ✓ Technical approach with task area breakdown — existing
- ✓ Management approach with org structure — existing
- ✓ Transition plan generation — existing
- ✓ Past performance citations — existing
- ✓ Resume templates — existing
- ✓ Compliance matrix (Excel) — existing
- ✓ Exhibit system with sequential numbering — existing
- ✓ Win theme integration — existing
- ✓ Heading hierarchy (4 levels) — existing
- ✓ Table of contents auto-generation — existing
- ✓ Headers and footers — existing

### Active

<!-- Current milestone: Full Framework Alignment -->

**P0 - Critical (must have for production):**
- [ ] Cover letter with all required elements (CO address, capability statement, discriminators, signature)
- [ ] Requirement cross-references in headings (`[RFQ L.4.2; PWS REQ 3.1]` format)
- [ ] Systematic compliance language patterns ("Company will..." for every "shall")
- [ ] Company logo integration (cover page, headers)

**P1 - High Priority:**
- [ ] Visually distinct call-out boxes (bordered, shaded, floatable)
- [ ] Ghosting implementation (competitive differentiation without naming competitors)
- [ ] Exhibit validation (verify all references have corresponding exhibits)
- [ ] Explicit section-to-requirement mapping
- [ ] Page allocation system (track pages, warn on limits)

**P2 - Medium Priority:**
- [ ] Understanding paragraph pattern enforcement (`[Agency] requires... [Company] will...`)
- [ ] Systematic proof point injection (past performance tied to proposed approaches)
- [ ] Deliverables subsection per task area
- [ ] Benefits callout boxes per approach section
- [ ] Phase-based transition plan structure

**P3 - Polish:**
- [ ] Heading style variants (same page, unnumbered, force new page)
- [ ] Additional table text styles
- [ ] Intense quote/reference styles
- [ ] Graphics generation (org charts, Gantt charts, process diagrams via Mermaid)
- [ ] Section L compliance checking
- [ ] Acronym management (define on first use)
- [ ] Color team review version (with comments, highlighted themes)
- [ ] Outline view generation
- [ ] Submission checklist generation
- [ ] Organized package structure (folders for volumes, graphics, final)
- [ ] PDF generation option
- [ ] Alt text for accessibility

### Out of Scope

- Mobile app — desktop/browser workflow is sufficient for proposal writers
- Real-time collaboration — single-user tool, proposals reviewed externally
- Pricing calculation — price volumes are manually prepared
- Template designer UI — templates managed in code
- OCR for scanned PDFs — require text-based PDFs

## Context

**Existing codebase:** Brownfield project with working document processing pipeline and DOCX generation. Currently at ~70% alignment with the Proposal Response Generation Framework.

**Framework:** `Proposal_Response_Generation_Framework.md` defines the complete specification for expert-level government proposals, modeled after winning templates from successful contractors.

**Gap analysis:** `FRAMEWORK_GAP_ANALYSIS.md` documents current state and identified gaps. User is actively working on requirement cross-references (GAP 2).

**Target users:** Government IT contractors (specifically Impyrian) who respond to federal RFPs and need proposals that look like they came from seasoned capture professionals.

## Constraints

- **Tech stack:** Next.js 16, React 19, TypeScript, Supabase, Inngest, Anthropic Claude API, docx library — no major architecture changes
- **Document format:** DOCX primary output (Word editing required before submission)
- **Framework compliance:** All output must conform to Proposal_Response_Generation_Framework.md

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fresh framework audit before implementation | Existing gap analysis may be outdated, need comprehensive current-state assessment | — Pending |
| Prioritize visual polish (logo, layout) alongside content | User explicitly identified these as production blockers | — Pending |

---
*Last updated: 2026-02-01 after initialization*
